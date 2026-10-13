# Live setup — 12 October 2026

Supabase access is now working. The selected project is `parlonsmoi`
(`hbfwdnjrzlvsowtcfeuz`, eu-west-1), active and healthy.

## Completed against the real project

- Applied migration `20261012172205_create_waitlist`.
- Created private waitlist and rate-limit tables, validation, normalisation,
  uniqueness, forced RLS and least-privilege server grants.
- Executed `supabase/verify_permissions.sql` successfully.
- Tested a new signup and normalised duplicate under service_role in a transaction:
  one row, original values unchanged; rolled the transaction back. Zero real
  registrations remain. This tested the database, not Turnstile or a browser form.
- Saved the real Project URL and publishable key in `config/public.json`.
  Those values are public. No secret or service-role key is in source code.

Supabase's security advisor returned only two informational
[RLS enabled with no policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
one for each private table. No visitor policies is intentional: browser roles
have no access, while the narrowly granted server role performs the insert.

## Endpoint and live HTTP checks

- `join-waitlist` deployed successfully: ACTIVE, version 1, verify_jwt enabled.
- Public-key request reached the handler and returned HTTP 503/unavailable, as
  expected before required configuration is supplied. No success was simulated.
- Anonymous private-schema read: HTTP 406 (denied).
- Public waitlist discovery: HTTP 404 (not exposed).
- Anonymous direct signup RPC: HTTP 401 (denied).
- Local tests: 24 passed. Production build: passed.

## Remaining input

In Supabase Edge Function Secrets, set `TURNSTILE_SECRET_KEY`,
`WAITLIST_HMAC_SECRET`, `ALLOWED_ORIGINS` and `TURNSTILE_HOSTNAMES`.
`WAITLIST_SUPABASE_SECRET_KEY` is an optional dedicated-key override; the function
otherwise reads the hosted default key from `SUPABASE_SECRET_KEYS` internally.
Neither value is returned to the browser or the assistant.

The owner supplied the public Turnstile site key and contact email
(`parlonsmoi@gmail.com`); both are saved in `config/public.json`. Review the privacy
notice, enable the form after server configuration, and finish a real browser signup and duplicate test.
The historical configuration blockers above are superseded by the update below.

## Update: server configuration ready; private signup enabled

The owner confirmed saving the four server settings. Live checks now return:
private-schema read 406, public-table discovery 404, anonymous RPC 401, signup
without verification 400/verification, and browser OPTIONS preflight 204 with the
exact site origin allowed. Server configuration passes the handler readiness check.
The public flag is now true. The site's audience remains owner-private.
A real challenge completion and registration have NOT yet been verified; these
checks do not validate the Turnstile secret against a genuine successful token.
Ask the owner to submit through the hosted form, then check the database count
without displaying personal information. A public launch and privacy review remain.
