import { useEffect, useMemo, useState } from 'react';
import Board from './Board.jsx';
import ClueBar from './ClueBar.jsx';
import GameLog from './GameLog.jsx';
import GameOver from './GameOver.jsx';
import Header from './Header.jsx';
import TeamPanel from './TeamPanel.jsx';
import { statusMessage } from '../copy.js';

export default function Room({
  state,
  actionError,
  onCopy,
  onClaim,
  onLeaveSeat,
  onStart,
  onClue,
  onSuggest,
  onReveal,
  onEnd,
  onTimer,
  onSaveCustom,
  onLeave,
}) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const you = state.you;
  const activeOperative = state.phase === 'OPERATIVE_GUESS' && you.team === state.activeTeam && you.role === 'OPERATIVE';
  const activeSpy = state.phase === 'SPYMASTER_CLUE' && you.team === state.activeTeam && you.role === 'SPYMASTER';

  useEffect(() => {
    if (!state.timerEnabled || !state.turnDeadline) {
      setSecondsLeft(null);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [state.timerEnabled, state.turnDeadline, state.serverNow]);

  const bannerTone = useMemo(() => {
    if (state.phase === 'GAME_OVER') return state.winner === 'RED' ? 'bg-rose-700' : 'bg-sky-700';
    if (state.activeTeam === 'RED') return 'bg-rose-700';
    if (state.activeTeam === 'BLUE') return 'bg-sky-700';
    return 'bg-slate-700';
  }, [state.phase, state.winner, state.activeTeam]);

  async function switchRole() {
    if (!you.team) return;
    const next = you.role === 'SPYMASTER' ? 'OPERATIVE' : 'SPYMASTER';
    await onClaim(you.team, next);
  }

  return (
    <div className="min-h-screen">
      <Header
        state={state}
        onCopy={onCopy}
        onSwitchRole={switchRole}
        onNewGame={onStart}
        onTimer={onTimer}
      />

      <div className="mx-auto grid max-w-[1500px] items-start gap-4 px-3 py-4 lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:px-4">
        <TeamPanel team="RED" state={state} onJoin={onClaim} />

        <main className="space-y-3">
          <div className={`rounded-2xl px-4 py-3 text-sm font-semibold text-white sm:text-base ${bannerTone}`}>
            {state.phase === 'GAME_OVER' ? (
              <GameOver state={state} onNewGame={onStart} />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p>{statusMessage(state)}</p>
                {secondsLeft != null && (
                  <span className="rounded-full bg-black/25 px-2 py-1 text-xs tabular-nums">{secondsLeft}s</span>
                )}
              </div>
            )}
          </div>

          {state.phase === 'LOBBY' ? (
            <LobbyBoard
              state={state}
              onLeaveSeat={onLeaveSeat}
              onSaveCustom={onSaveCustom}
            />
          ) : (
            <Board
              cards={state.board}
              canSuggest={activeOperative}
              canReveal={activeOperative}
              onSuggest={onSuggest}
              onReveal={onReveal}
            />
          )}

          {state.phase !== 'GAME_OVER' && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            {activeSpy || activeOperative ? (
              <ClueBar
                mode={activeSpy ? 'clue' : 'guess'}
                canEnd={state.guessesMadeThisTurn > 0}
                error={actionError}
                onGiveClue={onClue}
                onEndGuessing={onEnd}
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  {state.phase === 'LOBBY'
                    ? 'Join a team, then wait for the host to start.'
                    : 'Waiting for the active team.'}
                </p>
                {state.phase === 'LOBBY' && state.you.isHost && (
                  <button
                    type="button"
                    onClick={() => onStart()}
                    className="rounded-xl bg-cream px-4 py-3 font-semibold text-cream-ink hover:bg-white"
                  >
                    Start game
                  </button>
                )}
                {actionError && <p role="alert" className="text-sm text-rose-200">{actionError}</p>}
              </div>
            )}
          </div>
          )}
        </main>

        <div className="flex flex-col gap-4">
          <TeamPanel team="BLUE" state={state} onJoin={onClaim} />
          <GameLog entries={state.log} />
          <button
            type="button"
            onClick={onLeave}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}

function LobbyBoard({ state, onLeaveSeat, onSaveCustom }) {
  const [custom, setCustom] = useState(state.customWords.join(', '));

  useEffect(() => {
    setCustom(state.customWords.join(', '));
  }, [state.customWords]);

  return (
    <section className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-5">
      <h2 className="font-display text-3xl text-cream">Waiting room</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">
        Each team needs one Spymaster and at least one operative. Empty seats can be taken during the game.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {state.players.filter((player) => !player.team).map((player) => (
          <span key={player.publicId} className="rounded-full bg-white/10 px-3 py-1 text-sm">
            {player.name}{player.isYou ? ' (you)' : ''} · no seat
          </span>
        ))}
        {state.players.every((player) => player.team) && (
          <span className="text-sm text-slate-400">Everyone has a seat.</span>
        )}
      </div>
      {state.you.team && (
        <button
          type="button"
          onClick={onLeaveSeat}
          className="mt-4 rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
        >
          Leave seat
        </button>
      )}
      {state.you.isHost && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-200" htmlFor="custom-words">
            Custom words
          </label>
          <textarea
            id="custom-words"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onBlur={() => onSaveCustom(custom)}
            rows={3}
            placeholder="HARBOR, LANTERN, OSPREY"
            className="mt-2 w-full rounded-xl border border-white/10 bg-ink px-3 py-2 text-sm text-cream outline-none ring-amber-200/40 placeholder:text-slate-600 focus:ring-2"
          />
          <p className="mt-1 text-xs text-slate-400">
            Optional. Up to 80 words, 3 to 16 letters each. The board fills the rest from the dictionary.
          </p>
        </div>
      )}
    </section>
  );
}
