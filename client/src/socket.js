import { io } from 'socket.io-client';
import { loadSession } from './session.js';

const useHttp = import.meta.env.VITE_TRANSPORT === 'http';

function createHttpSocket() {
  const listeners = new Map();
  let pollTimer = null;
  let polling = false;

  function emitLocal(event, payload) {
    for (const listener of listeners.get(event) || []) listener(payload);
  }

  async function post(action, payload = {}) {
    const session = loadSession();
    const response = await fetch('/.netlify/functions/game', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action,
        ...payload,
        code: payload.code || session?.code,
        token: payload.token || session?.token,
      }),
    });
    const result = await response.json();
    if (result.state) emitLocal('state', result.state);
    if (!result.ok && result.code === 'NOT_FOUND' && action === 'room:sync') emitLocal('room:left');
    return result;
  }

  async function poll() {
    if (polling || !loadSession()) return;
    polling = true;
    try {
      await post('room:sync');
    } catch {
      emitLocal('disconnect');
      socket.connected = false;
    } finally {
      polling = false;
    }
  }

  const socket = {
    connected: false,
    connect() {
      this.connected = true;
      emitLocal('connect');
      if (!pollTimer) pollTimer = setInterval(poll, 1200);
    },
    on(event, listener) {
      const list = listeners.get(event) || new Set();
      list.add(listener);
      listeners.set(event, list);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    once(event, listener) {
      const wrapped = (payload) => {
        this.off(event, wrapped);
        listener(payload);
      };
      this.on(event, wrapped);
    },
    emit(event, payload = {}, ack) {
      if (event === 'room:leave') {
        post('room:leave', payload)
          .then((result) => {
            emitLocal('room:left');
            ack?.(result);
          })
          .catch(() => ack?.({ ok: false, error: 'Unable to reach the server. Check your connection and try again.' }));
        return;
      }
      post(event, payload)
        .then((result) => {
          if (!result.ok) emitLocal('room:error', { message: result.error, code: result.code });
          ack?.(result);
        })
        .catch(() => {
          const error = 'Unable to reach the server. Check your connection and try again.';
          emitLocal('room:error', { message: error, code: 'NETWORK' });
          ack?.({ ok: false, error, code: 'NETWORK' });
        });
    },
  };

  return socket;
}

const socket = useHttp
  ? createHttpSocket()
  : io({
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
