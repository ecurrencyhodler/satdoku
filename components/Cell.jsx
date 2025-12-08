'use client';

export default function Cell({ 
  row, 
  col, 
  value, 
  isPrefilled, 
  isSelected, 
  completedRow, 
  completedColumn,
  completedBox, 
  onClick,
  hasLives 
}) {
  // Determine if cell is locked (prefilled or user-filled with a value)
  const isLocked = isPrefilled || (value !== 0);

  const handleClick = () => {
    // Only allow clicks on empty, non-locked cells when lives are available
    if (hasLives && !isLocked) {
      onClick(row, col);
    }
  };

  return (
    <div
      className={`cell ${isPrefilled ? 'cell-prefilled' : ''} ${isLocked && !isPrefilled ? 'cell-locked' : ''} ${isSelected ? 'cell-selected' : ''} ${completedRow ? 'cell-completed-row' : ''} ${completedColumn ? 'cell-completed-column' : ''} ${completedBox ? 'cell-completed-box' : ''}`}
      data-row={row}
      data-col={col}
      onClick={handleClick}
    >
      {value !== 0 ? value : ''}
    </div>
  );
}

