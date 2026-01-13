import { createClient } from '@supabase/supabase-js';
import monitor from './connectionMonitor.js';

// Singleton Supabase client instance (reused across all connections)
let supabaseClientInstance = null;

/**
 * Create or get existing Supabase client for browser/client-side usage
 * Uses singleton pattern to reuse a single client instance
 * Uses anon key (subject to RLS)
 */
export function createSupabaseBrowserClient() {
  // Reuse existing client if available
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use the anon key (JWT format) - this is the correct client-side key
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  // Track client creation with stack trace (only on first creation)
  const stackTrace = new Error().stack;
  supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey);
  monitor.trackClientCreated('createSupabaseBrowserClient', stackTrace);

  return supabaseClientInstance;
}
