const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store rooms and connections
const rooms = new Map();

console.log('WebSocket server starting...');

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
        console.log(`Client joined room: ${roomCode}`);
        
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
    rooms.get(roomCode).forEach(client => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
