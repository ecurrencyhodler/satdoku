'use client';

export default function Cell({
  row,
  col,
  value,
  isPrefilled,
  isIncorrect,
  isSelected,
  isOpponentSelected = false,
  isOpponentFilled = false,
  isHighlightedRow,
  isHighlightedColumn,
  isHighlightedBox,
  isHighlightedSameNumber,
  onClick,
  hasLives,
  notes = []
}) {
  // Determine if cell is locked (prefilled or user-filled with a value)
  // Note: Cells with incorrect values should still be editable, so we don't consider them locked
  const isLocked = isPrefilled || (value !== 0 && !isIncorrect);

  const handleClick = () => {
    // Allow clicks on any cell for highlighting
    // Input processing will be handled by useCellInput hook which checks if cell is empty and has lives
    onClick(row, col);
  };

  // Only show notes when cell is empty (no value)
  const showNotes = value === 0 && notes && notes.length > 0;

  // Create 3x3 grid for notes (positions 1-9)
  const renderNotesGrid = () => {
    if (!showNotes) return null;

    return (
      <div className="cell-notes">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <span
            key={num}
            className={`cell-note-number ${notes.includes(num) ? 'cell-note-active' : 'cell-note-empty'}`}
          >
            {notes.includes(num) ? num : ''}
          </span>
        ))}
      </div>
    );
  };

  const className = `cell ${isPrefilled ? 'cell-prefilled' : ''} ${isLocked && !isPrefilled ? 'cell-locked' : ''} ${isIncorrect ? 'cell-incorrect' : ''} ${isSelected ? 'cell-selected' : ''} ${isOpponentSelected ? 'cell-opponent-selected' : ''} ${isOpponentFilled ? 'cell-opponent-filled' : ''} ${isHighlightedRow ? 'cell-highlighted-row' : ''} ${isHighlightedColumn ? 'cell-highlighted-column' : ''} ${isHighlightedBox ? 'cell-highlighted-box' : ''} ${isHighlightedSameNumber ? 'cell-highlighted-same-number' : ''}`;

  return (
    <div
      className={className}
      data-row={row}
      data-col={col}
      onClick={handleClick}
    >
      {value !== 0 ? value : ''}
      {renderNotesGrid()}
    </div>
  );
}

