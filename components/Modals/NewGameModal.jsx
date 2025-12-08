'use client';

export default function NewGameModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Start New Game?</h2>
        <p>This will reset your current progress.</p>
        <div className="modal-actions">
          <button onClick={onConfirm} className="btn btn-primary">Start New Game</button>
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

