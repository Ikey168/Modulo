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
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          color: 'inherit',
          fontSize: '20px',
          lineHeight: 1,
        }}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            background: '#ef4444',
            color: '#fff',
            borderRadius: '9999px',
            fontSize: '10px',
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          width: '320px',
          background: 'var(--color-surface, #fff)',
          border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          zIndex: 1000,
          maxHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border, #e5e7eb)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-primary, #3b82f6)',
                  fontSize: '12px',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary, #6b7280)', fontSize: '13px' }}>
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
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border, #e5e7eb)',
        background: n.read ? 'transparent' : 'var(--color-primary-subtle, #eff6ff)',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '16px', lineHeight: 1, marginTop: '2px' }}>
        {typeIcon[n.type] ?? '🔔'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', lineHeight: '1.4' }}>{n.message}</div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)', marginTop: '2px' }}>
          {new Date(n.createdAt).toLocaleString()}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {!n.read && (
          <button
            onClick={onRead}
            title="Mark as read"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary, #3b82f6)', fontSize: '16px', lineHeight: 1 }}
          >
            ✓
          </button>
        )}
        <button
          onClick={onRemove}
          title="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary, #6b7280)', fontSize: '16px', lineHeight: 1 }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default NotificationBell;
