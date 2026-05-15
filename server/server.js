const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static client files from ../client
app.use(express.static(path.join(__dirname, '..', 'client')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// rooms: Map roomCode -> Set of ws
const rooms = new Map();

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }

    // registration: {t:'reg',room, name}
    if (msg.t === 'reg' && msg.room) {
      ws.room = msg.room;
      ws.name = msg.name;
      if (!rooms.has(ws.room)) rooms.set(ws.room, new Set());
      rooms.get(ws.room).add(ws);
      return;
    }

    const room = ws.room || msg.room;
    if (!room) return;
    const set = rooms.get(room);
    if (!set) return;

    // broadcast to others in same room
    for (const client of set) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(msg));
      }
    }
  });

  ws.on('close', () => {
    if (ws.room && rooms.has(ws.room)) {
      rooms.get(ws.room).delete(ws);
      if (rooms.get(ws.room).size === 0) rooms.delete(ws.room);
    }
  });
});

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
