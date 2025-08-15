import React from 'react';
import { PluginSearchFilters } from '../../types/marketplace';
import './MarketplaceFilters.css';

interface MarketplaceFiltersProps {
  filters: PluginSearchFilters;
  categories: string[];
  onChange: (filters: Partial<PluginSearchFilters>) => void;
  onReset: () => void;
}

const MarketplaceFilters: React.FC<MarketplaceFiltersProps> = ({
  filters,
  categories,
  onChange,
  onReset
}) => {
  return (
    <div className="marketplace-filters">
      <div className="filters-grid">
        {/* Category Filter */}
        <div className="filter-group">
          <label htmlFor="category-select">Category</label>
          <select
            id="category-select"
            value={filters.category || ''}
            onChange={(e) => onChange({ category: e.target.value || null })}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Rating Filter */}
        <div className="filter-group">
          <label htmlFor="rating-select">Minimum Rating</label>
          <select
            id="rating-select"
            value={filters.minRating}
            onChange={(e) => onChange({ minRating: parseFloat(e.target.value) })}
          >
            <option value="0">Any Rating</option>
            <option value="1">⭐ 1+ Stars</option>
            <option value="2">⭐ 2+ Stars</option>
            <option value="3">⭐ 3+ Stars</option>
            <option value="4">⭐ 4+ Stars</option>
            <option value="4.5">⭐ 4.5+ Stars</option>
          </select>
        </div>

        {/* Verified Filter */}
        <div className="filter-group">
          <label htmlFor="verified-select">Verification Status</label>
          <select
            id="verified-select"
            value={filters.verified === null ? '' : filters.verified.toString()}
            onChange={(e) => {
              const value = e.target.value;
              onChange({ 
                verified: value === '' ? null : value === 'true' 
              });
            }}
          >
            <option value="">All Plugins</option>
            <option value="true">✅ Verified Only</option>
            <option value="false">Unverified Only</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="filter-group">
          <label htmlFor="sort-select">Sort By</label>
          <select
            id="sort-select"
            value={filters.sortBy}
            onChange={(e) => onChange({ sortBy: e.target.value as any })}
          >
            <option value="relevance">Relevance</option>
            <option value="rating">Rating</option>
            <option value="downloads">Downloads</option>
            <option value="updated">Recently Updated</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Sort Order */}
        <div className="filter-group">
          <label htmlFor="order-select">Order</label>
          <select
            id="order-select"
            value={filters.sortOrder}
            onChange={(e) => onChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      <div className="filters-actions">
        <button onClick={onReset} className="btn-secondary">
          Reset Filters
        </button>
      </div>
    </div>
  );
};

export default MarketplaceFilters;
