export function createRemoteRevisionLabel(prefix: string): string {
  return `${prefix}-${new Date().toISOString()}`;
}
