# Exact project paths

All paths below are relative to the project root. Each is included in full in the
source archive. `docs/COMPLETE_SOURCE.md` is a generated readable copy of every
text source file. The source stays split into maintainable files.

```text
.env.example
.gitignore
.vercelignore
README.md
START_HERE.md
assets/README.md
assets/fonts/OFL.txt
assets/main.js
assets/styles.css
config/public.json
contact.html
docs/DEPLOYMENT.md
docs/FILES.md
docs/LIVE_STATUS.md
docs/PROJECT_CHECKLIST.md
docs/SECURITY.md
docs/TESTING.md
index.html
package-lock.json
package.json
privacy.html
scripts/build.mjs
scripts/export-source.mjs
scripts/preview.mjs
scripts/verify-live.mjs
src/css/styles.css
src/js/main.js
src/js/supabase.js
src/js/turnstile.js
src/pages/contact.html
src/pages/index.html
src/pages/privacy.html
supabase/.env.example
supabase/config.toml
supabase/functions/_shared/validation.js
supabase/functions/_shared/waitlist-handler.js
supabase/functions/join-waitlist/index.ts
supabase/migrations/20261012172205_create_waitlist.sql
supabase/verify_permissions.sql
tests/database.test.mjs
tests/handler.test.mjs
tests/ui.test.mjs
tests/validation.test.mjs
vercel.json
```

Generated outputs: `dist/index.html`, `dist/privacy.html`, `dist/contact.html`,
`dist/assets/main.js`, `dist/assets/styles.css`, the Oswald files under
`dist/assets/fonts/`, `dist/robots.txt` and `dist/_headers`. Run `npm run build`
to reproduce them. Only the dist folder is published.
