// import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Betting from './Betting'
import Question from './Question'
import EndGame from './EndGame'
import Scoring from './Scoring'
import PlayerView from './PlayerView'
import { usePlayersList, useIsHost, useMultiplayerState, isStreamScreen } from "playroomkit";

function Header() {
  if (!isStreamScreen()) {
    return null;
  }
  return (<div>
    <a href="https://vite.dev" target="_blank">
      <img src={viteLogo} className="logo" alt="Vite logo" />
    </a>
    <a href="https://react.dev" target="_blank">
      <img src={reactLogo} className="logo react" alt="React logo" />
    </a>

    <h1>Vite + React</h1>
  </div>)
}

function GameStateView({ state }: { state: string }) {
  switch (state) {
    case "question":
      return <Question />
    case "betting":
      return <Betting />
    case "scoring":
      return <Scoring />
    case "endGame":
      return <EndGame />
  }
}



function App() {
  const [count, setCount] = useMultiplayerState("count", 0);
  const [roundNumber, setRoundNumber] = useMultiplayerState("roundNumber", 1);
  const [gameState, setGameState] = useMultiplayerState("currentState", 'question');
  const isHost = useIsHost();
  // We have four states: "Question" -> Betting -> Scoring -> EndGame/Question
  if (isStreamScreen()) {
    return (
      <>
      <Header />
      {gameState} {roundNumber}
      <GameStateView state={gameState} />
      count is {count}
      </>
    )
  }
  
  return (
    <>
      <PlayerView isHost={isHost} />
    </>
  )
}

export default App
