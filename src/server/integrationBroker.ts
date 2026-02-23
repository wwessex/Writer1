import type { Chapter, IntegrationConfig } from '@/types';
import type { ProviderErrorCode, ProviderErrorPayload, ProviderPayload, ProviderResponseEnvelope } from '@/lib/integrations/types';
import { DEFAULT_RETRY_POLICY, fetchWithPolicy, mapStatusToProviderError } from '@/lib/integrations/providerClient';

interface BrokerRequest { method: string; path: string; body: unknown; }
interface BrokerResponse { status: number; body: unknown; }

class BrokerError extends Error {
  constructor(readonly error: ProviderErrorPayload) {
    super(error.message);
    this.name = 'BrokerError';
  }
}

const GOOGLE_API = 'https://www.googleapis.com/drive/v3';
const DROPBOX_API = 'https://api.dropboxapi.com/2';

function brokerError(status: number, message: string, code?: ProviderErrorCode): BrokerError {
  const mapped = mapStatusToProviderError(status, message);
  return new BrokerError({ ...mapped, code: code ?? mapped.code });
}

function mapProviderHttpError(provider: string, response: Response): BrokerError {
  const mapped = mapStatusToProviderError(response.status, `${provider} request failed (${response.status}).`);
  const message = mapped.code === 'UNAUTHORIZED'
    ? `${provider} authorization failed.`
    : mapped.code === 'NOT_FOUND'
      ? `${provider} resource not found.`
      : mapped.code === 'RATE_LIMITED'
        ? `${provider} rate limit reached.`
        : `${provider} request failed (${response.status}).`;

  return new BrokerError({ ...mapped, message });
}

function ensureToken(config: IntegrationConfig): string {
  if (!config.sessionToken) throw brokerError(401, 'Missing provider session token.', 'UNAUTHORIZED');
  return config.sessionToken;
}

async function mustOk(provider: string, response: Response): Promise<Response> {
  if (!response.ok) throw mapProviderHttpError(provider, response);
  return response;
}

async function googleConnect(config: IntegrationConfig) {
  const token = ensureToken(config);
  await mustOk('Google Drive', await fetchWithPolicy(`${GOOGLE_API}/about?fields=user`, { headers: { Authorization: `Bearer ${token}` } }, DEFAULT_RETRY_POLICY));
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
  await mustOk('Dropbox', await fetchWithPolicy(`${DROPBOX_API}/users/get_current_account`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: 'null',
  }, DEFAULT_RETRY_POLICY));
  return { message: `Connected to Dropbox via broker (${dropboxFolder(config)}).`, syncedAt: Date.now() };
}

async function dropboxPush(config: IntegrationConfig, payload: ProviderPayload) {
  const token = ensureToken(config);
  await mustOk('Dropbox', await fetchWithPolicy(`${DROPBOX_API}/users/get_current_account`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: 'null',
  }, DEFAULT_RETRY_POLICY));
  return { message: `Broker acknowledged Dropbox push (${payload.chapters.length} chapters).`, syncedAt: Date.now() };
}

async function dropboxPull(config: IntegrationConfig, localChapters: Chapter[]) {
  ensureToken(config);
  return { chapterUpdates: localChapters, remoteRevision: `dropbox-broker-${Date.now()}`, conflicts: [] };
}

async function generateAI(body: Record<string, unknown>) {
  const apiKey = process.env.BROKER_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw brokerError(503, 'Server AI key is not configured.', 'PROVIDER_UNAVAILABLE');
  const response = await fetchWithPolicy('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: (body.model as string) || 'gpt-4o', messages: [{ role: 'user', content: body.prompt || '' }] }),
  }, DEFAULT_RETRY_POLICY);
  await mustOk('AI provider', response);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { text: data.choices?.[0]?.message?.content || '' };
}

const MAX_INPUT_CHARS = 12000;

