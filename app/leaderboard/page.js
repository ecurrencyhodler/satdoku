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
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
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

      <div className="github-link-container">
        <a 
          href="https://github.com/ecurrencyhodler" 
          target="_blank" 
          rel="noopener noreferrer"
          className="github-link"
          aria-label="GitHub"
        >
          <svg 
            height="32" 
            aria-hidden="true" 
            viewBox="0 0 16 16" 
            version="1.1" 
            width="32" 
            fill="currentColor"
          >
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
          </svg>
        </a>
      </div>
    </div>
  );
}
