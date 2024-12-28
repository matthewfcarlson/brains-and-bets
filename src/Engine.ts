// The main file for the game engine and it's logic
// All functionality flows through here

export const gameStateNames = {
    setup: "setup",
    question: "question",
    betting: "betting",
    scoring: "scoring",
    endGame: "endGame"
}

export const globalStateNames = {
    category:["category", "general"] as [string, string],
    questionCount: ["questionCount", 6] as [string, number],
    questions:["questions", []] as [string, string[]],
    currentQuestionIndex: ["currentQuestionIndex", 0] as [string, number],
    currentState: ["currentState", gameStateNames.setup] as [string, string]
}

export const playerStateNames = {
    answer:["answer", null] as [string, number|null],
    isBigScreen:["isBigScreenPlayer", false] as [string, boolean],
}