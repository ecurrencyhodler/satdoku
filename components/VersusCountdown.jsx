'use client';

export default function VersusCountdown({ countdown, visible }) {
  if (!visible || countdown === null || countdown === undefined) return null;

  if (countdown === 0) {
    return (
      <div className="versus-countdown">
        <div className="countdown-content">
          <div className="countdown-number go">GO!</div>
        </div>
      </div>
    );
  }

  return (
    <div className="versus-countdown">
      <div className="countdown-content">
        <div className="countdown-number">{countdown}</div>
      </div>
    </div>
  );
}

