'use client';

export default function Cell({ 
  row, 
  col, 
  value, 
  isPrefilled, 
  isIncorrect,
  isSelected, 
  isHighlightedRow,
  isHighlightedColumn,
  isHighlightedBox,
  isHighlightedSameNumber,
  onClick,
  hasLives 
}) {
  // Determine if cell is locked (prefilled or user-filled with a value)
  // Note: Cells with incorrect values should still be editable, so we don't consider them locked
  const isLocked = isPrefilled || (value !== 0 && !isIncorrect);

  const handleClick = () => {
    // Allow clicks on any cell for highlighting
    // Input processing will be handled by useCellInput hook which checks if cell is empty and has lives
    onClick(row, col);
  };

  return (
    <div
      className={`cell ${isPrefilled ? 'cell-prefilled' : ''} ${isLocked && !isPrefilled ? 'cell-locked' : ''} ${isIncorrect ? 'cell-incorrect' : ''} ${isSelected ? 'cell-selected' : ''} ${isHighlightedRow ? 'cell-highlighted-row' : ''} ${isHighlightedColumn ? 'cell-highlighted-column' : ''} ${isHighlightedBox ? 'cell-highlighted-box' : ''} ${isHighlightedSameNumber ? 'cell-highlighted-same-number' : ''}`}
      data-row={row}
      data-col={col}
      onClick={handleClick}
    >
      {value !== 0 ? value : ''}
    </div>
  );
}

