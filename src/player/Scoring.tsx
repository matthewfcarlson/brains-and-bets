import { useMultiplayerState, usePlayersList } from "playroomkit";
import { globalStateNames, playerStateNames } from "../Engine";

interface ScoringProps {
    isHost: boolean;
}

const Scoring: React.FC<ScoringProps> = ({ isHost }) => {
    const [, setGameState] = useMultiplayerState(...globalStateNames.currentState); 
    const [questionIndex, setQuestionIndex] = useMultiplayerState(...globalStateNames.currentQuestionIndex);
    const [numQuestions, ] = useMultiplayerState(...globalStateNames.questionCount);
    const players = usePlayersList();
    const finishScoring = () => {
        if (!isHost) return;
        console.log(questionIndex, numQuestions);
        // First advance the question index
        setQuestionIndex(questionIndex + 1);
        // Then advance the game state
        if (questionIndex >= numQuestions || questionIndex > 1) {
            // game is over
            setGameState("endGame");
            return;
        }
        // Otherwise increase the question index, reset everyone's answers
        players.forEach((player) => {
            player.setState(playerStateNames.answer[0], null);
        });

        setGameState("question");
    };
    return (
        <>
            <h1>Scoring</h1>
            <button className="btn btn-lg btn-primary" onClick={finishScoring}>Finish Scoring</button>
        </>
    )
}
export default Scoring;