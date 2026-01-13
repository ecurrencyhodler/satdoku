import { createClient } from '@supabase/supabase-js';

// Singleton Supabase admin client instance (reused across all server requests)
let adminClientInstance = null;

/**
 * Create or get existing Supabase admin client with service role key
 * Uses singleton pattern to reuse a single client instance and reduce connections
 * Bypasses RLS and should only be used server-side
 */
export function createSupabaseAdminClient() {
  // Reuse existing client if available
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  
  // Create singleton instance
  adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  return adminClientInstance;
}
