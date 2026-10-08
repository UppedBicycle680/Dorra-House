# Dorra House · Online Alpha

A browser game world hosted on GitHub Pages, with Supabase email/password accounts, usernames and automatic cloud saves. Multiplayer, leaderboards and an administrator UI are deferred.

The original House, casino tables, collecting, estate, football, Strategic Command and Airports interfaces remain. Browser clients send decisions; the Supabase `dorra-api` Edge Function computes protected outcomes and commits a player’s save. Whole browser saves are never accepted.

## Run and build

Use Node 22 or newer (CI uses Node 24):

```sh
npm ci
npm run check
npm test
npm run build
npm run serve
```

Visit `http://localhost:4173/Dorra-House/`. This is a static development server, and gameplay still requires the configured Supabase project. The application has no offline save fallback.

The build publishes `dist/` only. It keeps original artwork in the repository and converts published PNG images to WebP at their original dimensions, quality 95. Server modules, database migrations, tests, the old launcher and the offline vault are excluded from the hosted artifact.

## Deployment

The `Alpha` branch runs `.github/workflows/alpha-pages.yml`, which checks the code, runs regression tests, builds the site and deploys the artifact to GitHub Pages. Enable Actions deployment in the repository’s Pages settings if initial automatic configuration is unavailable. If GitHub creates the `github-pages` environment with branch restrictions, allow the `Alpha` branch.

Enable **Enforce HTTPS** in Settings → Pages. The intended address is https://uppedbicycle680.github.io/Dorra-House/ . See [ONLINE-ALPHA.md](ONLINE-ALPHA.md) for Supabase configuration, validation and operating limits.
