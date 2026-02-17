import type { Chapter, IntegrationConfig, IntegrationType } from '@/types';
import { getBrokerBaseUrl } from '@/lib/featureFlags';
import { IntegrationApiError } from './api';
import type { IntegrationOperationResult, NormalizedPullResult, ProviderPayload } from './types';

function toBrokerUrl(path: string): string {
  const base = getBrokerBaseUrl();
  return `${base}${path}`;
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function callBroker<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(toBrokerUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    const details = payload as { message?: string; error?: string; code?: string } | null;
    throw new IntegrationApiError(details?.message || details?.error || 'Broker request failed.', {
      code: (details?.code as IntegrationApiError['code']) || 'UNKNOWN',
      status: response.status,
    });
  }

  return payload as T;
}

export async function brokerConnect(
  provider: IntegrationType,
  config: IntegrationConfig
): Promise<IntegrationOperationResult> {
  return callBroker<IntegrationOperationResult>(`/api/integrations/${provider}/connect`, { config });
}

export async function brokerPush(
  provider: IntegrationType,
  config: IntegrationConfig,
  payload: ProviderPayload
): Promise<IntegrationOperationResult> {
  return callBroker<IntegrationOperationResult>(`/api/integrations/${provider}/push`, { config, payload });
}

export async function brokerPull(
  provider: IntegrationType,
  config: IntegrationConfig,
  payload: ProviderPayload,
  localChapters: Chapter[]
): Promise<NormalizedPullResult> {
  return callBroker<NormalizedPullResult>(`/api/integrations/${provider}/pull`, {
    config,
    payload,
    localChapters,
  });
}
