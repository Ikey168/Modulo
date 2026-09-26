import type { ControlOperation, ProcessView } from './praxisApi';

/** Why a control is greyed out, in words a user can act on. */
export function controlHint(view: ProcessView, operation: ControlOperation): string | undefined {
  const control = view.controls[operation];
  if (!control || control.available) return undefined;
  switch (control.reason) {
    case 'executor_unsupported': return `The ${view.summary.executor} executor does not support ${operation}.`;
    case 'executor_features_unknown': return `Modulo does not know which controls the ${view.summary.executor} executor supports.`;
    case 'process_not_failed': return 'Only a failed task can be retried.';
    default: return `Not possible while the task is ${view.state}.`;
  }
}
