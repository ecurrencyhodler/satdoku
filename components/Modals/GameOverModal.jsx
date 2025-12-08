'use client';

export default function GameOverModal({ isOpen, onClose, onRestart, onChangeDifficulty, stats }) {
  if (!isOpen) return null;

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Game Over</h2>
        <div className="modal-stats">
          <p><strong>Score:</strong> <span>{stats.score}</span></p>
          <p><strong>Moves:</strong> <span>{stats.moves}</span></p>
          <p><strong>Mistakes:</strong> <span>{stats.mistakes}</span></p>
        </div>
        <div className="modal-actions">
          <button onClick={onRestart} className="btn btn-primary">Restart Game</button>
          <button onClick={onChangeDifficulty} className="btn btn-secondary">Change Difficulty</button>
        </div>
      </div>
    </div>
  );
}

