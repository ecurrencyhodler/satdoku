import { SCORE_VALUES } from '../../src/js/system/constants.js';
import { GameValidation } from './gameValidation.js';

/**
 * Game scoring utilities
 */
export class GameScoring {
  /**
   * Process correct move and calculate score
   */
  static processCorrectMove(state, row, col) {
    const events = [];
    let points = 0;
    const completedRows = [...state.completedRows];
    const completedColumns = [...state.completedColumns];
    const completedBoxes = [...state.completedBoxes];

    // Check for row completion
    if (!completedRows.includes(row) && GameValidation.isRowComplete(state.currentBoard, row)) {
      completedRows.push(row);
      points += SCORE_VALUES.completeRow;
      events.push({
        type: 'row',
        row,
        score: SCORE_VALUES.completeRow
      });
    }

    // Check for column completion
    if (!completedColumns.includes(col) && GameValidation.isColumnComplete(state.currentBoard, col)) {
      completedColumns.push(col);
      points += SCORE_VALUES.completeColumn;
      events.push({
        type: 'column',
        column: col,
        score: SCORE_VALUES.completeColumn
      });
    }

    // Check for box completion
    const boxIndex = GameValidation.getBoxIndex(row, col);
    if (!completedBoxes.includes(boxIndex) && GameValidation.isBoxComplete(state.currentBoard, row, col)) {
      completedBoxes.push(boxIndex);
      points += SCORE_VALUES.completeBox;
      events.push({
        type: 'box',
        boxIndex,
        score: SCORE_VALUES.completeBox
      });
    }

    // Always add point for correct cell
    points += SCORE_VALUES.correctCell;
    events.push({
      type: 'cell',
      row,
      col,
      score: SCORE_VALUES.correctCell
    });

    return {
      points,
      events,
      completedRows,
      completedColumns,
      completedBoxes,
      scoreDelta: {
        points,
        events
      }
    };
  }
}


