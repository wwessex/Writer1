import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationConfig } from '@/types';

const {
  generateCodeVerifierMock,
  generateCodeChallengeMock,
  getRedirectUriMock,
  openOAuthPopupMock,
  exchangeCodeForTokensMock,
  refreshAccessTokenMock,
  fetchMock,
} = vi.hoisted(() => ({
  generateCodeVerifierMock: vi.fn(),
  generateCodeChallengeMock: vi.fn(),
  getRedirectUriMock: vi.fn(),
  openOAuthPopupMock: vi.fn(),
  exchangeCodeForTokensMock: vi.fn(),
  refreshAccessTokenMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('./oauth', () => ({
  generateCodeVerifier: generateCodeVerifierMock,
  generateCodeChallenge: generateCodeChallengeMock,
  getRedirectUri: getRedirectUriMock,
  openOAuthPopup: openOAuthPopupMock,
  exchangeCodeForTokens: exchangeCodeForTokensMock,
  refreshAccessToken: refreshAccessTokenMock,
}));

import {
  IntegrationApiError,
  connectProvider,
  createProviderSession,
  disconnectProvider,
  fetchProviderMetadata,
  introspectProviderSession,
  refreshProviderConnection,
  revokeProviderSession,
} from './api';

describe('IntegrationApiError', () => {
  it('sets default code and status', () => {
    const err = new IntegrationApiError('test error');
    expect(err.message).toBe('test error');
    expect(err.code).toBe('UNKNOWN');
    expect(err.status).toBe(500);
    expect(err.name).toBe('IntegrationApiError');
  });

  it('uses provided code and status', () => {
    const err = new IntegrationApiError('unauthorized', { code: 'UNAUTHORIZED', status: 401 });
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.status).toBe(401);
  });
});

describe('fetchProviderMetadata', () => {
  it('returns static metadata for both providers', async () => {
    const result = await fetchProviderMetadata();
    expect(result.providers['google-drive']?.available).toBe(true);
    expect(result.providers['google-drive']?.displayName).toBe('Google Drive');
    expect(result.providers.dropbox?.available).toBe(true);
    expect(result.providers.dropbox?.displayName).toBe('Dropbox');
    expect(result.providers.dropbox?.healthStatus).toBe('healthy');
  });
});

describe('introspectProviderSession', () => {
  it('returns active when token is not expired', async () => {
    const config: IntegrationConfig = {
      type: 'dropbox',
      enabled: true,
      expiresAt: Date.now() + 60_000,
      connectionId: 'conn-1',
    };
    const result = await introspectProviderSession('dropbox', 'token', config);
    expect(result.active).toBe(true);
    expect(result.status).toBe('connected');
    expect(result.connectionId).toBe('conn-1');
    expect(result.provider).toBe('dropbox');
  });

  it('returns inactive when token is expired', async () => {
    const config: IntegrationConfig = {
      type: 'google-drive',
      enabled: true,
      expiresAt: Date.now() - 1000,
    };
    const result = await introspectProviderSession('google-drive', 'token', config);
    expect(result.active).toBe(false);
    expect(result.status).toBe('error');
  });

  it('returns inactive when no expiresAt is provided', async () => {
    const result = await introspectProviderSession('dropbox', 'token');
    expect(result.active).toBe(false);
  });

  it('throws for non-OAuth provider', async () => {
    await expect(introspectProviderSession('scrivener', 'token')).rejects.toThrow('does not use OAuth');
  });
});

describe('revokeProviderSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
  });

  it('revokes Dropbox token by calling the revoke endpoint', async () => {
    const result = await revokeProviderSession('dropbox', 'conn-1', 'my-token');
    expect(result).toEqual({ provider: 'dropbox', revoked: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/2/auth/token/revoke',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('revokes Google token by calling the Google revoke endpoint', async () => {
    const result = await revokeProviderSession('google-drive', 'conn-1', 'gtoken');
    expect(result).toEqual({ provider: 'google-drive', revoked: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('oauth2.googleapis.com/revoke'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('succeeds even without session token', async () => {
    const result = await revokeProviderSession('dropbox', 'conn-1');
    expect(result.revoked).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('succeeds even if fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network error'));
    const result = await revokeProviderSession('dropbox', 'conn-1', 'token');
    expect(result.revoked).toBe(true);
  });
});

describe('disconnectProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));
  });

  it('revokes token and returns disconnected', async () => {
    const result = await disconnectProvider('dropbox', 'conn-1', 'token');
    expect(result).toEqual({ provider: 'dropbox', disconnected: true });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('works without session token', async () => {
    const result = await disconnectProvider('google-drive', 'conn-1');
    expect(result.disconnected).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws for scrivener', async () => {
    await expect(disconnectProvider('scrivener', 'conn-1')).rejects.toThrow('does not use OAuth');
  });
});

describe('connectProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateCodeVerifierMock.mockReturnValue('test-verifier');
    generateCodeChallengeMock.mockResolvedValue('test-challenge');
    getRedirectUriMock.mockReturnValue('http://localhost:5173/');
  });

  it('throws when clientId is missing for dropbox', async () => {
    await expect(connectProvider('dropbox')).rejects.toThrow('Dropbox App Key is required');
  });

  it('throws when clientId is missing for google-drive', async () => {
    await expect(connectProvider('google-drive')).rejects.toThrow('Google OAuth Client ID is required');
  });

  it('throws for non-OAuth provider', async () => {
    await expect(connectProvider('scrivener', 'key')).rejects.toThrow('does not use OAuth');
  });

  it('throws when popup returns an error', async () => {
    openOAuthPopupMock.mockResolvedValue('http://localhost:5173/?error=access_denied&error_description=User%20denied');
    await expect(connectProvider('dropbox', 'my-app-key')).rejects.toThrow('User denied');
  });

  it('throws when no code in callback URL', async () => {
    openOAuthPopupMock.mockResolvedValue('http://localhost:5173/?state=abc');
    await expect(connectProvider('dropbox', 'my-app-key')).rejects.toThrow('No authorization code');
  });

  it('connects Dropbox successfully with PKCE', async () => {
    openOAuthPopupMock.mockResolvedValue('http://localhost:5173/?code=auth-code-123');
    exchangeCodeForTokensMock.mockResolvedValue({
      access_token: 'dbx-access-token',
      token_type: 'bearer',
      expires_in: 14400,
      refresh_token: 'dbx-refresh-token',
      account_id: 'dbid:account123',
      scope: 'files.content.write files.content.read',
    });

    const result = await connectProvider('dropbox', 'my-app-key');

    expect(result.provider).toBe('dropbox');
    expect(result.connection.sessionToken).toBe('dbx-access-token');
    expect(result.connection.refreshToken).toBe('dbx-refresh-token');
    expect(result.connection.providerUserId).toBe('dbid:account123');
    expect(result.connection.connectionId).toBe('dbid:account123');
    expect(result.connection.status).toBe('connected');
    expect(result.connection.scopes).toEqual(['files.content.write', 'files.content.read']);

    // Verify PKCE flow was used
    expect(generateCodeVerifierMock).toHaveBeenCalled();
    expect(generateCodeChallengeMock).toHaveBeenCalledWith('test-verifier');

    // Verify token exchange was called with Dropbox token URL
    expect(exchangeCodeForTokensMock).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/oauth2/token',
      'auth-code-123',
      'test-verifier',
      'my-app-key',
      'http://localhost:5173/',
    );

    // Verify auth URL had Dropbox domain
    expect(openOAuthPopupMock).toHaveBeenCalledWith(
      expect.stringContaining('dropbox.com/oauth2/authorize'),
    );
  });

  it('connects Google Drive successfully with PKCE', async () => {
    openOAuthPopupMock.mockResolvedValue('http://localhost:5173/?code=google-code-456');
    exchangeCodeForTokensMock.mockResolvedValue({
      access_token: 'gd-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'gd-refresh-token',
      scope: 'https://www.googleapis.com/auth/drive.file',
    });

    const result = await connectProvider('google-drive', 'google-client-id');

    expect(result.provider).toBe('google-drive');
    expect(result.connection.sessionToken).toBe('gd-access-token');
    expect(result.connection.refreshToken).toBe('gd-refresh-token');
    expect(result.connection.status).toBe('connected');

    expect(exchangeCodeForTokensMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      'google-code-456',
      'test-verifier',
      'google-client-id',
      'http://localhost:5173/',
    );

    expect(openOAuthPopupMock).toHaveBeenCalledWith(
      expect.stringContaining('accounts.google.com/o/oauth2/v2/auth'),
    );
  });
});

