// The main file for the game engine and it's logic
// All functionality flows through here

import { useMultiplayerState, usePlayersState, usePlayerState, useIsHost, myPlayer } from "playroomkit";
import { useMemo } from "react";
import skmeans from "skmeans";

export const gameStateNames = {
    setup: "setup",
    question: "question",
    betting: "betting",
    scoring: "scoring",
    endGame: "endGame"
}

export const globalStateNames = {
    category:["category", "General"] as [string, string],
    questionCount: ["questionCount", 6] as [string, number],
    questions:["questions", []] as [string, Question[]],
    currentQuestionIndex: ["currentQuestionIndex", 0] as [string, number],
    currentState: ["currentState", gameStateNames.setup] as [string, string]
}

export const playerStateNames = {
    answer:["answer", null] as [string, number|null],
    isBigScreen:["isBigScreenPlayer", false] as [string, boolean],
}

type PlayerStatesWithValue = ReturnType<typeof usePlayersState>;

export interface RawState {
    questions: Question[];
    questionIndex: number;
    answers: PlayerStatesWithValue;
    isBigScreen: PlayerStatesWithValue;
    gameState: string;
}
export interface RawHostState extends RawState {
    setQuestions: (questions: Question[]) => void;
    setNumQuestions: (count: number) => void;
    setQuestionsIndex: (index: number) => void;
    setGameState: (state: string) => void;
    setCategory: (category: string) => void;
}
function isRawHostState(state: RawState | RawHostState): state is RawHostState {
    return (state as RawHostState).setQuestions !== undefined;
}

export function getRawState(): RawState | RawHostState {
    const isHost = useIsHost();
    const [questions, setQuestions] = useMultiplayerState(...globalStateNames.questions);
    const [category, setCategory] = useMultiplayerState(...globalStateNames.category);
    const [numQuestions, setNumQuestions] = useMultiplayerState(...globalStateNames.questionCount);
    const [questionIndex, setQuestionsIndex] = useMultiplayerState(...globalStateNames.currentQuestionIndex);
    const [gameState, setGameState] = useMultiplayerState(...globalStateNames.currentState);

    // These are per player
    const answers = usePlayersState(playerStateNames.answer[0]);
    const isBigScreen = usePlayersState(playerStateNames.isBigScreen[0]);

    const basicState = {
        questions, questionIndex, answers, isBigScreen, gameState, category, numQuestions
    }
    if (isHost){
        return {
            setQuestions,
            setQuestionsIndex,
            setGameState,
            setCategory,
            setNumQuestions,
            ...basicState
        }
    }
    // We cannot change global state if we aren't the host
    return basicState;
}


type Question = [string, number] | [string, number, string];

// We only want the host to run this calculation tbh
function computeAnswersForBetting(rawState: RawHostState) {
    // We look at the answers, we need to sort them into 7 buckets
    return useMemo(() => {
        const answers = rawState.answers.filter((x)=>{return x.state != null}).map((x)=>{return Number(x.state)});
        const clusters = skmeans(answers, 7);
        console.log(clusters);
        return clusters.it;
    }, [rawState.answers]);
}

function getCommonState(state: RawState) {
    const answerCount = useMemo(() => {
        console.log("Calculating answer count 2");
        return state.answers.filter((x)=>{return x.state != null}).length;
    }, [state.answers]);

    const playerIds = useMemo(() => {
        return state.isBigScreen.filter((x)=>{return x.state === false}).map((x)=>{return x.player.id});
    }, [state.isBigScreen]);
    return {
        gameState: state.gameState,
        currentQuestion: state.questions[state.questionIndex]?.at(0) ?? "",
        numQuestions: state.numQuestions,
        questionIndex: state.questionIndex,
        answerCount,
        playerIds
    }
}

export function getStreamState(state: RawState) {
   // This is special state that's tailored for what the stream screen needs
   
   return {
        ...getCommonState(state)
   }
}

export function getPlayerState(state:RawState|RawHostState) {
    const player = myPlayer();
    console.log(state);

    var playerState = {
        ...getCommonState(state)
    }

    return {
        ...playerState,
        host: isRawHostState(state) ? {
            setGameState: state.setGameState,
            setQuestionIndex:  state.setQuestionsIndex,
            setQuestions:  state.setQuestions,
            setNumQuestions:  state.setNumQuestions,
            setCategory:  state.setCategory,
        } : null
    }
    
}
export type PlayerState = ReturnType<typeof getPlayerState>;
