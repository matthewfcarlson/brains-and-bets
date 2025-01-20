import { useEffect } from 'react';
import { isStreamScreen, useIsHost, resetPlayersStates, resetStates } from 'playroomkit';
import { GameStateContext, tickGameStateHost, useGameState, useRawState } from "./Engine";
import {SetupPlayer, SetupBigScreen} from './components/GameSetup';
import { QuestionBigScreen, QuestionPlayer } from './components/GameQuestion';
import { BettingBigScreen, BettingPlayer } from './components/GameBetting';
import { ScoringBigScreen, ScoringPlayer } from './components/GameScoring';


function App() {
  const isBigScreen = isStreamScreen();
  const rawState = useRawState();
  const isHost = useIsHost();
  const gameState = useGameState(rawState);
  if (isBigScreen !== gameState.isBigScreen || gameState.isBigScreen === null) {
    gameState.setPlayerIsBigScreen(isBigScreen === true);
  }

  // Tick the game state every second
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHost) return; 
      tickGameStateHost(gameState);
    }, 1000);
  
    return () => clearInterval(interval);
  }, [isHost, rawState, gameState]);

  const resetGame = () => {
    resetPlayersStates();
    resetStates();
  }

  return (
    <GameStateContext.Provider
      value={gameState}
    >
      {isBigScreen ? <SetupBigScreen />: <SetupPlayer /> }
      {isBigScreen ? <QuestionBigScreen />: <QuestionPlayer /> }
      {isBigScreen ? <BettingBigScreen />: <BettingPlayer /> }
      {isBigScreen ? <ScoringBigScreen />: <ScoringPlayer /> }
      <pre>{JSON.stringify(gameState, null, " ")}</pre>
      {/* <pre>{JSON.stringify(rawState, null, " ")}</pre> */}
      <button onClick={() => console.log(rawState)}>Log Raw</button>
      <button onClick={resetGame}>Reset Game</button>
    </GameStateContext.Provider>
  )
  
}

export default App
