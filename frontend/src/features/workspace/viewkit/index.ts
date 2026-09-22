/**
 * Workspace view kit — the shared scaffold every plugin screen composes.
 *
 * The host gives a view an unpadded `overflow-hidden` box and nothing else, so
 * each view owns 100% of its page chrome. Nothing in `@/ui` composed that
 * chrome, so every author re-derived it: eight private `Shell`s, fourteen
 * `Metric`s, twelve `Panel`s, eleven `Field`s and `Empty`s, and the same
 * `const SELECT = 'h-8 rounded-md …'` string declared in sixteen files. This
 * module is that missing layer. Screens compose these; they do not re-roll them.
 */
export { ViewShell, ViewColumns, type ViewShellProps } from './ViewShell';
export { Panel, type PanelProps } from './Panel';
export { Metric, MetricRow, type MetricProps, type MetricTone } from './Metric';
export {
  Field,
  PropertyGlyph,
  FieldGroup,
  Choice,
  ChoiceInline,
  type FieldProps,
  type ChoiceProps,
  type ChoiceInlineProps,
  type ChoiceOption,
} from './Field';
export { ConfirmDelete, type ConfirmDeleteProps } from './ConfirmDelete';
export { Toolbar, SearchInput, FilterChips, type FilterChipsProps } from './Toolbar';
export { StatusBadge, type StatusBadgeProps } from './StatusBadge';
export { statusVariant, type StatusVariant } from './statusTone';
export { LinkOut } from './LinkOut';
export { EmptyPanel, type EmptyPanelProps } from './EmptyPanel';
export { ListRow, ListRows, type ListRowProps } from './ListRow';
export { RecordSheet, Fact, FactGrid, type RecordSheetProps, type FactProps } from './RecordSheet';
export { RecordCard, CardGrid, type RecordCardProps } from './RecordCard';
export { HealthLine, HealthList, type HealthLineProps } from './Health';
export { Sparkline, type SparklineProps } from './Sparkline';
export {
  NextUp,
  MetricStrip,
  QuickLinks,
  type NextAction,
  type NextActionTone,
  type StripStat,
} from './NextUp';
export {
  DashboardGrid,
  DashboardEmpty,
  HealthSummary,
  type HealthCheck,
} from './Dashboard';
export { useDeepLink } from './useDeepLink';
