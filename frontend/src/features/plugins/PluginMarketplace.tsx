import React, { useState, useEffect } from 'react';
import { RemotePluginEntry, PluginSearchFilters, DEFAULT_SEARCH_FILTERS } from '../../types/marketplace';
import { MarketplaceService } from '../../services/marketplaceService';
import MarketplaceSearchBar from './MarketplaceSearchBar';
import MarketplaceFilters from './MarketplaceFilters';
import PluginMarketCard from './PluginMarketCard';
import FeaturedPlugins from './FeaturedPlugins';
import './PluginMarketplace.css';

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
    <div className="plugin-marketplace">
      <div className="marketplace-header">
        <h1>Plugin Marketplace</h1>
        <p>Discover and install plugins to extend Modulo's functionality</p>
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

      <div className="marketplace-content">
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
          <div className="search-results">
            <div className="results-header">
              <h2>
                {filters.query ? `Search results for "${filters.query}"` : 'All Plugins'}
                {plugins.length > 0 && <span className="count">({plugins.length} found)</span>}
              </h2>
              
              <div className="view-controls">
                <button 
                  className="btn-secondary"
                  onClick={() => setCurrentView('featured')}
                >
                  ← Back to Featured
                </button>
              </div>
            </div>

            {loading && (
              <div className="loading-spinner">
                <div className="spinner"></div>
                <p>Searching plugins...</p>
              </div>
            )}

            {error && (
              <div className="error-message">
                <p>Error: {error}</p>
                <button onClick={searchPlugins} className="btn-primary">
                  Try Again
                </button>
              </div>
            )}

            {!loading && !error && (
              <div className="plugins-grid">
                {plugins.length === 0 ? (
                  <div className="no-results">
                    <h3>No plugins found</h3>
                    <p>Try adjusting your search criteria or explore featured plugins.</p>
                    <button 
                      className="btn-primary"
                      onClick={() => setCurrentView('featured')}
                    >
                      View Featured Plugins
                    </button>
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
