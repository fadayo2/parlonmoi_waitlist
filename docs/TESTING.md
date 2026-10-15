# Practical test record and launch checklist

## Verified locally on 12 October 2026

`npm test`: **24 passing assertions, 0 failures**. `npm run build`: passed.

| Area | What actually ran |
| --- | --- |
| PostgreSQL | Complete migration and permission assertions in PGlite; required constraints, normalisation, generated fields, uniqueness, denied anon/authenticated reads/writes/RPC, RLS fallback, limited server grants, email/global quotas |
| Server handler | Normalised payload, generic accepted response, missing config, CORS, preflight, malformed/oversized payloads, invalid fields, honeypot, invalid/replayed/mismatched tokens, DB/network failure, 429 |
| Form logic | Simulated DOM: closed signup, field errors, first-error focus, duplicate-click lock, pending state, success only after resolved write, failure without reset/success, new verification needed |
| Navigation/structure | Simulated menu open/Escape/focus; one h1, labels, unique IDs and internal anchors |
| Build | Compiled Tailwind, bundled JS, 3 HTML pages, locally bundled Oswald |

PGlite uses real PostgreSQL locally. Server/DOM tests use mocked services and do
not prove a live Supabase connection. There was no available browser-control
integration, so no browser, screenshot or visual-layout checks were performed.
The Deno endpoint is now deployed and responds with 503/unavailable while required
configuration is missing. Live permission assertions, rolled-back database duplicate
tests and negative HTTP checks passed. A real Turnstile/browser signup is pending.

## Complete these in a real browser

| Test | Expected result | Status |
| --- | --- | --- |
| 320, 375, 768, 1024 and 1440 px widths | No horizontal scrolling, overlap or cut-off text; readable spacing | Pending |
| 200% and 400% zoom | Content reflows; form and navigation stay usable | Pending |
| Mobile menu | Toggle opens/closes; anchor links navigate; Escape closes and restores focus | Pending |
| Keyboard only | Visible focus, skip link, all links/controls reachable; no focus traps | Pending |
| Screen reader | Labels, invalid fields, busy/error/success feedback announced in sensible order | Pending |
| Reduced motion | No forced smooth-scroll motion | Pending |
| Empty/invalid form | Labelled field errors; no network registration request | Pending |
| Valid signup | Real verified request; accepted message only after DB completion | Pending |
| Duplicate email | New Turnstile token; same message; one row; original details unchanged | Pending |
| Rapid double click | Only one submission while pending | Pending |
| Expired/replayed captcha | Rejected; fresh verification needed; no DB write | Pending |
| Wrong hostname/action | Rejected by server | Pending |
| Turnstile unavailable | Error explains that nothing was sent; no fake success | Pending |
| Network offline / timeout | Values preserved; error; retry safe if original committed | Pending |
| DB failure | In staging, make the RPC unavailable; generic error, no success | Pending |
| 4 attempts for one email | 4th attempt within the same window gets 429 | Pending |
| SQL permissions | `supabase/verify_permissions.sql` finishes without FAIL | Passed live |
| Anonymous Data API/RPC | Database-only live checks: read 406, discovery 404, RPC 401 | Passed live |
| Direct authenticated access | SQL checks deny authenticated; test a staging user token if Auth is enabled | Pending |
| Browser console | No uncaught JS, CSP, CORS, missing-font or network configuration errors | Pending |
| HTTP response headers | CSP, nosniff, referrer and framing policy actually delivered by chosen host | Pending |
| Contact/privacy | Real contact address works; reviewed notice matches actual operation | Pending |

Use a staging project or controlled test addresses for failure/limit tests. Do not
disable production safeguards to create a demonstration of success. For a database
failure test, restore the staging RPC after testing and rerun permission checks.
Do not share raw registrations in screenshots or error reports.

## What to send back for debugging

The step/command you ran, the exact error, the HTTP status and generic response
body, and whether this was local preview, staging or production. Include a browser
screenshot only if it contains no personal data or keys. Do not send secret keys,
passwords, auth tokens or full customer records.

## Latest live checks

After the owner saved server settings, all four `npm run verify:live` checks
passed. OPTIONS preflight returned 204 and the exact allowed website origin.
The earlier configuration-unavailable response is resolved. Genuine Turnstile
completion, successful browser registration, and duplicate testing remain pending.

## Community count checks

29 tests now pass: aggregate permissions/response shape, read coalescing/cache,
error paths, real zero/singular states, duplicates do not increment locally, stale
counts are labelled, initial errors never show fake zero, and reduced-motion causes
no scroll animation frames. Live stats response shape and direct RPC denial passed.
After deployment, check the section at 320px/390px/tablet/desktop, keyboard retry,
reduced-motion, unavailable endpoint, successful signup and refresh within 90 seconds.
No visual browser QA was available during this update.
