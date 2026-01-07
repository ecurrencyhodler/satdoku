'use client';

export default function VersusReconnecting({ isReconnecting }) {
  if (!isReconnecting) return null;

  return (
    <div className="versus-reconnecting">
      <div className="reconnecting-content">
        <div className="reconnecting-spinner"></div>
        <p>Reconnecting...</p>
      </div>
    </div>
  );
}

