# ParlonsMoi — Vercel deployment package

Read **START_HERE.md** first. This folder contains the complete HTML, Tailwind,
vanilla JavaScript, SQL migrations, Edge Function source and tests. The existing
Supabase backend is already deployed: do not rerun its migration.

The owner tested genuine signup and duplicate handling on the existing site;
Supabase contained one registration after both submissions. The existing site is
public. This Vercel export has not been deployed to your Vercel account.

`vercel.json` selects Other, runs `npm ci` and `npm run build`, serves `dist`,
and sets HTTP security headers. Public settings are already in `config/public.json`.
Server secrets remain only in Supabase. Deploy the whole project, not just source
index.html. The compiled `dist` is supplied for inspection but Vercel rebuilds it.

The build uses Vercel's production hostname automatically. After the first deploy,
set PUBLIC_SITE_URL to your stable production HTTPS origin and redeploy. Add that
hostname to Turnstile and Supabase before expecting signup to work on the new host.

Commands: `npm ci`, `npm test`, `npm run build`, `npm run preview`.
Node.js 22 or newer is required. Vercel Node.js 24.x is suitable.

Complete exact file contents are in docs/COMPLETE_SOURCE.md as well as individual
files. docs/PROJECT_CHECKLIST.md records decisions, tests and remaining work.
Read START_HERE.md for Vercel instructions; docs/DEPLOYMENT.md also contains the
original backend setup history and general deployment instructions.

## Linked root files

The root index.html, privacy.html and contact.html are compiled pages. Their
styles and scripts are beside them in assets/styles.css and assets/main.js, with
fonts in assets/fonts. All asset references are relative. The same complete
website is in dist for Vercel. Edit templates in src/pages and run npm run build
to update both copies. Do not edit the generated root pages directly.
Use npm run preview to test JavaScript and signup over HTTP; double-clicking
HTML is not a reliable way to run JavaScript modules or Turnstile.
