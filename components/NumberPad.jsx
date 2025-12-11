'use client';

export default function NumberPad({ selectedCell, onNumberClick, onClear }) {
  if (!selectedCell) {
    return null;
  }

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="number-pad" id="number-pad">
      <div className="number-pad-grid">
        {numbers.map((num) => (
          <button
            key={num}
            className="number-pad-button"
            onClick={() => onNumberClick(num)}
            type="button"
            aria-label={`Enter ${num}`}
          >
            {num}
          </button>
        ))}
        <button
          className="number-pad-button number-pad-clear"
          onClick={onClear}
          type="button"
          aria-label="Clear"
        >
          Clear
        </button>
      </div>
    </div>
  );
}


