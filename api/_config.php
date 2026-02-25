<?php
/**
 * DraftHarbour Studio — Server proxy configuration.
 *
 * Fill in the API keys for each provider you want to enable.
 * This file is protected by .htaccess and never served to browsers.
 */

$appEnv = getenv('APP_ENV') ?: 'production';
$isDev = in_array(strtolower($appEnv), ['dev', 'development', 'local'], true);

$rawAllowedOrigins = getenv('APP_ALLOWED_ORIGINS') ?: '';
$allowedOriginsFromEnv = array_values(array_filter(array_map('trim', explode(',', $rawAllowedOrigins)), static fn ($origin) => $origin !== ''));

return [
    // ── Runtime environment ───────────────────────────────────────────
    // APP_ENV examples: production, staging, development
    'app_env' => $appEnv,

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
    // In production/staging, default to explicit trusted origin(s) only.
    // Override with APP_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com".
    // Development defaults to wildcard for local iteration convenience.
    'allowed_origins' => !empty($allowedOriginsFromEnv)
        ? $allowedOriginsFromEnv
        : ($isDev ? ['*'] : ['https://draftharbour.com']),

    // ── Bring-Your-Own-Key ───────────────────────────────────────────
    // When true, clients may pass "userApiKey" in the request body and
    // the server will use that key instead of the server-side key.
    'allow_byok' => $isDev,
];
