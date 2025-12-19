'use client';

export default function NumberPad({ onNumberClick, disabled }) {
  const handleNumberClick = (number) => {
    if (onNumberClick && !disabled) {
      onNumberClick(number);
    }
  };

  return (
    <div className="number-pad-vertical">
      <div className="number-pad-vertical-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            className="number-pad-button-vertical"
            onClick={() => handleNumberClick(num)}
            disabled={disabled}
            aria-label={`Enter number ${num}`}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}







