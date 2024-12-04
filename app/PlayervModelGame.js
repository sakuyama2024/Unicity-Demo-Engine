// PlayervModelGame.js

const debug = require("debug");
const debugLog = debug("btcexp:PlayervModelGame");
const MAX_GUESSES = 6;

const Minimax = require('./Minimax.js');
const Constraints = require('./Constraints.js');


// Helper function to create a timeout promise
function timeout(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject(new Error(`Operation timed out after ${ms}ms`));
        }, ms);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


class PlayervModelGame {
    constructor(startWord, answerWord, competitor) {

        if (!startWord || startWord.length !== 5) {
            throw new Error('Invalid start word provided');
        }
        if (!answerWord || answerWord.length !== 5) {
            throw new Error('Invalid answer word provided');
        }

        this.startWord = startWord.toUpperCase();
        this.answerWord = answerWord.toUpperCase();
        this.guesses = [];
        this.completed = false;
        this.agentGamePlay = null;
        this.agentGamePlayPromise =null;
        this.competitor = competitor;

        if (competitor !== 'none') {
            this.agentGamePlayPromise = Promise.race([
                this.getAgentGamePlayLocal(startWord, answerWord, competitor),
                timeout(5000*10)  // 5 second timeout
            ])
            .then(agentGamePlay => {
                console.log('AI gameplay fetched:', agentGamePlay);
                this.agentGamePlay = agentGamePlay;
                debugLog(`Agent gameplay added`);
            })
            .catch(error => {
                if (error.message.includes('timed out')) {
                    debugLog('Agent gameplay fetch timed out');
                    this.agentGamePlayTimeout = true;
                    this.agentGamePlay = null;
                }
                debugLog(`Error getting agent gameplay: ${error.message}`);
                this.agentGamePlayError = error.message;
            });
        }else {
            // Explicitly set AI-related properties to null for non AI mode
            this.agentGamePlay = null;
            this.agentGamePlayPromise = null;
        }

        // Make initial guess with start word
        this.makeGuess(this.startWord);
        debugLog(`New game created with start word: ${this.startWord} and answer word: ${this.answerWord} `);
    }

    compareResults(playerGame, agentGamePlay) {

        const playerGuesses = playerGame.guesses.length;

        const playerWon = playerGame.guesses.some(move =>
            move.result.every(r => r === 'correct'));
 
        
        const agentWon = agentGamePlay.some(move => 
            move.result.every(r => r === 'correct'));


        const agentGuesses = agentWon ? 
            agentGamePlay.findIndex(move => move.result.every(r => r === 'correct')) + 1 : 
            MAX_GUESSES;

        let resultMessage;
        if (!playerWon && !agentWon) {
            resultMessage = "Draw! Neither player found their word";
        } else if (!playerWon) {
            resultMessage = `Agent wins! Found the word in ${agentGuesses} guesses`;
        } else if (!agentWon) {
            resultMessage = `You win! Found the word in ${playerGuesses} guesses`;
        } else if (playerGuesses < agentGuesses) {
            resultMessage = `You win! Found the word in ${playerGuesses} guesses vs Agent's ${agentGuesses}`;
        } else if (agentGuesses < playerGuesses) {
            resultMessage = `Agent wins! Found the word in ${agentGuesses} guesses vs your ${playerGuesses}`;
        } else {
            resultMessage = `Draw! Both found the word in ${playerGuesses} guesses`;
        }

        return resultMessage  
    }

    makeGuess(guess) {
        if (this.completed)  {
            return false;
        }
     
        // Check if word is in valid guess list
        if (!global.VALID_GUESSES.includes(guess.toLowerCase())) {
            return false;
        }

        // Convert the guess to uppercase
        guess = guess.toUpperCase();
    
        const result = this.evaluateGuess(guess);
        this.guesses.push({ guess, result });
    
        // Check if the word is guessed correctly
        if (guess === this.answerWord) {
            this.completed = true;
        }

        // Check if maximum number of guesses is reached
        if (this.guesses.length >= MAX_GUESSES) {
            this.completed = true;  // Mark game as completed
        }

        return true;
    }

    evaluateGuess(guess) {
        const result = new Array(5).fill('absent');
        const wordLetters = [...this.answerWord];
        const guessLetters = [...guess];

        // Mark correct letters
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === wordLetters[i]) {
                result[i] = 'correct';
                wordLetters[i] = null;
                guessLetters[i] = null;
            }
        }

        // Mark present letters
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i]) {
                const index = wordLetters.indexOf(guessLetters[i]);
                if (index !== -1) {
                    result[i] = 'present';
                    wordLetters[index] = null;
                }
            }
        }
        return result;
    }
    
    async getAgentGamePlayLocal(startWord, answerWord, competitor) {
        debugLog(`Starting getAgentGamePlayLocal with startWord: ${startWord}, competitor: ${competitor}`);
        
        if (competitor === 'none') {
            return null;
        }
    
        try {
            let agent;
            debugLog('Creating agent...');
            switch (competitor) {
                case 'beginner':
                    agent = new Minimax(global.VALID_GUESSES, startWord);
                    break;
                case 'intermediate':
                    agent = new Constraints(global.VALID_GUESSES, startWord); 
                    break;
                default:
                    agent = new Minimax(global.VALID_GUESSES, startWord);
            }
    
            debugLog('Getting first guess...');
            let currentGuess = await agent.guess();  // Add await here
            debugLog(`First guess is: ${currentGuess}`);
    
            const feedbackMap = {
                0: 'absent',
                1: 'present',
                2: 'correct'
            };
    
            let gameOver = false;
            const agentGamePlay = [];
            
            while (!gameOver) {
                debugLog(`Processing guess: ${currentGuess}`);
                
                const numericFeedback = agent.getFeedback(currentGuess, answerWord);
                const feedback = numericFeedback.map(num => feedbackMap[num]);
                
                agent.addGuess(currentGuess, numericFeedback);
                agentGamePlay.push({
                    guess: currentGuess,
                    result: feedback
                });
    
                if (currentGuess === answerWord || agentGamePlay.length >= 6) {
                    gameOver = true;
                } else {
                    try {
                        currentGuess = await agent.guess();  // Add await here too
                    } catch (error) {
                        console.error('Agent failed to make guess:', error);
                        gameOver = true;
                    }
                }
            }
    
            debugLog('Final agent gameplay:', JSON.stringify(agentGamePlay, null, 2));
            return agentGamePlay;
    
        } catch (error) {
            console.error('Error in agent gameplay:', error);
            throw error;
        }
    }
}

module.exports = PlayervModelGame;