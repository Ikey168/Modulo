import type { PackManifest } from './packManifest';

export interface PackEntry {
  id: number;
  packId: string;
  version: string;
  name: string;
  description?: string;
  status: string;
  manifest?: PackManifest;
  installedAt: string;
  updatedAt: string;
  ipfsCid?: string;
  contentHash?: string;
  source?: string;
  gatewayUrl?: string;
  anchorTx?: string;
  onchainId?: number;
  authorAddress?: string;
  premium?: boolean;
  accessPrice?: string;
  royaltyBps?: number;
}

export interface AnchorResult {
  ok: boolean;
  reason?: string;
  txHash?: string;
  onchainId?: number;
  authorAddress?: string;
  placeholder?: boolean;
}

export interface ProvenanceInfo {
  anchored: boolean;
  txHash?: string;
  onchainId?: number;
  authorAddress?: string;
  contentHash?: string;
  verified: boolean;
  placeholder: boolean;
}

export interface PackResult {
  ok: boolean;
  reason?: string;
}

export interface PublishResult {
  ok: boolean;
  reason?: string;
  cid?: string;
  contentHash?: string;
  gatewayUrl?: string;
}

const BASE = '/api/packs';

export async function installPack(manifest: PackManifest): Promise<PackResult> {
  const res = await fetch(`${BASE}/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest),
  });
  return res.json();
}

export async function installPackFromCid(
  cid: string,
  expectedHash?: string,
  buyerAddress?: string,
): Promise<PackResult> {
  const res = await fetch(`${BASE}/install-from-cid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid, expectedHash, buyerAddress }),
  });
  return res.json();
}

export async function anchorPack(packId: string): Promise<AnchorResult> {
  const res = await fetch(`${BASE}/${encodeURIComponent(packId)}/anchor`, { method: 'POST' });
  return res.json();
}

export async function getProvenance(packId: string): Promise<ProvenanceInfo | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(packId)}/provenance`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to get provenance');
  return res.json();
}

export async function setPackPricing(
  packId: string,
  premium: boolean,
  accessPrice?: string,
  royaltyBps = 0,
): Promise<PackResult> {
  const res = await fetch(`${BASE}/${encodeURIComponent(packId)}/pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ premium, accessPrice, royaltyBps }),
  });
  return res.json();
}

export async function checkEntitlement(packId: string, address?: string): Promise<boolean> {
  const qs = address ? `?address=${encodeURIComponent(address)}` : '';
  const res = await fetch(`${BASE}/${encodeURIComponent(packId)}/entitlement${qs}`);
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.entitled);
}

export async function publishPackToIpfs(packId: string): Promise<PublishResult> {
  const res = await fetch(`${BASE}/${encodeURIComponent(packId)}/publish`, { method: 'POST' });
  return res.json();
}

export async function uninstallPack(packId: string): Promise<PackResult> {
  const res = await fetch(`${BASE}/${encodeURIComponent(packId)}`, { method: 'DELETE' });
  return res.json();
}

export async function listPacks(): Promise<PackEntry[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Failed to list packs');
  return res.json();
}

export async function listPublishedPacks(): Promise<PackEntry[]> {
  const res = await fetch(`${BASE}/published`);
  if (!res.ok) throw new Error('Failed to list published packs');
  return res.json();
}

export async function getPack(packId: string): Promise<PackEntry | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(packId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to get pack');
  return res.json();
}
