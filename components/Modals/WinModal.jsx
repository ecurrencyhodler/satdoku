'use client';

export default function WinModal({ isOpen, onClose, onPlayAgain, onChangeDifficulty, stats }) {
  if (!isOpen) return null;

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Congratulations!</h2>
        <p className="win-message">You solved the puzzle!</p>
        <div className="modal-stats">
          <p><strong>Score:</strong> <span>{stats.score}</span></p>
          <p><strong>Moves:</strong> <span>{stats.moves}</span></p>
          <p><strong>Mistakes:</strong> <span>{stats.mistakes}</span></p>
          <p><strong>Lives Purchased:</strong> <span>{stats.livesPurchased}</span></p>
        </div>
        <div className="modal-actions">
          <button onClick={onPlayAgain} className="btn btn-primary">Play Again</button>
          <button onClick={onChangeDifficulty} className="btn btn-secondary">Change Difficulty</button>
        </div>
      </div>
    </div>
  );
}

