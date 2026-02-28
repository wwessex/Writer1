/**
 * Provider connection management for Dropbox and Google Drive.
 * Fully client-side OAuth2 PKCE — no backend server required.
 */

import type { IntegrationConfig, IntegrationType } from '@/types';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getRedirectUri,
  openOAuthPopup,
  exchangeCodeForTokens,
  refreshAccessToken,
  type OAuthTokenResponse,
} from './oauth';

export type ProviderConnectionStatus = 'disconnected' | 'pending' | 'connected' | 'error';

export interface ProviderConnectionMetadata {
  connectionId: string;
  providerUserId: string;
  scopes: string[];
  expiresAt: number;
  status: ProviderConnectionStatus;
  sessionToken: string;
  refreshToken?: string;
  sessionExpiresAt?: number;
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
  accountEmail?: string;
  accountDisplayName?: string;
  healthStatus?: 'healthy' | 'degraded' | 'error' | 'unknown';
  healthMessage?: string;
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
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
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

// ── OAuth provider configuration ──

const DROPBOX_AUTH_URL = 'https://www.dropbox.com/oauth2/authorize';
const DROPBOX_TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * Default OAuth client IDs shipped with the app.
 * These are public identifiers (not secrets) used with the PKCE flow,
 * so it's safe and standard to bundle them in client-side code.
 */
export const DEFAULT_GOOGLE_CLIENT_ID = '847291436274-draftharbour.apps.googleusercontent.com';
export const DEFAULT_DROPBOX_APP_KEY = 'draftharbour2024appkey';

function buildDropboxAuthUrl(appKey: string, redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
  });
  return `${DROPBOX_AUTH_URL}?${params.toString()}`;
}

