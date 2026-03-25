import type { Chapter, IntegrationConfig } from '../types';
import type { ProviderErrorCode, ProviderErrorPayload, ProviderPayload, ProviderResponseEnvelope } from '../lib/integrations/types';
import { DEFAULT_RETRY_POLICY, fetchWithPolicy, mapStatusToProviderError } from '../lib/integrations/providerClient';

interface BrokerRequest { method: string; path: string; body: unknown; }
interface BrokerResponse { status: number; body: unknown; }

class BrokerError extends Error {
  constructor(readonly error: ProviderErrorPayload) {
    super(error.message);
    this.name = 'BrokerError';
  }
}

const GOOGLE_API = 'https://www.googleapis.com/drive/v3';
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const DROPBOX_API = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT = 'https://content.dropboxapi.com/2';
const APP_FOLDER_NAME = 'DraftHarbour';
const MANIFEST_NAME = '_manifest.json';

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

// ── Google Drive helpers ──

interface DriveFile { id: string; name: string; mimeType: string; modifiedTime?: string; }
interface DriveFileList { files: DriveFile[]; nextPageToken?: string; }

async function googleFindOrCreateFolder(token: string): Promise<string> {
  const query = `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchUrl = `${GOOGLE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`;
  const searchResp = await mustOk('Google Drive', await fetchWithPolicy(searchUrl, { headers: { Authorization: `Bearer ${token}` } }, DEFAULT_RETRY_POLICY));
  const searchData = await searchResp.json() as DriveFileList;
  if (searchData.files.length > 0) return searchData.files[0].id;

  const createResp = await mustOk('Google Drive', await fetchWithPolicy(`${GOOGLE_API}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: APP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  }, DEFAULT_RETRY_POLICY));
  const created = await createResp.json() as DriveFile;
  return created.id;
}

async function googleFindFile(token: string, folderId: string, fileName: string): Promise<DriveFile | null> {
  const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
  const url = `${GOOGLE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)`;
  const resp = await mustOk('Google Drive', await fetchWithPolicy(url, { headers: { Authorization: `Bearer ${token}` } }, DEFAULT_RETRY_POLICY));
  const data = await resp.json() as DriveFileList;
  return data.files[0] || null;
}

async function googleUpsertFile(token: string, folderId: string, name: string, content: string): Promise<void> {
  const existing = await googleFindFile(token, folderId, name);
  if (existing) {
    await mustOk('Google Drive', await fetchWithPolicy(`${GOOGLE_UPLOAD_API}/files/${existing.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: content,
    }, DEFAULT_RETRY_POLICY));
  } else {
    const boundary = `broker_${Date.now()}`;
    const body = [
      `--${boundary}`, 'Content-Type: application/json; charset=UTF-8', '',
      JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' }),
      `--${boundary}`, 'Content-Type: application/json', '',
      content, `--${boundary}--`,
    ].join('\r\n');
    await mustOk('Google Drive', await fetchWithPolicy(`${GOOGLE_UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }, DEFAULT_RETRY_POLICY));
  }
}

