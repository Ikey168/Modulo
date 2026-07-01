import React, { useState, useRef } from 'react';
import { PluginService } from '../../services/pluginService';
import { Upload, FileArchive, X, AlertCircle } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
  cn,
} from '@/ui';

interface PluginInstallerProps {
  onClose: () => void;
  onSuccess: () => void;
}

const PluginInstaller: React.FC<PluginInstallerProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState('');
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.jar')) {
      setError('Please select a JAR file');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);

    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleInstall = async () => {
    if (!file) {
      setError('Please select a plugin file');
      return;
    }

    setInstalling(true);
    setError(null);

    try {
      const request = {
        file,
        config: config.trim() || undefined,
      };

      const response = await PluginService.installPlugin(request);

      if (response.success) {
        onSuccess();
      } else {
        setError(response.error || 'Installation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setInstalling(false);
    }
  };

  const validateConfig = () => {
    if (!config.trim()) return true;

    try {
      JSON.parse(config);
      return true;
    } catch {
      return false;
    }
  };

  const isConfigValid = validateConfig();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install Plugin</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/15 p-3 text-[13px] text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mb-6">
          <Label className="mb-2 block">Plugin File (JAR)</Label>
          <div
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all',
              dragOver && 'scale-[1.02] border-primary bg-primary/10',
              file && 'border-success bg-success/10',
              !dragOver && !file && 'border-border-strong bg-surface-2 hover:border-primary hover:bg-primary/5',
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jar"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />

            {file ? (
              <div className="flex items-center gap-3 text-left">
                <FileArchive className="size-8 shrink-0 text-success" />
                <div className="flex-1">
                  <div className="font-medium text-foreground">{file.name}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  className="flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
                  aria-label="Remove file"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                <Upload className="mx-auto mb-3 size-8" />
                <p className="text-foreground">Click to select or drag &amp; drop a JAR file</p>
                <small className="text-muted-foreground">Only .jar files are supported</small>
              </div>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="plugin-config" className="mb-2 block">
            Configuration (Optional)
            {!isConfigValid && <span className="font-normal text-destructive"> - Invalid JSON</span>}
          </Label>
          <Textarea
            id="plugin-config"
            className={cn('font-mono', !isConfigValid && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30')}
            placeholder="Enter plugin configuration in JSON format..."
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            rows={6}
          />
          <small className="mt-1.5 block text-xxs text-muted-foreground">
            Plugin-specific configuration in JSON format. Leave empty to use defaults.
          </small>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={installing}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleInstall}
            disabled={!file || installing || !isConfigValid}
            loading={installing}
          >
            {installing ? 'Installing...' : 'Install Plugin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PluginInstaller;
