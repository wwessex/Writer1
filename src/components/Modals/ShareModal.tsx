/**
 * Share modal for real-time collaboration.
 *
 * Allows creating collaboration sessions and generating
 * share links with role-based permissions.
 */

import { useState, useCallback } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import {
  createSession,
  createShareLink,
} from '@/lib/collaboration';
import type { CollaborationRole, CollaborationSession, ShareLink } from '@/lib/collaboration';
import styles from './Modals.module.css';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
}

const ROLE_DESCRIPTIONS: Record<CollaborationRole, string> = {
  owner: 'Full access — can edit, manage users, and delete the session',
  editor: 'Can edit the document directly',
  suggester: 'Can make suggestions but not edit directly',
  viewer: 'Read-only access to the document',
};

export function ShareModal({ open, onClose }: ShareModalProps) {
  const { state } = useApp();
  const { showToast } = useToast();
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [selectedRole, setSelectedRole] = useState<CollaborationRole>('editor');
  const [userName, setUserName] = useState('Author');

  const startSession = useCallback(() => {
    if (!state.activeChapterId) {
      showToast('Select a chapter first', 'warning');
      return;
    }

    const newSession = createSession(state.novelId, state.activeChapterId, userName);
    setSession(newSession);
    showToast('Collaboration session created', 'success', 'group');
  }, [state.novelId, state.activeChapterId, userName, showToast]);

  const generateLink = useCallback(() => {
    if (!session) return;

    const link = createShareLink(session.id, selectedRole);
    setShareLinks(prev => [...prev, link]);

    const shareUrl = `${window.location.origin}${window.location.pathname}?collab=${link.token}`;
    void navigator.clipboard.writeText(shareUrl);
    showToast('Share link copied to clipboard', 'success', 'link');
  }, [session, selectedRole, showToast]);

  return (
    <Dialog open={open} onClose={onClose} title="Share & Collaborate" size="medium">
      <div className={styles.section}>
        {!session ? (
          <>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
              Start a collaboration session to work on this chapter with others in real time.
              Others can join using a share link with role-based permissions.
            </p>

            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>Your Display Name</span>
              <input
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)' }}
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="Enter your name"
              />
            </label>

            <div style={{ padding: 16, background: 'var(--hover)', borderRadius: 8, marginBottom: 16 }}>
              <strong style={{ fontSize: 13 }}>Requirements</strong>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Real-time collaboration requires a WebRTC connection between participants.
                Both users need to be online simultaneously. A WebSocket relay server is optional for better connectivity.
              </p>
            </div>

            <Button variant="primary" onClick={startSession}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>group_add</span>
              Start Collaboration Session
            </Button>
          </>
        ) : (
          <>
            <div style={{ padding: 12, background: 'var(--hover)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--success, #22c55e)' }}>
                  radio_button_checked
                </span>
                <strong>Session Active</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <div>Session ID: {session.id}</div>
                <div>Users connected: {session.users.length}</div>
                <div>Chapter: {state.chapters.find(c => c.id === session.chapterId)?.title || 'Unknown'}</div>
              </div>
            </div>

            {/* Connected users */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8 }}>Connected Users</h4>
              {session.users.map(user => (
                <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', background: user.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600, color: 'white',
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ flex: 1, fontSize: 13 }}>{user.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{user.role}</span>
                </div>
              ))}
            </div>

            {/* Generate share link */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8 }}>Invite Others</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)' }}
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value as CollaborationRole)}
                >
                  <option value="editor">Editor</option>
                  <option value="suggester">Suggester</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button variant="primary" onClick={generateLink}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>link</span>
                  Copy Link
                </Button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                {ROLE_DESCRIPTIONS[selectedRole]}
              </p>
            </div>

            {/* Generated links */}
            {shareLinks.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>Active Links</h4>
                {shareLinks.map((link, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 14 }}>link</span>
                    <span style={{ textTransform: 'capitalize' }}>{link.role}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      expires {new Date(link.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="ghost"
              onClick={() => { setSession(null); setShareLinks([]); }}
              style={{ marginTop: 16 }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>stop_circle</span>
              End Session
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
