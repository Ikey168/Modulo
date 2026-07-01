import React from 'react';
import { PluginSearchFilters } from '../../types/marketplace';
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui';

/**
 * Radix SelectItem forbids value=""; sentinel for the "All …" options.
 * Underscored so it cannot collide with a real (dynamic) category name.
 */
const ALL = '__all__';

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
            value={filters.category || ALL}
            onValueChange={(val) => onChange({ category: val === ALL ? null : val })}
          >
            <SelectTrigger id="category-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rating Filter */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="rating-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Minimum Rating
          </Label>
          <Select
            value={String(filters.minRating)}
            onValueChange={(val) => onChange({ minRating: parseFloat(val) })}
          >
            <SelectTrigger id="rating-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any Rating</SelectItem>
              <SelectItem value="1">⭐ 1+ Stars</SelectItem>
              <SelectItem value="2">⭐ 2+ Stars</SelectItem>
              <SelectItem value="3">⭐ 3+ Stars</SelectItem>
              <SelectItem value="4">⭐ 4+ Stars</SelectItem>
              <SelectItem value="4.5">⭐ 4.5+ Stars</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Verified Filter */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="verified-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Verification Status
          </Label>
          <Select
            value={filters.verified === null ? ALL : filters.verified.toString()}
            onValueChange={(val) => {
              onChange({
                verified: val === ALL ? null : val === 'true'
              });
            }}
          >
            <SelectTrigger id="verified-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Plugins</SelectItem>
              <SelectItem value="true">✅ Verified Only</SelectItem>
              <SelectItem value="false">Unverified Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort By */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="sort-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Sort By
          </Label>
          <Select
            value={filters.sortBy}
            onValueChange={(val) => onChange({ sortBy: val as any })}
          >
            <SelectTrigger id="sort-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Relevance</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="downloads">Downloads</SelectItem>
              <SelectItem value="updated">Recently Updated</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Order */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="order-select" className="text-xxs uppercase tracking-wide text-muted-foreground">
            Order
          </Label>
          <Select
            value={filters.sortOrder}
            onValueChange={(val) => onChange({ sortOrder: val as 'asc' | 'desc' })}
          >
            <SelectTrigger id="order-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
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
