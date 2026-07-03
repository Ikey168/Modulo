import { useEffect, useRef, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { Button, Card, EmptyState, Separator, Tooltip, TooltipContent, TooltipTrigger } from '@/ui';
import type { CoreNote, CoreLink } from '@modulo/core';
import { isAnchored, relativeTime } from './workspaceUtils';

interface GNode extends SimulationNodeDatum {
  id: number;
  title: string;
  anchored: boolean;
}
type GLink = SimulationLinkDatum<GNode>;

interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_K = 0.3;
const MAX_K = 3.5;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Resolves design tokens (HSL channel CSS variables on <html>) into canvas
 * paint strings, cached per token/alpha until `invalidate()` (theme change).
 */
function createTokenPalette() {
  let cache = new Map<string, string>();
  let font: string | null = null;
  return {
    color(token: string, alpha?: number): string {
      const key = alpha == null ? token : `${token}/${alpha}`;
      let v = cache.get(key);
      if (!v) {
        const channels = getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '0 0% 50%';
        v = alpha == null ? `hsl(${channels})` : `hsl(${channels} / ${alpha})`;
        cache.set(key, v);
      }
      return v;
    },
    fontFamily(): string {
      if (!font) font = getComputedStyle(document.body).fontFamily || 'sans-serif';
      return font;
    },
    invalidate() {
      cache = new Map();
      font = null;
    },
  };
}

interface GraphViewProps {
  notes: CoreNote[];
  links: CoreLink[];
  selectedId: number | null;
  onSelectNode: (id: number) => void;
  onOpenNote: () => void;
}

export function GraphView({ notes, links, selectedId, onSelectNode, onOpenNote }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Simulation<GNode, GLink> | null>(null);
  const selIdRef = useRef<number | null>(selectedId);
  const hoverRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelectNode);
  const [graphSel, setGraphSel] = useState<number | null>(null);

  // Imperative handles the zoom/fit controls call into (set inside the effect).
  const zoomByRef = useRef<(factor: number) => void>(() => {});
  const fitRef = useRef<() => void>(() => {});

  useEffect(() => {
    selIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    onSelectRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = createTokenPalette();
    let W = 0;
    let H = 0;
    const view: View = { x: 0, y: 0, k: 1 };
    let initialised = false;

    const nodeData: GNode[] = notes.map((n) => ({ id: n.id, title: n.title, anchored: isAnchored(n) }));
    const idSet = new Set(nodeData.map((n) => n.id));
    const linkData: GLink[] = links
      .filter((l) => idSet.has(l.sourceNoteId) && idSet.has(l.targetNoteId))
      .map((l) => ({ source: l.sourceNoteId, target: l.targetNoteId }));

    // Adjacency for hover-neighbourhood highlighting.
    const adj = new Map<number, Set<number>>();
    const link = (a: number, b: number) => {
      let set = adj.get(a);
      if (!set) {
        set = new Set();
        adj.set(a, set);
      }
      set.add(b);
    };
    linkData.forEach((l) => {
      link(l.source as number, l.target as number);
      link(l.target as number, l.source as number);
    });

    if (simRef.current) simRef.current.stop();
    const sim = forceSimulation<GNode>(nodeData)
      .force('link', forceLink<GNode, GLink>(linkData).id((d) => d.id).distance(140))
      .force('charge', forceManyBody().strength(-320))
      .force('center', forceCenter(0, 0))
      .force('collision', forceCollide().radius(36));
    simRef.current = sim;

    const toWorld = (mx: number, my: number) => ({ x: (mx - view.x) / view.k, y: (my - view.y) / view.k });

    function nodeAt(mx: number, my: number): GNode | null {
      const w = toWorld(mx, my);
      const rHit = Math.max(11, 15 / view.k);
      let best: GNode | null = null;
      let bestD = rHit;
      for (const nd of nodeData) {
        if (nd.x == null || nd.y == null) continue;
        const d = Math.hypot(nd.x - w.x, nd.y - w.y);
        if (d < bestD) {
          bestD = d;
          best = nd;
        }
      }
      return best;
    }

    function draw() {
      if (!ctx || !W || !H) return;
      const selId = selIdRef.current;
      const hoverId = hoverRef.current;
      const neighbours = hoverId != null ? adj.get(hoverId) : null;
      ctx.clearRect(0, 0, W, H);

      // Dot grid that pans and scales with the view (fixed to world).
      const step = 44 * view.k;
      if (step >= 10) {
        ctx.fillStyle = palette.color('--border-strong', 0.4);
        const ox = ((view.x % step) + step) % step;
        const oy = ((view.y % step) + step) % step;
        const dot = Math.min(1.4, 0.7 * view.k + 0.3);
        for (let x = ox; x < W; x += step) {
          for (let y = oy; y < H; y += step) {
            ctx.beginPath();
            ctx.arc(x, y, dot, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.save();
      ctx.translate(view.x, view.y);
      ctx.scale(view.k, view.k);

      // Links
      linkData.forEach((lk) => {
        const s = lk.source as GNode;
        const t = lk.target as GNode;
        if (s.x == null || t.x == null) return;
        const active = hoverId == null || s.id === hoverId || t.id === hoverId;
        ctx.beginPath();
        ctx.strokeStyle = palette.color('--border-strong', active ? 0.85 : 0.2);
        ctx.lineWidth = (hoverId != null && active ? 2 : 1.5) / view.k;
        ctx.moveTo(s.x, s.y ?? 0);
        ctx.lineTo(t.x, t.y ?? 0);
        ctx.stroke();
      });

      // Nodes
      nodeData.forEach((nd) => {
        if (nd.x == null || nd.y == null) return;
        const sel = nd.id === selId;
        const hov = nd.id === hoverId;
        const dim = hoverId != null && !hov && !neighbours?.has(nd.id);
        const r = sel ? 9 : 6.5;
        ctx.globalAlpha = dim ? 0.3 : 1;
        if (sel || hov) {
          ctx.beginPath();
          ctx.arc(nd.x, nd.y, r + 7, 0, Math.PI * 2);
          ctx.fillStyle = palette.color('--primary', hov ? 0.18 : 0.12);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
        ctx.fillStyle = sel
          ? palette.color('--primary-hover')
          : nd.anchored
            ? palette.color('--success')
            : palette.color('--primary');
        ctx.fill();
        ctx.font = `${sel || hov ? 500 : 400} 11px ${palette.fontFamily()}`;
        ctx.fillStyle = sel || hov ? palette.color('--foreground') : palette.color('--muted-foreground');
        ctx.textAlign = 'center';
        const lbl = nd.title.length > 18 ? nd.title.slice(0, 16) + '…' : nd.title;
        ctx.fillText(lbl, nd.x, nd.y + r + 14);
        ctx.globalAlpha = 1;
      });

      ctx.restore();
    }

    function fitView() {
      if (!W || !H) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const nd of nodeData) {
        if (nd.x == null || nd.y == null) continue;
        minX = Math.min(minX, nd.x);
        minY = Math.min(minY, nd.y);
        maxX = Math.max(maxX, nd.x);
        maxY = Math.max(maxY, nd.y);
      }
      if (!Number.isFinite(minX)) {
        view.x = W / 2;
        view.y = H / 2;
        view.k = 1;
        draw();
        return;
      }
      const pad = 70;
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      const k = clamp(Math.min((W - pad * 2) / bw, (H - pad * 2) / bh), MIN_K, 1.6);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      view.k = k;
      view.x = W / 2 - cx * k;
      view.y = H / 2 - cy * k;
      draw();
    }

    function zoomAround(mx: number, my: number, factor: number) {
      const k2 = clamp(view.k * factor, MIN_K, MAX_K);
      view.x = mx - (mx - view.x) * (k2 / view.k);
      view.y = my - (my - view.y) * (k2 / view.k);
      view.k = k2;
      draw();
    }

    zoomByRef.current = (factor: number) => zoomAround(W / 2, H / 2, factor);
    fitRef.current = fitView;

    function resize() {
      if (!container || !canvas || !ctx) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      W = rect.width;
      H = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!initialised) {
        initialised = true;
        view.x = W / 2;
        view.y = H / 2;
        view.k = 1;
        sim.alpha(1).restart();
      }
      draw();
    }

    sim.on('tick', draw);

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const mo = new MutationObserver(() => {
      palette.invalidate();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // ── Interaction: hover / drag-pan / drag-node / wheel-zoom ──────────────
    let mode: 'none' | 'pan' | 'drag' = 'none';
    let dragNode: GNode | null = null;
    let last = { x: 0, y: 0 };
    let moved = 0;

    const localPos = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = localPos(e);
      last = p;
      moved = 0;
      const hit = nodeAt(p.x, p.y);
      if (hit) {
        mode = 'drag';
        dragNode = hit;
        const w = toWorld(p.x, p.y);
        hit.fx = w.x;
        hit.fy = w.y;
        sim.alphaTarget(0.3).restart();
      } else {
        mode = 'pan';
      }
      canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = localPos(e);
      if (mode === 'drag' && dragNode) {
        const w = toWorld(p.x, p.y);
        dragNode.fx = w.x;
        dragNode.fy = w.y;
        moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
        last = p;
        draw();
      } else if (mode === 'pan') {
        view.x += p.x - last.x;
        view.y += p.y - last.y;
        moved += Math.abs(p.x - last.x) + Math.abs(p.y - last.y);
        last = p;
        draw();
      } else {
        const hit = nodeAt(p.x, p.y);
        const id = hit ? hit.id : null;
        if (id !== hoverRef.current) {
          hoverRef.current = id;
          canvas.style.cursor = id ? 'pointer' : 'default';
          draw();
        }
      }
    };

    const endPointer = () => {
      const wasClick = moved < 5;
      if (mode === 'drag' && dragNode) {
        dragNode.fx = null;
        dragNode.fy = null;
        sim.alphaTarget(0);
        if (wasClick) {
          selIdRef.current = dragNode.id;
          onSelectRef.current(dragNode.id);
          setGraphSel(dragNode.id);
        }
      }
      mode = 'none';
      dragNode = null;
      canvas.style.cursor = hoverRef.current ? 'pointer' : 'default';
      draw();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAround(e.clientX - r.left, e.clientY - r.top, factor);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Frame the graph once the layout has warmed, then let it cool.
    const settle = setTimeout(() => {
      fitView();
      if (simRef.current) simRef.current.alphaTarget(0);
    }, 2500);

    return () => {
      clearTimeout(settle);
      ro.disconnect();
      mo.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('wheel', onWheel);
      zoomByRef.current = () => {};
      fitRef.current = () => {};
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }
    };
  }, [notes, links]);

  const selNote = graphSel != null ? notes.find((n) => n.id === graphSel) ?? null : null;

  return (
    <div ref={containerRef} className="relative flex-1 animate-fade-in overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        role="img"
        aria-label="Knowledge graph of notes and their links"
      />

      {notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <EmptyState
            title="Nothing to graph yet"
            description="Create a few notes and link them to see your knowledge graph."
          />
        </div>
      )}

      <div className="absolute left-4 top-4 flex items-center gap-4 rounded-lg border border-border bg-surface/90 px-4 py-2 backdrop-blur-md">
        {([
          ['bg-primary', 'Note'],
          ['bg-success', 'Anchored'],
          ['bg-primary-hover', 'Selected'],
        ] as const).map(([dot, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`size-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
            <span className="text-xxs text-muted-foreground">{label}</span>
          </div>
        ))}
        <Separator orientation="vertical" className="hidden h-3.5 sm:block" />
        <span className="hidden text-xxs text-muted-foreground sm:inline">Scroll to zoom · drag to pan · drag a node to move</span>
      </div>

      {/* Zoom / fit controls */}
      {notes.length > 0 && (
        <div className="absolute bottom-5 right-5 flex flex-col overflow-hidden rounded-lg border border-border bg-surface/90 backdrop-blur-md">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-none" onClick={() => zoomByRef.current(1.3)} aria-label="Zoom in">
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Zoom in</TooltipContent>
          </Tooltip>
          <Separator />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-none" onClick={() => zoomByRef.current(1 / 1.3)} aria-label="Zoom out">
                <Minus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Zoom out</TooltipContent>
          </Tooltip>
          <Separator />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 rounded-none" onClick={() => fitRef.current()} aria-label="Fit graph to view">
                <Maximize2 className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Fit to view</TooltipContent>
          </Tooltip>
        </div>
      )}

      {selNote && (
        <Card className="absolute bottom-5 left-5 max-w-[calc(100%-2.5rem)] animate-fade-up p-4 shadow-lg sm:min-w-[230px]">
          <div className="mb-0.5 truncate text-sm font-semibold text-foreground">{selNote.title}</div>
          <div className="mb-2.5 text-xxs text-muted-foreground">{relativeTime(selNote.updatedAt)}</div>
          <Button
            variant="link"
            size="sm"
            className="h-auto gap-1 p-0 text-xs"
            onClick={() => {
              onSelectNode(selNote.id);
              onOpenNote();
            }}
          >
            Open note
            <svg viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M2 5.5h7M6 3l2.5 2.5L6 8" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </Card>
      )}
    </div>
  );
}
