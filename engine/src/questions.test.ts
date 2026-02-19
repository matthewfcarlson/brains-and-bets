import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadQuestions, getCategories, pickQuestions } from "./questions.js";
import { readFile, readdir } from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);

const sampleQuestions = [
  ["What year was JavaScript created?", 1995, "Brendan Eich created it in 1995"],
  ["How many planets are in our solar system?", 8],
];

describe("loadQuestions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads question files from a directory", async () => {
    mockReaddir.mockResolvedValue(["science.json", "history.json"] as any);
    mockReadFile.mockResolvedValue(JSON.stringify(sampleQuestions));

    await loadQuestions("/fake/dir");

    expect(mockReaddir).toHaveBeenCalledWith("/fake/dir");
    expect(mockReadFile).toHaveBeenCalledTimes(2);

    const categories = getCategories();
    expect(categories).toContain("Science");
    expect(categories).toContain("History");
  });

  it("skips non-JSON files", async () => {
    mockReaddir.mockResolvedValue(["questions.json", "readme.txt"] as any);
    mockReadFile.mockResolvedValue(JSON.stringify(sampleQuestions));

    await loadQuestions("/fake/dir");
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it("skips empty arrays", async () => {
    mockReaddir.mockResolvedValue(["empty.json"] as any);
    mockReadFile.mockResolvedValue(JSON.stringify([]));

    const categoriesBefore = getCategories().length;
    await loadQuestions("/fake/dir");
    // Empty category should not be added
    expect(getCategories()).not.toContain("Empty");
  });
});

describe("pickQuestions", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    mockReaddir.mockResolvedValue(["trivia.json"] as any);
    mockReadFile.mockResolvedValue(
      JSON.stringify([
        ["Q1", 1],
        ["Q2", 2],
        ["Q3", 3],
        ["Q4", 4],
        ["Q5", 5],
      ])
    );
    await loadQuestions("/fake/dir");
  });

  it("returns the requested number of questions", () => {
    const questions = pickQuestions("Trivia", 3);
    expect(questions).toHaveLength(3);
  });

  it("returns all questions when count exceeds pool size", () => {
    const questions = pickQuestions("Trivia", 100);
    expect(questions).toHaveLength(5);
  });

  it("returns questions with correct structure", () => {
    const questions = pickQuestions("Trivia", 1);
    expect(questions[0]).toHaveProperty("text");
    expect(questions[0]).toHaveProperty("answer");
    expect(typeof questions[0].text).toBe("string");
    expect(typeof questions[0].answer).toBe("number");
  });

  it("throws for unknown category", () => {
    expect(() => pickQuestions("Nonexistent", 1)).toThrow(
      'No questions found for category "Nonexistent"'
    );
  });

  it("shuffles questions (not always same order)", () => {
    // Run multiple times and check that at least one ordering differs
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const questions = pickQuestions("Trivia", 5);
      results.add(questions.map((q) => q.answer).join(","));
    }
    // With 5! = 120 permutations, 20 draws should almost certainly produce >1 ordering
    expect(results.size).toBeGreaterThan(1);
  });
});
