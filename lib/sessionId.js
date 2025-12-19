/**
 * Generate or retrieve session ID
 * Stores in localStorage as fallback, but primary storage will be in Redis via API
 */
export function getSessionId() {
  if (typeof window === 'undefined') {
    return null;
  }

  const STORAGE_KEY = 'satdoku_session_id';

  let sessionId = localStorage.getItem(STORAGE_KEY);

  if (!sessionId) {
    // Generate a new session ID
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, sessionId);
  }

  return sessionId;
}







