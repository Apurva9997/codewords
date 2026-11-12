export function teamName(team) {
  if (team === 'RED') return 'Red';
  if (team === 'BLUE') return 'Blue';
  return 'Unassigned';
}

export function roleName(role) {
  if (role === 'SPYMASTER') return 'Spymaster';
  if (role === 'OPERATIVE') return 'Operative';
  return 'Spectator';
}

export function guessCount(state) {
  if (!state.currentClue) return 0;
  if (state.guessesRemaining == null) return null;
  return state.guessesRemaining;
}

export function statusMessage(state) {
  if (!state || state.phase === 'LOBBY') {
    return 'Take a seat. The host starts the game when both teams are staffed.';
  }
  if (state.phase === 'GAME_OVER') {
    const winner = teamName(state.winner);
    if (state.winReason === 'ASSASSIN') {
      return `${winner} wins. The assassin was revealed.`;
    }
    return `${winner} wins. All agents found.`;
  }
  const team = teamName(state.activeTeam);
  if (state.phase === 'SPYMASTER_CLUE') {
    return `${team} Spymaster is thinking...`;
  }
  const clue = state.currentClue;
  const limit = state.guessesRemaining == null
    ? 'unlimited cards'
    : `up to ${state.guessesRemaining} ${state.guessesRemaining === 1 ? 'card' : 'cards'}`;
  return `${team} Operatives: Guess ${limit} for '${clue.word} ${clue.label}'`;
}

export function winHeadline(state) {
  if (!state?.winner) return 'Game over';
  return `${teamName(state.winner)} wins`;
}

export function winDetail(state) {
  if (state?.winReason === 'ASSASSIN') return 'The assassin was revealed.';
  return 'All agents found.';
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || '?';
}
