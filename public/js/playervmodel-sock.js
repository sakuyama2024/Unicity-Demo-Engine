let gameStarted = false;
let currentTile = 0;
let currentRow = 0;
const wordLength = 5;  

let selectedCompetitor = 'beginner'

console.log('PlayervModel script loaded at:', Date.now());

const socket = new WebSocket('ws://localhost:3002');  

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




socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
        case 'game_started':
            handleGameStart(data);
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
        case 'error':
            showMessage('Error', data.message);
            break;
        default:
            console.warn('Unknown message type:', data.type);
    }
});



document.addEventListener('DOMContentLoaded', () => {
    // Initialize modal
    const modalElement = document.getElementById('messageModal');
    messageModal = new bootstrap.Modal(modalElement, {
        keyboard: true,
        backdrop: 'static'
    });
    // Hide it initially
    modalElement.style.display = 'none'

});

document.getElementById('competitor').addEventListener('change', function() {
	selectedCompetitor = this.value
})


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
        startButton.textContent = 'Game In Progress';
        startButton.disabled = true;
        startButton.classList.remove('btn-secondary');
        startButton.classList.add('btn-success');
    } else {
        startButton.textContent = 'Start Game';
        startButton.disabled = false;
        startButton.classList.remove('btn-success');
        startButton.classList.add('btn-primary');
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

function clearBoard(boardId) {
    const gameBoard = document.querySelector(boardId);
    if (!gameBoard) {
        console.error(`Game board not found: ${boardId}`);
        return;
    }

    const flexContainer = gameBoard.querySelector('.d-flex.flex-column');
    if (!flexContainer) {
        console.error(`Flex container not found in ${boardId}`);
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

document.getElementById('startButton').addEventListener('click', function(e) {
    e.preventDefault();
    if (!gameStarted) {
        this.textContent = 'Loading...';
        this.disabled = true;

        clearBoard('#game-board');
        clearBoard('#ai-board');


        // Send the 'start_game' message to the server via WebSocket
        socket.send(JSON.stringify({ 
            type: 'start_game',
            gameType: 'playervModel',
            competitor: selectedCompetitor
        }));
    }
});


// Function to handle the game start response from the server
function handleGameStart(data) {
    console.log('Game started:', data);


    currentRow = 1;
    currentTile = 0;

    // Update game state and UI
    updateGameBoard('#game-board',data.details);
    gameStarted = true;

    updateStartButtonState();
    document.getElementById('startButton').classList.remove('btn-secondary');
    document.getElementById('startButton').classList.add('btn-success');
    document.getElementById('startButton').textContent = 'Game In Progress';
}

function handleGameOver(data) {
   
    updateGameBoard('#game-board', data.guesses);
    
    if (!data.agentGamePlay) {
        // AI still calculating - don't end game yet
        showMessage('Player moves complete', `
            <p>The answer was <strong>${data.answerWord.toUpperCase()}</strong></p>
            <p>Waiting for Agent to complete its moves...</p>
        `);
        return;  // Don't reset game state yet
    }
    
    updateGameBoard('#ai-board', data.agentGamePlay);    // Update the game board with the final guesses 

    const gameOverMessage = `
    <p>The answer was <strong>${data.answerWord.toUpperCase()}</strong></p>
    <p>${data.resultMessage}</p>
    `;
    
    // Show the result modal
    showMessage('Game Over', gameOverMessage);

    // Show the "Start Game" button to restart the game
    document.getElementById('startButton').classList.remove('d-none');
    document.getElementById('startButton').disabled = false;  // Ensure button is clickable

    // Reset game state
    currentRow = 0;
    currentTile = 0;

    //Reset the game
    gameStarted = false;

    // Update the start button state when the game ends
    updateStartButtonState();
}

function updateGameBoard(boardId, guesses) {
    if (!guesses || !Array.isArray(guesses)) {
        console.error('Invalid guesses data:', guesses);
        return;
    }

    const gameBoard = document.querySelector(boardId);
    if (!gameBoard) {
        console.error(`Game board not found: ${boardId}`);
        return;
    }

    const flexContainer = gameBoard.querySelector('.d-flex.flex-column');
    if (!flexContainer) {
        console.error(`Flex container not found in ${boardId}`);
        return;
    }

    guesses.forEach((guessData, rowIndex) => {
        const row = flexContainer.children[rowIndex];
        if (!row) {
            console.error(`Row ${rowIndex} not found in ${boardId}`);
            return;
        }
        
        const tiles = row.children;

        if (!Array.isArray(guessData.result) || guessData.result.length !== tiles.length) {
            console.warn(`Row ${rowIndex + 1} results mismatch in ${boardId}: Expected ${tiles.length} tiles, but got ${guessData.result.length} results.`);
            return;
        }

        guessData.result.forEach((result, tileIndex) => {
            const tile = tiles[tileIndex];
            if (!tile) {
                console.error(`Tile ${tileIndex} not found in row ${rowIndex} of ${boardId}`);
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
    updateGameBoard('#game-board', data.details);
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



