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
    const [localAnswer, setLocalAnswer] = React.useState<number|null>(answer);
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
        if (value == "") {
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
        <div className="container h-100 d-flex flex-column justify-content-center">
            <div className="row flex-grow-1 align-items-center">
                <div className="col-12 text-center">
                    <h1 className="my-4">{questions[questionIndex][0]}</h1>
                </div>
            </div>
            <div className="row flex-grow-1 align-items-center">
                <div className="col-12 text-center">
                    <div className="form-group">
                        <input 
                            type="number" 
                            className="form-control" 
                            onChange={handleAnswerChange} 
                            value={localAnswer || ""} 
                            disabled={answer != null} 
                        />
                    </div>
                </div>
            </div>
            <div className="row flex-grow-1 align-items-center">
                <div className="col-12 text-center">
                    <button 
                        className="btn btn-primary mt-2" 
                        onClick={submitAnswer} 
                        disabled={answer != null || localAnswer == null}
                    >
                        Submit Answer
                    </button>
                </div>
            </div>
        </div>
    )
}
export default Question;