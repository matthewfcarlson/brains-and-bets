import { describe, it, expect } from "vitest";
import {
  computeBuckets,
  findWinningBucket,
  calculatePayouts,
  computeLeaderboardPoints,
} from "./scoring.js";
import type { AnswerBucket, AnswerBucketId, Player } from "./types.js";

// ---------------------------------------------------------------------------
// computeBuckets
// ---------------------------------------------------------------------------
describe("computeBuckets", () => {
  it("returns empty array for no guesses", () => {
    expect(computeBuckets(new Map())).toEqual([]);
  });

  it("creates a single centered bucket for one guess", () => {
    const guesses = new Map([["p1", 42]]);
    const buckets = computeBuckets(guesses);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].answer).toBe(42);
    expect(buckets[0].playerIds).toEqual(["p1"]);
    // Single bucket should be centered at position 4
    expect(buckets[0].bucketId).toBe(4);
  });

  it("groups identical guesses into one bucket", () => {
    const guesses = new Map<string, number>([
      ["p1", 100],
      ["p2", 100],
      ["p3", 100],
    ]);
    const buckets = computeBuckets(guesses);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].playerIds).toContain("p1");
    expect(buckets[0].playerIds).toContain("p2");
    expect(buckets[0].playerIds).toContain("p3");
  });

  it("creates separate buckets for different guesses (≤7)", () => {
    const guesses = new Map<string, number>([
      ["p1", 10],
      ["p2", 20],
      ["p3", 30],
    ]);
    const buckets = computeBuckets(guesses);
    expect(buckets).toHaveLength(3);
    // Should be sorted ascending by answer
    expect(buckets[0].answer).toBe(10);
    expect(buckets[1].answer).toBe(20);
    expect(buckets[2].answer).toBe(30);
  });

  it("bucket IDs are centered within 1-7 range", () => {
    const guesses = new Map<string, number>([
      ["p1", 10],
      ["p2", 20],
    ]);
    const buckets = computeBuckets(guesses);
    expect(buckets).toHaveLength(2);
    // 2 buckets, offset = floor((7-2)/2) + 1 = 3
    expect(buckets[0].bucketId).toBe(3);
    expect(buckets[1].bucketId).toBe(4);
  });

  it("handles exactly 7 unique guesses without clustering", () => {
    const guesses = new Map<string, number>([
      ["p1", 10],
      ["p2", 20],
      ["p3", 30],
      ["p4", 40],
      ["p5", 50],
      ["p6", 60],
      ["p7", 70],
    ]);
    const buckets = computeBuckets(guesses);
    expect(buckets).toHaveLength(7);
    expect(buckets.map((b) => b.bucketId)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("clusters into 7 buckets when more than 7 unique guesses", () => {
    const guesses = new Map<string, number>();
    for (let i = 0; i < 15; i++) {
      guesses.set(`p${i}`, i * 10);
    }
    const buckets = computeBuckets(guesses);
    expect(buckets).toHaveLength(7);
    // Bucket IDs should be 1-7
    expect(buckets.map((b) => b.bucketId)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // All players should be accounted for
    const allPlayers = buckets.flatMap((b) => b.playerIds);
    expect(allPlayers).toHaveLength(15);
  });
});

// ---------------------------------------------------------------------------
// findWinningBucket
// ---------------------------------------------------------------------------
describe("findWinningBucket", () => {
  const makeBuckets = (answers: number[]): AnswerBucket[] =>
    answers.map((answer, i) => ({
      bucketId: (i + 1) as AnswerBucketId,
      answer,
      playerIds: [`p${i}`],
    }));

  it("returns null for empty buckets", () => {
    expect(findWinningBucket([], 50)).toBeNull();
  });

  it("selects the bucket closest without going over", () => {
    const buckets = makeBuckets([10, 30, 50, 70]);
    expect(findWinningBucket(buckets, 55)).toBe(3); // bucket with answer 50
  });

  it("selects exact match", () => {
    const buckets = makeBuckets([10, 30, 50]);
    expect(findWinningBucket(buckets, 30)).toBe(2);
  });

  it("selects lowest bucket when all go over", () => {
    const buckets = makeBuckets([60, 70, 80]);
    expect(findWinningBucket(buckets, 50)).toBe(1); // bucket with answer 60
  });

  it("picks highest non-over bucket when multiple qualify", () => {
    const buckets = makeBuckets([10, 20, 30]);
    expect(findWinningBucket(buckets, 100)).toBe(3); // answer 30 is closest ≤100
  });
});

// ---------------------------------------------------------------------------
// calculatePayouts
// ---------------------------------------------------------------------------
describe("calculatePayouts", () => {
  function makePlayer(id: string, chips: number, bets: Player["bets"] = []): Player {
    return { id, name: id, platform: "local", chips, guess: null, bets };
  }

  it("awards chips to winning bets based on bucket payout multiplier", () => {
    const winningBucket = 4 as AnswerBucketId; // multiplier = 2
    const players = new Map<string, Player>([
      ["p1", makePlayer("p1", 10, [{ bucket: 4, chips: 2 }])],
    ]);
    const buckets: AnswerBucket[] = [
      { bucketId: 4, answer: 50, playerIds: ["p1"] },
    ];
    const payouts = calculatePayouts(players, buckets, winningBucket);
    // Won: 2 * 2 = 4 chips
    expect(payouts.get("p1")).toBe(4);
  });

  it("deducts chips for losing bets", () => {
    const winningBucket = 4 as AnswerBucketId;
    const players = new Map<string, Player>([
      ["p1", makePlayer("p1", 10, [{ bucket: 3, chips: 2 }])],
    ]);
    const buckets: AnswerBucket[] = [
      { bucketId: 3, answer: 30, playerIds: [] },
      { bucketId: 4, answer: 50, playerIds: [] },
    ];
    const payouts = calculatePayouts(players, buckets, winningBucket);
    expect(payouts.get("p1")).toBe(-2);
  });

  it("handles mixed winning and losing bets", () => {
    const winningBucket = 1 as AnswerBucketId; // multiplier = 4
    const players = new Map<string, Player>([
      [
        "p1",
        makePlayer("p1", 10, [
          { bucket: 1, chips: 1 }, // wins: 1 * 4 = 4
          { bucket: 3, chips: 2 }, // loses: -2
        ]),
      ],
    ]);
    const buckets: AnswerBucket[] = [
      { bucketId: 1, answer: 10, playerIds: [] },
      { bucketId: 3, answer: 30, playerIds: [] },
    ];
    const payouts = calculatePayouts(players, buckets, winningBucket);
    expect(payouts.get("p1")).toBe(2); // 4 - 2 = 2
  });

  it("returns 0 for players with no bets", () => {
    const winningBucket = 4 as AnswerBucketId;
    const players = new Map<string, Player>([
      ["p1", makePlayer("p1", 10)],
    ]);
    const buckets: AnswerBucket[] = [
      { bucketId: 4, answer: 50, playerIds: [] },
    ];
    const payouts = calculatePayouts(players, buckets, winningBucket);
    expect(payouts.get("p1")).toBe(0);
  });

  it("handles edge bucket payouts (bucket 7 pays 4x)", () => {
    const winningBucket = 7 as AnswerBucketId;
    const players = new Map<string, Player>([
      ["p1", makePlayer("p1", 10, [{ bucket: 7, chips: 3 }])],
    ]);
    const buckets: AnswerBucket[] = [
      { bucketId: 7, answer: 100, playerIds: [] },
    ];
    const payouts = calculatePayouts(players, buckets, winningBucket);
    expect(payouts.get("p1")).toBe(12); // 3 * 4
  });
});

// ---------------------------------------------------------------------------
// computeLeaderboardPoints
// ---------------------------------------------------------------------------
describe("computeLeaderboardPoints", () => {
  function makePlayer(id: string, chips: number): Player {
    return { id, name: id, platform: "local", chips, guess: null, bets: [] };
  }

  it("awards no points with fewer than 3 players", () => {
    const players = new Map<string, Player>([
      ["p1", makePlayer("p1", 100)],
      ["p2", makePlayer("p2", 50)],
    ]);
    const points = computeLeaderboardPoints(players);
    expect(points.get("p1")).toBe(0);
    expect(points.get("p2")).toBe(0);
  });

  it("awards points based on percentile rank with 3+ players", () => {
    const players = new Map<string, Player>([
      ["p1", makePlayer("p1", 100)],
      ["p2", makePlayer("p2", 50)],
      ["p3", makePlayer("p3", 10)],
    ]);
    const points = computeLeaderboardPoints(players);
    // rank 0: percentile = 1/3 ≈ 0.33 → tier maxPercentile 0.50 → 10 points
    expect(points.get("p1")).toBe(10);
    // rank 1: percentile = 2/3 ≈ 0.67 → tier maxPercentile 0.75 → 5 points
    expect(points.get("p2")).toBe(5);
    // rank 2: percentile = 3/3 = 1.0 → tier maxPercentile 1.00 → 1 point
    expect(points.get("p3")).toBe(1);
  });

  it("handles large player pools with correct percentile tiers", () => {
    const players = new Map<string, Player>();
    for (let i = 0; i < 100; i++) {
      players.set(`p${i}`, makePlayer(`p${i}`, 1000 - i));
    }
    const points = computeLeaderboardPoints(players);
    // Top player (rank 0): percentile = 1/100 = 0.01 → 100 points
    expect(points.get("p0")).toBe(100);
    // Player rank 1: percentile = 2/100 = 0.02 → 75 points
    expect(points.get("p1")).toBe(75);
  });
});
