/** @vitest-environment jsdom */
import { act, type ReactNode, type ChangeEventHandler } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const onCloseMock = vi.fn();

vi.mock('@/components/UI', () => ({
  Dialog: ({ open, title, children }: { open: boolean; title: string; children?: ReactNode }) => open ? <div data-testid="dialog"><h2>{title}</h2>{children}</div> : null,
  Input: ({ value, onChange, placeholder }: { value?: string; onChange?: ChangeEventHandler<HTMLInputElement>; placeholder?: string }) => <input value={value} onChange={onChange} placeholder={placeholder} />,
}));

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({
    state: { novelId: 'n1' },
  }),
}));

vi.mock('./Modals.module.css', () => ({
  default: new Proxy({}, { get: (_, key) => String(key) }),
}));

import { StoryCardsModal } from './StoryCardsModal';

const testCharacters = [
  { id: 'char1', novelId: 'n1', name: 'Alice Smith', aliases: ['Al'], description: 'The hero', role: 'protagonist', traits: ['brave', 'kind', 'smart', 'funny'], notes: 'Main character', relationships: [{ targetId: 'char2', type: 'friend' }], createdAt: 0, updatedAt: 0 },
  { id: 'char2', novelId: 'n1', name: 'Bob Jones', aliases: [], description: 'The villain', role: 'antagonist', traits: ['cunning'], notes: '', relationships: [], createdAt: 0, updatedAt: 0 },
];
const testWorld = [
  { id: 'w1', novelId: 'n1', category: 'location', name: 'Dark Forest', description: 'A mysterious forest', tags: ['nature', 'danger', 'mystery', 'old'], linkedCharacters: ['char1'], notes: 'Key location', createdAt: 0, updatedAt: 0 },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  localStorage.setItem('draftharbour_characters', JSON.stringify(testCharacters));
  localStorage.setItem('draftharbour_world', JSON.stringify(testWorld));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  localStorage.clear();
  onCloseMock.mockClear();
});

