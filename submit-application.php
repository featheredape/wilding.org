<?php
/**
 * Shoemaking Workshop Application Handler
 * Receives form submissions, emails them, and saves to CSV.
 *
 * SETUP: Change the $recipient_email below to your address.
 */

$recipient_email = 'info@wilding.org';   // ← Change this to your email
$subject         = 'New Shoemaking Workshop Application';

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method not allowed.');
}

// Sanitize inputs
$name       = trim(htmlspecialchars($_POST['name']       ?? '', ENT_QUOTES, 'UTF-8'));
$email      = trim(filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL));
$background = trim(htmlspecialchars($_POST['background'] ?? '', ENT_QUOTES, 'UTF-8'));
$interest   = trim(htmlspecialchars($_POST['interest']   ?? '', ENT_QUOTES, 'UTF-8'));
$commitment = isset($_POST['commitment']) ? 'Yes' : 'No';
$submitted  = date('Y-m-d H:i:s');

// Validate required fields
if (empty($name) || empty($email) || empty($background) || empty($interest)) {
    http_response_code(400);
    exit('Missing required fields.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    exit('Invalid email address.');
}

// ── Build email ──
$body  = "New application for the Shoemaking Workshop\n";
$body .= "===========================================\n\n";
$body .= "Name:       $name\n";
$body .= "Email:      $email\n";
$body .= "Committed:  $commitment\n\n";
$body .= "Creative / Artistic Background:\n$background\n\n";
$body .= "Why Shoemaking:\n$interest\n\n";
$body .= "Submitted:  $submitted\n";

$headers  = "From: Wilding Foundation <noreply@wilding.org>\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$mail_sent = mail($recipient_email, $subject, $body, $headers);

// ── Save to CSV backup ──
$csv_dir  = __DIR__ . '/data';
$csv_file = $csv_dir . '/applications.csv';

if (!is_dir($csv_dir)) {
    mkdir($csv_dir, 0750, true);
}

$write_header = !file_exists($csv_file);
$fp = fopen($csv_file, 'a');

if ($fp) {
    if ($write_header) {
        fputcsv($fp, ['Submitted', 'Name', 'Email', 'Background', 'Interest', 'Committed']);
    }
    fputcsv($fp, [$submitted, $name, $email, $background, $interest, $commitment]);
    fclose($fp);
}

// ── Respond ──
if ($mail_sent) {
    http_response_code(200);
    echo 'Application submitted successfully.';
} else {
    // CSV saved even if mail fails, so still a partial success
    if (file_exists($csv_file)) {
        http_response_code(200);
        echo 'Application saved. Email notification may be delayed.';
    } else {
        http_response_code(500);
        echo 'An error occurred. Please try again.';
    }
}
