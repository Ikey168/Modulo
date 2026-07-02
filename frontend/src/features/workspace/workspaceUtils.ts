import type { CoreNote } from '@modulo/core';

/** A note counts as anchored once it is on-chain or pinned to IPFS. */
export function isAnchored(note: CoreNote): boolean {
  return Boolean(note.isOnBlockchain || note.isDecentralized);
}

/** Short on-chain reference (tx hash or IPFS CID) for display, if any. */
export function anchorRef(note: CoreNote): string | null {
  if (note.blockchainTxHash) return `tx: ${note.blockchainTxHash.slice(0, 8)}…`;
  if (note.ipfsCid) return `cid: ${note.ipfsCid.slice(0, 8)}…`;
  return null;
}

/** Compact relative timestamp: just now / 5m / 3h / 2d / 4w / 6mo / 1y ago. */
export function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}
