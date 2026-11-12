import crypto from 'node:crypto';
import { WORDS } from './words.js';

export const TEAMS = ['RED', 'BLUE'];
export const ROLES = ['SPYMASTER', 'OPERATIVE'];
export const TIMER_CHOICES = [30, 60, 90, 120];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMPTY_ROOM_MS = 30 * 60 * 1000;
const MAX_ROOMS = 200;
const MAX_PLAYERS = 16;
const MAX_CUSTOM = 80;

export function teamLabel(team) {
  return team === 'RED' ? 'Red' : 'Blue';
}

export function otherTeam(team) {
  return team === 'RED' ? 'BLUE' : 'RED';
}

export function shuffle(list, random = Math.random) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function normalizeToken(raw) {
  return String(raw || '')
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function normalizeName(raw) {
  const name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 16) return null;
  if (!/^[\p{L}\p{N} '.-]+$/u.test(name)) return null;
  return name;
}

export function parseCustomWords(raw) {
  const parts = Array.isArray(raw) ? raw : String(raw || '').split(/[\s,]+/);
  const words = [];
  const seen = new Set();
  for (const part of parts) {
    if (!String(part).trim()) continue;
    const word = normalizeToken(part);
    if (word.length < 3 || word.length > 16) {
      return {
        ok: false,
        error: `"${String(part).trim()}" is not a usable word. Use 3 to 16 letters.`,
      };
    }
    if (seen.has(word)) continue;
    seen.add(word);
    words.push(word);
    if (words.length > MAX_CUSTOM) {
      return { ok: false, error: `Save at most ${MAX_CUSTOM} custom words.` };
    }
  }
  return { ok: true, words };
}

export function selectWords(dictionary, custom, count, random = Math.random) {
  const picked = [];
  const seen = new Set();
  for (const word of shuffle(custom, random)) {
    if (picked.length >= count) break;
    if (seen.has(word)) continue;
    seen.add(word);
    picked.push(word);
  }
  const filler = shuffle(
    dictionary.filter((word) => !seen.has(word)),
    random,
  );
  for (const word of filler) {
    if (picked.length >= count) break;
    picked.push(word);
    seen.add(word);
  }
  if (picked.length < count) {
    throw new Error('Not enough words to build a board.');
  }
  return shuffle(picked, random);
}

export function buildBoard(dictionary, custom, random = Math.random) {
  const startingTeam = random() < 0.5 ? 'RED' : 'BLUE';
  const second = otherTeam(startingTeam);
  const types = shuffle(
    [
      ...Array(9).fill(startingTeam),
      ...Array(8).fill(second),
      ...Array(7).fill('BYSTANDER'),
      'ASSASSIN',
    ],
    random,
  );
  const words = selectWords(dictionary, custom, 25, random);
  return {
    startingTeam,
    cards: words.map((word, id) => ({
      id,
      word,
      type: types[id],
      revealed: false,
      suggestions: [],
    })),
  };
}

export function remainingOf(cards, team) {
  return cards.filter((card) => card.type === team && !card.revealed).length;
}

export function normalizeClue(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { ok: false, error: 'Enter a clue.' };
  if (/\s/.test(trimmed)) {
    return { ok: false, error: 'Enter a single word with no spaces.' };
  }
  const word = trimmed.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
  if (!/^[A-Z]{2,20}$/.test(word)) {
    return { ok: false, error: 'Use 2 to 20 letters, with no spaces or punctuation.' };
  }
  return { ok: true, word };
}

/**
 * Case-insensitive substring check against every unrevealed board word.
 * Fails when the clue contains a board word or a board word contains the clue.
 */
export function clueConflicts(clue, cards) {
  const needle = clue.toLowerCase();
  for (const card of cards) {
    if (card.revealed) continue;
    const word = card.word.toLowerCase();
    if (word.includes(needle) || needle.includes(word)) return card.word;
  }
  return null;
}

export function parseClueNumber(value) {
  if (value === 'unlimited' || value === '∞') {
    return { unlimited: true, number: null };
  }
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(number) || number < 0 || number > 9) return null;
  return { unlimited: number === 0, number };
}

export function allowanceFor(parsed) {
  if (parsed.unlimited) return null;
  return parsed.number + 1;
}

export function clueNumberLabel(parsed) {
  if (parsed.unlimited && parsed.number == null) return '∞';
  return String(parsed.number);
}

function cardResultLabel(type) {
  if (type === 'RED') return 'Red Agent';
  if (type === 'BLUE') return 'Blue Agent';
  if (type === 'ASSASSIN') return 'Assassin';
  return 'Bystander';
}

function toneForType(type) {
  if (type === 'RED') return 'red';
  if (type === 'BLUE') return 'blue';
  if (type === 'ASSASSIN') return 'assassin';
  return 'bystander';
}

function makeCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

function makeToken() {
  return crypto.randomBytes(18).toString('hex');
}

function makePublicId() {
  return crypto.randomBytes(4).toString('hex');
}

export function serializeRoom(room, viewer, serverNow) {
  const canSeeKey = viewer.role === 'SPYMASTER' || room.phase === 'GAME_OVER';
  const board = room.board.map((card) => {
    const payload = {
      id: card.id,
      word: card.word,
      revealed: card.revealed,
      suggestions: card.suggestions.map((mark) => ({
        playerId: mark.playerId,
        name: mark.name,
        team: mark.team,
      })),
    };
    if (card.revealed || canSeeKey) payload.type = card.type;
    return payload;
  });

  return {
    code: room.code,
    phase: room.phase,
    hostId: room.players.find((player) => player.token === room.hostToken)?.publicId ?? null,
    startingTeam: room.startingTeam,
    activeTeam: room.activeTeam,
    currentClue: room.currentClue,
    guessesRemaining: room.guessesRemaining,
    guessesMadeThisTurn: room.guessesMadeThisTurn,
    remaining: {
      RED: remainingOf(room.board, 'RED'),
      BLUE: remainingOf(room.board, 'BLUE'),
    },
    winner: room.winner,
    winReason: room.winReason,
    timerEnabled: room.timerEnabled,
    timerSeconds: room.timerSeconds,
    turnDeadline: room.turnDeadline,
    serverNow,
    customWords: room.customWords,
    log: room.log,
    history: room.history,
    players: room.players.map((player) => ({
      publicId: player.publicId,
      name: player.name,
      team: player.team,
      role: player.role,
      connected: player.connected,
      isHost: player.token === room.hostToken,
      isYou: player.publicId === viewer.publicId,
    })),
    you: {
      publicId: viewer.publicId,
      name: viewer.name,
      team: viewer.team,
      role: viewer.role,
      isHost: viewer.token === room.hostToken,
    },
    board,
  };
}

export class RoomManager {
  constructor({ words = WORDS, now = () => Date.now(), random = Math.random } = {}) {
    this.words = words;
    this.now = now;
    this.random = random;
    this.rooms = new Map();
    this.socketIndex = new Map();
  }

  createRoom({ name, socketId }) {
    const cleaned = normalizeName(name);
    if (!cleaned) return fail('Enter a name using 1 to 16 characters.');
    this.evictIdle();
    if (this.rooms.size >= MAX_ROOMS) {
      return fail('The server is full. Try again in a few minutes.');
    }
    let code = makeCode(this.random);
    for (let attempt = 0; attempt < 20 && this.rooms.has(code); attempt += 1) {
      code = makeCode(this.random);
    }
    if (this.rooms.has(code)) return fail('Unable to create a room. Try again.');

    const player = this.makePlayer({ name: cleaned, socketId });
    const room = {
      code,
      hostToken: player.token,
      players: [player],
      phase: 'LOBBY',
      board: [],
      startingTeam: null,
      activeTeam: null,
      currentClue: null,
      guessesRemaining: null,
      guessesMadeThisTurn: 0,
      winner: null,
      winReason: null,
      timerEnabled: false,
      timerSeconds: 60,
      turnDeadline: null,
      customWords: [],
      log: [],
      logSeq: 1,
      history: [],
      createdAt: this.now(),
      lastConnectedAt: this.now(),
    };
    this.rooms.set(code, room);
    this.socketIndex.set(socketId, { code, publicId: player.publicId });
    this.addLog(room, 'system', `${cleaned} created the room.`);
    return ok(room, player);
  }

  joinRoom({ code, name, socketId }) {
    const cleaned = normalizeName(name);
    if (!cleaned) return fail('Enter a name using 1 to 16 characters.');
    const room = this.rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return fail('No room found for that code. Check the code and try again.', 'NOT_FOUND');
    if (room.players.length >= MAX_PLAYERS) {
      return fail('This room is full. Join a different room.');
    }
    const taken = room.players.find(
      (player) => player.name.toLowerCase() === cleaned.toLowerCase() && player.connected,
    );
    if (taken) return fail('That name is already in this room. Pick another name.', 'CONFLICT');

    const offline = room.players.find(
      (player) => player.name.toLowerCase() === cleaned.toLowerCase() && !player.connected,
    );
    if (offline) {
      const displacedSocketId = this.bindSocket(room, offline, socketId);
      this.addLog(room, 'system', `${offline.name} reconnected.`);
      return ok(room, offline, { displacedSocketId });
    }

    const player = this.makePlayer({ name: cleaned, socketId });
    room.players.push(player);
    this.socketIndex.set(socketId, { code: room.code, publicId: player.publicId });
    room.lastConnectedAt = this.now();
    this.addLog(room, 'system', `${cleaned} joined the room.`);
    return ok(room, player);
  }

  rejoin({ code, token, socketId }) {
    const room = this.rooms.get(String(code || '').trim().toUpperCase());
    if (!room) {
      return fail('That room is no longer available. Create or join a room.', 'NOT_FOUND');
    }
    const player = room.players.find((entry) => entry.token === token);
    if (!player) {
      return fail('That seat is no longer available. Join the room again.', 'NOT_FOUND');
    }
    const displacedSocketId = this.bindSocket(room, player, socketId);
    return ok(room, player, { displacedSocketId });
  }

  disconnect(socketId) {
    const located = this.locate(socketId);
    if (!located) return null;
    const { room, player } = located;
    if (player.socketId !== socketId) return room.code;
    player.connected = false;
    player.socketId = null;
    this.socketIndex.delete(socketId);
    if (!room.players.some((entry) => entry.connected)) {
      room.lastConnectedAt = this.now();
    }
    return room.code;
  }

  leave(socketId) {
    const located = this.locate(socketId);
    if (!located) return null;
    const { room, player } = located;
    this.removePlayer(room, player);
    this.socketIndex.delete(socketId);
    if (room.players.length === 0) {
      this.rooms.delete(room.code);
      return null;
    }
    return room.code;
  }

  claimSeat({ socketId, team, role }) {
    const located = this.requirePlayer(socketId);
    if (!located.ok) return located;
    const { room, player } = located;
    if (!TEAMS.includes(team) || !ROLES.includes(role)) {
      return fail('Pick a team and a role.');
    }
    if (player.team === team && player.role === role) return ok(room, player);

    if (role === 'SPYMASTER') {
      const occupant = room.players.find(
        (entry) => entry.team === team && entry.role === 'SPYMASTER' && entry.publicId !== player.publicId,
      );
      if (occupant?.connected) {
        return fail(
          `The ${teamLabel(team)} Spymaster seat is taken. Join as an operative, or switch to ${teamLabel(otherTeam(team))}.`,
          'CONFLICT',
        );
      }
      if (occupant && !occupant.connected) occupant.role = 'OPERATIVE';
    }

    player.team = team;
    player.role = role;
    this.addLog(
      room,
      'system',
      `${player.name} joined ${teamLabel(team)} as ${role === 'SPYMASTER' ? 'Spymaster' : 'Operative'}.`,
    );
    return ok(room, player);
  }

  leaveSeat({ socketId }) {
    const located = this.requirePlayer(socketId);
    if (!located.ok) return located;
    const { room, player } = located;
    if (!player.team) return ok(room, player);
    player.team = null;
    player.role = null;
    this.addLog(room, 'system', `${player.name} left their seat.`);
    return ok(room, player);
  }

  updateSettings({ socketId, timerEnabled, timerSeconds, customWords }) {
    const located = this.requirePlayer(socketId);
    if (!located.ok) return located;
    const { room, player } = located;
    const hostError = this.assertHost(room, player);
    if (hostError) return fail(hostError, 'FORBIDDEN');

    if (timerEnabled !== undefined) {
      room.timerEnabled = Boolean(timerEnabled);
    }
    if (timerSeconds !== undefined) {
      const seconds = Number(timerSeconds);
      if (!TIMER_CHOICES.includes(seconds)) {
        return fail('Choose a turn timer of 30, 60, 90, or 120 seconds.');
      }
      room.timerSeconds = seconds;
    }
    if (customWords !== undefined) {
      const parsed = parseCustomWords(customWords);
      if (!parsed.ok) return fail(parsed.error);
      room.customWords = parsed.words;
    }
    if (room.timerEnabled && (room.phase === 'SPYMASTER_CLUE' || room.phase === 'OPERATIVE_GUESS')) {
      this.armTimer(room);
    } else if (!room.timerEnabled) {
      room.turnDeadline = null;
    }
    return ok(room, player);
  }

  startGame({ socketId }) {
    const located = this.requirePlayer(socketId);
    if (!located.ok) return located;
    const { room, player } = located;
    const hostError = this.assertHost(room, player);
    if (hostError) return fail(hostError, 'FORBIDDEN');
    const gaps = this.staffingGaps(room);
    if (gaps.length) {
      return fail(`Each team needs a Spymaster and at least one operative. ${gaps.join('. ')}.`);
    }
    this.deal(room);
    this.addLog(room, 'system', `${teamLabel(room.startingTeam)} starts. The board is set.`);
    return ok(room, player);
  }

  giveClue({ socketId, word, number }) {
    const located = this.requirePlayer(socketId);
    if (!located.ok) return located;
    const { room, player } = located;
    if (room.phase !== 'SPYMASTER_CLUE') {
      return fail('Wait until it is time to give a clue.');
    }
    if (player.team !== room.activeTeam || player.role !== 'SPYMASTER') {
      return fail('Only the active Spymaster can give a clue.', 'FORBIDDEN');
    }
    const parsedWord = normalizeClue(word);
    if (!parsedWord.ok) return fail(parsedWord.error);
    const parsedNumber = parseClueNumber(number);
    if (!parsedNumber) return fail('Choose a clue number from 0 to 9, or Unlimited.');
    const conflict = clueConflicts(parsedWord.word, room.board);
    if (conflict) {
      return fail(`That clue overlaps ${conflict}, which is still hidden. Choose a different word.`);
    }

    const label = clueNumberLabel(parsedNumber);
    room.currentClue = {
      word: parsedWord.word,
      number: parsedNumber.number,
      unlimited: parsedNumber.unlimited,
      label,
    };
    room.guessesRemaining = allowanceFor(parsedNumber);
    room.guessesMadeThisTurn = 0;
    room.phase = 'OPERATIVE_GUESS';
    this.clearSuggestions(room);
    this.armTimer(room);
    this.addLog(
      room,
      room.activeTeam === 'RED' ? 'red' : 'blue',
      `${teamLabel(room.activeTeam)} Spymaster gave clue: ${parsedWord.word} ${label}`,
    );
    return ok(room, player);
  }

  toggleSuggestion({ socketId, cardId }) {
    const located = this.requirePlayer(socketId);
    if (!located.ok) return located;
    const { room, player } = located;
    if (room.phase !== 'OPERATIVE_GUESS') {
      return fail('Suggestions open when operatives are guessing.');
    }
    if (player.team !== room.activeTeam || player.role !== 'OPERATIVE') {
      return fail('Only an operative on the active team can mark a card.', 'FORBIDDEN');
    }
    const card = this.card(room, cardId);
    if (!card) return fail('That card is not on the board.');
    if (card.revealed) return fail('That card is already revealed.');

    const index = card.suggestions.findIndex((mark) => mark.playerId === player.publicId);
    if (index >= 0) card.suggestions.splice(index, 1);
    else {
      card.suggestions.push({
        playerId: player.publicId,
        name: player.name,
        team: player.team,
      });
    }
    return ok(room, player);
  }

  revealCard({ socketId, cardId }) {
    const located = this.requirePlayer(socketId);
    if (!located.ok) return located;
    const { room, player } = located;
    if (room.phase !== 'OPERATIVE_GUESS') {
      return fail('Wait for a clue before revealing a card.');
    }
    if (player.team !== room.activeTeam || player.role !== 'OPERATIVE') {
      return fail('Only an operative on the active team can reveal a card.', 'FORBIDDEN');
    }
    const card = this.card(room, cardId);
    if (!card) return fail('That card is not on the board.');
    if (card.revealed) return fail('That card is already revealed.');

    card.revealed = true;
    card.suggestions = [];
    room.guessesMadeThisTurn += 1;
    this.addLog(
      room,
      toneForType(card.type),
      `${player.name} tapped ${card.word} (${cardResultLabel(card.type)})`,
    );

    if (card.type === 'ASSASSIN') {
      this.finish(room, otherTeam(room.activeTeam), 'ASSASSIN');
      return ok(room, player);
    }

    if (card.type === room.activeTeam) {
      if (remainingOf(room.board, room.activeTeam) === 0) {
        this.finish(room, room.activeTeam, 'AGENTS');
        return ok(room, player);
      }
      if (room.guessesRemaining != null) {
        room.guessesRemaining -= 1;
        if (room.guessesRemaining <= 0) this.passTurn(room);
      }
      return ok(room, player);
    }

    if (card.type === otherTeam(room.activeTeam)) {
      if (remainingOf(room.board, card.type) === 0) {
        this.finish(room, card.type, 'AGENTS');
        return ok(room, player);
      }
      this.passTurn(room);
      return ok(room, player);
    }

    this.passTurn(room);
    return ok(room, player);
  }

  endGuessing({ socketId }) {
    const located = this.requirePlayer(socketId);
    if (!located.ok) return located;
    const { room, player } = located;
    if (room.phase !== 'OPERATIVE_GUESS') {
      return fail('Guessing is not open right now.');
    }
    if (player.team !== room.activeTeam || player.role !== 'OPERATIVE') {
      return fail('Only an operative on the active team can end guessing.', 'FORBIDDEN');
    }
    if (room.guessesMadeThisTurn < 1) {
      return fail('Reveal at least one card before ending the turn.');
    }
    this.addLog(room, 'system', `${player.name} ended guessing.`);
    this.passTurn(room);
    return ok(room, player);
  }

  tick(now = this.now()) {
    const changed = [];
    for (const room of this.rooms.values()) {
      if (
        room.turnDeadline &&
        now >= room.turnDeadline &&
        (room.phase === 'SPYMASTER_CLUE' || room.phase === 'OPERATIVE_GUESS')
      ) {
        room.turnDeadline = null;
        this.addLog(room, 'system', 'Time expired.');
        this.passTurn(room);
        changed.push(room.code);
      }
      if (
        !room.players.some((player) => player.connected) &&
        now - room.lastConnectedAt > EMPTY_ROOM_MS
      ) {
        this.rooms.delete(room.code);
      }
    }
    return changed;
  }

  viewFor(socketId, serverNow = this.now()) {
    const located = this.locate(socketId);
    if (!located) return null;
    return serializeRoom(located.room, located.player, serverNow);
  }

  roomCodeFor(socketId) {
    return this.socketIndex.get(socketId)?.code ?? null;
  }

  getRoom(code) {
    return this.rooms.get(code) ?? null;
  }

  makePlayer({ name, socketId }) {
    return {
      token: makeToken(),
      publicId: makePublicId(),
      socketId,
      name,
      team: null,
      role: null,
      connected: true,
      joinedAt: this.now(),
    };
  }

  bindSocket(room, player, socketId) {
    const displacedSocketId = player.socketId && player.socketId !== socketId ? player.socketId : null;
    if (displacedSocketId) this.socketIndex.delete(displacedSocketId);
    player.socketId = socketId;
    player.connected = true;
    this.socketIndex.set(socketId, { code: room.code, publicId: player.publicId });
    room.lastConnectedAt = this.now();
    return displacedSocketId;
  }

  locate(socketId) {
    const indexed = this.socketIndex.get(socketId);
    if (!indexed) return null;
    const room = this.rooms.get(indexed.code);
    if (!room) return null;
    const player = room.players.find((entry) => entry.publicId === indexed.publicId);
    if (!player || player.socketId !== socketId) return null;
    return { room, player };
  }

  requirePlayer(socketId) {
    const located = this.locate(socketId);
    if (!located) return fail('Join a room before doing that.', 'NOT_FOUND');
    return { ok: true, ...located };
  }

  assertHost(room, player) {
    if (player.token !== room.hostToken) return 'Only the host can do that.';
    return null;
  }

  staffingGaps(room) {
    const gaps = [];
    for (const team of TEAMS) {
      const seated = room.players.filter((player) => player.team === team && player.connected);
      if (!seated.some((player) => player.role === 'SPYMASTER')) {
        gaps.push(`${teamLabel(team)} still needs a Spymaster`);
      }
      if (!seated.some((player) => player.role === 'OPERATIVE')) {
        gaps.push(`${teamLabel(team)} still needs an operative`);
      }
    }
    return gaps;
  }

  deal(room) {
    const built = buildBoard(this.words, room.customWords, this.random);
    room.board = built.cards;
    room.startingTeam = built.startingTeam;
    room.activeTeam = built.startingTeam;
    room.phase = 'SPYMASTER_CLUE';
    room.currentClue = null;
    room.guessesRemaining = null;
    room.guessesMadeThisTurn = 0;
    room.winner = null;
    room.winReason = null;
    this.armTimer(room);
  }

  beginCluePhase(room, team) {
    room.phase = 'SPYMASTER_CLUE';
    room.activeTeam = team;
    room.currentClue = null;
    room.guessesRemaining = null;
    room.guessesMadeThisTurn = 0;
    this.clearSuggestions(room);
    this.armTimer(room);
  }

  passTurn(room) {
    const next = otherTeam(room.activeTeam);
    this.addLog(room, 'system', `Turn passed to ${teamLabel(next)}.`);
    this.beginCluePhase(room, next);
  }

  finish(room, winner, winReason) {
    room.phase = 'GAME_OVER';
    room.winner = winner;
    room.winReason = winReason;
    room.turnDeadline = null;
    room.currentClue = room.currentClue;
    this.clearSuggestions(room);
    const reason = winReason === 'ASSASSIN'
      ? 'The assassin was revealed.'
      : 'All agents found.';
    this.addLog(room, winner === 'RED' ? 'red' : 'blue', `${teamLabel(winner)} wins. ${reason}`);
    room.history.push({
      winner,
      winReason,
      endedAt: this.now(),
      startingTeam: room.startingTeam,
    });
  }

  armTimer(room) {
    if (!room.timerEnabled || room.phase === 'LOBBY' || room.phase === 'GAME_OVER') {
      room.turnDeadline = null;
      return;
    }
    room.turnDeadline = this.now() + room.timerSeconds * 1000;
  }

  clearSuggestions(room) {
    for (const card of room.board) card.suggestions = [];
  }

  card(room, cardId) {
    const id = Number(cardId);
    if (!Number.isInteger(id)) return null;
    return room.board.find((card) => card.id === id) ?? null;
  }

  addLog(room, tone, text) {
    room.log.push({
      id: room.logSeq,
      at: this.now(),
      tone,
      text,
    });
    room.logSeq += 1;
    if (room.log.length > 200) room.log.splice(0, room.log.length - 200);
  }

  removePlayer(room, player) {
    room.players = room.players.filter((entry) => entry.publicId !== player.publicId);
    for (const card of room.board) {
      card.suggestions = card.suggestions.filter((mark) => mark.playerId !== player.publicId);
    }
    if (room.hostToken === player.token) {
      const next = room.players.find((entry) => entry.connected) || room.players[0];
      if (next) {
        room.hostToken = next.token;
        this.addLog(room, 'system', `${next.name} is now the host.`);
      }
    }
    this.addLog(room, 'system', `${player.name} left the room.`);
  }

  evictIdle() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      if (
        !room.players.some((player) => player.connected) &&
        now - room.lastConnectedAt > EMPTY_ROOM_MS
      ) {
        this.rooms.delete(room.code);
      }
    }
  }
}

function ok(room, player, extra = {}) {
  return {
    ok: true,
    room,
    player,
    code: room.code,
    token: player.token,
    broadcast: room.code,
    displacedSocketId: null,
    ...extra,
  };
}

function fail(error, code = 'VALIDATION') {
  return { ok: false, error, code };
}
