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
 * Response body (200):
 *   text           string   Generated text
 *   model          string   Model that was used
 *   provider       string   Provider that was used
 *   usage          object   { promptTokens?, completionTokens? }
 */

function handleChat(array $config): void
{
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw, true);

    if (!$body || empty($body['provider']) || empty($body['prompt']) || empty($body['model'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: provider, prompt, model.']);
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
        echo json_encode(['error' => "Input exceeds maximum length of {$maxInput} characters."]);
        return;
    }

    // ── Validate provider is enabled ─────────────────────────────────
    $validProviders = ['groq', 'openrouter', 'gemini'];
    if (!in_array($provider, $validProviders, true)) {
        http_response_code(400);
        echo json_encode(['error' => "Unknown provider: {$provider}."]);
        return;
    }

    if (empty($config[$provider]) || empty($config[$provider]['enabled'])) {
        http_response_code(400);
        echo json_encode(['error' => "Provider '{$provider}' is not enabled on this server."]);
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
        echo json_encode([
            'error' => "No API key available for provider '{$provider}'. "
                     . 'Contact the administrator or provide your own key.',
        ]);
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
        echo json_encode(['error' => $result['error']]);
        return;
    }

    echo json_encode($result);
}
