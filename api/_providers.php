<?php
/**
 * Provider-specific HTTP call implementations.
 *
 * Each function builds the correct request format for its provider,
 * calls the upstream API via cURL, and returns a normalised response.
 */

/* ================================================================== */
/*  Shared cURL helper                                                 */
/* ================================================================== */

function curlPost(string $url, array $payload, array $headers): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);

    $raw      = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error    = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return [
            'httpCode' => 0,
            'body'     => ['error' => ['message' => "cURL error: {$error}"]],
        ];
    }

    return [
        'httpCode' => $httpCode,
        'body'     => json_decode($raw, true) ?: [],
    ];
}

/* ================================================================== */
/*  Groq  (OpenAI-compatible)                                          */
/* ================================================================== */

function callGroq(
    string $apiKey,
    string $model,
    string $systemPrompt,
    string $prompt,
    float $temperature,
    int $maxTokens
): array {
    $payload = [
        'model'       => $model,
        'messages'    => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user',   'content' => $prompt],
        ],
        'max_tokens'  => $maxTokens,
        'temperature' => $temperature,
    ];

    $response = curlPost(
        'https://api.groq.com/openai/v1/chat/completions',
        $payload,
        [
            "Authorization: Bearer {$apiKey}",
            'Content-Type: application/json',
        ]
    );

    if ($response['httpCode'] !== 200) {
        $msg = $response['body']['error']['message'] ?? 'Unknown error';
        return ['error' => "Groq API error ({$response['httpCode']}): {$msg}", 'status' => $response['httpCode']];
    }

    return [
        'text'     => $response['body']['choices'][0]['message']['content'] ?? '',
        'model'    => $model,
        'provider' => 'groq',
        'usage'    => [
            'promptTokens'     => $response['body']['usage']['prompt_tokens'] ?? null,
            'completionTokens' => $response['body']['usage']['completion_tokens'] ?? null,
        ],
    ];
}

/* ================================================================== */
/*  OpenRouter  (OpenAI-compatible + extra headers)                    */
/* ================================================================== */

function callOpenRouter(
    string $apiKey,
    string $model,
    string $systemPrompt,
    string $prompt,
    float $temperature,
    int $maxTokens,
    array $providerConfig
): array {
    $payload = [
        'model'       => $model,
        'messages'    => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user',   'content' => $prompt],
        ],
        'max_tokens'  => $maxTokens,
        'temperature' => $temperature,
    ];

    $siteUrl  = $providerConfig['site_url']  ?? 'https://draftharbour.com';
    $siteName = $providerConfig['site_name'] ?? 'DraftHarbour Studio';

    $response = curlPost(
        'https://openrouter.ai/api/v1/chat/completions',
        $payload,
        [
            "Authorization: Bearer {$apiKey}",
            'Content-Type: application/json',
            "HTTP-Referer: {$siteUrl}",
            "X-Title: {$siteName}",
        ]
    );

    if ($response['httpCode'] !== 200) {
        $msg = $response['body']['error']['message'] ?? 'Unknown error';
        return ['error' => "OpenRouter API error ({$response['httpCode']}): {$msg}", 'status' => $response['httpCode']];
    }

    return [
        'text'     => $response['body']['choices'][0]['message']['content'] ?? '',
        'model'    => $model,
        'provider' => 'openrouter',
        'usage'    => [
            'promptTokens'     => $response['body']['usage']['prompt_tokens'] ?? null,
            'completionTokens' => $response['body']['usage']['completion_tokens'] ?? null,
        ],
    ];
}

/* ================================================================== */
/*  Google Gemini  (native format, NOT OpenAI-compatible)              */
/* ================================================================== */

function callGemini(
    string $apiKey,
    string $model,
    string $systemPrompt,
    string $prompt,
    float $temperature,
    int $maxTokens
): array {
    $encodedModel = rawurlencode($model);
    $encodedKey   = rawurlencode($apiKey);
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$encodedModel}:generateContent?key={$encodedKey}";

    $payload = [
        'system_instruction' => [
            'parts' => [['text' => $systemPrompt]],
        ],
        'contents' => [
            ['parts' => [['text' => $prompt]]],
        ],
        'generationConfig' => [
            'temperature'    => $temperature,
            'maxOutputTokens' => $maxTokens,
        ],
    ];

    $response = curlPost($url, $payload, ['Content-Type: application/json']);

    if ($response['httpCode'] !== 200) {
        $msg = $response['body']['error']['message'] ?? 'Unknown error';
        return ['error' => "Gemini API error ({$response['httpCode']}): {$msg}", 'status' => $response['httpCode']];
    }

    $text = $response['body']['candidates'][0]['content']['parts'][0]['text'] ?? '';

    return [
        'text'     => $text,
        'model'    => $model,
        'provider' => 'gemini',
        'usage'    => [
            'promptTokens'     => $response['body']['usageMetadata']['promptTokenCount'] ?? null,
            'completionTokens' => $response['body']['usageMetadata']['candidatesTokenCount'] ?? null,
        ],
    ];
}
