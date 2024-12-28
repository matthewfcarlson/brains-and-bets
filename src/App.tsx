// import { useState } from 'react'
import './App.css'
import PlayerView from './player/index'
import BigScreenView from './bigscreen/index'
import { isStreamScreen, useIsHost, resetPlayersStates, resetStates } from "playroomkit";
import { playerStateNames } from './Engine';

function App() {
  const isHost = useIsHost();
  const restartGame = async () => {
    if (!isHost) return;
    // Then advance the game state
    resetPlayersStates([playerStateNames.isBigScreen[0]]);
    resetStates();
};
  return (
    <>
    {isStreamScreen() ? <BigScreenView /> : <PlayerView />}
    {isHost ? <div>Host</div> : <span/>}
    <button onClick={restartGame}>Restart Game</button>
    </>
  )
  
}

export default App
