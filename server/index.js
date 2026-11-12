import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomManager } from './game.js';

const PORT = Number(process.env.PORT) || 3011;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rooms = new RoomManager();
const app = express();
app.use(cors({ origin: true }));
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/socket.io') || req.path.startsWith('/health')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (error) => {
      if (error) next();
    });
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true },
});

function broadcast(code) {
  if (!code) return;
  const room = rooms.getRoom(code);
  if (!room) return;
  const now = Date.now();
  for (const player of room.players) {
    if (!player.connected || !player.socketId) continue;
    const socket = io.sockets.sockets.get(player.socketId);
    if (!socket) continue;
    const view = rooms.viewFor(player.socketId, now);
    if (view) socket.emit('state', view);
  }
}

function ackResult(socket, result, ack) {
  if (!result.ok) {
    socket.emit('room:error', { message: result.error, code: result.code });
    ack?.({ ok: false, error: result.error, code: result.code });
    return;
  }
  if (result.displacedSocketId) {
    const displaced = io.sockets.sockets.get(result.displacedSocketId);
    displaced?.leave(result.code);
    displaced?.emit('room:replaced');
  }
  if (result.code) socket.join(result.code);
  ack?.({ ok: true, token: result.token, code: result.code });
  broadcast(result.broadcast);
}

function on(socket, event, handler) {
  socket.on(event, (payload = {}, ack) => {
    try {
      const result = handler(payload);
      if (!result) {
        ack?.({ ok: true });
        return;
      }
      ackResult(socket, result, ack);
    } catch (error) {
      console.error(event, error);
      const message = 'Unable to complete that action. Try again.';
      socket.emit('room:error', { message, code: 'SERVER' });
      ack?.({ ok: false, error: message, code: 'SERVER' });
    }
  });
}

io.on('connection', (socket) => {
  on(socket, 'room:create', ({ name }) => rooms.createRoom({ name, socketId: socket.id }));
  on(socket, 'room:join', ({ code, name }) => rooms.joinRoom({ code, name, socketId: socket.id }));
  on(socket, 'room:rejoin', ({ code, token }) => rooms.rejoin({ code, token, socketId: socket.id }));
  on(socket, 'seat:claim', ({ team, role }) => rooms.claimSeat({ socketId: socket.id, team, role }));
  on(socket, 'seat:leave', () => rooms.leaveSeat({ socketId: socket.id }));
  on(socket, 'settings:update', (payload) => rooms.updateSettings({ socketId: socket.id, ...payload }));
  on(socket, 'game:start', () => rooms.startGame({ socketId: socket.id }));
  on(socket, 'clue:give', ({ word, number }) => rooms.giveClue({ socketId: socket.id, word, number }));
  on(socket, 'card:suggest', ({ cardId }) => rooms.toggleSuggestion({ socketId: socket.id, cardId }));
  on(socket, 'card:reveal', ({ cardId }) => rooms.revealCard({ socketId: socket.id, cardId }));
  on(socket, 'turn:end', () => rooms.endGuessing({ socketId: socket.id }));

  socket.on('room:leave', (payload, ack) => {
    const code = rooms.leave(socket.id);
    socket.leave(code || '');
    ack?.({ ok: true });
    socket.emit('room:left');
    broadcast(code);
  });

  socket.on('disconnect', () => {
    const code = rooms.disconnect(socket.id);
    broadcast(code);
  });
});

setInterval(() => {
  const changed = rooms.tick(Date.now());
  for (const code of changed) broadcast(code);
}, 500);

if (process.env.NETLIFY) {
  console.log('Codewords server will listen on the port Netlify assigns.');
} else if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Codewords server listening on http://127.0.0.1:${PORT}`);
  });
}

export { app, httpServer, io, rooms };
