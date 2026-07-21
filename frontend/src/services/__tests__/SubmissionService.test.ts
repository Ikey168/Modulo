import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { submissionService, ImagePluginSubmissionRequest } from '../SubmissionService';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_DIGEST = `sha256:${'a1b2c3d4'.repeat(8)}`;

const imageRequest: ImagePluginSubmissionRequest = {
  pluginName: 'Graph Exporter',
  version: '1.0.0',
  description: 'Exports the knowledge graph',
  category: 'Integration',
  developerName: 'Acme',
  developerEmail: 'dev@acme.io',
  imageReference: 'ghcr.io/acme/plugin',
  imageDigest: VALID_DIGEST,
  requiredPermissions: ['notes.read', 'system.events.subscribe'],
};

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: () => Promise.resolve(body) }) as Response;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('submissionService.submitImagePlugin', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it('POSTs a JSON body to /api/plugins/submissions/image', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ submissionId: 'sub-1' }));

    await submissionService.submitImagePlugin(imageRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/plugins/submissions/image');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      pluginName: 'Graph Exporter',
      version: '1.0.0',
      developerEmail: 'dev@acme.io',
      imageReference: 'ghcr.io/acme/plugin',
      imageDigest: VALID_DIGEST,
      requiredPermissions: ['notes.read', 'system.events.subscribe'],
    });
  });

  it('returns the created submission on success', async () => {
    const created = { submissionId: 'sub-1', status: 'PENDING_REVIEW', imageReference: 'ghcr.io/acme/plugin' };
    fetchMock.mockResolvedValue(jsonResponse(created));

    const result = await submissionService.submitImagePlugin(imageRequest);

    expect(result.data).toEqual(created);
    expect(result.error).toBeUndefined();
  });

  it('surfaces the error payload and field errors on rejection', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: 'JAR submissions are no longer accepted; submit a container image',
          errors: { imageDigest: 'Digest is required' },
        },
        false,
        400,
      ),
    );

    const result = await submissionService.submitImagePlugin(imageRequest);

    expect(result.data).toBeUndefined();
    expect(result.error).toBe('JAR submissions are no longer accepted; submit a container image');
    expect(result.errors).toEqual({ imageDigest: 'Digest is required' });
  });

  it('returns a network error when fetch throws', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await submissionService.submitImagePlugin(imageRequest);

    expect(result).toEqual({ error: 'Network error occurred' });
  });
});
