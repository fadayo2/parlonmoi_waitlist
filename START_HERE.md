# Update — live waitlist count (15 October 2026)

The new section is ready in this ZIP. Replace the project files in your existing
Vercel repository/folder and deploy again using the same project. Keep the existing
Vercel URL and environment settings. No new keys or hostname changes are needed.

The backend work has ALREADY been completed for project hbfwdnjrzlvsowtcfeuz:
- Migration 20261015071852_add_waitlist_count applied.
- waitlist-stats Edge Function deployed and returned a live count of 2 at verification.
- Only count and updated_at are public. Names/emails remain private.

Do not rerun either migration on this existing database. The source files are
included for backup or a fresh installation. For a fresh project, apply both
migrations in filename order before running supabase/verify_permissions.sql, then
deploy both join-waitlist and waitlist-stats with the same server settings.

After the Vercel deployment, refresh the home page and scroll to “A beginning,
shared.” The number comes from Supabase. It refreshes every minute while the tab
is visible, on returning to the tab, and after a successful submission. A short
server cache can delay a new signup appearing by up to roughly 90 seconds. Duplicate
signups do not increase the total. Loading/errors never show a fabricated number.
The decorative ENSEMBLE text moves subtly as you scroll; reduced-motion disables it.

Public names are not included: existing registrations did not consent to that.
A future names feature needs separate explicit opt-in and a removable display name.

The new frontend has passed 29 local tests and a production build. The live stats
endpoint returns 200, and its direct anonymous database RPC returns 401. Actual
browser layout/motion must be checked on Vercel after this update is deployed.

---

# Deploy ParlonsMoi to Vercel

The existing Supabase database and join-waitlist function are ready. Keep them.
Do not create a second database or rerun the SQL migration.

## 1. Extract and deploy

Extract the ZIP. The project folder is `parlonsmoi-vercel`; `package.json` and
`vercel.json` must be at the root of the project you import.

Choose one route:

**GitHub and Vercel dashboard:** Put the extracted project contents in a GitHub
repository. In Vercel, choose Add New → Project and import that repository.
Choose Framework Preset **Other**. The included configuration sets:

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js | `24.x` |
| Root directory | Folder containing `package.json` |

**Command line without GitHub:** Install Node.js, open a terminal in the extracted
project folder, and run `npx vercel --prod`. Follow Vercel's account login and
project setup prompts. Deploy the project source; do not use `--prebuilt`.

Keep Vercel's Automatically expose System Environment Variables setting enabled.
The build uses its production hostname automatically. No secret keys go in Vercel.
Your public Supabase URL, publishable key, Turnstile site key and contact address
are already configured. Those are intentionally public.

## 2. Copy your stable production URL

After deployment, copy the production address from Vercel's project Domains page,
for example `https://YOUR-PROJECT.vercel.app`. This is an example, not a reserved
address. Use your actual address rather than a temporary deployment or branch URL.

In Vercel → Project Settings → Environment Variables, add `PUBLIC_SITE_URL` with
that complete HTTPS origin for Production, then redeploy. Do not add a trailing
slash or path. This makes canonical page URLs match your chosen domain.

## 3. Authorize the new address for signup

The page can deploy before these changes, but signup needs all three allowlists.

**Cloudflare:** Open your existing Turnstile widget → Settings → Hostname Management.
Add your Vercel hostname, such as `YOUR-PROJECT.vercel.app`, without `https://`.
Keep the existing hostname so the current site continues working. Keep using the
same widget and keys.

**Supabase:** Open the parlonsmoi project → Edge Functions → Secrets. Update these
two existing values, substituting the actual new hostname:

```text
ALLOWED_ORIGINS=https://parlonsmoi.luckyharp1.chatgpt.site,https://YOUR-PROJECT.vercel.app
TURNSTILE_HOSTNAMES=parlonsmoi.luckyharp1.chatgpt.site,YOUR-PROJECT.vercel.app
```

Do not change TURNSTILE_SECRET_KEY or WAITLIST_HMAC_SECRET. No database migration
or Edge Function redeployment is required for this hosting move. Never use `*`
or allow the entire `vercel.app` domain. Only allow your exact production hostname.

## 4. Check the deployed site

- Open the production URL in a private/incognito window and confirm public access.
- Check mobile navigation, the Contact page, Privacy page and keyboard navigation.
- Complete Turnstile and submit an email you control; confirm a success response.
- Refresh and submit the same email; confirm only one row for it in Supabase.
- Use Table Editor → schema `parlonsmoi_private` → `waitlist` to check registration.
- Confirm browser console has no errors and requests have the intended CSP headers.
- If verification says invalid domain, check the Turnstile hostname.
- If the request is forbidden/CORS-blocked, check ALLOWED_ORIGINS exactly.
- If the response is unavailable, check server configuration and function logs.
- If the page is gated by Vercel login, check Production Deployment Protection.

For command-line privacy checks, set PUBLIC_SITE_URL to the actual new origin in
your local environment and run `npm run verify:live` from the project folder.
Never add secrets to the frontend or paste them into error reports.

## 5. Custom domain later

In Vercel Project Settings → Domains, add your domain. At your domain registrar,
enter the exact DNS records Vercel displays and wait for verification/HTTPS.
Then update PUBLIC_SITE_URL and repeat the Turnstile/Supabase hostname changes.
Redeploy and test again. Preview deployments are intentionally not automatically
allowlisted for live registration.

## Verification and limits

The original site's user-reported successful signup was confirmed by a real DB
count of one. After the user repeated signup, the DB still held one unique row.
Database permission checks and local tests passed. Vercel hosting, its actual
headers, mobile layout, and signup on your new address must be checked after you
deploy. No deployment to Vercel or domain purchase has been performed for you.
The original logo is still needed if you want it to replace the temporary text
wordmark. Review the privacy notice against your actual operating practices.

Official references:
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/environment-variables/system-environment-variables
- https://vercel.com/docs/cli/deploy
- https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/

## Where the CSS and scripts are

index.html links to ./assets/styles.css and ./assets/main.js. Both files are
included directly in the root assets folder. Fonts are in assets/fonts. The
other two root pages use the same files. The full built site is also in dist.
Templates now live in src/pages; npm run build regenerates root pages and dist.
Use npm run preview for a functional local preview, not file:// URLs.
