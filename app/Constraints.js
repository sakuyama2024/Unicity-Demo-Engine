const debug = require("debug");
const debugLog = debug("btcexp:Minimax");




class Constraints {
    constructor(words, startWord) {
        this.guessWords = words;
        this.possibleWords = {};
        this.letters = {};
        this.guesses = [];
        this.startWord = startWord.toUpperCase();
        
        this.definePossibleWords();
    }

    definePossibleWords() {
        const probability = 1 / this.guessWords.length;
        this.guessWords.forEach(word => {
            this.possibleWords[word] = probability;
        });
    }

    getLetters() {
        const wletters = {};
        const lletters = {};
        
        Object.entries(this.letters).forEach(([letter, value]) => {
            if (value[0] === 1 || value[0] === 2) {
                wletters[letter] = value;
            } else {
                lletters[letter] = value;
            }
        });
        
        return [wletters, lletters];
    }

    lettersInWord(wletters, lletters, word) {
        // Check letters that shouldn't be in word
        for (const letter in lletters) {
            if (word.includes(letter)) return false;
        }

        // Check letters that should be in word
        for (const letter in wletters) {
            if (!word.includes(letter)) return false;
            if (wletters[letter][0] === 2 && word[wletters[letter][1]] !== letter) return false;
            if (wletters[letter][0] === 1 && word[wletters[letter][1]] === letter) return false;
        }
        return true;
    }

    updateProbs() {
        const words = [];
        const [wletters, lletters] = this.getLetters();

        // Find valid words
        Object.entries(this.possibleWords).forEach(([word, prob]) => {
            if (prob !== 0) {
                if (this.lettersInWord(wletters, lletters, word)) {
                    words.push(word);
                } else {
                    this.possibleWords[word] = 0;
                }
            }
        });

        // Update probabilities
        Object.keys(this.possibleWords).forEach(word => {
            this.possibleWords[word] = words.includes(word) ? 1 : 0;
        });
    }

    guess() {
        if (this.guesses.length === 0) {
            return this.startWord;
        }

        // Get most recent valid guess
        const lastGuess = this.guesses[this.guesses.length - 1];
        const [guessWord, code] = lastGuess;

        // Update letter constraints
        for (let i = 0; i < guessWord.length; i++) {
            const letter = guessWord[i];
            if (code[i] === 2) {
                this.letters[letter] = [2, i];
            } else if (code[i] === 1) {
                if (!(letter in this.letters) || this.letters[letter][0] !== 2) {
                    this.letters[letter] = [1, i];
                }
            } else {
                if (!(letter in this.letters) || 
                    (this.letters[letter][0] !== 2 && this.letters[letter][0] !== 1)) {
                    this.letters[letter] = [0, i];
                }
            }
        }

        this.updateProbs();

        // Get possible words and choose randomly
        const probWords = Object.entries(this.possibleWords)
            .filter(([_, prob]) => prob !== 0)
            .map(([word]) => word);

        if (probWords.length === 0) {
            throw new Error('No words match the constraints');
        }

        return probWords[Math.floor(Math.random() * probWords.length)];
    }

    getFeedback(guess, supposedAnswer) {
        const result = new Array(5).fill(0); // 0 = gray, 1 = yellow, 2 = green
        const answerLetters = [...supposedAnswer];
        const guessLetters = [...guess];

        // First pass: mark green matches
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === answerLetters[i]) {
                result[i] = 2;
                answerLetters[i] = null;
                guessLetters[i] = null;
            }
        }

        // Second pass: mark yellows
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === null) continue;
            
            const letterIndex = answerLetters.indexOf(guessLetters[i]);
            if (letterIndex !== -1) {
                result[i] = 1;
                answerLetters[letterIndex] = null;
            }
        }

        return result;
    }

    addGuess(word, feedback) {
        this.guesses.push([word, feedback]);
    }
}

module.exports = Constraints;