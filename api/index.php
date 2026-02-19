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

// ── CORS ─────────────────────────────────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigin = $config['allowed_origin'] ?? '';

if ($allowedOrigin === '*' || $origin === $allowedOrigin) {
    $corsOrigin = $allowedOrigin === '*' ? '*' : $origin;
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
