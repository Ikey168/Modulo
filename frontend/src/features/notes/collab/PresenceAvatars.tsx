import React from 'react';
import { Participant } from './usePresence';

interface Props {
  participants: Participant[];
}

const PresenceAvatars: React.FC<Props> = ({ participants }) => {
  if (participants.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {participants.slice(0, 5).map(p => (
        <div
          key={p.userId}
          title={p.userName}
          className="flex size-7 shrink-0 cursor-default items-center justify-center rounded-full border-2 border-background text-[11px] font-bold uppercase text-white"
          style={{ background: p.color }}
        >
          {p.userName.slice(0, 2).toUpperCase()}
        </div>
      ))}
      {participants.length > 5 && (
        <div className="whitespace-nowrap text-[11px] text-muted-foreground">
          +{participants.length - 5}
        </div>
      )}
    </div>
  );
};

export default PresenceAvatars;
