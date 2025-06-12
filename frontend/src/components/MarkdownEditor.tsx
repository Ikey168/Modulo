import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
  initialContent?: string;
  onContentChange?: (markdown: string, html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  initialContent = '',
  onContentChange,
  placeholder = 'Start typing your markdown...',
  readOnly = false
}) => {
  const [markdown, setMarkdown] = useState(initialContent);
  const [html, setHtml] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced function to convert markdown to HTML via backend API
  const convertMarkdownToHtml = useCallback(
    async (markdownContent: string) => {
      if (!markdownContent.trim()) {
        setHtml('');
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch('/api/markdown/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ markdown: markdownContent }),
        });

        if (response.ok) {
          const data = await response.json();
          setHtml(data.html);
        } else {
          console.error('Failed to convert markdown to HTML');
        }
      } catch (error) {
        console.error('Error converting markdown:', error);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Debounce the markdown conversion
  useEffect(() => {
    const timer = setTimeout(() => {
      convertMarkdownToHtml(markdown);
    }, 300);

    return () => clearTimeout(timer);
  }, [markdown, convertMarkdownToHtml]);

  // Notify parent component of content changes
  useEffect(() => {
    if (onContentChange) {
      onContentChange(markdown, html);
    }
  }, [markdown, html, onContentChange]);

  const handleMarkdownChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdown(event.target.value);
  };

  const togglePreviewMode = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  return (
    <div className="markdown-editor">
      <div className="markdown-editor-toolbar">
        <button
          onClick={togglePreviewMode}
          className={`preview-toggle ${isPreviewMode ? 'active' : ''}`}
          type="button"
        >
          {isPreviewMode ? 'Edit' : 'Preview'}
        </button>
        {isLoading && <span className="loading-indicator">Converting...</span>}
      </div>

      <div className="markdown-editor-content">
        {!isPreviewMode ? (
          // Editor pane
          <div className="editor-pane">
            <textarea
              value={markdown}
              onChange={handleMarkdownChange}
              placeholder={placeholder}
              readOnly={readOnly}
              className="markdown-textarea"
              spellCheck={false}
            />
          </div>
        ) : (
          // Preview pane
          <div className="preview-pane">
            <div className="markdown-preview">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize]}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Split view for larger screens */}
      <div className="markdown-editor-split-view">
        <div className="editor-pane">
          <h3>Editor</h3>
          <textarea
            value={markdown}
            onChange={handleMarkdownChange}
            placeholder={placeholder}
            readOnly={readOnly}
            className="markdown-textarea"
            spellCheck={false}
          />
        </div>
        
        <div className="preview-pane">
          <h3>Preview {isLoading && <span className="loading-indicator">(Converting...)</span>}</h3>
          <div className="markdown-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownEditor;
