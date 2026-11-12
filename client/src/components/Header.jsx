import { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Timer } from 'lucide-react';
import { roleName } from '../copy.js';

export default function Header({ state, onCopy, onSwitchRole, onNewGame, onTimer }) {
  const [copied, setCopied] = useState(false);
  const you = state.you;
  const switchLabel = you.role === 'SPYMASTER' ? 'Switch to Operative' : 'Switch to Spymaster';
  const canSwitch = Boolean(you.team);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-white/10 bg-ink/95 px-3 py-3 backdrop-blur sm:px-4">
      <div className="mr-auto flex items-center gap-3">
        <div>
          <p className="font-display text-xl leading-none text-cream">Codewords</p>
          <p className="mt-1 text-xs text-slate-400">
            {you.name} · {roleName(you.role)}
            {you.isHost ? ' · Host' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await onCopy();
            setCopied(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold tracking-[0.18em]"
        >
          {state.code}
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          <span className="sr-only">{copied ? 'Room code copied' : 'Copy room code'}</span>
        </button>
      </div>

      <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
        <Timer size={16} aria-hidden="true" />
        <span>Turn timer</span>
        <input
          type="checkbox"
          checked={state.timerEnabled}
          disabled={!you.isHost}
          onChange={(event) => onTimer({ timerEnabled: event.target.checked })}
          className="size-4 accent-amber-200"
        />
        {state.timerEnabled && (
          <select
            aria-label="Turn timer length"
            value={state.timerSeconds}
            disabled={!you.isHost}
            onChange={(event) => onTimer({ timerSeconds: Number(event.target.value) })}
            className="rounded-lg bg-ink px-2 py-1 text-sm"
          >
            {[30, 60, 90, 120].map((seconds) => (
              <option key={seconds} value={seconds}>{seconds}s</option>
            ))}
          </select>
        )}
      </label>

      <button
        type="button"
        disabled={!canSwitch}
        onClick={onSwitchRole}
        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold disabled:opacity-40"
      >
        {you.role === 'SPYMASTER' ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        <span className="hidden sm:inline">{switchLabel}</span>
        <span className="sm:hidden">{you.role === 'SPYMASTER' ? 'Operative' : 'Spymaster'}</span>
      </button>

      {you.isHost && (
        <button
          type="button"
          onClick={onNewGame}
          className="rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-cream-ink hover:bg-white"
        >
          New game
        </button>
      )}
    </header>
  );
}
