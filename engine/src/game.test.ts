import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Game } from "./game.js";
import * as questionsModule from "./questions.js";
import type { Question } from "./types.js";

// Mock question loading so we don't need actual files
vi.mock("./questions.js", () => ({
  pickQuestions: vi.fn(),
}));

const mockPickQuestions = vi.mocked(questionsModule.pickQuestions);

const fakeQuestions: Question[] = [
  { text: "What is 2+2?", answer: 4 },
  { text: "Year of moon landing?", answer: 1969 },
];

describe("Game", () => {
  let game: Game;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPickQuestions.mockReturnValue(fakeQuestions);
    game = new Game({
      questionsPerGame: 2,
      startingChips: 10,
      phaseDurations: {
        lobby: 5,
        question: 5,
        betting: 5,
        reveal: 5,
        scores: 5,
      },
      minPlayers: 1,
      category: "Test",
    });
  });

  afterEach(() => {
    game.stop();
    vi.useRealTimers();
  });

  describe("lobby phase", () => {
    it("starts in lobby phase", () => {
      game.start();
      expect(game.getPhase()).toBe("lobby");
    });

    it("allows adding players during lobby", () => {
      game.start();
      expect(game.addPlayer("p1", "Alice")).toBe(true);
      expect(game.getPlayer("p1")?.name).toBe("Alice");
    });

    it("rejects duplicate player IDs", () => {
      game.start();
      game.addPlayer("p1", "Alice");
      expect(game.addPlayer("p1", "Alice2")).toBe(false);
    });

    it("initializes players with starting chips", () => {
      game.start();
      game.addPlayer("p1", "Alice");
      expect(game.getPlayer("p1")?.chips).toBe(10);
    });

    it("transitions to question phase when lobby timer expires", () => {
      game.start();
      game.addPlayer("p1", "Alice");
      // Advance 5 seconds for lobby phase
      vi.advanceTimersByTime(5000);
      expect(game.getPhase()).toBe("question");
    });
  });

  describe("question phase", () => {
    beforeEach(() => {
      game.start();
      game.addPlayer("p1", "Alice");
      game.addPlayer("p2", "Bob");
      // Advance past lobby
      vi.advanceTimersByTime(5000);
    });

    it("accepts guesses during question phase", () => {
      expect(game.submitGuess("p1", 4)).toBe(true);
    });

    it("rejects guesses from unknown players", () => {
      expect(game.submitGuess("unknown", 4)).toBe(false);
    });

    it("rejects duplicate guesses from same player", () => {
      game.submitGuess("p1", 4);
      expect(game.submitGuess("p1", 5)).toBe(false);
    });

    it("auto-advances when all players guess", () => {
      game.submitGuess("p1", 4);
      game.submitGuess("p2", 5);
      expect(game.getPhase()).toBe("betting");
    });

    it("advances on timeout even without all guesses", () => {
      game.submitGuess("p1", 4);
      vi.advanceTimersByTime(5000);
      expect(game.getPhase()).toBe("betting");
    });
  });

  describe("betting phase", () => {
    beforeEach(() => {
      game.start();
      game.addPlayer("p1", "Alice");
      game.addPlayer("p2", "Bob");
      vi.advanceTimersByTime(5000); // → question
      game.submitGuess("p1", 4);
      game.submitGuess("p2", 5); // → betting
    });

    it("accepts valid bets", () => {
      const round = game.getRound()!;
      const bucketId = round.buckets[0].bucketId;
      expect(game.submitBets("p1", [{ bucket: bucketId, chips: 2 }])).toBe(true);
    });

    it("rejects bets exceeding player chips", () => {
      const round = game.getRound()!;
      const bucketId = round.buckets[0].bucketId;
      expect(game.submitBets("p1", [{ bucket: bucketId, chips: 999 }])).toBe(false);
    });

    it("rejects empty bets", () => {
      expect(game.submitBets("p1", [])).toBe(false);
    });

    it("rejects more than 2 bets", () => {
      const round = game.getRound()!;
      const b = round.buckets[0].bucketId;
      expect(
        game.submitBets("p1", [
          { bucket: b, chips: 1 },
          { bucket: b, chips: 1 },
          { bucket: b, chips: 1 },
        ])
      ).toBe(false);
    });

    it("rejects duplicate bucket bets", () => {
      const round = game.getRound()!;
      const b = round.buckets[0].bucketId;
      expect(
        game.submitBets("p1", [
          { bucket: b, chips: 1 },
          { bucket: b, chips: 1 },
        ])
      ).toBe(false);
    });

    it("rejects bets with zero chips", () => {
      const round = game.getRound()!;
      const bucketId = round.buckets[0].bucketId;
      expect(game.submitBets("p1", [{ bucket: bucketId, chips: 0 }])).toBe(false);
    });

    it("rejects second bet submission from same player", () => {
      const round = game.getRound()!;
      const bucketId = round.buckets[0].bucketId;
      game.submitBets("p1", [{ bucket: bucketId, chips: 1 }]);
      expect(game.submitBets("p1", [{ bucket: bucketId, chips: 1 }])).toBe(false);
    });

    it("auto-advances to reveal when all players bet", () => {
      const round = game.getRound()!;
      const bucketId = round.buckets[0].bucketId;
      game.submitBets("p1", [{ bucket: bucketId, chips: 1 }]);
      game.submitBets("p2", [{ bucket: bucketId, chips: 1 }]);
      expect(game.getPhase()).toBe("reveal");
    });
  });

  describe("game flow", () => {
    it("emits phaseChange events", () => {
      const phases: string[] = [];
      game.on("phaseChange", (phase) => phases.push(phase));
      game.start();
      game.addPlayer("p1", "Alice");
      vi.advanceTimersByTime(5000); // → question
      expect(phases).toContain("lobby");
      expect(phases).toContain("question");
    });

    it("progresses through all phases of a round", () => {
      game.start();
      game.addPlayer("p1", "Alice");

      expect(game.getPhase()).toBe("lobby");
      vi.advanceTimersByTime(5000); // → question
      expect(game.getPhase()).toBe("question");

      game.submitGuess("p1", 4); // → betting
      expect(game.getPhase()).toBe("betting");

      const round = game.getRound()!;
      const bucketId = round.buckets[0].bucketId;
      game.submitBets("p1", [{ bucket: bucketId, chips: 1 }]); // → reveal
      expect(game.getPhase()).toBe("reveal");

      vi.advanceTimersByTime(5000); // → scores
      expect(game.getPhase()).toBe("scores");
    });

    it("rejects players outside of lobby phase", () => {
      game.start();
      game.addPlayer("p1", "Alice");
      vi.advanceTimersByTime(5000); // → question
      expect(game.addPlayer("p2", "Bob")).toBe(false);
    });

    it("rejects guesses outside of question phase", () => {
      game.start();
      game.addPlayer("p1", "Alice");
      // Still in lobby
      expect(game.submitGuess("p1", 42)).toBe(false);
    });

    it("rejects bets outside of betting phase", () => {
      game.start();
      game.addPlayer("p1", "Alice");
      expect(game.submitBets("p1", [{ bucket: 4, chips: 1 }])).toBe(false);
    });

    it("returns correct round index and total rounds", () => {
      game.start();
      expect(game.getTotalRounds()).toBe(2);
      expect(game.getRoundIndex()).toBe(0);
    });
  });
});
