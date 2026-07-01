import React, { useRef, useEffect } from 'react';
import { useYjsEditor } from './useYjsEditor';
import { usePresence } from './usePresence';
import PresenceAvatars from './PresenceAvatars';

interface Props {
  noteId: number;
  userId: string;
  userName: string;
  initialContent: string;
  onContentChange: (text: string) => void;
  readOnly?: boolean;
}

const CollabEditor: React.FC<Props> = ({
  noteId, userId, userName, initialContent, onContentChange, readOnly = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { participants, sendCursor } = usePresence(noteId, userId, userName);
  const { applyTextChange } = useYjsEditor({
    noteId,
    userId,
    initialContent,
    onContentChange: (text) => {
      if (textareaRef.current && textareaRef.current.value !== text) {
        const selStart = textareaRef.current.selectionStart;
        const selEnd = textareaRef.current.selectionEnd;
        textareaRef.current.value = text;
        textareaRef.current.setSelectionRange(selStart, selEnd);
      }
      onContentChange(text);
    },
  });

  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== initialContent) {
      textareaRef.current.value = initialContent;
    }
  }, [initialContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    applyTextChange(e.target.value);
    onContentChange(e.target.value);
  };

  const handleSelect = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    sendCursor(ta.selectionStart, ta.selectionStart, ta.selectionEnd);
  };

  return (
    <div className="relative">
      {participants.length > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-2 py-1.5">
          <span className="text-xs text-muted-foreground">
            Also editing:
          </span>
          <PresenceAvatars participants={participants} />
        </div>
      )}
      <textarea
        ref={textareaRef}
        defaultValue={initialContent}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyUp={handleSelect}
        readOnly={readOnly}
        className="box-border min-h-[300px] w-full resize-y border-none bg-transparent p-3 font-[inherit] text-[length:inherit] text-foreground caret-primary outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
};

export default CollabEditor;
