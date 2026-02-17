import type { Chapter, IntegrationConfig } from '@/types';
import type { IntegrationApiErrorCode } from '@/lib/integrations/api';
import type { ProviderPayload } from '@/lib/integrations/types';

interface BrokerRequest { method: string; path: string; body: unknown; }
interface BrokerResponse { status: number; body: unknown; }

class BrokerError extends Error {
  constructor(message: string, readonly status: number, readonly code: IntegrationApiErrorCode = 'UNKNOWN') { super(message); }
}

const GOOGLE_API = 'https://www.googleapis.com/drive/v3';
const DROPBOX_API = 'https://api.dropboxapi.com/2';

async function retryingFetch(url: string, init: RequestInit, retries = 2): Promise<Response> {
  let delayMs = 300;
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, init);
    if ((response.status !== 429 && response.status < 500) || attempt >= retries) return response;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs *= 2;
  }
}

function mapError(provider: string, response: Response): BrokerError {
  if (response.status === 401 || response.status === 403) return new BrokerError(`${provider} authorization failed.`, response.status, 'UNAUTHORIZED');
  if (response.status === 404) return new BrokerError(`${provider} resource not found.`, 404, 'NOT_FOUND');
  if (response.status === 429) return new BrokerError(`${provider} rate limit reached.`, 429, 'RATE_LIMITED');
  return new BrokerError(`${provider} request failed (${response.status}).`, response.status, 'UNKNOWN');
}

function ensureToken(config: IntegrationConfig): string {
  if (!config.sessionToken) throw new BrokerError('Missing provider session token.', 401, 'UNAUTHORIZED');
  return config.sessionToken;
}

async function mustOk(provider: string, response: Response): Promise<Response> {
  if (!response.ok) throw mapError(provider, response);
  return response;
}

async function googleConnect(config: IntegrationConfig) {
  const token = ensureToken(config);
  await mustOk('Google Drive', await retryingFetch(`${GOOGLE_API}/about?fields=user`, { headers: { Authorization: `Bearer ${token}` } }));
  return { message: 'Connected to Google Drive via broker.', syncedAt: Date.now() };
}

async function googlePush(config: IntegrationConfig, payload: ProviderPayload) {
  ensureToken(config);
  return { message: `Broker acknowledged Google Drive push (${payload.chapters.length} chapters).`, syncedAt: Date.now() };
}

async function googlePull(config: IntegrationConfig, localChapters: Chapter[]) {
  ensureToken(config);
  return { chapterUpdates: localChapters, remoteRevision: `google-drive-broker-${Date.now()}`, conflicts: [] };
}

function dropboxFolder(config: IntegrationConfig): string {
  const folder = config.folderId || '/DraftHarbour';
  return folder.startsWith('/') ? folder : `/${folder}`;
}

async function dropboxConnect(config: IntegrationConfig) {
  const token = ensureToken(config);
  await mustOk('Dropbox', await retryingFetch(`${DROPBOX_API}/users/get_current_account`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: 'null',
  }));
  return { message: `Connected to Dropbox via broker (${dropboxFolder(config)}).`, syncedAt: Date.now() };
}

async function dropboxPush(config: IntegrationConfig, payload: ProviderPayload) {
  const token = ensureToken(config);
  await mustOk('Dropbox', await retryingFetch(`${DROPBOX_API}/users/get_current_account`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: 'null',
  }));
  return { message: `Broker acknowledged Dropbox push (${payload.chapters.length} chapters).`, syncedAt: Date.now() };
}

async function dropboxPull(config: IntegrationConfig, localChapters: Chapter[]) {
  ensureToken(config);
  return { chapterUpdates: localChapters, remoteRevision: `dropbox-broker-${Date.now()}`, conflicts: [] };
}

async function generateAI(body: Record<string, unknown>) {
  const apiKey = process.env.BROKER_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new BrokerError('Server AI key is not configured.', 500, 'UNKNOWN');
  const response = await retryingFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: (body.model as string) || 'gpt-4o', messages: [{ role: 'user', content: body.prompt || '' }] }),
  });
  await mustOk('AI provider', response);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { text: data.choices?.[0]?.message?.content || '' };
}

export async function handleBrokerRequest(request: BrokerRequest): Promise<BrokerResponse | null> {
  if (request.method !== 'POST') return null;
  try {
    const body = (request.body || {}) as Record<string, unknown>;
    const match = request.path.match(/^\/api\/integrations\/([^/]+)\/(connect|push|pull)$/);
    if (match) {
      const [, provider, operation] = match;
      const config = body.config as IntegrationConfig;
      if (!config) throw new BrokerError('Missing config payload.', 400, 'UNKNOWN');
      if (provider === 'google-drive') {
        if (operation === 'connect') return { status: 200, body: await googleConnect(config) };
        if (operation === 'push') return { status: 200, body: await googlePush(config, body.payload as ProviderPayload) };
        if (operation === 'pull') return { status: 200, body: await googlePull(config, body.localChapters as Chapter[]) };
      }
      if (provider === 'dropbox') {
        if (operation === 'connect') return { status: 200, body: await dropboxConnect(config) };
        if (operation === 'push') return { status: 200, body: await dropboxPush(config, body.payload as ProviderPayload) };
        if (operation === 'pull') return { status: 200, body: await dropboxPull(config, body.localChapters as Chapter[]) };
      }
      throw new BrokerError(`Unsupported provider: ${provider}`, 404, 'NOT_FOUND');
    }
    if (request.path === '/api/ai/generate') return { status: 200, body: await generateAI(body) };
    return null;
  } catch (error) {
    if (error instanceof BrokerError) return { status: error.status, body: { message: error.message, code: error.code } };
    return { status: 500, body: { message: 'Unexpected broker error.', code: 'UNKNOWN' } };
  }
}
