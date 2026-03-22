/**
 * Newsletter Confirm Endpoint
 * Cloudflare Pages Function
 *
 * Completes double opt-in:
 *   1. Looks up token -> email
 *   2. Marks subscriber as confirmed (no TTL expiration)
 *   3. Redirects to a thank-you page
 *
 * Required bindings:
 *   - NEWSLETTER (KV namespace)
 *   - SITE_URL (env var)
 */

export async function onRequestGet(context) {
    var { request, env } = context;
    var url = new URL(request.url);
    var token = url.searchParams.get("token");
    var siteUrl = env.SITE_URL || "https://wilding.org";

    if (!token) {
        return redirectWithMessage(siteUrl, "invalid");
    }

    if (!env.NEWSLETTER) {
        return redirectWithMessage(siteUrl, "error");
    }

    // Look up token
    var email = await env.NEWSLETTER.get("token:" + token);
    if (!email) {
        return redirectWithMessage(siteUrl, "expired");
    }

    // Get subscriber record
    var subscriber = await env.NEWSLETTER.get("sub:" + email, { type: "json" });
    if (!subscriber) {
        return redirectWithMessage(siteUrl, "expired");
    }

    // Mark as confirmed -- store permanently (no expirationTtl)
    subscriber.confirmed = true;
    subscriber.confirmedAt = new Date().toISOString();
    await env.NEWSLETTER.put("sub:" + email, JSON.stringify(subscriber));

    // Clean up token
    await env.NEWSLETTER.delete("token:" + token);

    return redirectWithMessage(siteUrl, "confirmed");
}

function redirectWithMessage(siteUrl, status) {
    return new Response(redirectHtml(siteUrl, status), {
        status: 200,
        headers: { "Content-Type": "text/html" },
    });
}

function redirectHtml(siteUrl, status) {
    var messages = {
        confirmed: {
            heading: "You're subscribed",
            body: "Thanks for confirming. You'll receive the Wilding Foundation newsletter going forward.",
        },
        expired: {
            heading: "Link expired",
            body: "This confirmation link has expired or was already used. Visit our homepage to subscribe again.",
        },
        invalid: {
            heading: "Invalid link",
            body: "This confirmation link is not valid. Visit our homepage to subscribe again.",
        },
        error: {
            heading: "Something went wrong",
            body: "We couldn't process your confirmation. Please try again later.",
        },
    };

    var msg = messages[status] || messages.error;

    return [
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
}
