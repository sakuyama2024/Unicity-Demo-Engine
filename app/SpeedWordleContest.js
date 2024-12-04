const debug = require("debug");
const debugLog = debug("btcexp:SpeedWordleGame");

const GAME_DURATION = 30; // seconds
const MAX_GUESSES = 6;

class SpeedWordleContest {
    constructor() {
        this.games = [];
        this.currentGameIndex = 0;
        this.totalTime = 0;
        this.totalGuesses = 0;
        this.completed = false;
    }

    startNextGame() {
        if (this.currentGameIndex >= 5) {
            this.completed = true;
            return null;
        }

        const game = new SpeedWordleGame(
            global.VALID_ANSWERS[Math.floor(Math.random() * global.VALID_ANSWERS.length)],
            global.VALID_ANSWERS[Math.floor(Math.random() * global.VALID_ANSWERS.length)]
        );

        this.games.push(game);
        this.currentGameIndex++;
        return game;
    }

    getCurrentGame() {
        return this.games[this.currentGameIndex - 1];
    }

    addGameResult(timeTaken, guesses) {
        this.totalTime += timeTaken;
        this.totalGuesses += guesses;
    }

    getStats() {
        return {
            gamesPlayed: this.currentGameIndex,
            totalTime: this.totalTime,
            totalGuesses: this.totalGuesses,
            games: this.games.map(g => ({
                word: g.answerWord,
                time: (g.completedTime - g.startTime) / 1000,
                guesses: g.guesses.length,
                won: g.won
            }))
        };
    }
}
module.exports = SpeedWordleContest;