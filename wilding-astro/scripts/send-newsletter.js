#!/usr/bin/env node

/**
 * Newsletter Send Script
 * Run locally to send a newsletter to all confirmed subscribers.
 *
 * Usage:
 *   node scripts/send-newsletter.js --subject "March 2026 Update" --html newsletter.html
 *   node scripts/send-newsletter.js --subject "March 2026 Update" --html newsletter.html --dry-run
 *
 * Environment variables (set in .env or export):
 *   CF_ACCOUNT_ID    - Cloudflare account ID
 *   CF_API_TOKEN     - Cloudflare API token with KV read access
 *   KV_NAMESPACE_ID  - NEWSLETTER KV namespace ID
 *   POSTMARK_SERVER_TOKEN - Postmark server API token
 *   SITE_URL         - Site URL (default: https://wilding.org)
 *
 * The script:
 *   1. Lists all confirmed subscribers from KV
 *   2. Sends each email individually via Postmark (with personalized unsubscribe link)
 *   3. Logs results
 */

var fs = require("fs");
var path = require("path");

// Parse args
var args = process.argv.slice(2);
var subject = "";
var htmlFile = "";
var dryRun = false;

for (var i = 0; i < args.length; i++) {
    if (args[i] === "--subject" && args[i + 1]) subject = args[++i];
    else if (args[i] === "--html" && args[i + 1]) htmlFile = args[++i];
    else if (args[i] === "--dry-run") dryRun = true;
}

if (!subject || !htmlFile) {
    console.error("Usage: node scripts/send-newsletter.js --subject \"Subject\" --html newsletter.html [--dry-run]");
    process.exit(1);
}

var CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
var CF_API_TOKEN = process.env.CF_API_TOKEN;
var KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID;
var POSTMARK_SERVER_TOKEN = process.env.POSTMARK_SERVER_TOKEN;
var SITE_URL = process.env.SITE_URL || "https://wilding.org";

if (!CF_ACCOUNT_ID || !CF_API_TOKEN || !KV_NAMESPACE_ID || !POSTMARK_SERVER_TOKEN) {
    console.error("Missing required environment variables. Need: CF_ACCOUNT_ID, CF_API_TOKEN, KV_NAMESPACE_ID, POSTMARK_SERVER_TOKEN");
    process.exit(1);
}

var htmlTemplate = fs.readFileSync(path.resolve(htmlFile), "utf-8");

async function main() {
    // 1. List all subscribers from KV
    console.log("Fetching subscriber list...");
    var subscribers = await listConfirmedSubscribers();
    console.log("Found " + subscribers.length + " confirmed subscriber(s).");

    if (dryRun) {
        console.log("\n[DRY RUN] Would send to:");
        subscribers.forEach(function (s) { console.log("  " + s.email); });
        console.log("\nSubject: " + subject);
        console.log("No emails sent.");
        return;
    }

    // 2. Send to each subscriber
    var sent = 0;
    var failed = 0;

    for (var sub of subscribers) {
        var unsubUrl = SITE_URL + "/newsletter-unsubscribe?email=" + encodeURIComponent(sub.email) + "&token=" + sub.token;
        var personalizedHtml = htmlTemplate + unsubscribeFooter(unsubUrl);

        try {
            var res = await fetch("https://api.postmarkapp.com/email", {
                method: "POST",
                headers: {
                    "X-Postmark-Server-Token": POSTMARK_SERVER_TOKEN,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    From: "Wilding Foundation <info@wilding.org>",
                    To: sub.email,
                    Subject: subject,
                    HtmlBody: personalizedHtml,
                    TextBody: htmlToPlainText(personalizedHtml),
                    MessageStream: "newsletter",
                    Headers: [
                        { Name: "List-Unsubscribe", Value: "<" + unsubUrl + ">" },
                        { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
                    ],
                }),
            });

            if (res.ok) {
                sent++;
                console.log("  Sent: " + sub.email);
            } else {
                failed++;
                var err = await res.text();
                console.error("  FAILED: " + sub.email + " - " + err);
            }
        } catch (e) {
            failed++;
            console.error("  ERROR: " + sub.email + " - " + e.message);
        }

        // Rate limit: ~2 per second to stay within Postmark limits
        await sleep(500);
    }

    console.log("\nDone. Sent: " + sent + ", Failed: " + failed);
}

async function listConfirmedSubscribers() {
    var subscribers = [];
    var cursor = undefined;
    var baseUrl = "https://api.cloudflare.com/client/v4/accounts/" + CF_ACCOUNT_ID + "/storage/kv/namespaces/" + KV_NAMESPACE_ID;

    // List all keys with prefix "sub:"
    do {
        var listUrl = baseUrl + "/keys?prefix=sub:&limit=1000";
        if (cursor) listUrl += "&cursor=" + cursor;

        var res = await fetch(listUrl, {
            headers: { Authorization: "Bearer " + CF_API_TOKEN },
        });
        var data = await res.json();

        if (!data.success) {
            console.error("KV list failed:", JSON.stringify(data.errors));
            break;
        }

        // Fetch subscriber data in parallel batches of 10
        var keys = data.result;
        for (var j = 0; j < keys.length; j += 10) {
            var batch = keys.slice(j, j + 10);
            var results = await Promise.all(batch.map(function (key) {
                return fetch(baseUrl + "/values/" + encodeURIComponent(key.name), {
                    headers: { Authorization: "Bearer " + CF_API_TOKEN },
                }).then(function (r) { return r.json(); });
            }));
            results.forEach(function (sub) {
                if (sub.confirmed) subscribers.push(sub);
            });
        }

        cursor = data.result_info && data.result_info.cursor;
    } while (cursor);

    return subscribers;
}

function htmlToPlainText(html) {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
        .replace(/<[^>]+>/g, "")
        .replace(/&middot;/g, "-")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function unsubscribeFooter(unsubUrl) {
    return [
        '<div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e5e5; text-align: center;">',
        '<p style="font-size: 13px; color: #6b6b6b; line-height: 1.6;">',
        "The Wilding Foundation &middot; Salt Spring Island, BC<br>",
        'You received this because you subscribed to our newsletter.<br>',
        '<a href="' + unsubUrl + '" style="color: #457a2a;">Unsubscribe</a>',
        "</p></div>",
    ].join("\n");
}

function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

main().catch(function (e) {
    console.error("Fatal error:", e);
    process.exit(1);
});
