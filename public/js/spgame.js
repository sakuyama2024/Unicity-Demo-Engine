let currentRow = 0
let currentTile = 0
let gameOver = false
let gameStarted = false
const wordLength = 5
let startWord
let answerWord
let agentGamePlay
let comparison
let walletConnected = false
let walletBalance = 100
let betsize = 20

// Initialize modal
const messageModal = new bootstrap.Modal(document.getElementById('messageModal'));

function showMessage(title, message) {
    const modal = document.getElementById('messageModal');
    modal.querySelector('.modal-title').textContent = title;
    modal.querySelector('.modal-body').innerHTML = message;
    messageModal.show();
}


console.log('Loading spgame.js - version:', Date.now());

// Check keyboard elements exist
const keyboard = document.getElementById('keyboard');
const startButton = document.getElementById('startButton');
console.log('Keyboard element:', keyboard);
console.log('Start button:', startButton);



let selectedCompetitor = 'beginner'

document.getElementById('competitor').addEventListener('change', function() {
	selectedCompetitor = this.value
})


document.getElementById('resetButton').addEventListener('click', function(e) {
	e.preventDefault()  // Since it's in a form
	resetGame()
	this.classList.add('d-none') // Hide reset button again
})

function updateBalanceDisplay(balance) {
    const balanceDiv = document.getElementById('walletBalance')
    balanceDiv.innerHTML = `<strong class="me-2">Balance:</strong><span class="balance-amount">${balance}</span><small class="ms-2 text-muted">ALPHA</small>`
}

document.getElementById('connectWallet').addEventListener('click', function() {
    if (!walletConnected) {
        // Simulate wallet connection
        walletConnected = true
        this.textContent = 'Wallet Connected';
        this.classList.replace('btn-outline-primary', 'btn-success')
        
        // Show balance
        const balanceDiv = document.getElementById('walletBalance')
        balanceDiv.classList.remove('d-none')
		updateBalanceDisplay(walletBalance)
	}
})

document.getElementById('startButton').addEventListener('click', async function(e) {
e.preventDefault()
	if (!gameStarted) {
		// Show loading state immediately
		this.textContent = 'Loading...'
		this.disabled = true  // Disable button during load
		this.classList.add('btn-secondary')  // change button appearance
		document.getElementById('competitor').disabled = true  // Disable difficulty selection during load

		// Get start word, answer word, agent gameplay and unicity proof from server
		try {
			gameStarted = true

			const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content')
			const response = await fetch('/speedwordle/start', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CSRF-Token': csrfToken 
				},
				body: JSON.stringify({
					competitor: selectedCompetitor
				})
			})

			const data = await response.json()
			console.log('Server response:', data);
		
			if (!response.ok) {
				throw new Error(data.details || data.error || 'Failed to start game')
			}
		
			if (!data.startWord) {
				throw new Error('Invalid game data received from server')
			}
							
			// Validate word lengths
			if (data.startWord.length !== 5) {
				throw new Error(`Invalid start word length: ${data.startWord.length}`)
			}
			
			console.log('Starting game with competitor:', selectedCompetitor)

			startWord = data.startWord

			// Populate first guess with startWord
			const firstRow = document.querySelector('#game-board > div > div:nth-child(1)')
			const tiles = firstRow.querySelectorAll('.letter-box')
			
			for(let i = 0; i < data.startWord.length; i++) {
				tiles[i].textContent = data.startWord[i]
				tiles[i].classList.add('filled-box')
			}
			currentTile = wordLength  // Set to end of row
			checkRow()

			// Success state - remove loading appearance and set to game state
			this.classList.remove('btn-secondary')
			this.classList.add('btn-success')  // Optional: show active game state
			this.textContent = 'Game In Progress'
			// Button stays disabled for game duration

		} catch (error) {
			console.error('Error starting game:', error)
			alert('Failed to start game: ' + error.message)
			gameStarted = false

			// Reset button to initial state
			this.classList.remove('btn-secondary')  // Remove loading appearance
			this.textContent = 'Start Game'
			this.disabled = false
			document.getElementById('competitor').disabled = false
		}		
	}
})

