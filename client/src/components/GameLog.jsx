import { useEffect, useRef } from 'react';

const TONE = {
  red: 'border-rose-400/40 text-rose-100',
  blue: 'border-sky-400/40 text-sky-100',
  bystander: 'border-amber-200/30 text-amber-100',
  assassin: 'border-white/30 text-white',
  system: 'border-white/10 text-slate-300',
};

export default function GameLog({ entries }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries]);

  return (
    <section className="flex min-h-64 flex-1 flex-col rounded-3xl border border-white/10 bg-black/20 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Game log</h2>
      <ol className="log-scroll mt-3 flex max-h-80 flex-1 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-[28rem]">
        {entries.length === 0 && (
          <li className="text-sm text-slate-400">Clues and reveals will show up here.</li>
        )}
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`rounded-xl border-l-2 bg-white/5 px-3 py-2 text-sm leading-snug ${TONE[entry.tone] || TONE.system}`}
          >
            {entry.text}
          </li>
        ))}
        <li ref={endRef} />
      </ol>
    </section>
  );
}
