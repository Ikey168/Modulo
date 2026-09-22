import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const ELECTRONICS_STORE_KEY = 'modulo-electronics-workbench-v1';
export const ELECTRONICS_PROJECT_TYPES = ['Circuit', 'Module', 'Instrument', 'Controller', 'Repair', 'Tool'] as const;
export const ELECTRONICS_PROJECT_STATUSES = ['Idea', 'Specification', 'Research', 'Prototype', 'Schematic', 'PCB', 'Assembly', 'Bring-up', 'Testing', 'Enclosure', 'Done', 'Archived'] as const;
export const PART_CATEGORIES = ['Resistor', 'Capacitor', 'Diode', 'Transistor', 'IC', 'Connector', 'Switch', 'Potentiometer', 'PCB', 'Mechanical', 'Consumable', 'Bench Equipment', 'Other'] as const;
export const BOM_STATUSES = ['Need', 'Ordered', 'In stock', 'Placed', 'Substituted'] as const;
export const LAB_ENTRY_TYPES = ['Design Decision', 'Prototype', 'Schematic', 'PCB', 'Assembly', 'Test', 'Firmware', 'Enclosure', 'Repair', 'Knowledge'] as const;
export const LAB_STATUSES = ['Planned', 'In progress', 'Passed', 'Failed', 'Done'] as const;

export interface ElectronicsProject { id: string; title: string; type: typeof ELECTRONICS_PROJECT_TYPES[number]; status: typeof ELECTRONICS_PROJECT_STATUSES[number]; revision: string; nextAction: string; definitionOfDone: string; repository?: string; targetDate?: string; }
export interface ElectronicsPart { id: string; name: string; category: typeof PART_CATEGORIES[number]; manufacturerPart?: string; footprint?: string; quantity: number; reorderAt: number; location: string; datasheet?: string; unitCost?: number; notes: string; }
export interface BomItem { id: string; projectId: string; partId?: string; description: string; quantity: number; status: typeof BOM_STATUSES[number]; vendor?: string; orderReference?: string; }
export interface LabEntry { id: string; projectId: string; type: typeof LAB_ENTRY_TYPES[number]; title: string; date: string; status: typeof LAB_STATUSES[number]; minutes: number; blockId?: DayBlockId; expected: string; observed: string; notes: string; }
export interface ElectronicsData { version: 1; projects: ElectronicsProject[]; parts: ElectronicsPart[]; bom: BomItem[]; lab: LabEntry[]; }
export const emptyElectronicsData = (): ElectronicsData => ({ version: 1, projects: [], parts: [], bom: [], lab: [] });
export const newElectronicsId = (prefix: 'project' | 'part' | 'bom' | 'lab'): string => `electronics-${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => text(value) || undefined;
const number = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const choice = <T extends string>(value: unknown, options: readonly T[], fallback: T): T => options.includes(value as T) ? value as T : fallback;
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;

export function parseElectronicsData(value: unknown): ElectronicsData {
  const raw = object(value);
  return { version: 1,
    projects: array(raw.projects).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({ id: text(item.id), title: text(item.title), type: choice(item.type, ELECTRONICS_PROJECT_TYPES, 'Circuit'), status: choice(item.status, ELECTRONICS_PROJECT_STATUSES, 'Idea'), revision: text(item.revision) || 'A', nextAction: text(item.nextAction), definitionOfDone: text(item.definitionOfDone), repository: optionalText(item.repository), targetDate: optionalText(item.targetDate) })),
    parts: array(raw.parts).map(object).filter((item) => text(item.id) && text(item.name)).map((item) => ({ id: text(item.id), name: text(item.name), category: choice(item.category, PART_CATEGORIES, 'Other'), manufacturerPart: optionalText(item.manufacturerPart), footprint: optionalText(item.footprint), quantity: Math.max(0, number(item.quantity)), reorderAt: Math.max(0, number(item.reorderAt)), location: text(item.location), datasheet: optionalText(item.datasheet), unitCost: item.unitCost === undefined ? undefined : Math.max(0, number(item.unitCost)), notes: text(item.notes) })),
    bom: array(raw.bom).map(object).filter((item) => text(item.id) && text(item.projectId)).map((item) => ({ id: text(item.id), projectId: text(item.projectId), partId: optionalText(item.partId), description: text(item.description), quantity: Math.max(1, number(item.quantity, 1)), status: choice(item.status, BOM_STATUSES, 'Need'), vendor: optionalText(item.vendor), orderReference: optionalText(item.orderReference) })),
    lab: array(raw.lab).map(object).filter((item) => text(item.id) && text(item.projectId) && text(item.title)).map((item) => ({ id: text(item.id), projectId: text(item.projectId), type: choice(item.type, LAB_ENTRY_TYPES, 'Prototype'), title: text(item.title), date: text(item.date), status: choice(item.status, LAB_STATUSES, 'Planned'), minutes: Math.max(0, number(item.minutes)), blockId: blockId(item.blockId), expected: text(item.expected), observed: text(item.observed), notes: text(item.notes) })),
  };
}
export const labEntriesOn = (data: ElectronicsData, date: string): LabEntry[] => data.lab.filter((item) => item.date === date).sort((a, b) => DAY_BLOCKS.findIndex((block) => block.id === a.blockId) - DAY_BLOCKS.findIndex((block) => block.id === b.blockId));
export const lowStockParts = (data: ElectronicsData): ElectronicsPart[] => data.parts.filter((item) => item.quantity <= item.reorderAt);
export const blockedBom = (data: ElectronicsData): BomItem[] => data.bom.filter((item) => ['Need', 'Ordered'].includes(item.status));
