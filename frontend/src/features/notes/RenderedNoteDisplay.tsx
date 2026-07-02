import React, { useEffect, useRef } from 'react';
import { Badge, cn } from '@/ui';
import { NoteMarkdown } from './rendering/NoteMarkdown';

interface RenderedNoteDisplayProps {
  content: string;
  mimeType: string;
  metadata: Record<string, any>;
  isInteractive: boolean;
  rendererId: string;
  onEvent?: (eventType: string, eventData: any) => void;
}

const PRE_CLASSES =
  'm-0 overflow-x-auto rounded-md border border-border bg-surface-3 p-4 font-mono text-[13px] leading-relaxed text-subtle-foreground';

const RenderedNoteDisplay: React.FC<RenderedNoteDisplayProps> = ({
  content,
  mimeType,
  metadata,
  isInteractive,
  rendererId,
  onEvent
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isInteractive || !onEvent) return;

    // Listen for custom events from rendered content
    const handleCustomEvent = (event: CustomEvent) => {
      const { type, detail } = event;

      switch (type) {
        case 'mindmap-node-click':
          onEvent('node-click', {
            nodeId: detail.nodeId,
            nodeText: detail.nodeText,
            level: detail.level
          });
          break;

        case 'kanban-card-move':
          onEvent('card-move', {
            cardId: detail.cardId,
            fromColumn: detail.fromColumn,
            toColumn: detail.toColumn
          });
          break;

        case 'timeline-event-select':
          onEvent('event-select', {
            eventId: detail.eventId,
            timestamp: detail.timestamp
          });
          break;

        default:
          onEvent(type, detail);
      }
    };

    // Add event listeners for various custom events
    window.addEventListener('mindmap-node-click', handleCustomEvent as EventListener);
    window.addEventListener('kanban-card-move', handleCustomEvent as EventListener);
    window.addEventListener('timeline-event-select', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('mindmap-node-click', handleCustomEvent as EventListener);
      window.removeEventListener('kanban-card-move', handleCustomEvent as EventListener);
      window.removeEventListener('timeline-event-select', handleCustomEvent as EventListener);
    };
  }, [content, isInteractive, onEvent]);

  // Interactive renderer output posts `renderer-event` messages from its
  // sandboxed iframe; relay them to the host via onEvent.
  useEffect(() => {
    if (!isInteractive || !onEvent) return;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.source === iframeRef.current?.contentWindow &&
        event.data?.type === 'renderer-event'
      ) {
        onEvent(event.data.eventType, event.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isInteractive, onEvent]);

  const renderContent = () => {
    switch (mimeType) {
      case 'text/html':
        return renderHTMLContent();
      case 'text/markdown':
        return <NoteMarkdown content={content} className="p-4" />;
      case 'application/json':
        return renderJSONContent();
      case 'text/plain':
      default:
        return renderPlainTextContent();
    }
  };

  const renderHTMLContent = () => {
    if (isInteractive) {
      // Interactive renderer output runs inside a fully sandboxed iframe:
      // scripts are allowed but the document stays cross-origin (no
      // `allow-same-origin`), so it can't touch the host DOM/storage. It
      // communicates outward via postMessage only (relayed above).
      return (
        <iframe
          ref={iframeRef}
          className="block h-[600px] w-full rounded-md border-0 bg-surface max-md:h-[400px] print:hidden"
          srcDoc={content}
          title="Rendered Note Content"
          sandbox="allow-scripts"
        />
      );
    }
    // Static HTML renders through the sanitization pipeline
    // (rehype-raw → rehype-sanitize) — never injected unsanitized.
    return <NoteMarkdown content={content} allowHtml className="p-4" />;
  };

  const renderJSONContent = () => {
    try {
      const jsonData = typeof content === 'string' ? JSON.parse(content) : content;
      return (
        <div className="p-4">
          <pre className={cn(PRE_CLASSES, 'bg-background text-primary-hover')}>
            {JSON.stringify(jsonData, null, 2)}
          </pre>
        </div>
      );
    } catch (error) {
      return (
        <div className="p-4 text-destructive">
          <p className="mb-2 mt-0 text-[13px] font-medium">Invalid JSON content</p>
          <pre className="m-0 overflow-x-auto rounded-md border border-destructive/30 bg-destructive/10 p-3 font-mono text-[13px] leading-relaxed text-destructive">
            {content}
          </pre>
        </div>
      );
    }
  };

  const renderPlainTextContent = () => (
    <div className="p-4">
      <pre className={cn(PRE_CLASSES, 'whitespace-pre-wrap break-words border-0 bg-transparent p-0')}>
        {content}
      </pre>
    </div>
  );

  const getMetadataInfo = () => {
    const info = [];

    if (metadata.nodeCount) {
      info.push(`${metadata.nodeCount} nodes`);
    }

    if (metadata.maxDepth) {
      info.push(`${metadata.maxDepth} levels deep`);
    }

    if (metadata.theme) {
      info.push(`${metadata.theme} theme`);
    }

    if (metadata.cardCount) {
      info.push(`${metadata.cardCount} cards`);
    }

    if (metadata.eventCount) {
      info.push(`${metadata.eventCount} events`);
    }

    return info;
  };

  const metadataInfo = getMetadataInfo();

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-2 px-4 py-3 max-md:flex-col max-md:items-start">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-medium text-muted-foreground">Rendered with: {rendererId}</span>
          {isInteractive && (
            <Badge variant="success" className="uppercase tracking-wide">Interactive</Badge>
          )}
        </div>

        {metadataInfo.length > 0 && (
          <div className="flex flex-wrap gap-3 max-md:w-full max-md:justify-start">
            {metadataInfo.map((info, index) => (
              <span
                key={index}
                className="rounded-md border border-border-strong bg-surface-3 px-2 py-1 text-xs text-muted-foreground"
              >
                {info}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className={cn('relative bg-surface', isInteractive && 'min-h-[400px]')}
      >
        {renderContent()}
      </div>

      {metadata.error && (
        <div className="mx-4 my-2 rounded-r-md border-l-4 border-destructive bg-destructive/15 px-4 py-3 text-[13px] text-destructive">
          <strong className="mb-2 block font-semibold">Rendering Error:</strong> {metadata.error}
        </div>
      )}

      {metadata.warnings && Array.isArray(metadata.warnings) && metadata.warnings.length > 0 && (
        <div className="mx-4 my-2 rounded-r-md border-l-4 border-warning bg-warning/15 px-4 py-3 text-[13px] text-warning">
          <strong className="mb-2 block font-semibold">Warnings:</strong>
          <ul className="m-0 list-disc pl-5">
            {metadata.warnings.map((warning: string, index: number) => (
              <li key={index} className="mb-1">{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RenderedNoteDisplay;