async function googleListFiles(token: string, folderId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const query = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
    let url = `${GOOGLE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,mimeType)&spaces=drive&pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const resp = await mustOk('Google Drive', await fetchWithPolicy(url, { headers: { Authorization: `Bearer ${token}` } }, DEFAULT_RETRY_POLICY));
    const data = await resp.json() as DriveFileList;
    allFiles.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return allFiles;
}

async function googleDownloadFile(token: string, fileId: string): Promise<string | null> {
  try {
    const resp = await mustOk('Google Drive', await fetchWithPolicy(`${GOOGLE_API}/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${token}` } }, DEFAULT_RETRY_POLICY));
    return resp.text();
  } catch { return null; }
}

// ── Simplified merge for broker pull ──

function simpleMergePull(
  localChapters: Chapter[],
  remoteDocs: Array<{ id: string; title: string; body: string; order: number; updatedAt: number }>,
  revisionPrefix: string,
): { chapterUpdates: Chapter[]; remoteRevision: string; conflicts: never[] } {
  const localMap = new Map(localChapters.map(c => [c.id, c]));
  const merged: Chapter[] = [...localChapters];

  for (const doc of remoteDocs) {
    const local = localMap.get(doc.id);
    if (local) {
      if (doc.updatedAt > local.updatedAt) {
        const idx = merged.findIndex(c => c.id === doc.id);
        if (idx >= 0) {
          merged[idx] = { ...local, content: doc.body, title: doc.title, order: doc.order, updatedAt: doc.updatedAt };
        }
      }
    } else {
      merged.push({
        id: doc.id,
        novelId: '',
        title: doc.title,
        content: doc.body,
        order: doc.order,
        updatedAt: doc.updatedAt,
        summary: '',
        pov: '',
        status: 'draft',
        tags: [],
        wordGoal: 0,
        scenes: [],
      });
    }
  }

  const latestRemote = remoteDocs.reduce((max, d) => d.updatedAt > max ? d.updatedAt : max, 0);
  return {
    chapterUpdates: merged,
    remoteRevision: `${revisionPrefix}-${latestRemote || Date.now()}`,
    conflicts: [],
  };
}

// ── Google Drive operations ──

async function googleConnect(config: IntegrationConfig) {
  const token = ensureToken(config);
  await mustOk('Google Drive', await fetchWithPolicy(`${GOOGLE_API}/about?fields=user`, { headers: { Authorization: `Bearer ${token}` } }, DEFAULT_RETRY_POLICY));
  return { message: 'Connected to Google Drive via broker.', syncedAt: Date.now() };
}

async function googlePush(config: IntegrationConfig, payload: ProviderPayload) {
  const token = ensureToken(config);
  const folderId = await googleFindOrCreateFolder(token);

  for (const chapter of payload.chapters) {
    await googleUpsertFile(token, folderId, `${chapter.id}.json`, JSON.stringify(chapter, null, 2));
  }

  const manifest = {
    novelId: payload.novelId,
    projectType: payload.projectType,
    chapterIds: payload.chapters.map(c => c.id),
    syncedAt: Date.now(),
  };
  await googleUpsertFile(token, folderId, MANIFEST_NAME, JSON.stringify(manifest, null, 2));

  return { message: `Pushed ${payload.chapters.length} chapter(s) to Google Drive via broker.`, syncedAt: Date.now() };
}

async function googlePull(config: IntegrationConfig, localChapters: Chapter[]) {
  const token = ensureToken(config);
  const folderId = await googleFindOrCreateFolder(token);
  const files = await googleListFiles(token, folderId);

  const remoteDocs: Array<{ id: string; title: string; body: string; order: number; updatedAt: number }> = [];
  for (const file of files) {
    if (file.name === MANIFEST_NAME) continue;
    const content = await googleDownloadFile(token, file.id);
    if (!content) continue;
    try {
      const doc = JSON.parse(content) as { id: string; title: string; body: string; order: number; updatedAt: number };
      remoteDocs.push(doc);
    } catch { /* skip malformed */ }
  }

  if (remoteDocs.length === 0) {
    return { chapterUpdates: localChapters, remoteRevision: `gdrive-broker-empty-${Date.now()}`, conflicts: [] as never[] };
  }

  return simpleMergePull(localChapters, remoteDocs, 'gdrive-broker');
}

// ── Dropbox helpers ──

function dropboxFolder(config: IntegrationConfig): string {
  const folder = config.folderId || '/DraftHarbour';
  return folder.startsWith('/') ? folder : `/${folder}`;
}

async function dropboxEnsureFolder(token: string, folderPath: string): Promise<void> {
  try {
    await fetchWithPolicy(`${DROPBOX_API}/files/create_folder_v2`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath, autorename: false }),
    }, DEFAULT_RETRY_POLICY);
  } catch {
    // Folder may already exist — verify it
    try {
      await mustOk('Dropbox', await fetchWithPolicy(`${DROPBOX_API}/files/get_metadata`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      }, DEFAULT_RETRY_POLICY));
    } catch {
      throw brokerError(404, `Could not access or create folder: ${folderPath}`, 'NOT_FOUND');
    }
  }
}

async function dropboxUploadFile(token: string, path: string, content: string): Promise<void> {
  await fetchWithPolicy(`${DROPBOX_CONTENT}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true }),
    },
    body: content,
  }, DEFAULT_RETRY_POLICY);
}

