import React, { useState } from 'react';
import './MarketplaceSearchBar.css';

interface MarketplaceSearchBarProps {
  onSearch: (query: string) => void;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
}

const MarketplaceSearchBar: React.FC<MarketplaceSearchBarProps> = ({
  onSearch,
  onToggleFilters,
  hasActiveFilters
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="marketplace-search-bar">
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins..."
            className="search-input"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="clear-button"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
          <button
            type="submit"
            className="search-button"
            aria-label="Search"
          >
            🔍
          </button>
        </div>
      </form>
      
      <button
        onClick={onToggleFilters}
        className={`filters-toggle ${hasActiveFilters ? 'has-filters' : ''}`}
        aria-label="Toggle filters"
      >
        🎛️ Filters
        {hasActiveFilters && <span className="filter-indicator">•</span>}
      </button>
    </div>
  );
};

export default MarketplaceSearchBar;
