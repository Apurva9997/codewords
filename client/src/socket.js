import { io } from 'socket.io-client';

const socket = io({
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  timeout: 8000,
});

export function request(event, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response) => {
      resolve(response || { ok: false, error: 'No response from the server.' });
    });
  });
}

export default socket;
