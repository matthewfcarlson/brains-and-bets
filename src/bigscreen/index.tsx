import Betting from './Betting'
import Question from './Question'
import EndGame from './EndGame'
import Scoring from './Scoring'
import Setup from './Setup'

import { myPlayer, useMultiplayerState, usePlayerState } from "playroomkit";
import { globalStateNames, playerStateNames } from "../Engine";

function App() {
    const [gameState,] = useMultiplayerState(...globalStateNames.currentState);
    const [, setIsBigScreenPlayer] = usePlayerState(myPlayer(), ...playerStateNames.isBigScreen);
    setIsBigScreenPlayer(true);
    switch (gameState) {
        case "setup":
            return <Setup />
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
export default App