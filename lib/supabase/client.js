import { createClient } from '@supabase/supabase-js';

// Singleton Supabase client instance for server-side usage (reused across all server requests)
let supabaseClientInstance = null;

/**
 * Create or get existing Supabase client for server-side usage
 * Uses singleton pattern to reuse a single client instance and reduce connections
 * Reads environment variables automatically
 */
export function createSupabaseClient() {
  // Reuse existing client if available
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );
  }

  // Create singleton instance
  supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClientInstance;
}







