import { useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

function uint8ToBase64(arr: Uint8Array): string {
  return btoa(Array.from(arr, b => String.fromCharCode(b)).join(''));
}

function base64ToUint8(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

interface YjsEditorOptions {
  noteId: number;
  userId: string;
  initialContent: string;
  onContentChange: (text: string) => void;
}

export function useYjsEditor({ noteId, userId, initialContent, onContentChange }: YjsEditorOptions) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const clientRef = useRef<Client | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const ytext = ydoc.getText('content');

    // Seed local doc with the persisted content
    if (initialContent && !initialized.current) {
      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, initialContent);
      }, 'init');
      initialized.current = true;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      onConnect: () => {
        client.subscribe(`/topic/notes/${noteId}/ydoc`, (frame) => {
          const msg = JSON.parse(frame.body);
          if (msg.userId === userId || !msg.update) return;
          try {
            const update = base64ToUint8(msg.update);
            Y.applyUpdate(ydoc, update);
          } catch (e) {
            console.error('Failed to apply ydoc update', e);
          }
        });
      },
    });

    client.activate();
    clientRef.current = client;

    // Broadcast any local changes
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'init') return;
      onContentChange(ytext.toString());
      if (client.connected) {
        client.publish({
          destination: `/app/notes/${noteId}/ydoc`,
          body: JSON.stringify({
            type: 'UPDATE',
            noteId,
            userId,
            update: uint8ToBase64(update),
          }),
        });
      }
    });

    return () => {
      client.deactivate();
      ydoc.destroy();
      initialized.current = false;
    };
  }, [noteId, userId]);

  const applyTextChange = useCallback((newText: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const ytext = ydoc.getText('content');
    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newText);
    });
  }, []);

  const getText = useCallback(() => {
    return ydocRef.current?.getText('content').toString() ?? '';
  }, []);

  return { applyTextChange, getText };
}
