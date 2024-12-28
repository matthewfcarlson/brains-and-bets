import React, { useState } from 'react';

import { useMultiplayerState } from "playroomkit";
import { globalStateNames } from "../Engine";
import questionsDB from '../assets/questions';

interface SetupProps {
    isHost: boolean;
}


const SetupHostControls: React.FC = () => {
    const [category, setCategory] = useMultiplayerState(...globalStateNames.category);
    const [numQuestions, setNumQuestions] = useMultiplayerState(...globalStateNames.questionCount);
    const [, setQuestions] = useMultiplayerState(...globalStateNames.questions);
    const [, setGameState] = useMultiplayerState(...globalStateNames.currentState);
    const [gameStarted, setGameStarted] = useState<boolean>(false);
    const categories = Object.keys(questionsDB);

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
        let categoryQuestions = Object(questionsDB)[category]|| questionsDB.General;
        let questionArray = [];
        for (let i = 0; i < numQuestions; i++) {
            let randomIndex = Math.floor(Math.random() * categoryQuestions.length);
            questionArray.push(categoryQuestions[randomIndex]);
        }

        setQuestions(questionArray);
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
                {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                ))}
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