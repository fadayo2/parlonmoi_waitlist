import { build } from 'esbuild';
import { readFile, writeFile, mkdir, rm, copyFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { COUNTRY_CODES, LEVELS } from '../supabase/functions/_shared/validation.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const defaults = JSON.parse(await readFile('config/public.json', 'utf8'));
const env = name => (process.env[name] || defaults[name] || '').trim();
const vercelHostname = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
const siteOrigin = (process.env.PUBLIC_SITE_URL || (process.env.VERCEL === '1' && vercelHostname ? `https://${vercelHostname}` : defaults.PUBLIC_SITE_URL) || '').trim();
if (process.env.VERCEL === '1' && !process.env.PUBLIC_SITE_URL && !vercelHostname) throw new Error('Enable Vercel system environment variables or set PUBLIC_SITE_URL to your production HTTPS origin.');
const config = {
  supabaseUrl: env('PUBLIC_SUPABASE_URL').replace(/\/$/, ''),
  supabasePublishableKey: env('PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  turnstileSiteKey: env('PUBLIC_TURNSTILE_SITE_KEY'),
  contactEmail: env('PUBLIC_CONTACT_EMAIL'),
  siteUrl: siteOrigin.replace(/\/$/, ''),
  enabled: env('PUBLIC_WAITLIST_ENABLED') === 'true',
};
if (config.supabasePublishableKey && !config.supabasePublishableKey.startsWith('sb_publishable_')) throw new Error('Frontend requires an sb_publishable_ key. Never use a secret, service-role key, or legacy JWT here.');
if (config.contactEmail && !/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(config.contactEmail)) throw new Error('PUBLIC_CONTACT_EMAIL must be a valid email address.');
for (const key of ['supabaseUrl', 'siteUrl']) {
  if (!config[key]) continue;
  const url = new URL(config[key]);
  if (url.protocol !== 'https:' || url.origin !== config[key] || url.username || url.password) throw new Error(`${key} must be an HTTPS origin without a path.`);
}
if (config.enabled) {
  for (const [key, value] of Object.entries(config)) if (!value) throw new Error(`Waitlist enabled but ${key} is missing. Complete .env or set PUBLIC_WAITLIST_ENABLED=false.`);
  if (/^[123]x0{6}/.test(config.turnstileSiteKey)) throw new Error('Do not enable a public waitlist with a Turnstile test key.');
}

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets/fonts', { recursive: true });
await mkdir('.artifacts', { recursive: true });
const css = spawnSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', 'src/css/styles.css', '-o', 'dist/assets/styles.css', '--minify'], { stdio: 'inherit' });
if (css.status !== 0) process.exit(css.status || 1);
await build({ entryPoints: ['src/js/main.js'], outfile: 'dist/assets/main.js', bundle: true, minify: true, format: 'esm', platform: 'browser', target: ['es2022'], define: { __PUBLIC_CONFIG__: JSON.stringify(config) }, legalComments: 'eof' });
for (const subset of ['latin', 'latin-ext']) await copyFile(`node_modules/@fontsource/oswald/files/oswald-${subset}-500-normal.woff2`, `dist/assets/fonts/oswald-${subset}-500-normal.woff2`);
await copyFile('node_modules/@fontsource/oswald/LICENSE', 'dist/assets/fonts/OFL.txt');

const csp = [
  "default-src 'self'", "base-uri 'self'", "object-src 'none'", "form-action 'none'",
  "script-src 'self' https://challenges.cloudflare.com", "style-src 'self' 'unsafe-inline'",
  "font-src 'self'", "img-src 'self' data:", "frame-src https://challenges.cloudflare.com",
  `connect-src 'self' https://challenges.cloudflare.com${config.supabaseUrl ? ' ' + config.supabaseUrl : ''}`,
  'upgrade-insecure-requests',
].join('; ');
const headers = {
  'Content-Security-Policy': csp + "; frame-ancestors 'self' https://chatgpt.com",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  ...(config.enabled ? {} : { 'X-Robots-Tag': 'noindex, nofollow' }),
};
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countries = COUNTRY_CODES.map(code => [code, countryNames.of(code)]).sort((a, b) => a[1].localeCompare(b[1], 'en'));
for (const page of ['index.html', 'privacy.html', 'contact.html']) {
  let html = await readFile(`src/pages/${page}`, 'utf8');
  html = html.replaceAll('{{YEAR}}', String(new Date().getUTCFullYear()));
  html = html.replace('<!-- COUNTRY_OPTIONS -->', countries.map(([code, name]) => `<option value="${code}">${escape(name)}</option>`).join(''));
  html = html.replace('<!-- LEVEL_OPTIONS -->', Object.entries(LEVELS).map(([code, name]) => `<option value="${code}">${escape(name)}</option>`).join(''));
  const canonical = config.siteUrl ? `<link rel="canonical" href="${escape(config.siteUrl + (page === 'index.html' ? '/' : '/' + page))}">` : '';
  html = html.replace('</head>', `<meta http-equiv="Content-Security-Policy" content="${escape(csp)}"><meta name="referrer" content="strict-origin-when-cross-origin">${config.enabled ? '' : '<meta name="robots" content="noindex,nofollow">'}${canonical}</head>`);
  await writeFile(`dist/${page}`, html);
}
await writeFile('dist/_headers', '/*\n' + Object.entries(headers).map(([name, value]) => `  ${name}: ${value}\n`).join('') + '  Cache-Control: no-cache\n\n/assets/*\n  Cache-Control: public, max-age=3600\n');
await writeFile('.artifacts/security-headers.json', JSON.stringify(headers));
await writeFile('dist/robots.txt', config.enabled ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
console.log(`Built dist/: 3 pages, bundled JavaScript, compiled Tailwind, local Oswald. Waitlist ${config.enabled ? 'ENABLED — live verification still required' : 'CLOSED — backend configuration required'}.`);

// Keep a complete ready-to-view copy beside the root HTML files as well.
await cp('dist/assets', 'assets', { recursive: true });
for (const page of ['index.html', 'privacy.html', 'contact.html']) await copyFile(`dist/${page}`, page);
