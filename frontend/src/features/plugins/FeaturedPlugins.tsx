import React, { useState, useEffect } from 'react';
import { RemotePluginEntry } from '../../types/marketplace';
import { MarketplaceService } from '../../services/marketplaceService';
import { Button, EmptyState, Spinner } from '@/ui';
import { Sparkles } from 'lucide-react';
import PluginMarketCard from './PluginMarketCard';

interface FeaturedPluginsProps {
  onPluginSelect: (plugin: RemotePluginEntry) => void;
  onInstallSuccess: () => void;
}

const FeaturedPlugins: React.FC<FeaturedPluginsProps> = ({
  onPluginSelect,
  onInstallSuccess
}) => {
  const [featuredPlugins, setFeaturedPlugins] = useState<RemotePluginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFeaturedPlugins();
  }, []);

  const loadFeaturedPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      const plugins = await MarketplaceService.getFeaturedPlugins(12);
      setFeaturedPlugins(plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load featured plugins');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner className="size-8 text-primary" />
          <p>Loading featured plugins...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="rounded-lg border border-destructive/40 bg-destructive/15 p-6 text-center text-destructive">
          <h3 className="mb-2 text-lg font-semibold">Failed to load featured plugins</h3>
          <p className="mb-4 text-[13px]">{error}</p>
          <Button onClick={loadFeaturedPlugins} variant="destructive">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <section className="mb-8 rounded-xl border border-border-strong bg-gradient-to-br from-primary/20 via-surface to-surface p-12 text-center">
        <h2 className="mb-4 text-4xl font-bold text-foreground">🌟 Featured Plugins</h2>
        <p className="text-lg text-subtle-foreground">Discover the most popular and highly-rated plugins in our marketplace</p>
      </section>

      {featuredPlugins.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="No featured plugins available"
          description="Check back later for featured plugins from our marketplace."
        />
      ) : (
        <>
          {/* Top 3 plugins - highlighted display */}
          {featuredPlugins.length >= 3 && (
            <section className="mb-12">
              <h3 className="mb-6 text-center text-2xl font-semibold text-foreground">🏆 Top Picks</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(350px,1fr))] gap-8">
                {featuredPlugins.slice(0, 3).map(plugin => (
                  <div key={plugin.id} className="relative">
                    <PluginMarketCard
                      plugin={plugin}
                      onInstallSuccess={onInstallSuccess}
                      variant="featured"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute right-4 top-4 rounded-full backdrop-blur-sm"
                      onClick={() => onPluginSelect(plugin)}
                    >
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Remaining plugins - regular grid */}
          {featuredPlugins.length > 3 && (
            <section className="mb-8">
              <h3 className="mb-6 border-l-4 border-primary pl-4 text-xl font-semibold text-foreground">More Featured Plugins</h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
                {featuredPlugins.slice(3).map(plugin => (
                  <PluginMarketCard
                    key={plugin.id}
                    plugin={plugin}
                    onInstallSuccess={onInstallSuccess}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Show less than 3 plugins in regular grid if that's all we have */}
          {featuredPlugins.length < 3 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
              {featuredPlugins.map(plugin => (
                <PluginMarketCard
                  key={plugin.id}
                  plugin={plugin}
                  onInstallSuccess={onInstallSuccess}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FeaturedPlugins;
