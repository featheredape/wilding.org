/**
 * Shoemaking Workshop Application Handler
 * Cloudflare Pages Function
 *
 * Receives form submissions via POST, validates them,
 * stores in KV, and sends a notification email.
 *
 * Required bindings (set in Cloudflare dashboard or wrangler.toml):
 *   - APPLICATIONS (KV namespace) -- stores submissions
 *   - NOTIFY_EMAIL (env var)      -- where to send notifications
 *   - POSTMARK_SERVER_TOKEN (env var) -- API token for Postmark (https://postmarkapp.com)
 */

var VALID_ON_ISLAND = ["yes", "no"];
var VALID_APPLICANT_TYPES = ["emerging", "established", "hobbyist", "other"];

export async function onRequestPost(context) {
    var { request, env } = context;

    var formData;
    try {
        formData = await request.formData();
    } catch (_) {
        return jsonResponse(400, { error: "Invalid form data." });
    }

    // Honeypot -- if this hidden field has a value, it's a bot
    var honeypot = (formData.get("website") || "").trim();
    if (honeypot) {
        // Return 200 so bots think it worked, but do nothing
        return new Response("Application submitted successfully.", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    var name = (formData.get("name") || "").trim();
    var email = (formData.get("email") || "").trim();
    var phone = (formData.get("phone") || "").trim();
    var background = (formData.get("background") || "").trim();
    var draws_you = (formData.get("draws_you") || "").trim();
    var on_island = (formData.get("on_island") || "").trim();
    var travel = (formData.get("travel") || "").trim();
    var applicant_type = (formData.get("applicant_type") || "").trim();
    var commitment = formData.has("commitment") ? "Yes" : "No";

    // Required field validation
    if (!name || !email || !phone || !background || !draws_you) {
        return jsonResponse(400, { error: "Missing required fields." });
    }

    if (!isValidEmail(email)) {
        return jsonResponse(400, { error: "Invalid email address." });
    }

    // Validate enum fields
    if (!on_island || !VALID_ON_ISLAND.includes(on_island)) {
        return jsonResponse(400, { error: "Please select whether you live on Salt Spring Island." });
    }

    if (!applicant_type || !VALID_APPLICANT_TYPES.includes(applicant_type)) {
        return jsonResponse(400, { error: "Please select an applicant type." });
    }

    var submitted = new Date().toISOString();
    var id = "app_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    var submission = {
        id: id,
        name: name,
        email: email,
        phone: phone,
        background: background,
        draws_you: draws_you,
        on_island: on_island,
        travel: travel,
        applicant_type: applicant_type,
        commitment: commitment,
        submitted: submitted,
    };

    // Check that at least one backend is configured
    var hasStorage = Boolean(env.APPLICATIONS);
    var hasEmail = Boolean(env.POSTMARK_SERVER_TOKEN && env.NOTIFY_EMAIL);

    if (!hasStorage && !hasEmail) {
        console.error("SUBMISSION LOST -- no storage or email configured:", JSON.stringify(submission));
        return jsonResponse(503, { error: "Application system is temporarily unavailable. Please email info@wilding.org directly." });
    }

    var stored = false;
    if (hasStorage) {
        try {
            await env.APPLICATIONS.put(id, JSON.stringify(submission));
            stored = true;
        } catch (e) {
            console.error("KV write failed:", e);
        }
    }

    var emailed = false;
    if (hasEmail) {
        try {
            var emailBody = [
                "New Shoemaking Workshop Application",
                "====================================",
                "",
                "Name:            " + name,
                "Email:           " + email,
                "Phone:           " + phone,
                "On island:       " + on_island,
                "Travel plans:    " + (travel || "N/A"),
                "Applicant type:  " + applicant_type,
                "Committed:       " + commitment,
                "",
                "Creative / Artistic Background:",
                background,
                "",
                "What draws you to shoemaking:",
                draws_you,
                "",
                "Submitted:  " + submitted,
            ].join("\n");

            // Only use validated email as reply_to
            var replyTo = isValidEmail(email) ? email : undefined;

            var emailPayload = {
                From: "Wilding Foundation <info@wilding.org>",
                To: env.NOTIFY_EMAIL,
                Subject: "New Shoemaking Workshop Application: " + name,
                TextBody: emailBody,
                MessageStream: "outbound",
            };

            if (replyTo) {
                emailPayload.ReplyTo = replyTo;
            }

            var res = await fetch("https://api.postmarkapp.com/email", {
                method: "POST",
                headers: {
                    "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(emailPayload),
            });

            emailed = res.ok;
        } catch (e) {
            console.error("Email send failed:", e);
        }
    }

    if (stored || emailed) {
        return new Response("Application submitted successfully.", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    // Both backends were configured but both failed
    return jsonResponse(500, { error: "We could not process your application. Please try again or email info@wilding.org directly." });
}

export async function onRequestGet() {
    return jsonResponse(405, { error: "Method not allowed." });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), {
        status: status,
        headers: { "Content-Type": "application/json" },
    });
}
