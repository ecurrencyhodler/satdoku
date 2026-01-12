'use client';

export default function RulesSection({ 
  isYou, 
  gameStatus, 
  player2Connected, 
  isWaiting,
  compact 
}) {
  if (!isYou || gameStatus !== 'waiting' || player2Connected !== undefined || isWaiting !== false) {
    return null;
  }

  const rules = compact ? [
    'Type in your name above',
    'Select a difficulty',
    'Invite a challenger by sharing a link',
    'Both players press start to play',
    'Player with more points at the end of the game wins',
    'Cells your opponent fills are highlighted in orange',
    'Buy a life with bitcoin if you run out'
  ] : [
    'Type in your name above',
    'Both players press start to play',
    'Player with more points at the end of the game wins',
    'Cells your opponent fills are highlighted in orange',
    'Buy a life with bitcoin if you run out',
    'Invite a spectator by sharing a link'
  ];

  return (
    <div className="versus-rules">
      <h3 className="versus-rules-title">Versus Rules</h3>
      <ol className="versus-rules-list">
        {rules.map((rule, index) => (
          <li key={index}>{rule}</li>
        ))}
      </ol>
    </div>
  );
}
