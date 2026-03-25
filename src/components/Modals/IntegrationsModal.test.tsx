/** @vitest-environment jsdom */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  connectIntegrationMock: vi.fn(async () => ({ message: 'connected', syncedAt: 1 })),
  pushMock: vi.fn(async () => ({ message: 'pushed 1 chapter(s)', syncedAt: 1 })),
  pullMock: vi.fn(async () => ({ chapterUpdates: [], remoteRevision: 'rev-1', conflicts: [] })),
  listRevisionsMock: vi.fn(async () => []),
  resolveSyncConflictMock: vi.fn(() => null),
  connectProviderMock: vi.fn(async () => ({
    provider: 'dropbox',
    connection: {
      connectionId: 'conn-1',
      providerUserId: 'user-1',
      scopes: [],
      expiresAt: Date.now() + 3600_000,
      status: 'connected' as const,
      sessionToken: 'token-1',
      refreshToken: 'rt-1',
    },
  })),
  disconnectProviderMock: vi.fn(async () => ({ provider: 'dropbox', disconnected: true })),
  refreshProviderConnectionMock: vi.fn(async () => ({
    provider: 'dropbox',
    connection: {
      connectionId: 'conn-1',
      providerUserId: 'user-1',
      scopes: [],
      expiresAt: Date.now() + 3600_000,
      status: 'connected' as const,
      sessionToken: 'refreshed-token',
      refreshToken: 'rt-1',
    },
  })),
  secureCacheEncodeMock: vi.fn(async () => 'encrypted'),
  secureCacheDecodeMock: vi.fn(async () => null),
  recordTelemetryEventMock: vi.fn(),
  createAppErrorMock: vi.fn((...args: unknown[]) => args),
  reportAppErrorMock: vi.fn(async () => undefined),
  dispatchMock: vi.fn(),
}));

vi.mock('@/components/UI', () => ({
  Dialog: ({ open, children, title }: { open: boolean; children?: ReactNode; title?: string }) =>
    open ? <div data-testid="dialog" data-title={title}>{children}</div> : null,
  Button: ({ children, onClick, disabled, variant }: { children?: ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) =>
    <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>,
  Input: ({ value, onChange, placeholder }: { value?: string; onChange?: (e: { target: { value: string } }) => void; placeholder?: string }) =>
    <input value={value} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: {
      novelId: 'novel-1',
      novelTitle: 'Test Novel',
      projectType: 'book',
      chapters: [],
    },
    dispatch: mocks.dispatchMock,
  }),
}));

vi.mock('@/lib/integrations', () => ({
  connectIntegration: mocks.connectIntegrationMock,
  listIntegrationRevisions: mocks.listRevisionsMock,
  pullIntegrationData: mocks.pullMock,
  pushIntegrationData: mocks.pushMock,
  resolveSyncConflict: mocks.resolveSyncConflictMock,
}));

vi.mock('@/lib/integrations/api', () => ({
  connectProvider: mocks.connectProviderMock,
  disconnectProvider: mocks.disconnectProviderMock,
  refreshProviderConnection: mocks.refreshProviderConnectionMock,
  DEFAULT_GOOGLE_CLIENT_ID: '',
  DEFAULT_DROPBOX_APP_KEY: '',
}));

vi.mock('@/lib/telemetry', () => ({
  recordTelemetryEvent: mocks.recordTelemetryEventMock,
}));

vi.mock('@/lib/errors', () => ({
  createAppError: mocks.createAppErrorMock,
  reportAppError: mocks.reportAppErrorMock,
}));

vi.mock('@/lib/secureCache', () => ({
  secureCacheEncode: mocks.secureCacheEncodeMock,
  secureCacheDecode: mocks.secureCacheDecodeMock,
}));

vi.mock('@/components/Modals/ConflictResolutionModal', () => ({
  ConflictResolutionModal: () => null,
}));

import { IntegrationsModal } from './IntegrationsModal';

