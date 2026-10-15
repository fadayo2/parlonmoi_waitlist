# Signup security and its limits

## Request path

Browser → public `join-waitlist` Edge Function → server-verified Turnstile →
server-only `register_waitlist` RPC → private PostgreSQL tables.

The browser has a publishable key. It never receives a secret key or a registration
row. The server accepts anonymous interest, not authenticated account ownership.

## Actual permissions

| Object / operation | anon | authenticated | service_role | Database administrator |
| --- | --- | --- | --- | --- |
| Private schema usage | Denied | Denied | Allowed | Allowed |
| Read complete registrations | Denied | Denied | Denied by grants | Allowed |
| Read email column | Denied | Denied | Allowed for INSERT ON CONFLICT | Allowed |
| Insert name/email/country/level | Denied | Denied | Allowed | Allowed |
| Set registration ID/time explicitly | Denied | Denied | Denied | Allowed |
| Update/delete registrations | Denied | Denied | Denied | Allowed |
| Read/write quota records | Denied | Denied | Allowed | Allowed |
| Execute signup RPC | Denied | Denied | Allowed | Allowed |

PostgreSQL's PUBLIC pseudo-role, anon, authenticated and service_role are explicitly
revoked before narrowly granting server access. RLS is enabled and forced on both
tables, with no visitor policies. Supabase's service_role bypasses RLS, so its
object grants are also restricted. The RPC is SECURITY INVOKER, has an empty
search_path, uses qualified table names and contains no dynamic SQL. It does not
elevate the caller's privileges. Private tables must remain outside the Data API's
exposed schemas and Realtime publications.

The secret API key is still privileged across the Supabase project. These object
grants do not make a leaked secret safe. Keep it in Edge Function secrets and
restrict account administrators. Use the SQL assertion file to verify permissions
on the actual target project, including inherited/default grants.

## Data integrity and duplicate privacy

The database creates UUIDs and timestamptz values, validates required values,
country codes, defined French levels, name length and email format. A BEFORE
trigger normalises email, name whitespace and country case. A UNIQUE constraint
enforces one normalised email even for concurrent requests. Case and surrounding
spaces are ignored; plus-addressing and dots are not treated as equivalent addresses.

INSERT ON CONFLICT DO NOTHING does not replace stored details. Both new and
duplicate requests return HTTP 200 and exactly `{"status":"accepted"}`. No ID,
name, country, level or duplicate flag is returned. This prevents explicit email
enumeration through response content; it is not a claim of constant-time execution.
Unexpected database failures yield a generic 503, never a success response.

## Abuse controls

- Turnstile is mandatory on every write, verified against Cloudflare server-side.
  Action must be `waitlist`; hostname must be allowlisted and match Origin.
  Cloudflare checks expiry and single-use tokens. The client resets verification
  on failure/expiry. A failed challenge never writes to the DB.
- Payloads are capped at 8 KiB while streaming, with read and network timeouts.
- Honeypot-filled requests are rejected, not silently counted as registrations.
- Atomic fixed windows allow 3 attempts per email and 100 verified attempts globally
  per 15-minute window. New and existing addresses consume quotas identically.
- Only HMAC email hashes are stored in quota records, with a secret known to the
  server. Raw client IPs are neither trusted for quota enforcement nor stored in
  these tables. Expired quota data is cleaned on later traffic; see scheduled cleanup.
- CORS uses exact origins. Origin and publishable keys are public/spoofable outside
  browsers; neither replaces Turnstile or database enforcement.
- No localStorage, signup cookies, analytics, or body/key/PII logging was added.

Limits are deliberate early-stage defaults. Fixed windows permit a boundary burst.
Attackers who pass challenges can consume global capacity. Invalid requests still
reach the Edge Function/verification service, so this is not denial-of-service
protection. Monitor usage and add provider-level traffic controls if needed. Do not
advertise this as a completed independent security audit.

## Browser protections

The build self-hosts Oswald, bundles official Supabase JS and compiles Tailwind.
It does not run Tailwind's development CDN. CSP permits the site, configured
Supabase API origin and Cloudflare challenge scripts/frames. Styles permit inline
attributes needed by the widget; scripts do not permit unsafe-inline or eval.
The header template also limits framing and browser device APIs. Actual HTTP
headers and Turnstile compatibility must be checked on the selected host.

## Verification scope

PGlite ran the real migration and permissions in a local PostgreSQL engine with
simulated Supabase roles, including service_role's BYPASSRLS. Handler tests mock
Supabase and Cloudflare. UI tests simulate DOM events. These tests do **not**
prove hosted gateway configuration, real Turnstile, secret configuration, HTTP
headers, browser accessibility, distributed concurrency or live data privacy.
Run the live checklist after deployment. No registration data was accessed in
the owner's project during this build.

## Aggregate endpoint

Browser → waitlist-stats → get_waitlist_count() returns a bigint count only.
The database RPC is SECURITY INVOKER with empty search_path. Execute is explicitly
revoked from PUBLIC, anon and authenticated, and granted only to service_role.
It counts the already permitted email column; no new table privileges are granted.
It accepts no email, name, filter or identity parameters. Exact totals reveal
aggregate registration activity; do not present them as anonymity guarantees.
The Edge Function emits only count/updated_at, coalesces concurrent requests and
caches successful results for 30 seconds per running instance. This reduces repeated
DB reads but is not a global rate limit or denial-of-service protection. Requests
are read-only and use the existing exact-origin CORS allowlist. CORS is not identity
authentication. Error bodies contain no database internals or registration details.
The SQL permissions, live 200 response shape and denied anonymous RPC were verified.
The security advisor retained only the two expected informational no-policy notices
for intentionally private tables; no new warnings were returned.
