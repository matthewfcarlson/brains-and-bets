import { useMultiplayerState } from "playroomkit";
import { globalStateNames } from "../Engine";

interface BettingProps {
    isHost: boolean;
}

const Betting: React.FC<BettingProps> = ({ isHost }) => {
    const [, setGameState] = useMultiplayerState(...globalStateNames.currentState); 
    const finishBetting = async () => {
        if (!isHost) return;
        // Then advance the game state
        setGameState("scoring");
    };
    return (
        <>
            <h1>Betting</h1>
            <button onClick={finishBetting}>Finish Betting</button>
        </>
    )
}
export default Betting;