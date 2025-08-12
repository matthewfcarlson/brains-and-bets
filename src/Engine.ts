// The main file for the game engine and it's logic
// All functionality flows through here

import { useMultiplayerState, usePlayersState, usePlayerState, useIsHost, myPlayer, usePlayersList } from "playroomkit";
import { useMemo } from "react";
import { createContext } from 'react';
import skmeans from "skmeans";

type AnswerBucketsId = 1|2|3|4|5|6|7;
type SmallestBucketId = 0;
type AllBetBuckets = AnswerBucketsId | SmallestBucketId;

export interface RawAnswerBucket {
    bucketIndex: AnswerBucketsId; // 0 is lower than all
    answer: number;
    players: string[];
}
type RawQuestion = [string, number] | [string, number, string];
export type RawBet = {bucket: AllBetBuckets, additionalChips: number};
export type RawBetPairStates = [RawBet, null]|[RawBet, RawBet]|null;
export type PlayerBet = {playerID:string, bet: RawBet};

// Raw state is the raw state tracked by playroomkit
const globalStateNames = {
    category: ["category", "General"] as [string, string],
    questionCount: ["questionCount", 6] as [string, number],
    questions: ["questions", []] as [string, RawQuestion[]],
    currentQuestionIndex: ["currentQuestionIndex", 0] as [string, number],
    currentState: ["currentState", "setup"] as [string, possibleGameStateNames],
    answerBuckets: ["answerBuckers", []] as [string, RawAnswerBucket[]],
}

type AllPlayerState<T> = {playerId: string, state: T};

