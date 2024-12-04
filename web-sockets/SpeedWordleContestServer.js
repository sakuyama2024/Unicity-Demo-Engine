const debug = require("debug");
const debugLog = debug("btcexp:ContestServer");
const SpeedWordleGame = require('../app/SpeedWordleGame');
const leaderboardManager = require('../app/leaderboard');  
const e = require("express");


const NUMBER_OF_GAMES = 5;

class SpeedWordleContestServer {
    constructor() {
        // Initialize the game server and pass callback for  game over
        this.gameStates = new Map;
    }

    startGame(sessionId) {
        const state = this.gameStates.get(sessionId);
        state.gameCount++;
    
        const startWord = global.VALID_ANSWERS[Math.floor(Math.random() * global.VALID_ANSWERS.length)];
        const answerWord = global.VALID_ANSWERS[Math.floor(Math.random() * global.VALID_ANSWERS.length)];
        
        state.currentGame = new SpeedWordleGame(startWord, answerWord);
    
        // Start timer for this game
        state.currentGame.interval = setInterval(() => {
            const timeRemaining = state.currentGame.getTimeRemaining();
            state.ws.send(JSON.stringify({
                type: 'time_update',
                timeRemaining: timeRemaining
            }));
    
            if (timeRemaining <= 0 && !state.currentGame.gameOverHandled) {
                this.handleGameOver(sessionId);
            }
        }, 1000);
    
        // Send game started message
        state.ws.send(JSON.stringify({
            type: 'game_started',
            details: state.currentGame.guesses,
            gameNumber: state.gameCount,
            totalGames: NUMBER_OF_GAMES,
            leaderboard: leaderboardManager.getLeaderboard()
        }));
    }

    handleLeaderboard(sessionId) {
        const state = this.gameStates.get(sessionId);
        if (!state) return;

        state.ws.send(JSON.stringify({
            type: 'leaderboard_update',
            leaderboard: leaderboardManager.getLeaderboard()
        }));
    }

    handleGuess(sessionId, guess) {
        const state = this.gameStates.get(sessionId);
        if (!state) return;
    
        const guessAccepted = state.currentGame.makeGuess(guess);
        
        if (!guessAccepted) {
            state.ws.send(JSON.stringify({
                type: 'invalid_guess'
            }));
            return;
        }
    
        if (state.currentGame.completed && !state.currentGame.gameOverHandled) {
            this.handleGameOver(sessionId);
            return;
        }
    
        state.ws.send(JSON.stringify({
            type: 'guess_result',
            details: state.currentGame.guesses
        }));
    }

    handleGameOver(sessionId) {
        const state = this.gameStates.get(sessionId);
        if (!state) return;
    
        state.currentGame.gameOverHandled = true;
        clearInterval(state.currentGame.interval);
    
        // Send game over
        const timeTaken = (state.currentGame.completedTime - state.currentGame.startTime) / 1000;
        const won = state.currentGame.answerWord === state.currentGame.guesses[state.currentGame.guesses.length - 1].guess;
        
        // need to add this later when we generate the Unicity Proof
        //if (!state.games) state.games = [];
        //state.games.push({
        //    word: state.currentGame.answerWord,
        //    time: timeTaken,
        //    guesses: state.currentGame.guesses.length,
        //    won: won
        //});

        const additionalTime =  won ? 0 : 30
        state.totalTime += (timeTaken + additionalTime);
        state.totalGuesses += state.currentGame.guesses.length;
        if (won) state.wonGames++;

        state.contestOver = (state.gameCount === NUMBER_OF_GAMES);

        state.ws.send(JSON.stringify({
            type: 'game_over',
            won: won,
            answerWord: state.currentGame.answerWord,
            timeTaken: timeTaken,
            guesses: state.currentGame.guesses,
            noGuesses: state.currentGame.guesses.length,
            gameNumber: state.gameCount,
            // Send running totals with every message
            totalTime: state.totalTime,
            totalGuesses: state.totalGuesses,
            gamesWon: state.wonGames,
            // Contest completion info
            contestOver: state.contestOver,
            qualifiesForLeaderboard: state.contestOver ? leaderboardManager.checkScoreQualification(state.totalTime) : undefined
        }));

       // if (contestOver) {
       //     this.gameStates.delete(sessionId);
       // }
    }

    handleMessage(sessionId, data, ws) {
        switch(data.type) {
            case 'initialize':
                this.handleLeaderboard(sessionId);
                break;
            case 'start_game':
                this.startGame(sessionId, ws);
                break;
            case 'start_round':
                this.startGame(sessionId, ws);
                break;
            case 'make_guess':
                this.handleGuess(sessionId, data.guess);
                break;
            case 'player_name':
                this.handlePlayerName(sessionId, data.playerName);
                break;
        }
    }

    async handlePlayerName(sessionId, playerName) {
        const state = this.gameStates.get(sessionId);
        if (!state.contestOver) {
            debugLog('Contest not finished yet');
            return;
        }
        const timeTaken = state.totalTime;
    
        if (leaderboardManager.checkScoreQualification(timeTaken)) {
            try{
                const updatedLeaderboard = await leaderboardManager.addScore(playerName, timeTaken);
                // Send the updated leaderboard to the client
                state.ws.send(JSON.stringify({
                    type: 'leaderboard_update',
                    leaderboard: updatedLeaderboard
                }));
            }catch(error){
                console.error('Error adding score to leaderboard:', error);
            }
        }else{
            debugLog('Player did not qualify for leaderboard');
        }
    }

    addConnection(sessionId, ws) {
        this.gameStates.set(sessionId, { 
            ws: ws,
            currentGame: null,
            gameCount: 0,
            totalTime: 0,
            totalGuesses: 0,
            wonGames: 0,
            contestOver: false
        });
    }

    removeConnection(sessionId) {
        const state = this.gameStates.get(sessionId);
        if (state && state.currentGame && state.currentGame.interval) {
            clearInterval(state.currentGame.interval);
        }
        this.gameStates.delete(sessionId);
    }
}

module.exports = new SpeedWordleContestServer();