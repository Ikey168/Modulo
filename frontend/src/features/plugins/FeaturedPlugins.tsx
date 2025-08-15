import React, { useState, useEffect } from 'react';
import { RemotePluginEntry } from '../../types/marketplace';
import { MarketplaceService } from '../../services/marketplaceService';
import PluginMarketCard from './PluginMarketCard';
import './FeaturedPlugins.css';

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
      <div className="featured-plugins loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading featured plugins...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="featured-plugins error">
        <div className="error-message">
          <h3>Failed to load featured plugins</h3>
          <p>{error}</p>
          <button onClick={loadFeaturedPlugins} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="featured-plugins">
      <section className="hero-section">
        <h2>🌟 Featured Plugins</h2>
        <p>Discover the most popular and highly-rated plugins in our marketplace</p>
      </section>

      {featuredPlugins.length === 0 ? (
        <div className="no-featured">
          <h3>No featured plugins available</h3>
          <p>Check back later for featured plugins from our marketplace.</p>
        </div>
      ) : (
        <>
          {/* Top 3 plugins - highlighted display */}
          {featuredPlugins.length >= 3 && (
            <section className="top-picks">
              <h3>🏆 Top Picks</h3>
              <div className="top-picks-grid">
                {featuredPlugins.slice(0, 3).map(plugin => (
                  <div key={plugin.id} className="top-pick-card">
                    <PluginMarketCard
                      plugin={plugin}
                      onInstallSuccess={onInstallSuccess}
                      variant="featured"
                    />
                    <button
                      className="view-details-btn"
                      onClick={() => onPluginSelect(plugin)}
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Remaining plugins - regular grid */}
          {featuredPlugins.length > 3 && (
            <section className="more-featured">
              <h3>More Featured Plugins</h3>
              <div className="featured-grid">
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
            <div className="featured-grid">
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
