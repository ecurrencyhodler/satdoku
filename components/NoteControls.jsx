'use client';

export default function NoteControls({ noteMode, onToggleNoteMode, onClear, disabled }) {
  // Pencil icon SVG
  const PencilIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="pencil-icon"
    >
      <path
        d="M11.333 2.667a.667.667 0 0 1 .943 0l1.057 1.057a.667.667 0 0 1 0 .943L9.943 8.943a.667.667 0 0 1-.236.157l-2.667.667a.667.667 0 0 1-.807-.806l.667-2.667a.667.667 0 0 1 .157-.236l3.39-3.39zm-.943 1.886L5.333 9.333l-.334 1.334 1.334-.334 5.057-5.057-1.334-1.334zM2.667 12.667h10.666v1.333H2.667v-1.333z"
        fill="currentColor"
      />
    </svg>
  );

  // Eraser icon SVG
  const EraserIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="eraser-icon"
    >
      <path
        d="M10.667 2.667L13.333 5.333C13.7 5.7 13.7 6.267 13.333 6.633L7.967 12C7.6 12.367 7.033 12.367 6.667 12L4 9.333C3.633 9 3.633 8.433 4 8.067L9.367 2.667C9.733 2.3 10.3 2.3 10.667 2.667ZM6.333 10.667L9.333 7.667L11.667 10L8.667 13L6.333 10.667ZM2.667 12.667H7.333V14H2.667V12.667Z"
        fill="currentColor"
      />
    </svg>
  );

  return (
    <div className="note-controls">
      <button
        className={`btn btn-note-toggle ${noteMode ? 'btn-note-toggle-active' : ''}`}
        onClick={onToggleNoteMode}
        disabled={disabled}
        aria-label={noteMode ? 'Disable notes mode' : 'Enable notes mode'}
      >
        <PencilIcon />
        <span className="btn-label">Notes</span>
      </button>
      <button
        className="btn btn-clear"
        onClick={onClear}
        disabled={disabled}
        aria-label="Clear notes and incorrect guesses"
      >
        <EraserIcon />
        <span className="btn-label">Erase</span>
      </button>
    </div>
  );
}
