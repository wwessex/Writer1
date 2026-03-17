/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorContext, useCurrentEditor } from './EditorContext';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('EditorContext', () => {
  it('is a React context', () => {
    expect(typeof EditorContext).toBe('object');
    expect(EditorContext.Provider).toBeDefined();
    expect(EditorContext.Consumer).toBeDefined();
  });

  it('useCurrentEditor returns { editor: null } by default', () => {
    let result: ReturnType<typeof useCurrentEditor> | undefined;

    function TestComponent() {
      result = useCurrentEditor();
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);

    act(() => {
      createRoot(container).render(React.createElement(TestComponent));
    });

    expect(result).toEqual({ editor: null });

    document.body.removeChild(container);
  });
});
