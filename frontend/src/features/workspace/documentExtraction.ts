import { authenticatedRequest } from '../../services/authenticatedRequest';
export async function extractDocument(file: Blob, name: string): Promise<{ text: string; checksum: string }> {
  const form = new FormData(); form.set('file', file, name);
  const response = await authenticatedRequest('/api/knowledge/extract', { method: 'POST', body: form });
  if (!response.ok) { const error = await response.json().catch(() => ({})) as { message?: string }; throw new Error(error.message || `Text extraction failed (${response.status}).`); }
  return response.json() as Promise<{ text: string; checksum: string }>;
}
