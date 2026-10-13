import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaitlistHandler } from '../supabase/functions/_shared/waitlist-handler.js';

const sample = { full_name: 'Aïcha Bello', email: ' AICHA@Example.COM ', country: 'NG', french_level: 'B1', turnstile_token: 'test-token-not-a-real-captcha' };
const env = { ALLOWED_ORIGINS: 'https://parlonsmoi.example', TURNSTILE_HOSTNAMES: 'parlonsmoi.example', SUPABASE_URL: 'https://project.supabase.co', WAITLIST_SUPABASE_SECRET_KEY: 'sb_secret_test_only', TURNSTILE_SECRET_KEY: 'test-only', WAITLIST_HMAC_SECRET: 'test-only-'.repeat(8) };
function fixture(overrides = {}) {
  const calls = []; const logs = [];
  const handler = createWaitlistHandler({
    getEnv: name => ({ ...env, ...overrides.env })[name],
    createClient: () => ({ rpc: async (name, payload) => { calls.push({ name, payload }); if (overrides.throwDb) throw new Error('private database detail'); return overrides.db || { data: 'accepted', error: null }; } }),
    fetchImpl: async () => { if (overrides.throwCaptcha) throw new Error('timeout'); return Response.json(overrides.captcha || { success: true, hostname: 'parlonsmoi.example', action: 'waitlist' }); },
    log: value => logs.push(value),
  });
  return { handler, calls, logs };
}
const request = (body = sample, extra = {}) => new Request('https://project.supabase.co/functions/v1/join-waitlist', { method: 'POST', headers: { Origin: 'https://parlonsmoi.example', 'Content-Type': 'application/json', ...extra.headers }, body: typeof body === 'string' ? body : JSON.stringify(body), ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'headers')) });

test('accepted response contains no identity and sends normalised fields plus HMAC to DB', async () => {
  const { handler, calls } = fixture();
  const response = await handler(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: 'accepted' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls[0].payload.p_email, 'aicha@example.com');
  assert.match(calls[0].payload.p_email_hash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(calls).includes('test-token'), false);
});
test('fails closed on missing configuration', async () => {
  const { handler, calls } = fixture({ env: { TURNSTILE_SECRET_KEY: '' } });
  assert.equal((await handler(request())).status, 503); assert.equal(calls.length, 0);
});
test('CORS rejects unapproved origins and supports preflight', async () => {
  const { handler, calls } = fixture();
  const bad = await handler(request(sample, { headers: { Origin: 'https://evil.example' } }));
  assert.equal(bad.status, 403); assert.equal(bad.headers.has('access-control-allow-origin'), false);
  assert.equal((await handler(new Request('https://project.supabase.co/functions/v1/join-waitlist', { method: 'OPTIONS', headers: { Origin: 'https://parlonsmoi.example' } }))).status, 204);
  assert.equal(calls.length, 0);
});
test('rejects malformed, oversized, invalid and honeypot-filled requests before DB', async () => {
  const { handler, calls } = fixture();
  for (const body of ['{', null, [], { ...sample, email: 'invalid' }, { ...sample, french_level: 'expert' }, { ...sample, website: 'spam' }, { ...sample, turnstile_token: '' }]) assert.equal((await handler(request(body))).status, 400);
  assert.equal((await handler(request('x'.repeat(8193)))).status, 413);
  assert.equal((await handler(request(sample, { headers: { 'Content-Type': 'text/plain' } }))).status, 415);
  assert.equal(calls.length, 0);
});
test('invalid, replayed, wrong-host and wrong-action tokens never reach DB', async () => {
  for (const captcha of [{ success:false, 'error-codes':['timeout-or-duplicate'] }, { success:true, hostname:'evil.example', action:'waitlist' }, { success:true, hostname:'parlonsmoi.example', action:'login' }]) {
    const { handler, calls } = fixture({ captcha });
    assert.equal((await handler(request())).status, 400); assert.equal(calls.length, 0);
  }
});
test('database and verification failures never become success; details are not exposed', async () => {
  for (const override of [{ db:{data:null,error:{message:'private SQL detail'}} }, { throwDb:true }, { throwCaptcha:true }, { db:{data:null,error:null} }]) {
    const { handler, logs } = fixture(override);
    const response = await handler(request());
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), {code:'unavailable'});
    assert.equal(logs.join().includes('private'), false); assert.equal(logs.join().includes('@'), false);
  }
});
test('rate limit produces 429 and retry guidance', async () => {
  const { handler } = fixture({ db:{data:'rate_limited',error:null} });
  const response = await handler(request());
  assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '900');
});
