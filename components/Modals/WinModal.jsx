'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function WinModal({ isOpen, onClose, onPlayAgain, onChangeDifficulty, stats }) {
  useEffect(() => {
    if (isOpen) {
      // Trigger confetti celebration
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f56565'];

      (function frame() {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }
  }, [isOpen]);

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

