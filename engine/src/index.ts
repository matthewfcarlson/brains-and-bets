import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Game } from "./game.js";
import { loadQuestions, getCategories } from "./questions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUESTIONS_DIR = join(__dirname, "../../src/assets/questions");

async function main() {
  console.log("Brains & Bets — Engine Demo");
  console.log("===========================\n");

  // Load questions
  await loadQuestions(QUESTIONS_DIR);
  const categories = getCategories();
  console.log(`Loaded categories: ${categories.join(", ")}\n`);

  // Create game
  const game = new Game({
    questionsPerGame: 3,
    startingChips: 3,
    phaseDurations: {
      lobby: 5,    // short for demo
      question: 8,
      betting: 6,
      reveal: 4,
      scores: 4,
    },
  });

  // Wire up events
  game.on("phaseChange", (phase, timeRemaining) => {
    console.log(`\n>>> Phase: ${phase.toUpperCase()} (${timeRemaining}s)`);

    if (phase === "question") {
      const round = game.getRound();
      if (round) {
        console.log(`  Q${game.getRoundIndex() + 1}/${game.getTotalRounds()}: ${round.question.text}`);
      }
    }

    if (phase === "betting") {
      const round = game.getRound();
      if (round) {
        console.log("  Buckets:");
        for (const b of round.buckets) {
          console.log(`    [${b.bucketId}] ${b.answer} (${b.playerIds.length} guesses)`);
        }
      }
    }

    if (phase === "reveal") {
      const round = game.getRound();
      if (round) {
        console.log(`  Correct answer: ${round.question.answer}`);
        if (round.question.explanation) {
          console.log(`  (${round.question.explanation})`);
        }
        console.log(`  Winning bucket: ${round.winningBucketId}`);
      }
    }

    if (phase === "scores") {
      console.log("  Standings:");
      const sorted = [...game.getPlayers().values()].sort((a, b) => b.chips - a.chips);
      for (const p of sorted) {
        console.log(`    ${p.name}: ${p.chips} chips`);
      }
    }
  });

  game.on("playerJoined", (player) => {
    console.log(`  + ${player.name} joined (${player.platform})`);
  });

  game.on("guessReceived", (playerId, guess) => {
    const name = game.getPlayer(playerId)?.name ?? playerId;
    console.log(`  ${name} guessed: ${guess}`);
  });

  game.on("betReceived", (playerId, bets) => {
    const name = game.getPlayer(playerId)?.name ?? playerId;
    const desc = bets.map((b) => `${b.chips} chip(s) on bucket ${b.bucket}`).join(", ");
    console.log(`  ${name} bet: ${desc}`);
  });

  game.on("gameOver", (standings) => {
    console.log("\n=== GAME OVER ===");
    for (const s of standings) {
      const name = game.getPlayer(s.playerId)?.name ?? s.playerId;
      console.log(`  ${name}: ${s.chips} chips, ${s.leaderboardPoints} LP`);
    }
    console.log("\nStopping demo...");
    game.stop();
    process.exit(0);
  });

  // Start game
  game.start();

  // Simulate players joining during lobby
  setTimeout(() => {
    game.addPlayer("tw:alice", "Alice", "twitch");
    game.addPlayer("tw:bob", "Bob", "twitch");
    game.addPlayer("yt:carol", "Carol", "youtube");
    game.addPlayer("tw:dave", "Dave", "twitch");
  }, 1000);

  // Simulate guesses and bets on each phase change
  game.on("phaseChange", (phase) => {
    if (phase === "question") {
      const round = game.getRound();
      if (!round) return;
      const answer = round.question.answer;
      // Simulate players guessing with some spread
      setTimeout(() => {
        game.submitGuess("tw:alice", Math.round(answer * 0.8));
        game.submitGuess("tw:bob", Math.round(answer * 1.2));
        game.submitGuess("yt:carol", Math.round(answer * 0.95));
        game.submitGuess("tw:dave", Math.round(answer * 1.05));
      }, 1500);
    }

    if (phase === "betting") {
      const round = game.getRound();
      if (!round || round.buckets.length === 0) return;
      // Simulate players betting on random buckets
      setTimeout(() => {
        const buckets = round.buckets;
        const mid = Math.floor(buckets.length / 2);
        game.submitBets("tw:alice", [{ bucket: buckets[mid].bucketId, chips: 2 }]);
        game.submitBets("tw:bob", [{ bucket: buckets[0].bucketId, chips: 1 }, { bucket: buckets[buckets.length - 1].bucketId, chips: 1 }]);
        game.submitBets("yt:carol", [{ bucket: buckets[mid].bucketId, chips: 3 }]);
        game.submitBets("tw:dave", [{ bucket: buckets[buckets.length - 1].bucketId, chips: 2 }]);
      }, 1000);
    }
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
