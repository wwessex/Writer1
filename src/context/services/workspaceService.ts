import { generateId } from '@/lib/utils';

const WORKSPACE_KEY = 'draftharbour_workspace_v1';
const SESSION_PREFIX = 'draftharbour_session_v1_';
const LOCKS_KEY = 'draftharbour_project_locks_v1';
const WINDOW_ID_KEY = 'draftharbour_window_id';
const LOCK_TTL_MS = 15000;

interface WorkspaceStore {
  recentProjectIds: string[];
  pinnedProjectIds: string[];
  lastProjectId: string | null;
  lastOpenedChapterByProject: Record<string, string>;
}

interface LockStore {
  [projectId: string]: Array<{ windowId: string; heartbeatAt: number }>;
}

export interface SessionState {
  projectId: string | null;
  chapterId: string | null;
  panelLayout: unknown;
  geometry: { width: number; height: number; x: number; y: number } | null;
  inspectorOpen?: boolean;
}

const defaultWorkspace = (): WorkspaceStore => ({
  recentProjectIds: [],
  pinnedProjectIds: [],
  lastProjectId: null,
  lastOpenedChapterByProject: {},
});

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const getWorkspaceStore = (): WorkspaceStore => readJson(WORKSPACE_KEY, defaultWorkspace());

export const getWindowId = (): string => {
  const existing = sessionStorage.getItem(WINDOW_ID_KEY);
  if (existing) return existing;
  const created = generateId();
  sessionStorage.setItem(WINDOW_ID_KEY, created);
  return created;
};

export const trackProjectOpen = (projectId: string) => {
  const store = getWorkspaceStore();
  store.lastProjectId = projectId;
  store.recentProjectIds = [projectId, ...store.recentProjectIds.filter(id => id !== projectId)].slice(0, 10);
  writeJson(WORKSPACE_KEY, store);
};

export const setLastOpenedChapter = (projectId: string, chapterId: string) => {
  const store = getWorkspaceStore();
  store.lastOpenedChapterByProject[projectId] = chapterId;
  writeJson(WORKSPACE_KEY, store);
};

export const togglePinnedProject = (projectId: string) => {
  const store = getWorkspaceStore();
  if (store.pinnedProjectIds.includes(projectId)) {
    store.pinnedProjectIds = store.pinnedProjectIds.filter(id => id !== projectId);
  } else {
    store.pinnedProjectIds = [...store.pinnedProjectIds, projectId];
  }
  writeJson(WORKSPACE_KEY, store);
};

export const getSessionState = (): SessionState | null => {
  const windowId = getWindowId();
  return readJson<SessionState | null>(`${SESSION_PREFIX}${windowId}`, null);
};

export const persistSessionState = (state: SessionState) => {
  const windowId = getWindowId();
  writeJson(`${SESSION_PREFIX}${windowId}`, state);
};

const sanitizeLocks = (locks: LockStore): LockStore => {
  const now = Date.now();
  const clean: LockStore = {};
  for (const [projectId, entries] of Object.entries(locks)) {
    const active = entries.filter(entry => now - entry.heartbeatAt < LOCK_TTL_MS);
    if (active.length > 0) {
      clean[projectId] = active;
    }
  }
  return clean;
};

export const heartbeatProjectLock = (projectId: string | null) => {
  const windowId = getWindowId();
  const locks = sanitizeLocks(readJson<LockStore>(LOCKS_KEY, {}));

  for (const [id, entries] of Object.entries(locks)) {
    locks[id] = entries.filter(entry => entry.windowId !== windowId);
    if (locks[id].length === 0) delete locks[id];
  }

  if (projectId) {
    const existing = locks[projectId] || [];
    locks[projectId] = [...existing, { windowId, heartbeatAt: Date.now() }];
  }

  writeJson(LOCKS_KEY, locks);
};

export const isProjectLockedElsewhere = (projectId: string) => {
  const windowId = getWindowId();
  const locks = sanitizeLocks(readJson<LockStore>(LOCKS_KEY, {}));
  return (locks[projectId] || []).some(entry => entry.windowId !== windowId);
};

export const clearWindowLocks = () => {
  heartbeatProjectLock(null);
};
