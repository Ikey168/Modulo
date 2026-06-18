// Domain types for the workspace UI, shaped from the backend REST contract.

export interface WorkspaceTag {
  id: string; // UUID
  name: string;
}

// Mirrors the backend Note entity (only the fields the UI needs).
export interface WorkspaceNote {
  id: number;
  title: string;
  content: string;
  markdownContent?: string;
  tags?: WorkspaceTag[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  userId?: number;
  // On-chain / decentralized provenance
  isOnBlockchain?: boolean;
  isDecentralized?: boolean;
  blockchainTxHash?: string;
  ipfsCid?: string;
}

// A note-link as returned by /api/note-links. The embedded notes may be
// full objects or trimmed; we read defensively in the mapping helpers.
export interface WorkspaceLink {
  id: string; // UUID
  linkType: string;
  sourceNote?: { id: number; title?: string };
  targetNote?: { id: number; title?: string };
  // Some payloads flatten the ids:
  sourceNoteId?: number;
  targetNoteId?: number;
}

export interface NormalizedLink {
  id: string;
  linkType: string;
  sourceId: number;
  targetId: number;
}

export function normalizeLink(link: WorkspaceLink): NormalizedLink | null {
  const sourceId = link.sourceNote?.id ?? link.sourceNoteId;
  const targetId = link.targetNote?.id ?? link.targetNoteId;
  if (typeof sourceId !== 'number' || typeof targetId !== 'number') return null;
  return { id: link.id, linkType: link.linkType, sourceId, targetId };
}

export function isAnchored(note: WorkspaceNote): boolean {
  return Boolean(note.isOnBlockchain || note.isDecentralized);
}

export function anchorRef(note: WorkspaceNote): string | null {
  if (note.blockchainTxHash) return `tx: ${shortHash(note.blockchainTxHash)}`;
  if (note.ipfsCid) return `cid: ${shortHash(note.ipfsCid)}`;
  return null;
}

function shortHash(h: string): string {
  if (h.length <= 14) return h;
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

// Human-friendly relative time from an ISO timestamp.
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
