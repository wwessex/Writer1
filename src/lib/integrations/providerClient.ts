import type { ProviderErrorCode, ProviderErrorEnvelope, ProviderErrorPayload, ProviderResponseEnvelope, ProviderSuccessEnvelope } from './types';

export interface RetryPolicy {
  retries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  retries: 2,
  initialDelayMs: 300,
  backoffMultiplier: 2,
  timeoutMs: 20_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mapStatusToProviderError(status: number, fallbackMessage: string): ProviderErrorPayload {
  const mapping: Record<number, { code: ProviderErrorCode; retryable: boolean; userMessage: string }> = {
    401: { code: 'UNAUTHORIZED', retryable: false, userMessage: 'Reconnect your account and try again.' },
    403: { code: 'UNAUTHORIZED', retryable: false, userMessage: 'Reconnect your account and try again.' },
    404: { code: 'NOT_FOUND', retryable: false, userMessage: 'The requested resource was not found. Verify configuration and try again.' },
    409: { code: 'CONFLICT', retryable: false, userMessage: 'Resolve the sync conflict and retry.' },
    429: { code: 'RATE_LIMITED', retryable: true, userMessage: 'Rate limit reached. Wait a moment and retry.' },
    503: { code: 'PROVIDER_UNAVAILABLE', retryable: true, userMessage: 'Provider is temporarily unavailable. Please retry shortly.' },
    504: { code: 'TIMEOUT', retryable: true, userMessage: 'The request timed out. Retry in a moment.' },
  };

  const mapped = mapping[status] ?? {
    code: status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'UNKNOWN',
    retryable: status >= 500,
    userMessage: status >= 500
      ? 'The provider is unavailable right now. Please retry.'
      : 'Request failed. Please check settings and try again.',
  };

  return {
    code: mapped.code,
    status,
    message: fallbackMessage,
    retryable: mapped.retryable,
    userMessage: mapped.userMessage,
  };
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchWithPolicy(url: string, init: RequestInit = {}, policy: RetryPolicy = DEFAULT_RETRY_POLICY): Promise<Response> {
  let attempt = 0;
  let delayMs = policy.initialDelayMs;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), policy.timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal ?? controller.signal,
      });
      if (!shouldRetryStatus(response.status) || attempt >= policy.retries) {
        return response;
      }
    } catch (error) {
      if (attempt >= policy.retries) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    attempt += 1;
    await sleep(delayMs);
    delayMs *= policy.backoffMultiplier;
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchEnvelope<TData>(
  url: string,
  init: RequestInit = {},
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<ProviderResponseEnvelope<TData>> {
  try {
    const response = await fetchWithPolicy(url, init, policy);
    const payload = await parseJsonSafe(response);

    if (response.ok) {
      const envPayload = payload as ProviderResponseEnvelope<TData> | null;
      if (envPayload && typeof envPayload === 'object' && 'ok' in envPayload) {
        return envPayload;
      }
      return { ok: true, data: payload as TData } satisfies ProviderSuccessEnvelope<TData>;
    }

    const details = payload as { message?: string; error?: string; code?: ProviderErrorCode; userMessage?: string; retryable?: boolean } | null;
    return {
      ok: false,
      error: {
        ...mapStatusToProviderError(response.status, details?.message || details?.error || `Request failed (${response.status}).`),
        code: details?.code || mapStatusToProviderError(response.status, '').code,
        retryable: details?.retryable ?? mapStatusToProviderError(response.status, '').retryable,
        userMessage: details?.userMessage || mapStatusToProviderError(response.status, '').userMessage,
      },
    } satisfies ProviderErrorEnvelope;
  } catch {
    return {
      ok: false,
      error: {
        code: 'TIMEOUT',
        status: 504,
        message: 'Request timed out.',
        retryable: true,
        userMessage: 'The request timed out. Retry in a moment.',
      },
    };
  }
}
