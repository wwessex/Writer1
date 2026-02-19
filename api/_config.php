<?php
/**
 * DraftHarbour Studio — Server proxy configuration.
 *
 * Fill in the API keys for each provider you want to enable.
 * This file is protected by .htaccess and never served to browsers.
 */

return [
    // ── Provider keys ────────────────────────────────────────────────
    'groq' => [
        'api_key' => '',   // Get yours at https://console.groq.com
        'enabled' => true,
    ],
    'openrouter' => [
        'api_key'   => '',  // Get yours at https://openrouter.ai/keys
        'enabled'   => true,
        'site_url'  => 'https://draftharbour.com',
        'site_name' => 'DraftHarbour Studio',
    ],
    'gemini' => [
        'api_key' => '',   // Get yours at https://aistudio.google.com/apikey
        'enabled' => true,
    ],

    // ── Safety controls ──────────────────────────────────────────────
    'max_input_chars'    => 12000,
    'max_output_tokens'  => 4096,
    'default_temperature' => 0.7,

    // ── Rate limiting (per IP) ───────────────────────────────────────
    'rate_limit'                => 20,   // max requests …
    'rate_limit_window_seconds' => 60,   // … per this many seconds

    // ── CORS ─────────────────────────────────────────────────────────
    // Set to your deployment domain, or '*' during development.
    'allowed_origin' => '*',

    // ── Bring-Your-Own-Key ───────────────────────────────────────────
    // When true, clients may pass "userApiKey" in the request body and
    // the server will use that key instead of the server-side key.
    'allow_byok' => true,
];
