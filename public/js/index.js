// Game state
let selectedGame = null
let playerName = ''

// DOM Elements
const playerNameInput = document.getElementById('playerName')
const startButton = document.getElementById('startGame')
const gameModes = ['playerVsModel', 'modelVsModel', 'speedWordle']

// Set up game mode selection
gameModes.forEach(mode => {
    const element = document.getElementById(mode)
    element.addEventListener('click', () => {
        // Remove active class from all modes
        gameModes.forEach(m => 
            document.getElementById(m).classList.remove('active'))
        
        // Add active class to selected mode
        element.classList.add('active')
        selectedGame = mode
        
        // Check if we can enable start button
        validateForm()
    })
})

// Name input validation
playerNameInput.addEventListener('input', () => {
    playerName = playerNameInput.value.trim()
    validateForm()
})

// Form validation
function validateForm() {
    if (playerName.length >= 3 && selectedGame) {
        startButton.classList.remove('disabled')
    } else {
        startButton.classList.add('disabled')
    }
}

// Handle game start
startButton.addEventListener('click', () => {
    if (playerName.length < 3 || !selectedGame) return

    // Store player name in session storage
    sessionStorage.setItem('playerName', playerName)

    // Redirect to appropriate game
    switch(selectedGame) {
        case 'playerVsModel':
            window.location.href = `/spgame?player=${encodeURIComponent(playerName)}`
            break
        case 'modelVsModel':
            window.location.href = `/spgame?player=${encodeURIComponent(playerName)}&mode=visualize`
            break
        case 'speedWordle':
            window.location.href = `/speedwordle?player=${encodeURIComponent(playerName)}`
            break
    }
})