const playerStateNames = {
    answer: ["answer", null] as [string, number | null],
    bet: ["bet", null] as [string, RawBetPairStates],
    ready: ["ready", false] as [string, boolean],
    score: ["score", 0] as [string, number],
    isBigScreen: ["isBigScreenPlayer", false] as [string, boolean],
}
export function useRawState() {

    const isHost = useIsHost();
    const me = myPlayer();
    const profile = me.getProfile();
    const allPlayers = usePlayersList();

    const [questions, setQuestions] = useMultiplayerState(...globalStateNames.questions);
    const [category, setCategory] = useMultiplayerState(...globalStateNames.category);
    const [numQuestions, setNumQuestions] = useMultiplayerState(...globalStateNames.questionCount);
    const [questionIndex, setQuestionsIndex] = useMultiplayerState(...globalStateNames.currentQuestionIndex);
    const [gameState, setGameState] = useMultiplayerState(...globalStateNames.currentState);
    const [answerBuckets, setAnswerBuckets] = useMultiplayerState(...globalStateNames.answerBuckets);

    // These are for every player
    const allAnswers:AllPlayerState<typeof playerStateNames.answer[1]>[] = usePlayersState(playerStateNames.answer[0]).map((x) => { return {playerId: x.player.id, state: x.state} });
    const allScores:AllPlayerState<typeof playerStateNames.score[1]>[] = usePlayersState(playerStateNames.score[0]).map((x) => { return {playerId: x.player.id, state: x.state} });
    const allBets:AllPlayerState<typeof playerStateNames.bet[1]>[] = usePlayersState(playerStateNames.bet[0]).map((x) => { return {playerId: x.player.id, state: x.state as typeof playerStateNames.bet[1]} });
    const allReady:AllPlayerState<typeof playerStateNames.ready[1]>[] = usePlayersState(playerStateNames.ready[0]).map((x) => { return {playerId: x.player.id, state: x.state as typeof playerStateNames.doneBetting[1]} });
    const allAreBigScreen:AllPlayerState<typeof playerStateNames.isBigScreen[1]>[] = usePlayersState(playerStateNames.isBigScreen[0]).map((x) => { return {playerId: x.player.id, state: x.state as typeof playerStateNames.isBigScreen[1]} });

    // Per player
    const [playerIsBigScreen, setPlayerIsBigScreen] = usePlayerState(me, ...playerStateNames.isBigScreen);
    const playerBet = allBets.find((x) => { return x.playerId === me.id })?.state || playerStateNames.bet[1];
    const playerAnswer = allAnswers.find((x) => { return x.playerId === me.id })?.state || playerStateNames.answer[1];
    const playerScore = allScores.find((x) => { return x.playerId === me.id })?.state || playerStateNames.score[1];
    const playerReady = allReady.find((x) => { return x.playerId === me.id })?.state || playerStateNames.ready[1];

    return {
        questions, questionIndex, allAnswers, playerIsBigScreen, gameState, category, numQuestions, answerBuckets,
        // All player values
        allPlayers, allAreBigScreen, allParticipants: allPlayers.map((x) => { return {id: x.id, name: x.getProfile().name} }), allBets, allReady,
        // Player specific values
        playerId: me.id, playerName: profile.name,
        playerBet, playerAnswer, playerScore, playerReady,
        // every player can set their own- including big screens
        setPlayerIsBigScreen,
        setPlayerAnswer: (answer: number|null) => { me.setState(playerStateNames.answer[0], answer, true) },
        setPlayerBet: (bet: RawBetPairStates) => {
            if (bet != null) {
                const [bet1, bet2] = bet;
                if (bet1.additionalChips < 0 || (bet2?.additionalChips || 0) < 0) {
                    console.error("Bets must be positive");
                    return false;
                }
                if (bet1.bucket === bet2?.bucket) {
                    console.error("Bets must be on different buckets");
                    return false;
                }
                const totalBet = bet1.additionalChips + (bet2?.additionalChips || 0);
                if (totalBet > playerScore) {
                    console.error("You can't bet more than you have");
                    return false;
                }
            }
            me.setState(playerStateNames.bet[0], bet, true)
            return true;
        },
        setPlayerReady: () => {
            me.setState(playerStateNames.ready[0], true, true);
        },
        host: (isHost)? { setQuestions, setQuestionsIndex, setCategory, setNumQuestions, setAnswerBuckets, setGameState } : null
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

interface QuestionGameHost {
    allAnswers: AllPlayerState<number|null>[];
    setAnswerBuckets: (buckets: RawAnswerBucket[]) => void;
    advanceToBetting: () => void;
}

interface QuestionGameState {
    state: "question";
    questionIndex: number;
    questionText: string;
    numQuestions: number;
    answerCount: number;
    host: QuestionGameHost | null;
    setMyAnswer: (answer: number|null) => void;
    myAnswer: number|null;
}

interface BettingGameHost {
    advanceToScoring: () => void;
}
interface BettingGameState {
    state: "betting";
    answerBuckets: RawAnswerBucket[];
    questionText: string;
    myScore: number;
    host: BettingGameHost | null;
    myBet: RawBetPairStates;
    setMyBet: (bet: RawBetPairStates) => boolean;
    allBets: PlayerBet[];
    readyCount: number;
    setReady: () => void;
    myReady: boolean;
}

interface ScoringGameHost {
    advanceToNextQuestionOrEndGame: () => void;
    endGame: () => void;
}
interface ScoringGameState {
    state: "scoring";
    questionText: string;
    questionAnswerText: string;
    answerBuckets: RawAnswerBucket[];
    moreQuestionsLeft: boolean;
    myScore: number;
    readyCount: number;
    setReady: () => void;
    myReady: boolean;
    host: ScoringGameHost | null;
}
interface EndGameState {
    state: "endGame";
    myScore: number;
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
function computeAnswersForBetting(rawState: QuestionGameHost): RawAnswerBucket[] {
    console.log("Computing answers for betting", rawState.allAnswers);
    // We look at the answers, we need to sort them into up to 7 buckets
    // This is non-deterministic as it uses random
    const answers = rawState.allAnswers.filter((x) => { return x.state != null }).map((x) => { return {answer:Number(x.state), playerId: x.playerId };});
    // First we need to condense the answers for similar answers
    let condensedAnswers: RawAnswerBucket[] = [];
    for (let answer of answers) {
        // Check if the answer is in the condensed answers
        for (let condensedAnswer of condensedAnswers) {
            if (condensedAnswer.answer === answer.answer) {
                condensedAnswer.players.push(answer.playerId);
                break;
            }
        }
        // Otherwise create a new bucket
        condensedAnswers.push({bucketIndex: 1, answer: answer.answer, players: [answer.playerId]});
    }
    // Now sort the condensed answers
    condensedAnswers = condensedAnswers.sort((a, b) => { return a.answer - b.answer });

    // Now we assign the bucket index based on the number of buckets, the offset is (7 - number of buckets)/2
    // We want to try to keep the buckets centered
    const bucketOffset = Math.floor((7 - condensedAnswers.length) / 2) + 1;
    for (let i = 0; i < condensedAnswers.length; i++) {
        const bucketIndex = i + bucketOffset;
        if (bucketIndex < 1 || bucketIndex > 7) {
            console.error("Bucket index out of range", bucketIndex);
            continue;
        }
        condensedAnswers[i].bucketIndex = bucketIndex as AnswerBucketsId;
    }

    if (condensedAnswers.length <= 7) {
        // We don't need to cluster, return what we already have
        console.log("Condensed answers", condensedAnswers);
        return condensedAnswers;
    }
    // We need to cluster the answers as there are more than 7
    const clusters = skmeans(condensedAnswers.map(x=>x.answer), 7, null, 50);
    console.log(clusters);
    // Now sort the clusters in order 1-7
    // TBD
    return [];
}

function useInferredState(state: RawState) {
    return {
        gameState: state.gameState,
        currentQuestion: String(state.questions[state.questionIndex]?.at(0)) ?? "",
        currentQuestionAnswer: String(state.questions[state.questionIndex]?.at(2) ?? state.questions[state.questionIndex]?.at(1) ?? ""),
        numQuestions: state.numQuestions,
        questionIndex: state.questionIndex,
        answerCount: state.allAnswers.filter((x) => { return x.state != null }).length,
        doneAnsweringCount: state.allReady.filter((x) => { return x.state === true }).length,
        playerIds: state.allAreBigScreen.filter((x) => { return x.state === false }).map((x) => { return x.playerId }),
        moreQuestionsLeft: state.questionIndex < state.numQuestions
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
    myScore: 0,
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
                    startGame: () => {
                        // Clear all answers
                        rawState.allPlayers.forEach((player) => {
                            player.setState(playerStateNames.answer[0], null);
                        });
                        rawState.host!.setGameState("question")
                    }
                }: null,
                ...commonGameState
            }
        case "question":
            return {
                state: "question",
                answerCount: inferredState.answerCount,
                questionIndex: inferredState.questionIndex,
                numQuestions: inferredState.numQuestions,
                questionText: inferredState.currentQuestion,
                myAnswer: rawState.playerAnswer,
                setMyAnswer: rawState.setPlayerAnswer,
                host:  (rawState.host)? {
                    allAnswers: rawState.allAnswers,
                    setAnswerBuckets: rawState.host.setAnswerBuckets,
                    advanceToBetting: () => {
                        // Clear ready status
                        rawState.allPlayers.forEach((player) => {
                            // TODO: it would be nice to have typing information on these sorts of access as well
                            player.setState(playerStateNames.ready[0], playerStateNames.ready[1]);
                        });
                        // Clear bets
                        rawState.allPlayers.forEach((player) => {
                            // TODO: it would be nice to have typing information on these sorts of access as well
                            player.setState(playerStateNames.bet[0], playerStateNames.bet[1]);
                        });
                        rawState.host?.setGameState("betting");
                    }
                }: null,
                ...commonGameState

            }
        case "betting":
            let allBets: PlayerBet[] = []
            for (let bet of rawState.allBets) {
                if (bet.state == null) continue;
                allBets.push({playerID: bet.playerId, bet: bet.state[0]});
                if (bet.state[1] != null) {
                    allBets.push({playerID: bet.playerId, bet: bet.state[1]});
                }
            }
            return {
                state: "betting",
                answerBuckets: rawState.answerBuckets,
                myBet: rawState.playerBet,
                questionText: inferredState.currentQuestion,
                setMyBet: rawState.setPlayerBet,
                allBets,
                readyCount: inferredState.doneAnsweringCount,
                setReady: rawState.setPlayerReady,
                myReady: rawState.playerReady,
                myScore: 0,
                host:  (rawState.host)? {
                    advanceToScoring() {
                        // Clear ready status
                        rawState.allPlayers.forEach((player) => {
                            // TODO: it would be nice to have typing information on these sorts of access as well
                            player.setState(playerStateNames.ready[0], playerStateNames.ready[1]);
                        });
                        // TODO: calculate scores and update each players scores
                        rawState.host?.setGameState("scoring");
                    },
                }: null,
                ...commonGameState
            }
        case "scoring":
            return {
                state: "scoring",
                questionText: inferredState.currentQuestion,
                questionAnswerText: inferredState.currentQuestionAnswer,
                answerBuckets: rawState.answerBuckets,
                myScore: rawState.playerScore,
                readyCount: inferredState.doneAnsweringCount,
                moreQuestionsLeft: inferredState.questionIndex < (inferredState.numQuestions-1),
                setReady: rawState.setPlayerReady,
                myReady: rawState.playerReady,
                host: (rawState.host)? {
                    advanceToNextQuestionOrEndGame() {
                        // TODO: add to scores permentantly?
                        if (inferredState.moreQuestionsLeft) {
                            // Clear all answers
                            rawState.allPlayers.forEach((player) => {
                                player.setState(playerStateNames.answer[0], null);
                            });
                            // Clear bets
                            rawState.allPlayers.forEach((player) => {
                                // TODO: it would be nice to have typing information on these sorts of access as well
                                player.setState(playerStateNames.bet[0], playerStateNames.bet[1]);
                            });
                            // Add to the question index
                            rawState.host?.setQuestionsIndex(rawState.questionIndex + 1);
                            rawState.host?.setGameState("question");
                        }
                        else {
                            rawState.host?.setGameState("endGame");
                        }
                    },
                    endGame() {
                        rawState.host?.setGameState("endGame");
                    }
                }: null,
                ...commonGameState
            }
        case "endGame":
            return {
                state: "endGame",
                myScore: rawState.playerScore,
                host: null,
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

export function tickGameStateHost(gameState: GameState) {
    // This is the host, we need to tick the game state
    console.log("Ticking game state", gameState.state);
    if (gameState.state === "question") {
        // We need to check if everyone has answered
        if (gameState.playerIds.length <= gameState.answerCount && gameState.answerCount > 0) {
            // We can advance to the next state
            console.log("Advancing to betting", gameState.answerCount, gameState.playerIds.length);
            // Set the answer buckets
            const answerBuckets = computeAnswersForBetting(gameState.host!);
            gameState.host?.setAnswerBuckets(answerBuckets);
            gameState.host?.advanceToBetting();
        }
        // TODO: Check if the timestamp has expired

        return;
    }
    if (gameState.state == "betting") {
        // Check if everyone is finished betting
        if (gameState.playerIds.length <= gameState.readyCount && gameState.readyCount > 0) {
            // We can advance to the next state
            console.log("Advancing to scoring", gameState.readyCount, gameState.playerIds.length);
            gameState.host?.advanceToScoring();
        }
        // TODO: check if timer is expired
        return;
    }
    if (gameState.state == "scoring") {
        // Check if everyone is finished betting
        if (gameState.playerIds.length <= gameState.readyCount && gameState.readyCount > 0) {
            // We can advance to the next state
            if (gameState.moreQuestionsLeft){
                console.log("Advancing to next question");
                gameState.host?.advanceToNextQuestionOrEndGame();
            } else {
                console.log("Game over");
                gameState.host?.endGame();
            }
        }
        // TODO: check if timer is expired
        return;
    }

}

// Context stuff
export const GameStateContext = createContext<GameState>(defaultState);
