import { useMultiplayerState, usePlayerState, myPlayer, usePlayersState } from "playroomkit";
import { globalStateNames, playerStateNames } from "../Engine";
import React from "react";

interface QuestionProps {
    isHost: boolean;
}

const Question: React.FC<QuestionProps> = ({ isHost }) => {
    const self = myPlayer();
    const [questions, ] = useMultiplayerState(...globalStateNames.questions);
    const [questionIndex, ] = useMultiplayerState(...globalStateNames.currentQuestionIndex);
    const [answer, setAnswer] = usePlayerState(self, ...playerStateNames.answer);
    const [localAnswer, setLocalAnswer] = React.useState<number|null>(answer || null);
    const answers = usePlayersState(playerStateNames.answer[0]).filter((x)=>{return x.state != null});
    const nonBigScreenPlayerIds = usePlayersState(playerStateNames.isBigScreen[0]).filter((x)=>{return x.state === false}).map((x)=>{return x.player.id});
    const [, setGameState] = useMultiplayerState(...globalStateNames.currentState);

    if (isHost) {
        if (answers.length === nonBigScreenPlayerIds.length) {
            console.log("Everyone has answered");
            setGameState("betting");
        } else {
            console.log("Not everyone has answered", answers.length, nonBigScreenPlayerIds.length);
        }
    }

    const handleAnswerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (answer != null) {
            setLocalAnswer(answer);
            return;
        }
        if (value === "") {
            setLocalAnswer(null);
            return;
        }
        if (isNaN(Number(value))) {
            setLocalAnswer(null);
            return;
        }
        setLocalAnswer(Number(value));
    };
    const submitAnswer = () => {
        console.log("Submitting answer", localAnswer);
        setAnswer(localAnswer);
    };

    return (
        <>
            <h1>{questions[questionIndex]} </h1>
            <input type="number" onChange={handleAnswerChange} value={localAnswer || 0} disabled={answer != null}/>
            <button onClick={submitAnswer} disabled={answer != null }>Submit Answer</button>
        </>
    )
}
export default Question;