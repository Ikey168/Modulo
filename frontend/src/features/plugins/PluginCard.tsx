import React, { useState } from 'react';
import { PluginInfo, PluginStatus, PluginType } from '../../types/plugin';
import { Palette, Settings, Link2, Wrench, Plug } from 'lucide-react';
import { Badge, Button, Card, cn, type BadgeProps } from '@/ui';

interface PluginCardProps {
  plugin: PluginInfo;
  onAction: (pluginId: string, action: 'start' | 'stop' | 'uninstall') => void;
}

const PluginCard: React.FC<PluginCardProps> = ({ plugin, onAction }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getStatusVariant = (status: PluginStatus): BadgeProps['variant'] => {
    switch (status) {
      case PluginStatus.ACTIVE:
        return 'success';
      case PluginStatus.STARTING:
        return 'warning';
      case PluginStatus.STOPPING:
        return 'warning';
      case PluginStatus.ERROR:
        return 'destructive';
      case PluginStatus.INACTIVE:
      default:
        return 'secondary';
    }
  };

  const getStatusBorder = (status: PluginStatus): string => {
    switch (status) {
      case PluginStatus.ACTIVE:
        return 'border-l-success';
      case PluginStatus.ERROR:
        return 'border-l-destructive';
      case PluginStatus.INACTIVE:
      default:
        return 'border-l-border-strong';
    }
  };

  const getTypeIcon = (type: PluginType) => {
    switch (type) {
      case PluginType.USER_INTERFACE:
        return <Palette className="size-6" />;
      case PluginType.DATA_PROCESSOR:
        return <Settings className="size-6" />;
      case PluginType.INTEGRATION:
        return <Link2 className="size-6" />;
      case PluginType.UTILITY:
        return <Wrench className="size-6" />;
      default:
        return <Plug className="size-6" />;
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'uninstall') => {
    setActionLoading(action);
    try {
      await onAction(plugin.id, action);
    } finally {
      setActionLoading(null);
    }
  };

  const canStart = plugin.status === PluginStatus.INACTIVE;
  const canStop = plugin.status === PluginStatus.ACTIVE;
  const isTransitioning = plugin.status === PluginStatus.STARTING || plugin.status === PluginStatus.STOPPING;

  return (
    <Card
      className={cn(
        'border-l-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        getStatusBorder(plugin.status),
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary">
          {getTypeIcon(plugin.type)}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">{plugin.name}</h3>
          <p className="text-[13px] text-muted-foreground">v{plugin.version}</p>
        </div>
        <div className="ml-auto">
          <Badge variant={getStatusVariant(plugin.status)} className="uppercase">
            {plugin.status}
          </Badge>
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-3 leading-relaxed text-subtle-foreground">{plugin.description}</p>
        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span>by {plugin.author}</span>
          <span className="capitalize">{plugin.type.replace('_', ' ')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {canStart && (
            <Button
              variant="primary"
              className="flex-1 bg-success text-success-foreground hover:bg-success/90"
              onClick={() => handleAction('start')}
              disabled={actionLoading === 'start'}
              loading={actionLoading === 'start'}
            >
              {actionLoading === 'start' ? 'Starting...' : 'Enable'}
            </Button>
          )}

          {canStop && (
            <Button
              variant="primary"
              className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={() => handleAction('stop')}
              disabled={actionLoading === 'stop'}
              loading={actionLoading === 'stop'}
            >
              {actionLoading === 'stop' ? 'Stopping...' : 'Disable'}
            </Button>
          )}

          {isTransitioning && (
            <Button variant="secondary" className="flex-1" disabled>
              {plugin.status}...
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Hide Details' : 'Details'}
          </Button>

          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => handleAction('uninstall')}
            disabled={actionLoading === 'uninstall' || plugin.status === PluginStatus.ACTIVE}
            loading={actionLoading === 'uninstall'}
            title={plugin.status === PluginStatus.ACTIVE ? 'Disable plugin before uninstalling' : 'Uninstall plugin'}
          >
            {actionLoading === 'uninstall' ? 'Removing...' : 'Uninstall'}
          </Button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <label className="font-medium text-subtle-foreground">Runtime:</label>
            <span className="ml-3 flex-1 text-right text-muted-foreground">{plugin.runtime}</span>
          </div>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <label className="font-medium text-subtle-foreground">JAR Path:</label>
            <span className="ml-3 flex-1 break-all text-right font-mono text-xxs text-muted-foreground">{plugin.jarPath}</span>
          </div>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <label className="font-medium text-subtle-foreground">Registered:</label>
            <span className="ml-3 flex-1 text-right text-muted-foreground">{new Date(plugin.registeredAt).toLocaleDateString()}</span>
          </div>
          <div className="mb-2 flex items-center justify-between text-[13px]">
            <label className="font-medium text-subtle-foreground">Updated:</label>
            <span className="ml-3 flex-1 text-right text-muted-foreground">{new Date(plugin.updatedAt).toLocaleDateString()}</span>
          </div>
          {plugin.requiredPermissions && plugin.requiredPermissions.length > 0 && (
            <div className="mb-2 flex items-start justify-between text-[13px]">
              <label className="font-medium text-subtle-foreground">Permissions:</label>
              <div className="ml-3 flex flex-1 flex-wrap justify-end gap-1">
                {plugin.requiredPermissions.map((permission, index) => (
                  <Badge key={index} variant="secondary" className="rounded font-normal">
                    {permission}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default PluginCard;
