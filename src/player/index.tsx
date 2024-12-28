import Betting from './Betting'
import Question from './Question'
import EndGame from './EndGame'
import Scoring from './Scoring'
import Setup from './Setup'

import { useIsHost, useMultiplayerState, usePlayerState, myPlayer } from "playroomkit";
import { globalStateNames, playerStateNames } from "../Engine";

function App() {
    const [gameState,] = useMultiplayerState(...globalStateNames.currentState);
    const [, setIsBigScreenPlayer] = usePlayerState(myPlayer(), ...playerStateNames.isBigScreen);
    setIsBigScreenPlayer(false);
    const isHost = useIsHost();
    switch (gameState) {
        case "setup":
            return <Setup isHost={isHost} />
        case "question":
            return <Question isHost={isHost} />
        case "betting":
            return <Betting isHost={isHost} />
        case "scoring":
            return <Scoring isHost={isHost}/>
        case "endGame":
            return <EndGame  isHost={isHost}/>
    }
}
export default App