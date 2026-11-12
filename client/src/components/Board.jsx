import WordCard from './WordCard.jsx';

export default function Board({ cards, canSuggest, canReveal, onSuggest, onReveal }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
      {cards.map((card) => (
        <WordCard
          key={card.id}
          card={card}
          canSuggest={canSuggest}
          canReveal={canReveal}
          onSuggest={onSuggest}
          onReveal={onReveal}
        />
      ))}
    </div>
  );
}
