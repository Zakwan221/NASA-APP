/**
 * Shared Supabase client.
 * The app still runs without Supabase keys (Home and Info don't need them);
 * only code that calls getSupabase() will throw a clear error.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let client: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not set up: add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
  }
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

/**
 * Returns the signed-in user's id, signing in anonymously the first time.
 * The session is kept in localStorage, so a refresh keeps the same player.
 */
export async function ensureSignedIn(): Promise<string> {
  const supabase = getSupabase()
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id

  const { data: signIn, error } = await supabase.auth.signInAnonymously()
  if (error || !signIn.user) throw error ?? new Error('Could not sign in')
  return signIn.user.id
}
