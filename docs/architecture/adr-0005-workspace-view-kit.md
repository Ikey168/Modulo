# ADR 0005: A workspace view kit between `@/ui` and the plugin screens

- **Status:** Accepted
- **Context:** the plugin catalogue grew past a hundred contributed views while
  the shared UI layer stopped at `@/ui`. The screens drifted.

## Context

`src/ui` is a vendored shadcn/ui library, and its own header states the
contract: *"Screens compose these primitives instead of bespoke CSS."* Every
workspace view does import it. The problem is what `@/ui` does **not** cover.

The workspace host (`Workspace` → `HubView`) hands a contributed view an
`overflow-hidden` flex box with no padding and nothing else. Page chrome — the
scroll container, header, title, toolbar, body padding, loading/empty states —
is entirely the view's job, and no primitive composed it. So every author
re-derived it. An audit of `src/features/workspace/` found:

| Re-rolled locally | Copies |
|---|---|
| `Metric` (stat tile) | 14 |
| `Panel` (bordered section) | 12 |
| `Field`, `Empty` | 11 each |
| `Health` | 10 |
| `Choice` (labelled select) | 9 |
| `Shell` (page scaffold) | 8 |
| `Editor` | 7 |
| `Card` (shadowing `@/ui`'s) | 7 |
| `Delete` | 6 |

The copies had drifted. Five `Metric` implementations disagreed on prop names
(`warning` vs `danger` vs `tone`), on label size (`text-[10px]` /
`text-[11px]` / `text-xs`, where `text-xxs` *is* 11px) and on warning colour.
The string `const SELECT = 'h-8 rounded-md border border-border bg-surface px-2 text-xs'`
was declared independently in sixteen files, feeding raw `<select>` elements
that matched neither the height, the focus ring, nor the dark-mode surface of
the `Input` beside them.

Absent primitives produced absent behaviour, not just inconsistent styling:

- `AlertDialog` was used in two files out of ~140, so almost every delete fired
  on one click — including deletes that cascade. Removing an education node
  dropped its whole subtree plus sessions and assignments; removing a habit
  wiped its check-ins and streak; routing a PARA capture removed it from the
  inbox irreversibly.
- `Table` was used once in the whole application. Tabular data was drawn as
  `flex` rows with `ml-auto`, so nothing aligned and nothing sorted.
- Most collections had **no edit path at all** — create and delete only. A typo
  in a client's VAT ID was unfixable except by deleting and retyping the record.
- Where editing existed it was usually the only representation: every field
  rendered as an always-live input, frequently unlabelled. One assignments
  screen put eight live controls on every row, and forty assignments meant 320
  focusable controls on one page.
- Status colour was hand-rolled from the raw palette (`text-emerald-500`,
  `text-amber-600 dark:text-amber-400`) instead of the `success` / `warning` /
  `destructive` / `info` tokens, so it did not track the theme. One screen chose
  the colour by regex, and `/done|complete|valid/i` rendered "Invalid" green.

## Decision

Add `src/features/workspace/viewkit` — one layer between `@/ui` and the
screens, owning exactly the composition `@/ui` does not: page chrome, record
presentation, and the interaction patterns the good screens had already
converged on.

`ViewShell`, `ViewColumns`, `Panel`, `Metric`/`MetricRow`, `Field`/`FieldGroup`,
`Choice`/`ChoiceInline`, `ConfirmDelete`, `Toolbar`/`SearchInput`/`FilterChips`,
`StatusBadge`, `LinkOut`, `EmptyPanel`, `ListRow`/`ListRows`,
`RecordCard`/`CardGrid`, `RecordSheet`/`Fact`/`FactGrid`, `HealthLine`/`HealthList`.

Three of these encode a rule rather than a shape:

- **`ConfirmDelete` requires `itemName`** and takes a `consequence`, so a
  cascading delete has to say what it takes with it, and the trigger gets a real
  accessible name instead of announcing "button".
- **`Field` requires a visible `label`** and wires `htmlFor` itself.
- **`RecordSheet` separates read from edit** — `Fact`s by default, an editor
  behind an explicit Edit button, working on a draft that only reaches the store
  on Save. That both gives every collection an edit path and ends the
  per-keystroke `localStorage` re-serialisation of the whole store.

`statusVariant` matches whole statuses against explicit sets. It is deliberately
not substring or regex matching.

The kit is not `Card`. `Card`'s `p-5` is too generous for hub-tab density, which
is why twelve files invented `Panel` instead of using it; `Panel` is that shape,
made shared.

## Consequences

- Screens compose the kit; they do not re-roll `Shell`, `Metric`, `Panel`,
  `Field`, `Choice`, `Empty`, `Delete` or `Health`. A local `Card` shadowing
  `@/ui`'s is always a bug.
- `viewkit/MIGRATION.md` documents the API and the rules for converting a screen.
- `viewkit/__tests__/houseStyle.test.ts` enforces the conventions that had no
  enforcement: no raw `<select>`, no re-declared `SELECT` constant, no raw
  palette classes, no `text-[11px]`, no re-rolled scaffold. Its exemption list is
  meant to shrink and never grow.
- A categorical palette is still legitimate where colour encodes a category
  rather than a status — the six day-block tints in `PlannerView` and
  `CalendarView` stay as they are, since four semantic tokens cannot express six
  distinct blocks.
- This does not change the plugin contract. `WorkspaceViewProps`, view
  registration and the host's error isolation are untouched; the kit is only how
  a view draws itself.
