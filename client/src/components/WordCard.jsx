import { Check } from 'lucide-react';
import { initials } from '../copy.js';

const REVEALED = {
  RED: 'card-revealed-red',
  BLUE: 'card-revealed-blue',
  BYSTANDER: 'card-revealed-bystander',
  ASSASSIN: 'card-revealed-assassin',
};

const SPY_FACE = {
  RED: 'card-spy-red',
  BLUE: 'card-spy-blue',
  BYSTANDER: 'card-spy-bystander',
  ASSASSIN: 'card-spy-assassin',
};

export default function WordCard({ card, canSuggest, canReveal, onSuggest, onReveal }) {
  const known = Boolean(card.type);
  const face = card.revealed
    ? REVEALED[card.type]
    : known
      ? SPY_FACE[card.type]
      : 'card-face';

  return (
    <article
      className={`group relative flex min-h-20 flex-col justify-between rounded-2xl p-2 sm:min-h-24 sm:p-3 ${face}`}
    >
      <button
        type="button"
        disabled={!canSuggest || card.revealed}
        onClick={() => onSuggest(card.id)}
        className="flex flex-1 items-center justify-center rounded-xl px-1 text-center disabled:cursor-default"
        aria-label={canSuggest && !card.revealed ? `Suggest ${card.word}` : card.word}
      >
        <span className={`break-words font-display text-[11px] font-bold leading-tight tracking-wide sm:text-sm md:text-base ${card.revealed && card.type === 'ASSASSIN' ? 'line-through decoration-rose-400' : ''}`}>
          {card.word}
        </span>
      </button>

      {!card.revealed && card.suggestions?.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {card.suggestions.map((mark) => (
            <li
              key={mark.playerId}
              title={mark.name}
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${mark.team === 'RED' ? 'bg-rose-600' : 'bg-sky-600'}`}
            >
              {initials(mark.name)}
              <span className="sr-only">{mark.name} suggests this card</span>
            </li>
          ))}
        </ul>
      )}

      {canReveal && !card.revealed && (
        <button
          type="button"
          onClick={() => onReveal(card.id)}
          className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-emerald-700 text-white opacity-100 shadow-md sm:right-1.5 sm:top-1.5 sm:size-7 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:focus:opacity-100"
          aria-label={`Reveal ${card.word}`}
        >
          <Check size={14} aria-hidden="true" />
        </button>
      )}

      {card.revealed && (
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider opacity-80">
          {card.type === 'BYSTANDER' ? 'Bystander' : card.type === 'ASSASSIN' ? 'Assassin' : `${card.type === 'RED' ? 'Red' : 'Blue'} agent`}
        </p>
      )}
    </article>
  );
}
