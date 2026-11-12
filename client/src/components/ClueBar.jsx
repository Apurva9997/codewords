import { useState } from 'react';

const NUMBERS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'unlimited'];

export default function ClueBar({ mode, canEnd, error, onGiveClue, onEndGuessing }) {
  const [word, setWord] = useState('');
  const [number, setNumber] = useState('1');

  if (mode === 'clue') {
    return (
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onGiveClue({ word, number: number === 'unlimited' ? 'unlimited' : Number(number) });
        }}
      >
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Clue</span>
          <input
            required
            value={word}
            maxLength={20}
            placeholder="OCEAN"
            onChange={(event) => setWord(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink px-3 py-3 uppercase tracking-wide text-cream outline-none ring-amber-200/40 placeholder:text-slate-600 focus:ring-2"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Number</span>
          <select
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className="rounded-xl border border-white/10 bg-ink px-3 py-3 text-cream"
          >
            {NUMBERS.map((value) => (
              <option key={value} value={value}>
                {value === 'unlimited' ? 'Unlimited' : value}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-xl bg-amber-200 px-4 py-3 font-semibold text-cream-ink hover:bg-amber-100"
        >
          Give clue
        </button>
        {error && <p role="alert" className="basis-full text-sm text-rose-200">{error}</p>}
      </form>
    );
  }

  if (mode === 'guess') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canEnd}
          onClick={onEndGuessing}
          className="rounded-xl bg-cream px-4 py-3 font-semibold text-cream-ink hover:bg-white disabled:opacity-40"
        >
          End guessing
        </button>
        <p className="text-sm text-slate-400">
          {canEnd ? 'Stop if the remaining cards feel risky.' : 'Reveal at least one card before ending the turn.'}
        </p>
        {error && <p role="alert" className="basis-full text-sm text-rose-200">{error}</p>}
      </div>
    );
  }

  return null;
}
