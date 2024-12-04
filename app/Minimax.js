const debug = require("debug");
const debugLog = debug("btcexp:Minimax");
const { Worker } = require('worker_threads');
const path = require('path');


class Minimax {
    constructor(words, startWord, maxDepth = 5) {
        this.maxDepth = maxDepth;
        this.words = words;
        this.outcomes = {};
        this.lastGuessIdx = 0;
        this.startWord = startWord;
        this.guesses = [];

        // Create worker
        debugLog('Creating worker thread');
        this.worker = new Worker(path.join(__dirname, 'minimaxWorker.js'));
        
        // Add basic error handling
        this.worker.on('error', (error) => {
            debugLog('Worker error:', error);
        });
    }

    // Add method to communicate with worker
    async runWorkerTask(data) {
        debugLog('Sending task to worker:', data);
        return new Promise((resolve, reject) => {
            this.worker.once('message', resolve);
            this.worker.once('error', reject);
            this.worker.postMessage(data);
        });
    }

    cleanup() {
        if (this.worker) {
            debugLog('Terminating worker');
            this.worker.terminate();
        }
    }

    getFeedback(guess, supposedAnswer) {
        //debugLog(`getFeedback called with guess: ${typeof guess} ${guess}, answer: ${typeof supposedAnswer} ${supposedAnswer}`);
        const result = new Array(5).fill(0); // 0 = gray, 1 = yellow, 2 = green
        const answerLetters = [...supposedAnswer];
        const guessLetters = [...guess];
    
        // First pass: mark green matches (2)
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === answerLetters[i]) {
                result[i] = 2;
                answerLetters[i] = null;
                guessLetters[i] = null;
            }
        }
    
        // Second pass: mark yellows (1)
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === null) continue;
            
            const letterIndex = answerLetters.indexOf(guessLetters[i]);
            if (letterIndex !== -1) {
                result[i] = 1;
                answerLetters[letterIndex] = null;
            }
        }
    
        return result;  // Returns array of numbers [0,1,2]
    }

    // Make a guess
    async guess() {

        debugLog('Guess called with:', {
            guessesLength: this.guesses.length,
            startWord: this.startWord,
            wordsLength: this.words?.length
        });

        if (!this.outcomes || Object.keys(this.outcomes).length === 0) {
            const { bestOutcomes } = await this.runWorkerTask({
                type: 'minimax',
                candidateWords: [this.startWord],  // only one candidate
                remainingWords: this.words
            });
            this.outcomes = bestOutcomes;
            return this.startWord;
        }
    
        //debugLog('Outcomes:', this.outcomes);

        // Get last guess result
        const lastGuess = this.guesses[this.lastGuessIdx];
        const result = lastGuess[1];
        const resultKey = result.join(',');
        //debugLog('Looking for key:', resultKey, 'in outcomes:', Object.keys(this.outcomes));
        
        // Get remaining possible words based on last feedback
        const remainingWords = this.outcomes[resultKey];
        if (!remainingWords) {
            debugLog('Available keys:', Object.keys(this.outcomes));
        }

        if (!remainingWords || remainingWords.length === 0) {
            throw new Error('No words match the given feedback');
        }

        if (remainingWords.length === 1) {
            return remainingWords[0];
        }

        // Find best next guess using minimax
        // const { bestGuess, bestOutcomes } = this.minimax(this.words, remainingWords);
        
        
        const { bestGuess, bestOutcomes } = await this.runWorkerTask({
            type: 'minimax',
            candidateWords: this.words,
            remainingWords: remainingWords
        });
        
        
        this.outcomes = bestOutcomes;
        this.lastGuessIdx++;

        return bestGuess;
    }

    // Add a guess and its feedback to history
    addGuess(word, feedback) {
        this.guesses.push([word, feedback]);
    }
}

module.exports = Minimax;