describe('refreshProviderConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when refresh token is missing', async () => {
    const config: IntegrationConfig = { type: 'dropbox', enabled: true, clientId: 'key' };
    await expect(refreshProviderConnection('dropbox', 'conn-1', config)).rejects.toThrow('Cannot refresh');
  });

  it('throws when client ID is missing', async () => {
    const config: IntegrationConfig = { type: 'dropbox', enabled: true, refreshToken: 'rt' };
    await expect(refreshProviderConnection('dropbox', 'conn-1', config)).rejects.toThrow('Cannot refresh');
  });

  it('refreshes Dropbox token successfully', async () => {
    refreshAccessTokenMock.mockResolvedValue({
      access_token: 'new-token',
      token_type: 'bearer',
      expires_in: 14400,
    });

    const config: IntegrationConfig = {
      type: 'dropbox',
      enabled: true,
      clientId: 'my-key',
      refreshToken: 'my-refresh',
      providerUserId: 'dbid:user1',
    };
    const result = await refreshProviderConnection('dropbox', 'conn-1', config);

    expect(result.provider).toBe('dropbox');
    expect(result.connection.sessionToken).toBe('new-token');
    expect(result.connection.refreshToken).toBe('my-refresh');
    expect(refreshAccessTokenMock).toHaveBeenCalledWith(
      'https://api.dropboxapi.com/oauth2/token',
      'my-refresh',
      'my-key',
    );
  });

  it('refreshes Google Drive token successfully', async () => {
    refreshAccessTokenMock.mockResolvedValue({
      access_token: 'new-gd-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'new-gd-refresh',
    });

    const config: IntegrationConfig = {
      type: 'google-drive',
      enabled: true,
      clientId: 'gd-client',
      refreshToken: 'old-refresh',
    };
    const result = await refreshProviderConnection('google-drive', 'conn-1', config);

    expect(result.connection.sessionToken).toBe('new-gd-token');
    expect(result.connection.refreshToken).toBe('new-gd-refresh');
    expect(refreshAccessTokenMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      'old-refresh',
      'gd-client',
    );
  });
});

describe('createProviderSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when config is missing', async () => {
    await expect(createProviderSession('dropbox', 'conn-1')).rejects.toThrow('Missing refresh token');
  });

  it('throws for scrivener', async () => {
    await expect(createProviderSession('scrivener', 'conn-1')).rejects.toThrow('does not use OAuth');
  });

  it('refreshes token to create new session', async () => {
    refreshAccessTokenMock.mockResolvedValue({
      access_token: 'session-token',
      token_type: 'bearer',
      expires_in: 3600,
    });

    const config: IntegrationConfig = {
      type: 'dropbox',
      enabled: true,
      clientId: 'key',
      refreshToken: 'rt',
      providerUserId: 'user1',
    };
    const result = await createProviderSession('dropbox', 'conn-1', config);

    expect(result.provider).toBe('dropbox');
    expect(result.connection.sessionToken).toBe('session-token');
    expect(result.connection.refreshToken).toBe('rt');
  });
});
