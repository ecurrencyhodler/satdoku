'use client';

export default function TutorChatMessage({ role, content }) {
  const isUser = role === 'user';

  return (
    <div className={`tutor-chat-message ${isUser ? 'tutor-chat-message-user' : 'tutor-chat-message-assistant'}`}>
      <div className="tutor-chat-message-content">
        {content}
      </div>
    </div>
  );
}

