import React from 'react';
import { Participant } from './usePresence';

interface Props {
  participants: Participant[];
}

const PresenceAvatars: React.FC<Props> = ({ participants }) => {
  if (participants.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {participants.slice(0, 5).map(p => (
        <div
          key={p.userId}
          title={p.userName}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: p.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            border: '2px solid var(--bg, #fff)',
            cursor: 'default',
            flexShrink: 0,
          }}
        >
          {p.userName.slice(0, 2).toUpperCase()}
        </div>
      ))}
      {participants.length > 5 && (
        <div style={{
          fontSize: '11px',
          color: 'var(--color-text-secondary, #666)',
          whiteSpace: 'nowrap',
        }}>
          +{participants.length - 5}
        </div>
      )}
    </div>
  );
};

export default PresenceAvatars;
