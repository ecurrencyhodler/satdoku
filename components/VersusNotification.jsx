'use client';

import { useEffect, useState } from 'react';

export default function VersusNotification({ notification, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        if (onClose) {
          setTimeout(onClose, 300); // Wait for fade out
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification || !visible) return null;

  let message = '';
  if (notification.type === 'life_purchased') {
    message = `${notification.playerName} purchased a life!`;
  }

  return (
    <div className={`versus-notification ${visible ? 'visible' : ''}`}>
      <div className="notification-content">
        {message}
      </div>
    </div>
  );
}

