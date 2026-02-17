export function isIntegrationDeveloperModeEnabled(): boolean {
  return import.meta.env.VITE_INTEGRATIONS_DEVELOPER_MODE === 'true';
}

export function isAIDeveloperModeEnabled(): boolean {
  return import.meta.env.VITE_AI_DEVELOPER_MODE === 'true';
}

export function getBrokerBaseUrl(): string {
  return import.meta.env.VITE_BROKER_BASE_URL || '';
}
