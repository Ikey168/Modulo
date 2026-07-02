// React Flow blueprint editor (#274). Composes catalog nodes on a canvas with
// typed handles, blocks illegal pin connections (validateConnection), supports
// palette/search to add nodes, save/load of the graph IR, and a basic run/debug
// that highlights the executed path (static trace, or the last real run from
// plugin_execution_logs).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './editor.css';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@/ui';

import { BlueprintIR } from '../blueprintIR';
import { createCoreCatalog } from '../nodeCatalog';
import { NodeDescriptor } from '../nodeModel';
import {
  BlueprintExecution,
  getBlueprintExecutions,
  listBlueprints,
  loadBlueprint,
  saveBlueprint,
  updateBlueprint,
  type BlueprintListItem,
} from '../blueprintService';
import { deriveRequiredCapabilities } from '../capabilities';
import { CapabilityConsentScreen } from './CapabilityConsentScreen';
import { BlueprintNodeView } from './BlueprintNodeView';
import { NodePalette } from './NodePalette';
import {
  FlowEdge,
  FlowNode,
  checkFlowConnection,
  flowToIR,
  irToFlow,
  makeId,
  parseHandle,
} from './reactFlowAdapter';

const nodeTypes = { blueprintNode: BlueprintNodeView };

interface Status {
  kind: 'info' | 'error' | 'success';
  text: string;
}

