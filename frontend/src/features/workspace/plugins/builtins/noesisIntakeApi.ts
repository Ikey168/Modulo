import { authenticatedRequest } from '@/services/authenticatedRequest';

export type IntakeResult = Record<string, unknown>;
export type IntakeReadiness = { source_mode: string; enabled_feed_subscription_count: number;
  modes: { mode: string; native_start_possible: boolean;
    complete_journey_ready: boolean; blockers: string[] }[] };

export async function intakeCall<T extends IntakeResult>(tool: string, args: Record<string, unknown>): Promise<T> {
  const response = await authenticatedRequest('/api/integrations/noesis/intake/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, arguments: args }),
  });
  const result = await response.json() as T & { error?: { code?: string; message?: string }; code?: string };
  if (!response.ok || result.error) {
    throw new Error(result.error?.message ?? result.error?.code ?? result.code ?? `Noesis request failed (${response.status})`);
  }
  return result;
}

export async function intakePreflight(namespace = 'research'): Promise<{ available: boolean; reason?: string;
  discovery?: IntakeResult; readiness?: IntakeReadiness }> {
  const response = await authenticatedRequest(`/api/integrations/noesis/intake/preflight?namespace=${encodeURIComponent(namespace)}`);
  if (!response.ok) throw new Error(`Noesis preflight failed (${response.status})`);
  return response.json();
}
