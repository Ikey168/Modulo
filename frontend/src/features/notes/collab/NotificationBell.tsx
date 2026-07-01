import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from './useNotifications';
import type { AppNotification } from './notificationApi';

interface Props {
  userId: string;
}

const NotificationBell: React.FC<Props> = ({ userId }) => {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications(userId);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative cursor-pointer rounded-md border-none bg-transparent p-1.5 text-xl leading-none text-subtle-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-[3px] text-[10px] leading-none text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[1000] flex max-h-[400px] w-80 animate-scale-in flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="cursor-pointer border-none bg-transparent text-xs text-indigo-400 transition-colors hover:text-primary"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={() => markRead(n.id)}
                  onRemove={() => remove(n.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ItemProps {
  notification: AppNotification;
  onRead: () => void;
  onRemove: () => void;
}

const NotificationItem: React.FC<ItemProps> = ({ notification: n, onRead, onRemove }) => {
  const typeIcon: Record<string, string> = {
    MENTION: '@',
    COMMENT: '💬',
    SHARE: '🔗',
    GRANT: '🔑',
  };

  return (
    <div
      className={`flex items-start gap-2.5 border-b border-border px-4 py-2.5 ${
        n.read ? 'bg-transparent' : 'bg-primary/10'
      }`}
    >
      <span className="mt-0.5 text-base leading-none">
        {typeIcon[n.type] ?? '🔔'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-snug text-foreground">{n.message}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {new Date(n.createdAt).toLocaleString()}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {!n.read && (
          <button
            onClick={onRead}
            title="Mark as read"
            className="cursor-pointer border-none bg-transparent text-base leading-none text-indigo-400 transition-colors hover:text-primary"
          >
            ✓
          </button>
        )}
        <button
          onClick={onRemove}
          title="Dismiss"
          className="cursor-pointer border-none bg-transparent text-base leading-none text-muted-foreground transition-colors hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default NotificationBell;
