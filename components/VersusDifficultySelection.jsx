'use client';

export default function VersusDifficultySelection({
  playerName,
  onPlayerNameChange,
  onDifficultySelect
}) {
  return (
    <div className="versus-create-wrapper">
      <div className="container versus-create-container">
        <header>
          <h1>Satdoku</h1>
        </header>
        <div className="versus-rules">
          <h3 className="versus-rules-title">Versus Rules</h3>
          <ol className="versus-rules-list">
            <li>Type in your name below</li>
            <li>Select a difficulty</li>
            <li>Invite a challenger by sharing a link</li>
            <li>Both players press start to play</li>
            <li>Player with more points at the end of the gamewins</li>
            <li>Cells your opponent fills are highlighted in orange</li>
            <li>Buy a life with bitcoin if you run out</li>
          </ol>
        </div>
        <h2 className="versus-create-heading"></h2>
        <div className="difficulty-selection">
          <label className="versus-form-label">Your Name:</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            maxLength={20}
            className="name-input versus-name-input"
            placeholder="Player 1"
            autoFocus
          />
          <label className="versus-form-label">Select Difficulty:</label>
          <div className="difficulty-buttons">
            <button onClick={() => onDifficultySelect('beginner')}>Beginner</button>
            <button onClick={() => onDifficultySelect('medium')}>Medium</button>
            <button onClick={() => onDifficultySelect('hard')}>Hard</button>
          </div>
        </div>
      </div>
    </div>
  );
}
