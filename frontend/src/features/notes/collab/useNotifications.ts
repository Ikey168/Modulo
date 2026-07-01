import { useState, useEffect, useCallback, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { AppNotification, notificationApi } from './notificationApi';

export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const clientRef = useRef<Client | null>(null);

  const reload = useCallback(async () => {
    if (!userId || userId === 'anonymous') return;
    try {
      const [feed, count] = await Promise.all([
        notificationApi.feed(userId),
        notificationApi.unreadCount(userId),
      ]);
      setNotifications(feed);
      setUnreadCount(count);
    } catch {
      // silently fail
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!userId || userId === 'anonymous') return;

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      onConnect: () => {
        client.subscribe(`/topic/users/${userId}/notifications`, (frame) => {
          const notif: AppNotification = JSON.parse(frame.body);
          setNotifications(prev => [notif, ...prev]);
          setUnreadCount(prev => prev + (notif.read ? 0 : 1));
        });
      },
    });

    client.activate();
    clientRef.current = client;

    return () => { client.deactivate(); };
  }, [userId]);

  const markRead = useCallback(async (id: number) => {
    const updated = await notificationApi.markRead(id, userId);
    setNotifications(prev => prev.map(n => n.id === id ? updated : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [userId]);

  const markAllRead = useCallback(async () => {
    await notificationApi.markAllRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [userId]);

  const remove = useCallback(async (id: number) => {
    await notificationApi.delete(id, userId);
    setNotifications(prev => {
      const removed = prev.find(n => n.id === id);
      if (removed && !removed.read) setUnreadCount(c => Math.max(0, c - 1));
      return prev.filter(n => n.id !== id);
    });
  }, [userId]);

  return { notifications, unreadCount, markRead, markAllRead, remove, reload };
}
