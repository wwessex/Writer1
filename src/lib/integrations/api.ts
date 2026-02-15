import type { IntegrationType } from '@/types';

export type ProviderConnectionStatus = 'disconnected' | 'pending' | 'connected' | 'error';

export interface ProviderConnectionMetadata {
  connectionId: string;
  providerUserId: string;
  scopes: string[];
  expiresAt: number;
  status: ProviderConnectionStatus;
}

export interface ProviderConnectionResponse {
  provider: IntegrationType;
  connection: ProviderConnectionMetadata;
}

export type IntegrationApiErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
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

const PROVIDER_SCOPES: Record<'google-drive' | 'dropbox', string[]> = {
  'google-drive': ['drive.file', 'drive.metadata.readonly'],
  dropbox: ['files.metadata.read', 'files.content.write'],
};

function ensureOAuthProvider(provider: IntegrationType): asserts provider is 'google-drive' | 'dropbox' {
  if (provider !== 'google-drive' && provider !== 'dropbox') {
    throw new IntegrationApiError(`Provider ${provider} does not use OAuth token broker.`, {
      code: 'CONFLICT',
      status: 409,
    });
  }
}

function createMockConnection(provider: 'google-drive' | 'dropbox', status: ProviderConnectionStatus): ProviderConnectionMetadata {
  const nonce = Math.random().toString(36).slice(2, 10);
  return {
    connectionId: `${provider}-conn-${nonce}`,
    providerUserId: `${provider}-user-${nonce}`,
    scopes: PROVIDER_SCOPES[provider],
    expiresAt: Date.now() + 1000 * 60 * 60,
    status,
  };
}

export async function connectProvider(provider: IntegrationType): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  return {
    provider,
    connection: createMockConnection(provider, 'connected'),
  };
}

export async function disconnectProvider(
  provider: IntegrationType,
  connectionId: string
): Promise<{ provider: IntegrationType; disconnected: true }> {
  ensureOAuthProvider(provider);
  if (!connectionId) {
    throw new IntegrationApiError('Connection identifier is required.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return {
    provider,
    disconnected: true,
  };
}

export async function refreshProviderConnection(
  provider: IntegrationType,
  connectionId: string
): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  if (!connectionId) {
    throw new IntegrationApiError('Cannot refresh without an existing connection.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  return {
    provider,
    connection: {
      ...createMockConnection(provider, 'connected'),
      connectionId,
    },
  };
}
