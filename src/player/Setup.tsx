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
        if (gameStarted) {
            return;
        }
        setGameStarted(true);
        let categoryQuestions = Object(questionsDB)[category] || questionsDB.General;
        let questionArray = [];
        for (let i = 0; i < numQuestions; i++) {
            let randomIndex = Math.floor(Math.random() * categoryQuestions.length);
            questionArray.push(categoryQuestions[randomIndex]);
        }

        setQuestions(questionArray);
        setGameState("question");
    };

    const handleDecrement = () => {
        if (numQuestions > 3) {
            setNumQuestions(numQuestions - 1);
        }
    };

    return (
        <div className="container">
            <div className="form-group">
                <label htmlFor="category">Category:</label>
                <select id="category" className="form-control" value={category} onChange={handleCategoryChange}>
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
                    <input type="text" className="form-control text-center" value={numQuestions} readOnly />
                    <div className="input-group-append">
                        <button className="btn btn-outline-secondary" onClick={handleIncrement}>+</button>
                    </div>
                </div>
            </div>
            <br/>
            <button className="btn btn-primary btn-lg" onClick={startGame} disabled={gameStarted}>Start Game</button>
        </div>
    );
};

const SetupPlayerControls: React.FC = () => {
    const [category, ] = useMultiplayerState(...globalStateNames.category);
    const [numQuestions, ] = useMultiplayerState(...globalStateNames.questionCount);

    return (
        <div className="container">
            <div className="form-group">
                <label htmlFor="category">Category:</label>
                <input type="text" className="form-control" value={category} readOnly />
            </div>
            <div className="form-group">
                <label htmlFor="questionCount">Question Count:</label>
                <input type="text" className="form-control" value={numQuestions} readOnly />
            </div>
        </div>
    );
};

const Setup: React.FC<SetupProps> = ({ isHost }) => {
    return isHost ? <SetupHostControls /> : <SetupPlayerControls />;
};

export default Setup;