const BASE = '/api/notes';

export interface NoteComment {
  id: number;
  noteId: number;
  parentId?: number;
  authorId: string;
  authorName: string;
  content: string;
  anchorStart?: number;
  anchorEnd?: number;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
  mentionedUserIds: string[];
}

export interface CreateCommentRequest {
  content: string;
  parentId?: number;
  anchorStart?: number;
  anchorEnd?: number;
}

async function getHeaders(userId: string, userName: string) {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
    'X-User-Name': userName,
  };
}

export const commentsApi = {
  async list(noteId: number): Promise<NoteComment[]> {
    const res = await fetch(`${BASE}/${noteId}/comments`);
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json();
  },

  async create(noteId: number, req: CreateCommentRequest, userId: string, userName: string): Promise<NoteComment> {
    const res = await fetch(`${BASE}/${noteId}/comments`, {
      method: 'POST',
      headers: await getHeaders(userId, userName),
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error('Failed to create comment');
    return res.json();
  },

  async resolve(noteId: number, commentId: number, userId: string): Promise<NoteComment> {
    const res = await fetch(`${BASE}/${noteId}/comments/${commentId}/resolve`, {
      method: 'PATCH',
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) throw new Error('Failed to resolve comment');
    return res.json();
  },

  async delete(noteId: number, commentId: number, userId: string): Promise<void> {
    const res = await fetch(`${BASE}/${noteId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) throw new Error('Failed to delete comment');
  },
};
