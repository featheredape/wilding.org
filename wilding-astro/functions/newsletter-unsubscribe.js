/**
 * Newsletter Unsubscribe Endpoint
 * Cloudflare Pages Function
 *
 * Handles one-click unsubscribe:
 *   - GET /newsletter-unsubscribe?email=xxx&token=xxx
 *   - Verifies token matches subscriber record
 *   - Deletes subscriber from KV
 *   - Shows confirmation page
 *
 * Required bindings:
 *   - NEWSLETTER (KV namespace)
 *   - SITE_URL (env var)
 */

export async function onRequestGet(context) {
    var { request, env } = context;
    var url = new URL(request.url);
    var email = (url.searchParams.get("email") || "").trim().toLowerCase();
    var token = url.searchParams.get("token") || "";
    var siteUrl = env.SITE_URL || "https://wilding.org";

    if (!email || !token) {
        return showPage(siteUrl, "invalid");
    }

    if (!env.NEWSLETTER) {
        return showPage(siteUrl, "error");
    }

    // Look up subscriber
    var subscriber = await env.NEWSLETTER.get("sub:" + email, { type: "json" });
    if (!subscriber || subscriber.token !== token) {
        // Already unsubscribed or invalid -- show success anyway
        // (don't leak whether an email is subscribed)
        return showPage(siteUrl, "unsubscribed");
    }

    // Delete subscriber
    await env.NEWSLETTER.delete("sub:" + email);

    return showPage(siteUrl, "unsubscribed");
}

// Also handle POST for List-Unsubscribe-Post header (RFC 8058)
export async function onRequestPost(context) {
    return onRequestGet(context);
}

function showPage(siteUrl, status) {
    var messages = {
        unsubscribed: {
            heading: "You've been unsubscribed",
            body: "You will no longer receive the Wilding Foundation newsletter. If this was a mistake, you can subscribe again on our homepage.",
        },
        invalid: {
            heading: "Invalid link",
            body: "This unsubscribe link is not valid.",
        },
        error: {
            heading: "Something went wrong",
            body: "We couldn't process your request. Please try again later.",
        },
    };

    var msg = messages[status] || messages.error;

    var html = [
        "<!DOCTYPE html>",
        '<html lang="en"><head>',
        '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">',
        "<title>" + msg.heading + " - The Wilding Foundation</title>",
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:wght@700&display=swap" rel="stylesheet">',
        "<style>",
        '  body { font-family: "Inter", sans-serif; background: #f5f5f3; color: #141414; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 2rem; }',
        "  .card { background: #fff; border-radius: 14px; padding: 2.5rem; max-width: 480px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); text-align: center; }",
        '  h1 { font-family: "Fraunces", Georgia, serif; font-size: 1.5rem; margin-bottom: 0.75rem; }',
        "  p { color: #6b6b6b; line-height: 1.7; margin-bottom: 1.5rem; }",
        "  a { display: inline-block; padding: 0.65rem 1.3rem; background: #457a2a; color: #fff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 0.85rem; }",
        "  a:hover { background: #3a6b2a; }",
        "</style></head><body>",
        '<div class="card">',
        "<h1>" + msg.heading + "</h1>",
        "<p>" + msg.body + "</p>",
        '<a href="' + siteUrl + '">Back to wilding.org</a>',
        "</div></body></html>",
    ].join("\n");

    return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html" },
    });
}
