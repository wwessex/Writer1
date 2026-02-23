import type { DocxTextRunLike } from '../types';

export function cloneDocxTextRun(
  run: unknown,
  TextRun: new (options: Record<string, unknown>) => unknown,
): unknown {
  const props = (run as DocxTextRunLike).root?.[1] || {};
  return new TextRun({ ...props });
}
