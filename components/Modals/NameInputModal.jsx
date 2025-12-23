'use client';

import { useState, useEffect } from 'react';

export default function NameInputModal({ isOpen, onClose, onSubmit, completionId }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setUsername('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  const validateUsername = (name) => {
    if (!name || name.trim().length === 0) {
      return 'Username is required';
    }
    if (name.length > 20) {
      return 'Username must be 20 characters or less';
    }
    // Allow alphanumeric and spaces
    if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
      return 'Username can only contain letters, numbers, and spaces';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const validationError = validateUsername(trimmedUsername);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await onSubmit(trimmedUsername, completionId);
    } catch (err) {
      console.error('Error submitting name:', err);
      setError(err.message || 'Failed to submit name. Please try again.');
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Enter Your Name</h2>
        <p style={{
          textAlign: 'center',
          fontSize: '16px',
          marginBottom: '20px',
          color: '#4a5568'
        }}>
          Your score qualifies for the leaderboard! Enter your name to be displayed.
        </p>

        {error && (
          <div style={{
            background: '#fed7d7',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '15px',
            border: '1px solid #e53e3e'
          }}>
            <p style={{
              textAlign: 'center',
              fontWeight: '600',
              color: '#742a2a',
              fontSize: '14px',
              margin: 0
            }}>
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              value={username}
              onChange={handleChange}
              placeholder="Enter your name (1-20 characters)"
              maxLength={20}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '2px solid #e2e8f0',
                borderRadius: '6px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
              autoFocus
              disabled={submitting}
            />
            <p style={{
              fontSize: '12px',
              color: '#718096',
              marginTop: '6px',
              marginBottom: 0
            }}>
              Letters, numbers, and spaces only
            </p>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !username.trim()}
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
















