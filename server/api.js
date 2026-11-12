import { RoomManager, serializeRoom } from './game.js';

const ACTIONS = {
  'room:create': (manager, body, socketId) => manager.createRoom({ name: body.name, socketId }),
  'room:join': (manager, body, socketId) => manager.joinRoom({
    code: body.code,
    name: body.name,
    socketId,
  }),
  'room:rejoin': (manager, body, socketId) => manager.rejoin({
    code: body.code,
    token: body.token,
    socketId,
  }),
  'seat:claim': (manager, body, socketId) => manager.claimSeat({
    socketId,
    team: body.team,
    role: body.role,
  }),
  'seat:leave': (manager, _body, socketId) => manager.leaveSeat({ socketId }),
  'settings:update': (manager, body, socketId) => manager.updateSettings({
    socketId,
    timerEnabled: body.timerEnabled,
    timerSeconds: body.timerSeconds,
    customWords: body.customWords,
  }),
  'game:start': (manager, _body, socketId) => manager.startGame({ socketId }),
  'clue:give': (manager, body, socketId) => manager.giveClue({
    socketId,
    word: body.word,
    number: body.number,
  }),
  'card:suggest': (manager, body, socketId) => manager.toggleSuggestion({
    socketId,
    cardId: body.cardId,
  }),
  'card:reveal': (manager, body, socketId) => manager.revealCard({
    socketId,
    cardId: body.cardId,
  }),
  'turn:end': (manager, _body, socketId) => manager.endGuessing({ socketId }),
};

export function exportRooms(manager) {
  return [...manager.rooms.values()].map((room) => ({
    ...room,
    players: room.players.map((player) => ({ ...player, socketId: null })),
  }));
}

export function importRooms(manager, rooms) {
  manager.rooms = new Map();
  manager.socketIndex = new Map();
  for (const room of rooms || []) manager.rooms.set(room.code, room);
}

export async function updateRooms(store, mutator) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await store.getWithMetadata('rooms', {
      type: 'json',
      consistency: 'strong',
    });
    const next = await mutator(current?.data ?? []);
    const options = current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true };
    const written = await store.setJSON('rooms', next, options);
    if (written.modified) return next;
  }
  throw new Error('The room changed while saving. Try again.');
}

export async function handleGameRequest(req, store, now = Date.now()) {
  if (req.method === 'GET') return Response.json({ ok: true });
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'Use POST.' }, { status: 405 });

  let body = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Send a JSON body.' }, { status: 400 });
  }

  const action = body.action;
  if (action === 'room:leave') {
    return leaveRoom(store, body, now);
  }
  if (action !== 'room:sync' && !ACTIONS[action]) {
    return Response.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
  }

  try {
    let response = null;
    await updateRooms(store, async (saved) => {
      const manager = new RoomManager({ now: () => now });
      importRooms(manager, saved);
      manager.tick(now);
      response = action === 'room:sync'
        ? syncRoom(manager, body, now)
        : runAction(manager, body, now);
      return exportRooms(manager);
    });
    return Response.json(response);
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message || 'Unable to complete that action. Try again.',
      code: 'SERVER',
    }, { status: 500 });
  }
}

async function leaveRoom(store, body, now) {
  let response = { ok: true };
  await updateRooms(store, async (saved) => {
    const manager = new RoomManager({ now: () => now });
    importRooms(manager, saved);
    const room = manager.getRoom(String(body.code || '').toUpperCase());
    const player = room?.players.find((entry) => entry.token === body.token);
    if (room && player) {
      const socketId = `http:${player.publicId}`;
      manager.bindSocket(room, player, socketId);
      manager.leave(socketId);
    }
    response = { ok: true };
    return exportRooms(manager);
  });
  return Response.json(response);
}

function runAction(manager, body, now) {
  const socketId = `http:${body.clientId || body.token || 'guest'}`;
  if (body.token && body.code && body.action !== 'room:create' && body.action !== 'room:join') {
    const bound = bindToken(manager, body.code, body.token, socketId);
    if (!bound && body.action !== 'room:rejoin') {
      return {
        ok: false,
        error: 'That room is no longer available. Create or join a room.',
        code: 'NOT_FOUND',
      };
    }
  }
  const result = ACTIONS[body.action](manager, body, socketId);
  if (!result.ok) return { ok: false, error: result.error, code: result.code };
  const viewer = result.player;
  return {
    ok: true,
    token: result.token,
    code: result.code,
    state: serializeRoom(result.room, viewer, now),
  };
}

function syncRoom(manager, body, now) {
  const socketId = `http:${body.clientId || body.token || 'guest'}`;
  const bound = bindToken(manager, body.code, body.token, socketId);
  if (!bound) {
    return {
      ok: false,
      error: 'That room is no longer available. Create or join a room.',
      code: 'NOT_FOUND',
    };
  }
  return {
    ok: true,
    code: bound.room.code,
    token: bound.player.token,
    state: serializeRoom(bound.room, bound.player, now),
  };
}

function bindToken(manager, code, token, socketId) {
  const room = manager.getRoom(String(code || '').trim().toUpperCase());
  if (!room || !token) return null;
  const player = room.players.find((entry) => entry.token === token);
  if (!player) return null;
  manager.bindSocket(room, player, socketId);
  return { room, player };
}
