import { EventEmitter } from "node:events";
import type {
  AnswerBucket,
  AnswerBucketId,
  Bet,
  BetBucketId,
  GameConfig,
  GamePhase,
  Player,
  Question,
  RoundState,
} from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";
import { computeBuckets, findWinningBucket, calculatePayouts, computeLeaderboardPoints } from "./scoring.js";
import { pickQuestions } from "./questions.js";

export interface GameEvents {
  phaseChange: [phase: GamePhase, timeRemaining: number];
  tick: [phase: GamePhase, timeRemaining: number];
  playerJoined: [player: Player];
  guessReceived: [playerId: string, guess: number];
  betReceived: [playerId: string, bets: Bet[]];
  bucketsComputed: [buckets: AnswerBucket[]];
  roundResult: [winningBucketId: AnswerBucketId, payouts: Map<string, number>];
  gameOver: [standings: { playerId: string; chips: number; leaderboardPoints: number }[]];
}

export class Game extends EventEmitter<GameEvents> {
  private config: GameConfig;
  private players = new Map<string, Player>();
  private phase: GamePhase = "lobby";
  private timer: ReturnType<typeof setInterval> | null = null;
  private timeRemaining = 0;
  private questions: Question[] = [];
  private roundIndex = 0;
  private round: RoundState | null = null;

