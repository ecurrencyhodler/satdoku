'use client';

import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function WinModal({ isOpen, onClose, onPlayAgain, onChangeDifficulty, stats }) {
  const [qualifies, setQualifies] = useState(null);
  const [checking, setChecking] = useState(false);
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

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
    if (isOpen && stats) {
      checkQualification();
    } else {
      // Reset state when modal closes
      setQualifies(null);
      setUsername('');
      setSubmitted(false);
      setError(null);
    }
  }, [isOpen, stats]);

  const checkQualification = async () => {
    if (!stats || !stats.score) {
      setQualifies(false);
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) {
        throw new Error('Failed to check leaderboard');
      }
      const data = await response.json();
      const leaderboard = data.leaderboard || [];

      // Check if score qualifies (less than 10 entries OR score > lowest score)
      if (leaderboard.length < 10) {
        setQualifies(true);
      } else {
        const lowestScore = leaderboard[leaderboard.length - 1]?.score || 0;
        setQualifies(stats.score > lowestScore);
      }
    } catch (err) {
      console.error('Error checking qualification:', err);
      setError('Failed to check leaderboard qualification');
      setQualifies(false);
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          score: stats.score,
          mistakes: stats.mistakes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit score');
      }

      setSubmitted(true);
      setQualifies(false); // Hide the form after successful submission
    } catch (err) {
      console.error('Error submitting score:', err);
      setError(err.message || 'Failed to submit score. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Congratulations!</h2>
        <p className="win-message">You solved the puzzle!</p>
        
        {checking && (
          <p style={{ textAlign: 'center', color: '#718096', marginBottom: '15px' }}>
            Checking leaderboard...
          </p>
        )}

        {!checking && qualifies && !submitted && (
          <div style={{ 
            background: '#edf2f7', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '2px solid #4299e1'
          }}>
            <p style={{ 
              textAlign: 'center', 
              fontWeight: '600', 
              color: '#2d3748', 
              marginBottom: '10px',
              fontSize: '16px'
            }}>
              🎉 Your score qualifies for the leaderboard!
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '10px' }}>
                <label 
                  htmlFor="username" 
                  style={{ 
                    display: 'block', 
                    marginBottom: '5px', 
                    fontWeight: '500', 
                    color: '#4a5568',
                    fontSize: '14px'
                  }}
                >
                  Enter your username:
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your name"
                  maxLength={20}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  disabled={submitting}
                />
              </div>
              {error && (
                <p style={{ 
                  color: '#e53e3e', 
                  fontSize: '14px', 
                  marginBottom: '10px',
                  textAlign: 'center'
                }}>
                  {error}
                </p>
              )}
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting || !username.trim()}
                style={{ width: '100%', marginTop: '5px' }}
              >
                {submitting ? 'Submitting...' : 'Submit to Leaderboard'}
              </button>
            </form>
          </div>
        )}

        {submitted && (
          <div style={{ 
            background: '#c6f6d5', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '2px solid #48bb78'
          }}>
            <p style={{ 
              textAlign: 'center', 
              fontWeight: '600', 
              color: '#22543d',
              fontSize: '16px'
            }}>
              ✅ Score submitted to leaderboard!
            </p>
          </div>
        )}

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

