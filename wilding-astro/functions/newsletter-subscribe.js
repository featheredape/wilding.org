/**
 * Newsletter Subscribe Endpoint
 * Cloudflare Pages Function
 *
 * Implements double opt-in:
 *   1. Receives email via POST
 *   2. Stores as unconfirmed in KV
 *   3. Sends confirmation email via Postmark
 *
 * Required bindings:
 *   - NEWSLETTER (KV namespace)
 *   - POSTMARK_SERVER_TOKEN (env var)
 *   - SITE_URL (env var, e.g. "https://wilding.org")
 */

export async function onRequestPost(context) {
    var { request, env } = context;

    var formData;
    try {
        formData = await request.formData();
    } catch (_) {
        return jsonResponse(400, { error: "Invalid form data." });
    }

    var email = (formData.get("email") || "").trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
        return jsonResponse(400, { error: "Please enter a valid email address." });
    }

    if (!env.NEWSLETTER) {
        console.error("NEWSLETTER KV namespace not bound");
        return jsonResponse(503, { error: "Newsletter system is temporarily unavailable." });
    }

    // Check if already subscribed
    var existing = await env.NEWSLETTER.get("sub:" + email, { type: "json" });
    if (existing && existing.confirmed) {
        // Already confirmed -- don't leak this info, just say success
        return jsonResponse(200, { message: "Check your email to confirm your subscription." });
    }

    // Generate confirmation token
    var token = generateToken();
    var subscriber = {
        email: email,
        confirmed: false,
        token: token,
        subscribed: new Date().toISOString(),
    };

    // Store in KV with 7-day expiration for unconfirmed
    await env.NEWSLETTER.put("sub:" + email, JSON.stringify(subscriber), {
        expirationTtl: 60 * 60 * 24 * 7,
    });

    // Also store token -> email mapping for confirmation lookup
    await env.NEWSLETTER.put("token:" + token, email, {
        expirationTtl: 60 * 60 * 24 * 7,
    });

    // Send confirmation email
    var siteUrl = env.SITE_URL || "https://wilding.org";
    var confirmUrl = siteUrl + "/newsletter-confirm?token=" + token;

    if (env.POSTMARK_SERVER_TOKEN) {
        try {
            await fetch("https://api.postmarkapp.com/email", {
                method: "POST",
                headers: {
                    "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    From: "Wilding Foundation <newsletter@wilding.org>",
                    To: email,
                    Subject: "Confirm your subscription to the Wilding Foundation newsletter",
                    HtmlBody: confirmEmailHtml(confirmUrl),
                    TextBody: confirmEmailText(confirmUrl),
                    MessageStream: "outbound",
                }),
            });
        } catch (e) {
            console.error("Confirmation email failed:", e);
        }
    }

    return jsonResponse(200, { message: "Check your email to confirm your subscription." });
}

export async function onRequestGet() {
    return jsonResponse(405, { error: "Method not allowed." });
}

function generateToken() {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var token = "";
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    for (var i = 0; i < 32; i++) {
        token += chars[bytes[i] % chars.length];
    }
    return token;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status: status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

function confirmEmailHtml(confirmUrl) {
    return [
        '<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #141414; max-width: 520px; margin: 0 auto; padding: 2rem;">',
        '<p style="font-size: 16px; line-height: 1.7;">Thanks for signing up for the Wilding Foundation newsletter.</p>',
        '<p style="font-size: 16px; line-height: 1.7;">Please confirm your subscription by clicking the link below:</p>',
        '<p style="margin: 1.5rem 0;">',
        '<a href="' + confirmUrl + '" style="display: inline-block; padding: 12px 24px; background: #457a2a; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-size: 15px;">Confirm subscription</a>',
        '</p>',
        '<p style="font-size: 14px; color: #6b6b6b; line-height: 1.6;">If you did not sign up, you can safely ignore this email. This link expires in 7 days.</p>',
        '<p style="font-size: 14px; color: #6b6b6b; margin-top: 2rem;">The Wilding Foundation<br>Salt Spring Island, BC</p>',
        '</body></html>',
    ].join("\n");
}

function confirmEmailText(confirmUrl) {
    return [
        "Thanks for signing up for the Wilding Foundation newsletter.",
        "",
        "Please confirm your subscription by visiting this link:",
        confirmUrl,
        "",
        "If you did not sign up, you can safely ignore this email. This link expires in 7 days.",
        "",
        "The Wilding Foundation",
        "Salt Spring Island, BC",
    ].join("\n");
}
