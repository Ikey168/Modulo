import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { X } from 'lucide-react';
import { Button, Textarea } from '@/ui';
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
    <div className="flex flex-col gap-3 p-3">
      <h3 className="m-0 text-[15px] font-semibold text-foreground">Comments</h3>

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
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
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

      <form onSubmit={submitComment} className="relative">
        {replyTo !== null && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Replying to comment
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="flex cursor-pointer items-center border-none bg-transparent p-0 text-current transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={newContent}
          onChange={handleInput}
          placeholder="Add a comment… (@mention to notify)"
          rows={3}
          className="min-h-0 resize-none"
        />
        {filteredUsers.length > 0 && (
          <ul className="absolute inset-x-0 bottom-full z-[100] m-0 list-none rounded-md border border-border bg-popover py-1 shadow-md">
            {filteredUsers.map(u => (
              <li
                key={u.id}
                onClick={() => insertMention(u.name)}
                className="cursor-pointer px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-surface-2"
              >
                @{u.name}
              </li>
            ))}
          </ul>
        )}
        <Button
          type="submit"
          size="sm"
          className="mt-1.5"
          disabled={loading || !newContent.trim()}
          loading={loading}
        >
          {loading ? 'Sending…' : 'Comment'}
        </Button>
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
  <div
    className={`border-l-[3px] pl-2.5 ${comment.resolved ? 'border-border-strong opacity-60' : 'border-primary'}`}
  >
    <div className="flex items-start gap-2">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
        {(comment.authorName || '?').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-foreground">{comment.authorName}</span>
          <span className="text-[11px] text-muted-foreground">
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        </div>
        <p className="my-1 whitespace-pre-wrap break-words text-[13px] text-subtle-foreground">
          {comment.content}
        </p>
        <div className="flex gap-2 text-[11px]">
          <button
            onClick={onReply}
            className={`cursor-pointer rounded border-none p-0 text-indigo-400 transition-colors hover:text-primary ${
              isReplyTarget ? 'font-semibold' : ''
            }`}
          >
            Reply
          </button>
          {!comment.resolved && (
            <button
              onClick={onResolve}
              className="cursor-pointer border-none bg-transparent p-0 text-success transition-opacity hover:opacity-80"
            >
              Resolve
            </button>
          )}
          {comment.resolved && (
            <button
              onClick={onResolve}
              className="cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              Reopen
            </button>
          )}
          {comment.authorId === userId && (
            <button
              onClick={onDelete}
              className="cursor-pointer border-none bg-transparent p-0 text-destructive transition-opacity hover:opacity-80"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
    {replies.length > 0 && (
      <div className="ml-8 mt-2 flex flex-col gap-2">
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
