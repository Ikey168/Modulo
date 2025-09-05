import React, { useState, useEffect } from 'react';
import './RendererSelector.css';

interface RendererOption {
  name: string;
  displayName: string;
  description: string;
  type: 'STRING' | 'INTEGER' | 'DOUBLE' | 'BOOLEAN' | 'SELECT' | 'COLOR' | 'FONT_SIZE' | 'PERCENTAGE';
  defaultValue: any;
  allowedValues?: any[];
  minValue?: number;
  maxValue?: number;
  required: boolean;
}

interface Renderer {
  id: string;
  name: string;
  version: string;
  description: string;
  supportedNoteTypes: string[];
  options: RendererOption[];
  enabled: boolean;
}

interface RendererSelectorProps {
  noteId: number;
  noteType: string;
  onRenderingComplete: (content: string, mimeType: string, metadata: any) => void;
  onError: (error: string) => void;
}

const RendererSelector: React.FC<RendererSelectorProps> = ({
  noteId,
  noteType,
  onRenderingComplete,
  onError
}) => {
  const [availableRenderers, setAvailableRenderers] = useState<Renderer[]>([]);
  const [selectedRenderer, setSelectedRenderer] = useState<string>('');
  const [rendererOptions, setRendererOptions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);

  useEffect(() => {
    loadCompatibleRenderers();
  }, [noteId, noteType]);

  const loadCompatibleRenderers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/renderers/compatible/${noteId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Get detailed info for each renderer
        const detailedRenderers = await Promise.all(
          data.compatibleRenderers.map(async (renderer: any) => {
            const detailResponse = await fetch(`/api/renderers/${renderer.id}`);
            if (detailResponse.ok) {
              return await detailResponse.json();
            }
            return renderer;
          })
        );
        
        setAvailableRenderers(detailedRenderers.filter(r => r.enabled));
        
        // Auto-select first renderer if available
        if (detailedRenderers.length > 0) {
          setSelectedRenderer(detailedRenderers[0].id);
          initializeOptions(detailedRenderers[0].options);
        }
      } else {
        throw new Error('Failed to load compatible renderers');
      }
    } catch (error) {
      console.error('Error loading renderers:', error);
      onError('Failed to load renderers: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const initializeOptions = (options: RendererOption[]) => {
    const initialOptions: Record<string, any> = {};
    options.forEach(option => {
      initialOptions[option.name] = option.defaultValue;
    });
    setRendererOptions(initialOptions);
  };

  const handleRendererChange = (rendererId: string) => {
    setSelectedRenderer(rendererId);
    const renderer = availableRenderers.find(r => r.id === rendererId);
    if (renderer) {
      initializeOptions(renderer.options);
    }
    setShowOptionsPanel(false);
  };

  const handleOptionChange = (optionName: string, value: any) => {
    setRendererOptions(prev => ({
      ...prev,
      [optionName]: value
    }));
  };

  const renderNote = async () => {
    if (!selectedRenderer) {
      onError('Please select a renderer');
      return;
    }

    try {
      setRendering(true);
      
      // Validate options first
      const validateResponse = await fetch(`/api/renderers/${selectedRenderer}/validate-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rendererOptions)
      });

      if (validateResponse.ok) {
        const validation = await validateResponse.json();
        if (!validation.valid) {
          onError('Invalid options: ' + Object.values(validation.errors).join(', '));
          return;
        }
      }

      // Render the note
      const renderResponse = await fetch('/api/renderers/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId,
          rendererId: selectedRenderer,
          options: rendererOptions
        })
      });

      if (renderResponse.ok) {
        const result = await renderResponse.json();
        onRenderingComplete(result.content, result.mimeType, result.metadata);
      } else {
        const error = await renderResponse.json();
        throw new Error(error.error || 'Failed to render note');
      }
    } catch (error) {
      console.error('Error rendering note:', error);
      onError('Failed to render note: ' + (error as Error).message);
    } finally {
      setRendering(false);
    }
  };

  const renderOptionInput = (option: RendererOption) => {
    const value = rendererOptions[option.name];

    switch (option.type) {
      case 'BOOLEAN':
        return (
          <label className=\"option-checkbox\">
            <input
              type=\"checkbox\"
              checked={value || false}
              onChange={(e) => handleOptionChange(option.name, e.target.checked)}
            />
            {option.displayName}
          </label>
        );

      case 'SELECT':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleOptionChange(option.name, e.target.value)}
            className=\"option-select\"
          >
            {option.allowedValues?.map(allowedValue => (
              <option key={allowedValue} value={allowedValue}>
                {allowedValue}
              </option>
            ))}
          </select>
        );

      case 'COLOR':
        return (
          <input
            type=\"color\"
            value={value || option.defaultValue}
            onChange={(e) => handleOptionChange(option.name, e.target.value)}
            className=\"option-color\"
          />
        );

      case 'INTEGER':
      case 'FONT_SIZE':
        return (
          <input
            type=\"number\"
            value={value || ''}
            min={option.minValue}
            max={option.maxValue}
            onChange={(e) => handleOptionChange(option.name, parseInt(e.target.value))}
            className=\"option-number\"
          />
        );

      case 'DOUBLE':
      case 'PERCENTAGE':
        return (
          <input
            type=\"number\"
            step=\"0.1\"
            value={value || ''}
            min={option.minValue}
            max={option.maxValue}
            onChange={(e) => handleOptionChange(option.name, parseFloat(e.target.value))}
            className=\"option-number\"
          />
        );

      case 'STRING':
      default:
        return (
          <input
            type=\"text\"
            value={value || ''}
            onChange={(e) => handleOptionChange(option.name, e.target.value)}
            className=\"option-text\"
          />
        );
    }
  };

  const selectedRendererObj = availableRenderers.find(r => r.id === selectedRenderer);

  if (loading) {
    return <div className=\"renderer-selector loading\">Loading renderers...</div>;
  }

  if (availableRenderers.length === 0) {
    return (
      <div className=\"renderer-selector no-renderers\">
        <p>No compatible renderers found for this note type: {noteType}</p>
        <p>Standard text rendering will be used.</p>
      </div>
    );
  }

  return (
    <div className=\"renderer-selector\">
      <div className=\"renderer-controls\">
        <div className=\"renderer-select-group\">
          <label htmlFor=\"renderer-select\">Visualization:</label>
          <select
            id=\"renderer-select\"
            value={selectedRenderer}
            onChange={(e) => handleRendererChange(e.target.value)}
            className=\"renderer-dropdown\"
          >
            {availableRenderers.map(renderer => (
              <option key={renderer.id} value={renderer.id}>
                {renderer.name}
              </option>
            ))}
          </select>
        </div>

        {selectedRendererObj && selectedRendererObj.options.length > 0 && (
          <button
            type=\"button\"
            className=\"options-toggle\"
            onClick={() => setShowOptionsPanel(!showOptionsPanel)}
          >
            ⚙️ Options
          </button>
        )}

        <button
          type=\"button\"
          className=\"render-button\"
          onClick={renderNote}
          disabled={rendering || !selectedRenderer}
        >
          {rendering ? 'Rendering...' : '🎨 Render'}
        </button>
      </div>

      {selectedRendererObj && (
        <div className=\"renderer-info\">
          <small>{selectedRendererObj.description}</small>
        </div>
      )}

      {showOptionsPanel && selectedRendererObj && selectedRendererObj.options.length > 0 && (
        <div className=\"options-panel\">
          <h4>Rendering Options</h4>
          <div className=\"options-grid\">
            {selectedRendererObj.options.map(option => (
              <div key={option.name} className=\"option-item\">
                <label className=\"option-label\">
                  {option.displayName}
                  {option.required && <span className=\"required\">*</span>}
                </label>
                {renderOptionInput(option)}
                {option.description && (
                  <small className=\"option-description\">{option.description}</small>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RendererSelector;
