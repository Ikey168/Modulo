import React, { useEffect, useRef } from 'react';
import './RenderedNoteDisplay.css';

interface RenderedNoteDisplayProps {
  content: string;
  mimeType: string;
  metadata: Record<string, any>;
  isInteractive: boolean;
  rendererId: string;
  onEvent?: (eventType: string, eventData: any) => void;
}

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
    if (isInteractive) {
      setupEventListeners();
    }
  }, [content, isInteractive]);

  const setupEventListeners = () => {
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

    // Cleanup
    return () => {
      window.removeEventListener('mindmap-node-click', handleCustomEvent as EventListener);
      window.removeEventListener('kanban-card-move', handleCustomEvent as EventListener);
      window.removeEventListener('timeline-event-select', handleCustomEvent as EventListener);
    };
  };

  const renderContent = () => {
    switch (mimeType) {
      case 'text/html':
        return renderHTMLContent();
      case 'text/markdown':
        return renderMarkdownContent();
      case 'application/json':
        return renderJSONContent();
      case 'text/plain':
      default:
        return renderPlainTextContent();
    }
  };

  const renderHTMLContent = () => {
    if (isInteractive) {
      // For interactive content, use an iframe for security and isolation
      return (
        <iframe
          ref={iframeRef}
          className=\"rendered-content-iframe\"
          srcDoc={content}
          title=\"Rendered Note Content\"
          sandbox=\"allow-scripts allow-same-origin\"
          onLoad={() => {
            // Setup communication with iframe if needed
            if (iframeRef.current && onEvent) {
              const iframe = iframeRef.current;
              iframe.contentWindow?.addEventListener('message', (event) => {
                if (event.data.type === 'renderer-event') {
                  onEvent(event.data.eventType, event.data.data);
                }
              });
            }
          }}
        />
      );
    } else {
      // For static HTML, render directly (with sanitization in a real app)
      return (
        <div
          className=\"rendered-content-html\"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
  };

  const renderMarkdownContent = () => {
    // In a real implementation, you'd use a markdown parser like marked or react-markdown
    return (
      <div className=\"rendered-content-markdown\">
        <pre>{content}</pre>
      </div>
    );
  };

  const renderJSONContent = () => {
    try {
      const jsonData = typeof content === 'string' ? JSON.parse(content) : content;
      return (
        <div className=\"rendered-content-json\">
          <pre>{JSON.stringify(jsonData, null, 2)}</pre>
        </div>
      );
    } catch (error) {
      return (
        <div className=\"rendered-content-error\">
          <p>Invalid JSON content</p>
          <pre>{content}</pre>
        </div>
      );
    }
  };

  const renderPlainTextContent = () => {
    return (
      <div className=\"rendered-content-text\">
        <pre>{content}</pre>
      </div>
    );
  };

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
    <div className=\"rendered-note-display\">
      <div className=\"rendered-content-header\">
        <div className=\"renderer-info\">
          <span className=\"renderer-label\">Rendered with: {rendererId}</span>
          {isInteractive && (
            <span className=\"interactive-badge\">Interactive</span>
          )}
        </div>
        
        {metadataInfo.length > 0 && (
          <div className=\"content-metadata\">
            {metadataInfo.map((info, index) => (
              <span key={index} className=\"metadata-item\">{info}</span>
            ))}
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className={`rendered-content-container ${isInteractive ? 'interactive' : 'static'}`}
      >
        {renderContent()}
      </div>

      {metadata.error && (
        <div className=\"rendering-error\">
          <strong>Rendering Error:</strong> {metadata.error}
        </div>
      )}

      {metadata.warnings && Array.isArray(metadata.warnings) && metadata.warnings.length > 0 && (
        <div className=\"rendering-warnings\">
          <strong>Warnings:</strong>
          <ul>
            {metadata.warnings.map((warning: string, index: number) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RenderedNoteDisplay;
