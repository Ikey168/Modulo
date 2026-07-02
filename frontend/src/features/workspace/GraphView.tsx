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
import { Button, Card, EmptyState, Separator } from '@/ui';
import type { CoreNote, CoreLink } from '@modulo/core';
import { isAnchored, relativeTime } from './workspaceUtils';

interface GNode extends SimulationNodeDatum {
  id: number;
  title: string;
  anchored: boolean;
}
type GLink = SimulationLinkDatum<GNode>;

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
  const onSelectRef = useRef(onSelectNode);
  const [graphSel, setGraphSel] = useState<number | null>(null);

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

    const nodeData: GNode[] = notes.map((n) => ({ id: n.id, title: n.title, anchored: isAnchored(n) }));
    const idSet = new Set(nodeData.map((n) => n.id));
    const linkData: GLink[] = links
      .filter((l) => idSet.has(l.sourceNoteId) && idSet.has(l.targetNoteId))
      .map((l) => ({ source: l.sourceNoteId, target: l.targetNoteId }));

    if (simRef.current) simRef.current.stop();
    const sim = forceSimulation<GNode>(nodeData)
      .force('link', forceLink<GNode, GLink>(linkData).id((d) => d.id).distance(140))
      .force('charge', forceManyBody().strength(-320))
      .force('center', forceCenter(0, 0))
      .force('collision', forceCollide().radius(36));
    simRef.current = sim;

    function draw() {
      if (!ctx || !W || !H) return;
      const selId = selIdRef.current;
      ctx.clearRect(0, 0, W, H);
      // Dot grid backdrop
      ctx.fillStyle = palette.color('--border-strong', 0.45);
      for (let x = 0; x < W; x += 44) {
        for (let y = 0; y < H; y += 44) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      linkData.forEach((lk) => {
        const s = lk.source as GNode;
        const t = lk.target as GNode;
        if (s.x == null || t.x == null) return;
        ctx.beginPath();
        ctx.strokeStyle = palette.color('--border-strong', 0.8);
        ctx.lineWidth = 1.5;
        ctx.moveTo(s.x, s.y ?? 0);
        ctx.lineTo(t.x, t.y ?? 0);
        ctx.stroke();
      });
      nodeData.forEach((nd) => {
        if (nd.x == null || nd.y == null) return;
        const sel = nd.id === selId;
        const r = sel ? 9 : 6.5;
        if (sel) {
          ctx.beginPath();
          ctx.arc(nd.x, nd.y, r + 7, 0, Math.PI * 2);
          ctx.fillStyle = palette.color('--primary', 0.12);
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
        ctx.font = `${sel ? 500 : 400} 11px ${palette.fontFamily()}`;
        ctx.fillStyle = sel ? palette.color('--foreground') : palette.color('--muted-foreground');
        ctx.textAlign = 'center';
        const lbl = nd.title.length > 18 ? nd.title.slice(0, 16) + '…' : nd.title;
        ctx.fillText(lbl, nd.x, nd.y + r + 14);
      });
    }

    function resize() {
      if (!container || !canvas || !ctx) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const first = W === 0;
      W = rect.width;
      H = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sim.force('center', forceCenter(W / 2, H / 2));
      if (first) {
        sim.alpha(1).restart();
      } else {
        // Nudge the layout toward the new centre without a full re-run.
        sim.alpha(Math.max(sim.alpha(), 0.3)).restart();
      }
      draw();
    }

    sim.on('tick', draw);

    // Size from the live container; ResizeObserver replaces setTimeout polling
    // and keeps the canvas correct on window resizes / column changes.
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Re-resolve token colors and redraw when the theme changes.
    const mo = new MutationObserver(() => {
      palette.invalidate();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    canvas.onclick = (e) => {
      const r2 = canvas.getBoundingClientRect();
      const mx = e.clientX - r2.left;
      const my = e.clientY - r2.top;
      const hit = nodeData.find((nd) => {
        if (nd.x == null || nd.y == null) return false;
        const dx = nd.x - mx;
        const dy = nd.y - my;
        return Math.sqrt(dx * dx + dy * dy) < 14;
      });
      if (hit) {
        selIdRef.current = hit.id;
        onSelectRef.current(hit.id);
        setGraphSel(hit.id);
        draw();
      }
    };

    const settle = setTimeout(() => {
      if (simRef.current) simRef.current.alphaTarget(0);
    }, 3000);

    return () => {
      clearTimeout(settle);
      ro.disconnect();
      mo.disconnect();
      canvas.onclick = null;
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }
    };
  }, [notes, links]);

  const selNote = graphSel != null ? notes.find((n) => n.id === graphSel) ?? null : null;

  return (
    <div ref={containerRef} className="relative flex-1 animate-fade-in overflow-hidden bg-background">
      <canvas ref={canvasRef} className="block h-full w-full" role="img" aria-label="Knowledge graph of notes and their links" />

      {notes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <EmptyState
            title="Nothing to graph yet"
            description="Create a few notes and link them to see your knowledge graph."
          />
        </div>
      )}

      <div className="absolute left-4 top-4 flex items-center gap-4 rounded-lg border border-border-strong bg-surface/90 px-4 py-2 backdrop-blur-md">
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
        <Separator orientation="vertical" className="hidden h-3.5 bg-border-strong sm:block" />
        <span className="hidden text-xxs text-muted-foreground sm:inline">Click a node to focus</span>
      </div>

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
