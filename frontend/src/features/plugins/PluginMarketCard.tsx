import React, { useState } from 'react';
import { RemotePluginEntry } from '../../types/marketplace';
import { MarketplaceService } from '../../services/marketplaceService';
import {
  BadgeCheck,
  AlertTriangle,
  Download,
  Star,
  Home,
  BookOpen,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Badge, Button, buttonVariants, Card, cn } from '@/ui';

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
      stars.push(<Star key={i} className="size-3.5 fill-warning text-warning" />);
    }

    if (hasHalfStar) {
      stars.push(<Star key="half" className="size-3.5 fill-warning/60 text-warning/60" />);
    }

    const remainingStars = 5 - Math.ceil(rating);
    for (let i = 0; i < remainingStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="size-3.5 text-muted-foreground/40" />);
    }

    return stars;
  };

  const description = showFullDescription ? plugin.description :
    plugin.description.length > 120 ?
      `${plugin.description.substring(0, 120)}...` :
      plugin.description;

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md',
        variant === 'featured' && 'border-warning shadow-glow',
      )}
    >
      {variant === 'featured' && (
        <span className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-warning text-warning-foreground shadow-md">
          <Star className="size-3.5 fill-current" />
        </span>
      )}

      {/* Plugin Header */}
      <div className="mb-4">
        <div className="mb-2 flex items-start justify-between gap-4">
          <h3 className="flex flex-1 items-center gap-2 text-lg font-semibold leading-tight text-foreground">
            {plugin.name}
            {plugin.verified && <BadgeCheck className="size-4 shrink-0 text-info" aria-label="Verified Plugin" />}
            {plugin.deprecated && <AlertTriangle className="size-4 shrink-0 text-warning" aria-label="Deprecated" />}
          </h3>
          <Badge variant="secondary" className="whitespace-nowrap">v{plugin.version}</Badge>
        </div>

        <p className="mb-4 text-[13px] text-muted-foreground">by {plugin.author}</p>

        {/* Rating and Stats */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">{renderStars(plugin.rating)}</span>
            <span className="text-[13px] text-subtle-foreground">
              {plugin.rating.toFixed(1)} ({plugin.reviewCount} reviews)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <Download className="size-3.5" />
            {formatDownloadCount(plugin.downloadCount)} downloads
          </div>
        </div>
      </div>

      {/* Plugin Description */}
      <div className="mb-4 flex-1">
        <p className="text-[13px] leading-relaxed text-subtle-foreground">{description}</p>
        {plugin.description.length > 120 && (
          <button
            className="mt-2 text-[13px] text-indigo-400 transition-colors hover:text-primary hover:underline"
            onClick={() => setShowFullDescription(!showFullDescription)}
          >
            {showFullDescription ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Plugin Metadata */}
      <div className="mb-4">
        {plugin.category && (
          <Badge variant="default" className="uppercase tracking-wide">{plugin.category}</Badge>
        )}

        {plugin.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {plugin.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="outline">{tag}</Badge>
            ))}
            {plugin.tags.length > 3 && (
              <Badge variant="secondary" className="italic">+{plugin.tags.length - 3} more</Badge>
            )}
          </div>
        )}
      </div>

      {/* Plugin Details */}
      <div className="mb-4 rounded-md bg-surface-2 p-3 text-[13px]">
        <div className="flex justify-between">
          <span className="font-medium text-muted-foreground">Size:</span>
          <span className="text-foreground">{formatFileSize(plugin.fileSize)}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="font-medium text-muted-foreground">Updated:</span>
          <span className="text-foreground">
            {new Date(plugin.updatedAt).toLocaleDateString()}
          </span>
        </div>
        {plugin.licenseType && (
          <div className="mt-2 flex justify-between">
            <span className="font-medium text-muted-foreground">License:</span>
            <span className="text-foreground">{plugin.licenseType}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/15 p-2 text-[13px] text-destructive">
            <p>{error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {plugin.homepageUrl && (
            <a
              href={plugin.homepageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Home className="size-3.5" />
              Homepage
            </a>
          )}

          {plugin.documentationUrl && (
            <a
              href={plugin.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <BookOpen className="size-3.5" />
              Docs
            </a>
          )}

          <Button
            onClick={handleInstall}
            disabled={installing || installed}
            variant="primary"
            className={cn('min-w-[120px] flex-1', installed && 'bg-success text-success-foreground hover:bg-success/90')}
          >
            {installing && <><Loader2 className="size-4 animate-spin" /> Installing...</>}
            {installed && <><CheckCircle2 className="size-4" /> Installed!</>}
            {!installing && !installed && <><Download className="size-4" /> Install</>}
          </Button>
        </div>
      </div>

      {/* Required Permissions */}
      {plugin.requiredPermissions.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <h4 className="mb-2 text-[13px] font-semibold text-foreground">Required Permissions:</h4>
          <ul className="list-disc pl-5 text-xxs text-muted-foreground">
            {plugin.requiredPermissions.map(permission => (
              <li key={permission} className="mb-1">{permission}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};

export default PluginMarketCard;
