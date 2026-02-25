<?php
/**
 * DraftHarbour Studio — API proxy entry point.
 *
 * Routes incoming requests to the appropriate handler.
 * Handles CORS, rate limiting, and dispatches POST /api/chat.
 */

header('Content-Type: application/json; charset=utf-8');

// ── Load configuration ───────────────────────────────────────────────
$config = require __DIR__ . '/_config.php';

$appEnv = strtolower((string) ($config['app_env'] ?? 'production'));
$isNonDev = !in_array($appEnv, ['dev', 'development', 'local'], true);

// ── Startup security validation ─────────────────────────────────────
$warnings = [];
$configuredOrigins = $config['allowed_origins'] ?? ($config['allowed_origin'] ?? []);
if (!is_array($configuredOrigins)) {
    $configuredOrigins = [$configuredOrigins];
}
$configuredOrigins = array_values(array_filter(array_map('trim', $configuredOrigins), static fn ($origin) => $origin !== ''));

if ($isNonDev) {
    if (empty($configuredOrigins) || in_array('*', $configuredOrigins, true)) {
        $warnings[] = 'CORS configuration is insecure for non-dev environments. Set allowed_origins to explicit trusted origin(s).';
    }

    if (!empty($config['allow_byok'])) {
        $warnings[] = 'allow_byok is enabled in a non-dev environment. Disable unless explicitly required.';
    }
}

foreach ($warnings as $warning) {
    error_log("[api-security][$appEnv] $warning");
}

// ── CORS ─────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$corsOrigin = null;

if (in_array('*', $configuredOrigins, true)) {
    $corsOrigin = '*';
} elseif ($origin !== '' && in_array($origin, $configuredOrigins, true)) {
    $corsOrigin = $origin;
}

if ($corsOrigin !== null) {
    header("Access-Control-Allow-Origin: $corsOrigin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Rate limiting ────────────────────────────────────────────────────
require_once __DIR__ . '/_rateLimit.php';

if (!checkRateLimit($config)) {
    http_response_code(429);
    echo json_encode(['error' => 'Rate limit exceeded. Try again later.']);
    exit;
}

// ── Routing ──────────────────────────────────────────────────────────
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
// Normalise: strip /api prefix when served from a subdirectory
$path = preg_replace('#^.*/api#', '/api', $path);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($path === '/chat' || $path === '/api/chat')) {
    require_once __DIR__ . '/_chatHandler.php';
    handleChat($config);
    exit;
}

// Fallback
http_response_code(404);
echo json_encode(['error' => 'Not found.']);
