'use client';

import Cell from './Cell';
import { BOARD_SIZE } from '../src/js/system/constants.js';

export default function GameBoard({ 
  board, 
  puzzle, 
  selectedCell, 
  completedRows, 
  completedColumns,
  completedBoxes,
  onCellClick,
  hasLives 
}) {

  const getBoxIndex = (row, col) => {
    const boxRow = Math.floor(row / 3);
    const boxCol = Math.floor(col / 3);
    return boxRow * 3 + boxCol;
  };

  return (
    <div className="game-board-container">
      <div id="game-board" className="game-board">
        {Array.from({ length: BOARD_SIZE }, (_, row) =>
          Array.from({ length: BOARD_SIZE }, (_, col) => {
            const value = board[row][col];
            const isPrefilled = puzzle[row][col] !== 0;
            const isSelected = selectedCell?.row === row && selectedCell?.col === col;
            const completedRow = completedRows.includes(row);
            const completedColumn = completedColumns.includes(col);
            const boxIndex = getBoxIndex(row, col);
            const completedBox = completedBoxes.includes(boxIndex);

            return (
              <Cell
                key={`${row}-${col}`}
                row={row}
                col={col}
                value={value}
                isPrefilled={isPrefilled}
                isSelected={isSelected}
                completedRow={completedRow}
                completedColumn={completedColumn}
                completedBox={completedBox}
                onClick={onCellClick}
                hasLives={hasLives}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

