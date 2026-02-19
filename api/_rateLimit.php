<?php
/**
 * Simple file-based IP rate limiter.
 *
 * Tracks request timestamps per IP in temp directory files.
 * No Redis or database dependency — works on any cPanel host.
 */

function checkRateLimit(array $config): bool
{
    $ip    = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $limit  = $config['rate_limit'] ?? 20;
    $window = $config['rate_limit_window_seconds'] ?? 60;

    $dir = sys_get_temp_dir() . '/dh_ratelimit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }

    $file = $dir . '/' . md5($ip) . '.json';
    $now  = time();

    // Read existing timestamps
    $data = [];
    if (file_exists($file)) {
        $raw = @file_get_contents($file);
        if ($raw !== false) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }
    }

    // Prune entries outside the current window
    $cutoff = $now - $window;
    $data = array_values(array_filter($data, function ($ts) use ($cutoff) {
        return $ts > $cutoff;
    }));

    // Check limit
    if (count($data) >= $limit) {
        return false;
    }

    // Record this request
    $data[] = $now;
    @file_put_contents($file, json_encode($data), LOCK_EX);

    return true;
}
