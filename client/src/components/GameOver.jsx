import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { winDetail, winHeadline } from '../copy.js';

export default function GameOver({ state, onNewGame }) {
  useEffect(() => {
    const colors = state.winner === 'RED'
      ? ['#c23b3b', '#f4ead6', '#ffd0c8']
      : ['#2f6fbf', '#f4ead6', '#c9e2ff'];
    const burst = confetti.create(undefined, { resize: true, useWorker: true });
    burst({ particleCount: 90, spread: 70, origin: { y: 0.2 }, colors, startVelocity: 35 });
    const again = setTimeout(() => {
      burst({ particleCount: 40, spread: 90, origin: { y: 0.15 }, colors, startVelocity: 25 });
    }, 450);
    return () => clearTimeout(again);
  }, [state.winner, state.history?.length]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">Game over</p>
        <p className="font-display text-2xl text-white">{winHeadline(state)}. {winDetail(state)}</p>
      </div>
      {state.you.isHost && (
        <button
          type="button"
          onClick={onNewGame}
          className="rounded-xl bg-cream px-4 py-2.5 font-semibold text-cream-ink hover:bg-white"
        >
          New game
        </button>
      )}
    </div>
  );
}
