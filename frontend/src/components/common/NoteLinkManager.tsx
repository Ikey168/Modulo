import React, { useState, useEffect } from 'react';
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui';

/** Radix SelectItem forbids value=""; sentinel represents "no target selected". */
const NO_TARGET = '__none__';

interface NoteLink {
  id: string;
  sourceNote: {
    id: number;
    title: string;
  };
  targetNote: {
    id: number;
    title: string;
  };
  linkType: string;
}

interface Note {
  id: number;
  title: string;
}

interface NoteLinkManagerProps {
  currentNoteId: number;
  onLinksUpdated?: () => void;
}

const NoteLinkManager: React.FC<NoteLinkManagerProps> = ({ currentNoteId, onLinksUpdated }) => {
  const [outgoingLinks, setOutgoingLinks] = useState<NoteLink[]>([]);
  const [incomingLinks, setIncomingLinks] = useState<NoteLink[]>([]);
  const [availableNotes, setAvailableNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New link form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedTargetNoteId, setSelectedTargetNoteId] = useState<number | null>(null);
  const [linkType, setLinkType] = useState('RELATED');
  const [creating, setCreating] = useState(false);

  const LINK_TYPES = [
    { value: 'RELATED', label: 'Related' },
    { value: 'REFERENCES', label: 'References' },
    { value: 'DEPENDS_ON', label: 'Depends On' },
    { value: 'PART_OF', label: 'Part Of' },
    { value: 'CONTRADICTS', label: 'Contradicts' },
    { value: 'SUPPORTS', label: 'Supports' },
    { value: 'EXTENDS', label: 'Extends' },
    { value: 'EXAMPLE_OF', label: 'Example Of' }
  ];

  useEffect(() => {
    loadLinks();
    loadAvailableNotes();
  }, [currentNoteId]);

  const loadLinks = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load outgoing links
      const outgoingResponse = await fetch(`/api/note-links/note/${currentNoteId}/outgoing`);
      if (outgoingResponse.ok) {
        const outgoingData = await outgoingResponse.json();
        setOutgoingLinks(outgoingData || []);
      }

      // Load incoming links
      const incomingResponse = await fetch(`/api/note-links/note/${currentNoteId}/incoming`);
      if (incomingResponse.ok) {
        const incomingData = await incomingResponse.json();
        setIncomingLinks(incomingData || []);
      }
    } catch (err) {
      setError('Failed to load note links');
      console.error('Error loading links:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableNotes = async () => {
    try {
      const response = await fetch('/api/notes');
      if (response.ok) {
        const data = await response.json();
        // Filter out the current note
        const filteredNotes = data.filter((note: Note) => note.id !== currentNoteId);
        setAvailableNotes(filteredNotes || []);
      }
    } catch (err) {
      console.error('Error loading available notes:', err);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedTargetNoteId || !linkType) {
      setError('Please select a target note and link type');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch('/api/note-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNoteId: currentNoteId,
          targetNoteId: selectedTargetNoteId,
          linkType: linkType
        })
      });

      if (response.ok) {
        await loadLinks();
        setShowAddForm(false);
        setSelectedTargetNoteId(null);
        setLinkType('RELATED');
        onLinksUpdated?.();
      } else {
        throw new Error('Failed to create link');
      }
    } catch (err) {
      setError('Failed to create link');
      console.error('Error creating link:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) {
      return;
    }

    try {
      setError(null);
      const response = await fetch(`/api/note-links/${linkId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadLinks();
        onLinksUpdated?.();
      } else {
        throw new Error('Failed to delete link');
      }
    } catch (err) {
      setError('Failed to delete link');
      console.error('Error deleting link:', err);
    }
  };

  const getLinkTypeLabel = (type: string) => {
    const linkType = LINK_TYPES.find(lt => lt.value === type);
    return linkType ? linkType.label : type;
  };

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading links...</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Note Links</h3>
        <Button
          variant={showAddForm ? 'outline' : 'primary'}
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Link'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="mb-5 rounded-lg border border-border bg-surface-2 p-4 animate-fade-in">
          <h4 className="mb-3 text-sm font-semibold text-foreground">Create New Link</h4>
          <div className="mb-3 flex flex-col gap-1.5">
            <Label htmlFor="target-note-select">Target Note:</Label>
            <Select
              value={selectedTargetNoteId ? String(selectedTargetNoteId) : NO_TARGET}
              onValueChange={(val) => setSelectedTargetNoteId(val === NO_TARGET ? null : Number(val))}
            >
              <SelectTrigger id="target-note-select">
                <SelectValue placeholder="Select a note..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TARGET}>Select a note...</SelectItem>
                {availableNotes.map(note => (
                  <SelectItem key={note.id} value={String(note.id)}>
                    {note.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mb-4 flex flex-col gap-1.5">
            <Label htmlFor="link-type-select">Link Type:</Label>
            <Select value={linkType} onValueChange={setLinkType}>
              <SelectTrigger id="link-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateLink}
              loading={creating}
              disabled={creating || !selectedTargetNoteId}
            >
              {creating ? 'Creating...' : 'Create Link'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Outgoing Links */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-subtle-foreground">Links to Other Notes ({outgoingLinks.length})</h4>
          {outgoingLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outgoing links</p>
          ) : (
            <div className="flex flex-col gap-2">
              {outgoingLinks.map(link => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xxs font-medium text-primary">{getLinkTypeLabel(link.linkType)}</span>
                    <span className="truncate text-sm text-foreground">{link.targetNote.title}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteLink(link.id)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Incoming Links */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-subtle-foreground">Links from Other Notes ({incomingLinks.length})</h4>
          {incomingLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incoming links</p>
          ) : (
            <div className="flex flex-col gap-2">
              {incomingLinks.map(link => (
                <div
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm text-foreground">{link.sourceNote.title}</span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xxs font-medium text-primary">{getLinkTypeLabel(link.linkType)}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteLink(link.id)}
                  >
                    Remove
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
