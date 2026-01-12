'use client';

import GameBoard from './GameBoard.jsx';
import NumberPad from './NumberPad.jsx';
import NoteControls from './NoteControls.jsx';

/**
 * Component for rendering the versus game board with controls
 */
export default function VersusGameBoard({
  gameState,
  selectedCell,
  opponentSelectedCell,
  onCellClick,
  handleCellInput,
  handleErase,
  noteMode,
  setNoteMode,
  yourData,
  opponentFilledCells,
  isSpectator,
  boardVisible,
  showCountdown,
  calculatedCountdown,
  VersusCountdown
}) {
  const toggleNoteMode = () => setNoteMode(prev => !prev);
  if (!gameState) {
    return null;
  }

  return (
    <>
      {showCountdown && (
        <VersusCountdown 
          countdown={calculatedCountdown} 
          visible={true}
        />
      )}
      {boardVisible ? (
        <GameBoard
          board={gameState.board}
          puzzle={gameState.puzzle}
          solution={gameState.solution}
          selectedCell={selectedCell}
          onCellClick={onCellClick}
          hasLives={yourData?.lives > 0}
          notes={gameState.notes || []}
          noteMode={noteMode}
          opponentSelectedCell={opponentSelectedCell}
          opponentFilledCells={isSpectator ? null : opponentFilledCells}
          clearedMistakes={isSpectator ? null : (gameState.clearedMistakes || [])}
        />
      ) : (
        <GameBoard
          board={Array(9).fill(null).map(() => Array(9).fill(0))}
          puzzle={Array(9).fill(null).map(() => Array(9).fill(0))}
          solution={null}
          selectedCell={null}
          onCellClick={() => {}}
          hasLives={true}
          notes={[]}
          noteMode={false}
          opponentSelectedCell={null}
          opponentFilledCells={null}
        />
      )}
      {!isSpectator && (
        <div className="versus-controls-container">
          <NumberPad
            onNumberClick={handleCellInput}
            disabled={!selectedCell || (gameState.status !== 'active' && gameState.gameStatus !== 'playing')}
            versus={true}
          />
          <NoteControls
            noteMode={noteMode}
            onToggleNoteMode={toggleNoteMode}
            onClear={handleErase}
            disabled={gameState.status !== 'active' && gameState.gameStatus !== 'playing'}
            versus={true}
          />
        </div>
      )}
    </>
  );
}
