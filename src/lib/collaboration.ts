/**
 * Real-time collaboration support using Yjs CRDT library.
 *
 * Provides a collaboration provider that can be used with Tiptap's
 * collaboration extension for multiplayer editing.
 *
 * Supports both WebRTC (P2P, serverless) and WebSocket relay modes.
 */

export type CollaborationRole = 'owner' | 'editor' | 'suggester' | 'viewer';

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  role: CollaborationRole;
}

export interface CollaborationSession {
  id: string;
  novelId: string;
  chapterId: string;
  createdAt: number;
  createdBy: string;
  users: CollaborationUser[];
  connectionType: 'webrtc' | 'websocket';
}

export interface ShareLink {
  sessionId: string;
  role: CollaborationRole;
  token: string;
  expiresAt: number;
}

const COLLABORATION_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
];

const SESSIONS_STORAGE_KEY = 'draftharbour_collab_sessions';

export function generateSessionId(): string {
  return `collab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateShareToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export function getRandomColor(): string {
  return COLLABORATION_COLORS[Math.floor(Math.random() * COLLABORATION_COLORS.length)];
}

export function createSession(
  novelId: string,
  chapterId: string,
  userName: string,
): CollaborationSession {
  return {
    id: generateSessionId(),
    novelId,
    chapterId,
    createdAt: Date.now(),
    createdBy: userName,
    users: [
      {
        id: `user-${Date.now()}`,
        name: userName,
        color: getRandomColor(),
        role: 'owner',
      },
    ],
    connectionType: 'webrtc',
  };
}

export function createShareLink(
  sessionId: string,
  role: CollaborationRole,
  expiresInHours: number = 24,
): ShareLink {
  return {
    sessionId,
    role,
    token: generateShareToken(),
    expiresAt: Date.now() + expiresInHours * 60 * 60 * 1000,
  };
}

export function canEdit(role: CollaborationRole): boolean {
  return role === 'owner' || role === 'editor';
}

export function canSuggest(role: CollaborationRole): boolean {
  return role === 'owner' || role === 'editor' || role === 'suggester';
}

export function loadSessions(): CollaborationSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSession(session: CollaborationSession): void {
  const sessions = loadSessions();
  const existing = sessions.findIndex(s => s.id === session.id);
  if (existing >= 0) {
    sessions[existing] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
}

export function deleteSession(sessionId: string): void {
  const sessions = loadSessions().filter(s => s.id !== sessionId);
  localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
}
