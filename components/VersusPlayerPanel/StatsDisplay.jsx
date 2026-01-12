'use client';

export default function StatsDisplay({ player, compact }) {
  if (compact) {
    return (
      <>
        <div className="player-score">Score: {player?.score || 0}</div>
        <div className="player-lives">Lives: {player?.lives || 0}</div>
        <div className="player-mistakes">Mistakes: {player?.mistakes || 0}</div>
      </>
    );
  }

  return (
    <div className="player-stats">
      <div className="stat">
        <span className="stat-label">Score:</span>
        <span className="stat-value">{player?.score || 0}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Lives:</span>
        <span className="stat-value">{player?.lives || 0}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Mistakes:</span>
        <span className="stat-value">{player?.mistakes || 0}</span>
      </div>
    </div>
  );
}
