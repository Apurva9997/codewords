import { useEffect, useState } from 'react';
import Lobby from './components/Lobby.jsx';
import Room from './components/Room.jsx';
import { clearSession, loadSession, saveSession } from './session.js';
import socket, { request } from './socket.js';

export default function App() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(socket.connected);
  const [booting, setBooting] = useState(true);
  const [lobbyError, setLobbyError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onState(next) {
      setState(next);
      setBooting(false);
      setLobbyError('');
    }
    function onConnect() {
      setConnected(true);
      const session = loadSession();
      if (!session) {
        setBooting(false);
        return;
      }
      request('room:rejoin', session).then((result) => {
        if (!result.ok) {
          clearSession();
          setState(null);
          setLobbyError(result.error || 'That room is no longer available. Create or join a room.');
          setBooting(false);
        }
      });
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onError(payload) {
      setActionError(payload?.message || 'Unable to complete that action.');
      setBooting(false);
    }
    function onLeft() {
      clearSession();
      setState(null);
      setActionError('');
    }
    function onReplaced() {
      clearSession();
      setState(null);
      setLobbyError('You joined this room in another tab. This tab was disconnected.');
    }

    socket.on('state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:error', onError);
    socket.on('room:left', onLeft);
    socket.on('room:replaced', onReplaced);
    socket.connect();

    return () => {
      socket.off('state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:error', onError);
      socket.off('room:left', onLeft);
      socket.off('room:replaced', onReplaced);
    };
  }, []);

  async function enter(event, payload) {
    setBusy(true);
    setLobbyError('');
    try {
      await waitForConnect();
      const result = await request(event, payload);
      if (!result.ok) {
        setLobbyError(result.error || 'Unable to enter the room.');
        return;
      }
      saveSession({ code: result.code, token: result.token });
    } catch (error) {
      setLobbyError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(event, payload) {
    setActionError('');
    const result = await request(event, payload);
    if (!result.ok) setActionError(result.error || 'Unable to complete that action.');
    return result;
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(state.code);
    } catch {
      setActionError('Unable to copy the room code. Select the code and copy it yourself.');
    }
  }

  async function leaveRoom() {
    await request('room:leave', {});
    clearSession();
    setState(null);
    setActionError('');
  }

  if (booting && !state) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <p className="text-slate-300">Connecting to your room...</p>
      </main>
    );
  }

  if (!state) {
    return (
      <Lobby
        busy={busy}
        error={lobbyError}
        onCreate={(name) => enter('room:create', { name })}
        onJoin={(code, name) => enter('room:join', { code, name })}
      />
    );
  }

  return (
    <>
      {!connected && (
        <p className="bg-amber-200 px-4 py-2 text-center text-sm font-medium text-cream-ink">
          Connection lost. Reconnecting...
        </p>
      )}
      <Room
        state={state}
        actionError={actionError}
        onCopy={copyCode}
        onClaim={(team, role) => act('seat:claim', { team, role })}
        onLeaveSeat={() => act('seat:leave', {})}
        onStart={(customWords) => startGame(customWords, act)}
        onClue={(clue) => act('clue:give', clue)}
        onSuggest={(cardId) => act('card:suggest', { cardId })}
        onReveal={(cardId) => act('card:reveal', { cardId })}
        onEnd={() => act('turn:end', {})}
        onTimer={(settings) => act('settings:update', settings)}
        onSaveCustom={(customWords) => act('settings:update', { customWords })}
        onLeave={leaveRoom}
      />
    </>
  );
}

async function startGame(customWords, act) {
  if (typeof customWords === 'string') {
    const saved = await act('settings:update', { customWords });
    if (!saved.ok) return saved;
  }
  return act('game:start', {});
}

function waitForConnect() {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('connect', onConnect);
      reject(new Error('Unable to reach the server. Check that it is running and try again.'));
    }, 8000);
    function onConnect() {
      clearTimeout(timer);
      resolve();
    }
    socket.once('connect', onConnect);
    socket.connect();
  });
}
