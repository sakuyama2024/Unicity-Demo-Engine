const debug = require("debug");
const debugLog = debug("btcexp:GameServer");
const PlayervModelGame = require("../app/PlayervModelGame");
  

class PlayervModelGameServer {
    constructor() {
        this.games = new Map();      // sessionId -> game instance
        this.connections = new Map(); // sessionId -> websocket
    }

    handleStartGame(sessionId,competitor) {
        debugLog('Handling start game request for session:', sessionId);
        
        try {
            if (!global.VALID_ANSWERS || !Array.isArray(global.VALID_ANSWERS) || global.VALID_ANSWERS.length === 0) {
                this.sendError(sessionId, 'Game not initialized properly - word lists missing');
                return;
            }

            const startWord = global.VALID_ANSWERS[Math.floor(Math.random() * global.VALID_ANSWERS.length)];
            let answerWord;
            do {
                answerWord = global.VALID_ANSWERS[Math.floor(Math.random() * global.VALID_ANSWERS.length)];
            } while (answerWord === startWord);

            const game = new PlayervModelGame(startWord, answerWord, competitor);
            this.games.set(sessionId, game);
 
            const ws = this.connections.get(sessionId);
            ws.send(JSON.stringify({
                type: 'game_started',
                details: game.guesses
            }));

        } catch (error) {
            debugLog('Error starting game:', error);
            this.sendError(sessionId, 'Failed to start game: ' + error.message);
        }
    }

    handleGuess(sessionId, guess) {


        debugLog(`[handleGuess] Starting to process guess: ${guess} for session: ${sessionId}`);

        const game = this.games.get(sessionId);
        const ws = this.connections.get(sessionId);
    
        // Try to make the guess
        const guessAccepted = game.makeGuess(guess);
        
        if (!guessAccepted) {
            // if invalid guess send message back to the client
            ws.send(JSON.stringify({
                type: 'invalid_guess',
            }))
            return;
        }
        
        // If the guess ends the game and game over hasn't been handled yet, pass to game over
        if (game.completed ) {
            this.handleGameOver(sessionId);
            return;
        }
    
        // Otherwise send the guess result back to the client
        debugLog(`[handleGuess] Sending guess result back to client`);
        ws.send(JSON.stringify({
            type: 'guess_result',
            details: game.guesses
        }));
    }


    async handleGameOver(sessionId) {
        const game = this.games.get(sessionId);
        const ws = this.connections.get(sessionId);
    
        if (!game || !ws) {
            throw new Error('Game not found for session ID: ' + sessionId);
        }
    
        game.completed = true;
        const timeTaken = (game.completedTime - game.startTime) / 1000;
    
        // If AI isn't done yet
        if (!game.agentGamePlay) {
            // Send initial "waiting" message
            ws.send(JSON.stringify({
                type: 'game_over',
                guesses: game.guesses,
                answerWord: game.answerWord,
                timeTaken: timeTaken,
                agentGamePlay: null
            }));
    
            // Wait for AI and then send complete game over
            game.agentGamePlayPromise.then(() => {
                console.log('Result from AI:', game.agentGamePlay);  // This is the result you're interested in
        
                const resultMessage = game.compareResults(game, game.agentGamePlay);
                ws.send(JSON.stringify({
                    type: 'game_over',
                    guesses: game.guesses,
                    answerWord: game.answerWord,
                    timeTaken: timeTaken,
                    agentGamePlay: game.agentGamePlay,
                    resultMessage: resultMessage
                }));
            });
        } else {
            // AI is done, send complete results immediately
            const resultMessage = game.compareResults(game, game.agentGamePlay);
            ws.send(JSON.stringify({
                type: 'game_over',
                guesses: game.guesses,
                answerWord: game.answerWord,
                timeTaken: timeTaken,
                agentGamePlay: game.agentGamePlay,
                resultMessage: resultMessage
            }));
        }
    }
   



    sendError(sessionId, message) {
        const ws = this.connections.get(sessionId);
        if (ws) {
            ws.send(JSON.stringify({
                type: 'error',
                message
            }));
        }
    }

    addConnection(sessionId, ws) {
        this.connections.set(sessionId, ws);
    }

    removeConnection(sessionId) {
        this.connections.delete(sessionId);
        this.games.delete(sessionId);
    }

    handleMessage(sessionId, data) {
        switch(data.type) {
            case 'start_game':
                this.handleStartGame(sessionId, data.competitor);
                break;
            case 'make_guess':
                this.handleGuess(sessionId, data.guess);
                break;
            default:
                console.warn('Unknown message type for standard game:', data.type);
        }
    }
}

module.exports = new PlayervModelGameServer();