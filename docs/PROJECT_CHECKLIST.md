# ParlonsMoi project checklist

Updated: 12 October 2026.

## Decisions to preserve

- Public introduction is English. Future app UI and participation are French-first.
- Brand: Oswald headings/wordmark, off-white, black, restrained green. Readable
  system body type follows the supplied master brief's heading-font distinction.
- No original logo was supplied; the text name is temporary and must not be
  mistaken for a redesigned logo.
- Stack: HTML, Tailwind CSS, vanilla JS, Supabase PostgreSQL and official JS client.
- No framework, accounts, fake app screens, testimonials or launch-date claims.
- Form calls an Edge Function; no direct anonymous table inserts.
- Tables use a private, unexposed schema. RLS is enabled and forced, and public
  access grants are explicitly revoked. Server RPC is SECURITY INVOKER.
- Email is trimmed/lowercased in JS and by a DB trigger, with DB uniqueness.
- New and duplicate registrations return the same response. Duplicates never
  overwrite an existing person's name, country or French level.
- Mandatory Turnstile verification on the server, 8 KiB payload ceiling, and
  atomic DB quotas: 3 accepted attempts per email / 15-minute window and
  100 verified attempts globally / 15-minute window. These are configurable SQL
  decisions, not claims of complete abuse prevention.
- Signup is closed until configuration and privacy/contact review are complete.

## Complete

- [x] Inspect both supplied briefs; establish a new project without overwriting code.
- [x] Responsive navigation and all requested landing-page content.
- [x] Accessible form structure, labelled controls and error/focus handling.
- [x] Loading, accepted, unavailable, validation and safe retry states.
- [x] Full SQL migration, private schema, constraints and permission verification SQL.
- [x] Complete Edge Function, frontend integration and required-secret example.
- [x] Pinned dependencies, compiled Tailwind, self-hosted Oswald and production build.
- [x] 24 passing local assertions, including real PostgreSQL via PGlite.
- [x] Setup, security, deployment, test and continuation documentation.
- [x] Supabase installation confirmed after the owner's installation message.

## Remaining before a public launch

- [ ] Owner supplies original logo.
- [x] Owner supplied contact address: parlonsmoi@gmail.com.
- [x] Save owner-provided public Turnstile site key in frontend configuration.
- [x] Load Supabase actions; select active project parlonsmoi (hbfwdnjrzlvsowtcfeuz).
- [x] Apply migration and run `supabase/verify_permissions.sql` on the real project.
- [x] Owner created Turnstile widget and supplied its public site key.
- [x] Owner saved server secrets; live configuration readiness now passes.
- [x] Deploy `join-waitlist` version 1 with platform verification enabled.
- [x] Configure origins/hostnames and Turnstile/HMAC settings; exact-origin preflight passed.
- [x] Set frontend public configuration and enable signup on the owner-private site.
- [ ] Review the privacy notice.
- [ ] Complete a real signup and duplicate with the same email; confirm one DB row.
- [x] Run `npm run verify:live`; all four negative checks passed. Earlier SQL assertions covered authenticated-role privileges.
- [ ] Test real browser/mobile layout, keyboard flow, zoom and screen reader feedback.
- [ ] Verify deployed HTTP security headers, CSP, no console errors and expiry/retry behavior.
- [ ] Choose production hostname, add DNS and HTTPS, update Turnstile/CORS, then retest.
- [ ] Review ongoing quota, retention and privacy-request administration.

## Known limits

The real database and endpoint are deployed. Permission assertions and negative
HTTP checks passed. The endpoint now passes readiness and rejects unverified signup with HTTP 400.
Signup is enabled for private review. A complete Turnstile-to-database signup remains pending.
No browser-control integration was available, so no screenshots or actual browser
tests were run. DOM tests do not verify CSS layout, native controls, focus presentation
or assistive technology. No confirmation email or email ownership check is configured.

## Vercel export — 13 October 2026

- [x] Owner tested a genuine signup; live database count was one.
- [x] Owner repeated the signup; database still held one unique registration.
- [x] Existing ChatGPT-hosted site made public on 13 October.
- [x] Standalone Vercel configuration, headers and complete source prepared.
- [ ] Owner deploys this export to Vercel.
- [ ] Add actual Vercel hostname in Turnstile and Supabase allowlists.
- [ ] Test signup and duplicates on the new Vercel origin.

Historical private-site/pending-signup entries above are superseded by this update.

## Packaging correction

- [x] Root HTML files are now compiled and link to populated adjacent assets.
- [x] HTML templates moved to src/pages; build refreshes both root and dist.
- [x] Relative CSS/JS/font links validated: 38 references in each output tree.
- [x] All 24 local tests and build passed after restructuring.
