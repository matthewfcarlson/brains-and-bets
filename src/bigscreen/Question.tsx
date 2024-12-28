import { useMultiplayerState, usePlayersState } from "playroomkit";
import { globalStateNames, playerStateNames } from "../Engine";

function Question() {
    const [questions, ] = useMultiplayerState(...globalStateNames.questions);
    const [questionIndex, ] = useMultiplayerState(...globalStateNames.currentQuestionIndex);
    console.log(usePlayersState(playerStateNames.answer[0]));
    const answers = usePlayersState(playerStateNames.answer[0]).filter((x)=>{return x.state != null});
    // Get all players that are not big screen players as they have it set to false
    const nonBigScreenPlayerIds = usePlayersState(playerStateNames.isBigScreen[0]).filter((x)=>{return x.state === false}).map((x)=>{return x.player.id});
    console.log( usePlayersState(playerStateNames.isBigScreen[0]));
    console.log(nonBigScreenPlayerIds);
    const playersThatHaveAnswered = answers.filter((x)=>{return nonBigScreenPlayerIds.includes(x.player.id)});
    console.log(answers);
    console.log(playersThatHaveAnswered);
    return (
        <>
            <h1>Question {questionIndex+1}</h1>
            <h2>{questions[questionIndex]} </h2>
            <h3>Players Answered: {playersThatHaveAnswered.length} out of {nonBigScreenPlayerIds.length}</h3>
        </>
    )
}
export default Question;