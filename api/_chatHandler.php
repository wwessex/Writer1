<?php
/**
 * POST /api/chat handler.
 *
 * Validates the request, resolves the API key (server key or BYOK),
 * builds a system prompt, and dispatches to the appropriate provider.
 *
 * Request body:
 *   provider       string   "groq" | "openrouter" | "gemini"
 *   model          string   Model identifier (e.g. "llama-3.3-70b-versatile")
 *   prompt         string   The full prompt text (context already baked in)
 *   projectType    string   "book" | "screenplay" (optional, defaults to "book")
 *   temperature    float    0.0–1.0 (optional, defaults to server config)
 *   maxOutputTokens int     Capped by server config (optional)
 *   userApiKey     string   BYOK key (optional, only used when allow_byok is true)
 *
 * Success envelope (200):
 *   { ok: true, data: { text, model, provider, usage? } }
 *
 * Error envelope (!200):
 *   { ok: false, error: { code, message, status, retryable, userMessage } }
 */


function chatErrorEnvelope(int $status, string $message, string $code = 'UNKNOWN', bool $retryable = false, ?string $userMessage = null): array
{
    return [
        'ok' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
            'status' => $status,
            'retryable' => $retryable,
            'userMessage' => $userMessage ?? $message,
        ],
    ];
}

function chatSuccessEnvelope(array $data): array
{
    return ['ok' => true, 'data' => $data];
}

function handleChat(array $config): void
{
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);

    if (!$body || empty($body['provider']) || empty($body['prompt']) || empty($body['model'])) {
        http_response_code(400);
        echo json_encode(chatErrorEnvelope(400, 'Missing required fields: provider, prompt, model.', 'UNKNOWN', false, 'Review request input and try again.'));
        return;
    }

    $provider    = $body['provider'];
    $prompt      = $body['prompt'];
    $model       = $body['model'];
    $projectType = $body['projectType'] ?? 'book';
    $temperature = min(max((float) ($body['temperature'] ?? $config['default_temperature']), 0.0), 1.0);
    $maxTokens   = min(
        (int) ($body['maxOutputTokens'] ?? $config['max_output_tokens']),
        (int) $config['max_output_tokens']
    );

    // ── Input length safety check ────────────────────────────────────
    $maxInput = (int) $config['max_input_chars'];
    if (mb_strlen($prompt) > $maxInput) {
        http_response_code(400);
        echo json_encode(chatErrorEnvelope(400, "Input exceeds maximum length of {$maxInput} characters.", 'UNKNOWN', false, 'Shorten the input and retry.'));
        return;
    }

    // ── Validate provider is enabled ─────────────────────────────────
    $validProviders = ['groq', 'openrouter', 'gemini'];
    if (!in_array($provider, $validProviders, true)) {
        http_response_code(400);
        echo json_encode(chatErrorEnvelope(400, "Unknown provider: {$provider}.", 'NOT_FOUND', false, 'Choose a supported provider and retry.'));
        return;
    }

    if (empty($config[$provider]) || empty($config[$provider]['enabled'])) {
        http_response_code(400);
        echo json_encode(chatErrorEnvelope(503, "Provider '{$provider}' is not enabled on this server.", 'PROVIDER_UNAVAILABLE', true, 'Enable the provider or choose another one.'));
        return;
    }

    // ── Resolve API key (BYOK or server key) ─────────────────────────
    $apiKey = null;
    if (!empty($body['userApiKey']) && !empty($config['allow_byok'])) {
        $apiKey = $body['userApiKey'];
    } else {
        $apiKey = $config[$provider]['api_key'] ?? null;
    }

    if (!$apiKey) {
        http_response_code(500);
        echo json_encode(chatErrorEnvelope(503, "No API key available for provider '{$provider}'. Contact the administrator or provide your own key.", 'PROVIDER_UNAVAILABLE', true, 'Configure an API key and retry.'));
        return;
    }

    // ── Build system prompt ──────────────────────────────────────────
    $typeLabel    = $projectType === 'screenplay' ? 'screenplays' : 'books';
    $systemPrompt = "You are a helpful creative writing assistant for {$typeLabel}. "
                  . 'Respond in plain text with clear formatting.';

    // ── Dispatch to provider ─────────────────────────────────────────
    require_once __DIR__ . '/_providers.php';

    $result = null;
    switch ($provider) {
        case 'groq':
            $result = callGroq($apiKey, $model, $systemPrompt, $prompt, $temperature, $maxTokens);
            break;
        case 'openrouter':
            $result = callOpenRouter($apiKey, $model, $systemPrompt, $prompt, $temperature, $maxTokens, $config['openrouter'] ?? []);
            break;
        case 'gemini':
            $result = callGemini($apiKey, $model, $systemPrompt, $prompt, $temperature, $maxTokens);
            break;
    }

    if (isset($result['error'])) {
        http_response_code($result['status'] ?? 502);
        echo json_encode(chatErrorEnvelope((int) ($result['status'] ?? 502), (string) $result['error'], ((int) ($result['status'] ?? 502)) === 429 ? 'RATE_LIMITED' : (((int) ($result['status'] ?? 502)) >= 500 ? 'PROVIDER_UNAVAILABLE' : 'UNKNOWN'), ((int) ($result['status'] ?? 502)) === 429 || ((int) ($result['status'] ?? 502)) >= 500, ((int) ($result['status'] ?? 502)) === 429 ? 'Rate limit reached. Wait and retry.' : 'Provider is temporarily unavailable. Retry shortly.'));
        return;
    }

    echo json_encode(chatSuccessEnvelope($result));
}
