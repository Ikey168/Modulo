import { useMediaLibraryStore } from "./usePluginDataStores";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Grid2X2,
  Heart,
  List,
  Plus,
  Star,
  Tags,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Input, Progress, ScrollArea, Textarea, cn } from "@/ui";
import {
  Choice,
  ChoiceInline,
  ConfirmDelete,
  EmptyPanel,
  Field,
  SearchInput,
} from "./viewkit";
import {
  MEDIA_STATUSES,
  MEDIA_TYPES,
  defaultProgressUnit,
  filterByTags,
  filterMedia,
  newMediaId,
  progressPercent,
  tagCounts,
  type MediaItem,
  type MediaStatus,
  type MediaType,
} from "./mediaLibrary";
import {
  LANDSCAPE_MEDIA_TYPES,
  MEDIA_ARTWORK_TONES,
  MEDIA_TYPE_ICONS,
  SQUARE_MEDIA_TYPES,
} from "./mediaVisuals";
import { useParaStore } from "./useParaStore";
import { EntryPopover, EntryPopoverBody } from "./EntryPopover";
import { useRemoveLifeOsRelations } from "./useLifeOsRelations";
import { CrossPluginLinks } from "./CrossPluginLinks";
import { MediaTagSidebar } from "./MediaTagSidebar";

type SortMode = "Recent" | "Title" | "Rating" | "Progress";
type LayoutMode = "grid" | "list";
const MEDIA_PAGE_SIZE = 96;

const STATUS_TONE: Record<
  MediaStatus,
  "secondary" | "outline" | "success" | "warning" | "destructive" | "info"
> = {
  Inbox: "secondary",
  Backlog: "info",
  Active: "success",
  Paused: "warning",
  Finished: "outline",
  Dropped: "destructive",
};

