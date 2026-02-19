import skmeans from "skmeans";
import type {
  AnswerBucket,
  AnswerBucketId,
  Bet,
  BetBucketId,
  PERCENTILE_TIERS,
  Player,
  BUCKET_PAYOUTS,
  LOWER_BUCKET_PAYOUT,
} from "./types.js";
import {
  BUCKET_PAYOUTS as payouts,
  LOWER_BUCKET_PAYOUT as lowerPayout,
  PERCENTILE_TIERS as tiers,
} from "./types.js";

/** Group player guesses into up to 7 answer buckets. */
export function computeBuckets(
  guesses: Map<string, number>
): AnswerBucket[] {
  if (guesses.size === 0) return [];

  // Condense identical guesses
  const byAnswer = new Map<number, string[]>();
  for (const [playerId, answer] of guesses) {
    const existing = byAnswer.get(answer);
    if (existing) {
      existing.push(playerId);
    } else {
      byAnswer.set(answer, [playerId]);
    }
  }

  // Sort unique answers ascending
  const uniqueAnswers = [...byAnswer.keys()].sort((a, b) => a - b);

  let bucketEntries: { answer: number; playerIds: string[] }[];

  if (uniqueAnswers.length <= 7) {
    // No clustering needed
    bucketEntries = uniqueAnswers.map((answer) => ({
      answer,
      playerIds: byAnswer.get(answer)!,
    }));
  } else {
    // K-means cluster into 7 groups
    const result = skmeans(uniqueAnswers, 7, null, 50);
    // Group answers by cluster assignment, using centroid as representative answer
    const clusterMap = new Map<number, { answers: number[]; playerIds: string[] }>();
    for (let i = 0; i < uniqueAnswers.length; i++) {
      const clusterId = result.idxs[i];
      const entry = clusterMap.get(clusterId);
      const players = byAnswer.get(uniqueAnswers[i])!;
      if (entry) {
        entry.answers.push(uniqueAnswers[i]);
        entry.playerIds.push(...players);
      } else {
        clusterMap.set(clusterId, {
          answers: [uniqueAnswers[i]],
          playerIds: [...players],
        });
      }
    }

    // Use median answer per cluster as representative, sort ascending
    bucketEntries = [...clusterMap.values()]
      .map((cluster) => {
        const sorted = cluster.answers.sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        return { answer: median, playerIds: cluster.playerIds };
      })
      .sort((a, b) => a.answer - b.answer);
  }

  // Center the bucket IDs (1-7)
  const count = bucketEntries.length;
  const offset = Math.floor((7 - count) / 2) + 1;
  return bucketEntries.map((entry, i) => ({
    bucketId: (i + offset) as AnswerBucketId,
    answer: entry.answer,
    playerIds: entry.playerIds,
  }));
}

/** Determine which bucket contains (or is closest to) the correct answer.
 *  The winning bucket is the one whose answer is closest without going over.
 *  If all buckets are over, the lowest bucket wins. */
export function findWinningBucket(
  buckets: AnswerBucket[],
  correctAnswer: number
): AnswerBucketId | null {
  if (buckets.length === 0) return null;

  // Find the closest bucket that doesn't go over
  let best: AnswerBucket | null = null;
  for (const bucket of buckets) {
    if (bucket.answer <= correctAnswer) {
      if (!best || bucket.answer > best.answer) {
        best = bucket;
      }
    }
  }

  // If all buckets went over, the lowest bucket wins
  if (!best) {
    best = buckets.reduce((min, b) => (b.answer < min.answer ? b : min));
  }

  return best.bucketId;
}

/** Calculate chip payouts for a round. Returns a map of playerId → chips won/lost. */
export function calculatePayouts(
  players: Map<string, Player>,
  buckets: AnswerBucket[],
  winningBucketId: AnswerBucketId
): Map<string, number> {
  const results = new Map<string, number>();

  for (const [playerId, player] of players) {
    let netChips = 0;
    for (const bet of player.bets) {
      if (bet.bucket === winningBucketId) {
        // Winner! Pay out based on bucket position
        const multiplier = payouts[winningBucketId];
        netChips += bet.chips * multiplier;
      } else if (bet.bucket === 0 && isLowerThanAllCorrect(buckets, winningBucketId)) {
        // "Lower than all" bucket wins only if the correct answer is lower than all guesses
        netChips += bet.chips * lowerPayout;
      } else {
        // Lost bet
        netChips -= bet.chips;
      }
    }
    results.set(playerId, netChips);
  }

  return results;
}

function isLowerThanAllCorrect(
  buckets: AnswerBucket[],
  _winningBucketId: AnswerBucketId
): boolean {
  // The "lower than all" bucket only wins if no bucket matched
  // This is a simplification — in practice we'd check the actual answer vs all buckets
  return false;
}

/** Given final chip counts, compute leaderboard points using the percentile tier table. */
export function computeLeaderboardPoints(
  players: Map<string, Player>
): Map<string, number> {
  const points = new Map<string, number>();
  const sorted = [...players.entries()].sort(
    (a, b) => b[1].chips - a[1].chips
  );
  const totalPlayers = sorted.length;

  if (totalPlayers < 3) {
    // Not enough players — no points awarded
    for (const [id] of sorted) points.set(id, 0);
    return points;
  }

  for (let rank = 0; rank < sorted.length; rank++) {
    const [playerId] = sorted[rank];
    // Percentile = (rank) / totalPlayers — rank 0 = top
    const percentile = (rank + 1) / totalPlayers;
    let awarded = 1; // minimum participation
    for (const tier of tiers) {
      if (percentile <= tier.maxPercentile) {
        awarded = tier.points;
        break;
      }
    }
    points.set(playerId, awarded);
  }

  return points;
}
