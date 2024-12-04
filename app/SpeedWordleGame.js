const debug = require("debug");
const debugLog = debug("btcexp:SpeedWordleGame");

const GAME_DURATION = 60; // seconds
const MAX_GUESSES = 6;
const WORD_SIZE = 5;

class SpeedWordleGame {
    constructor(startWord, answerWord) {
        if (!startWord || startWord.length !== WORD_SIZE) {
            throw new Error('Invalid start word provided');
        }
        if (!answerWord || answerWord.length !== WORD_SIZE) {
            throw new Error('Invalid answer word provided');
        }

        this.startWord = startWord.toUpperCase();
        this.answerWord = answerWord.toUpperCase();
        this.startTime = Date.now();
        this.endTime = this.startTime + (GAME_DURATION * 1000);
        this.guesses = [];
        this.completed = false;
        this.completedTime = this.endTime;
        this.gameOverHandled = false;
        this.interval = null;


        // Make initial guess with start word
        this.makeGuess(this.startWord);
        debugLog(`New game created with start word: ${this.startWord} and answer word: ${this.answerWord} `);
    }

    makeGuess(guess) {
        if (this.completed || this.getTimeRemaining() <= 0) {
            this.completed = true;
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
            this.completedTime = Date.now();
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

    //calculateScore() {
    //    const timeUsed = Math.min((this.completedTime - this.startTime) / 1000, GAME_DURATION);
    //    const penalty = this.guesses.some(g => g.guess === this.answerWord) ? 0 : 30;
    //    return Math.round(timeUsed + penalty);
    //}

    getTimeRemaining() {
        return Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
    }
}

module.exports = SpeedWordleGame;