'use client';

export default function GameControls({ difficulty, onDifficultyChange, onNewGame, gameInProgress }) {
  return (
    <div className="game-controls">
      <div className="difficulty-selector">
        <label htmlFor="difficulty">Difficulty:</label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value)}
        >
          <option value="beginner">Beginner</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <button onClick={onNewGame} className="btn btn-primary">
        New Game
      </button>
    </div>
  );
}

