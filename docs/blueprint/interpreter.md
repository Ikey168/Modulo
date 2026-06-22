# Blueprint interpreter

The interpreter ([milestone 15](https://github.com/Ikey168/Modulo/milestone/15),
issue #273) executes a saved blueprint when its trigger fires. It runs on the
existing `PluginEventBus`, so blueprints react to the same events that plugins
do.

Source: `backend/src/main/java/com/modulo/blueprint/interpreter/`.

## Lifecycle

`BlueprintInterpreterService` implements `ApplicationRunner`, so on startup it
loads every blueprint (via `BlueprintRepository.findAll()`, runtime =
`BLUEPRINT`) and registers its triggers. The `BlueprintController` also calls
`registerBlueprint` / `unregisterBlueprint` on create / update / delete so the
running set always matches what is stored.

## Triggers → subscriptions

Each trigger node is wired to the event bus (or the scheduler):

| Trigger node | Bus event(s) / mechanism | Trigger outputs (pin → value) |
| --- | --- | --- |
| `trigger.note.saved` | `note.created`, `note.updated` | `note` → the saved `Note` |
| `trigger.link.created` | `link.created` (new `LinkEvent.LinkCreated`, published by `NoteLinkService.createLink`) | `link`, `source`, `target` |
| `trigger.schedule` | Spring `CronTrigger` using the node's `config.cron` | `firedAt` → ISO timestamp |

## Execution model

When a trigger fires:

1. The trigger's output pin values are seeded into a fresh
   `BlueprintExecutionContext`.
2. The interpreter follows the **exec edge** leaving the trigger's `then` pin,
   walking node to node (`executeExecFlow`).
3. Before each node runs, its **data inputs** are resolved by reading the
   values previously written by upstream nodes (`resolveInputs`, addressed as
   `nodeId:pinId`).
4. The node executes (`executeNode`); its outputs are written back into the
   context for downstream nodes.
5. The node returns which exec output to follow next — `then` for actions,
   or `true`/`false` for `logic.branch`.

### Node implementations

| Node | Effect |
| --- | --- |
| `action.note.create` | `NoteService.save(new Note(title, content))` |
| `action.tag.add` | `TagService.createOrGetTag(tag)`, attach to note, save |
| `action.note.anchor` | `BlockchainService.registerNote(...)` (async, 30s timeout) → `txHash` |
| `action.ai.summarize` | `OpenAIService.generateSummary(...)` → `summary` |
| `logic.branch` | routes to `true`/`false` based on the `condition` input |
| `logic.notes.filter` | filters `notes` to those carrying `tag` |

## Safety guards

- **Loop guard.** `BlueprintExecutionContext` counts steps and throws
  `BlueprintLoopGuardException` after `MAX_STEPS` (100). A cyclic exec graph is
  bounded and logged as an error instead of hanging.
- **Action timeout.** Async actions (AI, blockchain) are awaited with a 30s
  timeout; a failure is logged and the flow continues with an empty result
  rather than blocking the event thread indefinitely.
- **Isolation.** Each event handled gets its own `BlueprintExecutionContext`,
  so concurrent firings do not share pin state.

## Tracing

Every run writes a row to `plugin_execution_logs` (`execution_type =
'event_handle'`):

- `status = 'success'` with the step count and a run id, or
- `status = 'error'` with the failure message (including loop-guard hits).

`plugin_id` is the blueprint's `plugin_registry.id`, so a blueprint's execution
history is queryable alongside the rest of the plugin system.
