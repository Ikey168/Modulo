import { authenticatedRequest } from '@/services/authenticatedRequest';
async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await authenticatedRequest(`/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error(response.status === 409 ? 'Changed elsewhere; reload before retrying.' : `Research request failed (${response.status}).`);
  return response.json() as Promise<T>;
}
export const apiClient = {
  get: <T>(path: string) => request<T>(path, 'GET'),
  put: <T>(path: string, body: unknown) => request<T>(path, 'PUT', body),
  post: <T>(path: string, body: unknown) => request<T>(path, 'POST', body),
};
