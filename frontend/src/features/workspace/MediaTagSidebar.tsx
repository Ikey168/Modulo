import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button, ScrollArea, cn } from "@/ui";
import { SearchInput } from "./viewkit";

const INITIAL_LIMIT = 80;

/** Right-hand tag facet list for media views. Selecting several tags narrows to items that have all of them. */
export function MediaTagSidebar({
  facets,
  selected,
  onToggle,
  onClear,
  className,
}: {
  facets: Array<{ tag: string; count: number }>;
  selected: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const selectedKeys = useMemo(
    () => new Set(selected.map((tag) => tag.toLowerCase())),
    [selected],
  );
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return facets.filter(
      (facet) =>
        !selectedKeys.has(facet.tag.toLowerCase()) &&
        (!needle || facet.tag.toLowerCase().includes(needle)),
    );
  }, [facets, query, selectedKeys]);
  const shown = showAll || query ? matching : matching.slice(0, INITIAL_LIMIT);
  const countFor = (tag: string) =>
    facets.find((facet) => facet.tag.toLowerCase() === tag.toLowerCase())
      ?.count ?? 0;

  return (
    <aside
      id="media-tag-sidebar"
      aria-label="Filter by tags"
      className={cn(
        "flex w-60 shrink-0 flex-col border-l border-border bg-background",
        className,
      )}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tags
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {facets.length}
        </span>
        {selected.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2 text-xs"
            onClick={onClear}
          >
            Clear
          </Button>
        )}
      </div>
      <div className="shrink-0 border-b border-border p-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Search tags"
          placeholder="Search tags"
          className="sm:max-w-none"
        />
      </div>
      {selected.length > 0 && (
        <ul
          className="shrink-0 space-y-0.5 border-b border-border p-2"
          aria-label="Selected tags"
        >
          {selected.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onToggle(tag)}
                className="flex w-full items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-left text-xs font-medium text-foreground hover:bg-primary/15"
              >
                <Check
                  className="size-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{tag}</span>
                <span className="tabular-nums text-muted-foreground">
                  {countFor(tag)}
                </span>
                <X
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ScrollArea className="min-h-0 flex-1">
        {shown.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">
            {query ? "No matching tags." : "No other tags in these results."}
          </p>
        ) : (
          <ul className="space-y-0.5 p-2">
            {shown.map((facet) => (
              <li key={facet.tag}>
                <button
                  type="button"
                  aria-label={`Filter by tag ${facet.tag} (${facet.count})`}
                  onClick={() => onToggle(facet.tag)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate" title={facet.tag}>
                    {facet.tag}
                  </span>
                  <span className="tabular-nums">{facet.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!showAll && !query && matching.length > INITIAL_LIMIT && (
          <div className="px-2 pb-2">
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => setShowAll(true)}
            >
              Show all {matching.length} tags
            </Button>
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
