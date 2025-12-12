'use client';

import Link from 'next/link';

export default function GamePageHeader({ gameControllerRef, gameState, openWinModal }) {
  return (
    <header>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <h1 style={{ flex: 1, textAlign: 'center', margin: 0 }}>Satdoku</h1>
      </div>
      <div style={{ marginTop: '10px' }}>
        <Link 
          href="/leaderboard" 
          style={{ 
            color: '#4299e1', 
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.color = '#3182ce'}
          onMouseLeave={(e) => e.target.style.color = '#4299e1'}
        >
          View Leaderboard →
        </Link>
      </div>
    </header>
  );
}
