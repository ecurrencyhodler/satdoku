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
        <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
          Loading leaderboard...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#e53e3e', background: '#fed7d7', borderRadius: '6px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
              <p>No scores yet. Be the first to make it to the leaderboard!</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '20px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#4a5568' }}>Rank</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#4a5568' }}>Name</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#4a5568' }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr 
                      key={index} 
                      style={{ 
                        borderBottom: '1px solid #e2e8f0',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f7fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px', fontWeight: '600', color: '#2d3748' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '12px', color: '#4a5568', fontSize: '14px' }}>
                        {entry.username || entry.sessionId}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: '#2d3748' }}>
                        {entry.score.toLocaleString()}
                      </td>
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
