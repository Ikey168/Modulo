import React, { useState, useRef } from 'react';
import { PluginService } from '../../services/pluginService';

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
    <div className="plugin-installer-overlay">
      <div className="plugin-installer-modal">
        <div className="installer-header">
          <h2>Install Plugin</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="installer-body">
          {error && (
            <div className="error-message">
              <span>❌ {error}</span>
            </div>
          )}

          <div className="file-upload-section">
            <label>Plugin File (JAR)</label>
            <div
              className={`file-drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
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
                <div className="file-selected">
                  <div className="file-icon">📁</div>
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <button
                    className="remove-file-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="file-upload-prompt">
                  <div className="upload-icon">📤</div>
                  <p>Click to select or drag & drop a JAR file</p>
                  <small>Only .jar files are supported</small>
                </div>
              )}
            </div>
          </div>

          <div className="config-section">
            <label htmlFor="plugin-config">
              Configuration (Optional)
              {!isConfigValid && <span className="config-error"> - Invalid JSON</span>}
            </label>
            <textarea
              id="plugin-config"
              className={`config-textarea ${!isConfigValid ? 'invalid' : ''}`}
              placeholder="Enter plugin configuration in JSON format..."
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              rows={6}
            />
            <small className="config-help">
              Plugin-specific configuration in JSON format. Leave empty to use defaults.
            </small>
          </div>
        </div>

        <div className="installer-footer">
          <button 
            className="cancel-btn" 
            onClick={onClose}
            disabled={installing}
          >
            Cancel
          </button>
          <button
            className="install-btn"
            onClick={handleInstall}
            disabled={!file || installing || !isConfigValid}
          >
            {installing ? 'Installing...' : 'Install Plugin'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PluginInstaller;
