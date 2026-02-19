import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Question, RawQuestion } from "./types.js";

/** Loaded question bank, keyed by category name */
const questionBank = new Map<string, Question[]>();

function parseRawQuestion(raw: RawQuestion): Question {
  const [text, answer, explanation] = raw;
  return { text, answer, explanation };
}

/** Load all question JSON files from a directory into the bank. */
export async function loadQuestions(questionsDir: string): Promise<void> {
  const files = await readdir(questionsDir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const category = file.replace(".json", "");
    const raw = JSON.parse(
      await readFile(join(questionsDir, file), "utf-8")
    ) as RawQuestion[];
    if (!Array.isArray(raw) || raw.length === 0) continue;
    questionBank.set(
      category.charAt(0).toUpperCase() + category.slice(1),
      raw.map(parseRawQuestion)
    );
  }
}

/** Get all loaded category names. */
export function getCategories(): string[] {
  return [...questionBank.keys()];
}

/** Pick `count` random questions from a category (without replacement). */
export function pickQuestions(category: string, count: number): Question[] {
  const pool = questionBank.get(category);
  if (!pool || pool.length === 0) {
    throw new Error(`No questions found for category "${category}"`);
  }
  // Fisher-Yates shuffle on a copy, then take the first `count`
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
