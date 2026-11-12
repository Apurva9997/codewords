import { useState } from 'react';

export default function Lobby({ busy, error, onCreate, onJoin }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('create');

  function submit(event) {
    event.preventDefault();
    if (mode === 'create') onCreate(name);
    else onJoin(code, name);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Two teams. One board.
          </p>
          <h1 className="mt-3 font-display text-5xl leading-none text-cream sm:text-6xl">
            Codewords
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-300">
            A spymaster gives a one-word clue. Operatives find the agents and avoid the assassin.
          </p>
          <ul className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="block font-semibold text-rose-200">Red and Blue</span>
              Nine agents for the starting team. Eight for the other.
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="block font-semibold text-amber-100">Seven bystanders</span>
              A neutral card ends the turn.
            </li>
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="block font-semibold text-slate-100">One assassin</span>
              Reveal it and the other team wins.
            </li>
          </ul>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-panel/90 p-6 shadow-2xl shadow-black/30">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/25 p-1">
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === 'create' ? 'bg-cream text-cream-ink' : 'text-slate-300'}`}
              onClick={() => setMode('create')}
            >
              Create room
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${mode === 'join' ? 'bg-cream text-cream-ink' : 'text-slate-300'}`}
              onClick={() => setMode('join')}
            >
              Join room
            </button>
          </div>

          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-200">Name</span>
              <input
                required
                maxLength={16}
                autoComplete="nickname"
                placeholder="Ada"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink px-3 py-3 text-cream outline-none ring-amber-200/40 placeholder:text-slate-500 focus:ring-2"
              />
            </label>

            {mode === 'join' && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-200">Room code</span>
                <input
                  required
                  maxLength={6}
                  placeholder="K7MQ"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-white/10 bg-ink px-3 py-3 font-display text-2xl uppercase tracking-[0.3em] text-cream outline-none ring-amber-200/40 placeholder:text-slate-600 focus:ring-2"
                />
              </label>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-rose-950/70 px-3 py-2 text-sm text-rose-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-amber-200 px-4 py-3 font-semibold text-cream-ink hover:bg-amber-100 disabled:opacity-60"
            >
              {busy ? 'Connecting...' : mode === 'create' ? 'Create room' : 'Join room'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