function buildGoogleAuthUrl(clientId: string, redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: GOOGLE_DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function tokenResponseToMetadata(
  _provider: IntegrationType,
  tokens: OAuthTokenResponse,
): ProviderConnectionMetadata {
  const now = Date.now();
  const expiresIn = tokens.expires_in ?? 3600;

  return {
    connectionId: tokens.account_id || tokens.uid || crypto.randomUUID(),
    providerUserId: tokens.account_id || tokens.uid || '',
    scopes: tokens.scope ? tokens.scope.split(/[\s,]+/) : [],
    expiresAt: now + expiresIn * 1000,
    status: 'connected',
    sessionToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

// ── Public API — all client-side ──

export interface ProviderSessionIntrospectionResponse {
  provider: IntegrationType;
  active: boolean;
  connectionId?: string;
  expiresAt?: number;
  status?: ProviderConnectionStatus;
}

/**
 * Create a new provider session from a stored connection.
 * Client-side: refresh the access token using the stored refresh token.
 */
export async function createProviderSession(
  provider: IntegrationType,
  _connectionId: string,
  config?: IntegrationConfig,
): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  if (!config?.refreshToken || !config?.clientId) {
    throw new IntegrationApiError('Missing refresh token or client ID. Reconnect your account.', {
      code: 'UNAUTHORIZED',
      status: 401,
    });
  }

  const tokenUrl = provider === 'dropbox' ? DROPBOX_TOKEN_URL : GOOGLE_TOKEN_URL;
  const tokens = await refreshAccessToken(tokenUrl, config.refreshToken, config.clientId);

  return {
    provider,
    connection: tokenResponseToMetadata(provider, {
      ...tokens,
      refresh_token: tokens.refresh_token || config.refreshToken,
      account_id: config.providerUserId,
    }),
  };
}

/**
 * Check whether the current session token is still valid.
 * Client-side: just check expiry time — no server call needed.
 */
export async function introspectProviderSession(
  provider: IntegrationType,
  _sessionToken: string,
  config?: IntegrationConfig,
): Promise<ProviderSessionIntrospectionResponse> {
  ensureOAuthProvider(provider);

  const expiresAt = config?.expiresAt;
  const active = expiresAt ? expiresAt > Date.now() : false;

  return {
    provider,
    active,
    connectionId: config?.connectionId,
    expiresAt,
    status: active ? 'connected' : 'error',
  };
}

/**
 * Revoke the provider session token.
 * Client-side: revoke directly at the provider's revoke endpoint.
 */
export async function revokeProviderSession(
  provider: IntegrationType,
  _connectionId: string,
  sessionToken?: string,
): Promise<{ provider: IntegrationType; revoked: true }> {
  ensureOAuthProvider(provider);

  if (sessionToken) {
    try {
      if (provider === 'dropbox') {
        await fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } else {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(sessionToken)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      }
    } catch {
      // Best-effort revocation — token may already be invalid
    }
  }

  return { provider, revoked: true };
}

/**
 * Return locally-known provider metadata. No server call needed.
 */
export async function fetchProviderMetadata(): Promise<ProvidersMetadataResponse> {
  return {
    providers: {
      'google-drive': {
        provider: 'google-drive',
        displayName: 'Google Drive',
        available: true,
        scopes: [GOOGLE_DRIVE_SCOPE],
        healthStatus: 'healthy',
      },
      dropbox: {
        provider: 'dropbox',
        displayName: 'Dropbox',
        available: true,
        scopes: ['files.content.write', 'files.content.read', 'account_info.read'],
        healthStatus: 'healthy',
      },
    },
  };
}

/**
 * Initiate OAuth PKCE flow entirely in the browser.
 * Opens a popup for the provider's authorization page, exchanges the code for tokens,
 * and returns connection metadata with the access token.
 */
export async function connectProvider(
  provider: IntegrationType,
  clientId?: string,
): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  if (!clientId) {
    throw new IntegrationApiError(
      provider === 'dropbox'
        ? 'Dropbox App Key is required. Enter it in the integration settings.'
        : 'Google OAuth Client ID is required. Enter it in the integration settings.',
      { code: 'UNAUTHORIZED', status: 401 },
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const redirectUri = getRedirectUri();

  const authUrl = provider === 'dropbox'
    ? buildDropboxAuthUrl(clientId, redirectUri, codeChallenge)
    : buildGoogleAuthUrl(clientId, redirectUri, codeChallenge);

  const callbackUrl = await openOAuthPopup(authUrl);
  const params = new URL(callbackUrl).searchParams;

  const error = params.get('error');
  if (error) {
    throw new IntegrationApiError(
      params.get('error_description') || error || 'Authorization was denied.',
      { code: 'UNAUTHORIZED', status: 401 },
    );
  }

  const code = params.get('code');
  if (!code) {
    throw new IntegrationApiError('No authorization code received from provider.', {
      code: 'UNAUTHORIZED',
      status: 401,
    });
  }

  const tokenUrl = provider === 'dropbox' ? DROPBOX_TOKEN_URL : GOOGLE_TOKEN_URL;
  const tokens = await exchangeCodeForTokens(tokenUrl, code, codeVerifier, clientId, redirectUri);

  return {
    provider,
    connection: tokenResponseToMetadata(provider, tokens),
  };
}

/**
 * Disconnect a provider. Client-side: revoke token and clear state.
 */
export async function disconnectProvider(
  provider: IntegrationType,
  connectionId: string,
  sessionToken?: string,
): Promise<{ provider: IntegrationType; disconnected: true }> {
  ensureOAuthProvider(provider);

  if (sessionToken) {
    await revokeProviderSession(provider, connectionId, sessionToken);
  }

  return { provider, disconnected: true };
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshProviderConnection(
  provider: IntegrationType,
  _connectionId: string,
  config?: IntegrationConfig,
): Promise<ProviderConnectionResponse> {
  ensureOAuthProvider(provider);

  if (!config?.refreshToken || !config?.clientId) {
    throw new IntegrationApiError('Cannot refresh without refresh token and client ID. Reconnect your account.', {
      code: 'UNAUTHORIZED',
      status: 401,
    });
  }

  const tokenUrl = provider === 'dropbox' ? DROPBOX_TOKEN_URL : GOOGLE_TOKEN_URL;
  const tokens = await refreshAccessToken(tokenUrl, config.refreshToken, config.clientId);

  return {
    provider,
    connection: tokenResponseToMetadata(provider, {
      ...tokens,
      refresh_token: tokens.refresh_token || config.refreshToken,
      account_id: config.providerUserId,
    }),
  };
}
