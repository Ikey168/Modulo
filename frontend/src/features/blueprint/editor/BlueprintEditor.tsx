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
    <div className="bp-editor">
      <header className="bp-toolbar">
        <div className="bp-toolbar__group">
          <input
            className="bp-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Blueprint name"
            aria-label="Blueprint name"
          />
          <input
            className="bp-desc-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            aria-label="Blueprint description"
          />
        </div>
        <div className="bp-toolbar__group">
          <button type="button" onClick={handleNew}>New</button>
          <select
            className="bp-load-select"
            value=""
            onChange={(e) => e.target.value && handleLoad(e.target.value)}
            aria-label="Load blueprint"
          >
            <option value="">Load…</option>
            {saved.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
          <button type="button" className="bp-btn-primary" onClick={handleSave}>Save</button>
          <button type="button" onClick={handleTestRun}>Test Run</button>
          <button type="button" onClick={handleDebugLastRun}>Debug Last Run</button>
          {loadedName && (
            <button type="button" onClick={() => setShowConsent(true)}>Permissions</button>
          )}
          {highlighted.size > 0 && (
            <button type="button" onClick={clearHighlight}>Clear Highlight</button>
          )}
        </div>
      </header>

      {status && <div className={`bp-status bp-status--${status.kind}`}>{status.text}</div>}

      <div className="bp-body">
        <NodePalette catalog={catalog} onAdd={(d) => addNode(d)} />
        <div className="bp-canvas" ref={wrapperRef} onDragOver={onDragOver} onDrop={onDrop}>
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
            <Background gap={18} color="#1e1e24" />
            <Controls />
            <MiniMap pannable zoomable className="bp-minimap" />
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