// Provide a working localStorage stub for jsdom environments that lack one
const localStorageStore: Record<string, string> = {};
const localStorageStub = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => { localStorageStore[key] = value; },
  removeItem: (key: string) => { delete localStorageStore[key]; },
  clear: () => { for (const k of Object.keys(localStorageStore)) delete localStorageStore[k]; },
  get length() { return Object.keys(localStorageStore).length; },
  key: (i: number) => Object.keys(localStorageStore)[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, writable: true });

describe('IntegrationsModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    localStorageStub.clear();
    Object.values(mocks).forEach(m => m.mockClear());
  });

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('renders nothing when closed', () => {
    act(() => { root.render(<IntegrationsModal open={false} onClose={vi.fn()} />); });
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('renders the dialog with title when open', () => {
    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });
    const dialog = container.querySelector('[data-testid="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('data-title')).toBe('External Integrations');
  });

  it('renders all three integration cards', () => {
    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });
    const text = container.textContent || '';
    expect(text).toContain('Scrivener');
    expect(text).toContain('Google Drive');
    expect(text).toContain('Dropbox');
  });

  it('shows "Disconnected" status and "Never" sync time by default', () => {
    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });
    const text = container.textContent || '';
    expect(text).toContain('Disconnected');
    expect(text).toContain('Never');
  });

  it('enables a card body when toggle is clicked', async () => {
    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    // By default, card bodies are hidden (not enabled). Find the toggle checkboxes.
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3); // one per card

    // Enable Scrivener (first card)
    await act(async () => {
      checkboxes[0].click();
    });

    // After enabling, the Scrivener card should show its body with import/export buttons
    const text = container.textContent || '';
    expect(text).toContain('Import .scriv');
    expect(text).toContain('Export .scriv');
  });

  it('enables Google Drive card with credential input always visible', async () => {
    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    // Enable Google Drive (second card)
    await act(async () => {
      checkboxes[1].click();
    });

    const text = container.textContent || '';
    expect(text).toContain('Connect');
    expect(text).toContain('Google OAuth Client ID');

    // Client ID input should be visible (not hidden behind advanced toggle)
    const inputs = container.querySelectorAll('input[placeholder]');
    const clientIdInput = Array.from(inputs).find(
      i => i.getAttribute('placeholder')?.includes('googleusercontent.com')
    );
    expect(clientIdInput).not.toBeUndefined();

    // Connect button should be disabled without credentials
    const buttons = container.querySelectorAll('button');
    const connectBtn = Array.from(buttons).find(b => b.textContent?.includes('Connect'));
    expect(connectBtn?.disabled).toBe(true);
  });

  it('enables Dropbox card with folder input and credential input always visible', async () => {
    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    // Enable Dropbox (third card)
    await act(async () => {
      checkboxes[2].click();
    });

    // Should show both folder input and App Key input (not hidden behind advanced toggle)
    const inputs = container.querySelectorAll('input[placeholder]');
    const appKeyInput = Array.from(inputs).find(
      i => i.getAttribute('placeholder')?.includes('dropbox-app-key')
    );
    const folderInput = Array.from(inputs).find(
      i => i.getAttribute('placeholder')?.includes('/DraftHarbour')
    );
    expect(appKeyInput).not.toBeUndefined();
    expect(folderInput).not.toBeUndefined();

    const text = container.textContent || '';
    expect(text).toContain('Connect');
    expect(text).toContain('Dropbox App Key');

    // Connect button should be disabled without credentials
    const buttons = container.querySelectorAll('button');
    const connectBtn = Array.from(buttons).find(b => b.textContent?.includes('Connect'));
    expect(connectBtn?.disabled).toBe(true);
  });

  it('persists config to localStorage when toggling', async () => {
    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => {
      checkboxes[0].click();
    });

    const stored = localStorage.getItem('draftharbour_integrations');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.scrivener.enabled).toBe(true);
  });

  it('loads previously saved config from localStorage', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: true, status: 'disconnected' },
      'google-drive': { type: 'google-drive', enabled: false, status: 'disconnected' },
      dropbox: { type: 'dropbox', enabled: true, status: 'connected', connectionId: 'c-1', clientId: 'key-1' },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    // Scrivener and Dropbox should be enabled (show their bodies)
    const text = container.textContent || '';
    expect(text).toContain('Import .scriv');
    expect(text).toContain('Sync Folder Path');
    // Dropbox should show connected
    expect(text).toContain('Connected');
  });

  it('formats sync times correctly', async () => {
    const justNow = Date.now() - 30_000;
    const minutesAgo = Date.now() - 5 * 60_000;
    const hoursAgo = Date.now() - 3 * 3600_000;

    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: true, lastSyncAt: justNow },
      'google-drive': { type: 'google-drive', enabled: true, lastSyncAt: minutesAgo },
      dropbox: { type: 'dropbox', enabled: true, lastSyncAt: hoursAgo },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const text = container.textContent || '';
    expect(text).toContain('Just now');
    expect(text).toContain('5 min ago');
    expect(text).toContain('3h ago');
  });

  it('connects Google Drive when Connect is clicked with client ID', async () => {
    // Pre-load config with clientId so the component initializes with it
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: true, status: 'disconnected', clientId: 'test-client-id' },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const connectBtn = Array.from(buttons).find(b => b.textContent?.includes('Connect'));
    expect(connectBtn).toBeDefined();
    expect(connectBtn?.disabled).toBe(false);

    await act(async () => { connectBtn!.click(); });

    expect(mocks.connectProviderMock).toHaveBeenCalledWith('google-drive', 'test-client-id');
  });

  it('disconnects Google Drive when Disconnect is clicked', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: true, status: 'connected', connectionId: 'conn-g1', sessionToken: 'tok-g1', clientId: 'cid-1' },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const disconnectBtn = Array.from(buttons).find(b => b.textContent?.includes('Disconnect'));
    expect(disconnectBtn).toBeDefined();

    await act(async () => { disconnectBtn!.click(); });

    expect(mocks.disconnectProviderMock).toHaveBeenCalledWith('google-drive', 'conn-g1', 'tok-g1');
  });

  it('syncs Google Drive when Sync now is clicked', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: true, status: 'connected', connectionId: 'conn-g1', sessionToken: 'tok-g1', clientId: 'cid-1' },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const syncBtn = Array.from(buttons).find(b => b.textContent?.includes('Sync now'));
    expect(syncBtn).toBeDefined();

    await act(async () => { syncBtn!.click(); });

    expect(mocks.pushMock).toHaveBeenCalled();
    expect(mocks.pullMock).toHaveBeenCalled();
  });

  it('lists Google Drive revisions', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: true, status: 'connected', connectionId: 'conn-g1', sessionToken: 'tok-g1', clientId: 'cid-1' },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const revisionsBtn = Array.from(buttons).find(b => b.textContent?.includes('Revisions'));
    expect(revisionsBtn).toBeDefined();

    await act(async () => { revisionsBtn!.click(); });

    expect(mocks.listRevisionsMock).toHaveBeenCalledWith('google-drive', expect.objectContaining({ connectionId: 'conn-g1' }));
  });

  it('connects Dropbox when Connect is clicked with app key', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: false },
      dropbox: { type: 'dropbox', enabled: true, status: 'disconnected', clientId: 'test-app-key' },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const connectBtn = Array.from(buttons).find(b => b.textContent?.includes('Connect'));
    expect(connectBtn?.disabled).toBe(false);

    await act(async () => { connectBtn!.click(); });

    expect(mocks.connectProviderMock).toHaveBeenCalledWith('dropbox', 'test-app-key');
  });

  it('disconnects Dropbox when Disconnect is clicked', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: false },
      dropbox: { type: 'dropbox', enabled: true, status: 'connected', connectionId: 'conn-d1', sessionToken: 'tok-d1', clientId: 'key-1' },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const disconnectBtn = Array.from(buttons).find(b => b.textContent?.includes('Disconnect'));

    await act(async () => { disconnectBtn!.click(); });

    expect(mocks.disconnectProviderMock).toHaveBeenCalledWith('dropbox', 'conn-d1', 'tok-d1');
  });

  it('syncs Dropbox when Sync now is clicked', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: false },
      dropbox: { type: 'dropbox', enabled: true, status: 'connected', connectionId: 'conn-d1', sessionToken: 'tok-d1', clientId: 'key-1' },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const syncBtn = Array.from(buttons).find(b => b.textContent?.includes('Sync now'));

    await act(async () => { syncBtn!.click(); });

    expect(mocks.pushMock).toHaveBeenCalled();
    expect(mocks.pullMock).toHaveBeenCalled();
  });

  it('lists Dropbox revisions', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: false },
      dropbox: { type: 'dropbox', enabled: true, status: 'connected', connectionId: 'conn-d1', sessionToken: 'tok-d1', clientId: 'key-1' },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const revisionsBtn = Array.from(buttons).find(b => b.textContent?.includes('Revisions'));

    await act(async () => { revisionsBtn!.click(); });

    expect(mocks.listRevisionsMock).toHaveBeenCalled();
  });

  it('shows Reconnect label when token is expired', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: true, status: 'connected', connectionId: 'conn-g1', sessionToken: 'tok-g1', clientId: 'cid-1', expiresAt: Date.now() - 60_000 },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const text = container.textContent || '';
    expect(text).toContain('Reconnect');
  });

  it('shows operation error state on connect failure', async () => {
    mocks.connectProviderMock.mockRejectedValueOnce(new Error('OAuth popup closed'));

    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: true, status: 'disconnected', clientId: 'cid-1' },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const connectBtn = Array.from(buttons).find(b => b.textContent?.includes('Connect'));

    await act(async () => { connectBtn!.click(); });

    const text = container.textContent || '';
    expect(text).toContain('Failed');
    expect(text).toContain('OAuth popup closed');
  });

  it('runs Scrivener import when Import .scriv is clicked', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: true },
      'google-drive': { type: 'google-drive', enabled: false },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const importBtn = Array.from(buttons).find(b => b.textContent?.includes('Import .scriv'));

    await act(async () => { importBtn!.click(); });

    expect(mocks.pullMock).toHaveBeenCalledWith('scrivener', expect.objectContaining({ type: 'scrivener' }), expect.any(Object));
  });

  it('runs Scrivener export when Export .scriv is clicked', async () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: true },
      'google-drive': { type: 'google-drive', enabled: false },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const buttons = container.querySelectorAll('button');
    const exportBtn = Array.from(buttons).find(b => b.textContent?.includes('Export .scriv'));

    await act(async () => { exportBtn!.click(); });

    expect(mocks.pushMock).toHaveBeenCalledWith('scrivener', expect.objectContaining({ type: 'scrivener' }), expect.any(Object));
  });

  it('shows providerUserId when connected', () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: true, status: 'connected', connectionId: 'c1', providerUserId: 'user@gmail.com', sessionToken: 't', clientId: 'c' },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    const text = container.textContent || '';
    expect(text).toContain('Account: user@gmail.com');
  });

  it('shows date format for old sync times', () => {
    const oldDate = Date.now() - 48 * 3600_000; // 2 days ago

    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: true, lastSyncAt: oldDate },
      'google-drive': { type: 'google-drive', enabled: false },
      dropbox: { type: 'dropbox', enabled: false },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    // Should show a formatted date, not hours
    const text = container.textContent || '';
    expect(text).not.toContain('48h ago');
    // It should contain a month abbreviation
    expect(text).toMatch(/\w{3}\s+\d/);
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('draftharbour_integrations', 'not-json{{{');

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    // Should render with defaults (no crash)
    const text = container.textContent || '';
    expect(text).toContain('Scrivener');
    expect(text).toContain('Disconnected');
  });

  it('scrubs legacy accessToken/apiKey fields on load', () => {
    localStorage.setItem('draftharbour_integrations', JSON.stringify({
      scrivener: { type: 'scrivener', enabled: false },
      'google-drive': { type: 'google-drive', enabled: false },
      dropbox: { type: 'dropbox', enabled: false, accessToken: 'SECRET', apiKey: 'SECRET2' },
    }));

    act(() => { root.render(<IntegrationsModal open onClose={vi.fn()} />); });

    // After re-save, the secrets should be removed
    const stored = JSON.parse(localStorage.getItem('draftharbour_integrations')!);
    expect(stored.dropbox.accessToken).toBeUndefined();
    expect(stored.dropbox.apiKey).toBeUndefined();
  });
});
