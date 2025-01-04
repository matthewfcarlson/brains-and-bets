// The main file for the game engine and it's logic
// All functionality flows through here

import { useMultiplayerState, usePlayersState, usePlayerState, useIsHost, myPlayer, usePlayersList } from "playroomkit";
import { useMemo } from "react";
import { createContext } from 'react';
import skmeans from "skmeans";

interface RawAnswerBucket {
    answer: number;
    players: string[];
}
type RawQuestion = [string, number] | [string, number, string];

// Raw state is the raw state tracked by playroomkit
export function useRawState() {
    const globalStateNames = {
        category: ["category", "General"] as [string, string],
        questionCount: ["questionCount", 6] as [string, number],
        questions: ["questions", []] as [string, RawQuestion[]],
        currentQuestionIndex: ["currentQuestionIndex", 0] as [string, number],
        currentState: ["currentState", "setup"] as [string, possibleGameStateNames],
        answerBuckets: ["answerBuckers", []] as [string, RawAnswerBucket[]],
    }

    const playerStateNames = {
        answer: ["answer", null] as [string, number | null],
        isBigScreen: ["isBigScreenPlayer", false] as [string, boolean],
    }
    const isHost = useIsHost();
    const me = myPlayer();
    const profile = me.getProfile();
    const allParticipants = usePlayersList();

    const [questions, setQuestions] = useMultiplayerState(...globalStateNames.questions);
    const [category, setCategory] = useMultiplayerState(...globalStateNames.category);
    const [numQuestions, setNumQuestions] = useMultiplayerState(...globalStateNames.questionCount);
    const [questionIndex, setQuestionsIndex] = useMultiplayerState(...globalStateNames.currentQuestionIndex);
    const [gameState, setGameState] = useMultiplayerState(...globalStateNames.currentState);

    // Per player
    const [playerIsBigScreen, setPlayerIsBigScreen] = usePlayerState(me, ...playerStateNames.isBigScreen);
    
    // These are for every player
    const allAnswers = usePlayersState(playerStateNames.answer[0]).map((x) => { return {player: x.player.id, state: x.state} });
    const allAreBigScreen = usePlayersState(playerStateNames.isBigScreen[0]).map((x) => { return {player: x.player.id, state: x.state} });

    return {
        questions, questionIndex, allAnswers, playerIsBigScreen, gameState, category, numQuestions,
        // All player values
        allAreBigScreen, allParticipants: allParticipants.map((x) => { return {id: x.id, name: x.getProfile().name} }),
        // Player specific values
        playerId: me.id, playerName: profile.name,
        playerAnswer: allAnswers.find((x) => { return x.player === me.id })?.state,
        // every player can set their own- including big screens
        setPlayerIsBigScreen, setPlayerAnswer: (answer: number|null, reliable: boolean) => { console.log("Setting answer", answer); me.setState(playerStateNames.answer[0], answer, reliable) },
        host: (isHost)? { setQuestions, setQuestionsIndex, setGameState, setCategory, setNumQuestions } : null
    };
}
type RawState = ReturnType<typeof useRawState>;

interface SetupGameHost {
    setCategory: (category: string) => void;
    setNumQuestions: (count: number) => void;
    setQuestions: (questions: RawQuestion[]) => void;
    startGame: () => void;
}
interface SetupGameState {
    state: "setup";
    category: string;
    numQuestions: number;
    host: SetupGameHost|null;
}

interface QuestionGameState {
    state: "question";
    questionIndex: number;
    questionText: string;
    answerCount: number;
    host: null;
    setMyAnswer: (answer: number|null) => void;
    myAnswer: number|null;
}
interface BettingGameState {
    state: "betting";
    answerBuckets: number[];
    host: null;
}
interface ScoringGameState {
    state: "scoring";
    answerBuckets: number[];
    host: null;
}
interface EndGameState {
    state: "endGame";
    host: null| {resetGame: () => void};
}
interface CommonGameState {
    playerIds: string[];
    scores: Record<string, number>;
    isBigScreen: boolean;
    playerName: string;
    playerId: string;
    setPlayerIsBigScreen: (isBigScreen: boolean) => void;
}
export type GameState = (SetupGameState | QuestionGameState | BettingGameState | ScoringGameState | EndGameState) & CommonGameState;
export type possibleGameStateNames = Pick<GameState, "state">["state"];

// We only want the host to run this calculation tbh
function computeAnswersForBetting(rawState: RawState) {
    // We look at the answers, we need to sort them into 7 buckets
    // This is non-deterministic as it uses random
    return useMemo(() => {
        const answers = rawState.allAnswers.filter((x) => { return x.state != null }).map((x) => { return Number(x.state) });
        const clusters = skmeans(answers, 7);
        console.log(clusters);
        return clusters.it;
    }, [rawState.allAnswers]);
}

function useInferredState(state: RawState) {
    const answerCount = useMemo(() => {
        return state.allAnswers.filter((x) => { return x.state != null }).length;
    }, [state.allAnswers]);

    const playerIds = useMemo(() => {
        return state.allAreBigScreen.filter((x) => { return x.state === false }).map((x) => { return x.player });
    }, [state.allAreBigScreen]);
    return {
        gameState: state.gameState,
        currentQuestion: String(state.questions[state.questionIndex]?.at(0)) ?? "",
        numQuestions: state.numQuestions,
        questionIndex: state.questionIndex,
        answerCount,
        playerIds
    }
}

const defaultState: GameState = {
    state: "endGame",
    isBigScreen: false,
    host: null,
    playerIds: [],
    scores: {},
    playerName: "",
    playerId: "",
    setPlayerIsBigScreen: (_: boolean) => {},
}
export function useGameState(rawState: RawState): GameState {
    const inferredState = useInferredState(rawState);
    const commonGameState: CommonGameState = {
        isBigScreen: rawState.playerIsBigScreen,
        playerIds: inferredState.playerIds,
        scores: {},
        playerName: rawState.playerName,
        playerId: rawState.playerId,
        setPlayerIsBigScreen: rawState.setPlayerIsBigScreen,
    }
    switch (rawState.gameState) {
        case "setup":
            return {
                state: "setup",
                category: rawState.category,
                numQuestions: rawState.numQuestions,
                host: (rawState.host)? {
                    setCategory: rawState.host!.setCategory,
                    setNumQuestions: rawState.host!.setNumQuestions,
                    setQuestions: rawState.host!.setQuestions,
                    startGame: () => { rawState.host!.setGameState("question") }
                }: null,
                ...commonGameState
            }
        case "question":
            return {
                state: "question",
                answerCount: inferredState.answerCount,
                questionIndex: inferredState.questionIndex,
                questionText: inferredState.currentQuestion,
                myAnswer: rawState.playerAnswer,
                setMyAnswer: (answer:number|null) => {rawState.setPlayerAnswer(answer, true)}, // reliable transmission
                host: null, // TBD
               ...commonGameState

            }
        // case "betting":
        //     return bettingState(rawState, commonState);
        // case "scoring":
        //     return scoringState(rawState, commonState);
        // case "endGame":
        //     return endGameState(rawState, commonState);
    }
    return defaultState;

}

// Context stuff
export const GameStateContext = createContext<GameState>(defaultState);
