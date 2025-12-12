import { useState, useCallback } from 'react';
import { getSessionId } from '../../lib/sessionId';

/**
 * Hook for handling score submission to leaderboard
 */
export function useScoreSubmission(stats, onOpenNameInput, onClose, onScoreNotHighEnough) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [error, setError] = useState(null);

  const resetSubmissionState = useCallback(() => {
    setSubmitted(false);
    setSubmissionResult(null);
    setError(null);
  }, []);

  const handleSubmitScore = useCallback(async () => {
    if (!stats || !stats.score) {
      setError('No score to submit');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const sessionId = getSessionId();
      if (!sessionId) {
        throw new Error('Session ID not found');
      }

      // First check if score qualifies (without username)
      const requestBody = { sessionId, score: stats.score };
      const response = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit score');
      }

      // If score qualifies, open name input modal instead of immediately submitting
      if (data.qualifies && onOpenNameInput) {
        setTimeout(() => {
          onClose();
          onOpenNameInput(sessionId, stats.score);
        }, 100);
        return; // Don't set submitted state since we're opening name input modal
      }
      
      // Score doesn't qualify - close win modal and show keep playing modal
      setSubmitted(true);
      setSubmissionResult(data);
      if (onScoreNotHighEnough) {
        setTimeout(() => {
          onClose();
          onScoreNotHighEnough();
        }, 100);
      }
    } catch (err) {
      console.error('Error submitting score:', err);
      setError(err.message || 'Failed to submit score. Please try again.');
      setSubmissionResult({ success: false, qualifies: false });
    } finally {
      setSubmitting(false);
    }
  }, [stats, onOpenNameInput, onClose, onScoreNotHighEnough]);

  return {
    submitting,
    submitted,
    submissionResult,
    error,
    handleSubmitScore,
    resetSubmissionState,
  };
}
