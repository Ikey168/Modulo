# Migrating a workspace view onto the view kit

Import everything from `./viewkit` (or `../viewkit`). Reference implementation:
**`src/features/workspace/TtrpgViews.tsx`** — read it before starting.

## Kit API

| Export | Purpose |
|---|---|
| `ViewShell {title, subtitle?, icon?, actions?, toolbar?, bodyClassName?}` | The view root. Supplies the scroll container, header, padding. |
| `ViewColumns {children, rail?}` | Content plus a right rail that stacks above content below `xl`. |
| `Panel {title, icon?, description?, actions?, bodyClassName?}` | Bordered section with a header bar. Pass `bodyClassName="p-0"` for row lists. |
| `Metric {label, value, detail?, tone?, icon?}` / `MetricRow` | Stat tile. `tone`: `default \| success \| warning \| danger`. |
| `Field {label, hint?}` | Label + control, `htmlFor` wired automatically. **Every control needs one.** |
| `FieldGroup {legend, columns?}` | Groups related fields. Use to break up long forms. |
| `Choice {label, value, onChange, options, clearable?, placeholder?}` | Labelled `Select`. `options` is `string[]` or `{value,label}[]`. |
| `ConfirmDelete {itemName, itemLabel?, onDelete, consequence?}` | Delete with confirmation + accessible name. |
| `Toolbar`, `SearchInput`, `FilterChips {label, value, onChange, options}` | Header controls. |
| `StatusBadge {status, completedStatuses?, overrides?}` | Status pill on semantic tokens. |
| `LinkOut {url, label?}` | Renders a captured URL as a real link. |
| `EmptyPanel {icon?, title, description?, action?, size?}` | Zero state. `size`: `panel \| page`. |
| `ListRow {title, detail?, leading?, meta?, actions?, onOpen?, muted?}` / `ListRows` | One record in a list. |
| `RecordCard {title, badges?, detail?, onOpen?, actions?, footer?}` / `CardGrid` | Record tile. |
| `RecordSheet {record, onClose, title, subtitle?, badges?, renderEdit?, onSave?, actions?}` | Detail overlay: read view + Edit. |
| `Fact {label, value, placeholder?, wide?, emphasis?}` / `FactGrid` | Read-view field display. |
| `HealthLine {okay, action?}` / `HealthList` | Pass/warn lines in a health panel. |

## Rules

1. **Delete every local helper** named `Shell`, `Grid`, `Panel`, `Card`, `Metric`,
   `Empty`, `Field`, `Choice`, `ChoicePairs`, `Delete`, `Health`, `Muted`, `Okay`,
   `SummaryTile`, `Fact`, `Panel`. They are duplicated across files and have drifted.
   Use the kit. A local `Card` shadowing `@/ui`'s is always a bug.
2. **No raw `<select>`** and no `const SELECT = 'h-8 rounded-md …'`. Use `Choice`.
3. **No raw palette.** Replace `text-emerald-500`, `text-amber-600 dark:text-amber-400`,
   `border-amber-500/40` etc. with the `success` / `warning` / `destructive` / `info`
   tokens, or with `StatusBadge` / `Metric tone` / `HealthLine`.
4. **No arbitrary type sizes.** `text-[9px]`, `text-[10px]`, `text-[11px]` → `text-xxs`.
5. **Every destructive action uses `ConfirmDelete`**, and when the store cascades
   (deleting a parent drops children, orphans references, or wipes history) say so in
   `consequence`. Read the store module to find out what actually cascades.
6. **Every screen needs an edit path.** Views that could only create and delete must
   gain one: open the record in a `RecordSheet` with a `renderEdit` + `onSave`. Extract
   the create form into a shared `…Fields` component and use it for both, as
   `TtrpgViews.tsx` does with `CampaignFields`.
7. **Read view first.** A record shows `Fact`s; editing is behind an explicit Edit
   button. Do not render a collection as rows of always-live form inputs.
8. **Every list gets search**, and a `FilterChips` row when the type has a status or
   category enum. Sort where the data has an obvious key.
9. **URLs are links.** Any `url` / `datasheet` / `repository` / `sourceUrl` field must
   render through `LinkOut`.
10. **Fields that are captured must be displayed.** If the form collects it, the read
    view shows it.
11. **Real buttons.** No `<div onClick>`; no nested interactive inside `role="button"`;
    `type="button"` always; `aria-pressed` on toggles.
12. **Fix fake deep links.** A dashboard row that names a record must open that record,
    not just `navigateView('some-list')`. If the target view cannot select a record,
    keep the navigation but stop rendering the row as a per-record link.
13. For screen-only migrations, preserve store schemas, plugin registration, and
    public exports. Shared behavior changes belong in the view kit or shared store
    helpers and require regression tests; follow
    [ADR 0006](../../../../../docs/architecture/adr-0006-workspace-behavior.md).
    `RecordSheet.onSave` may return false or reject to retain a failed draft.
    Use `EmptyPanel.onReset` for filtered empty lists and the shared `SearchInput`
    for keyboard-accessible clearing.
14. Files are minified onto very long lines. Rewrite them as normal formatted code.

## Verification (all must pass before you report done)

```sh
cd /home/ik/Modulo/frontend
npx tsc --noEmit                       # must be silent
npx eslint <your files> --ext ts,tsx   # must be silent (0 errors, 0 warnings)
npx vitest run                         # 557 tests must still pass
```
