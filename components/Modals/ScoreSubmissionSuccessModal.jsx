'use client';

export default function ScoreSubmissionSuccessModal({ isOpen, onClose, onViewLeaderboard }) {
  if (!isOpen) return null;

  return (
    <div className="modal show">
      <div className="modal-content score-submission-success-modal">
        <h2>Success!</h2>
        <p style={{
          textAlign: 'center',
          fontSize: '16px',
          marginBottom: '20px',
          color: '#2d3748'
        }}>
          You're a Satdoku leader and your score has been added to the leaderboard.
        </p>
        <div className="modal-actions">
          <button
            onClick={onViewLeaderboard}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            View Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
















