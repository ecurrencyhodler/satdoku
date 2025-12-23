'use client';

import { useState, useRef, useEffect } from 'react';
import './Snowfall.css';

const SNOWFLAKE_COUNT = 30;
const SNOWFLAKE_COOKIE_NAME = 'satdoku_snowflakes_shown';

// Helper functions to manage cookies
function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setSessionCookie(name, value) {
  if (typeof document === 'undefined') return;
  // No max-age or expires = session cookie (expires when browser closes)
  document.cookie = `${name}=${value}; path=/; SameSite=Lax`;
}

export default function Snowfall() {
  const [isVisible, setIsVisible] = useState(false);
  const [snowflakeData, setSnowflakeData] = useState([]);
  const completedCountRef = useRef(0);

  // Check if snowflakes have already been shown for this browser session
  useEffect(() => {
    const hasShownSnowflakes = getCookie(SNOWFLAKE_COOKIE_NAME);

    if (!hasShownSnowflakes) {
      // Mark that snowflakes have been shown for this session
      setSessionCookie(SNOWFLAKE_COOKIE_NAME, 'true');
      setIsVisible(true);

      // Generate snowflake data only on client side to avoid hydration mismatch
      setSnowflakeData(
        Array.from({ length: SNOWFLAKE_COUNT }, (_, i) => ({
          id: i,
          left: `${(i * (100 / SNOWFLAKE_COUNT)) + Math.random() * (100 / SNOWFLAKE_COUNT)}%`,
          delay: Math.random() * 2,
          duration: 3 + Math.random() * 4,
          opacity: 0.7 + Math.random() * 0.3,
        }))
      );
    }
  }, []);

  const handleAnimationEnd = () => {
    completedCountRef.current += 1;
    if (completedCountRef.current >= SNOWFLAKE_COUNT) {
      setIsVisible(false);
    }
  };

  if (!isVisible || snowflakeData.length === 0) return null;

  return (
    <div className="snowfall-container">
      {snowflakeData.map((snowflake) => (
        <div
          key={snowflake.id}
          className="snowflake"
          style={{
            left: snowflake.left,
            animationDelay: `${snowflake.delay}s`,
            animationDuration: `${snowflake.duration}s`,
            opacity: snowflake.opacity,
          }}
          onAnimationEnd={handleAnimationEnd}
        >
          ❄
        </div>
      ))}
    </div>
  );
}

