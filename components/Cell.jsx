'use client';

export default function Cell({ 
  row, 
  col, 
  value, 
  isPrefilled, 
  isSelected, 
  isHighlightedRow,
  isHighlightedColumn,
  isHighlightedSameNumber,
  onClick,
  hasLives 
}) {
  // Determine if cell is locked (prefilled or user-filled with a value)
  const isLocked = isPrefilled || (value !== 0);

  const handleClick = () => {
    // Allow clicks on any cell for highlighting
    // Input processing will be handled by useCellInput hook which checks if cell is empty and has lives
    onClick(row, col);
  };

  return (
    <div
      className={`cell ${isPrefilled ? 'cell-prefilled' : ''} ${isLocked && !isPrefilled ? 'cell-locked' : ''} ${isSelected ? 'cell-selected' : ''} ${isHighlightedRow ? 'cell-highlighted-row' : ''} ${isHighlightedColumn ? 'cell-highlighted-column' : ''} ${isHighlightedSameNumber ? 'cell-highlighted-same-number' : ''}`}
      data-row={row}
      data-col={col}
      onClick={handleClick}
    >
      {value !== 0 ? value : ''}
    </div>
  );
}

