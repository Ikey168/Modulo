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
    <div style={{ position: 'relative' }}>
      {participants.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          borderBottom: '1px solid var(--color-border, #e5e7eb)',
          background: 'var(--color-surface-raised, #f9fafb)',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)' }}>
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
        style={{
          width: '100%',
          minHeight: '300px',
          padding: '12px',
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          background: 'transparent',
          color: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
};

export default CollabEditor;
