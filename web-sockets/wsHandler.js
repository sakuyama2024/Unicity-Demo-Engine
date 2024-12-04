const WebSocket = require('ws');
const PlayervModelServer = require('./PlayervModelServer');
const SpeedWordleContestServer = require('./SpeedWordleContestServer');

const leaderboardManager = require('../app/leaderboard');  


function initializeWebSockets(server, sessionMiddleware) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', function connection(ws, req) {

        // Use sessionMiddleware to parse session before accessing it
        sessionMiddleware(req, {}, () => {
            if (!req.session || !req.session.id) {
                console.error('No session ID found, closing WebSocket connection');
                ws.close();
                return;
            }

            const sessionId = req.session.id;
            console.log(`WebSocket connection established with sessionId: ${sessionId}`);

            // Send initial leaderboard request
            ws.send(JSON.stringify({
                type: 'leaderboard_update',
                leaderboard: leaderboardManager.getLeaderboard()
            }));

            let activeServer = null;

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);                  
                    if (data.type === 'start_game') {
                        // Clean up previous game if exists
                        if (activeServer) {
                            activeServer.removeConnection(sessionId);
                        }
                        // Select server based on game type
                        switch (data.gameType) {
                            case 'playervModel':
                                activeServer = PlayervModelServer;
                                break;
                            case 'speedWordleContest':
                                activeServer = SpeedWordleContestServer;
                                break;
                            default:
                                console.warn('Unknown game type:', data.gameType);
                                return;
                        }

                        activeServer.addConnection(sessionId, ws);
                        activeServer.handleMessage(sessionId, data);
                        return;
                    }

                    if (!activeServer) {
                        console.warn('No game started yet');
                        return;
                    }

                    activeServer.handleMessage(sessionId, data);
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            });
            ws.on('close', () => {
                if (activeServer) {
                    activeServer.removeConnection(sessionId);
                }
            });
        });
    });

    return wss;
}

module.exports = initializeWebSockets; 