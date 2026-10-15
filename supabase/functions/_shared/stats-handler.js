// Public response contains only an aggregate, never registration records.
export function createStatsHandler({ getEnv, createClient, now = Date.now }) {
  const origins = (getEnv('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
  const url = getEnv('SUPABASE_URL') || '';
  let secret = getEnv('WAITLIST_SUPABASE_SECRET_KEY') || '';
  if (!secret) {
    try { secret = JSON.parse(getEnv('SUPABASE_SECRET_KEYS') || '{}').default || ''; }
    catch { /* Missing configuration returns unavailable. */ }
  }
  const ready = origins.length > 0 && !origins.includes('*') && /^https:\/\/[^/]+\/?$/.test(url) && typeof secret === 'string' && secret.startsWith('sb_secret_');
  const db = ready ? createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, options = {}) => fetch(input, { ...options, signal: AbortSignal.timeout(6000) }) },
  }) : null;
  let cached;
  let cachedAt = 0;
  let pending;
  async function count() {
    if (cached && now() - cachedAt < 30000) return cached;
    if (!pending) {
      pending = (async () => {
        const { data, error } = await db.rpc('get_waitlist_count');
        if (error || !Number.isSafeInteger(data) || data < 0) throw new Error('unavailable');
        cachedAt = now();
        cached = { count: data, updated_at: new Date(cachedAt).toISOString() };
        return cached;
      })().finally(() => { pending = null; });
    }
    return pending;
  }
  return async request => {
    const origin = request.headers.get('origin') || '';
    const allowed = origins.includes(origin);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', Vary: 'Origin',
      ...(allowed ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
        'Access-Control-Max-Age': '600',
      } : {}),
    };
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (!ready) return reply(503, { code: 'unavailable' });
    if (!allowed) return reply(403, { code: 'forbidden' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return reply(405, { code: 'method' });
    try { return reply(200, await count()); }
    catch { return reply(503, { code: 'unavailable' }); }
  };
}
