import React, { useState } from 'react';
import { useContext, Fragment } from 'react';
import { GameStateContext } from "../Engine";

export const ScoringPlayer: React.FC = () => {
    const gameState = useContext(GameStateContext);
    if (gameState.state !== "scoring") {
        return null;
    }

    const finishBetting = () => {
        gameState.setReady();
    };
    const finishBettingButton = (gameState.myReady == false)? (
        <div>
            <button className="btn btn-outline-light btn-lg" onClick={finishBetting}>Next Question</button>
        </div>
    ) : null;


    return (
        <div className="container vh-100 d-flex flex-column justify-content-center">
            <div className="row align-items-center text-white text-center" key="question">
                <h3>Q: { gameState.questionText}</h3>
                <h2>A: {gameState.questionAnswerText}</h2>
            </div>
            {finishBettingButton}
        </div>
    )
};
export const ScoringBigScreen: React.FC = () => {
    const gameState = useContext(GameStateContext);
    if (gameState.state !== "scoring") {
        return null;
    }
    return (
        <div className="container vh-100 d-flex flex-column justify-content-center">
            <div className="row align-items-center text-white text-center" key="question">
                <h3>Q: { gameState.questionText}</h3>
                <h2>A: {gameState.questionAnswerText}</h2>
            </div>
    </div>
     )
}