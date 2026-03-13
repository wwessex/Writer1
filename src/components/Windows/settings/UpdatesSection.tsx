import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import { applyUpdateAndRestart, checkForUpdate, deferUpdate, getDeferredUpdateVersion, getLaunchFallbackMessage, getReleaseChannel, setReleaseChannel, type UpdaterSummary } from '@/lib/desktopUpdater';
import type { ReleaseChannel } from '@/lib/updaterGuardrails';
import styles from '../Windows.module.css';

interface UpdatesSectionProps {
  highlightMatch: (text: string) => React.ReactNode;
}

export function UpdatesSection({ highlightMatch }: UpdatesSectionProps) {
  const { state, updateSettings } = useApp();
  const [releaseChannel, setReleaseChannelState] = useState<ReleaseChannel>(() => state.settings.releaseChannel ?? getReleaseChannel());
  const [updateSummary, setUpdateSummary] = useState<UpdaterSummary | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);

  useEffect(() => {
    setReleaseChannel(releaseChannel);
    updateSettings({ releaseChannel });
  }, [releaseChannel, updateSettings]);

  useEffect(() => {
    const fallbackMessage = getLaunchFallbackMessage();
    if (fallbackMessage) {
      setUpdateSummary({ available: false, body: fallbackMessage });
    }
  }, []);

  const handleCheckUpdates = async () => {
    setUpdateBusy(true);
    try {
      const summary = await checkForUpdate();
      setUpdateSummary(summary);
      if (!summary.available) {
        window.alert('No eligible update found for this channel.');
      }
    } catch (error) {
      console.error('Update check failed', error);
      window.alert('Update check failed. Guardrails may have switched to fallback mode.');
    } finally {
      setUpdateBusy(false);
    }
  };

  const handleDeferUpdate = () => {
    if (!updateSummary?.version) return;
    deferUpdate(updateSummary.version);
    window.alert(`Deferred update ${updateSummary.version}.`);
  };

  const handleApplyUpdate = async () => {
    setUpdateBusy(true);
    try {
      await applyUpdateAndRestart();
    } catch (error) {
      console.error('Failed to apply update', error);
      window.alert('Failed to apply update. Launch fallback remains active.');
    } finally {
      setUpdateBusy(false);
    }
  };

  return (
    <>
      <div className={styles.field}>
        <label>{highlightMatch('Release Channel')}</label>
        <Select
          value={releaseChannel}
          onChange={e => setReleaseChannelState(e.target.value as ReleaseChannel)}
          options={[
            { value: 'stable', label: 'Stable' },
            { value: 'beta', label: 'Beta' },
            { value: 'nightly', label: 'Nightly' },
          ]}
        />
      </div>
      <div className={styles.fieldRow}>
        <Button onClick={handleCheckUpdates} disabled={updateBusy}>
          <span className="material-symbols-rounded">update</span>
          Check for Updates
        </Button>
        {updateSummary?.available && (
          <Button variant="ghost" onClick={handleDeferUpdate} disabled={updateBusy}>
            <span className="material-symbols-rounded">schedule</span>
            Defer Install
          </Button>
        )}
      </div>
      {updateSummary?.version && (
        <div className={styles.updateCard}>
          <p className={styles.updateMeta}>Version {updateSummary.version}</p>
          {updateSummary.body && <pre className={styles.updateNotes}>{updateSummary.body}</pre>}
          {getDeferredUpdateVersion() && <p className={styles.updateMeta}>Deferred: {getDeferredUpdateVersion()}</p>}
          {updateSummary.available && (
            <Button onClick={handleApplyUpdate} disabled={updateBusy}>
              <span className="material-symbols-rounded">restart_alt</span>
              Restart to Apply
            </Button>
          )}
        </div>
      )}
    </>
  );
}
