/** Core types for the Brains & Bets game engine */

// -- Questions --

/** A question is [text, numericAnswer] or [text, numericAnswer, explanation] */
export type RawQuestion = [string, number] | [string, number, string];

export interface Question {
  text: string;
  answer: number;
  explanation?: string;
}

// -- Answer Buckets --

export type AnswerBucketId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Bucket 0 = "lower than all guesses" */
export type BetBucketId = AnswerBucketId | 0;

export interface AnswerBucket {
  bucketId: AnswerBucketId;
  answer: number;
  playerIds: string[];
}

// -- Bets --

export interface Bet {
  bucket: BetBucketId;
  chips: number;
}

export interface PlayerBets {
  playerId: string;
  bets: Bet[];
}

// -- Players --

export interface Player {
  id: string;
  name: string;
  platform: "twitch" | "youtube" | "local";
  chips: number;
  guess: number | null;
  bets: Bet[];
}

// -- Game Phases --

export type GamePhase = "lobby" | "question" | "betting" | "reveal" | "scores";

// -- Round State --

export interface RoundState {
  questionIndex: number;
  question: Question;
  guesses: Map<string, number>;
  buckets: AnswerBucket[];
  bets: Map<string, Bet[]>;
  winningBucketId: AnswerBucketId | null;
}

// -- Game Config --

export interface GameConfig {
  /** Number of questions per game */
  questionsPerGame: number;
  /** Starting chips for each player */
  startingChips: number;
  /** Duration of each phase in seconds */
  phaseDurations: Record<GamePhase, number>;
  /** Minimum players to start a game */
  minPlayers: number;
  /** Category to use for questions */
  category: string;
}

export const DEFAULT_CONFIG: GameConfig = {
  questionsPerGame: 6,
  startingChips: 3,
  phaseDurations: {
    lobby: 45,
    question: 50,
    betting: 35,
    reveal: 18,
    scores: 18,
  },
  minPlayers: 3,
  category: "General",
};

// -- Payout Multipliers --

/** Payout multipliers by bucket position (Wits & Wagers style).
 *  Buckets closer to the edges pay more. */
export const BUCKET_PAYOUTS: Record<AnswerBucketId, number> = {
  1: 4,
  2: 3,
  3: 2,
  4: 2,
  5: 2,
  6: 3,
  7: 4,
};

/** The "lower than all" bucket (0) pays 4:1 */
export const LOWER_BUCKET_PAYOUT = 4;

// -- Percentile Leaderboard Points --

export interface PercentileTier {
  maxPercentile: number;
  points: number;
}

export const PERCENTILE_TIERS: PercentileTier[] = [
  { maxPercentile: 0.01, points: 100 },
  { maxPercentile: 0.02, points: 75 },
  { maxPercentile: 0.03, points: 60 },
  { maxPercentile: 0.05, points: 50 },
  { maxPercentile: 0.10, points: 35 },
  { maxPercentile: 0.25, points: 20 },
  { maxPercentile: 0.50, points: 10 },
  { maxPercentile: 0.75, points: 5 },
  { maxPercentile: 1.00, points: 1 },
];
