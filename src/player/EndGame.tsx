import { resetPlayersStates, resetStates } from "playroomkit";
import { playerStateNames } from "../Engine";

interface EndGameProps {
    isHost: boolean;
}

const EndGame: React.FC<EndGameProps> = ({ isHost }) => {
    const restartGame = async () => {
        if (!isHost) return;
        // Then advance the game state
        resetPlayersStates([playerStateNames.isBigScreen[0]]);
        resetStates();
    };
    return (
        <>
            <h1>EndGame</h1>
            <button onClick={restartGame}>Restart Game</button>
        </>
    )
}
export default EndGame;