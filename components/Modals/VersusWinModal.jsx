'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function VersusWinModal({ show, winStats, onClose }) {
  useEffect(() => {
    if (show) {
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
  }, [show]);

  if (!show || !winStats) return null;

  const { winner, player1, player2 } = winStats || {};
  if (!winner || !player1 || !player2) return null;
  
  const isPlayer1Winner = winner === 'player1';
  const winnerData = isPlayer1Winner ? player1 : player2;
  const loserData = isPlayer1Winner ? player2 : player1;

  return (
    <div className="modal-overlay versus-win-modal-overlay">
      <div className="modal-content versus-win-modal">
        <button onClick={onClose} className="versus-win-modal-close" aria-label="Close">
          ×
        </button>
        <h2>Game Over!</h2>
        <div className="versus-results">
          <div className="winner-section">
            <div className="winner-badge">Winner</div>
            <div className="winner-name">{winnerData?.name || 'Player'}</div>
            <div className="winner-score">Score: {winnerData?.score || 0}</div>
          </div>
          <div className="loser-section">
            <div className="loser-badge">Loser</div>
            <div className="loser-name">{loserData?.name || 'Player'}</div>
            <div className="loser-score">Score: {loserData?.score || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

