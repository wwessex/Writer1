/**
 * OAuth2 PKCE connection management for Dropbox and Google Drive.
 * Handles the full authorization lifecycle: connect, refresh, disconnect.
 */

import type { IntegrationType } from '@/types';
import {
  exchangeCodeForTokens,
  generateCodeChallenge,
  generateCodeVerifier,
  getRedirectUri,
  openOAuthPopup,
  refreshAccessToken,
} from './oauth';

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

const OAUTH_CONFIG = {
  'google-drive': {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    userInfoUrl: 'https://www.googleapis.com/drive/v3/about?fields=user',
  },
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    revokeUrl: 'https://api.dropboxapi.com/2/auth/token/revoke',
    scopes: ['files.metadata.read', 'files.content.write', 'files.content.read'],
    userInfoUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
  },
} as const;

function ensureOAuthProvider(provider: IntegrationType): asserts provider is 'google-drive' | 'dropbox' {
  if (provider !== 'google-drive' && provider !== 'dropbox') {
    throw new IntegrationApiError(`Provider "${provider}" does not use OAuth. No connection needed.`, {
      code: 'CONFLICT',
      status: 409,
    });
  }
}

/**
 * Initiate the full OAuth2 PKCE flow for the given provider.
 * Opens a popup for user authorization and exchanges the code for tokens.
 */
export async function connectProvider(
  provider: IntegrationType,
  clientId?: string
): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  if (!clientId) {
    throw new IntegrationApiError(
      `A Client ID is required to connect to ${provider === 'google-drive' ? 'Google Drive' : 'Dropbox'}. Enter your OAuth Client ID in the integration settings.`,
      { code: 'UNAUTHORIZED', status: 401 }
    );
  }

  const config = OAUTH_CONFIG[provider];
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const redirectUri = getRedirectUri();

  // Build authorization URL
  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  if (provider === 'google-drive') {
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
  } else {
    // Dropbox uses token_access_type for refresh tokens
    authUrl.searchParams.set('token_access_type', 'offline');
  }

  // Open popup and wait for authorization code
  const code = await openOAuthPopup(authUrl.toString());

  // Exchange authorization code for tokens
  const tokens = await exchangeCodeForTokens(
    config.tokenUrl,
    code,
    verifier,
    clientId,
    redirectUri
  );

  // Fetch user info to get provider user ID
  const providerUserId = await fetchProviderUserId(provider, tokens.access_token);

  const connectionId = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    provider,
    connection: {
      connectionId,
      providerUserId,
      scopes: [...config.scopes],
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : Date.now() + 3600000,
      status: 'connected',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
    },
  };
}

/**
 * Disconnect from a provider by revoking the access token.
 */
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

  // Attempt to revoke the token (best-effort, don't fail if revocation fails)
  if (accessToken) {
    const config = OAUTH_CONFIG[provider];
    try {
      if (provider === 'google-drive') {
        await fetch(`${config.revokeUrl}?token=${accessToken}`, { method: 'POST' });
      } else {
        await fetch(config.revokeUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    } catch {
      // Token revocation is best-effort
    }
  }

  return { provider, disconnected: true };
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshProviderConnection(
  provider: IntegrationType,
  connectionId: string,
  refreshToken?: string,
  clientId?: string
): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  if (!connectionId) {
    throw new IntegrationApiError('Cannot refresh without an existing connection.', {
      code: 'NOT_FOUND',
      status: 404,
    });
  }

  if (!refreshToken || !clientId) {
    throw new IntegrationApiError(
      'Refresh token and Client ID are required to refresh the connection. Try disconnecting and reconnecting.',
      { code: 'UNAUTHORIZED', status: 401 }
    );
  }

  const config = OAUTH_CONFIG[provider];
  const tokens = await refreshAccessToken(config.tokenUrl, refreshToken, clientId);

  const providerUserId = await fetchProviderUserId(provider, tokens.access_token);

  return {
    provider,
    connection: {
      connectionId,
      providerUserId,
      scopes: [...OAUTH_CONFIG[provider].scopes],
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : Date.now() + 3600000,
      status: 'connected',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || refreshToken,
    },
  };
}

/**
 * Fetch the user ID from the provider API to identify the connected account.
 */
async function fetchProviderUserId(provider: 'google-drive' | 'dropbox', accessToken: string): Promise<string> {
  const config = OAUTH_CONFIG[provider];

  try {
    if (provider === 'google-drive') {
      const response = await fetch(config.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return 'unknown';
      const data = await response.json();
      return (data as { user?: { emailAddress?: string } }).user?.emailAddress || 'google-user';
    } else {
      const response = await fetch(config.userInfoUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: 'null',
      });
      if (!response.ok) return 'unknown';
      const data = await response.json();
      return (data as { email?: string }).email || (data as { account_id?: string }).account_id || 'dropbox-user';
    }
  } catch {
    return 'unknown';
  }
}
