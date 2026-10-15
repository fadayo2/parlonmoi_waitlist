import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { createStatsHandler } from '../_shared/stats-handler.js';

// Gateway verification stays enabled. The public payload is an aggregate only.
Deno.serve(createStatsHandler({ getEnv: (name: string) => Deno.env.get(name), createClient }));
