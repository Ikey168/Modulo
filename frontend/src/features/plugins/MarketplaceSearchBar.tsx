import React, { useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { Button, Input, cn } from '@/ui';

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
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <form onSubmit={handleSubmit} className="min-w-[300px] flex-1">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search plugins..."
            className="h-11 pl-10 pr-24 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-14 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-3 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
          <Button
            type="submit"
            size="icon"
            className="absolute right-1.5 size-8"
            aria-label="Search"
          >
            <Search className="size-4" />
          </Button>
        </div>
      </form>

      <Button
        type="button"
        onClick={onToggleFilters}
        variant={hasActiveFilters ? 'primary' : 'outline'}
        size="lg"
        className={cn('relative', hasActiveFilters && 'pr-6')}
        aria-label="Toggle filters"
      >
        <SlidersHorizontal className="size-4" />
        Filters
        {hasActiveFilters && (
          <span className="absolute right-2 top-2 size-2 animate-pulse rounded-full bg-warning" />
        )}
      </Button>
    </div>
  );
};

export default MarketplaceSearchBar;
