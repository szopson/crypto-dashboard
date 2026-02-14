/**
 * Supabase Client Configuration
 *
 * This module provides Supabase client instances for both client-side
 * and server-side usage in Next.js.
 */
import { createBrowserClient } from "@supabase/ssr";

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Create a Supabase client for browser/client-side usage.
 * This client handles auth state automatically via cookies.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Singleton client instance for convenience.
 * Use this in React components and hooks.
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

// Export types for convenience
export type { User, Session } from "@supabase/supabase-js";
