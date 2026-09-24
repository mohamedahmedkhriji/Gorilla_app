import { createClient } from '@supabase/supabase-js';

let cachedClient = null;

export const isSupabaseConfigured = () => (
  Boolean(String(process.env.SUPABASE_URL || '').trim())
  && Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim())
);

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient(
    String(process.env.SUPABASE_URL || '').trim(),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return cachedClient;
};
