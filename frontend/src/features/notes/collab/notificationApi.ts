import { authenticatedRequest } from '../../../services/authenticatedRequest';
export interface AppNotification {
  id: number;
  userId: string;
  type: string;
  message: string;
  noteId?: number;
  commentId?: number;
  approvalRequestId?: string;
  read: boolean;
  createdAt: string;
}

export const notificationApi = {
  async feed(userId: string): Promise<AppNotification[]> {
    const res = await authenticatedRequest('/api/notifications', {
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  async unreadCount(userId: string): Promise<number> {
    const res = await authenticatedRequest('/api/notifications/unread-count', {
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  },

  async markRead(id: number, userId: string): Promise<AppNotification> {
    const res = await authenticatedRequest(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'X-User-Id': userId },
    });
    if (!res.ok) throw new Error('Failed to mark as read');
    return res.json();
  },

  async markAllRead(userId: string): Promise<void> {
    await authenticatedRequest('/api/notifications/read-all', {
      method: 'POST',
      headers: { 'X-User-Id': userId },
    });
  },

  async delete(id: number, userId: string): Promise<void> {
    await authenticatedRequest(`/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    });
  },
};
