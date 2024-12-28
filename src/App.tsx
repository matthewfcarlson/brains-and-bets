// import { useState } from 'react'
import './App.css'
import PlayerView from './player/index'
import BigScreenView from './bigscreen/index'
import { isStreamScreen, useIsHost } from "playroomkit";

function App() {
  const isHost = useIsHost();
  return (
    <>
    {isStreamScreen() ? <BigScreenView /> : <PlayerView />}
    {isHost ? <div>Host</div> : <span/>}
    </>
  )
  
}

export default App
