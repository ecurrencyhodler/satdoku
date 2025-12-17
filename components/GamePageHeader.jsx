'use client';

export default function GamePageHeader({ gameControllerRef, gameState }) {
  return (
    <header style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Satdoku</h1>
      </div>
    </header>
  );
}




