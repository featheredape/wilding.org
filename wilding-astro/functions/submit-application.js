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
 *   - RESEND_API_KEY (env var)    -- API key for Resend (https://resend.com)
 */

export async function onRequestPost(context) {
    var { request, env } = context;

    var formData;
    try {
        formData = await request.formData();
    } catch (_) {
        return jsonResponse(400, { error: "Invalid form data." });
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

    if (!name || !email || !phone || !background || !draws_you) {
        return jsonResponse(400, { error: "Missing required fields." });
    }

    if (!isValidEmail(email)) {
        return jsonResponse(400, { error: "Invalid email address." });
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

    var stored = false;
    if (env.APPLICATIONS) {
        try {
            await env.APPLICATIONS.put(id, JSON.stringify(submission));
            stored = true;
        } catch (e) {
            console.error("KV write failed:", e);
        }
    }

    var emailed = false;
    if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
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

            var res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + env.RESEND_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: "Wilding Foundation <noreply@wilding.org>",
                    to: [env.NOTIFY_EMAIL],
                    reply_to: email,
                    subject: "New Shoemaking Workshop Application: " + name,
                    text: emailBody,
                }),
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

    console.log("SUBMISSION (no storage configured):", JSON.stringify(submission));
    return new Response("Application received.", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
    });
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
