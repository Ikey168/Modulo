# Blueprint visual editor

A React Flow node editor for composing blueprints
([milestone 15](https://github.com/Ikey168/Modulo/milestone/15), issue #274).
It is the visual front-end for the node model (#271), graph IR (#272), and
interpreter (#273). Reachable at `/blueprints` (authenticated).

Source: `frontend/src/features/blueprint/editor/`.

> This is the **React Flow** editor for building blueprints — distinct from the
> d3-force/Sigma knowledge-graph renderer used for the notes graph.

## Layout

- **Palette** (left) — every catalog node, grouped by category (Triggers /
  Actions / Logic) with a substring search over title, type, and description.
  Click a node to drop it on the canvas, or drag it to a position.
- **Canvas** (center) — the React Flow graph with pan/zoom, a minimap, and a
  background grid. Select an edge/node and press `Delete`/`Backspace` to remove it.
- **Toolbar** (top) — name/description, New, Load…, Save, Test Run,
  Debug Last Run.

## Typed handles & pin validation

Each node renders a [React Flow `Handle`](https://reactflow.dev) per pin:

- **Exec pins** are white diamonds — an input on the left (entry) and named
  outputs on the right (`then`, or `true`/`false` for a branch). Triggers have
  no exec input.
- **Data pins** are colour-coded circles by type (`string`, `note`, `boolean`,
  …), inputs on the left and outputs on the right.

Handle ids encode the pin's kind, direction, and name (see
`reactFlowAdapter.ts`). On every connection attempt the editor decodes both
endpoints and calls the shared `validateConnection` from `nodeModel.ts`, so the
canvas enforces exactly the same rules as the IR and the backend interpreter:

- exec→exec and data→data only (no crossing the streams);
- an output may only connect to an input;
- data types must be assignable (`any` is the wildcard);
- you cannot wire into a trigger's (non-existent) exec input, or connect a node
  to itself.

Illegal connections are rejected live (React Flow's `isValidConnection`) and a
reason is shown in the status bar if a drop is attempted.

## Save / load

The toolbar serializes the canvas to a `BlueprintIR` (`flowToIR`) and persists
it through `blueprintService` to `/api/blueprints` (stored in `plugin_registry`,
`runtime = 'BLUEPRINT'`). Loading deserializes the IR back onto the canvas
(`irToFlow`), restoring node positions saved in `BlueprintNode.position`.
Editing a loaded blueprint issues a `PUT`, which records a version-history
snapshot in `plugin_config_history`.

## Run / debug

- **Test Run** — a static client-side trace: follows exec edges from every
  trigger and highlights the reachable path (both arms of a branch, since
  conditions are not evaluated client-side). A quick visual check with no
  backend call.
- **Debug Last Run** — fetches the blueprint's execution history from
  `GET /api/blueprints/{name}/executions` and highlights the nodes that the most
  recent real run actually executed. The interpreter records the executed node
  ids in each `plugin_execution_logs` success row (a `[nodes=…]` token), which
  the backend parses into `executedNodes`.
