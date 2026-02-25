#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../api/_rateLimit.php';

function fail(string $message): void
{
    fwrite(STDERR, "[FAIL] {$message}\n");
    exit(1);
}

function assertTrue(bool $condition, string $message): void
{
    if (!$condition) {
        fail($message);
    }
}

function rlDir(): string
{
    return sys_get_temp_dir() . '/dh_ratelimit';
}

function rlFileForIp(string $ip): string
{
    return rlDir() . '/' . md5($ip) . '.json';
}

function cleanupRateLimitState(array $ips = []): void
{
    $dir = rlDir();
    if (!is_dir($dir)) {
        return;
    }

    if ($ips === []) {
        foreach (glob($dir . '/*.json') ?: [] as $path) {
            @unlink($path);
        }
        @unlink($dir . '/.gc.lock');
        return;
    }

    foreach ($ips as $ip) {
        @unlink(rlFileForIp($ip));
    }
}

function runWorker(int $limit, int $window, string $ip): bool
{
    $_SERVER['REMOTE_ADDR'] = $ip;
    return checkRateLimit([
        'rate_limit' => $limit,
        'rate_limit_window_seconds' => $window,
        'rate_limit_gc_divisor' => 1000000,
    ]);
}

if (($argv[1] ?? '') === '--worker') {
    $limit = (int) ($argv[2] ?? 5);
    $window = (int) ($argv[3] ?? 60);
    $ip = (string) ($argv[4] ?? '127.0.0.1');
    exit(runWorker($limit, $window, $ip) ? 0 : 2);
}

cleanupRateLimitState();

$workerScript = __FILE__;

// 1) Concurrency: with locking, successes should not exceed limit.
$testIp = '198.51.100.44';
cleanupRateLimitState([$testIp]);
$limit = 7;
$window = 30;
$attempts = 40;
$procs = [];
for ($i = 0; $i < $attempts; $i++) {
    $cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($workerScript)
        . ' --worker ' . $limit . ' ' . $window . ' ' . escapeshellarg($testIp);
    $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
    $proc = proc_open($cmd, $descriptors, $pipes);
    if (!is_resource($proc)) {
        fail('Unable to start worker process');
    }
    $procs[] = ['proc' => $proc, 'pipes' => $pipes];
}

$successCount = 0;
foreach ($procs as $entry) {
    fclose($entry['pipes'][0]);
    stream_get_contents($entry['pipes'][1]);
    stream_get_contents($entry['pipes'][2]);
    fclose($entry['pipes'][1]);
    fclose($entry['pipes'][2]);

    $code = proc_close($entry['proc']);
    if ($code === 0) {
        $successCount++;
    }
}
assertTrue($successCount === $limit, "Concurrency check expected {$limit} accepted requests, got {$successCount}");

// 2) Corruption recovery.
$corruptIp = '198.51.100.55';
cleanupRateLimitState([$corruptIp]);
@mkdir(rlDir(), 0700, true);
file_put_contents(rlFileForIp($corruptIp), '{"oops":"bad"');
$_SERVER['REMOTE_ADDR'] = $corruptIp;
$allowed = checkRateLimit([
    'rate_limit' => 2,
    'rate_limit_window_seconds' => 10,
    'rate_limit_gc_divisor' => 1000000,
]);
assertTrue($allowed, 'Corrupt payload should be handled gracefully and allow request');
$stored = json_decode((string) file_get_contents(rlFileForIp($corruptIp)), true);
assertTrue(is_array($stored) && count($stored) === 1, 'Corrupt payload should be replaced with valid timestamp array');

// 3) Window expiry behavior.
$expiryIp = '198.51.100.56';
cleanupRateLimitState([$expiryIp]);
$_SERVER['REMOTE_ADDR'] = $expiryIp;
$configExpiry = [
    'rate_limit' => 2,
    'rate_limit_window_seconds' => 1,
    'rate_limit_gc_divisor' => 1000000,
];
assertTrue(checkRateLimit($configExpiry) === true, 'First request should pass');
assertTrue(checkRateLimit($configExpiry) === true, 'Second request should pass');
assertTrue(checkRateLimit($configExpiry) === false, 'Third request in same window should be denied');
sleep(2);
assertTrue(checkRateLimit($configExpiry) === true, 'Request after window expiry should pass');

// 4) Trusted proxy extraction.
$_SERVER['REMOTE_ADDR'] = '203.0.113.10';
$_SERVER['HTTP_X_FORWARDED_FOR'] = ' 198.51.100.200, 203.0.113.10';
$resolved = resolveRateLimitIp([
    'trusted_proxies' => ['203.0.113.10'],
]);
assertTrue($resolved === '198.51.100.200', 'Trusted proxy should use first valid forwarded IP');
$_SERVER['REMOTE_ADDR'] = '203.0.113.11';
$resolved = resolveRateLimitIp([
    'trusted_proxies' => ['203.0.113.10'],
]);
assertTrue($resolved === '203.0.113.11', 'Untrusted proxy should ignore X-Forwarded-For');
unset($_SERVER['HTTP_X_FORWARDED_FOR']);

// 5) GC for stale files.
$staleIp = '198.51.100.57';
cleanupRateLimitState([$staleIp]);
$stalePath = rlFileForIp($staleIp);
file_put_contents($stalePath, json_encode([time() - 9999]));
@touch($stalePath, time() - 9999);
$_SERVER['REMOTE_ADDR'] = '198.51.100.58';
checkRateLimit([
    'rate_limit' => 10,
    'rate_limit_window_seconds' => 2,
    'rate_limit_gc_divisor' => 1,
]);
assertTrue(!file_exists($stalePath), 'Stale rate-limit file should be removed by GC');

echo "[PASS] rate limit checks passed\n";
