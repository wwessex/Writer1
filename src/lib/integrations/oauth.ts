/**
 * OAuth2 PKCE helpers for browser-based authorization flows.
 * Used by Dropbox and Google Drive integrations.
 */

/** Generate a cryptographically random code verifier (43-128 chars, unreserved URI chars). */
export function generateCodeVerifier(length = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64UrlEncode(array).slice(0, length);
}

/** Derive the S256 code challenge from a code verifier. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** Base64-URL encode a byte array (no padding). */
function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Get the redirect URI for OAuth callbacks (current page origin + path). */
export function getRedirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  uid?: string;
  account_id?: string;
}

/**
 * Open a popup window for OAuth authorization and wait for the redirect with auth code.
 * Returns the callback URL for server-side completion (e.g., opaque connect token).
 */
export function openOAuthPopup(authUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'draftharbour_oauth',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      reject(new Error('Failed to open OAuth popup. Check your popup blocker settings.'));
      return;
    }

    const redirectUri = getRedirectUri();
    let resolved = false;

    // Timeout after 2 minutes to prevent indefinite polling
    const POPUP_TIMEOUT_MS = 120_000;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(interval);
        try { popup.close(); } catch { /* ignore */ }
        reject(new Error('OAuth authorization timed out. Please try again.'));
      }
    }, POPUP_TIMEOUT_MS);

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          clearTimeout(timeout);
          if (!resolved) {
            reject(new Error('OAuth popup was closed before authorization completed.'));
          }
          return;
        }

        // Try to read the popup location - will throw cross-origin error while on provider domain
        const currentUrl = popup.location.href;
        if (currentUrl && currentUrl.startsWith(redirectUri)) {
          resolved = true;
          clearInterval(interval);
          clearTimeout(timeout);

          const params = new URL(currentUrl).searchParams;
          const error = params.get('error');
          const errorDescription = params.get('error_description');

          popup.close();

          if (!error) {
            resolve(currentUrl);
          } else {
            reject(new Error(errorDescription || error || 'Authorization was denied.'));
          }
        }
      } catch {
        // Cross-origin error while popup is on provider's domain - expected, keep polling
      }
    }, 300);
  });
}

/**
 * Exchange an authorization code for tokens using the PKCE flow.
 */
export async function exchangeCodeForTokens(
  tokenUrl: string,
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error_description?: string }).error_description ||
      (errorData as { error?: string }).error ||
      `Token exchange failed (${response.status})`
    );
  }

  return response.json();
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  tokenUrl: string,
  refreshToken: string,
  clientId: string
): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error_description?: string }).error_description ||
      (errorData as { error?: string }).error ||
      `Token refresh failed (${response.status})`
    );
  }

  return response.json();
}
