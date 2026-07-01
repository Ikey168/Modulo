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
import { Hover } from './atoms';
import type { CoreNote, CoreLink } from '@modulo/core';

function isAnchored(note: CoreNote): boolean {
  return Boolean(note.isOnBlockchain || note.isDecentralized);
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

interface GNode extends SimulationNodeDatum {
  id: number;
  title: string;
  anchored: boolean;
}
type GLink = SimulationLinkDatum<GNode>;

interface GraphViewProps {
  notes: CoreNote[];
  links: CoreLink[];
  selectedId: number | null;
  onSelectNode: (id: number) => void;
  onOpenNote: () => void;
}

export function GraphView({ notes, links, selectedId, onSelectNode, onOpenNote }: GraphViewProps) {
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
    let timer: ReturnType<typeof setTimeout>;

    function tryInit() {
      const canvas = canvasRef.current;
      if (!canvas) {
        timer = setTimeout(tryInit, 80);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        timer = setTimeout(tryInit, 80);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      const W = rect.width;
      const H = rect.height;

      const nodeData: GNode[] = notes.map((n) => ({ id: n.id, title: n.title, anchored: isAnchored(n) }));
      const idSet = new Set(nodeData.map((n) => n.id));
      const linkData: GLink[] = links
        .filter((l) => idSet.has(l.sourceNoteId) && idSet.has(l.targetNoteId))
        .map((l) => ({ source: l.sourceNoteId, target: l.targetNoteId }));

      if (simRef.current) simRef.current.stop();
      const sim = forceSimulation<GNode>(nodeData)
        .force('link', forceLink<GNode, GLink>(linkData).id((d) => d.id).distance(140))
        .force('charge', forceManyBody().strength(-320))
        .force('center', forceCenter(W / 2, H / 2))
        .force('collision', forceCollide().radius(36));
      simRef.current = sim;

      function draw() {
        const selId = selIdRef.current;
        if (!ctx) return;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(42,42,48,.45)';
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
          ctx.strokeStyle = 'rgba(62,62,70,.7)';
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
            ctx.fillStyle = 'rgba(79,70,229,.12)';
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
          ctx.fillStyle = sel ? '#818cf8' : nd.anchored ? '#22c55e' : '#4f46e5';
          ctx.fill();
          ctx.font = `${sel ? 500 : 400} 11px "DM Sans",sans-serif`;
          ctx.fillStyle = sel ? '#e4e4e7' : '#71717a';
          ctx.textAlign = 'center';
          const lbl = nd.title.length > 18 ? nd.title.slice(0, 16) + '…' : nd.title;
          ctx.fillText(lbl, nd.x, nd.y + r + 14);
        });
      }

      sim.on('tick', draw);

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

      setTimeout(() => {
        if (simRef.current) simRef.current.alphaTarget(0);
      }, 3000);
    }

    timer = setTimeout(tryInit, 50);
    return () => {
      clearTimeout(timer);
      if (simRef.current) {
        simRef.current.stop();
        simRef.current = null;
      }
    };
  }, [notes, links]);

  const selNote = graphSel != null ? notes.find((n) => n.id === graphSel) ?? null : null;

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#0a0a0b', animation: 'fadeIn .15s ease' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(14,14,18,.88)', border: '1px solid #2a2a30', borderRadius: 8, padding: '9px 16px', backdropFilter: 'blur(10px)' }}>
        {([['#4f46e5', 'Note'], ['#22c55e', 'Anchored'], ['#818cf8', 'Selected']] as const).map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: '#71717a' }}>{l}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: '#2a2a30' }} />
        <span style={{ fontSize: 11.5, color: '#3f3f46' }}>Click a node to focus</span>
      </div>

      {selNote && (
        <div style={{ position: 'absolute', bottom: 24, left: 24, background: '#111114', border: '1px solid #2a2a30', borderRadius: 10, padding: '16px 18px', minWidth: 230, animation: 'fadeUp .2s ease', boxShadow: '0 4px 24px rgba(0,0,0,.4)' }}>
          <div style={{ fontWeight: 600, color: '#f4f4f5', fontSize: 14, marginBottom: 4 }}>{selNote.title}</div>
          <div style={{ fontSize: 11.5, color: '#52525b', marginBottom: 12 }}>{relativeTime(selNote.updatedAt)}</div>
          <Hover
            onClick={() => {
              onSelectNode(selNote.id);
              onOpenNote();
            }}
            style={{ fontSize: 12, color: '#818cf8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 500 }}
            hoverStyle={{ color: '#a5b4fc' }}
          >
            Open note
            <svg width={11} height={11} viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5h7M6 3l2.5 2.5L6 8" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Hover>
        </div>
      )}
    </div>
  );
}
