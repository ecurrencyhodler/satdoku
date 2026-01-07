'use client';

export default function VersusWinModal({ show, winStats, onClose }) {
  if (!show || !winStats) return null;

  const { winner, player1, player2 } = winStats || {};
  if (!winner || !player1 || !player2) return null;
  
  const isPlayer1Winner = winner === 'player1';
  const winnerData = isPlayer1Winner ? player1 : player2;
  const loserData = isPlayer1Winner ? player2 : player1;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content versus-win-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Game Over!</h2>
        <div className="versus-results">
          <div className="winner-section">
            <div className="winner-badge">Winner</div>
            <div className="winner-name">{winnerData?.name || 'Player'}</div>
            <div className="winner-score">Score: {winnerData?.score || 0}</div>
          </div>
          <div className="loser-section">
            <div className="loser-name">{loserData?.name || 'Player'}</div>
            <div className="loser-score">Score: {loserData?.score || 0}</div>
          </div>
        </div>
        <button onClick={onClose} className="modal-close-button">
          Close
        </button>
      </div>
    </div>
  );
}