describe('StoryCardsModal', () => {
  it('renders nothing when closed', () => {
    act(() => {
      root.render(<StoryCardsModal open={false} onClose={onCloseMock} />);
    });
    expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
  });

  it('renders dialog with character and world cards', () => {
    act(() => {
      root.render(<StoryCardsModal open={true} onClose={onCloseMock} />);
    });
    const dialog = container.querySelector('[data-testid="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector('h2')!.textContent).toBe('Story Cards');
    // Both character names and world entry name should appear
    expect(container.textContent).toContain('Alice Smith');
    expect(container.textContent).toContain('Bob Jones');
    expect(container.textContent).toContain('Dark Forest');
  });

  it('shows character initials in avatar', () => {
    act(() => {
      root.render(<StoryCardsModal open={true} onClose={onCloseMock} />);
    });
    // Alice Smith -> "AS"
    const text = container.innerHTML;
    expect(text).toContain('AS');
  });

  it('shows trait pills with overflow count', () => {
    act(() => {
      root.render(<StoryCardsModal open={true} onClose={onCloseMock} />);
    });
    const text = container.textContent!;
    // Alice has 4 traits, should show first 3 plus "+1"
    expect(text).toContain('brave');
    expect(text).toContain('kind');
    expect(text).toContain('smart');
    expect(text).toContain('+1');
    // 'funny' should not appear (it's the 4th trait, hidden behind overflow count)
    // But note: it won't appear in pills, it may appear if expanded. Since not expanded, check pills area.
    // Actually, the card is not expanded by default, so 'funny' only appears in expanded section.
    // In the collapsed state, only first 3 traits are shown as pills.
  });

  it('tab switching shows only characters or locations', () => {
    act(() => {
      root.render(<StoryCardsModal open={true} onClose={onCloseMock} />);
    });
    // Click "Characters" tab
    const tabs = container.querySelectorAll('button');
    const charsTab = Array.from(tabs).find(b => b.textContent === 'Characters')!;
    act(() => { charsTab.click(); });
    expect(container.textContent).toContain('Alice Smith');
    expect(container.textContent).toContain('Bob Jones');
    expect(container.textContent).not.toContain('Dark Forest');

    // Click "Locations" tab
    const locsTab = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Locations')!;
    act(() => { locsTab.click(); });
    expect(container.textContent).toContain('Dark Forest');
    expect(container.textContent).not.toContain('Alice Smith');
    expect(container.textContent).not.toContain('Bob Jones');
  });

  it('search filters cards by name', () => {
    act(() => {
      root.render(<StoryCardsModal open={true} onClose={onCloseMock} />);
    });
    const input = container.querySelector('input')!;
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      nativeInputValueSetter.call(input, 'Alice');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // Use the onChange handler directly
    });
    // The mock Input component uses onChange, so we simulate via the React onChange
    // We need to fire a change event
    act(() => {
      const event = new Event('change', { bubbles: true });
      Object.defineProperty(event, 'target', { value: { value: 'Alice' } });
      input.dispatchEvent(event);
    });
    // Since the mock Input is controlled by the parent, we need to trigger onChange.
    // Let's re-render with the search happening via the actual React event.
    // Actually the mock Input renders a real <input>, so we can use the native setter + input event.
    // But React 19 synthetic events listen for 'input' event.
    // Let's just verify the input exists and try a simpler approach:
    // Use Object.getOwnPropertyDescriptor to set value and fire input event
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      nativeInputValueSetter.call(input, 'Alice');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // After search for "Alice", Bob and Dark Forest should be filtered out
    expect(container.textContent).toContain('Alice Smith');
    expect(container.textContent).not.toContain('Bob Jones');
    expect(container.textContent).not.toContain('Dark Forest');
  });

  it('clicking card expands detail section', () => {
    act(() => {
      root.render(<StoryCardsModal open={true} onClose={onCloseMock} />);
    });
    // Before clicking, expanded details shouldn't be visible
    expect(container.textContent).not.toContain('All traits:');
    expect(container.textContent).not.toContain('Aliases:');

    // Click Alice's card (the first card with role="button")
    const cards = container.querySelectorAll('[role="button"]');
    const aliceCard = Array.from(cards).find(c => c.textContent!.includes('Alice Smith'))!;
    act(() => { (aliceCard as HTMLElement).click(); });

    // Now the expanded detail should be visible
    expect(container.textContent).toContain('Aliases:');
    expect(container.textContent).toContain('Al');
    expect(container.textContent).toContain('All traits:');
    expect(container.textContent).toContain('brave, kind, smart, funny');
    expect(container.textContent).toContain('Notes:');
    expect(container.textContent).toContain('Main character');
    expect(container.textContent).toContain('Relationships:');
    expect(container.textContent).toContain('Bob Jones');
    expect(container.textContent).toContain('(friend)');
  });

  it('shows empty state when no data', () => {
    localStorage.clear();
    act(() => {
      root.render(<StoryCardsModal open={true} onClose={onCloseMock} />);
    });
    expect(container.textContent).toContain('No characters or world entries yet');
  });

  it('filter chips filter by role', () => {
    act(() => {
      root.render(<StoryCardsModal open={true} onClose={onCloseMock} />);
    });
    // Both characters should be visible initially
    expect(container.textContent).toContain('Alice Smith');
    expect(container.textContent).toContain('Bob Jones');

    // Click the "Antagonist" filter chip
    const buttons = container.querySelectorAll('button');
    const antagonistChip = Array.from(buttons).find(b => b.textContent === 'Antagonist')!;
    act(() => { antagonistChip.click(); });

    // Only Bob (antagonist) should remain; Alice (protagonist) should be filtered out
    expect(container.textContent).toContain('Bob Jones');
    expect(container.textContent).not.toContain('Alice Smith');
    // World entries should still be visible (role filters don't affect world entries)
    expect(container.textContent).toContain('Dark Forest');
  });
});
