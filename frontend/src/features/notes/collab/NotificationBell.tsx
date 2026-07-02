import React from 'react';
import { AtSign, Bell, Check, KeyRound, Link2, MessageSquare, X, type LucideIcon } from 'lucide-react';
import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea, cn } from '@/ui';
import { useNotifications } from './useNotifications';
import type { AppNotification } from './notificationApi';

interface Props {
  userId: string;
}

const NotificationBell: React.FC<Props> = ({ userId }) => {
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications(userId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-subtle-foreground hover:text-foreground"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-[3px] text-[10px] font-semibold leading-none text-destructive-foreground"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={6} className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="link" size="sm" className="h-auto text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
            <p className="m-0 text-[13px] text-muted-foreground">You're all caught up</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] [&>[data-radix-scroll-area-viewport]]:max-h-[360px]">
            <div className="flex flex-col">
              {notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={() => markRead(n.id)}
                  onRemove={() => remove(n.id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
};

interface ItemProps {
  notification: AppNotification;
  onRead: () => void;
  onRemove: () => void;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  MENTION: AtSign,
  COMMENT: MessageSquare,
  SHARE: Link2,
  GRANT: KeyRound,
};

const NotificationItem: React.FC<ItemProps> = ({ notification: n, onRead, onRemove }) => {
  const Icon = TYPE_ICONS[n.type] ?? Bell;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 border-b border-border px-4 py-2.5 last:border-b-0',
        n.read ? 'bg-transparent' : 'bg-primary/10',
      )}
    >
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-snug text-foreground">{n.message}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          {new Date(n.createdAt).toLocaleString()}
        </div>
      </div>
      <div className="flex shrink-0 gap-0.5">
        {!n.read && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRead}
            aria-label="Mark as read"
            title="Mark as read"
            className="text-primary-hover hover:text-primary-hover"
          >
            <Check />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <X />
        </Button>
      </div>
    </div>
  );
};

export default NotificationBell;
