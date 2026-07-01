# Blueprint node catalog

The node model for the modular plugin/blueprint system
([milestone 15](https://github.com/Ikey168/Modulo/milestone/15), issue #271).
A blueprint is a graph of **nodes** wired together; this document defines what a
node is, how pins connect, and the built-in node set.

Source: `frontend/src/features/blueprint/nodeModel.ts` (types + rules) and
`nodeCatalog.ts` (registry + core nodes). Descriptors are plain data
(JSON-serializable), so the backend interpreter (#273) consumes the same
catalog.

## Pins

Every node has two kinds of pins, mirroring Unreal Engine Blueprints:

- **Execution pins (exec / "flow")** — control *when* things run.
  - A node may have **one exec input** (entry). **Triggers have no exec input**;
    they are entry points.
  - A node has **zero or more named exec outputs**, e.g. `['then']`, or
    `['true', 'false']` for a branch.
- **Data pins** — typed values flowing between nodes (inputs and outputs).

## Data types

`type` is an open string, so plugins can introduce their own; built-ins:

| Type | Meaning |
| --- | --- |
| `string`, `number`, `boolean` | primitives |
| `note` | a single note reference |
| `noteList` | a list of notes |
| `tag` | a tag |
| `link` | a note-to-note link |
| `user` | a user reference |
| `any` | wildcard — compatible with every type, both directions |

## Connection rules

`validateConnection(from, to)` decides legality (direction is source → target):

1. **Exec ↔ exec, data ↔ data only.** You cannot wire an exec pin to a data pin.
2. **Exec:** the source's exec-output name must exist, and the target must have
   an exec input (so you cannot connect *into* a trigger).
3. **Data:** the source output pin and target input pin must exist, and the
   source type must be **assignable** to the target type
   (`isAssignable`: equal types, or either side is `any`).

Descriptors are also structurally validated on registration
(`validateDescriptor`): version ≥ 1, no duplicate pin ids / exec-output names,
and triggers must not declare an exec input.

## Versioning

Each descriptor has an integer `version`. **Bump it whenever pins change** so
existing blueprints (which reference `type@version`) keep resolving to the exact
signature they were built against. The catalog stores every registered version
and resolves the latest by default, or a pinned version on request.

## Extensibility

Plugins and packs contribute nodes into the same `NodeCatalog` via
`register(descriptor)` — that is what makes the system extensible. The built-in
set below is just the seed (`createCoreCatalog()`).

## Core node set

`capability` is the permission a node needs to run (enforced by #275).

### Triggers (entry points)

| Type | Exec out | Data outputs |
| --- | --- | --- |
| `trigger.note.saved` | `then` | `note: note` |
| `trigger.link.created` | `then` | `link: link`, `source: note`, `target: note` |
| `trigger.schedule` | `then` | `firedAt: string` (cron is node config, not a pin) |

### Actions

| Type | Exec | Data inputs | Data outputs | Capability |
| --- | --- | --- | --- | --- |
| `action.note.create` | in → `then` | `title: string`, `content: string` | `note: note` | `notes:write` |
| `action.tag.add` | in → `then` | `note: note`, `tag: string` | `note: note` | `notes:write` |
| `action.note.anchor` | in → `then` | `note: note` | `txHash: string` | `blockchain:anchor` |
| `action.ai.summarize` | in → `then` | `note: note` | `summary: string` | `ai:invoke` |

### Logic

| Type | Exec | Data inputs | Data outputs |
| --- | --- | --- | --- |
| `logic.branch` | in → `true`, `false` | `condition: boolean` | — |
| `logic.notes.filter` | in → `then` | `notes: noteList`, `tag: string` | `result: noteList` |

## Example (conceptual)

> On Note Saved → Summarize (AI) → Add Tag → Anchor On-Chain

```
trigger.note.saved.then ──► action.ai.summarize.[exec in]
trigger.note.saved.note ──► action.ai.summarize.note
action.ai.summarize.then ──► action.tag.add.[exec in]
action.ai.summarize.summary ──► action.tag.add.tag
trigger.note.saved.note  ──► action.tag.add.note
action.tag.add.then ──► action.note.anchor.[exec in]
action.tag.add.note ──► action.note.anchor.note
```

Every edge above passes `validateConnection`. Serializing this wiring is the IR
(#272); executing it on the event bus is the interpreter (#273); drawing it is
the editor (#274).
