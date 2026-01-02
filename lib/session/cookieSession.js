import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'satdoku_session_id';
const SESSION_MAX_AGE = 90 * 24 * 60 * 60; // 90 days

/**
 * Get or create session ID from cookie
 * @returns {Promise<string>} Session ID
 */
export async function getSessionId() {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    // Generate a new session ID
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // Set cookie with session ID
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });
  }

  return sessionId;
}

/**
 * Get session ID from cookie without creating a new one
 * @returns {Promise<string|null>} Session ID or null if not found
 */
export async function getSessionIdIfExists() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}



















