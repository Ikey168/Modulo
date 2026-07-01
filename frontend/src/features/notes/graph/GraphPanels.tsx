import React, { useState, useCallback } from 'react';
import { Tabs } from '@/ui';
import BacklinksPanel from './BacklinksPanel';
import UnlinkedMentionsPanel from './UnlinkedMentionsPanel';
import RelatedNotesPanel from './RelatedNotesPanel';
import LocalGraphPanel from './LocalGraphPanel';
import './graphPanels.css';

interface Props {
  noteId: number;
  /** Open another note by id (click-to-navigate from any panel). */
  onOpenNote: (noteId: number) => void;
}

type Tab = 'backlinks' | 'mentions' | 'related' | 'localGraph';

const TABS: { key: Tab; label: string }[] = [
  { key: 'backlinks', label: 'Backlinks' },
  { key: 'mentions', label: 'Unlinked Mentions' },
  { key: 'related', label: 'Related' },
  { key: 'localGraph', label: 'Local Graph' },
];

/**
 * Knowledge-graph sidebar for the open note, combining backlinks (#251),
 * unlinked mentions (#252), related notes (#253) and the local subgraph (#254).
 */
const GraphPanels: React.FC<Props> = ({ noteId, onOpenNote }) => {
  const [active, setActive] = useState<Tab>('backlinks');
  // Bumped when a link is created so backlinks/related/local-graph re-fetch.
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLinked = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="mt-6 border-t border-border pt-4">
      <Tabs
        className="mb-3 flex-wrap"
        items={TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
        value={active}
        onChange={(v) => setActive(v as Tab)}
      />

      <div className="min-h-[80px]">
        {active === 'backlinks' && (
          <BacklinksPanel noteId={noteId} onOpenNote={onOpenNote} refreshKey={refreshKey} />
        )}
        {active === 'mentions' && (
          <UnlinkedMentionsPanel
            noteId={noteId}
            onOpenNote={onOpenNote}
            onLinked={handleLinked}
            refreshKey={refreshKey}
          />
        )}
        {active === 'related' && (
          <RelatedNotesPanel noteId={noteId} onOpenNote={onOpenNote} refreshKey={refreshKey} />
        )}
        {active === 'localGraph' && (
          <LocalGraphPanel noteId={noteId} onOpenNote={onOpenNote} refreshKey={refreshKey} />
        )}
      </div>
    </div>
  );
};

export default GraphPanels;