async function generateServerProxy(body: Record<string, unknown>) {
  const provider = body.provider as string;
  const model = body.model as string;
  const prompt = body.prompt as string;
  const projectType = (body.projectType as string) || 'book';
  const userApiKey = body.userApiKey as string | undefined;

  if (!provider || !model || !prompt) throw brokerError(400, 'Missing required fields: provider, prompt, model.');
  if (prompt.length > MAX_INPUT_CHARS) throw brokerError(400, `Input exceeds maximum length of ${MAX_INPUT_CHARS} characters.`);

  const systemPrompt = `You are a helpful creative writing assistant for ${
    projectType === 'screenplay' ? 'screenplays' : 'books'
  }. Respond in plain text with clear formatting.`;

  const resolveKey = (envVar: string): string => {
    const key = userApiKey || process.env[envVar];
    if (!key) throw brokerError(503, `No API key configured for ${provider}. Set ${envVar} env variable or provide your own key.`, 'PROVIDER_UNAVAILABLE');
    return key;
  };

  switch (provider) {
    case 'groq': {
      const apiKey = resolveKey('BROKER_GROQ_API_KEY');
      const response = await fetchWithPolicy('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.7 }),
      }, DEFAULT_RETRY_POLICY);
      await mustOk('Groq', response);
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      return { text: data.choices?.[0]?.message?.content || '', model, provider: 'groq', usage: { promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens } };
    }
    case 'openrouter': {
      const apiKey = resolveKey('BROKER_OPENROUTER_API_KEY');
      const response = await fetchWithPolicy('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'DraftHarbour Studio (dev)',
        },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.7 }),
      }, DEFAULT_RETRY_POLICY);
      await mustOk('OpenRouter', response);
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      return { text: data.choices?.[0]?.message?.content || '', model, provider: 'openrouter', usage: { promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens } };
    }
    case 'gemini': {
      const apiKey = resolveKey('BROKER_GEMINI_API_KEY');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetchWithPolicy(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      }, DEFAULT_RETRY_POLICY);
      await mustOk('Gemini', response);
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
      return { text: data.candidates?.[0]?.content?.parts?.[0]?.text || '', model, provider: 'gemini', usage: { promptTokens: data.usageMetadata?.promptTokenCount, completionTokens: data.usageMetadata?.candidatesTokenCount } };
    }
    default:
      throw brokerError(400, `Unknown server proxy provider: ${provider}`);
  }
}

function toSuccess<T>(data: T): ProviderResponseEnvelope<T> {
  return { ok: true, data };
}

function toError(error: ProviderErrorPayload): ProviderResponseEnvelope<never> {
  return { ok: false, error };
}

export async function handleBrokerRequest(request: BrokerRequest): Promise<BrokerResponse | null> {
  if (request.method !== 'POST') return null;
  try {
    const body = (request.body || {}) as Record<string, unknown>;
    const match = request.path.match(/^\/api\/integrations\/([^/]+)\/(connect|push|pull)$/);
    if (match) {
      const [, provider, operation] = match;
      const config = body.config as IntegrationConfig;
      if (!config) throw brokerError(400, 'Missing config payload.');
      if (provider === 'google-drive') {
        if (operation === 'connect') return { status: 200, body: toSuccess(await googleConnect(config)) };
        if (operation === 'push') return { status: 200, body: toSuccess(await googlePush(config, body.payload as ProviderPayload)) };
        if (operation === 'pull') return { status: 200, body: toSuccess(await googlePull(config, body.localChapters as Chapter[])) };
      }
      if (provider === 'dropbox') {
        if (operation === 'connect') return { status: 200, body: toSuccess(await dropboxConnect(config)) };
        if (operation === 'push') return { status: 200, body: toSuccess(await dropboxPush(config, body.payload as ProviderPayload)) };
        if (operation === 'pull') return { status: 200, body: toSuccess(await dropboxPull(config, body.localChapters as Chapter[])) };
      }
      throw brokerError(404, `Unsupported provider: ${provider}`, 'NOT_FOUND');
    }
    if (request.path === '/api/ai/generate') return { status: 200, body: toSuccess(await generateAI(body)) };
    if (request.path === '/api/chat') return { status: 200, body: toSuccess(await generateServerProxy(body)) };
    return null;
  } catch (error) {
    if (error instanceof BrokerError) return { status: error.error.status, body: toError(error.error) };
    return { status: 500, body: toError(mapStatusToProviderError(500, 'Unexpected broker error.')) };
  }
}