function EditorInner() {
  const catalog = useMemo(() => createCoreCatalog(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);
  const [name, setName] = useState('Untitled Blueprint');
  const [description, setDescription] = useState('');
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [saved, setSaved] = useState<BlueprintListItem[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [showConsent, setShowConsent] = useState(false);

  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const getDescriptor = useCallback(
    (nodeId: string): NodeDescriptor | undefined =>
      (nodes.find((n) => n.id === nodeId) as FlowNode | undefined)?.data.descriptor,
    [nodes],
  );

  // Apply highlight styling without mutating node identity each render.
  const styledNodes = useMemo<FlowNode[]>(
    () =>
      nodes.map((n) => ({
        ...n,
        className: highlighted.has(n.id) ? 'bp-node-highlight' : '',
      })),
    [nodes, highlighted],
  );

  const refreshList = useCallback(() => {
    listBlueprints()
      .then(setSaved)
      .catch(() => {
        /* listing is best-effort; ignore when backend is unavailable */
      });
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // --- Connection validation ------------------------------------------------

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => checkFlowConnection(connection as Connection, getDescriptor).ok,
    [getDescriptor],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const check = checkFlowConnection(connection, getDescriptor);
      if (!check.ok) {
        setStatus({ kind: 'error', text: `Illegal connection: ${check.reason}` });
        return;
      }
      const parsed = parseHandle(connection.sourceHandle);
      const isExec = parsed?.kind === 'exec';
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: makeId('e'),
            type: isExec ? 'smoothstep' : 'default',
            data: { kind: isExec ? 'exec' : 'data' },
            className: isExec ? 'bp-edge-exec' : 'bp-edge-data',
          },
          eds,
        ),
      );
      setStatus(null);
    },
    [getDescriptor, setEdges],
  );

  // --- Adding nodes ---------------------------------------------------------

  const addNode = useCallback(
    (descriptor: NodeDescriptor, position?: { x: number; y: number }) => {
      const pos = position ?? { x: 220, y: 120 };
      const node: FlowNode = {
        id: makeId('n'),
        type: 'blueprintNode',
        position: pos,
        data: { descriptor, nodeVersion: descriptor.version },
      };
      setNodes((nds) => [...nds, node]);
    },
    [setNodes],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const key = e.dataTransfer.getData('application/blueprint-node');
      if (!key) return;
      const [type, version] = key.split('@');
      const descriptor = catalog.get(type, version ? Number(version) : undefined);
      if (!descriptor) return;
      // screenToFlowPosition converts screen coordinates to flow canvas coordinates.
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(descriptor, position);
    },
    [addNode, catalog, screenToFlowPosition],
  );

  // --- Save / load ----------------------------------------------------------

  const buildIR = useCallback((): BlueprintIR => {
    const now = new Date().toISOString();
    return flowToIR(nodes, edges, {
      name,
      description: description || undefined,
      createdAt: now,
      updatedAt: now,
    });
  }, [nodes, edges, name, description]);

  const handleSave = useCallback(async () => {
    const ir = buildIR();
    try {
      if (loadedName) {
        await updateBlueprint(loadedName, { ir, changeReason: 'Edited in visual editor' });
        setStatus({ kind: 'success', text: `Saved “${loadedName}”.` });
      } else {
        await saveBlueprint({ name, description: description || undefined, ir });
        setLoadedName(name);
        setStatus({ kind: 'success', text: `Created “${name}”.` });
      }
      refreshList();
      // Show consent screen if there are capabilities that need to be reviewed.
      const requiredCaps = deriveRequiredCapabilities(nodes as FlowNode[]);
      if (requiredCaps.length > 0) setShowConsent(true);
    } catch (err) {
      setStatus({ kind: 'error', text: `Save failed: ${(err as Error).message}` });
    }
  }, [buildIR, loadedName, name, description, refreshList, nodes]);

  const handleLoad = useCallback(
    async (toLoad: string) => {
      try {
        const bp = await loadBlueprint(toLoad);
        const flow = irToFlow(bp.ir, catalog);
        setNodes(flow.nodes);
        setEdges(flow.edges);
        setName(bp.name);
        setDescription(bp.description ?? '');
        setLoadedName(bp.name);
        setHighlighted(new Set());
        setShowConsent(false);
        setStatus({ kind: 'info', text: `Loaded “${bp.name}”.` });
      } catch (err) {
        setStatus({ kind: 'error', text: `Load failed: ${(err as Error).message}` });
      }
    },
    [catalog, setNodes, setEdges],
  );

  const handleNew = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setName('Untitled Blueprint');
    setDescription('');
    setLoadedName(null);
    setHighlighted(new Set());
    setShowConsent(false);
    setStatus(null);
  }, [setNodes, setEdges]);

  // --- Run / debug ----------------------------------------------------------

  /**
   * Static "test run": follow exec edges from every trigger and highlight the
   * reachable path. Branches highlight both arms (we don't evaluate conditions
   * client-side). This gives a quick visual of the flow without a live run.
   */
  const handleTestRun = useCallback(() => {
    const execEdges = edges.filter((e) => e.data?.kind === 'exec');
    const adjacency = new Map<string, string[]>();
    for (const e of execEdges) {
      adjacency.set(e.source, [...(adjacency.get(e.source) ?? []), e.target]);
    }
    const triggers = nodes.filter((n) => n.data.descriptor.category === 'trigger').map((n) => n.id);
    const visited = new Set<string>();
    const stack = [...triggers];
    while (stack.length) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const next of adjacency.get(id) ?? []) stack.push(next);
    }
    setHighlighted(visited);
    setStatus(
      visited.size === 0
        ? { kind: 'info', text: 'No trigger to start from — add a trigger node.' }
        : { kind: 'info', text: `Traced ${visited.size} node(s) from ${triggers.length} trigger(s).` },
    );
  }, [nodes, edges]);

  /** Debug: highlight the path of the most recent real run from execution logs. */
  const handleDebugLastRun = useCallback(async () => {
    if (!loadedName) {
      setStatus({ kind: 'info', text: 'Save the blueprint first to load run history.' });
      return;
    }
    try {
      const runs: BlueprintExecution[] = await getBlueprintExecutions(loadedName, 10);
      const latest = runs.find((r) => r.executedNodes && r.executedNodes.length > 0);
      if (!latest) {
        setStatus({ kind: 'info', text: 'No recorded runs yet for this blueprint.' });
        setHighlighted(new Set());
        return;
      }
      setHighlighted(new Set(latest.executedNodes));
      setStatus({
        kind: latest.status === 'success' ? 'success' : 'error',
        text: `Last run (${latest.status}) at ${new Date(latest.createdAt).toLocaleString()} — ${latest.executedNodes!.length} node(s).`,
      });
    } catch (err) {
      setStatus({ kind: 'error', text: `Could not load runs: ${(err as Error).message}` });
    }
  }, [loadedName]);

  const clearHighlight = useCallback(() => setHighlighted(new Set()), []);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background font-sans text-[13px] text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-[200px] border-transparent bg-transparent px-1.5 font-semibold hover:border-border focus-visible:border-primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Blueprint name"
            aria-label="Blueprint name"
          />
          <Input
            className="h-8 w-[220px] border-transparent bg-transparent px-1.5 text-muted-foreground hover:border-border focus-visible:border-primary"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            aria-label="Blueprint description"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleNew}>New</Button>
          {/* Action select: value stays "" so the trigger always reads "Load…". */}
          <Select value="" onValueChange={(val) => { if (val) handleLoad(val); }}>
            <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Load blueprint">
              <SelectValue placeholder="Load…" />
            </SelectTrigger>
            <SelectContent>
              {saved.map((b) => (
                <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="primary" size="sm" onClick={handleSave}>Save</Button>
          <Button type="button" variant="outline" size="sm" onClick={handleTestRun}>Test Run</Button>
          <Button type="button" variant="ghost" size="sm" onClick={handleDebugLastRun}>Debug</Button>
          {loadedName && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowConsent(true)}>Permissions</Button>
          )}
          {highlighted.size > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearHighlight}>Clear Highlight</Button>
          )}
        </div>
      </header>

      {status && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'border-b border-border px-3.5 py-[7px] text-[12.5px]',
            status.kind === 'info' && 'bg-info/10 text-info',
            status.kind === 'error' && 'bg-destructive/10 text-destructive',
            status.kind === 'success' && 'bg-success/10 text-success',
          )}
        >
          {status.text}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <NodePalette catalog={catalog} onAdd={(d) => addNode(d)} />
        <div className="relative flex-1" ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={styledNodes}
            edges={edges as Edge[]}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
          >
            {/* Pattern colour comes from --xy-background-pattern-color (token-driven, editor.css). */}
            <Background gap={18} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
      </div>
      {showConsent && loadedName && (
        <CapabilityConsentScreen
          blueprintName={loadedName}
          onClose={() => setShowConsent(false)}
        />
      )}
    </div>
  );
}

export default function BlueprintEditor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
