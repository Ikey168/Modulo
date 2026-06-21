// React hook for the recipient decryption flow (#241). Wraps openSharedNote
// with loading / ready / error state. The decrypted plaintext lives only in
// component state (memory) for rendering -- it is never written to storage.

import { useCallback, useEffect, useState } from 'react';
import { CiphertextStore } from './noteSharing';
import { SharedNoteError, SharedNoteSource, openSharedNote } from './receiveSharedNote';

export type SharedNoteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseSharedNoteResult {
  status: SharedNoteStatus;
  plaintext: string | null;
  error: SharedNoteError | null;
  reload: () => void;
}

/**
 * Load and decrypt a shared note for the connected recipient.
 *
 * Pass `null` for any input that isn't ready yet (e.g. before the wallet is
 * connected / the encryption key is derived); the hook stays `idle` until all
 * inputs are present.
 */
export function useSharedNote(
  noteId: string | number | null,
  recipientSecretKeyB64: string | null,
  source: SharedNoteSource | null,
  store: CiphertextStore | null,
): UseSharedNoteResult {
  const [status, setStatus] = useState<SharedNoteStatus>('idle');
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [error, setError] = useState<SharedNoteError | null>(null);

  const load = useCallback(async () => {
    if (noteId == null || !recipientSecretKeyB64 || !source || !store) {
      setStatus('idle');
      setPlaintext(null);
      setError(null);
      return;
    }
    setStatus('loading');
    setError(null);
    setPlaintext(null);
    try {
      const text = await openSharedNote(noteId, recipientSecretKeyB64, source, store);
      setPlaintext(text);
      setStatus('ready');
    } catch (e) {
      setError(
        e instanceof SharedNoteError
          ? e
          : new SharedNoteError('DECRYPT_FAILED', 'Unexpected error opening the shared note.', e),
      );
      setStatus('error');
    }
  }, [noteId, recipientSecretKeyB64, source, store]);

  useEffect(() => {
    load();
  }, [load]);

  return { status, plaintext, error, reload: load };
}