function showAgentGame() {
	console.log('Showing Agent game:', agentGamePlay);
	let delay = 0;

	// Display agent's moves with animation
	agentGamePlay.forEach((moveData, index) => {
		setTimeout(() => {
			const row = document.querySelector('#ai-board > div > div:nth-child(' + (index + 1) + ')');
			const tiles = row.querySelectorAll('.letter-box');
			
			// Fill in Agent's guess and colors
			for(let i = 0; i < moveData.word.length; i++) {
				tiles[i].textContent = moveData.word[i];
				tiles[i].classList.add('filled-box');
				
				if(moveData.result[i] === 2) {
					tiles[i].classList.add('correct');
				} else if(moveData.result[i] === 1) {
					tiles[i].classList.add('present');
				} else {
					tiles[i].classList.add('absent');
				}
			}

			// Show final result after all moves are displayed
			if (index === agentGamePlay.length - 1) {
				setTimeout(() => {
					showGameResult();
				}, 500);
			}
		}, delay);
		delay += 1000;
	});
}


function showGameResult() {
	console.log('Showing game result:',{comparison, answerWord});
	// Update balance if wallet connected
	if (walletConnected) {
		let balanceChange = 0
        let balanceMessage = ''

		// Check game outcome
        if (comparison.includes('Agent wins')) {
            balanceChange = -betsize
            balanceMessage = `<p class="text-danger">Lost ${betsize} ALPHA</p>`
        } else if (comparison.includes('You win')) {
            balanceChange = betsize
            balanceMessage = `<p class="text-success">Won ${betsize} ALPHA</p>`
        } else {
            // Draw - no balance change
            balanceMessage = '<p class="text-muted">Draw - No ALPHA change</p>'
        }

		// Only update balance if there was a win/loss
		if (balanceChange !== 0) {
			walletBalance += balanceChange
			updateBalanceDisplay(walletBalance)
		}

		const gameOverMessage = `
			<p>${comparison}</p>
			<p>The answer was <strong>${answerWord.toUpperCase()}</strong></p>
			${balanceMessage}
		`
		showMessage('Game Over', gameOverMessage)
	} else {

		const gameOverMessage = `
			<p>${comparison}</p>
			<p>The answer was <strong>${answerWord.toUpperCase()}</strong></p>
		`
		showMessage('Game Over', gameOverMessage);
	}
	document.getElementById('resetButton').classList.remove('d-none');
}

function addLetter(letter) {
	if (currentTile < wordLength && currentRow < 6) {
		const tile = document.querySelector('#game-board > div > div:nth-child(' + (currentRow + 1) + ') > div:nth-child(' + (currentTile + 1) + ')')
		tile.textContent = letter
		tile.classList.add('filled-box')
		currentTile++
	}
}

function deleteLetter() {
	if (currentTile > 0) {
		currentTile--
		const tile = document.querySelector('#game-board > div > div:nth-child(' + (currentRow + 1) + ') > div:nth-child(' + (currentTile + 1) + ')')
		tile.textContent = ''
		tile.classList.remove('filled-box')
	}
}


