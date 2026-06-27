export interface ShareTokenInfo {
  id: number;
  noteId: number;
  token: string;
  ownerId: string;
  expiresAt: string | null;
  hasPassword: boolean;
  revoked: boolean;
  active: boolean;
  createdAt: string;
  shareUrl: string;
}

export interface CreateShareRequest {
  expiresInHours?: number;
  password?: string;
}

export const shareApi = {
  async create(noteId: number, req: CreateShareRequest, userId: string): Promise<ShareTokenInfo> {
    const res = await fetch(`/api/notes/${noteId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error('Failed to create share link');
    return res.json();
  },

  async list(noteId: number, userId: string): Promise<ShareTokenInfo[]> {
    const res = await fetch(`/api/notes/${noteId}/shares`, {
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) throw new Error('Failed to list share links');
    return res.json();
  },

  async revoke(tokenId: number, userId: string): Promise<void> {
    await fetch(`/api/shares/${tokenId}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    });
  },

  publicUrl(token: string): string {
    return `${window.location.origin}/api/s/${token}`;
  },
};
