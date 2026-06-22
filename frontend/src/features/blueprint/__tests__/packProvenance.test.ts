import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  anchorPack,
  getProvenance,
  setPackPricing,
  checkEntitlement,
  installPackFromCid,
} from '../pack/packService';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('anchorPack', () => {
  it('POSTs to the anchor endpoint and returns the result', async () => {
    fetchMock.mockReturnValue(jsonResponse({ ok: true, txHash: '0xabc', onchainId: 7, authorAddress: '0xAUTHOR', placeholder: false }));
    const result = await anchorPack('my.pack');
    expect(fetchMock).toHaveBeenCalledWith('/api/packs/my.pack/anchor', { method: 'POST' });
    expect(result.ok).toBe(true);
    expect(result.txHash).toBe('0xabc');
    expect(result.onchainId).toBe(7);
  });
});

describe('getProvenance', () => {
  it('returns provenance info', async () => {
    fetchMock.mockReturnValue(jsonResponse({ anchored: true, txHash: '0xabc', verified: true, placeholder: false }));
    const info = await getProvenance('my.pack');
    expect(info?.anchored).toBe(true);
    expect(info?.verified).toBe(true);
  });

  it('returns null on 404', async () => {
    fetchMock.mockReturnValue(jsonResponse(null, false, 404));
    const info = await getProvenance('missing');
    expect(info).toBeNull();
  });
});

describe('setPackPricing', () => {
  it('sends premium pricing payload', async () => {
    fetchMock.mockReturnValue(jsonResponse({ ok: true }));
    const result = await setPackPricing('my.pack', true, '1000000000000000000', 250);
    expect(result.ok).toBe(true);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/packs/my.pack/pricing');
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({
      premium: true,
      accessPrice: '1000000000000000000',
      royaltyBps: 250,
    });
  });

  it('defaults royaltyBps to 0', async () => {
    fetchMock.mockReturnValue(jsonResponse({ ok: true }));
    await setPackPricing('my.pack', false);
    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse((opts as RequestInit).body as string).royaltyBps).toBe(0);
  });
});

describe('checkEntitlement', () => {
  it('returns true when entitled', async () => {
    fetchMock.mockReturnValue(jsonResponse({ ok: true, entitled: true }));
    const entitled = await checkEntitlement('my.pack', '0xBUYER');
    expect(entitled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/packs/my.pack/entitlement?address=0xBUYER');
  });

  it('returns false when response not ok', async () => {
    fetchMock.mockReturnValue(jsonResponse(null, false, 404));
    expect(await checkEntitlement('missing', '0xBUYER')).toBe(false);
  });

  it('omits the address query when none provided', async () => {
    fetchMock.mockReturnValue(jsonResponse({ ok: true, entitled: false }));
    await checkEntitlement('my.pack');
    expect(fetchMock).toHaveBeenCalledWith('/api/packs/my.pack/entitlement');
  });
});

describe('installPackFromCid with buyer address', () => {
  it('includes buyerAddress in the body', async () => {
    fetchMock.mockReturnValue(jsonResponse({ ok: true }));
    await installPackFromCid('QmCid', 'hash123', '0xBUYER');
    const [, opts] = fetchMock.mock.calls[0];
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({
      cid: 'QmCid',
      expectedHash: 'hash123',
      buyerAddress: '0xBUYER',
    });
  });
});
