import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { createStatsHandler } from '../supabase/functions/_shared/stats-handler.js';
import { initCommunity, initCommunityMotion } from '../src/js/community.js';

const origin = 'https://parlonmoiwaitlist.vercel.app';
const env = { ALLOWED_ORIGINS: origin, SUPABASE_URL: 'https://example.supabase.co', WAITLIST_SUPABASE_SECRET_KEY: 'sb_secret_test_fixture' };
const request = (method = 'GET', site = origin) => new Request('https://example.test/waitlist-stats', { method, headers: { Origin: site } });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('stats endpoint returns only count/time; caches and coalesces concurrent requests', async () => {
  let calls = 0; let clock = 100000;
  const handler = createStatsHandler({ getEnv: name => env[name], now: () => clock, createClient: () => ({ rpc: async name => {
    assert.equal(name, 'get_waitlist_count'); calls++; await tick(); return { data: 2, error: null };
  } }) });
  const results = await Promise.all([handler(request()), handler(request())]);
  for (const response of results) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.deepEqual(await response.json(), { count: 2, updated_at: new Date(clock).toISOString() });
  }
  assert.equal(calls, 1);
  await handler(request()); assert.equal(calls, 1);
  clock += 31000; await handler(request()); assert.equal(calls, 2);
});

test('stats endpoint denies wrong origin/method, fails closed and never converts DB errors into zero', async () => {
  let calls = 0;
  const handler = createStatsHandler({ getEnv: name => env[name], createClient: () => ({ rpc: async () => { calls++; return { error: { message: 'private database detail' } }; } }) });
  assert.equal((await handler(request('GET', 'https://unapproved.test'))).status, 403);
  assert.equal((await handler(request('POST'))).status, 405);
  assert.equal((await handler(request('OPTIONS'))).status, 204);
  assert.equal(calls, 0);
  const failure = await handler(request()); assert.equal(failure.status, 503);
  assert.deepEqual(await failure.json(), { code: 'unavailable' });
  const closed = createStatsHandler({ getEnv: () => '', createClient: () => { throw Error('must not connect'); } });
  assert.equal((await closed(request())).status, 503);
});

test('community UI displays only genuine counts, handles singular/zero and retains explicitly stale values', async () => {
  const { document, window } = parseHTML(await readFile('src/pages/index.html', 'utf8'));
  globalThis.document = document; globalThis.window = window;
  let value = 1; let failed = false;
  const stop = initCommunity({ supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'test' }, { poll: false, load: async () => {
    if (failed) throw Error('unavailable'); return { count: value, updated_at: new Date().toISOString() };
  } });
  try {
    await tick();
    assert.equal(document.querySelector('[data-community-count]').textContent, '1');
    assert.equal(document.querySelector('[data-community-label]').textContent, 'person on the waitlist');
    document.dispatchEvent(new window.Event('parlonsmoi:registered')); await tick();
    assert.equal(document.querySelector('[data-community-count]').textContent, '1', 'duplicate success must not increment the count');
    failed = true; document.dispatchEvent(new window.Event('parlonsmoi:registered')); await tick();
    assert.equal(document.querySelector('[data-community-count]').textContent, '1');
    assert.match(document.querySelector('[data-community-status]').textContent, /Last known/);
    assert.equal(document.querySelector('[data-community-retry]').hidden, false);
    failed = false; value = 0; document.querySelector('[data-community-retry]').click(); await tick();
    assert.equal(document.querySelector('[data-community-count]').textContent, '0');
    assert.match(document.querySelector('[data-community-status]').textContent, /first/);
  } finally { stop(); }
});

test('first-load failure leaves an unknown count and reduced-motion users get no scroll animation', async () => {
  const { document, window } = parseHTML(await readFile('src/pages/index.html', 'utf8'));
  globalThis.document = document; globalThis.window = window;
  const stop = initCommunity({ supabaseUrl: 'https://example.supabase.co', supabasePublishableKey: 'test' }, { poll: false, load: async () => { throw Error('network'); } });
  try {
    await tick(); assert.equal(document.querySelector('[data-community-count]').textContent, '—');
    assert.match(document.querySelector('[data-community-status]').textContent, /unavailable/);
    let frames = 0;
    window.matchMedia = () => ({ matches: true, addEventListener() {} });
    window.requestAnimationFrame = () => { frames++; };
    window.IntersectionObserver = class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }]); } };
    initCommunityMotion(); window.dispatchEvent(new window.Event('scroll'));
    assert.equal(frames, 0);
  } finally { stop(); }
});
