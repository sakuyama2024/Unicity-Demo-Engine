// leaderboard.js
const fs = require('fs').promises
const path = require('path')
const debug = require("debug")
const debugLog = debug("btcexp:leaderboard")

class LeaderboardManager {
    constructor() {
        this.leaderboardFile = path.join(__dirname, 'leaderboard.json')
        this.leaderboard = []
        this.maxEntries = 10
        this.loadLeaderboard()
    }

    async loadLeaderboard() {
        try {
            const data = await fs.readFile(this.leaderboardFile, 'utf8')
            this.leaderboard = JSON.parse(data)
            debugLog('Leaderboard loaded successfully')
        } catch (error) {
            debugLog('No existing leaderboard found, starting fresh')
            this.leaderboard = []
            await this.saveLeaderboard()
        }
    }

    async saveLeaderboard() {
        try {
            await fs.writeFile(this.leaderboardFile, JSON.stringify(this.leaderboard, null, 2))
            debugLog('Leaderboard saved successfully')
        } catch (error) {
            debugLog('Error saving leaderboard:', error)
        }
    }

    async addScore(playerName, gameTime) {
        const entry = {
            playerName,
            gameTime: gameTime.toFixed(2),  
            timestamp: new Date().toLocaleDateString() 
        }
        
        this.leaderboard.push(entry)
        // Sort by gameTime (lowest first) and take top 10
        this.leaderboard.sort((a, b) => a.gameTime - b.gameTime)
        this.leaderboard = this.leaderboard.slice(0, this.maxEntries)
        
        await this.saveLeaderboard()
        return this.leaderboard
    }

    async resetLeaderboard() {
        this.leaderboard = []
        await this.saveLeaderboard()
        debugLog('Leaderboard reset successfully')
    }

    getLeaderboard() {
        return this.leaderboard
    }

    // Check if the gameTime qualifies to be added to the leaderboard
    checkScoreQualification(gameTime) {
        // If leaderboard is not full or the player's time is better than the last player
        return this.leaderboard.length < this.maxEntries || gameTime < this.leaderboard[this.leaderboard.length - 1].gameTime;
    }
}

// Export a singleton instance
module.exports = new LeaderboardManager();  