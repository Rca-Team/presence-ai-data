import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Supabase client — credentials come from Replit environment variables.
 *
 * Required env vars (set in Replit Secrets / Environment):
 *   VITE_SUPABASE_URL              — Project URL (e.g. https://xxx.supabase.co)
 *   VITE_SUPABASE_PUBLISHABLE_KEY  — Anon (public) key
 *
 * This project is backed by the Lovable cloud Supabase project:
 *   Project ref: eiahucigcvsnuvviajqt
 *
 * The anon key is safe to expose client-side; Row Level Security (RLS)
 * on the Supabase side controls data access.
 */

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://eiahucigcvsnuvviajqt.supabase.co';   // fallback = Lovable cloud project

const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpYWh1Y2lnY3ZzbnV2dmlhanF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDA5NDEsImV4cCI6MjA5MzQ3Njk0MX0.nPl7U5Sm5Rm2zFnwLO3RzjOnkrIbrzEfFzSgkbLnX_I';

if (
  !import.meta.env.VITE_SUPABASE_URL ||
  !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
) {
  console.info(
    '[Supabase] Using built-in Lovable cloud credentials. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Replit env to override.'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
