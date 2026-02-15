export async function simulateLatency(ms = 450): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRemoteRevisionLabel(prefix: string): string {
  return `${prefix}-${new Date().toISOString()}`;
}
