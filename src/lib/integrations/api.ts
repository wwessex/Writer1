/**
 * Provider connection management for Dropbox and Google Drive.
 * Browser only talks to backend endpoints for public metadata and OAuth orchestration.
 */

import type { IntegrationType } from '@/types';
import { openOAuthPopup } from './oauth';

export type ProviderConnectionStatus = 'disconnected' | 'pending' | 'connected' | 'error';

export interface ProviderConnectionMetadata {
  connectionId: string;
  providerUserId: string;
  scopes: string[];
  expiresAt: number;
  status: ProviderConnectionStatus;
  accessToken: string;
  refreshToken?: string;
}

export interface ProviderConnectionResponse {
  provider: IntegrationType;
  connection: ProviderConnectionMetadata;
}

export interface ProviderPublicMetadata {
  provider: IntegrationType;
  displayName: string;
  available: boolean;
  scopes: string[];
  authStartUrl?: string;
}

export interface ProvidersMetadataResponse {
  providers: Partial<Record<'google-drive' | 'dropbox', ProviderPublicMetadata>>;
}

export type IntegrationApiErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'POPUP_BLOCKED'
  | 'UNKNOWN';

export class IntegrationApiError extends Error {
  readonly code: IntegrationApiErrorCode;
  readonly status: number;

  constructor(message: string, options?: { code?: IntegrationApiErrorCode; status?: number }) {
    super(message);
    this.name = 'IntegrationApiError';
    this.code = options?.code ?? 'UNKNOWN';
    this.status = options?.status ?? 500;
  }
}

function ensureOAuthProvider(provider: IntegrationType): asserts provider is 'google-drive' | 'dropbox' {
  if (provider !== 'google-drive' && provider !== 'dropbox') {
    throw new IntegrationApiError(`Provider "${provider}" does not use OAuth. No connection needed.`, {
      code: 'CONFLICT',
      status: 409,
    });
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorCode(status: number): IntegrationApiErrorCode {
  if (status === 401 || status === 403) return 'UNAUTHORIZED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  return 'UNKNOWN';
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const message =
      (payload as { message?: string; error?: string } | null)?.message ||
      (payload as { message?: string; error?: string } | null)?.error ||
      `Request failed (${response.status}).`;
    throw new IntegrationApiError(message, {
      code: extractErrorCode(response.status),
      status: response.status,
    });
  }

  return payload as T;
}

export async function fetchProviderMetadata(): Promise<ProvidersMetadataResponse> {
  return fetchJson<ProvidersMetadataResponse>('/api/integrations/providers', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
}

/**
 * Initiate OAuth through a backend-provided authorize URL and complete with an opaque token.
 */
export async function connectProvider(provider: IntegrationType): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  const start = await fetchJson<{ authorizeUrl: string }>(`/api/integrations/providers/${provider}/connect/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  if (!start.authorizeUrl) {
    throw new IntegrationApiError('Server did not provide an authorization URL.', {
      code: 'UNKNOWN',
      status: 500,
    });
  }

  const callbackUrl = await openOAuthPopup(start.authorizeUrl);
  const params = new URL(callbackUrl).searchParams;
  const connectToken = params.get('connect_token');

  if (!connectToken) {
    throw new IntegrationApiError('Authentication callback was missing connect token.', {
      code: 'UNAUTHORIZED',
      status: 401,
    });
  }

  return fetchJson<ProviderConnectionResponse>(`/api/integrations/providers/${provider}/connect/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ connectToken }),
  });
}

export async function disconnectProvider(
  provider: IntegrationType,
  connectionId: string,
  accessToken?: string
): Promise<{ provider: IntegrationType; disconnected: true }> {
  ensureOAuthProvider(provider);

  if (!connectionId) {
    throw new IntegrationApiError('Connection identifier is required.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return fetchJson<{ provider: IntegrationType; disconnected: true }>(
    `/api/integrations/providers/${provider}/disconnect`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ connectionId, accessToken }),
    }
  );
}

/**
 * Refresh an expired access token using server-managed provider credentials.
 */
export async function refreshProviderConnection(
  provider: IntegrationType,
  connectionId: string,
  refreshToken?: string
): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  if (!connectionId) {
    throw new IntegrationApiError('Cannot refresh without an existing connection.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  if (!refreshToken) {
    throw new IntegrationApiError(
      'Refresh token is required to refresh the connection. Try disconnecting and reconnecting.',
      { code: 'UNAUTHORIZED', status: 401 }
    );
  }

  return fetchJson<ProviderConnectionResponse>(`/api/integrations/providers/${provider}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ connectionId, refreshToken }),
  });
}
