// import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
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

function App() {
  const [count, setCount] = useMultiplayerState("count", 0);
  const isHost = useIsHost();
  const players = usePlayersList();
  return (
    <>
      <Header />
      <div className="card">
        <button onClick={() => setCount(count + 1)}>
          count is {count}
        </button>
        <p>
          {players.length} players are connected
          {isHost ? " and you are the host" : ""}
        </p>
      </div>
    </>
  )
}

export default App
