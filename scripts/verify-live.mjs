import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

if (existsSync('.env')) process.loadEnvFile('.env');
const defaults = JSON.parse(await readFile('config/public.json', 'utf8'));
const base = (process.env.PUBLIC_SUPABASE_URL || defaults.PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
const key = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || defaults.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const origin = process.env.PUBLIC_SITE_URL || defaults.PUBLIC_SITE_URL;
const databaseOnly = process.argv.includes('--database-only');
if (!base || !key?.startsWith('sb_publishable_') || !origin) throw new Error('Fill in the public values in .env first. This script never needs a secret key.');
const headers = { apikey: key, 'Content-Type': 'application/json', Origin: origin };
const checks = [
  ['anonymous private-schema read', `${base}/rest/v1/waitlist?select=id&limit=1`, { headers: { ...headers, 'Accept-Profile': 'parlonsmoi_private' } }],
  ['anonymous table discovery', `${base}/rest/v1/waitlist?select=id&limit=1`, { headers }],
  ['anonymous direct RPC', `${base}/rest/v1/rpc/register_waitlist`, { method: 'POST', headers, body: JSON.stringify({ p_full_name: 'Permission Test', p_email: 'permission-test@example.invalid', p_country: 'NG', p_french_level: 'A1', p_email_hash: '0'.repeat(64) }) }],
  ['signup without verification', `${base}/functions/v1/join-waitlist`, { method: 'POST', headers, body: JSON.stringify({ full_name: 'Permission Test', email: 'permission-test@example.invalid', country: 'NG', french_level: 'A1' }) }],
];
let failed = false;
for (const [name, url, options] of checks) {
  if (databaseOnly && name === 'signup without verification') continue;
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  let pass = [401,403,404,406].includes(response.status);
  if (name === 'signup without verification') {
    const data = await response.json().catch(() => ({}));
    pass = response.status === 400 && data.code === 'verification';
  }
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: HTTP ${response.status}`);
  if (!pass) failed = true;
}
if (failed) process.exitCode = 1;
console.log('Also run supabase/verify_permissions.sql and the browser checklist. These negative requests cannot prove a successful registration.');
