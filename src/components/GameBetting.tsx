import React, { useState } from 'react';
import { useContext, Fragment } from 'react';
import { GameStateContext, PlayerBet, RawAnswerBucket, RawBet, RawBetPairStates } from "../Engine";

interface AnswerBucketBet {
    playerName: string;
    betAmount: number;
}

interface AnswerBucket {
    answer: string;
    players: string[];
    bucketIndex: number;
    currentBet: number;
    bettingPlayers: AnswerBucketBet[];
}

function GetPayoutValue(bucketIndex: number): string {
    if (bucketIndex == 0) return "6:1";
    if (bucketIndex == 1) return "5:1";
    if (bucketIndex == 2) return "4:1";
    if (bucketIndex == 3) return "3:1";
    if (bucketIndex == 4) return "2:1";
    if (bucketIndex == 5) return "3:1";
    if (bucketIndex == 6) return "4:1";
    if (bucketIndex == 7) return "5:1";
    return "N/A";
}

function RenderAnswerBuckets(answerBucket: AnswerBucket, handleBet: (bucketIndex: number, increase: boolean) => void, canHandleBet: (bucketIndex: number, increase: boolean) => boolean) {
    if (answerBucket.bucketIndex != 0 && answerBucket.players.length == 0) {
        return null;
    }
    return (
        <div className="row flex-grow-1 align-items-center text-white" key={answerBucket.bucketIndex}>
            <div className='col-2' onClick={_ => handleBet(answerBucket.bucketIndex, false)}>
                {canHandleBet(answerBucket.bucketIndex, false) ? "-" : ""}
            </div>
            <div className="col-8 text-center">
                <h3 className="fw-bold">{answerBucket.answer} </h3>
                <div>Pays {GetPayoutValue(answerBucket.bucketIndex)} {(answerBucket.currentBet>0)? " You Bet " + answerBucket.currentBet: ""} </div>
            </div>
            <div className='col-2' onClick={_ => handleBet(answerBucket.bucketIndex, true)}>
                {canHandleBet(answerBucket.bucketIndex, true) ? "+" : ""}
            </div>
        </div>
    )
}

function RenderAnswerBucketsBigScreen(answerBucket: AnswerBucket) {
    if (answerBucket.bucketIndex != 0 && answerBucket.players.length == 0) {
        return null;
    }
    return (
        <div className="row flex-grow-1 align-items-center text-white" key={answerBucket.bucketIndex}>
            <div className="col-12 text-center">
                <h3 className="fw-bold">{answerBucket.answer}</h3>
                <div>Pays {GetPayoutValue(answerBucket.bucketIndex)}</div>
                <div>{answerBucket.bettingPlayers.length} players betting</div>
            </div>
        </div>
    )
}

function GenerateAnswerBuckets(answerBuckets: RawAnswerBucket[], bets:PlayerBet[], myBet: RawBetPairStates) {
    let allAnswerBuckets: AnswerBucket[] = [];
    let currentBetCounts = [];
    for (let i = 0; i <=7; i++) currentBetCounts.push(0);
    if (myBet != null) {
        currentBetCounts[myBet[0].bucket] = myBet[0].additionalChips + 1;
        if (myBet[1] != null) {
            currentBetCounts[myBet[1].bucket] = myBet[1].additionalChips + 1;
        }
    }
    function GetBetsForBucket(bucketIndex: number): AnswerBucketBet[] {
        return bets.filter((bet) => bet.bet.bucket == bucketIndex).map((bet) => {
            return {
                playerName: bet.playerID,
                betAmount: bet.bet.additionalChips + 1,
            }
        })
    }
    allAnswerBuckets.push({
        answer: "Smaller than all",
        players: [],
        bucketIndex: 0,
        currentBet: currentBetCounts[0],
        bettingPlayers: GetBetsForBucket(0),
    })
    for (let i = 1; i <= 7; i++) {
        // Go through each answer bucket
        let answerBucket = answerBuckets.find((bucket) => bucket.bucketIndex === i);
        if (answerBucket !== undefined) {
            allAnswerBuckets.push({
                answer: String(answerBucket.answer),
                players: answerBucket.players,
                bucketIndex: i,
                currentBet: currentBetCounts[i],
                bettingPlayers: GetBetsForBucket(i),
            })
            continue;
        }
        allAnswerBuckets.push({
            answer: "",
            players: [],
            bucketIndex: i,
            currentBet: currentBetCounts[i],
            bettingPlayers: GetBetsForBucket(i),
        })
    }

    return allAnswerBuckets;
}

