<?php
/**
 * Simple file-based IP rate limiter.
 *
 * Tracks request timestamps per IP in temp directory files.
 * No Redis or database dependency — works on any cPanel host.
 */

/**
 * Resolve the best-effort request IP.
 *
 * Uses proxy headers only when trusted proxies are configured.
 */
function resolveRateLimitIp(array $config): string
{
    $remoteAddr = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    if ($remoteAddr === '' || filter_var($remoteAddr, FILTER_VALIDATE_IP) === false) {
        $remoteAddr = 'unknown';
    }

    $trustedProxies = $config['trusted_proxies'] ?? [];
    if (!is_array($trustedProxies) || $trustedProxies === []) {
        return $remoteAddr;
    }

    if (!in_array($remoteAddr, $trustedProxies, true)) {
        return $remoteAddr;
    }

    $forwardedFor = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
    if ($forwardedFor === '') {
        return $remoteAddr;
    }

    foreach (explode(',', $forwardedFor) as $candidate) {
        $candidate = trim($candidate);
        if ($candidate === '') {
            continue;
        }

        if (filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
            return $candidate;
        }
    }

    return $remoteAddr;
}

/**
 * Opportunistically removes stale rate-limit files.
 */
function garbageCollectRateLimitFiles(string $dir, int $windowSeconds, int $now, array $config = []): void
{
    $configuredDivisor = (int) ($config['rate_limit_gc_divisor'] ?? 0);
    $gcInterval = $configuredDivisor > 0
        ? $configuredDivisor
        : max(10, min(1000, (int) ($windowSeconds / 2)));
    if (random_int(1, $gcInterval) !== 1) {
        return;
    }

    $lockHandle = @fopen($dir . '/.gc.lock', 'c+');
    if ($lockHandle === false) {
        return;
    }

    if (!@flock($lockHandle, LOCK_EX | LOCK_NB)) {
        fclose($lockHandle);
        return;
    }

    $bufferSeconds = max(30, $windowSeconds);
    $staleBefore = $now - $windowSeconds - $bufferSeconds;

    foreach (glob($dir . '/*.json') ?: [] as $path) {
        $mtime = @filemtime($path);
        if ($mtime !== false && $mtime < $staleBefore) {
            @unlink($path);
        }
    }

    @flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
}

function checkRateLimit(array $config): bool
{
    $ip    = resolveRateLimitIp($config);
    $limit  = $config['rate_limit'] ?? 20;
    $window = $config['rate_limit_window_seconds'] ?? 60;

    $limit = max(1, (int) $limit);
    $window = max(1, (int) $window);

    $dir = sys_get_temp_dir() . '/dh_ratelimit';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }

    $file = $dir . '/' . md5($ip) . '.json';
    $now  = time();
    garbageCollectRateLimitFiles($dir, $window, $now, $config);

    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        return true;
    }

    if (!@flock($handle, LOCK_EX)) {
        fclose($handle);
        return true;
    }

    $raw = stream_get_contents($handle);
    $data = [];

    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            foreach ($decoded as $ts) {
                if (is_int($ts) || (is_numeric($ts) && (int) $ts > 0)) {
                    $data[] = (int) $ts;
                }
            }
        }
    }

    $cutoff = $now - $window;
    $data = array_values(array_filter($data, function ($ts) use ($cutoff) {
        return $ts > $cutoff;
    }));

    if (count($data) >= $limit) {
        @flock($handle, LOCK_UN);
        fclose($handle);
        return false;
    }

    $data[] = $now;

    $encoded = json_encode($data);
    if ($encoded === false) {
        @flock($handle, LOCK_UN);
        fclose($handle);
        return true;
    }

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, $encoded);
    fflush($handle);

    @flock($handle, LOCK_UN);
    fclose($handle);

    return true;
}