  constructor(config: Partial<GameConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // -- Public API --

  getPhase(): GamePhase {
    return this.phase;
  }

  getTimeRemaining(): number {
    return this.timeRemaining;
  }

  getPlayers(): Map<string, Player> {
    return this.players;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getRound(): RoundState | null {
    return this.round;
  }

  getRoundIndex(): number {
    return this.roundIndex;
  }

  getTotalRounds(): number {
    return this.questions.length;
  }

  getConfig(): GameConfig {
    return this.config;
  }

  /** Start the game loop. Enters LOBBY phase. */
  start(): void {
    this.enterPhase("lobby");
  }

  /** Shut down the game loop. */
  stop(): void {
    this.clearTimer();
  }

  // -- Player management --

  /** Add a player to the game. Only allowed during LOBBY. Returns false if rejected. */
  addPlayer(id: string, name: string, platform: Player["platform"] = "twitch"): boolean {
    if (this.players.has(id)) return false;
    if (this.phase !== "lobby") return false;

    const player: Player = {
      id,
      name,
      platform,
      chips: this.config.startingChips,
      guess: null,
      bets: [],
    };
    this.players.set(id, player);
    this.emit("playerJoined", player);
    return true;
  }

  // -- Guess --

  /** Submit a guess for the current question. Only during QUESTION phase. First guess counts. */
  submitGuess(playerId: string, guess: number): boolean {
    if (this.phase !== "question") return false;
    if (!this.round) return false;

    const player = this.players.get(playerId);
    if (!player) return false;
    // First guess counts
    if (this.round.guesses.has(playerId)) return false;

    this.round.guesses.set(playerId, guess);
    player.guess = guess;
    this.emit("guessReceived", playerId, guess);

    // Auto-advance if all players have guessed
    if (this.round.guesses.size >= this.players.size) {
      this.advancePhase();
    }

    return true;
  }

  // -- Bets --

  /** Place bets for a player. Only during BETTING phase.
   *  A player can place 1-2 bets on different buckets. Total chips bet must not exceed their balance. */
  submitBets(playerId: string, bets: Bet[]): boolean {
    if (this.phase !== "betting") return false;
    if (!this.round) return false;

    const player = this.players.get(playerId);
    if (!player) return false;
    // One bet submission per round
    if (this.round.bets.has(playerId)) return false;

    // Validate
    if (bets.length === 0 || bets.length > 2) return false;
    const totalChips = bets.reduce((sum, b) => sum + b.chips, 0);
    if (totalChips > player.chips) return false;
    if (totalChips <= 0) return false;
    // Must bet on different buckets
    if (bets.length === 2 && bets[0].bucket === bets[1].bucket) return false;
    // Each bet must be positive
    if (bets.some((b) => b.chips <= 0)) return false;

    player.bets = bets;
    this.round.bets.set(playerId, bets);
    this.emit("betReceived", playerId, bets);

    // Auto-advance if all players have bet
    if (this.round.bets.size >= this.players.size) {
      this.advancePhase();
    }

    return true;
  }

  // -- Phase transitions --

  private enterPhase(phase: GamePhase): void {
    this.clearTimer();
    this.phase = phase;
    this.timeRemaining = this.config.phaseDurations[phase];

    switch (phase) {
      case "lobby":
        this.onEnterLobby();
        break;
      case "question":
        this.onEnterQuestion();
        break;
      case "betting":
        this.onEnterBetting();
        break;
      case "reveal":
        this.onEnterReveal();
        break;
      case "scores":
        this.onEnterScores();
        break;
    }

    this.emit("phaseChange", phase, this.timeRemaining);
    this.startTimer();
  }

  /** Called when the phase timer runs out or an early advance triggers. */
  private advancePhase(): void {
    switch (this.phase) {
      case "lobby":
        this.enterPhase("question");
        break;
      case "question":
        this.enterPhase("betting");
        break;
      case "betting":
        this.enterPhase("reveal");
        break;
      case "reveal":
        this.enterPhase("scores");
        break;
      case "scores":
        if (this.roundIndex < this.questions.length - 1) {
          this.roundIndex++;
          this.enterPhase("question");
        } else {
          this.onGameOver();
        }
        break;
    }
  }

  // -- Phase handlers --

  private onEnterLobby(): void {
    // Reset player state for a new game
    this.roundIndex = 0;
    this.round = null;
    this.questions = pickQuestions(
      this.config.category,
      this.config.questionsPerGame
    );
    for (const player of this.players.values()) {
      player.chips = this.config.startingChips;
      player.guess = null;
      player.bets = [];
    }
  }

  private onEnterQuestion(): void {
    const question = this.questions[this.roundIndex];
    this.round = {
      questionIndex: this.roundIndex,
      question,
      guesses: new Map(),
      buckets: [],
      bets: new Map(),
      winningBucketId: null,
    };
    // Clear per-round player state
    for (const player of this.players.values()) {
      player.guess = null;
      player.bets = [];
    }
  }

  private onEnterBetting(): void {
    if (!this.round) return;
    // Compute answer buckets from guesses
    const buckets = computeBuckets(this.round.guesses);
    this.round.buckets = buckets;
    this.emit("bucketsComputed", buckets);
  }

  private onEnterReveal(): void {
    if (!this.round) return;
    // Determine winning bucket
    const winningId = findWinningBucket(
      this.round.buckets,
      this.round.question.answer
    );
    this.round.winningBucketId = winningId;

    if (winningId !== null) {
      // Calculate and apply payouts
      const payoutMap = calculatePayouts(this.players, this.round.buckets, winningId);
      for (const [playerId, net] of payoutMap) {
        const player = this.players.get(playerId);
        if (player) {
          player.chips = Math.max(0, player.chips + net);
        }
      }
      this.emit("roundResult", winningId, payoutMap);
    }
  }

  private onEnterScores(): void {
    // Display phase — nothing to compute, just show results
  }

  private onGameOver(): void {
    this.clearTimer();
    const leaderboardPoints = computeLeaderboardPoints(this.players);
    const standings = [...this.players.values()]
      .map((p) => ({
        playerId: p.id,
        chips: p.chips,
        leaderboardPoints: leaderboardPoints.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.chips - a.chips);

    this.emit("gameOver", standings);

    // Loop back to lobby for the next game
    this.enterPhase("lobby");
  }

  // -- Timer --

  private startTimer(): void {
    this.timer = setInterval(() => {
      this.timeRemaining--;
      this.emit("tick", this.phase, this.timeRemaining);
      if (this.timeRemaining <= 0) {
        this.advancePhase();
      }
    }, 1000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
