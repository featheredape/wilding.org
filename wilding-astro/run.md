# Run & Deploy

## Local Development

```bash
npm run dev
```

Starts the Astro dev server at `http://localhost:4321`. Cloudflare Pages Functions (newsletter, applications) won't work locally -- use `wrangler` for that:

```bash
npm run build
npx wrangler pages dev dist
```

This serves the built site with Cloudflare bindings (KV, env vars). Set local env vars with flags:

```bash
npx wrangler pages dev dist \
  --binding POSTMARK_SERVER_TOKEN=your-token \
  --binding SITE_URL=http://localhost:8788 \
  --binding NOTIFY_EMAIL=workshops@wilding.org
```

## Deploy to Production

```bash
npm run build && npx wrangler pages deploy dist --project-name wilding-org
```

## Rebuild from Scratch

If you hit dependency errors (missing modules, platform mismatches):

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Send Newsletter

```bash
node scripts/send-newsletter.js --subject "Subject Line" --html path/to/newsletter.html --dry-run
```

Remove `--dry-run` to actually send. Requires these env vars (set in shell or `.env`):

```
CF_ACCOUNT_ID=your-account-id
CF_API_TOKEN=your-api-token
KV_NAMESPACE_ID=your-kv-namespace-id
POSTMARK_SERVER_TOKEN=your-postmark-token
SITE_URL=https://wilding.org
```
