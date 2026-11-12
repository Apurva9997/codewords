import { initials, roleName } from '../copy.js';

const THEME = {
  RED: {
    panel: 'border-rose-400/30 bg-rose-950/40',
    score: 'text-rose-200',
    chip: 'bg-rose-500',
    button: 'bg-rose-500 text-white hover:bg-rose-400',
  },
  BLUE: {
    panel: 'border-sky-400/30 bg-sky-950/40',
    score: 'text-sky-200',
    chip: 'bg-sky-500',
    button: 'bg-sky-500 text-white hover:bg-sky-400',
  },
};

function Seat({ player, emptyLabel }) {
  if (!player) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 px-3 py-2 text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-2">
      <span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-bold">
        {initials(player.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {player.name}
          {player.isYou ? ' (you)' : ''}
          {player.isHost ? ' · Host' : ''}
        </p>
        <p className="text-xs text-slate-400">{roleName(player.role)}</p>
      </div>
      <span
        className={`size-2.5 rounded-full ${player.connected ? 'bg-emerald-400' : 'bg-slate-500'}`}
        title={player.connected ? 'Online' : 'Offline'}
      />
      <span className="sr-only">{player.connected ? 'Online' : 'Offline'}</span>
    </div>
  );
}

export default function TeamPanel({ team, state, onJoin }) {
  const theme = THEME[team];
  const players = state.players.filter((player) => player.team === team);
  const spymaster = players.find((player) => player.role === 'SPYMASTER') || null;
  const operatives = players.filter((player) => player.role === 'OPERATIVE');
  const you = state.you;
  const spyTaken = Boolean(spymaster && spymaster.connected && !spymaster.isYou);

  return (
    <section className={`rounded-3xl border p-4 ${theme.panel}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
            {team === 'RED' ? 'Red team' : 'Blue team'}
          </p>
          <p className={`font-display text-5xl leading-none ${theme.score}`}>
            {state.phase === 'LOBBY' ? '–' : state.remaining[team]}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {state.phase === 'LOBBY' ? 'Waiting to deal' : 'Cards left'}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${theme.chip}`}>
          {state.startingTeam === team && state.phase !== 'LOBBY' ? 'Starts' : 'Agents'}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Spymaster</p>
        <Seat player={spymaster} emptyLabel="Spymaster seat open" />
        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-white/60">Operatives</p>
        {operatives.length === 0 && (
          <Seat player={null} emptyLabel="No operatives yet" />
        )}
        {operatives.map((player) => (
          <Seat key={player.publicId} player={player} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={spyTaken && !(you.team === team && you.role === 'SPYMASTER')}
          onClick={() => onJoin(team, 'SPYMASTER')}
          className={`rounded-xl px-2 py-2 text-xs font-semibold disabled:opacity-40 ${theme.button}`}
        >
          Join as Spymaster
        </button>
        <button
          type="button"
          onClick={() => onJoin(team, 'OPERATIVE')}
          className="rounded-xl bg-white/10 px-2 py-2 text-xs font-semibold hover:bg-white/15"
        >
          Join as Operative
        </button>
      </div>
    </section>
  );
}
