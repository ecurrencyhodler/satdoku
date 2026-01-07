'use client';

import { useState } from 'react';

export default function VersusInviteUrl({ roomUrl }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const fullUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}${roomUrl}`
        : roomUrl;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const fullUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${roomUrl}`
    : roomUrl;

  return (
    <div className="versus-invite-url">
      <div className="invite-url-container">
        <input
          type="text"
          value={fullUrl}
          readOnly
          className="invite-url-input"
        />
        <button
          onClick={handleCopy}
          className="copy-button"
          aria-label="Copy invite URL"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="invite-url-hint">Share this URL with your opponent</p>
    </div>
  );
}

