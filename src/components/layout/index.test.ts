import { describe, expect, it } from 'vitest';
import {
  AppShellLayout,
  TopBar,
  StatusBar,
  LeftSidebar,
  EditorPane,
  RightInspector,
} from './index';

describe('layout barrel exports', () => {
  it('exports all layout components', () => {
    expect(AppShellLayout).toBeDefined();
    expect(TopBar).toBeDefined();
    expect(StatusBar).toBeDefined();
    expect(LeftSidebar).toBeDefined();
    expect(EditorPane).toBeDefined();
    expect(RightInspector).toBeDefined();
  });
});
