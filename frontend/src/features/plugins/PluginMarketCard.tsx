import React, { useState } from 'react';
import { RemotePluginEntry } from '../../types/marketplace';
import { MarketplaceService } from '../../services/marketplaceService';
import './PluginMarketCard.css';

interface PluginMarketCardProps {
  plugin: RemotePluginEntry;
  onInstallSuccess: () => void;
  variant?: 'normal' | 'featured';
}

const PluginMarketCard: React.FC<PluginMarketCardProps> = ({
  plugin,
  onInstallSuccess,
  variant = 'normal'
}) => {
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const handleInstall = async () => {
    try {
      setInstalling(true);
      setError(null);
      
      await MarketplaceService.installPlugin(plugin.id);
      setInstalled(true);
      onInstallSuccess();
      
      // Show success state for 3 seconds
      setTimeout(() => setInstalled(false), 3000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setInstalling(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDownloadCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="star full">⭐</span>);
    }
    
    if (hasHalfStar) {
      stars.push(<span key="half" className="star half">⭐</span>);
    }
    
    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(<span key={`empty-${i}`} className="star empty">☆</span>);
    }
    
    return stars;
  };

  const description = showFullDescription ? plugin.description : 
    plugin.description.length > 120 ? 
      `${plugin.description.substring(0, 120)}...` : 
      plugin.description;

  return (
    <div className={`plugin-market-card ${variant}`}>
      {/* Plugin Header */}
      <div className="plugin-header">
        <div className="plugin-title-row">
          <h3 className="plugin-name">
            {plugin.name}
            {plugin.verified && <span className="verified-badge" title="Verified Plugin">✅</span>}
            {plugin.deprecated && <span className="deprecated-badge" title="Deprecated">⚠️</span>}
          </h3>
          <span className="plugin-version">v{plugin.version}</span>
        </div>
        
        <p className="plugin-author">by {plugin.author}</p>
        
        {/* Rating and Stats */}
        <div className="plugin-stats">
          <div className="rating">
            {renderStars(plugin.rating)}
            <span className="rating-text">
              {plugin.rating.toFixed(1)} ({plugin.reviewCount} reviews)
            </span>
          </div>
          <div className="downloads">
            📥 {formatDownloadCount(plugin.downloadCount)} downloads
          </div>
        </div>
      </div>

      {/* Plugin Description */}
      <div className="plugin-description">
        <p>{description}</p>
        {plugin.description.length > 120 && (
          <button
            className="show-more-btn"
            onClick={() => setShowFullDescription(!showFullDescription)}
          >
            {showFullDescription ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Plugin Metadata */}
      <div className="plugin-metadata">
        {plugin.category && (
          <span className="category-tag">{plugin.category}</span>
        )}
        
        {plugin.tags.length > 0 && (
          <div className="tags">
            {plugin.tags.slice(0, 3).map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
            {plugin.tags.length > 3 && (
              <span className="tag more">+{plugin.tags.length - 3} more</span>
            )}
          </div>
        )}
      </div>

      {/* Plugin Details */}
      <div className="plugin-details">
        <div className="detail-row">
          <span className="detail-label">Size:</span>
          <span className="detail-value">{formatFileSize(plugin.fileSize)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Updated:</span>
          <span className="detail-value">
            {new Date(plugin.updatedAt).toLocaleDateString()}
          </span>
        </div>
        {plugin.licenseType && (
          <div className="detail-row">
            <span className="detail-label">License:</span>
            <span className="detail-value">{plugin.licenseType}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="plugin-actions">
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}
        
        <div className="action-buttons">
          {plugin.homepageUrl && (
            <a
              href={plugin.homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-small"
            >
              🏠 Homepage
            </a>
          )}
          
          {plugin.documentationUrl && (
            <a
              href={plugin.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-small"
            >
              📖 Docs
            </a>
          )}
          
          <button
            onClick={handleInstall}
            disabled={installing || installed}
            className={`btn-primary ${installed ? 'btn-success' : ''}`}
          >
            {installing && '⏳ Installing...'}
            {installed && '✅ Installed!'}
            {!installing && !installed && '💾 Install'}
          </button>
        </div>
      </div>

      {/* Required Permissions */}
      {plugin.requiredPermissions.length > 0 && (
        <div className="permissions">
          <h4>Required Permissions:</h4>
          <ul>
            {plugin.requiredPermissions.map(permission => (
              <li key={permission}>{permission}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PluginMarketCard;
