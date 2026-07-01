import React, { useState, useEffect } from 'react';
import { Settings, Palette } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui';

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
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleOptionChange(option.name, e.target.checked)}
              className="size-4 cursor-pointer accent-primary"
            />
            {option.displayName}
          </label>
        );

      case 'SELECT':
        return (
          <Select
            value={value ? String(value) : ''}
            onValueChange={(val) => handleOptionChange(option.name, val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {option.allowedValues?.map(allowedValue => (
                <SelectItem key={allowedValue} value={String(allowedValue)}>
                  {allowedValue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'COLOR':
        return (
          <input
            type="color"
            value={value || option.defaultValue}
            onChange={(e) => handleOptionChange(option.name, e.target.value)}
            className="h-9 w-[60px] cursor-pointer rounded-md border border-border-strong bg-surface-2 p-0.5"
          />
        );

      case 'INTEGER':
      case 'FONT_SIZE':
        return (
          <Input
            type="number"
            value={value || ''}
            min={option.minValue}
            max={option.maxValue}
            onChange={(e) => handleOptionChange(option.name, parseInt(e.target.value))}
          />
        );

      case 'DOUBLE':
      case 'PERCENTAGE':
        return (
          <Input
            type="number"
            step="0.1"
            value={value || ''}
            min={option.minValue}
            max={option.maxValue}
            onChange={(e) => handleOptionChange(option.name, parseFloat(e.target.value))}
          />
        );

      case 'STRING':
      default:
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => handleOptionChange(option.name, e.target.value)}
          />
        );
    }
  };

  const selectedRendererObj = availableRenderers.find(r => r.id === selectedRenderer);

  if (loading) {
    return (
      <div className="my-4 rounded-lg border border-border bg-surface p-8 text-center text-[13px] text-muted-foreground">
        Loading renderers...
      </div>
    );
  }

  if (availableRenderers.length === 0) {
    return (
      <div className="my-4 rounded-lg border border-dashed border-border-strong bg-surface p-6 text-center text-[13px] text-muted-foreground">
        <p className="m-0">No compatible renderers found for this note type: {noteType}</p>
        <p className="m-0 mt-1">Standard text rendering will be used.</p>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-4 max-md:flex-col max-md:items-stretch max-md:gap-3">
        <div className="flex flex-1 items-center gap-2 max-md:flex-col max-md:items-start">
          <Label htmlFor="renderer-select" className="whitespace-nowrap">Visualization:</Label>
          <Select value={selectedRenderer} onValueChange={handleRendererChange}>
            <SelectTrigger id="renderer-select" className="min-w-[200px] max-md:w-full max-md:min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRenderers.map(renderer => (
                <SelectItem key={renderer.id} value={renderer.id}>
                  {renderer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRendererObj && selectedRendererObj.options.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="max-md:w-full"
            onClick={() => setShowOptionsPanel(!showOptionsPanel)}
          >
            <Settings /> Options
          </Button>
        )}

        <Button
          type="button"
          variant="primary"
          size="md"
          className="max-md:w-full"
          onClick={renderNote}
          disabled={rendering || !selectedRenderer}
          loading={rendering}
        >
          {rendering ? 'Rendering...' : <><Palette /> Render</>}
        </Button>
      </div>

      {selectedRendererObj && (
        <div className="mb-2 text-[13px] text-muted-foreground">
          <small>{selectedRendererObj.description}</small>
        </div>
      )}

      {showOptionsPanel && selectedRendererObj && selectedRendererObj.options.length > 0 && (
        <div className="mt-3 rounded-lg border border-border-strong bg-surface-2 p-4">
          <h4 className="m-0 mb-4 text-sm font-semibold text-foreground">Rendering Options</h4>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 max-md:grid-cols-1">
            {selectedRendererObj.options.map(option => (
              <div key={option.name} className="flex flex-col gap-1.5">
                <Label className="text-[13px]">
                  {option.displayName}
                  {option.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                {renderOptionInput(option)}
                {option.description && (
                  <small className="mt-0.5 text-xs leading-snug text-muted-foreground">{option.description}</small>
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
