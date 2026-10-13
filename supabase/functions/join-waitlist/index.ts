import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createWaitlistHandler } from '../_shared/waitlist-handler.js';

// This is intentionally a public signup endpoint: no user account is required.
// The platform checks the project's public key with verify_jwt enabled.
// That key is not an anti-abuse secret. Turnstile and DB limits still apply.
Deno.serve(createWaitlistHandler({
  getEnv: (name: string) => Deno.env.get(name),
  createClient,
}));
