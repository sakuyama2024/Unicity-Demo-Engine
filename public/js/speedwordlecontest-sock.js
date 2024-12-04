let gameStarted = false;
let inContest = false;
let currentTile = 0;
let currentRow = 0;
const wordLength = 5;  

console.log('Speedwordle script loaded at:', Date.now());

const socket = new WebSocket('ws://localhost:3002');  // Replace with your server's WebSocket URL

// WebSocket event listeners
socket.addEventListener('open', () => {
    console.log('Connected to WebSocket server');
});

socket.addEventListener('error', () => {
    showMessage('Error', 'Connection to the server lost. Please refresh the page.');
});

socket.addEventListener('close', () => {
    showMessage('Error', 'Connection closed. Please try again later.');
});

document.addEventListener('DOMContentLoaded', () => {
    // Initialize modal
    const modalElement = document.getElementById('messageModal');
    messageModal = new bootstrap.Modal(modalElement, {
        keyboard: true,
        backdrop: 'static',
        show: false
    });
    // Hide it initially
    modalElement.style.display = 'none';
});

socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
        case 'game_started':
            handleGameStart(data);
            break;
        case 'time_update':
            updateTimeRemaining(data.timeRemaining);
            break;
        case 'guess_result':
            handleGuessResult(data);
            break;
        case 'game_over':
            handleGameOver(data);
            break;
        case 'invalid_guess':
            handleInvalidGuess()
            break;
        case 'leaderboard_update':
            updateLeaderboard(data.leaderboard);
            break;
        case 'error':
            showMessage('Error', data.message);
            break;
        default:
            console.warn('Unknown message type:', data.type);
    }
});


