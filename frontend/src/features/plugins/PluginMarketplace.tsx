import React, { useState, useEffect } from 'react';
import { RemotePluginEntry, PluginSearchFilters, DEFAULT_SEARCH_FILTERS } from '../../types/marketplace';
import { MarketplaceService } from '../../services/marketplaceService';
import { ArrowLeft } from 'lucide-react';
import { Button, EmptyState, Spinner } from '@/ui';
import MarketplaceSearchBar from './MarketplaceSearchBar';
import MarketplaceFilters from './MarketplaceFilters';
import PluginMarketCard from './PluginMarketCard';
import FeaturedPlugins from './FeaturedPlugins';

const PluginMarketplace: React.FC = () => {
  const [plugins, setPlugins] = useState<RemotePluginEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PluginSearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [categories, setCategories] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentView, setCurrentView] = useState<'featured' | 'search'>('featured');

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (currentView === 'search') {
      searchPlugins();
    }
  }, [filters, currentView]);

  const loadCategories = async () => {
    try {
      const categoriesData = await MarketplaceService.getCategories();
      setCategories(categoriesData);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const searchPlugins = async () => {
    if (currentView !== 'search') return;

    try {
      setLoading(true);
      setError(null);

      const response = await MarketplaceService.searchPlugins(
        filters.query,
        filters.category || undefined,
        20
      );

      let results = response.plugins;

      // Apply client-side filters
      if (filters.minRating > 0) {
        results = results.filter(plugin => plugin.rating >= filters.minRating);
      }

      if (filters.verified !== null) {
        results = results.filter(plugin => plugin.verified === filters.verified);
      }

      // Apply sorting
      results = sortPlugins(results, filters.sortBy, filters.sortOrder);

      setPlugins(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search plugins');
    } finally {
      setLoading(false);
    }
  };

  const sortPlugins = (
    plugins: RemotePluginEntry[],
    sortBy: string,
    order: 'asc' | 'desc'
  ): RemotePluginEntry[] => {
    return [...plugins].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'downloads':
          comparison = a.downloadCount - b.downloadCount;
          break;
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        default: // relevance
          // For relevance, prefer verified, then rating, then downloads
          if (a.verified !== b.verified) {
            comparison = a.verified ? -1 : 1;
          } else {
            comparison = (a.rating * 0.7 + (a.downloadCount / 1000) * 0.3) -
                        (b.rating * 0.7 + (b.downloadCount / 1000) * 0.3);
          }
          break;
      }

      return order === 'desc' ? -comparison : comparison;
    });
  };

  const handleSearch = (query: string) => {
    setFilters(prev => ({ ...prev, query }));
    setCurrentView('search');
  };

  const handleFilterChange = (newFilters: Partial<PluginSearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    if (Object.keys(newFilters).length > 0) {
      setCurrentView('search');
    }
  };

  const handleInstallSuccess = () => {
    // Refresh the current view after successful installation
    if (currentView === 'search') {
      searchPlugins();
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] p-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-bold text-foreground">Plugin Marketplace</h1>
        <p className="text-lg text-subtle-foreground">Discover and install plugins to extend Modulo's functionality</p>
      </div>

      <MarketplaceSearchBar
        onSearch={handleSearch}
        onToggleFilters={() => setShowFilters(!showFilters)}
        hasActiveFilters={filters.query !== '' || filters.category !== null}
      />

      {showFilters && (
        <MarketplaceFilters
          filters={filters}
          categories={categories}
          onChange={handleFilterChange}
          onReset={() => {
            setFilters(DEFAULT_SEARCH_FILTERS);
            setCurrentView('featured');
          }}
        />
      )}

      <div className="mt-8">
        {currentView === 'featured' && (
          <FeaturedPlugins
            onPluginSelect={(plugin: RemotePluginEntry) => {
              setFilters(prev => ({ ...prev, query: plugin.name }));
              setCurrentView('search');
            }}
            onInstallSuccess={handleInstallSuccess}
          />
        )}

        {currentView === 'search' && (
          <div className="animate-fade-in">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <h2 className="flex-1 text-xl font-semibold text-foreground">
                {filters.query ? `Search results for "${filters.query}"` : 'All Plugins'}
                {plugins.length > 0 && <span className="ml-2 text-[0.9em] font-normal text-muted-foreground">({plugins.length} found)</span>}
              </h2>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentView('featured')}
                >
                  <ArrowLeft className="size-4" />
                  Back to Featured
                </Button>
              </div>
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 p-12 text-muted-foreground">
                <Spinner className="size-8 text-primary" />
                <p>Searching plugins...</p>
              </div>
            )}

            {error && (
              <div className="my-4 rounded-lg border border-warning/40 bg-warning/15 p-8 text-center">
                <p className="mb-4 text-warning">Error: {error}</p>
                <Button onClick={searchPlugins} variant="primary">
                  Try Again
                </Button>
              </div>
            )}

            {!loading && !error && (
              <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
                {plugins.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      title="No plugins found"
                      description="Try adjusting your search criteria or explore featured plugins."
                      action={
                        <Button
                          variant="primary"
                          onClick={() => setCurrentView('featured')}
                        >
                          View Featured Plugins
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  plugins.map(plugin => (
                    <PluginMarketCard
                      key={plugin.id}
                      plugin={plugin}
                      onInstallSuccess={handleInstallSuccess}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PluginMarketplace;
