# Android performance budget

Issue: [#492](https://github.com/Ikey168/Modulo/issues/492). Script:
`frontend/scripts/phonePerf.mjs` (`npm run phone:perf`), results in
`android-performance.json`.

A workspace of 2,000 notes and 4,000 links is rendered at a 412x883 touch
viewport with the CPU throttled 4x. Each view's code is loaded once first, so
the timings measure rendering the data rather than the dev server transforming
modules on first request.

| Measure | Budget | Measured (2026-09-26) |
| --- | --- | --- |
| Notes list shows its first rows | 5,000 ms | 4,065 ms |
| Open a note from a deep link | 2,500 ms | 1,268 ms |
| Graph draws its first frame | 5,000 ms | 1,806 ms |
| Canvas board | 4,000 ms | 545 ms |
| Longest main-thread task | 1,500 ms | 665 ms |
| JS heap after the run | 250 MB | 53 MB |

These are regression guards, not device numbers. They run against the dev
server's React development build, which is several times slower than the
production bundle, on whatever machine runs CI. They catch algorithmic
regressions; they do not replace timings on a device. Device cold start,
scrolling and memory are recorded by the release checklist (#497, #498). In CI
the step is report-only until the budgets are calibrated on the runner.

## What the first run found and fixed

| Problem | Before | After | Fix |
| --- | --- | --- | --- |
| The note properties panel rendered a select option for every note on each open note | 38 s to open a note, 434 MB heap | 1.3 s, 53 MB | Searchable link picker with at most 50 matches |
| The note tree built a row for every note before showing the list | 20 s | 4.1 s | First 50 roots, more as the end scrolls into view; a deep-linked note's root is always shown |
| `buildForest` scanned every note for each parent (quadratic) | 80 ms at 2,000 notes, growing quadratically | linear | Children grouped in one pass |
| A deep link to a note far down the tree rendered every row up to it | 12.8 s | 1.3 s | The selected root is rendered on its own |

## Touch interaction

Graph and Canvas disable browser gestures on their surface (`touch-action:
none`) so dragging moves nodes and cards instead of the page; two-finger pinch
zooms and pans around the fingers' midpoint (`pinchGesture.ts`). A second
finger during a node drag releases the node; lifting fingers after a pinch never
selects. Blueprint nodes are added by tapping the palette (a sheet on phones),
and React Flow connects handles by tap as well as drag.
