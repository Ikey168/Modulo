import { useDurableRecord } from './plugins/useDurableRecord';
import { validateSeller, validateStrings, validateRetentionClass } from './operationalSchemas';
import { DEFAULT_CATEGORIES } from './euer';
import { DEFAULT_RETENTION_CLASSES, type RetentionClass } from './gobd';
import { DEFAULT_STAGES } from './pipeline';
const empty: string[] = [];
function retention(value: unknown): RetentionClass[] {
  if (!Array.isArray(value)) throw new Error('Invalid retention settings.');
  const classes = value.map(validateRetentionClass);
  if (new Set(classes.map(item => item.id)).size !== classes.length) throw new Error('Duplicate retention class IDs.');
  return classes;
}
export const useSellerSettings = () => useDurableRecord('rechnung', 'seller', 'modulo.invoice.seller', null, validateSeller, 'modulo-invoice-seller');
export const useExpenseCategories = () => useDurableRecord('euer-datev', 'categories', 'modulo.expense.categories', DEFAULT_CATEGORIES, validateStrings, 'modulo-euer-categories');
export const useExportedPeriods = () => useDurableRecord('euer-datev', 'exported-periods', 'modulo.expense.exported-periods', empty, validateStrings, 'modulo-euer-exported');
export const useRetentionSettings = () => useDurableRecord('gobd-vault', 'classes', 'modulo.retention.classes', DEFAULT_RETENTION_CLASSES, retention, 'modulo-gobd-classes');
export const usePipelineSettings = () => useDurableRecord('kanban', 'stages', 'modulo.pipeline.stages', DEFAULT_STAGES, validateStrings, 'modulo-pipeline-stages');
