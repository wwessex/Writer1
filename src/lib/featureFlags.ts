export function isIntegrationDeveloperModeEnabled(): boolean {
  return import.meta.env.VITE_INTEGRATIONS_DEVELOPER_MODE === 'true';
}

export function isAIDeveloperModeEnabled(): boolean {
  return import.meta.env.VITE_AI_DEVELOPER_MODE === 'true';
}

export function getBrokerBaseUrl(): string {
  return import.meta.env.VITE_BROKER_BASE_URL || '';
}

/**
 * Build a broker endpoint URL without duplicating "/api" when the
 * configured base already includes that segment.
 */
export function getBrokerEndpoint(path: string): string {
  const base = getBrokerBaseUrl().trim().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!base) return normalizedPath;

  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${base}${normalizedPath.slice('/api'.length)}`;
  }

  return `${base}${normalizedPath}`;
}
