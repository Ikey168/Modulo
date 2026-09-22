export type DayBlockId = 'sleep' | 'morning-prime' | 'deep-work-a' | 'deep-work-b' | 'reset' | 'ops-people' | 'early-evening' | 'wind-down';

export interface DayBlockDefinition {
  id: DayBlockId;
  label: string;
  start: string;
  end: string;
  taskTypes: string;
  color: 'gray' | 'orange' | 'blue' | 'green' | 'purple' | 'yellow' | 'pink';
}

/** Mirrors the Block select and latest Day Blocks SOP in the Notion system. */
export const DAY_BLOCKS: DayBlockDefinition[] = [
  { id: 'sleep', label: 'Block 1 — Sleep', start: '23:00', end: '06:15', taskTypes: 'Sleep and recovery', color: 'gray' },
  { id: 'morning-prime', label: 'Block 2 — Morning Prime', start: '06:15', end: '08:45', taskTypes: 'Gym, transition, breakfast, and today’s deliverable', color: 'orange' },
  { id: 'deep-work-a', label: 'Block 3 — Deep Work A', start: '08:45', end: '11:45', taskTypes: 'Priority A shipping; hardest work first', color: 'blue' },
  { id: 'deep-work-b', label: 'Block 4 — Deep Work B', start: '11:45', end: '13:45', taskTypes: 'Continuation, integration, tests, and polish', color: 'blue' },
  { id: 'reset', label: 'Block 5 — Reset', start: '13:45', end: '14:30', taskTypes: 'Lunch, walk, and mental reset', color: 'green' },
  { id: 'ops-people', label: 'Block 6 — Ops & People', start: '14:30', end: '16:30', taskTypes: 'Meetings, reviews, coordination, and essential admin', color: 'purple' },
  { id: 'early-evening', label: 'Block 7 — Early Evening', start: '16:30', end: '20:30', taskTypes: 'Deep Work C, logistics, recovery, or light social', color: 'yellow' },
  { id: 'wind-down', label: 'Block 8 — Wind-down', start: '20:30', end: '23:00', taskTypes: 'Shutdown, tomorrow prep, reading, and sleep hygiene', color: 'pink' },
];

export interface DayBlockItem { text: string; done: boolean; }
export type DayBlockPlan = Record<DayBlockId, DayBlockItem[]>;

export function emptyDayBlockPlan(): DayBlockPlan {
  return {
    sleep: [],
    'morning-prime': [],
    'deep-work-a': [],
    'deep-work-b': [],
    reset: [],
    'ops-people': [],
    'early-evening': [],
    'wind-down': [],
  };
}

export function dayBlockIdFromLabel(value: string): DayBlockId | undefined {
  const normalized = value.trim().toLowerCase();
  return DAY_BLOCKS.find((block) => normalized === block.label.toLowerCase() || normalized.includes(block.id.replace(/-/g, ' ')))?.id;
}

export function dayBlockPlanOf(body: string): DayBlockPlan {
  const plan = emptyDayBlockPlan(); let inSection = false; let current: DayBlockId | undefined;
  for (const line of body.split('\n')) {
    if (/^##\s+day blocks\s*$/i.test(line.trim())) { inSection = true; current = undefined; continue; }
    if (inSection && /^##\s+/.test(line.trim())) break;
    if (!inSection) continue;
    const heading = /^###\s+(.+?)(?:\s+\(\d{2}:\d{2}[–—-]\d{2}:\d{2}\))?\s*$/.exec(line.trim());
    if (heading) { current = DAY_BLOCKS.find((block) => heading[1].startsWith(block.label))?.id; continue; }
    const item = /^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/.exec(line);
    if (current && item) plan[current].push({ text: item[2].trim(), done: item[1].toLowerCase() === 'x' });
  }
  return plan;
}

export function dayBlocksMarkdown(plan: DayBlockPlan = emptyDayBlockPlan()): string {
  const sections = DAY_BLOCKS.map((block) => {
    const items = plan[block.id].map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n');
    return `### ${block.label} (${block.start}–${block.end})\n_${block.taskTypes}_\n${items}`.trimEnd();
  });
  return `## Day blocks\n\n${sections.join('\n\n')}\n`;
}

export function replaceDayBlockPlan(body: string, plan: DayBlockPlan): string {
  const lines = body.split('\n'); const start = lines.findIndex((line) => /^##\s+day blocks\s*$/i.test(line.trim()));
  if (start >= 0) {
    let end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line.trim()));
    if (end < 0) end = lines.length;
    return [...lines.slice(0, start), dayBlocksMarkdown(plan).trimEnd(), '', ...lines.slice(end)].join('\n');
  }
  const notes = lines.findIndex((line) => /^##\s+notes\s*$/i.test(line.trim()));
  const insertion = [dayBlocksMarkdown(plan).trimEnd(), ''];
  return notes >= 0 ? [...lines.slice(0, notes), ...insertion, ...lines.slice(notes)].join('\n') : `${body.trimEnd()}\n\n${dayBlocksMarkdown(plan)}`;
}
