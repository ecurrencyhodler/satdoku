'use client';

import { DIFFICULTY_LEVELS } from '../src/js/system/constants.js';

export default function StatsBar({ lives, score, mistakes, difficulty }) {
  return (
    <div className="stats-bar">
      <div className="stat">
        <span className="stat-label">Lives:</span>
        <span className="stat-value">{lives}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Score:</span>
        <span className="stat-value">{score}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Mistakes:</span>
        <span className="stat-value">{mistakes}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Difficulty:</span>
        <span className="stat-value">{DIFFICULTY_LEVELS[difficulty].name}</span>
      </div>
    </div>
  );
}

