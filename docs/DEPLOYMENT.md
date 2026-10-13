# Setup and deployment

## 1. Preview the current page

From the project root, run `npm ci`, `npm run build`, then `npm run preview`.
Open http://localhost:4173. Set PUBLIC_WAITLIST_ENABLED=false in a local .env for a closed-signup preview.
The hosted review site is now enabled after server configuration. `dist/` is the only folder to publish to a static web host.

## 2. Select your Supabase project

Create or select the intended project in your own Supabase account. Record its
project reference, Project URL and publishable key. Do not use a project belonging
to an unrelated application. Choose a hosting region and review provider settings
appropriate to your users before accepting personal information.

If using the ChatGPT Supabase connection, connect it and identify the exact project.
If working manually, the following route requires no access from ChatGPT.

## 3. Apply the complete migration

**Already applied to the current parlonsmoi project. Do not rerun it there.**
The following instructions are for a fresh project. The local migration filename
now matches the real remote migration history: 20261012172205_create_waitlist.

For the SQL Editor route:

1. Open your project's SQL Editor.
2. Paste the **complete contents** of `supabase/migrations/20261012172205_create_waitlist.sql`.
3. Execute as the project database administrator. The migration is transactional.
4. Run `supabase/verify_permissions.sql`. It must finish without a FAIL exception.
5. In the Data API settings, keep `public` available for the server RPC. Do **not**
   add `parlonsmoi_private` to the exposed schemas or to a Realtime publication.

The migration intentionally fails if its schema already exists: it does not drop
or replace an existing waitlist. If it fails, capture the error and inspect the
existing state before changing anything. Do not execute it twice after success.

Alternatively, install the current Supabase CLI using its official instructions,
authenticate locally and use migration tracking:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Choose **one** migration route. If you already ran SQL manually and later adopt
CLI migrations, reconcile the migration history before running `db push`.

## 4. Create Cloudflare Turnstile protection

In your own Cloudflare account, create a **Managed** Turnstile widget. Allow the
hostname used for your website. The private preview hostname created in this
session is `parlonsmoi.luckyharp1.chatgpt.site`; add your production hostname when
you select one. Cloudflare does not need to host the website for Turnstile to work.

The **site key** is public and goes in frontend configuration. The **secret key**
stays in the Supabase Edge Function secrets. Never use test keys on a public signup.
For browser testing from localhost, add localhost to the widget as needed and
temporarily permit the exact localhost origin in the server settings; remove it
from production settings afterwards. The handler requires a real successful
verification with action `waitlist` and a hostname matching the calling origin.

## 5. Configure server secrets

Use Supabase → Edge Functions → Secrets. Copy the names in `supabase/.env.example`:

| Secret | Value |
| --- | --- |
| `WAITLIST_SUPABASE_SECRET_KEY` | Optional dedicated `sb_secret_…` override; otherwise uses hosted `SUPABASE_SECRET_KEYS.default` |
| `TURNSTILE_SECRET_KEY` | Secret from your Turnstile widget |
| `ALLOWED_ORIGINS` | Exact comma-separated origins, e.g. `https://parlonsmoi.luckyharp1.chatgpt.site`; no trailing slash or wildcard |
| `TURNSTILE_HOSTNAMES` | Matching comma-separated hostnames without scheme, path or port |
| `WAITLIST_HMAC_SECRET` | Random secret with at least 32 characters |

Supabase provides `SUPABASE_URL` automatically. Do not create a custom secret
with the reserved `SUPABASE_` prefix. This implementation deliberately uses a
separate named secret and rejects legacy/service-role JWT keys for that setting.

Generate the HMAC secret on your own computer:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep that output private. If using a local secrets file, copy
`supabase/.env.example` to `supabase/.env`, fill it in, and run:

```sh
supabase secrets set --env-file supabase/.env --project-ref YOUR_PROJECT_REF
```

The file is ignored by Git. Do not upload it with the website or share it here.
The secret key can administer more than this one flow if stolen; rotate it if
exposed. The frontend must contain only the publishable key.

## 6. Deploy the complete Edge Function

The source is `supabase/functions/join-waitlist/index.ts` plus both imported files
in `supabase/functions/_shared/`. Deploy from the project root so those imports
are included:

```sh
supabase functions deploy join-waitlist --project-ref YOUR_PROJECT_REF
```