export const BettingPlayer: React.FC = () => {
    const gameState = useContext(GameStateContext);
    if (gameState.state !== "betting") {
        return null;
    }

    let allAnswerBuckets = GenerateAnswerBuckets(gameState.answerBuckets, gameState.allBets, gameState.myBet);

    const canHandleBet = (bucketIndex: number, increase: boolean) => {
        if (gameState.myReady) return false;
        if (increase == false) {
            // Check if this is a bucket we have already bet on
            if (gameState.myBet == null) return false;
            // If either bucket is this bucket, we know we can take one off
            if (gameState.myBet[0].bucket == bucketIndex) return true;
            if (gameState.myBet[1]?.bucket == bucketIndex) return true;
            return false;
        }
        // First check if either slot is empty
        if (gameState.myBet == null) return true;

        // Check whether we have the points needed based on our total chips
        let totalChips = gameState.myBet[0].additionalChips + (gameState.myBet[1]?.additionalChips || 0);
        // Check if we have enough chips to bet on the same bucket
        if (totalChips >= gameState.myScore && gameState.myBet[0].bucket == bucketIndex) return false;

        // We can bet on a new bucket
        if (gameState.myBet[1] == null) return true;

        // Check if either of the two slots is the bucket we want to bet on
        if (gameState.myBet[0].bucket == bucketIndex || gameState.myBet[1]?.bucket == bucketIndex) {
            // But we must have enough chips to bet
            if (totalChips < gameState.myScore) return true;
        }
        return false;
    }

    const handleBet = (bucketIndex: number, increase: boolean) => {
        console.log("Bet on bucket", bucketIndex, increase);
        // First check if we can handle the bet
        if (!canHandleBet(bucketIndex, increase)) {
            return;
        }
        if (increase) {
            // Increase the bet
            if (gameState.myBet == null) {
                gameState.setMyBet([{ bucket: bucketIndex as any, additionalChips: 0 }, null]);
                return;
            }
            // Check if the first bucket is the bucket we want to bet further on
            if (gameState.myBet[0].bucket == bucketIndex) {
                gameState.setMyBet([{ bucket: bucketIndex as any, additionalChips: gameState.myBet[0].additionalChips + 1 }, gameState.myBet[1]]);
                return;
            }
            // Check if the second bucket is the bucket is null
            if (gameState.myBet[1] == null) {
                gameState.setMyBet([gameState.myBet[0], { bucket: bucketIndex as any, additionalChips: 0 }]);
                return;
            }
            // Check if the second bucket is the bucket we want to bet further on
            if (gameState.myBet[1].bucket == bucketIndex) {
                gameState.setMyBet([gameState.myBet[0], { bucket: bucketIndex as any, additionalChips: gameState.myBet[1].additionalChips + 1 }]);
                return;
            }
            console.error("Should not be here", bucketIndex, increase, gameState.myBet);
            return;
        }
        // Decrease the bet
        if (gameState.myBet == null) {
            return;
        }
        // Check if the first bucket is the bucket we want to bet further on
        if (gameState.myBet[0].bucket == bucketIndex) {
            if (gameState.myBet[0].additionalChips == 0) {
                if (gameState.myBet[1] == null) {
                    gameState.setMyBet(null);
                    return;
                }
                gameState.setMyBet([gameState.myBet[1], null]);
            }
            gameState.setMyBet([{ bucket: bucketIndex as any, additionalChips: gameState.myBet[0].additionalChips - 1 }, gameState.myBet[1]]);
            return;
        }
        if (gameState.myBet[1]?.bucket == bucketIndex) {
            if (gameState.myBet[1].additionalChips == 0) {
                gameState.setMyBet([gameState.myBet[1], null]);
                return;
            }
            gameState.setMyBet([gameState.myBet[0], { bucket: bucketIndex as any, additionalChips: gameState.myBet[1].additionalChips - 1 }]);
            return;
        }
    }

    const canFinishBetting = () => {
        if (gameState.myBet == null) {
            console.log("You must bet on two answers");
            return false;
        }
        if (gameState.myBet[1] == null) {
            console.log("You must make a second bet");
            return false;
        }
        if (gameState.myReady) return false;
        return true;
    }

    const finishBetting = () => {
        if (!canFinishBetting()) {
            return;
        }
        gameState.setReady();
    };

    const finishBettingButton = (canFinishBetting())? (
        <div>
            <button className="btn btn-outline-light btn-lg" onClick={finishBetting}>Done Betting</button>
        </div>
    ) : null;

    return (
        <div className="container vh-100 d-flex flex-column justify-content-center">
            <div className="row align-items-center text-white text-center" key="question">
                <h3>Q: { gameState.questionText}</h3>
                <div>Bet on two answers that are the closest but not greater than the real answer</div>
            </div>
            { allAnswerBuckets.map(x => RenderAnswerBuckets(x, handleBet, canHandleBet)) }
            {finishBettingButton}
            {JSON.stringify(gameState.myBet)}
        </div>
    )
};
export const BettingBigScreen: React.FC = () => {
    const gameState = useContext(GameStateContext);
    if (gameState.state !== "betting") {
        return null;
    }
    let allAnswerBuckets = GenerateAnswerBuckets(gameState.answerBuckets, gameState.allBets, null);
    return (
        <div className="container min-vh-100 d-flex flex-column justify-content-center">
            { allAnswerBuckets.map(RenderAnswerBucketsBigScreen) }

        </div>
    )
}