function submitPlayerName() {
    const playerName = document.getElementById('playerName').value.trim();
    if (playerName) {
        socket.send(JSON.stringify({
            type: 'player_name',
            playerName: playerName
        }));
        // Close modal after submission
        const modalElement = document.getElementById('messageModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
    }
 }


function getCurrentGuess() {
    const gameBoard = document.querySelector('#game-board');
    if (!gameBoard) {
        console.error('Game board not found');
        return '';
    }

    const flexContainer = gameBoard.querySelector('.d-flex.flex-column');
    if (!flexContainer) {
        console.error('Flex container not found');
        return '';
    }

    const row = flexContainer.children[currentRow];
    if (!row) {
        console.error('Flex Container Row not found');
        return '';
    }

    let guess = '';
    for (let i = 0; i < wordLength; i++) {
        guess += row.children[i].textContent;
    }
    
    return guess;
}



function updateStartButtonState() {
    const startButton = document.getElementById('startButton');

    if (gameStarted) {
        startButton.disabled = true;
        startButton.classList.remove('btn-secondary');
        startButton.classList.add('btn-success');
    } else {
        startButton.disabled = false;
        startButton.classList.remove('btn-success');
        startButton.classList.add('btn-primary');
    }
}

// Function to update the timer based on server's time remaining
function updateTimeRemaining(timeRemaining) {
    const timerDisplay = document.getElementById('timer');
    timerDisplay.textContent = `${timeRemaining}s`;

    // Update visual feedback based on remaining time
    timerDisplay.classList.remove('danger', 'warning');
    if (timeRemaining <= 10) {
        timerDisplay.classList.add('danger');
    } else if (timeRemaining <= 30) {
        timerDisplay.classList.add('warning');
    }
}

function showMessage(title, message) {
    const modalElement = document.getElementById('messageModal');
    const modal = new bootstrap.Modal(modalElement, {
        keyboard: true,
        backdrop: 'static'
    });

    modalElement.querySelector('.modal-title').textContent = title;
    modalElement.querySelector('.modal-body').innerHTML = message;

    modal.show();  
}

function clearGameBoard() {
    const gameBoard = document.querySelector('#game-board');
    if (!gameBoard) {
        console.error('Game board not found');
        return;
    }

    const flexContainer = gameBoard.querySelector('.d-flex.flex-column');
    if (!flexContainer) {
        console.error('Flex container not found');
        return;
    }

    // Clear each tile in each row
    Array.from(flexContainer.children).forEach(row => {
        Array.from(row.children).forEach(tile => {
            tile.textContent = '';
            tile.classList.remove('correct', 'present', 'absent');
        });
    });
}

function clearContestBoard() {
    const tbody = document.querySelector('#contestScores');
    if (tbody) {
        Array.from(tbody.rows).forEach(row => {
            row.cells[1].textContent = '-';  // Word
            row.cells[2].textContent = '-';  // Time
            row.cells[3].textContent = '-';  // Guesses
            row.cells[4].textContent = '-';  // Result
        });
    }
}

document.getElementById('startButton').addEventListener('click', function(e) {
    e.preventDefault();

        // Reset timer display to initial time
        document.getElementById('timer').textContent = '60s';

    if (!gameStarted) {
        this.textContent = 'Loading...';
        this.disabled = true;

        if (!inContest) {
            // Starting new contest
            clearGameBoard();
            clearContestBoard();
            inContest = true;
            socket.send(JSON.stringify({ 
                type: 'start_game',
                gameType: 'speedWordleContest'
            }));
        } else {
            // Starting next game in series
            clearGameBoard();
            socket.send(JSON.stringify({ 
                type: 'start_round',
                gameType: 'speedWordleContest'
            }));
        }
    }
});


// Function to handle the game start response from the server
function handleGameStart(data) {
    console.log('Game started:', data);

    currentRow = 1;
    currentTile = 0;

    // Update game state and UI
    updateGameBoard(data.details);
    gameStarted = true;

    // Update button appearance
    updateStartButtonState();
    document.getElementById('startButton').classList.remove('btn-secondary');
    document.getElementById('startButton').classList.add('btn-success');
    document.getElementById('startButton').textContent = 'Game In Progress';

    
}


function getGameEndReason(data) {
    if (data.won) {
        return `You won the game in ${data.timeTaken} seconds with ${data.noGuesses} guesses!`;
    }   
    else{
        return "You lost! 30 seconds penalty added!";
    }   
}

function handleGameOver(data) {
   
    updateGameBoard(data.guesses);

    const tbody = document.querySelector('#contestScores');
    if (!tbody) {
        console.error('tbody#contestScores not found');
        return;
    }
 
    // Update the row for the current game
    const row = tbody.rows[data.gameNumber - 1];
    if (row) {
        row.cells[1].textContent = data.answerWord;
        row.cells[2].textContent = `${data.timeTaken.toFixed(1)}s`;
        row.cells[3].textContent = data.noGuesses;

         // Update the result column with a checkmark (✓) or cross (✗) and apply the respective class
        const resultCell = row.cells[4];
        if (data.won) {
            resultCell.innerHTML = `<span class="green-check">✓</span>`; 
        } else {
            resultCell.innerHTML = `<span class="red-cross">✗</span>`;
        }
    }

    document.getElementById('totalTime').textContent = `${data.totalTime.toFixed(1)}s`;
    document.getElementById('totalGuesses').textContent = data.totalGuesses;
    document.getElementById('finalResult').textContent = `${data.gamesWon}/5`;

    // Clear the modal content first
    const modalBody = document.querySelector('.modal-body');
    const modalTitle = document.querySelector('.modal-title');

    // Reset modal content
    modalBody.innerHTML = '';  // Clear any previous content
    modalTitle.textContent = '';  // Reset the title

    let gameOverMessage = `
    <p>The answer was <strong>${data.answerWord.toUpperCase()}</strong></p>
    <p>${getGameEndReason(data)}</p>
    `;

    if (data.contestOver) {
        gameOverMessage += `
            <p>Contest Complete!</p>
            <p>Total Time: ${data.totalTime.toFixed(1)}s</p>
            <p>Games Won: ${data.gamesWon}/5</p>
        `;
    
        if (data.qualifiesForLeaderboard) {
            gameOverMessage += `
                <p>Congratulations! You qualified for the leaderboard!</p>
                <div class="form-group">
                    <label for="playerName">Enter your name:</label>
                    <input type="text" class="form-control" id="playerName" maxlength="20">
                </div>
            `;
            document.getElementById('modalSubmitBtn').classList.remove('d-none');
        } else {
            document.getElementById('modalSubmitBtn').classList.add('d-none');
        }
    } else {
        document.getElementById('modalSubmitBtn').classList.add('d-none');
    }

    // Set the modal title and body with the constructed message
    modalTitle.textContent = 'Game Over';
    modalBody.innerHTML = gameOverMessage;
        
    showMessage('Game Over', gameOverMessage);
    
    // Reset game state
    currentRow = 0;
    currentTile = 0;
    gameStarted = false;

    // Update button state
    const startButton = document.getElementById('startButton');
    if (!data.contestOver) {
        startButton.textContent = `Start Game ${data.gameNumber + 1} of 5`;
    } else {
        startButton.textContent = 'Start Contest';
        inContest = false;
    }
    updateStartButtonState();
}


function updateGameBoard(guesses) {
    if (!guesses || !Array.isArray(guesses)) {
        console.error('Invalid guesses data:', guesses);
        return;
    }

    const gameBoard = document.querySelector('#game-board');
    if (!gameBoard) {
        console.error('Game board not found');
        return;
    }

    const flexContainer = gameBoard.querySelector('.d-flex.flex-column');
    if (!flexContainer) {
        console.error('Flex container not found');
        return;
    }

    guesses.forEach((guessData, rowIndex) => {
        const row = flexContainer.children[rowIndex];
        if (!row) {
            console.error(`Row ${rowIndex} not found`);
            return;
        }
        
        // Get direct child divs (the tiles)
        const tiles = row.children;

        if (!Array.isArray(guessData.result) || guessData.result.length !== tiles.length) {
            console.warn(`Row ${rowIndex + 1} results mismatch: Expected ${tiles.length} tiles, but got ${guessData.result.length} results.`);
            return;
        }

        guessData.result.forEach((result, tileIndex) => {
            const tile = tiles[tileIndex];
            if (!tile) {
                console.error(`Tile ${tileIndex} not found in row ${rowIndex}`);
                return;
            }
            
            tile.textContent = guessData.guess[tileIndex];
            tile.classList.remove('correct', 'present', 'absent'); 
            tile.classList.add(result);
        });
    });
}

function checkRow() {
    if (currentTile === wordLength) {
        const guess = getCurrentGuess();

        // Send the guess to the server via WebSocket
        socket.send(JSON.stringify({ type: 'make_guess', guess }));
    }
}


function handleGuessResult(data) {
    // update the game board and move to the next row
    updateGameBoard(data.details);
    currentTile = 0;  // Reset for the next guess
    currentRow++;     // Move to the next row
}

document.addEventListener('keydown', function(e) {

    // Do nothing if the game has not started
    if (!gameStarted) return;

    // Handle Enter key (submit guess)
    if (e.key === 'Enter') {
        checkRow(); // Send the guess to the server for validation
    } 
    // Handle Backspace key (delete last letter)
    else if (e.key === 'Backspace') {
        deleteLetter(); // Remove last letter from current guess (local UI change)
    } 
    // Handle letter keys (A-Z)
    else if (/^[A-Za-z]$/.test(e.key)) {
        addLetter(e.key.toUpperCase()); // Add letter to current guess (local UI change)
    }
});

document.querySelectorAll('.key-box').forEach(function(key) {
    key.addEventListener('click', function() {

		// Do nothing if the has not started
        if (!gameStarted) return;  

        const letter = key.getAttribute('data-key');  // Get the letter from the button

        if (letter === 'ENTER') {
            checkRow();  // Send the guess to the server for validation
        } else if (letter === 'BACK') {
            deleteLetter();  // Handle Backspace (delete the last letter from the current guess)
        } else {
            addLetter(letter);  // Add the clicked letter to the current guess (local UI change)
        }
    });
});


// Handle an invalid word (e.g., invalid word in word list)
function handleInvalidGuess() {

    row = getCurrentRow();
    // Apply shake animation or some visual effect
    row.classList.add('shake');
    setTimeout(() => {
        row.classList.remove('shake'); // Remove the shake class after the animation
    }, 500); // Duration of the shake effect

    // Allow the user to edit the current row again
    currentTile = wordLength;  // Allow the user to modify the tiles
    console.log('Invalid word - reset for editing', { row });
}

function getCurrentRow() {
    const gameBoard = document.querySelector('#game-board');
    if (!gameBoard) {
        throw new Error('Game board not found');
    }

    const flexContainer = gameBoard.querySelector('.d-flex.flex-column');
    if (!flexContainer) {
        throw new Error('Flex container not found');
    }

    const row = flexContainer.children[currentRow];
    if (!row) {
        throw new Error('Row not found');
    }

    return row;
}

function addLetter(letter) {
    if (currentTile < wordLength) {
        const gameBoard = document.querySelector('#game-board');
        if (!gameBoard) {
            console.error('Game board element not found');
            return;
        }
        // Get the flex column container first
        const flexContainer = gameBoard.querySelector('.d-flex.flex-column');
        if (!flexContainer) {
            console.error('Flex container not found');
            return;
        }
        // Now get the row from the flex container
        const row = flexContainer.children[currentRow];
        if (!row) {
            console.error('Row element not found');
            return;
        }
        const tile = row.children[currentTile];
        if (!tile) {
            console.error('Tile element not found');
            return;
        }
        tile.textContent = letter;
        currentTile++;
    }
}

function deleteLetter() {
	if (currentTile > 0) {
		currentTile--;
		const gameBoard = document.querySelector('#game-board');
		if (!gameBoard) {
			console.error('Game board element not found');
			return;
		}
		// Get the flex column container first
		const flexContainer = gameBoard.querySelector('.d-flex.flex-column');
		if (!flexContainer) {
			console.error('Flex container not found');
			return;
		}
		// Now get the row from the flex container
		const row = flexContainer.children[currentRow];
		if (!row) {
			console.error('Row element not found');
			return;
		}
		const tile = row.children[currentTile];
		if (!tile) {
			console.error('Tile element not found');
			return;
		}
		tile.textContent = '';
	}
 }

// Function to update the leaderboard when a message is received
function updateLeaderboard(data) {
    try {
        // Validate the response structure
        if (!Array.isArray(data)) {
            throw new Error('Invalid leaderboard data format');
        }

        // Get the leaderboard body element to update the table
        const leaderboardBody = document.getElementById('leaderboardBody');
        if (!leaderboardBody) {
            throw new Error('Leaderboard body element not found');
        }

        // Clear the current leaderboard and add new rows based on the received data
        leaderboardBody.innerHTML = data
            .map((entry, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${entry.playerName}</td>
                    <td>${entry.gameTime}</td>
                    <td>${entry.timestamp}</td>
                </tr>
            `)
            .join('');
    } catch (error) {
        console.error('Error updating leaderboard:', error);
    }
}


function updateContestScoreboard(stats) {
    const tbody = document.querySelector('#contestScores tbody');
    
    // Update or add the latest game result
    const currentGame = stats.games[stats.games.length - 1];
    const row = `
        <tr>
            <td>${stats.currentGame}</td>
            <td>${currentGame.word}</td>
            <td>${currentGame.time.toFixed(1)}s</td>
            <td>${currentGame.guesses}</td>
            <td>${currentGame.won ? '✓' : '✗'}</td>
        </tr>
    `;
    tbody.innerHTML += row;

    // Update totals
    document.querySelector('#totalTime').textContent = `${stats.totalTime.toFixed(1)}s`;
    document.querySelector('#totalGuesses').textContent = stats.games
        .reduce((total, game) => total + game.guesses, 0);
}



