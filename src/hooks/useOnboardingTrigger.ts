import { useEffect } from 'react';

interface UseOnboardingTriggerOptions {
  isLoading: boolean;
  onboardingComplete: boolean;
  openOnboarding: () => void;
}

export function useOnboardingTrigger({ isLoading, onboardingComplete, openOnboarding }: UseOnboardingTriggerOptions) {
  useEffect(() => {
    if (!isLoading && !onboardingComplete) {
      openOnboarding();
    }
  }, [isLoading, onboardingComplete, openOnboarding]);
}
