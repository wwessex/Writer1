/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useOnboardingTrigger } from './useOnboardingTrigger';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountWithProps(initialProps: Parameters<typeof useOnboardingTrigger>[0]) {
  const container = document.createElement('div');
  const root = createRoot(container);

  function Test(props: Parameters<typeof useOnboardingTrigger>[0]) {
    useOnboardingTrigger(props);
    return null;
  }

  act(() => {
    root.render(<Test {...initialProps} />);
  });

  return {
    rerender: (nextProps: Parameters<typeof useOnboardingTrigger>[0]) => {
      act(() => {
        root.render(<Test {...nextProps} />);
      });
    },
    unmount: () => act(() => root.unmount()),
  };
}

describe('useOnboardingTrigger', () => {
  it('opens onboarding when loading completes and onboarding is incomplete', () => {
    const openOnboarding = vi.fn();
    const harness = mountWithProps({ isLoading: true, onboardingComplete: false, openOnboarding });

    expect(openOnboarding).not.toHaveBeenCalled();

    harness.rerender({ isLoading: false, onboardingComplete: false, openOnboarding });
    expect(openOnboarding).toHaveBeenCalledTimes(1);

    harness.unmount();
  });

  it('does not open onboarding when onboarding is already complete', () => {
    const openOnboarding = vi.fn();

    mountWithProps({ isLoading: false, onboardingComplete: true, openOnboarding });

    expect(openOnboarding).not.toHaveBeenCalled();
  });
});
