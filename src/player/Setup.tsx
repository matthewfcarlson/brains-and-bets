import React, { useState } from 'react';

import { useMultiplayerState } from "playroomkit";
import { globalStateNames } from "../Engine";

interface SetupProps {
    isHost: boolean;
}


const SetupHostControls: React.FC = () => {
    const [category, setCategory] = useMultiplayerState(...globalStateNames.category);
    const [numQuestions, setNumQuestions] = useMultiplayerState(...globalStateNames.questionCount);
    const [, setQuestions] = useMultiplayerState(...globalStateNames.questions);
    const [, setGameState] = useMultiplayerState(...globalStateNames.currentState);
    const [gameStarted, setGameStarted] = useState<boolean>(false);

    const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setCategory(event.target.value);
    };

    const handleIncrement = () => {
        if (numQuestions < 12) {
            setNumQuestions(numQuestions + 1);
        }
    };

    const startGame = async () => {
        // First we need to disable the start game button
        if (gameStarted) {
            return;
        }
        // Next we need to select the questions we are going to use based on the category
        // For now, just randomly select it
        setGameStarted(true);
        setQuestions(["What is the capital of France?", "What is the capital of Germany?", "What is the capital of Italy?", "What is the capital of Spain?", "What is the capital of Portugal?", "What is the capital of the United Kingdom?"]);
        // Then advance the game state
        setGameState("question");
    };

    const handleDecrement = () => {
        if (numQuestions > 3) {
            setNumQuestions(numQuestions - 1);
        }
    };
    return (
        <div>
            <label htmlFor="category">Category:</label>
            <select id="category" value={category} onChange={handleCategoryChange}>
                <option value="general">General</option>
                <option value="science">Science</option>
                <option value="history">History</option>
                <option value="sports">Sports</option>
            </select>
            <div>
                <label htmlFor="questionCount">Question Count:</label>
                <button onClick={handleDecrement}>-</button>
                <span>{numQuestions}</span>
                <button onClick={handleIncrement}>+</button>
            </div>
            <button className="btn btn-primary btn-lg" onClick={startGame} disabled={gameStarted}>Start Game </button>
        </div>
    )
}

const SetupPlayerControls: React.FC = () => {
    const [category, ] = useMultiplayerState(...globalStateNames.category);
    const [numQuestions, ] = useMultiplayerState(...globalStateNames.questionCount);

    return (
        <div>
            <div>
                <h1>Category</h1>
                <h2>{category}</h2>
            </div>
            <div>
                <h1>Question Count</h1>
                <h2>{numQuestions}</h2>
            </div>
        </div>
    )
}

const Setup: React.FC<SetupProps> = ({ isHost }) => {

    return (
        <div>
            {isHost ? <SetupHostControls /> : <SetupPlayerControls />}
        </div>
    );
};

export default Setup;