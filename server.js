const WebSocket = require('ws');
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store rooms and connections
const rooms = new Map();

console.log('WebSocket server starting...');

// KEEP-ALIVE: Ping self every 10 minutes to prevent sleep
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://camera-stream-server-hhwe.onrender.com';

setInterval(() => {
    https.get(RENDER_URL, (res) => {
        console.log(`✅ Keep-alive ping successful: ${res.statusCode} at ${new Date().toISOString()}`);
    }).on('error', (err) => {
        console.error(`❌ Keep-alive ping failed: ${err.message}`);
    });
}, 10 * 60 * 1000); // Every 10 minutes

wss.on('connection', (ws) => {
    console.log('New client connected');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, roomCode } = data;
            
            if (type === 'join') {
                // Join room
                if (!rooms.has(roomCode)) {
                    rooms.set(roomCode, new Set());
                }
                rooms.get(roomCode).add(ws);
                ws.roomCode = roomCode;
                console.log(`Client joined room: ${roomCode}, Total rooms: ${rooms.size}`);
                
                // Notify all clients in room about new connection
                broadcastToRoom(roomCode, {
                    type: 'user_joined',
                    roomCode: roomCode,
                    message: 'User joined the room'
                }, ws);
                
            } else if (type === 'frame' && roomCode) {
                // Broadcast frame to all other clients in the same room
                broadcastToRoom(roomCode, data, ws);
            }
        } catch (e) {
            console.error('Invalid message:', e);
        }
    });
    
    ws.on('close', () => {
        // Remove from room when disconnecting
        if (ws.roomCode && rooms.has(ws.roomCode)) {
            rooms.get(ws.roomCode).delete(ws);
            if (rooms.get(ws.roomCode).size === 0) {
                rooms.delete(ws.roomCode);
                console.log(`Room ${ws.roomCode} deleted (empty)`);
            }
        }
        console.log('Client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Broadcast message to all clients in a room except sender
function broadcastToRoom(roomCode, data, sender) {
    if (rooms.has(roomCode)) {
        const room = rooms.get(roomCode);
        let sent = 0;
        
        room.forEach(client => {
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
                sent++;
            }
        });
        
        // Log frame broadcast (only log every 50 frames to avoid spam)
        if (data.type === 'frame' && Math.random() < 0.02) {
            console.log(`📹 Broadcasting frame to ${sent} clients in room ${roomCode}`);
        }
    }
}

server.listen(PORT, () => {
    console.log(`✅ WebSocket server running on port ${PORT}`);
    console.log(`🔄 Keep-alive enabled - server will ping itself every 10 minutes`);
    console.log(`🌐 External URL: ${RENDER_URL}`);
});
