import Betting from './Betting'
import Question from './Question'
import EndGame from './EndGame'
import Scoring from './Scoring'
import Setup from './Setup'

import { useIsHost, usePlayerState, myPlayer } from "playroomkit";
import { getPlayerState, getRawState, playerStateNames } from "../Engine";

function App() {
    const [, setIsBigScreenPlayer] = usePlayerState(myPlayer(), ...playerStateNames.isBigScreen);
    setIsBigScreenPlayer(false);
    const isHost = useIsHost();
    const rawState = getRawState();
    const playerState = getPlayerState(rawState);
    switch (rawState.gameState) {
        case "setup":
            return <Setup isHost={isHost} playerState={playerState} />
        case "question":
            return <Question isHost={isHost} playerState={playerState}/>
        case "betting":
            return <Betting isHost={isHost} />
        case "scoring":
            return <Scoring isHost={isHost} playerState={playerState}/>
        case "endGame":
        case "endgame":
            return <EndGame  isHost={isHost}/>
    }
}
export default App