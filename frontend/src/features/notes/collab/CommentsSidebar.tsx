import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { NoteComment, commentsApi } from './commentsApi';

interface Props {
  noteId: number;
  userId: string;
  userName: string;
  users?: { id: string; name: string }[];
}

const CommentsSidebar: React.FC<Props> = ({ noteId, userId, userName, users = [] }) => {
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [newContent, setNewContent] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async () => {
    try {
      const data = await commentsApi.list(noteId);
      setComments(data);
    } catch {
      // ignore
    }
  }, [noteId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      onConnect: () => {
        client.subscribe(`/topic/notes/${noteId}/comments`, (frame) => {
          const msg = JSON.parse(frame.body);
          if (msg.deleted) {
            setComments(prev => prev.filter(c => c.id !== msg.id));
          } else {
            setComments(prev => {
              const idx = prev.findIndex(c => c.id === msg.id);
              return idx >= 0 ? prev.map(c => c.id === msg.id ? msg : c) : [...prev, msg];
            });
          }
        });
      },
    });
    client.activate();
    return () => { client.deactivate(); };
  }, [noteId]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewContent(val);
    const mentionMatch = val.match(/@(\w*)$/);
    setMentionQuery(mentionMatch ? mentionMatch[1] : null);
  };

  const insertMention = (name: string) => {
    const val = newContent.replace(/@\w*$/, `@${name} `);
    setNewContent(val);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    setLoading(true);
    try {
      await commentsApi.create(noteId, {
        content: newContent.trim(),
        parentId: replyTo ?? undefined,
      }, userId, userName);
      setNewContent('');
      setReplyTo(null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (c: NoteComment) => {
    try {
      const updated = await commentsApi.resolve(noteId, c.id, userId);
      setComments(prev => prev.map(x => x.id === updated.id ? updated : x));
    } catch {
      // ignore
    }
  };

  const handleDelete = async (c: NoteComment) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await commentsApi.delete(noteId, c.id, userId);
      setComments(prev => prev.filter(x => x.id !== c.id));
    } catch {
      // ignore
    }
  };

  const roots = comments.filter(c => !c.parentId && !c.resolved);
  const resolved = comments.filter(c => c.resolved);
  const replies = (parentId: number) => comments.filter(c => c.parentId === parentId);

  const filteredUsers = mentionQuery !== null
    ? users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Comments</h3>

      {roots.map(c => (
        <CommentThread
          key={c.id}
          comment={c}
          replies={replies(c.id)}
          userId={userId}
          onReply={() => setReplyTo(c.id)}
          onResolve={() => handleResolve(c)}
          onDelete={() => handleDelete(c)}
          isReplyTarget={replyTo === c.id}
        />
      ))}

      {resolved.length > 0 && (
        <details style={{ fontSize: '12px', color: 'var(--color-text-secondary, #6b7280)' }}>
          <summary style={{ cursor: 'pointer' }}>
            {resolved.length} resolved comment{resolved.length > 1 ? 's' : ''}
          </summary>
          {resolved.map(c => (
            <CommentThread
              key={c.id}
              comment={c}
              replies={replies(c.id)}
              userId={userId}
              onReply={() => {}}
              onResolve={() => handleResolve(c)}
              onDelete={() => handleDelete(c)}
              isReplyTarget={false}
            />
          ))}
        </details>
      )}

      <form onSubmit={submitComment} style={{ position: 'relative' }}>
        {replyTo !== null && (
          <div style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary, #6b7280)',
            marginBottom: '4px',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
          }}>
            Replying to comment
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
            >
              ×
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={newContent}
          onChange={handleInput}
          placeholder="Add a comment… (@mention to notify)"
          rows={3}
          style={{
            width: '100%',
            resize: 'none',
            padding: '8px',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: '6px',
            fontFamily: 'inherit',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
        {filteredUsers.length > 0 && (
          <ul style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: '6px',
            margin: 0,
            padding: '4px 0',
            listStyle: 'none',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,.1)',
          }}>
            {filteredUsers.map(u => (
              <li
                key={u.id}
                onClick={() => insertMention(u.name)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-raised, #f3f4f6)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                @{u.name}
              </li>
            ))}
          </ul>
        )}
        <button
          type="submit"
          disabled={loading || !newContent.trim()}
          style={{
            marginTop: '6px',
            padding: '6px 14px',
            background: 'var(--color-primary, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            opacity: loading || !newContent.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Sending…' : 'Comment'}
        </button>
      </form>
    </div>
  );
};

interface ThreadProps {
  comment: NoteComment;
  replies: NoteComment[];
  userId: string;
  onReply: () => void;
  onResolve: () => void;
  onDelete: () => void;
  isReplyTarget: boolean;
}

const CommentThread: React.FC<ThreadProps> = ({
  comment, replies, userId, onReply, onResolve, onDelete, isReplyTarget,
}) => (
  <div style={{
    borderLeft: `3px solid ${comment.resolved ? '#e5e7eb' : 'var(--color-primary, #3b82f6)'}`,
    paddingLeft: '10px',
    opacity: comment.resolved ? 0.6 : 1,
  }}>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <div style={{
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: 'var(--color-primary, #3b82f6)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: 700,
        flexShrink: 0,
      }}>
        {(comment.authorName || '?').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{comment.authorName}</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary, #6b7280)' }}>
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        </div>
        <p style={{ margin: '4px 0', fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {comment.content}
        </p>
        <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
          <button
            onClick={onReply}
            style={{
              background: isReplyTarget ? 'var(--color-primary-subtle, #eff6ff)' : 'none',
              border: 'none', cursor: 'pointer', color: 'var(--color-primary, #3b82f6)', padding: 0,
            }}
          >
            Reply
          </button>
          {!comment.resolved && (
            <button
              onClick={onResolve}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e', padding: 0 }}
            >
              Resolve
            </button>
          )}
          {comment.resolved && (
            <button
              onClick={onResolve}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary, #6b7280)', padding: 0 }}
            >
              Reopen
            </button>
          )}
          {comment.authorId === userId && (
            <button
              onClick={onDelete}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0 }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
    {replies.length > 0 && (
      <div style={{ marginLeft: '32px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {replies.map(r => (
          <CommentThread
            key={r.id}
            comment={r}
            replies={[]}
            userId={userId}
            onReply={onReply}
            onResolve={onResolve}
            onDelete={onDelete}
            isReplyTarget={false}
          />
        ))}
      </div>
    )}
  </div>
);

export default CommentsSidebar;
