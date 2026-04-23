import { createClient } from '@supabase/supabase-js';

// Service role client — bypasses RLS. Server-side only, never expose to browser.
export const createServiceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
