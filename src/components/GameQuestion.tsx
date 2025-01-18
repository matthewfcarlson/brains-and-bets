import React, { useState } from 'react';
import { useContext, Fragment } from 'react';
import { GameStateContext } from "../Engine";
import Logo from "../assets/logo.png";


export const QuestionPlayer: React.FC = () => {
    const gameState = useContext(GameStateContext);
    let defaultValue = (gameState.state == "question") ? gameState.myAnswer : null;
    const [localAnswer,setLocalAnswer] = useState<number|null>(defaultValue);
    if (gameState.state !== "question") {
        return null;
    }

    const handleAnswerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        if (gameState.myAnswer != null) {
            setLocalAnswer(gameState.myAnswer);
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
        gameState.setMyAnswer(localAnswer);
    };

    return (
        <div className="container min-vh-100 d-flex flex-column justify-content-center">
            <div className="row flex-grow-1 align-items-center text-white">
                <div className="col-12 text-center">
                    <img src={Logo} style={{height:"4rem", width:"4rem"}} alt="Logo" />
                    <h1 className="fw-bold">{gameState.questionText}</h1>
                </div>
            </div>
            <div className="row flex-grow-1 align-items-center">
                <div className="col-12 text-center">
                    <div className="form-floating">
                        <input 
                            type={(gameState.myAnswer != null) ? "text" : "number" }
                            id="floatingInput"
                            className={"form-control" + (gameState.myAnswer != null ? " is-valid" : "")}
                            onChange={handleAnswerChange} 
                            value={(gameState.myAnswer != null) ? "Submitted" : (localAnswer || "")}
                            disabled={gameState.myAnswer != null} 
                            placeholder="Your answer"
                        />
                        <label htmlFor="floatingInput">Your answer</label>
                    </div>
                    <div className="d-grid gap-2 mt-3">
                        <button className="btn btn-outline-light" type="button"
                        onClick={submitAnswer} 
                        disabled={gameState.myAnswer != null || localAnswer == null}>Submit Answer</button>
                    </div>
                </div>
            </div>
        </div>
    )
};
export const QuestionBigScreen: React.FC = () => {
    const gameState = useContext(GameStateContext);
    if (gameState.state !== "question") {
        return null;
    }
    return (
        <Fragment>
            <h1>Question Bigscreen </h1>
        </Fragment>
    )
}