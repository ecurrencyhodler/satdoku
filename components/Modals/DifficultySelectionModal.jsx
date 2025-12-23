'use client';

import { useState, useEffect } from 'react';
import { DIFFICULTY_LEVELS } from '../../src/js/system/constants.js';

export default function DifficultySelectionModal({ isOpen, onClose, onSelectDifficulty }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setLoading(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const difficulties = ['beginner', 'medium', 'hard'];

  const handleDifficultySelect = async (difficulty) => {
    if (loading) return; // Prevent multiple clicks
    
    if (!onSelectDifficulty) {
      setError('Unable to start game. Please try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSelectDifficulty(difficulty);
      // Only close on success - onSelectDifficulty will handle closing
    } catch (err) {
      setError(err.message || 'Failed to start game. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Choose Difficulty</h2>
        <p style={{
          textAlign: 'center',
          fontSize: '16px',
          marginBottom: '20px',
          color: '#2d3748'
        }}>
          Select a difficulty level for your next game. Your stats will be preserved.
        </p>
        
        {error && (
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
              fontSize: '14px'
            }}>
              {error}
            </p>
          </div>
        )}

        <div className="modal-actions" style={{ flexDirection: 'column', gap: '10px' }}>
          {difficulties.map((difficulty) => {
            const difficultyConfig = DIFFICULTY_LEVELS[difficulty];
            if (!difficultyConfig) return null;
            
            return (
              <button
                key={difficulty}
                onClick={() => handleDifficultySelect(difficulty)}
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
              >
                {loading ? 'Starting...' : difficultyConfig.name}
              </button>
            );
          })}
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

