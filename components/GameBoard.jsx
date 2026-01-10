'use client';

import Cell from './Cell';
import { BOARD_SIZE } from '../src/js/system/constants.js';

export default function GameBoard({
  board,
  puzzle,
  solution,
  selectedCell,
  onCellClick,
  hasLives,
  notes = [],
  noteMode = false,
  opponentSelectedCell = null,
  opponentFilledCells = null,
  clearedMistakes = null
}) {
  const getBoxIndex = (row, col) => {
    const boxRow = Math.floor(row / 3);
    const boxCol = Math.floor(col / 3);
    return boxRow * 3 + boxCol;
  };

  if (!board || !Array.isArray(board)) {
    return <div>Error: Board is not properly initialized</div>;
  }

  if (!puzzle || !Array.isArray(puzzle)) {
    return <div>Error: Puzzle is not properly initialized</div>;
  }

  return (
    <div className="game-board-container">
      <div id="game-board" className={`game-board ${noteMode ? 'notes-mode' : ''}`}>
        {Array.from({ length: BOARD_SIZE }, (_, row) => {
          // Defensive check: ensure board[row] exists
          if (!board[row] || !Array.isArray(board[row])) {
            // Return empty cells for this row to prevent crash
            return Array.from({ length: BOARD_SIZE }, (_, col) => (
              <Cell
                key={`${row}-${col}`}
                row={row}
                col={col}
                value={0}
                isPrefilled={false}
                isSelected={false}
                isHighlightedRow={false}
                isHighlightedColumn={false}
                isHighlightedBox={false}
                isHighlightedSameNumber={false}
                onClick={() => onCellClick(row, col)}
                hasLives={hasLives}
                notes={notes[row]?.[col] || []}
              />
            ));
          }

          return Array.from({ length: BOARD_SIZE }, (_, col) => {
            const cellKey = `${row},${col}`;
            const isClearedMistake = clearedMistakes && clearedMistakes.includes(cellKey);
            
            // If this mistake was cleared by the current player, show it as empty
            const displayValue = isClearedMistake ? 0 : (board[row]?.[col] ?? 0);
            
            const isPrefilled = puzzle?.[row]?.[col] !== 0;
            const isSelected = selectedCell?.row === row && selectedCell?.col === col;
            const isOpponentSelected = opponentSelectedCell?.row === row && opponentSelectedCell?.col === col;
            const isOpponentFilled = opponentFilledCells && opponentFilledCells.has(cellKey);

            // Determine if the value is incorrect (user-entered but doesn't match solution)
            // Use the actual board value (not displayValue) to check if it's a mistake
            const actualValue = board[row]?.[col] ?? 0;
            const isIncorrect = !isPrefilled && actualValue !== 0 && solution && solution[row]?.[col] !== 0 && actualValue !== solution[row]?.[col] && !isClearedMistake;

            // Calculate highlighting based on selected cell
            let isHighlightedRow = false;
            let isHighlightedColumn = false;
            let isHighlightedBox = false;
            let isHighlightedSameNumber = false;

            if (selectedCell) {
              // Get display value for selected cell (accounting for cleared mistakes)
              const selectedCellKey = `${selectedCell.row},${selectedCell.col}`;
              const isSelectedClearedMistake = clearedMistakes && clearedMistakes.includes(selectedCellKey);
              const selectedValue = isSelectedClearedMistake ? 0 : (board[selectedCell.row]?.[selectedCell.col] ?? 0);
              const isSelectedCellEmpty = selectedValue === 0;

              if (isSelectedCellEmpty) {
                // Empty cell: highlight row, column, and box
                isHighlightedRow = row === selectedCell.row;
                isHighlightedColumn = col === selectedCell.col;
                const selectedBoxIndex = getBoxIndex(selectedCell.row, selectedCell.col);
                const currentBoxIndex = getBoxIndex(row, col);
                isHighlightedBox = selectedBoxIndex === currentBoxIndex;
              } else {
                // Filled cell: highlight all cells with the same number
                isHighlightedSameNumber = displayValue === selectedValue && displayValue !== 0;
              }
            }

            return (
              <Cell
                key={`${row}-${col}`}
                row={row}
                col={col}
                value={displayValue}
                isPrefilled={isPrefilled}
                isIncorrect={isIncorrect}
                isSelected={isSelected}
                isOpponentSelected={isOpponentSelected}
                isOpponentFilled={isOpponentFilled}
                isHighlightedRow={isHighlightedRow}
                isHighlightedColumn={isHighlightedColumn}
                isHighlightedBox={isHighlightedBox}
                isHighlightedSameNumber={isHighlightedSameNumber}
                onClick={() => onCellClick(row, col)}
                hasLives={hasLives}
                notes={notes[row]?.[col] || []}
              />
            );
          });
        })}
      </div>
    </div>
  );
}

