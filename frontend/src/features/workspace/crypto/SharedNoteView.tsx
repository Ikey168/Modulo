// Presentational "shared with me" surface (#241). Renders the loading / empty
// / error / content states from useSharedNote. Data fetching is the hook's job;
// this component is pure presentation so the states are easy to reason about.

import React from 'react';
import { SharedNoteErrorCode } from './receiveSharedNote';
import { UseSharedNoteResult } from './useSharedNote';

const ERROR_MESSAGES: Record<SharedNoteErrorCode, string> = {
  NO_ACCESS: 'You do not have access to this note, or it was revoked.',
  IPFS_UNAVAILABLE: 'The encrypted note is currently unavailable. Please try again later.',
  DECRYPT_FAILED: 'This note could not be decrypted on this account.',
};

export const SharedNoteView: React.FC<{ state: UseSharedNoteResult }> = ({ state }) => {
  const { status, plaintext, error, reload } = state;

  if (status === 'idle') {
    return (
      <p className="shared-note shared-note--empty">
        Connect your wallet to read notes shared with you.
      </p>
    );
  }

  if (status === 'loading') {
    return <p className="shared-note shared-note--loading">Decrypting…</p>;
  }

  if (status === 'error') {
    const message = error ? ERROR_MESSAGES[error.code] ?? error.message : 'Something went wrong.';
    // Revocation / no-access isn't retryable; transient failures are.
    const retryable = error?.code !== 'NO_ACCESS';
    return (
      <div className="shared-note shared-note--error" role="alert">
        <p>{message}</p>
        {retryable && (
          <button type="button" onClick={reload}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return <article className="shared-note shared-note--content">{plaintext}</article>;
};

export default SharedNoteView;
