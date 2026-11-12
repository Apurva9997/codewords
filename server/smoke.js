import assert from 'node:assert/strict';
import { WORDS } from './words.js';
import {
  RoomManager,
  buildBoard,
  clueConflicts,
  parseClueNumber,
  allowanceFor,
  remainingOf,
  serializeRoom,
} from './game.js';

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok  ${name}`);
}

function seat(manager, socketId, name, code, team, role) {
  const joined = manager.joinRoom({ code, name, socketId });
  assert.equal(joined.ok, true, joined.error);
  const claimed = manager.claimSeat({ socketId, team, role });
  assert.equal(claimed.ok, true, claimed.error);
  return joined;
}

function staffedRoom() {
  const manager = new RoomManager();
  const host = manager.createRoom({ name: 'Ada', socketId: 's-ada' });
  assert.equal(host.ok, true, host.error);
  const code = host.code;
  manager.claimSeat({ socketId: 's-ada', team: 'RED', role: 'SPYMASTER' });
  seat(manager, 's-bea', 'Bea', code, 'RED', 'OPERATIVE');
  seat(manager, 's-cy', 'Cy', code, 'BLUE', 'SPYMASTER');
  seat(manager, 's-dee', 'Dee', code, 'BLUE', 'OPERATIVE');
  return { manager, code, host };
}

test('dictionary has 400+ unique uppercase words', () => {
  assert.ok(WORDS.length >= 400, `expected >= 400, got ${WORDS.length}`);
  assert.equal(new Set(WORDS).size, WORDS.length, 'duplicate words');
  for (const word of WORDS) assert.match(word, /^[A-Z]{3,16}$/);
});

test('board is 9/8/7/1 with 25 unique words', () => {
  const board = buildBoard(WORDS, []);
  assert.equal(board.cards.length, 25);
  assert.equal(new Set(board.cards.map((card) => card.word)).size, 25);
  const counts = { RED: 0, BLUE: 0, BYSTANDER: 0, ASSASSIN: 0 };
  for (const card of board.cards) counts[card.type] += 1;
  const starter = board.startingTeam;
  const second = starter === 'RED' ? 'BLUE' : 'RED';
  assert.equal(counts[starter], 9);
  assert.equal(counts[second], 8);
  assert.equal(counts.BYSTANDER, 7);
  assert.equal(counts.ASSASSIN, 1);
});

test('custom words are drawn onto the board first', () => {
  const custom = Array.from({ length: 25 }, (_, i) => `CUSTOM${i}WORD`);
  const board = buildBoard(WORDS, custom, () => 0);
  const words = new Set(board.cards.map((card) => card.word));
  for (const word of custom) assert.ok(words.has(word), word);
});

test('operatives never receive unrevealed identities', () => {
  const { manager, code } = staffedRoom();
  const started = manager.startGame({ socketId: 's-ada' });
  assert.equal(started.ok, true, started.error);
  const room = manager.getRoom(code);
  const operative = room.players.find((player) => player.name === 'Bea');
  const view = serializeRoom(room, operative, Date.now());
  const allowed = new Set(['id', 'word', 'revealed', 'suggestions']);
  for (const card of view.board) {
    assert.equal(card.revealed, false);
    for (const key of Object.keys(card)) {
      assert.ok(allowed.has(key), `leaked ${key}`);
    }
  }
  const blob = JSON.stringify(view);
  assert.equal(blob.includes('ASSASSIN'), false);
  assert.equal(blob.includes('BYSTANDER'), false);
  assert.equal(blob.includes('"type"'), false);
});

test('spymasters receive the key and game over reveals it to operatives', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  const spy = room.players.find((player) => player.name === 'Ada');
  const spyView = serializeRoom(room, spy, Date.now());
  assert.equal(spyView.board.every((card) => card.type), true);
  const counts = { RED: 0, BLUE: 0, BYSTANDER: 0, ASSASSIN: 0 };
  for (const card of spyView.board) counts[card.type] += 1;
  assert.equal(counts.ASSASSIN, 1);
  assert.equal(counts.BYSTANDER, 7);

  room.phase = 'GAME_OVER';
  const operative = room.players.find((player) => player.name === 'Bea');
  const over = serializeRoom(room, operative, Date.now());
  assert.equal(over.board.every((card) => card.type), true);
});

test('clue number 0 and unlimited mean no cap, otherwise guesses are number + 1', () => {
  assert.equal(allowanceFor(parseClueNumber(0)), null);
  assert.equal(allowanceFor(parseClueNumber('unlimited')), null);
  assert.equal(allowanceFor(parseClueNumber(2)), 3);
  assert.equal(parseClueNumber(10), null);
  assert.equal(parseClueNumber(-1), null);
});

test('clue validator rejects spaces and unrevealed substrings', () => {
  const { manager } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(manager.roomCodeFor('s-ada'));
  const hidden = room.board.find((card) => !card.revealed);
  const badSpace = manager.giveClue({ socketId: 's-ada', word: 'TWO WORDS', number: 1 });
  assert.equal(badSpace.ok, false);
  const fragment = hidden.word.slice(0, Math.min(4, hidden.word.length));
  assert.ok(clueConflicts(fragment, room.board));
  const spy = room.activeTeam === 'RED' ? 's-ada' : 's-cy';
  const badOverlap = manager.giveClue({ socketId: spy, word: fragment, number: 1 });
  assert.equal(badOverlap.ok, false);
  assert.match(badOverlap.error, /overlaps/i);

  hidden.revealed = true;
  const afterReveal = manager.giveClue({
    socketId: spy,
    word: hidden.word,
    number: 2,
  });
  if (clueConflicts(hidden.word, room.board)) {
    assert.equal(afterReveal.ok, false);
  } else {
    assert.equal(afterReveal.ok, true, afterReveal.error);
    assert.equal(room.phase, 'OPERATIVE_GUESS');
    assert.equal(room.guessesRemaining, 3);
    assert.equal(room.currentClue.word, hidden.word);
    assert.equal(room.currentClue.label, '2');
  }
});

test('own-team reveal decrements guesses and passes at zero', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  const own = room.board.find((card) => card.type === room.activeTeam);
  own.word = 'ZZZUNIQUE';
  const spy = room.activeTeam === 'RED' ? 's-ada' : 's-cy';
  const operative = room.activeTeam === 'RED' ? 's-bea' : 's-dee';
  const given = manager.giveClue({ socketId: spy, word: 'QUIET', number: 1 });
  assert.equal(given.ok, true, given.error);
  assert.equal(room.guessesRemaining, 2);
  const first = manager.revealCard({ socketId: operative, cardId: own.id });
  assert.equal(first.ok, true, first.error);
  assert.equal(own.revealed, true);
  assert.equal(room.phase, 'OPERATIVE_GUESS');
  assert.equal(room.guessesRemaining, 1);
  const secondCard = room.board.find((card) => card.type === room.activeTeam && !card.revealed);
  const second = manager.revealCard({ socketId: operative, cardId: secondCard.id });
  assert.equal(second.ok, true, second.error);
  assert.equal(room.phase, 'SPYMASTER_CLUE');
  assert.notEqual(room.activeTeam, room.startingTeam);
});

test('finishing your agents wins before the guess cap matters', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  const team = room.activeTeam;
  const agents = room.board.filter((card) => card.type === team);
  for (const card of agents.slice(1)) card.revealed = true;
  const last = agents[0];
  last.word = 'LASTAGENTWORD';
  const spy = team === 'RED' ? 's-ada' : 's-cy';
  const operative = team === 'RED' ? 's-bea' : 's-dee';
  manager.giveClue({ socketId: spy, word: 'QUIET', number: 1 });
  const result = manager.revealCard({ socketId: operative, cardId: last.id });
  assert.equal(result.ok, true, result.error);
  assert.equal(room.phase, 'GAME_OVER');
  assert.equal(room.winner, team);
  assert.equal(room.winReason, 'AGENTS');
  assert.equal(remainingOf(room.board, team), 0);
});

test('opposing card ends the turn unless it wins the game for them', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  const active = room.activeTeam;
  const foe = room.board.find((card) => card.type !== active && card.type !== 'BYSTANDER' && card.type !== 'ASSASSIN');
  foe.word = 'FOEWORD';
  const spy = active === 'RED' ? 's-ada' : 's-cy';
  const operative = active === 'RED' ? 's-bea' : 's-dee';
  manager.giveClue({ socketId: spy, word: 'QUIET', number: 3 });
  const before = remainingOf(room.board, foe.type);
  manager.revealCard({ socketId: operative, cardId: foe.id });
  assert.equal(room.phase, 'SPYMASTER_CLUE');
  assert.equal(room.activeTeam, foe.type);
  assert.equal(remainingOf(room.board, foe.type), before - 1);

  manager.giveClue({ socketId: room.activeTeam === 'RED' ? 's-ada' : 's-cy', word: 'QUIET', number: 1 });
  const opponent = otherAgents(room);
  for (const card of opponent.slice(1)) card.revealed = true;
  const last = opponent[0];
  const revealer = room.activeTeam === 'RED' ? 's-bea' : 's-dee';
  manager.revealCard({ socketId: revealer, cardId: last.id });
  assert.equal(room.phase, 'GAME_OVER');
  assert.equal(room.winner, last.type);
  assert.equal(room.winReason, 'AGENTS');
});

test('bystander ends the turn and assassin makes the other team win', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  const active = room.activeTeam;
  const bystander = room.board.find((card) => card.type === 'BYSTANDER');
  bystander.word = 'NEUTRALWORD';
  const spy = active === 'RED' ? 's-ada' : 's-cy';
  const operative = active === 'RED' ? 's-bea' : 's-dee';
  manager.giveClue({ socketId: spy, word: 'QUIET', number: 4 });
  manager.revealCard({ socketId: operative, cardId: bystander.id });
  assert.equal(room.phase, 'SPYMASTER_CLUE');
  assert.equal(room.activeTeam, active === 'RED' ? 'BLUE' : 'RED');

  const spySocket = room.activeTeam === 'RED' ? 's-ada' : 's-cy';
  const opSocket = room.activeTeam === 'RED' ? 's-bea' : 's-dee';
  const assassin = room.board.find((card) => card.type === 'ASSASSIN');
  assassin.word = 'BLACKCARDWORD';
  manager.giveClue({ socketId: spySocket, word: 'QUIET', number: 1 });
  manager.revealCard({ socketId: opSocket, cardId: assassin.id });
  assert.equal(room.phase, 'GAME_OVER');
  assert.equal(room.winner, active);
  assert.equal(room.winReason, 'ASSASSIN');
  const viewer = room.players.find((player) => player.role === 'OPERATIVE');
  const view = serializeRoom(room, viewer, Date.now());
  assert.equal(view.board.every((card) => card.type), true);
});

test('end guessing requires one official reveal', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  const team = room.activeTeam;
  for (const card of room.board) card.word = `CARD${card.id}WORD`;
  const spy = team === 'RED' ? 's-ada' : 's-cy';
  const operative = team === 'RED' ? 's-bea' : 's-dee';
  manager.giveClue({ socketId: spy, word: 'QUIET', number: 9 });
  const early = manager.endGuessing({ socketId: operative });
  assert.equal(early.ok, false);
  const own = room.board.find((card) => card.type === team);
  const revealed = manager.revealCard({ socketId: operative, cardId: own.id });
  assert.equal(revealed.ok, true, revealed.error);
  assert.equal(room.phase, 'OPERATIVE_GUESS');
  const ended = manager.endGuessing({ socketId: operative });
  assert.equal(ended.ok, true, ended.error);
  assert.equal(room.phase, 'SPYMASTER_CLUE');
  assert.equal(room.activeTeam, team === 'RED' ? 'BLUE' : 'RED');
});

test('wrong team cannot reveal, and a taken spymaster seat stays taken', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  room.board[0].word = 'SAFEWORD';
  const spy = room.activeTeam === 'RED' ? 's-ada' : 's-cy';
  manager.giveClue({ socketId: spy, word: 'QUIET', number: 1 });
  const foe = room.activeTeam === 'RED' ? 's-dee' : 's-bea';
  const denied = manager.revealCard({ socketId: foe, cardId: room.board[0].id });
  assert.equal(denied.ok, false);
  const spyDenied = manager.revealCard({ socketId: spy, cardId: room.board[0].id });
  assert.equal(spyDenied.ok, false);
  const taken = manager.claimSeat({ socketId: 's-bea', team: 'RED', role: 'SPYMASTER' });
  assert.equal(taken.ok, false);
  const moved = manager.claimSeat({ socketId: 's-bea', team: 'BLUE', role: 'OPERATIVE' });
  assert.equal(moved.ok, true, moved.error);
});

test('offline spymaster seat can be claimed', () => {
  const { manager } = staffedRoom();
  manager.disconnect('s-ada');
  const claimed = manager.claimSeat({ socketId: 's-bea', team: 'RED', role: 'SPYMASTER' });
  assert.equal(claimed.ok, true, claimed.error);
  const ada = manager.getRoom(claimed.code).players.find((player) => player.name === 'Ada');
  assert.equal(ada.role, 'OPERATIVE');
});

test('non-host cannot start and unstaffed rooms cannot start', () => {
  const manager = new RoomManager();
  const host = manager.createRoom({ name: 'Ada', socketId: 's-ada' });
  const stranger = manager.joinRoom({ code: host.code, name: 'Bea', socketId: 's-bea' });
  assert.equal(stranger.ok, true);
  const denied = manager.startGame({ socketId: 's-bea' });
  assert.equal(denied.ok, false);
  const unready = manager.startGame({ socketId: 's-ada' });
  assert.equal(unready.ok, false);
  assert.match(unready.error, /Spymaster/);
});

test('suggestions toggle only for the active operative', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  room.board[3].word = 'SAFEWORD';
  const spy = room.activeTeam === 'RED' ? 's-ada' : 's-cy';
  const operative = room.activeTeam === 'RED' ? 's-bea' : 's-dee';
  const foeSocket = room.activeTeam === 'RED' ? 's-dee' : 's-bea';
  manager.giveClue({ socketId: spy, word: 'QUIET', number: 2 });
  const marked = manager.toggleSuggestion({ socketId: operative, cardId: 3 });
  assert.equal(marked.ok, true, marked.error);
  assert.equal(room.board[3].suggestions.length, 1);
  manager.toggleSuggestion({ socketId: operative, cardId: 3 });
  assert.equal(room.board[3].suggestions.length, 0);
  const foe = manager.toggleSuggestion({ socketId: foeSocket, cardId: 3 });
  assert.equal(foe.ok, false);
});

test('timer expiry passes the turn', () => {
  const { manager, code } = staffedRoom();
  manager.updateSettings({ socketId: 's-ada', timerEnabled: true, timerSeconds: 30 });
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  const starting = room.activeTeam;
  room.turnDeadline = Date.now() - 5;
  const changed = manager.tick(Date.now());
  assert.deepEqual(changed, [code]);
  assert.equal(room.phase, 'SPYMASTER_CLUE');
  assert.equal(room.activeTeam, starting === 'RED' ? 'BLUE' : 'RED');
  assert.ok(room.turnDeadline > Date.now());
});

test('log uses the required clue and tap lines', () => {
  const { manager, code } = staffedRoom();
  manager.startGame({ socketId: 's-ada' });
  const room = manager.getRoom(code);
  for (const card of room.board) card.word = `CARD${card.id}WORD`;
  room.activeTeam = 'RED';
  const own = room.board.find((card) => card.type === 'RED');
  own.word = 'BARK';
  manager.giveClue({ socketId: 's-ada', word: 'OCEAN', number: 2 });
  manager.revealCard({ socketId: 's-bea', cardId: own.id });
  const texts = room.log.map((entry) => entry.text);
  assert.ok(texts.includes('Red Spymaster gave clue: OCEAN 2'));
  assert.ok(texts.includes('Bea tapped BARK (Red Agent)'));
});

function otherAgents(room) {
  const foe = room.activeTeam === 'RED' ? 'BLUE' : 'RED';
  return room.board.filter((card) => card.type === foe && !card.revealed);
}

console.log(`\n${passed} tests passed`);
