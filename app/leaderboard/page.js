'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/leaderboard');
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Leaderboard</h1>
      </header>

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Link href="/" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Back to Game
        </Link>
      </div>

      {loading && (
        <div className="leaderboard-loading">
          Loading leaderboard...
        </div>
      )}

      {error && (
        <div className="leaderboard-error">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {leaderboard.length === 0 ? (
            <div className="leaderboard-empty">
              <p>No scores yet. Be the first to make it to the leaderboard!</p>
            </div>
          ) : (
            <div className="leaderboard-table-container">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{entry.username || entry.sessionId}</td>
                      <td>{entry.score.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
