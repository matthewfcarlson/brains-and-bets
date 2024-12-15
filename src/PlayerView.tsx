import { usePlayersList, useIsHost, useMultiplayerState, isStreamScreen } from "playroomkit";

function AdvanceGameState(isHost: boolean, gameState: string, roundNumber: number, setGameState: (state: string) => void, setRoundNumber: (roundNumber: number) => void) {
    if (isHost == false) return;
    switch (gameState) {
      case "question":
        setGameState("betting");
        break;
      case "betting":
        setGameState("scoring");
        break;
      case "scoring":
        setRoundNumber(roundNumber + 1);
        setGameState((roundNumber >= 3) ? "endGame" : "question");
        break;
      case "endGame":
        break;
    }
  }
  function ResetGameState(isHost: boolean, gameState: string, setGameState: (state: string) => void, setRoundNumber: (roundNumber: number) => void) {
    if (isHost == false) return;
    if (gameState == "endGame") {
      setRoundNumber(1);
      setGameState("question");
    }
  }

function PlayerView({isHost =false}) {
    const [count, setCount] = useMultiplayerState("count", 0);
    const [roundNumber, setRoundNumber] = useMultiplayerState("roundNumber", 1);
    const [gameState, setGameState] = useMultiplayerState("currentState", 'question');
    const players = usePlayersList();
  
    return (
        <>
        <div className="card">
        Game State: {gameState}
        <button onClick={() => setCount(count + 1)}>
          count is {count}
        </button>
        <p>
          {players.length} players are connected
          {isHost ? " and you are the host" : ""}
        </p>
        { isHost ? <button onClick={() => AdvanceGameState(isHost, gameState, roundNumber, setGameState, setRoundNumber)}>Advance Game State</button> : null }
        { isHost ? <button onClick={() => ResetGameState(isHost, gameState, setGameState, setRoundNumber)}>Reset Game State</button> : null }
      </div>
            <h1>PlayerView</h1>
            {isHost ? <h1>Host</h1> : <h1>Player</h1>}
        </>
    )
}
export default PlayerView;