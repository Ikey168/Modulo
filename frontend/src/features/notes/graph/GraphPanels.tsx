import React, { useState, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/ui';
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
      <Tabs value={active} onValueChange={(v) => setActive(v as Tab)}>
        <TabsList variant="underline" className="mb-3 flex-wrap">
          <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
          <TabsTrigger value="mentions">Unlinked Mentions</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="localGraph">Local Graph</TabsTrigger>
        </TabsList>
      </Tabs>

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
