import { validateFields } from './validation.js';

const MAX_BODY_BYTES = 8192;

async function readJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new Error('too_large');
  if (!request.body) throw new Error('invalid_json');
  const reader = request.body.getReader();
  let timer;
  const expired = new Promise((_, reject) => { timer = setTimeout(() => { void reader.cancel(); reject(new Error('invalid_json')); }, 5000); });
  try {
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), expired]);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('too_large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

async function emailHash(email, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(email)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createWaitlistHandler({ getEnv, createClient, fetchImpl = fetch, log = console.error }) {
  const list = name => (getEnv(name) || '').split(',').map(value => value.trim()).filter(Boolean);
  const origins = list('ALLOWED_ORIGINS');
  const hostnames = list('TURNSTILE_HOSTNAMES');
  const supabaseUrl = getEnv('SUPABASE_URL') || '';
  let databaseSecret = getEnv('WAITLIST_SUPABASE_SECRET_KEY') || '';
  if (!databaseSecret) {
    try {
      const defaults = JSON.parse(getEnv('SUPABASE_SECRET_KEYS') || '{}');
      databaseSecret = typeof defaults.default === 'string' ? defaults.default : '';
    } catch { /* Malformed configuration remains unavailable. */ }
  }
  const turnstileSecret = getEnv('TURNSTILE_SECRET_KEY') || '';
  const hmacSecret = getEnv('WAITLIST_HMAC_SECRET') || '';
  const ready = origins.length > 0 && !origins.includes('*') && hostnames.length > 0 && !hostnames.includes('*') && /^https:\/\/[^/]+\/?$/.test(supabaseUrl) && databaseSecret.startsWith('sb_secret_') && turnstileSecret.length > 0 && hmacSecret.length >= 32;
  const db = ready ? createClient(supabaseUrl, databaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options = {}) => fetchImpl(url, { ...options, signal: AbortSignal.timeout(6000) }) },
  }) : null;

  return async request => {
    const origin = request.headers.get('origin') || '';
    const allowed = origins.includes(origin);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
      ...(allowed ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
        'Access-Control-Max-Age': '600',
      } : {}),
    };
    const reply = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra } });
    if (!ready) return reply(503, { code: 'unavailable' });
    if (!allowed) return reply(403, { code: 'forbidden' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { code: 'method' }, { Allow: 'POST, OPTIONS' });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return reply(415, { code: 'content_type' });
    let input;
    try { input = await readJson(request); }
    catch (error) { return reply(error.message === 'too_large' ? 413 : 400, { code: 'invalid_request' }); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { code: 'invalid_request' });
    if (input.website !== undefined && input.website !== '') return reply(400, { code: 'verification' });
    const { data, valid, errors } = validateFields(input);
    if (!valid) return reply(400, { code: 'validation', fields: errors });
    if (typeof input.turnstile_token !== 'string' || !input.turnstile_token || input.turnstile_token.length > 2048) return reply(400, { code: 'verification' });

    try {
      const response = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: turnstileSecret, response: input.turnstile_token }),
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) return reply(503, { code: 'unavailable' });
      const verification = await response.json();
      if (verification.success !== true || verification.action !== 'waitlist' || !hostnames.includes(verification.hostname) || verification.hostname !== new URL(origin).hostname) {
        return reply(400, { code: 'verification' });
      }
      const { data: result, error } = await db.rpc('register_waitlist', {
        p_full_name: data.full_name,
        p_email: data.email,
        p_country: data.country,
        p_french_level: data.french_level,
        p_email_hash: await emailHash(data.email, hmacSecret),
      });
      if (error) { log('waitlist: database operation failed'); return reply(503, { code: 'unavailable' }); }
      if (result === 'rate_limited') return reply(429, { code: 'rate_limited' }, { 'Retry-After': '900' });
      if (result !== 'accepted') { log('waitlist: unexpected database response'); return reply(503, { code: 'unavailable' }); }
      // Exactly the same body and status for a new or existing email.
      return reply(200, { status: 'accepted' });
    } catch {
      // Never log request bodies, tokens, email addresses, or database errors.
      log('waitlist: request processing unavailable');
      return reply(503, { code: 'unavailable' });
    }
  };
}
