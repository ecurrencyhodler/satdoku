'use client';

import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useScoreSubmission } from '../hooks/useScoreSubmission';

export default function WinModal({ isOpen, onClose, onPlayAgain, onKeepPlaying, onChangeDifficulty, onEndGame, stats, onScoreSubmitted, onOpenNameInput, onScoreNotHighEnough, completionId, qualifiedForLeaderboard }) {
  const {
    submitting,
    submitted,
    submissionResult,
    error,
    handleSubmitScore,
    resetSubmissionState,
  } = useScoreSubmission(completionId, qualifiedForLeaderboard, onOpenNameInput, onClose, onScoreNotHighEnough);

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

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      resetSubmissionState();
    }
  }, [isOpen, resetSubmissionState]);

  const handleEndGame = () => {
    if (onEndGame) {
      onEndGame();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Congratulations!</h2>
        <p className="win-message">You solved the puzzle!</p>
        
        {!submitted && error && (
          <div style={{ 
            background: '#fed7d7', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '2px solid #e53e3e'
          }}>
            <p style={{ 
              textAlign: 'center', 
              fontWeight: '600', 
              color: '#742a2a',
              fontSize: '16px'
            }}>
              {error}
            </p>
          </div>
        )}



        <div className="modal-stats">
          <p><strong>Score:</strong> <span>{stats.score}</span></p>
          <p><strong>Moves:</strong> <span>{stats.moves}</span></p>
          <p><strong>Mistakes:</strong> <span>{stats.mistakes}</span></p>
          <p><strong>Lives Purchased:</strong> <span>{stats.livesPurchased}</span></p>
        </div>
        {!submitted && (
          <div className="modal-actions">
            <button 
              onClick={() => {
                if (onKeepPlaying) {
                  onKeepPlaying();
                } else {
                  onPlayAgain();
                }
              }} 
              className="btn btn-primary"
            >
              Keep playing
            </button>
            <button 
              onClick={handleSubmitScore} 
              className="btn btn-secondary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Score'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

