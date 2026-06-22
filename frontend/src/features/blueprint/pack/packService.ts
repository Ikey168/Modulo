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

export async function installPackFromCid(cid: string, expectedHash?: string): Promise<PackResult> {
  const res = await fetch(`${BASE}/install-from-cid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cid, expectedHash }),
  });
  return res.json();
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