interface DropboxEntry { '.tag': string; name: string; path_display: string; path_lower: string; server_modified?: string; rev?: string; }
interface DropboxListResponse { entries: DropboxEntry[]; cursor: string; has_more: boolean; }

async function dropboxListFiles(token: string, folderPath: string): Promise<DropboxEntry[]> {
  const allEntries: DropboxEntry[] = [];
  const resp = await mustOk('Dropbox', await fetchWithPolicy(`${DROPBOX_API}/files/list_folder`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath, recursive: false }),
  }, DEFAULT_RETRY_POLICY));
  const data = await resp.json() as DropboxListResponse;
  allEntries.push(...data.entries);

  let cursor = data.cursor;
  let hasMore = data.has_more;
  while (hasMore) {
    const contResp = await mustOk('Dropbox', await fetchWithPolicy(`${DROPBOX_API}/files/list_folder/continue`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor }),
    }, DEFAULT_RETRY_POLICY));
    const contData = await contResp.json() as DropboxListResponse;
    allEntries.push(...contData.entries);
    cursor = contData.cursor;
    hasMore = contData.has_more;
  }

  return allEntries.filter(e => e['.tag'] === 'file');
}

async function dropboxDownloadFile(token: string, path: string): Promise<string | null> {
  try {
    const resp = await fetchWithPolicy(`${DROPBOX_CONTENT}/files/download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path }) },
    }, DEFAULT_RETRY_POLICY);
    if (!resp.ok) return null;
    return resp.text();
  } catch { return null; }
}

// ── Dropbox operations ──

async function dropboxConnect(config: IntegrationConfig) {
  const token = ensureToken(config);
  await mustOk('Dropbox', await fetchWithPolicy(`${DROPBOX_API}/users/get_current_account`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: 'null',
  }, DEFAULT_RETRY_POLICY));
  return { message: `Connected to Dropbox via broker (${dropboxFolder(config)}).`, syncedAt: Date.now() };
}

async function dropboxPush(config: IntegrationConfig, payload: ProviderPayload) {
  const token = ensureToken(config);
  const folderPath = dropboxFolder(config);

  await dropboxEnsureFolder(token, folderPath);

  for (const chapter of payload.chapters) {
    await dropboxUploadFile(token, `${folderPath}/${chapter.id}.json`, JSON.stringify(chapter, null, 2));
  }

  const manifest = {
    novelId: payload.novelId,
    projectType: payload.projectType,
    chapterIds: payload.chapters.map(c => c.id),
    syncedAt: Date.now(),
  };
  await dropboxUploadFile(token, `${folderPath}/${MANIFEST_NAME}`, JSON.stringify(manifest, null, 2));

  return { message: `Pushed ${payload.chapters.length} chapter(s) to Dropbox via broker (${folderPath}).`, syncedAt: Date.now() };
}

async function dropboxPull(config: IntegrationConfig, localChapters: Chapter[]) {
  const token = ensureToken(config);
  const folderPath = dropboxFolder(config);

  let entries: DropboxEntry[];
  try {
    entries = await dropboxListFiles(token, folderPath);
  } catch {
    return { chapterUpdates: localChapters, remoteRevision: `dropbox-broker-empty-${Date.now()}`, conflicts: [] as never[] };
  }

  const remoteDocs: Array<{ id: string; title: string; body: string; order: number; updatedAt: number }> = [];
  for (const entry of entries) {
    if (entry.name === MANIFEST_NAME || !entry.name.endsWith('.json')) continue;
    const content = await dropboxDownloadFile(token, entry.path_display || entry.path_lower);
    if (!content) continue;
    try {
      const doc = JSON.parse(content) as { id: string; title: string; body: string; order: number; updatedAt: number };
      remoteDocs.push(doc);
    } catch { /* skip malformed */ }
  }

  if (remoteDocs.length === 0) {
    return { chapterUpdates: localChapters, remoteRevision: `dropbox-broker-empty-${Date.now()}`, conflicts: [] as never[] };
  }

  return simpleMergePull(localChapters, remoteDocs, 'dropbox-broker');
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
