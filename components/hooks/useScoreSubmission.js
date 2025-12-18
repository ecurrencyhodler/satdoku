import { useState, useCallback } from 'react';

/**
 * Hook for handling score submission to leaderboard
 * Now uses completionId-based submission
 */
export function useScoreSubmission(completionId, qualifiedForLeaderboard, onOpenNameInput, onClose, onScoreNotHighEnough) {
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
    if (!completionId) {
      setError('No completion ID available');
      return;
    }

    // If not qualified, show keep playing modal
    if (!qualifiedForLeaderboard) {
      if (onScoreNotHighEnough) {
        setTimeout(() => {
          onClose();
          onScoreNotHighEnough();
        }, 100);
      }
      return;
    }

    // Qualified - open name input modal
    if (onOpenNameInput) {
      setTimeout(() => {
        onClose();
        onOpenNameInput(completionId);
      }, 100);
    }
  }, [completionId, qualifiedForLeaderboard, onOpenNameInput, onClose, onScoreNotHighEnough]);

  const handleSubmitWithUsername = useCallback(async (username) => {
    if (!completionId || !username) {
      setError('Completion ID and username are required');
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
        credentials: 'include', // Include cookies
        body: JSON.stringify({ completionId, username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit score');
      }

      setSubmitted(true);
      setSubmissionResult(data);
    } catch (err) {
      console.error('Error submitting score:', err);
      setError(err.message || 'Failed to submit score. Please try again.');
      setSubmissionResult({ success: false });
    } finally {
      setSubmitting(false);
    }
  }, [completionId]);

  return {
    submitting,
    submitted,
    submissionResult,
    error,
    handleSubmitScore,
    handleSubmitWithUsername,
    resetSubmissionState,
  };
}







