import { useMultiplayerState, usePlayerState, myPlayer, usePlayersState } from "playroomkit";
import { globalStateNames, PlayerState, playerStateNames } from "../Engine";
import React from "react";
import Logo from "../assets/logo.png";

interface QuestionProps {
    isHost: boolean;
    playerState: PlayerState;
}

const Question: React.FC<QuestionProps> = ({ isHost, playerState }) => {
    const self = myPlayer();
    const [answer, setAnswer] = usePlayerState(self, ...playerStateNames.answer);
    const [localAnswer, setLocalAnswer] = React.useState<number|null>(answer);
    const answerCount = playerState.answerCount;
    const nonBigScreenPlayerIds = playerState.playerIds;
    
    if (isHost) {
        if (answerCount === nonBigScreenPlayerIds.length) {
            console.log("Everyone has answered");
            playerState.host?.setGameState("betting");
        } else {
            console.log("Not everyone has answered", answerCount, nonBigScreenPlayerIds.length);
        }

       
    }
    console.log(playerState);

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
        <div className="container min-vh-100 d-flex flex-column justify-content-center">
            <div className="row flex-grow-1 align-items-center text-white">
                <div className="col-12 text-center">
                    <img src={Logo} style={{height:"4rem", width:"4rem"}} alt="Logo" />
                    <h1 className="fw-bold">{playerState.currentQuestion}</h1>
                </div>
            </div>
            <div className="row flex-grow-1 align-items-center">
                <div className="col-12 text-center">
                    <div className="form-floating">
                        <input 
                            type={(answer != null) ? "text" : "number" }
                            id="floatingInput"
                            className={"form-control" + (answer != null ? " is-valid" : "")}
                            onChange={handleAnswerChange} 
                            value={(answer != null) ? "Submitted" : (localAnswer || "")}
                            disabled={answer != null} 
                            placeholder="Your answer"
                        />
                        <label htmlFor="floatingInput">Your answer</label>
                    </div>
                    <div className="d-grid gap-2 mt-3">
                        <button className="btn btn-outline-light" type="button"
                        onClick={submitAnswer} 
                        disabled={answer != null || localAnswer == null}>Submit Answer</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default Question;