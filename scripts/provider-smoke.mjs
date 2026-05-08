import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = new Set(process.argv.slice(2));
const requireConfigured = args.has('--require-configured');
const timeoutMs = Number.parseInt(process.env.DRAFTHARBOUR_SMOKE_TIMEOUT_MS ?? '15000', 10);

const results = [];

const redact = (value) => {
  if (!value) return value;
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(api[_-]?key[=:]\s*)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(token[=:]\s*)[^\s]+/gi, '$1[REDACTED]');
};

const withTimeout = async (operation) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const record = (name, status, detail = '') => {
  results.push({ name, status, detail: redact(detail) });
};

const skip = (name, envNames) => {
  record(name, 'skipped', `Set ${envNames.join(', ')} to enable this smoke check.`);
};

const assertHTTP = async (response, label) => {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${label} returned ${response.status}: ${body.slice(0, 400)}`);
  }
  return response;
};

const smokeAI = async () => {
  const endpoint = process.env.DRAFTHARBOUR_SMOKE_AI_ENDPOINT;
  const model = process.env.DRAFTHARBOUR_SMOKE_AI_MODEL;
  if (!endpoint || !model) {
    skip('AI provider', ['DRAFTHARBOUR_SMOKE_AI_ENDPOINT', 'DRAFTHARBOUR_SMOKE_AI_MODEL']);
    return;
  }

  await withTimeout(async (signal) => {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.DRAFTHARBOUR_SMOKE_AI_API_KEY) {
      headers.Authorization = `Bearer ${process.env.DRAFTHARBOUR_SMOKE_AI_API_KEY}`;
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: DraftHarbour smoke ok' }],
        temperature: 0,
        max_tokens: 16,
      }),
    });
    await assertHTTP(response, 'AI provider');
    const payload = await response.json();
    const text = payload?.choices?.[0]?.message?.content ?? payload?.choices?.[0]?.text ?? '';
    if (!String(text).trim()) throw new Error('AI provider returned an empty completion.');
  });
  record('AI provider', 'passed', endpoint);
};

const smokeLanguageTool = async () => {
  const endpoint = process.env.DRAFTHARBOUR_SMOKE_LANGUAGETOOL_URL;
  if (!endpoint) {
    skip('LanguageTool', ['DRAFTHARBOUR_SMOKE_LANGUAGETOOL_URL']);
    return;
  }

  await withTimeout(async (signal) => {
    const body = new URLSearchParams({
      text: 'This are a smoke test.',
      language: process.env.DRAFTHARBOUR_SMOKE_LANGUAGETOOL_LANGUAGE ?? 'en-US',
    });
    const response = await fetch(endpoint, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    await assertHTTP(response, 'LanguageTool');
    const payload = await response.json();
    if (!Array.isArray(payload.matches)) throw new Error('LanguageTool response did not include matches.');
  });
  record('LanguageTool', 'passed', endpoint);
};

const smokeGenericREST = async () => {
  const baseURL = process.env.DRAFTHARBOUR_SMOKE_REST_BASE_URL;
  if (!baseURL) {
    skip('Generic REST', ['DRAFTHARBOUR_SMOKE_REST_BASE_URL']);
    return;
  }

  const healthPath = process.env.DRAFTHARBOUR_SMOKE_REST_HEALTH_PATH ?? '/health';
  const endpoint = new URL(healthPath, baseURL).toString();
  await withTimeout(async (signal) => {
    const headers = {};
    if (process.env.DRAFTHARBOUR_SMOKE_REST_TOKEN) {
      headers.Authorization = `Bearer ${process.env.DRAFTHARBOUR_SMOKE_REST_TOKEN}`;
    }
    await assertHTTP(await fetch(endpoint, { signal, headers }), 'Generic REST');
  });
  record('Generic REST', 'passed', endpoint);
};

const smokeDropbox = async () => {
  const token = process.env.DRAFTHARBOUR_SMOKE_DROPBOX_ACCESS_TOKEN;
  if (!token) {
    skip('Dropbox', ['DRAFTHARBOUR_SMOKE_DROPBOX_ACCESS_TOKEN']);
    return;
  }

  await withTimeout(async (signal) => {
    const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: 'null',
    });
    await assertHTTP(response, 'Dropbox');
    const payload = await response.json();
    if (!payload.account_id) throw new Error('Dropbox account response did not include account_id.');
  });
  record('Dropbox', 'passed', 'users/get_current_account');
};

const smokeGoogleDrive = async () => {
  const token = process.env.DRAFTHARBOUR_SMOKE_GOOGLE_ACCESS_TOKEN;
  if (!token) {
    skip('Google Drive', ['DRAFTHARBOUR_SMOKE_GOOGLE_ACCESS_TOKEN']);
    return;
  }

  await withTimeout(async (signal) => {
    const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id,name)', {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    await assertHTTP(response, 'Google Drive');
    const payload = await response.json();
    if (!Array.isArray(payload.files)) throw new Error('Google Drive response did not include files.');
  });
  record('Google Drive', 'passed', 'drive/v3/files');
};

const smokeScrivener = async () => {
  const packagePath = process.env.DRAFTHARBOUR_SMOKE_SCRIVENER_PATH;
  if (!packagePath) {
    skip('Scrivener', ['DRAFTHARBOUR_SMOKE_SCRIVENER_PATH']);
    return;
  }

  if (!existsSync(packagePath)) throw new Error(`Scrivener path does not exist: ${packagePath}`);
  if (!statSync(packagePath).isDirectory()) throw new Error(`Scrivener path is not a directory: ${packagePath}`);
  const entries = readdirSync(packagePath);
  const hasScrivenerShape = packagePath.endsWith('.scriv') || entries.some((entry) => entry.endsWith('.scrivx') || entry === 'Files');
  const txtCount = countTextFiles(packagePath);
  if (!hasScrivenerShape && txtCount === 0) {
    throw new Error('Scrivener smoke path does not look like a .scriv package or text export folder.');
  }
  record('Scrivener', 'passed', `${packagePath} (${txtCount} txt file(s))`);
};

const countTextFiles = (root) => {
  let count = 0;
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) visit(path);
      else if (entry.toLowerCase().endsWith('.txt')) count += 1;
    }
  };
  visit(root);
  return count;
};

const checks = [
  ['AI provider', smokeAI],
  ['LanguageTool', smokeLanguageTool],
  ['Generic REST', smokeGenericREST],
  ['Dropbox', smokeDropbox],
  ['Google Drive', smokeGoogleDrive],
  ['Scrivener', smokeScrivener],
];

for (const [name, check] of checks) {
  try {
    await check();
  } catch (error) {
    record(name, 'failed', error instanceof Error ? error.message : String(error));
  }
}

for (const result of results) {
  const marker = result.status === 'passed' ? 'PASS' : result.status === 'failed' ? 'FAIL' : 'SKIP';
  console.log(`[${marker}] ${result.name}${result.detail ? ` - ${result.detail}` : ''}`);
}

const failed = results.filter((result) => result.status === 'failed');
const passed = results.filter((result) => result.status === 'passed');

if (failed.length > 0) {
  process.exit(1);
}

if (requireConfigured && passed.length === 0) {
  console.error('No provider smoke checks were configured.');
  process.exit(1);
}
