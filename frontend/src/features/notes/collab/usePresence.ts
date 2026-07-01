import { useEffect, useRef, useState, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export interface Participant {
  userId: string;
  userName: string;
  color: string;
  cursorOffset?: number;
  selectionStart?: number;
  selectionEnd?: number;
  lastSeen: number;
}

export interface PresenceMessage {
  type: 'JOIN' | 'LEAVE' | 'HEARTBEAT' | 'CURSOR';
  userId: string;
  userName: string;
  color: string;
  noteId: number;
  cursorOffset?: number;
  selectionStart?: number;
  selectionEnd?: number;
  timestamp: string;
}

const USER_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const STALE_AFTER_MS = 35_000;

export function usePresence(noteId: number | undefined, userId: string, userName: string) {
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const clientRef = useRef<Client | null>(null);
  const color = colorForUser(userId);

  const publish = useCallback((msg: Partial<PresenceMessage>) => {
    const client = clientRef.current;
    if (!client?.connected || !noteId) return;
    client.publish({
      destination: `/app/notes/${noteId}/presence`,
      body: JSON.stringify({ ...msg, userId, userName, color, noteId }),
    });
  }, [noteId, userId, userName, color]);

  useEffect(() => {
    if (!noteId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      onConnect: () => {
        client.subscribe(`/topic/notes/${noteId}/presence`, (frame) => {
          const msg: PresenceMessage = JSON.parse(frame.body);
          if (msg.userId === userId) return;

          setParticipants(prev => {
            const next = new Map(prev);
            if (msg.type === 'LEAVE') {
              next.delete(msg.userId);
            } else {
              next.set(msg.userId, {
                userId: msg.userId,
                userName: msg.userName,
                color: msg.color,
                cursorOffset: msg.cursorOffset,
                selectionStart: msg.selectionStart,
                selectionEnd: msg.selectionEnd,
                lastSeen: Date.now(),
              });
            }
            return next;
          });
        });

        publish({ type: 'JOIN' });
      },
    });

    client.activate();
    clientRef.current = client;

    const heartbeat = setInterval(() => publish({ type: 'HEARTBEAT' }), HEARTBEAT_INTERVAL_MS);
    const prune = setInterval(() => {
      setParticipants(prev => {
        const next = new Map(prev);
        const cutoff = Date.now() - STALE_AFTER_MS;
        for (const [id, p] of next) {
          if (p.lastSeen < cutoff) next.delete(id);
        }
        return next;
      });
    }, STALE_AFTER_MS);

    return () => {
      clearInterval(heartbeat);
      clearInterval(prune);
      publish({ type: 'LEAVE' });
      client.deactivate();
    };
  }, [noteId, userId, publish]);

  const sendCursor = useCallback((offset: number, start: number, end: number) => {
    publish({ type: 'CURSOR', cursorOffset: offset, selectionStart: start, selectionEnd: end });
  }, [publish]);

  return { participants: Array.from(participants.values()), color, sendCursor };
}
