let gameStarted = false;
let currentTile = 0;
let currentRow = 0;
const wordLength = 5;  
let displayTimer;
let gameEndTime;


console.log('Speedwordle script loaded at:', Date.now());



// Check for CSRF token once when the page loads
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (!csrfToken) {
    console.error('CSRF token not found');
    showMessage('Error', 'CSRF token is missing. Please refresh the page or contact support.');
} 


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


function startDisplayTimer() {
    if (displayTimer) {
        clearInterval(displayTimer);
    }

    function updateDisplay() {
        const now = new Date().getTime();
        const timeLeft = Math.max(0, Math.ceil((gameEndTime - now) / 1000));
        
        const timerDisplay = document.getElementById('timer');
        timerDisplay.textContent = `${timeLeft}s`;
        
        timerDisplay.classList.remove('danger', 'warning');
        if (timeLeft <= 10) {
            timerDisplay.classList.add('danger');
        } else if (timeLeft <= 30) {
            timerDisplay.classList.add('warning');
        }

        // When timer hits 0
        if (timeLeft <= 0) {
            clearInterval(displayTimer);
            notifyTimeExpired();
        }
    }

	 // Check if gameEndTime is valid before starting the timer
	 if (!gameEndTime || isNaN(gameEndTime)) {
        console.error('Invalid game end time');
        showMessage('Error', 'There was an issue with the game end time. Please try again.');
        return; // Exit early if the game end time is not valid
    }

    updateDisplay();
    displayTimer = setInterval(updateDisplay, 1000);
}

async function notifyTimeExpired() {
    try {
        const response = await fetch('/speedwordle/timeout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CSRF-Token': csrfToken
            }
        });

		if (!response.ok) {
            const errorData = await response.json(); // 
            throw new Error(errorData.error || 'Failed to end game'); 
        }

		const data = await response.json();
		console.log('Game timeout response:', data);

        endGame(data);

    } catch (error) {
        console.error('Error:', error);
        showMessage('Error', error.message);
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





// Start button handler
document.getElementById('startButton').addEventListener('click', async function(e) {
    e.preventDefault();
    if (!gameStarted) {
        this.textContent = 'Loading...';
        this.disabled = true;

		// Clear the game board before starting new game
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

        try {
            const response = await fetch('/speedwordle/start', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CSRF-Token': csrfToken
				},
				body: JSON.stringify({})  // Empty object since we don't need to send anything
			});

			if (!response.ok) throw new Error(data.details || 'Failed to start game');

            const data = await response.json();

			console.log('Game start response:', data);
            

            // Get game end time from server and start visual countdown
            gameEndTime = new Date(data.gameEndTime).getTime();
            startDisplayTimer();

			currentRow = 1;
            currentTile = 0;

            // Update game state and UI
            updateGameBoard(data.details);
            gameStarted = true;
			updateStartButtonState();
            this.classList.remove('btn-secondary');
            this.classList.add('btn-success');
            this.textContent = 'Game In Progress';

        } catch (error) {
            showMessage('Error', 'Failed to start game: ' + error);
            gameStarted = false;
            this.textContent = 'Start Game';
            this.disabled = false;
        }
    }
});


function endGame(data) {
    // Clear the display timer
    if (displayTimer) {
        clearInterval(displayTimer);
    }
    updateGameBoard(data.guesses);

    // Show the game result
    showGameResult(data);

    // Reset game state
    currentRow = 0;
    currentTile = 0;

	//Reset the game
    gameStarted = false;

	// Update the start button state when the game ends
	updateStartButtonState();
}

function showGameResult(data) {
    // Build the message to display in the modal
    const gameOverMessage = `
        <p>The answer was <strong>${data.answerWord.toUpperCase()}</strong></p>
        <p>${data.timeRemaining > 0 ? 
            `Time remaining: ${data.timeRemaining} seconds` : 
            'Time expired!'}</p>
    `;
    
    // Show the result modal
    showMessage('Game Over', gameOverMessage);

    // Show the "Start Game" button to restart the game
    document.getElementById('startButton').classList.remove('d-none');
    document.getElementById('startButton').disabled = false;  // Ensure button is clickable

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

async function checkRow() {
    if (currentTile === wordLength) {
        const guess = getCurrentGuess();

        try {
            const response = await fetch('/speedwordle/guess', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': csrfToken
                },
                body: JSON.stringify({ guess })
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle different error types
                switch (data.type) {
                    case 'invalid_word':
                        handleInvalidWord(getCurrentRow());
                        return;
                    
                    case 'game_expired':
                        endGame(data);
                        return;

                    case 'invalid_input':
                        showMessage('Error', data.message);
                        return;

                    default:
                        showMessage('Error', data.message || 'An unexpected error occurred');
                        return;
                }
            }

            // Success path
            if (data.gameOver) {
                endGame(data);
            } else {
                updateGameBoard(data.details);
                currentTile = 0;  // Reset for next word
                currentRow++;     // Move to the next row
            }

        } catch (error) {
            // Network or parsing errors
            console.error('Network or parsing error:', error);
            showMessage('Error', 'Failed to connect to server. Please try again.');
        }
    }
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

// Visual feedback for invalid word (shake animation)
function handleInvalidWord(row) {
    row.classList.add('shake');
    setTimeout(() => {
        row.classList.remove('shake');
    }, 500);

    // Allow editing again after invalid input
    currentTile = wordLength;
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

async function updateLeaderboard() {
    try {
        const response = await fetch('/speedwordle/leaderboard');
        if (!response.ok) throw new Error('Failed to fetch leaderboard');
        
        const data = await response.json();

		// Validate the response structure
		if (!Array.isArray(data)) {
			throw new Error('Invalid leaderboard data format');
		}

        const leaderboardBody = document.getElementById('leaderboardBody');
        leaderboardBody.innerHTML = data
            .map((entry, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td>${entry.playerName}</td>
                    <td>${entry.score}</td>
                    <td>${entry.timestamp}</td>
                </tr>
            `)
            .join('');
    } catch (error) {
        console.error('Error updating leaderboard:', error);
    }
}