export function MediaLibraryView({
  mediaType,
  title = "Media Library",
  icon: Icon = BookOpen,
}: { mediaType?: MediaType; title?: string; icon?: LucideIcon } = {}) {
  const [data, persist] = useMediaLibraryStore();
  const removeRelations = useRemoveLifeOsRelations();
  const [para] = useParaStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<MediaStatus | "All">("All");
  const [sort, setSort] = useState<SortMode>("Recent");
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<MediaItem | null>(null);
  const [saveError, setSaveError] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia ||
      window.matchMedia("(min-width: 768px)").matches,
  );

  const filtered = useMemo(
    () =>
      filterByTags(
        filterMedia(data.items, query, mediaType ?? typeFilter, statusFilter),
        selectedTags,
      ),
    [data.items, mediaType, query, selectedTags, statusFilter, typeFilter],
  );
  const facets = useMemo(() => tagCounts(filtered), [filtered]);
  const toggleTag = (tag: string) =>
    setSelectedTags((current) =>
      current.some((entry) => entry.toLowerCase() === tag.toLowerCase())
        ? current.filter((entry) => entry.toLowerCase() !== tag.toLowerCase())
        : [...current, tag],
    );

  const visible = useMemo(() => {
    if (sort === "Recent") return filtered;
    return [...filtered].sort((a, b) => {
      if (sort === "Title") return a.title.localeCompare(b.title);
      if (sort === "Rating")
        return b.rating - a.rating || a.title.localeCompare(b.title);
      return (
        progressPercent(b) - progressPercent(a) ||
        a.title.localeCompare(b.title)
      );
    });
  }, [filtered, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / MEDIA_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(
    currentPage * MEDIA_PAGE_SIZE,
    (currentPage + 1) * MEDIA_PAGE_SIZE,
  );
  const selected =
    data.items.find((item) => item.id === selectedId) ??
    (draft?.id === selectedId ? draft : null);
  const savedCount = mediaType
    ? data.items.filter((item) => item.type === mediaType).length
    : data.items.length;

  useEffect(() => {
    setSelectedId(null);
    setEditing(false);
    setDraft(null);
    setSaveError("");
    setSelectedTags([]);
    setPage(0);
  }, [mediaType]);

  useEffect(() => {
    setPage(0);
  }, [query, typeFilter, statusFilter, sort, selectedTags]);

  useEffect(() => {
    if (page >= pageCount) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const create = () => {
    const type = mediaType ?? "Book";
    const item: MediaItem = {
      id: newMediaId(),
      title: `Untitled ${type.toLowerCase()}`,
      type,
      status: "Inbox",
      currentProgress: 0,
      totalProgress: 0,
      progressUnit: defaultProgressUnit(type),
      rating: 0,
      favorite: false,
      tags: [],
    };
    setDraft(item);
    setSelectedId(item.id);
    setEditing(true);
    setSaveError("");
  };
  const save = () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setSaveError("Enter a title before saving.");
      return;
    }
    const item = { ...draft, title: draft.title.trim() };
    if (
      !persist((current) => ({
        ...current,
        items: current.items.some((entry) => entry.id === item.id)
          ? current.items.map((entry) => (entry.id === item.id ? item : entry))
          : [item, ...current.items],
      }))
    ) {
      setSaveError(
        "Couldn’t save changes. Your draft is still here; try saving again.",
      );
      return;
    }
    setDraft(null);
    setEditing(false);
    setSaveError("");
  };
  const close = () => {
    setSelectedId(null);
    setDraft(null);
    setEditing(false);
    setSaveError("");
  };
  const cancel = () => {
    if (!data.items.some((item) => item.id === selectedId)) close();
    else {
      setDraft(null);
      setEditing(false);
      setSaveError("");
    }
  };
  const remove = (id: string) => {
    if (
      data.items.some((item) => item.id === id) &&
      !persist((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== id),
      }))
    )
      return;
    removeRelations(`modulo-media-library-v2:items:${id}`);
    close();
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border">
        <div className="flex h-12 items-center gap-2 px-4">
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {visible.length === savedCount
              ? savedCount
              : `${visible.length} of ${savedCount}`}
          </span>
          <Button className="ml-auto" size="sm" onClick={create}>
            <Plus /> Add
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Search media"
            placeholder="Search titles, creators, and tags"
          />
          {!mediaType && (
            <ChoiceInline
              label="Filter by media type"
              prefix="Type"
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as MediaType | "All")}
              options={["All", ...MEDIA_TYPES]}
              className="min-w-44"
            />
          )}
          <ChoiceInline
            label="Sort media"
            prefix="Sort"
            value={sort}
            onChange={(value) => setSort(value as SortMode)}
            options={["Recent", "Title", "Rating", "Progress"]}
            className="min-w-40"
          />
          <div
            className="flex h-9 items-center rounded-md border border-border-strong p-0.5"
            aria-label="Library layout"
          >
            <Button
              size="icon-sm"
              variant={layout === "grid" ? "secondary" : "ghost"}
              aria-label="Cover grid"
              aria-pressed={layout === "grid"}
              onClick={() => setLayout("grid")}
            >
              <Grid2X2 />
            </Button>
            <Button
              size="icon-sm"
              variant={layout === "list" ? "secondary" : "ghost"}
              aria-label="List"
              aria-pressed={layout === "list"}
              onClick={() => setLayout("list")}
            >
              <List />
            </Button>
          </div>
          <Button
            size="sm"
            variant={tagsOpen ? "secondary" : "outline"}
            aria-pressed={tagsOpen}
            aria-controls="media-tag-sidebar"
            onClick={() => setTagsOpen((open) => !open)}
          >
            <Tags /> Tags
            {selectedTags.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xxs font-semibold text-primary-foreground tabular-nums">
                {selectedTags.length}
              </span>
            )}
          </Button>
        </div>
        <nav
          className="flex min-w-0 overflow-x-auto px-4"
          aria-label="Media status"
        >
          {(["All", ...MEDIA_STATUSES] as const).map((status) => (
            <button
              key={status}
              type="button"
              aria-current={statusFilter === status ? "page" : undefined}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "h-9 shrink-0 border-b-2 px-3 text-xs transition-colors",
                statusFilter === status
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {status}
            </button>
          ))}
        </nav>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {visible.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-5">
              <EmptyPanel
                icon={Icon}
                title={`No ${mediaType ? title.toLowerCase() : "media"} found`}
                description="Add an item or change the current filters."
                onReset={
                  savedCount
                    ? () => {
                        setQuery("");
                        setStatusFilter("All");
                        setTypeFilter("All");
                        setSelectedTags([]);
                      }
                    : undefined
                }
                action={
                  !savedCount ? (
                    <Button size="sm" onClick={create}>
                      Add media
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              {layout === "grid" ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-x-4 gap-y-5 p-4 sm:grid-cols-[repeat(auto-fill,minmax(132px,1fr))]">
                  {pageItems.map((item) => (
                    <MediaCoverCard
                      key={item.id}
                      item={item}
                      uniformArtwork={!mediaType}
                      onOpen={() => {
                        setSelectedId(item.id);
                        setEditing(false);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border border-b border-border">
                  {pageItems.map((item) => (
                    <MediaListRow
                      key={item.id}
                      item={item}
                      onOpen={() => {
                        setSelectedId(item.id);
                        setEditing(false);
                      }}
                    />
                  ))}
                </div>
              )}
              {pageCount > 1 && (
                <div className="flex items-center justify-center gap-3 border-t border-border px-4 py-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 0}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    Page {currentPage + 1} of {pageCount}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage >= pageCount - 1}
                    onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </div>
        <MediaTagSidebar
          facets={facets}
          selected={selectedTags}
          onToggle={toggleTag}
          onClear={() => setSelectedTags([])}
          className={cn(
            tagsOpen ? "flex" : "hidden",
            "max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-20 max-md:shadow-lg",
          )}
        />
      </div>

      <EntryPopover
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={selected?.title ?? "Media item"}
        description={
          selected ? `${selected.type} · ${selected.status}` : undefined
        }
        className="max-w-4xl"
      >
        {selected && (
          <EntryPopoverBody>
            {editing && draft ? (
              <MediaEditor
                item={draft}
                fixedType={mediaType}
                projects={para.projects
                  .filter((project) => !project.archivedAt)
                  .map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                areas={para.areas
                  .filter((area) => !area.archivedAt)
                  .map((area) => ({ value: area.id, label: area.name }))}
                onPatch={(update) =>
                  setDraft((current) =>
                    current ? { ...current, ...update } : current,
                  )
                }
                onDelete={() => remove(selected.id)}
                onDone={save}
                onCancel={cancel}
                error={saveError}
                onClose={close}
              />
            ) : (
              <MediaOverview
                item={selected}
                onEdit={() => {
                  setDraft(selected);
                  setEditing(true);
                  setSaveError("");
                }}
                onClose={close}
              />
            )}
          </EntryPopoverBody>
        )}
      </EntryPopover>
    </div>
  );
}

function MediaCoverCard({
  item,
  uniformArtwork,
  onOpen,
}: {
  item: MediaItem;
  uniformArtwork: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-w-0 text-left focus-visible:outline-none"
    >
      <MediaArtwork
        item={item}
        size="grid"
        forcePoster={uniformArtwork}
        className="transition-colors group-hover:border-foreground/40 group-focus-visible:ring-2 group-focus-visible:ring-ring"
      />
      <div className="pt-2">
        <div className="flex min-w-0 items-start gap-1">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5">
            {item.title}
          </p>
          {item.favorite && (
            <Heart
              className="mt-0.5 size-3.5 shrink-0 fill-destructive text-destructive"
              aria-label="Favorite"
            />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {item.creator || item.type}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          {item.rating > 0 ? (
            <RatingValue value={item.rating} />
          ) : (
            <span className="text-muted-foreground">Unrated</span>
          )}
          <span className="text-muted-foreground">·</span>
          <span className="truncate text-muted-foreground">{item.status}</span>
        </div>
        {item.totalProgress > 0 && (
          <Progress value={progressPercent(item)} className="mt-2 h-1" />
        )}
      </div>
    </button>
  );
}

function MediaListRow({
  item,
  onOpen,
}: {
  item: MediaItem;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <MediaArtwork item={item} size="thumb" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {item.favorite && (
            <Heart
              className="size-3.5 fill-destructive text-destructive"
              aria-label="Favorite"
            />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {item.creator || "Creator not set"} · {item.type}
        </p>
      </div>
      <Badge variant={STATUS_TONE[item.status]}>{item.status}</Badge>
      <div className="w-16 shrink-0">
        {item.rating > 0 ? (
          <RatingValue value={item.rating} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      {item.totalProgress > 0 && (
        <div className="hidden w-28 items-center gap-2 sm:flex">
          <Progress value={progressPercent(item)} className="h-1 flex-1" />
          <span className="text-xxs tabular-nums text-muted-foreground">
            {progressPercent(item)}%
          </span>
        </div>
      )}
    </button>
  );
}

function MediaArtwork({
  item,
  size,
  forcePoster = false,
  className,
}: {
  item: MediaItem;
  size: "grid" | "detail" | "thumb";
  forcePoster?: boolean;
  className?: string;
}) {
  const ArtworkIcon = MEDIA_TYPE_ICONS[item.type];
  const square = !forcePoster && SQUARE_MEDIA_TYPES.has(item.type);
  const landscape = !forcePoster && LANDSCAPE_MEDIA_TYPES.has(item.type);
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-md border border-border bg-surface-2",
        size === "grid" &&
          (landscape
            ? "aspect-video w-full"
            : square
              ? "aspect-square w-full"
              : "aspect-[2/3] w-full"),
        size === "detail" &&
          (landscape
            ? "aspect-video w-full max-w-64"
            : square
              ? "aspect-square w-full max-w-56"
              : "aspect-[2/3] w-full max-w-52"),
        size === "thumb" &&
          (landscape
            ? "aspect-video w-16 rounded-sm"
            : "aspect-[2/3] w-10 rounded-sm"),
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center",
          MEDIA_ARTWORK_TONES[item.type],
        )}
      >
        <ArtworkIcon
          className={cn(size === "thumb" ? "size-4" : "size-8")}
          aria-hidden="true"
        />
        {size !== "thumb" && (
          <span className="line-clamp-2 text-xs font-semibold leading-4">
            {item.title}
          </span>
        )}
      </div>
      {item.coverUrl && <ArtworkImage url={item.coverUrl} title={item.title} />}
    </div>
  );
}

function ArtworkImage({ url, title }: { url: string; title: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (failedUrl === url) return null;
  return (
    <img
      src={url}
      alt={`${title} cover`}
      loading="lazy"
      className="absolute inset-0 size-full object-cover"
      onError={() => setFailedUrl(url)}
    />
  );
}

function RatingValue({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium tabular-nums">
      <Star className="size-3.5 fill-warning text-warning" aria-hidden="true" />
      {Number.isInteger(value) ? value : value.toFixed(1)}
    </span>
  );
}

function RatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          aria-label={`${rating} stars`}
          onClick={() => onChange(value === rating ? 0 : rating)}
          className="rounded-sm p-1 text-muted-foreground hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={cn(
              "size-5",
              value >= rating && "fill-warning text-warning",
            )}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">
          {value} / 5
        </span>
      )}
    </div>
  );
}

function MediaOverview({
  item,
  onEdit,
  onClose,
}: {
  item: MediaItem;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[minmax(140px,190px)_1fr] sm:gap-7">
        <MediaArtwork item={item} size="detail" />
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_TONE[item.status]}>{item.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {item.type}
                </span>
              </div>
              <h2 className="text-xl font-semibold leading-tight">
                {item.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.creator || "Creator not set"}
              </p>
            </div>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Close"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-3 border-y border-border py-3">
            {item.rating > 0 ? (
              <RatingValue value={item.rating} />
            ) : (
              <span className="text-sm text-muted-foreground">Not rated</span>
            )}
            {item.favorite && (
              <span className="inline-flex items-center gap-1 text-xs text-destructive">
                <Heart className="size-4 fill-current" /> Favorite
              </span>
            )}
            <Button
              className="ml-auto"
              size="sm"
              variant="outline"
              onClick={onEdit}
            >
              Edit
            </Button>
          </div>
          {item.totalProgress > 0 && (
            <section className="py-4">
              <div className="mb-2 flex justify-between text-xs">
                <span className="font-medium">Progress</span>
                <span className="tabular-nums text-muted-foreground">
                  {item.currentProgress} / {item.totalProgress}{" "}
                  {item.progressUnit} · {progressPercent(item)}%
                </span>
              </div>
              <Progress value={progressPercent(item)} />
            </section>
          )}
          <dl className="grid grid-cols-2 border-t border-border text-sm">
            <MediaFact label="Started" value={item.startedAt} />
            <MediaFact label="Finished" value={item.finishedAt} />
            <MediaFact label="Tags" value={item.tags.join(", ")} />
            <MediaFact
              label="Source"
              value={item.sourceUrl ? "Linked" : undefined}
            />
          </dl>
        </div>
      </div>
      {item.notes && (
        <section className="mt-6 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Review & notes</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {item.notes}
          </p>
        </section>
      )}
      <CrossPluginLinks uid={`modulo-media-library-v2:items:${item.id}`} />
    </div>
  );
}

function MediaEditor({
  item,
  fixedType,
  projects,
  areas,
  onPatch,
  onDelete,
  onDone,
  onCancel,
  error,
  onClose,
}: {
  item: MediaItem;
  fixedType?: MediaType;
  projects: { value: string; label: string }[];
  areas: { value: string; label: string }[];
  onPatch: (update: Partial<MediaItem>) => void;
  onDelete: () => void;
  onDone: () => void;
  onCancel: () => void;
  error: string;
  onClose: () => void;
}) {
  return (
    <div
      className="p-5 sm:p-6"
      onKeyDown={(event) => {
        if (
          !event.nativeEvent.isComposing &&
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          event.key === "Enter"
        ) {
          event.preventDefault();
          onDone();
        }
      }}
    >
      <div className="mb-5 flex items-center gap-2 border-b border-border pb-3">
        <Input
          value={item.title}
          onChange={(event) => onPatch({ title: event.target.value })}
          className="h-10 min-w-0 flex-1 border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          aria-label="Title"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label={
            item.favorite ? "Remove from favorites" : "Add to favorites"
          }
          onClick={() => onPatch({ favorite: !item.favorite })}
        >
          <Heart
            className={cn(item.favorite && "fill-destructive text-destructive")}
          />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Close"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-[minmax(140px,190px)_1fr] sm:gap-7">
        <div>
          <MediaArtwork item={item} size="detail" />
          <Field label="Artwork URL" className="mt-3 block border-0 p-0">
            <Input
              type="url"
              value={item.coverUrl ?? ""}
              onChange={(event) =>
                onPatch({ coverUrl: event.target.value || undefined })
              }
              className="mt-1 h-8"
              placeholder="https://…"
            />
          </Field>
        </div>
        <div className="min-w-0">
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Your rating
            </p>
            <RatingPicker
              value={item.rating}
              onChange={(rating) => onPatch({ rating })}
            />
          </div>
          <section className="grid border-y border-border sm:grid-cols-2 sm:[&>*:nth-child(odd)]:border-r">
            {!fixedType && (
              <Choice
                label="Type"
                value={item.type}
                options={MEDIA_TYPES}
                onChange={(value) => {
                  const type = value as MediaType;
                  onPatch({ type, progressUnit: defaultProgressUnit(type) });
                }}
              />
            )}
            <Choice
              label="Status"
              value={item.status}
              options={MEDIA_STATUSES}
              onChange={(value) => onPatch({ status: value as MediaStatus })}
            />
            <Field label="Author or creator">
              <Input
                value={item.creator ?? ""}
                onChange={(event) =>
                  onPatch({ creator: event.target.value || undefined })
                }
                className="h-8"
              />
            </Field>
            <Field label={`Current ${item.progressUnit}`}>
              <Input
                type="number"
                min={0}
                value={item.currentProgress}
                onChange={(event) =>
                  onPatch({
                    currentProgress: Math.max(
                      0,
                      Number(event.target.value) || 0,
                    ),
                  })
                }
                className="h-8"
              />
            </Field>
            <Field label={`Total ${item.progressUnit}`}>
              <Input
                type="number"
                min={0}
                value={item.totalProgress}
                onChange={(event) =>
                  onPatch({
                    totalProgress: Math.max(0, Number(event.target.value) || 0),
                  })
                }
                className="h-8"
              />
            </Field>
            <Field label="Started">
              <Input
                type="date"
                value={item.startedAt ?? ""}
                onChange={(event) =>
                  onPatch({ startedAt: event.target.value || undefined })
                }
                className="h-8"
              />
            </Field>
            <Field label="Finished">
              <Input
                type="date"
                value={item.finishedAt ?? ""}
                onChange={(event) =>
                  onPatch({ finishedAt: event.target.value || undefined })
                }
                className="h-8"
              />
            </Field>
            <Choice
              label="PARA Project"
              value={item.projectId ?? ""}
              clearable
              clearLabel="No project"
              options={projects}
              onChange={(projectId) =>
                onPatch({ projectId: projectId || undefined })
              }
            />
            <Choice
              label="PARA Area"
              value={item.areaId ?? ""}
              clearable
              clearLabel="No area"
              options={areas}
              onChange={(areaId) => onPatch({ areaId: areaId || undefined })}
            />
            <Field label="Source URL">
              <Input
                type="url"
                value={item.sourceUrl ?? ""}
                onChange={(event) =>
                  onPatch({ sourceUrl: event.target.value || undefined })
                }
                className="h-8"
                placeholder="https://…"
              />
            </Field>
            <Field label="Tags">
              <Input
                value={item.tags.join(", ")}
                onChange={(event) =>
                  onPatch({
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
                className="h-8"
                placeholder="fiction, research"
              />
            </Field>
          </section>
        </div>
      </div>
      <Field label="Review & notes" className="mt-5 block border-0 p-0">
        <Textarea
          value={item.notes ?? ""}
          onChange={(event) =>
            onPatch({ notes: event.target.value || undefined })
          }
          rows={7}
          className="mt-1"
          placeholder="What did you think? Add highlights, context, or a short review…"
        />
      </Field>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <footer className="mt-5 flex items-center gap-2 border-t border-border pt-3">
        <ConfirmDelete
          itemName={item.title}
          itemLabel="media item"
          consequence="Its review and cross-plugin links will also be removed."
          onDelete={onDelete}
        />
        <Button size="sm" className="ml-auto" onClick={onDone}>
          Save changes
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </footer>
    </div>
  );
}

function MediaFact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="border-b border-border py-2 pr-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate">{value || "Not set"}</dd>
    </div>
  );
}
