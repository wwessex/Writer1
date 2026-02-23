import type { Chapter, IntegrationConfig, IntegrationType } from '@/types';
import { getBrokerBaseUrl } from '@/lib/featureFlags';
import { IntegrationApiError } from './api';
import { fetchEnvelope } from './providerClient';
import type { IntegrationOperationResult, NormalizedPullResult, ProviderPayload } from './types';

function toBrokerUrl(path: string): string {
  const base = getBrokerBaseUrl();
  return `${base}${path}`;
}

async function callBroker<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const envelope = await fetchEnvelope<T>(toBrokerUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!envelope.ok) {
    throw new IntegrationApiError(envelope.error.message, {
      code: envelope.error.code,
      status: envelope.error.status,
    });
  }

  return envelope.data;
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
