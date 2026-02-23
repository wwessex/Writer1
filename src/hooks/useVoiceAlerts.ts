import { useEffect, useRef, useState } from 'react';
import { getDialogueSimilarityAlerts, DEFAULT_VOICE_SIMILARITY_CONFIG, type VoiceSimilarityAlert } from '@/lib/voiceFingerprint';
import type { Chapter, CharacterVoiceProfile } from '@/types';

interface UseVoiceAlertsOptions {
  activeChapter: Chapter | null;
  baselineProfiles: CharacterVoiceProfile[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useVoiceAlerts({ activeChapter, baselineProfiles, showToast }: UseVoiceAlertsOptions) {
  const [voiceAlerts, setVoiceAlerts] = useState<VoiceSimilarityAlert[]>([]);
  const voiceAlertSignatureRef = useRef<string>('');

  useEffect(() => {
    if (!activeChapter) {
      setVoiceAlerts([]);
      return;
    }

    const alerts = getDialogueSimilarityAlerts(activeChapter.content, baselineProfiles, DEFAULT_VOICE_SIMILARITY_CONFIG);
    setVoiceAlerts(alerts);

    const nextSignature = alerts.slice(0, 3).map(alert => `${alert.activeSpeaker}:${alert.comparedSpeaker}:${alert.similarity.toFixed(3)}`).join('|');
    if (nextSignature && nextSignature !== voiceAlertSignatureRef.current) {
      const topAlert = alerts[0];
      showToast(`Voice overlap warning: ${topAlert.activeSpeaker} is ${(topAlert.similarity * 100).toFixed(0)}% similar to ${topAlert.comparedSpeaker}.`, 'warning');
      voiceAlertSignatureRef.current = nextSignature;
    }

    if (!nextSignature) {
      voiceAlertSignatureRef.current = '';
    }
  }, [activeChapter, baselineProfiles, showToast]);

  return voiceAlerts;
}