`supabase/config.toml` keeps `verify_jwt=true`. The hosted platform was tested:
a request using the project's publishable key reached the handler and returned
its expected configuration-unavailable response. The public key does not establish
user identity or prevent spam; every write still needs server-verified Turnstile
and database quotas. Do not change authentication settings on unrelated functions.

If deploying through the Dashboard instead, include all three files and preserve
the relative imports and function-specific configuration. Review function logs for
configuration or runtime errors; do not add logging of request bodies or keys.

## 7. Configure the frontend

The actual Project URL, publishable key and private review-site origin are already
in `config/public.json`. You can edit that public file or override its values using
a root `.env` file copied from `.env.example`. Fill in the remaining **public** values:

| Setting | What to supply |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | Your Project URL, `https://…supabase.co` or configured HTTPS API origin |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_…` key |
| `PUBLIC_TURNSTILE_SITE_KEY` | Your widget's public site key |
| `PUBLIC_CONTACT_EMAIL` | A real inbox monitored by the product owner |
| `PUBLIC_SITE_URL` | The website's HTTPS origin, with no trailing slash |
| `PUBLIC_WAITLIST_ENABLED` | `false` until everything above and the privacy review are ready; then `true` |

These values are embedded at build time; changing a hosting environment variable
does not change an already-built static page. Rebuild and deploy after changes.
Review `privacy.html`: replace the draft with an accurate notice for your legal
operator, jurisdiction, retention process and actual provider region/settings.
The owner supplied `parlonsmoi@gmail.com` and the public Turnstile site key; both
are now configured. Confirm that the contact inbox is monitored.

Run:

```sh
npm test
npm run build
npm run verify:live
```

The live script tests denied operations. If the direct RPC is accidentally
permitted, its negative probe may create a synthetic `permission-test@example.invalid`
row; treat any such failure as a launch blocker and remove that row as admin after
fixing permissions. The script never uses a secret key or prints registration data.

## 8. Publish the static website

For a host supporting static build deployments, configure:

- Install: `npm ci`
- Build: `npm run build`
- Output directory: `dist`
- Node.js: 22 or newer

Cloudflare Pages and Netlify understand the generated `_headers` file. For another
host, translate its contents to that host's response-header configuration. Never
publish the repository root, `.env`, `supabase/.env`, tests or source-control files.
No server-side Supabase secret belongs in the static host's public build variables.

For ChatGPT Sites, the current source is associated with the private ParlonsMoi
site. Ask for an update after providing the public configuration; the source can
be rebuilt and the same site versioned. The current review site is private with signup enabled for real testing. Do not describe it as a publicly launched community.

## 9. Connect a domain

Choose a domain you control, add it to your hosting provider, and copy the exact
DNS records that provider gives you. Do not guess an IP address or CNAME target.
Wait until the provider confirms domain ownership and issues HTTPS. Then:

1. Set `PUBLIC_SITE_URL` to the chosen HTTPS origin.
2. Add the exact origin to `ALLOWED_ORIGINS` and its hostname to `TURNSTILE_HOSTNAMES`.
3. Add that hostname in the Turnstile widget settings.
4. Rebuild/redeploy the frontend and rerun the real signup, duplicate and privacy tests.
5. If using both www and the apex, pick one canonical hostname and configure redirects
   using the host's guidance. Permit only origins actually used by the form.

## 10. Final live test and operations

Use an email address you control. Submit once, then submit again with different
capitalisation and surrounding spaces. Both should show the same accepted text.
As administrator, confirm **one** row with the original details. Do not publish
screenshots of registrations. Run the permission SQL and finish `docs/TESTING.md`.

Review quotas and provider costs, restrict admin access, enable account MFA, and
implement the privacy notice's retention/removal process. Limit-table rows older
than one hour are pruned on the next verified signup; if traffic stops, those
hashed buckets remain until the next request or an administrative cleanup. Schedule
the following statement daily with Supabase Cron if strict cleanup is needed:

```sql
delete from parlonsmoi_private.waitlist_limits
where window_start < now() - interval '1 hour';
```

Double opt-in email is not implemented. Registrations are expressions of interest,
not verified email ownership or user accounts. Add email verification before using
the waitlist for sensitive access or account creation.

## Official references

- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/guides/cli/getting-started
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

Setup instructions were checked against vendor documentation on 12 October 2026.
