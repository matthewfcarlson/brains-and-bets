import React, { useState } from 'react';
import { useContext, Fragment } from 'react';
import { GameStateContext } from "../Engine";
import questionsDB from '../assets/questions';

const SetupHostControls: React.FC = () => {
    const gameState = useContext(GameStateContext);
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const categories = Object.keys(questionsDB);

    if (gameState.state !== "setup") return null;
    if (gameState.host == null) {
        return null;
    }

    const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        gameState.host?.setCategory(event.target.value);
    };

    const handleIncrement = () => {
        if (gameState.numQuestions < 12) {
            gameState.host?.setNumQuestions(gameState.numQuestions + 1);
        }
    };

    const startGame = () => {
        if (gameStarted) {
            console.log("Game already started");
            return;
        }
        setGameStarted(true);
        let categoryQuestions = Object(questionsDB)[gameState.category] || questionsDB.General;
        let questionArray = [];
        for (let i = 0; i < gameState.numQuestions; i++) {
            let randomIndex = Math.floor(Math.random() * categoryQuestions.length);
            questionArray.push(categoryQuestions[randomIndex]);
        }

        gameState.host?.setQuestions(questionArray);
        gameState.host?.startGame();
    };

    const handleDecrement = () => {
        if (gameState.numQuestions > 3) {
            gameState.host?.setNumQuestions(gameState.numQuestions - 1);
        }
    };

    return (
        <div className="container">
            <div className="form-group">
                <label htmlFor="category">Category:</label>
                <select id="category" className="form-control" value={gameState.category} onChange={handleCategoryChange}>
                    {categories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="questionCount">Question Count:</label>
                <div className="input-group">
                    <div className="input-group-prepend">
                        <button className="btn btn-outline-secondary" onClick={handleDecrement}>-</button>
                    </div>
                    <input type="text" className="form-control text-center" value={gameState.numQuestions} readOnly />
                    <div className="input-group-append">
                        <button className="btn btn-outline-secondary" onClick={handleIncrement}>+</button>
                    </div>
                </div>
            </div>
            <br />
            <button className="btn btn-outline-light btn-lg" onClick={startGame} disabled={gameStarted}>Start Game</button>
        </div>
    );
};

const SetupPlayerControls: React.FC = () => {
    const gameState = useContext(GameStateContext);
    if (gameState.state !== "setup") {
        return null;
    }
    if (gameState.host != null) {
        return null;
    }

    return (
        <div className="container min-vh-100 text-white text-center d-flex flex-column justify-content-center">
            <div className="row flex-grow-1 align-items-center">
                <div className="col-12 text-center">
                    <h2 className="text-muted">Category:</h2>
                    <h1>{gameState.category}</h1>
                    <h2 className="text-muted">Question Count:</h2>
                    <h1>{gameState.numQuestions}</h1>
                </div></div>
        </div>
    );
};

export const SetupPlayer: React.FC = () => {
    return (
        <Fragment>
            <SetupHostControls />
            <SetupPlayerControls />
        </Fragment>
    )
};
export const SetupBigScreen: React.FC = () => {
    return (
        <Fragment>
            <SetupPlayerControls />
        </Fragment>
    )
}