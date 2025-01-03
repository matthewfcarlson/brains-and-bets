import { useMultiplayerState, usePlayersList } from "playroomkit";
import { globalStateNames, PlayerState, playerStateNames } from "../Engine";

interface ScoringProps {
    isHost: boolean;
    playerState: PlayerState;
}

const Scoring: React.FC<ScoringProps> = ({ isHost, playerState }) => {
    const questionIndex = playerState.questionIndex;
    const players = usePlayersList();
    const finishScoring = () => {
        if (!isHost) return;
        console.log(questionIndex, playerState.numQuestions);
        // First advance the question index
        playerState.host?.setQuestionIndex(questionIndex + 1);
        // Then advance the game state
        if (questionIndex >= playerState.numQuestions) {
            // game is over
            playerState.host?.setGameState("endGame");
            return;
        }
        // Otherwise increase the question index, reset everyone's answers
        players.forEach((player) => {
            player.setState(playerStateNames.answer[0], null);
        });

        playerState.host?.setGameState("question");
    };
    return (
        <>
            <h1>Scoring</h1>
            <button className="btn btn-lg btn-primary" onClick={finishScoring}>Finish Scoring</button>
        </>
    )
}
export default Scoring;