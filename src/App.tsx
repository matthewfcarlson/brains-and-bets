// import { useState } from 'react'
import { isStreamScreen } from 'playroomkit';
import { GameStateContext, useGameState, useRawState } from "./Engine";
import {SetupPlayer, SetupBigScreen} from './components/GameSetup';
import { QuestionBigScreen, QuestionPlayer } from './components/GameQuestion';


function App() {
  const isBigScreen = isStreamScreen();
  const rawState = useRawState();
  const gameState = useGameState(rawState);
  if (isBigScreen !== gameState.isBigScreen || gameState.isBigScreen === null) {
    gameState.setPlayerIsBigScreen(isBigScreen === true);
  }
  return (
    <GameStateContext.Provider
      value={gameState}
    >
      {isBigScreen ? <SetupBigScreen />: <SetupPlayer /> }
      {isBigScreen ? <QuestionBigScreen />: <QuestionPlayer /> }
      <pre>{JSON.stringify(rawState, null, " ")}</pre>
      <pre>{JSON.stringify(gameState, null, " ")}</pre>
    </GameStateContext.Provider>
  )
  
}

export default App