async function checkRow() {
	console.log('checkRow called', { currentTile, wordLength });
	if (currentTile === wordLength) {
		const row = document.querySelector('#game-board > div.d-flex.flex-column > div:nth-child(' + (currentRow + 1) + ')')
		const tiles = row.querySelectorAll('.letter-box')
		let guess = ''

		tiles.forEach((tile) => {
			guess += tile.textContent.toLowerCase()  // Make sure we're comparing in same case
		})

		try {
			const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content')
			const response = await fetch('/spgame/guess', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'CSRF-Token': csrfToken
				},
				body: JSON.stringify({
					guess,
					currentRow
				})
			});

			const data = await response.json();
			console.log('Server response:', data);  // Debug the full response

			if (!response.ok) {
				if (data.error === 'Invalid word') {
					handleInvalidWord(row);
					return;
				}
				throw new Error(data.error.details || 'Failed to validate guess');
			}
			
			// Validate data structure
			if (!data || !data.results) {
				console.error('Invalid server response:', data);
				throw new Error('Server returned invalid data structure');
			}

			if (!Array.isArray(data.results) || data.results.length !== 5) {
				console.error('Invalid results array:', data.results);
				throw new Error('Server returned invalid results format');
			}

			// Validate each result is a valid type
			const validTypes = ['absent', 'present', 'correct'];
			data.results.forEach((result, index) => {
				if (!validTypes.includes(result)) {
					console.error(`Invalid result type at position ${index}:`, result);
					throw new Error(`Invalid result type: ${result}`);
				}
			});

			console.log('Applying results:', data.results);  // Debug the results we're about to apply


			// Apply results from server
			data.results.forEach((result, i) => {
				tiles[i].classList.remove('absent', 'present', 'correct');
				tiles[i].classList.add(result);
			});

			if (data.gameOver) {
				setTimeout(() => {
					if (data.comparison) {
						comparison = data.comparison;
					}
					if (data.answerWord){
						answerWord = data.answerWord;
					}
					if (data.agentGamePlay) {
						agentGamePlay = data.agentGamePlay;
						showAgentGame();
					} else if (data.agentGamePlayError) {

						// Handle specific error from server
						showMessage('Game Over', 
							`<p>Agent not responding: <br> ${data.agentGamePlayError}</p>`
						);

						// Still show reset button even if agent play failed
						document.getElementById('resetButton').classList.remove('d-none');
					} else {
						// Unexpected case where neither gameplay nor error exists
						console.error('Missing agent gameplay data:', data);
						showMessage('Game Over', 
							`<p>Agent not repsonding: <br> ${data.agentGamePlayError}</p>`
						);
						
						document.getElementById('resetButton').classList.remove('d-none');
					}
				}, 500);
				gameOver = true;
			} else {
				currentRow = data.currentRow;  // Use server's row count
				currentTile = 0;
			}
		} catch (error) {
			console.error('Error:', error);
		}
	}	
}

document.addEventListener('keydown', function(e) {

	// Log full event details
	console.log('Keyboard event:', {
		key: e.key,
		repeat: e.repeat,
		target: e.target.tagName,
		gameOver,
		gameStarted,
		currentRow,
		currentTile
	});

	if (gameOver || !gameStarted ) return

	if (e.key === 'Enter') {
		checkRow()
	} else if (e.key === 'Backspace') {
		deleteLetter()
	} else if (/^[A-Za-z]$/.test(e.key)) {
		addLetter(e.key.toUpperCase())
	}
})

document.querySelectorAll('.key-box').forEach(function(key) {
	key.addEventListener('click', function() {
		if (gameOver || !gameStarted ) return

		const letter = key.getAttribute('data-key')
		if (letter === 'ENTER') {
			checkRow()
		} else if (letter === 'BACK') {
			deleteLetter()
		} else {
			addLetter(letter)
		}
	})
})

function handleInvalidWord(row) {
    // Visual feedback
    row.classList.add('shake');
    setTimeout(() => {
        row.classList.remove('shake');
    }, 500);
    
    // Reset state to allow editing
    currentTile = wordLength;
    console.log('Invalid word - reset for editing', { currentRow, currentTile });
}

function resetGame() {
	// Reset game state variables
	gameStarted = false
	gameOver = false
	currentRow = 0
	currentTile = 0
	startWord = ''
	agentGamePlay = null
	comparison = ''

	// Reset the game board
	const gameBoard = document.querySelector('#game-board')
	const aiBoard = document.querySelector('#ai-board')
	
	// Clear all tiles on both boards
	;[gameBoard, aiBoard].forEach(board => {
		if (!board) return
		const tiles = board.querySelectorAll('.letter-box')
		tiles.forEach(tile => {
			tile.textContent = ''
			tile.classList.remove('filled-box', 'correct', 'present', 'absent')
		})
	})

	// Reset the start button
	const startButton = document.getElementById('startButton')
	if (startButton) {
		startButton.textContent = 'Start Game'
		startButton.disabled = false
		startButton.classList.remove('btn-secondary', 'btn-success')
	}

	// Re-enable difficulty selection
	const competitor = document.getElementById('competitor')
	if (competitor) {
		competitor.disabled = false
	}

	if (walletConnected) {
        const walletBtn = document.getElementById('connectWallet');
        walletBtn.textContent = 'Wallet Connected';
        walletBtn.classList.replace('btn-outline-primary', 'btn-success');
        document.getElementById('walletBalance').classList.remove('d-none');
    }
}