const { parentPort } = require('worker_threads');
const debug = require("debug");
const debugLog = debug("btcexp:MinimaxWorker");

function getFeedback(guess, supposedAnswer){
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

function getOutcomes(guess, remainingWords) {
    const outcomes = {};
    
    remainingWords.forEach(word => {
        const feedback = getFeedback(guess, word);
        const key = feedback.join(',');
        
        if (!(key in outcomes)) {
            outcomes[key] = [];
        }
        outcomes[key].push(word);
    });

    return outcomes;
}

function minimax(candidateWords, remainingWords) {
    let bestScore = Infinity;
    let bestGuess = null;
    let bestOutcomes = null;

    for (const guess of candidateWords) {
        const outcomes = getOutcomes(guess, remainingWords);
        const worstCase = Math.max(...Object.values(outcomes).map(words => words.length));

        if (worstCase < bestScore) {
            bestScore = worstCase;
            bestGuess = guess;
            bestOutcomes = outcomes;
        }
    }

    return { bestGuess, bestScore, bestOutcomes };
}

parentPort.on('message', (data) => {
    if (data.type === 'minimax') {
        debugLog('Worker received minimax request');
        const result = minimax(data.candidateWords, data.remainingWords);
        debugLog('Worker completed minimax computation');
        parentPort.postMessage(result);
    }
});