'use client';

export default function NameInput({ 
  value, 
  onChange, 
  onFocus, 
  onBlur, 
  placeholder, 
  canEdit,
  playerName,
  compact 
}) {
  if (canEdit) {
    return (
      <input
        type="text"
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.target.blur();
          }
        }}
        className="name-input"
        maxLength={20}
        placeholder={placeholder}
      />
    );
  }
  return <span>{playerName || 'Player'}</span>;
}
