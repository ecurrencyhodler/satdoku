'use client';

export default function KeepPlayingModal({ isOpen, onClose, onKeepPlaying, onEndGame }) {
  if (!isOpen) return null;

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Keep Playing!</h2>
        <p style={{
          textAlign: 'center',
          fontSize: '16px',
          marginBottom: '20px',
          color: '#2d3748'
        }}>
          Your score is not high enough to make it to the leaderboard.
        </p>
        <div className="modal-actions">
          <button
            onClick={() => {
              onClose();
              if (onKeepPlaying) {
                onKeepPlaying();
              }
            }}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            Keep playing
          </button>
          <button
            onClick={() => {
              onClose();
              if (onEndGame) {
                onEndGame();
              }
            }}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            End Game
          </button>
        </div>
      </div>
    </div>
  );
}














