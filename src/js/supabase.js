import { createClient, FunctionsHttpError } from '@supabase/supabase-js';

export function createWaitlistClient(config) {
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return async (payload) => {
    const { data, error } = await client.functions.invoke('join-waitlist', { body: payload, timeout: 20000 });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const status = error.context.status;
        const body = await error.context.json().catch(() => ({}));
        if (status === 429) throw new Error('We’ve received too many requests. Please try again in 15 minutes.');
        if (status === 400 && body.code === 'validation') {
          const fieldError = new Error('Please check the highlighted fields.');
          fieldError.fields = body.fields;
          throw fieldError;
        }
        if (status === 400 && body.code === 'verification') throw new Error('The verification expired or could not be confirmed. Please verify again.');
      }
      throw new Error('We couldn’t confirm your registration. Please check your connection and try again. If the request went through, a retry won’t create a duplicate.');
    }
    if (data?.status !== 'accepted') throw new Error('We couldn’t confirm your registration. Please try again in a moment.');
    return data;
  };
}
