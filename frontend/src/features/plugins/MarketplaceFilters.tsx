import React from 'react';
import { PluginSearchFilters } from '../../types/marketplace';
import { Button, Label, Select } from '@/ui';

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
    <div className="mb-6 animate-fade-up rounded-lg border border-border bg-surface p-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {/* Category Filter */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Category
          </Label>
          <Select
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
          </Select>
        </div>

        {/* Rating Filter */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="rating-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Minimum Rating
          </Label>
          <Select
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
          </Select>
        </div>

        {/* Verified Filter */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="verified-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Verification Status
          </Label>
          <Select
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
          </Select>
        </div>

        {/* Sort By */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="sort-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Sort By
          </Label>
          <Select
            id="sort-select"
            value={filters.sortBy}
            onChange={(e) => onChange({ sortBy: e.target.value as any })}
          >
            <option value="relevance">Relevance</option>
            <option value="rating">Rating</option>
            <option value="downloads">Downloads</option>
            <option value="updated">Recently Updated</option>
            <option value="name">Name</option>
          </Select>
        </div>

        {/* Sort Order */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Order
          </Label>
          <Select
            id="order-select"
            value={filters.sortOrder}
            onChange={(e) => onChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex justify-end border-t border-border pt-4">
        <Button onClick={onReset} variant="outline" size="sm">
          Reset Filters
        </Button>
      </div>
    </div>
  );
};

export default MarketplaceFilters;
