# Cloudflare Bindings Setup

This guide walks through configuring the Cloudflare Pages bindings needed by the Wilding Foundation site. You need two KV namespaces and several environment variables.

---

## 1. Create KV Namespaces

Go to **Workers & Pages > KV** in the Cloudflare dashboard (or use the CLI).

Create two namespaces:

- `NEWSLETTER` -- stores newsletter subscribers
- `APPLICATIONS` -- stores shoemaking workshop applications

### Via the dashboard

1. Go to https://dash.cloudflare.com
2. Select your account
3. In the left sidebar, click **Workers & Pages**, then **KV**
4. Click **Create a namespace**
5. Name it `NEWSLETTER`, click **Add**
6. Repeat for `APPLICATIONS`

### Via Wrangler CLI

```bash
npx wrangler kv namespace create NEWSLETTER
npx wrangler kv namespace create APPLICATIONS
```

Each command will output a namespace ID. Save these -- you will need them below and for the newsletter send script.

---

## 2. Bind KV Namespaces to Your Pages Project

1. Go to **Workers & Pages** in the Cloudflare dashboard
2. Click on your Pages project (e.g. `wilding-astro`)
3. Go to **Settings > Functions**
4. Scroll to **KV namespace bindings**
5. Click **Add binding** and add both:

| Variable name  | KV namespace  |
|---------------|---------------|
| `NEWSLETTER`   | NEWSLETTER    |
| `APPLICATIONS` | APPLICATIONS  |

Make sure to add these bindings for both **Production** and **Preview** environments if you want them available in preview deployments too.

---

## 3. Set Environment Variables

Still in your Pages project settings:

1. Go to **Settings > Environment variables**
2. Add the following variables:

| Variable               | Value                          | Notes                                      |
|------------------------|--------------------------------|--------------------------------------------|
| `POSTMARK_SERVER_TOKEN`| Your Postmark server token     | For sending emails via Postmark            |
| `SITE_URL`             | `https://wilding.org`          | Used for confirmation/unsubscribe links    |
| `NOTIFY_EMAIL`         | Your email address             | Where shoemaking applications are sent     |

Set these for **Production**. Optionally set them for **Preview** too (you may want a different `SITE_URL` for preview, e.g. your `*.pages.dev` URL).

For sensitive values like `POSTMARK_SERVER_TOKEN`, click **Encrypt** to store them securely.

---

## 4. Set Up Postmark

If you don't already have an account:

1. Go to https://postmarkapp.com and sign up
2. Create a new **Server** (e.g. "Wilding Foundation")
3. Under **Message Streams**, you'll have a default "Transactional" stream (used for confirmation emails). Create a **Broadcast** stream for newsletters.
4. Go to **Sender Signatures** and verify your sending domain (`wilding.org`) -- Postmark will give you DNS records to add (DKIM + Return-Path)
5. The "from" address used is `newsletter@wilding.org` -- ensure this is covered by your domain verification
6. Go to **API Tokens** on the server and copy the **Server API token** -- this is your `POSTMARK_SERVER_TOKEN`

---

## 5. Configure the Newsletter Send Script

The send script (`scripts/send-newsletter.js`) runs locally on your machine and needs its own environment variables. These are different from the Pages bindings because the script talks directly to the Cloudflare and Postmark APIs.

Create a `.env` file in the project root (it is already in `.gitignore`):

```
CF_ACCOUNT_ID=your-cloudflare-account-id
CF_API_TOKEN=your-cloudflare-api-token
KV_NAMESPACE_ID=your-newsletter-kv-namespace-id
POSTMARK_SERVER_TOKEN=your-postmark-server-token
SITE_URL=https://wilding.org
```

### Where to find these values

**CF_ACCOUNT_ID** -- Your Cloudflare account ID. Find it on the right sidebar of any zone's overview page in the dashboard, or under **Workers & Pages > Overview**.

**CF_API_TOKEN** -- Create an API token with KV read access:
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use the **Custom token** template
4. Under Permissions, add: **Account > Workers KV Storage > Read**
5. Click **Continue to summary**, then **Create Token**
6. Copy the token value

**KV_NAMESPACE_ID** -- The ID of your `NEWSLETTER` KV namespace. Find it under **Workers & Pages > KV**, click on the namespace, and copy the ID from the page or URL.

---

## 6. Sending a Newsletter

Once everything is configured, write your newsletter as an HTML file, then:

```bash
# Preview who will receive it
node scripts/send-newsletter.js --subject "March 2026 Update" --html newsletter.html --dry-run

# Send for real
node scripts/send-newsletter.js --subject "March 2026 Update" --html newsletter.html
```

The script loads `.env` automatically if you have `dotenv` installed, otherwise export the variables in your shell before running.

---

## 7. Verify Everything Works

After deploying, test the full flow:

1. Subscribe at wilding.org using a test email address
2. Check for the confirmation email
3. Click the confirmation link -- you should see "You're subscribed"
4. Run the send script with `--dry-run` to verify your test email appears in the subscriber list
5. Test unsubscribe by clicking the unsubscribe link in a sent newsletter

---

## Quick Reference: All Bindings

### KV Namespace Bindings (Pages Functions)

| Binding name   | Purpose                          |
|---------------|----------------------------------|
| `NEWSLETTER`   | Newsletter subscriber storage    |
| `APPLICATIONS` | Workshop application storage     |

### Environment Variables (Pages Functions)

| Variable                | Purpose                              |
|------------------------|--------------------------------------|
| `POSTMARK_SERVER_TOKEN` | Sending emails via Postmark          |
| `SITE_URL`              | Base URL for links in emails         |
| `NOTIFY_EMAIL`          | Application notification recipient   |

### Environment Variables (Local Send Script)

| Variable                | Purpose                                  |
|------------------------|------------------------------------------|
| `CF_ACCOUNT_ID`         | Cloudflare account ID                    |
| `CF_API_TOKEN`          | API token with KV read permission        |
| `KV_NAMESPACE_ID`       | Newsletter KV namespace ID               |
| `POSTMARK_SERVER_TOKEN` | Postmark server API token                |
| `SITE_URL`              | Base URL for unsubscribe links           |
