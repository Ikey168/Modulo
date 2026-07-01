import React, { useState, useEffect, useMemo } from 'react';
import { createCoreAPI } from '@modulo/core';
import type { CoreLink } from '@modulo/core';
import { Button, Label, Select, Badge } from '@/ui';

const LINK_TYPES = [
  'RELATED',
  'REFERENCES',
  'DEPENDS_ON',
  'PART_OF',
  'CONTRADICTS',
  'SUPPORTS',
  'EXTENDS',
  'EXAMPLE_OF',
];

interface NoteLinkManagerProps {
  noteId: number;
  /** Minimal note shape — only id and title are required for display. */
  allNotes: Array<{ id: number; title: string }>;
  onLinksChanged?: () => void;
}

const NoteLinkManager: React.FC<NoteLinkManagerProps> = ({
  noteId,
  allNotes,
  onLinksChanged,
}) => {
  const api = useMemo(() => createCoreAPI(), []);

  const [outgoingLinks, setOutgoingLinks] = useState<CoreLink[]>([]);
  const [incomingLinks, setIncomingLinks] = useState<CoreLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [selectedTargetNoteId, setSelectedTargetNoteId] = useState<string>('');
  const [selectedLinkType, setSelectedLinkType] = useState<string>('RELATED');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const loadLinks = async () => {
    try {
      setLoading(true);
      setError(null);
      const [outgoing, incoming] = await Promise.all([
        api.outgoingLinks(noteId),
        api.incomingLinks(noteId),
      ]);
      setOutgoingLinks(outgoing);
      setIncomingLinks(incoming);
    } catch (err) {
      setError('Failed to load note links');
      console.error('Error loading note links:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedTargetNoteId || selectedTargetNoteId === String(noteId)) {
      setError('Please select a valid target note');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      // createLink emits link.created on the CoreEventBus automatically.
      await api.createLink(noteId, parseInt(selectedTargetNoteId), selectedLinkType);
      setSelectedTargetNoteId('');
      setSelectedLinkType('RELATED');
      setShowAddForm(false);
      await loadLinks();
      onLinksChanged?.();
    } catch (err) {
      setError('Failed to create note link');
      console.error('Error creating note link:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) return;
    try {
      setError(null);
      // removeLink emits link.removed on the CoreEventBus automatically.
      await api.removeLink(linkId);
      await loadLinks();
      onLinksChanged?.();
    } catch (err) {
      setError('Failed to delete note link');
      console.error('Error deleting note link:', err);
    }
  };

  const noteTitle = (id: number) =>
    allNotes.find((n) => n.id === id)?.title ?? '(unknown)';

  const availableTargetNotes = allNotes.filter(
    (n) =>
      n.id !== noteId &&
      !outgoingLinks.some((l) => l.targetNoteId === n.id),
  );

  if (loading) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-surface p-4">
        <div className="py-4 text-center text-[13px] text-muted-foreground">
          Loading note links...
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-foreground">Note Links</h3>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          variant="secondary"
          size="sm"
          disabled={availableTargetNotes.length === 0}
        >
          {showAddForm ? 'Cancel' : 'Add Link'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/15 px-3 py-2.5 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="mb-4 rounded-lg border border-border-strong bg-surface-2 p-4">
          <h4 className="mb-4 text-sm font-semibold text-foreground">Create New Link</h4>

          <div className="mb-4 flex flex-col gap-2">
            <Label htmlFor="target-note">Target Note</Label>
            <Select
              id="target-note"
              value={selectedTargetNoteId}
              onChange={(e) => setSelectedTargetNoteId(e.target.value)}
            >
              <option value="">Select a note...</option>
              {availableTargetNotes.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="mb-4 flex flex-col gap-2">
            <Label htmlFor="link-type">Link Type</Label>
            <Select
              id="link-type"
              value={selectedLinkType}
              onChange={(e) => setSelectedLinkType(e.target.value)}
            >
              {LINK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCreateLink}
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={submitting || !selectedTargetNoteId}
            >
              {submitting ? 'Creating...' : 'Create Link'}
            </Button>
            <Button
              onClick={() => setShowAddForm(false)}
              variant="secondary"
              size="sm"
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* Outgoing Links */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            Outgoing Links ({outgoingLinks.length})
          </h4>
          {outgoingLinks.length === 0 ? (
            <p className="m-0 text-[13px] italic text-muted-foreground">No outgoing links</p>
          ) : (
            <div className="flex flex-col gap-2">
              {outgoingLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-1">
                    <Badge variant="secondary" className="w-fit uppercase">
                      {link.linkType.replace(/_/g, ' ')}
                    </Badge>
                    <div className="text-[13px] font-medium text-foreground">
                      {noteTitle(link.targetNoteId)}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDeleteLink(link.id)}
                    variant="destructive"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Links */}
        <div>
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            Incoming Links ({incomingLinks.length})
          </h4>
          {incomingLinks.length === 0 ? (
            <p className="m-0 text-[13px] italic text-muted-foreground">No incoming links</p>
          ) : (
            <div className="flex flex-col gap-2">
              {incomingLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2.5"
                >
                  <div className="flex flex-col gap-1">
                    <Badge variant="secondary" className="w-fit uppercase">
                      {link.linkType.replace(/_/g, ' ')}
                    </Badge>
                    <div className="text-[13px] font-medium text-success">
                      ← {noteTitle(link.sourceNoteId)}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDeleteLink(link.id)}
                    variant="destructive"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteLinkManager;
