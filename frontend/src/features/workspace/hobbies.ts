import { DAY_BLOCKS, type DayBlockId } from './dayBlocks';

export const HOBBY_STORE_KEY = 'modulo-hobbies-v1';

export const HOBBY_LAYERS = ['Kernel', 'Hardware', 'Network', 'Fuel', 'Output', 'Interface', 'Database', 'Exploration', 'Aesthetics', 'R&D', 'Multiplayer', 'Combat', 'Vertical', 'Fermentation', 'Custom'] as const;
export type HobbyLayer = typeof HOBBY_LAYERS[number];
export const HOBBY_STATUSES = ['Active', 'Queued', 'Trial', 'Paused', 'Retired'] as const;
export type HobbyStatus = typeof HOBBY_STATUSES[number];
export const HOBBY_ANCHORS = ['Artifact', 'Body', 'People', 'None'] as const;
export type HobbyAnchor = typeof HOBBY_ANCHORS[number];
export const HOBBY_ENERGIES = ['Low', 'Medium', 'High'] as const;
export type HobbyEnergy = typeof HOBBY_ENERGIES[number];
export const ENERGY_EFFECTS = ['Restorative', 'Neutral', 'Demanding'] as const;
export type EnergyEffect = typeof ENERGY_EFFECTS[number];
export const SOCIAL_MODES = ['Solo', 'Social', 'Flexible'] as const;
export type SocialMode = typeof SOCIAL_MODES[number];
export const HOBBY_SESSION_STATUSES = ['Planned', 'Done', 'Skipped'] as const;
export type HobbySessionStatus = typeof HOBBY_SESSION_STATUSES[number];

export interface HobbyLane {
  id: string;
  layer: HobbyLayer;
  title: string;
  purpose: string;
  status: HobbyStatus;
  anchor: HobbyAnchor;
  energy: HobbyEnergy;
  energyEffect: EnergyEffect;
  socialMode: SocialMode;
  artifactTarget: string;
  cadence: string;
  trialStart?: string;
  trialEnd?: string;
  setup: string;
  location: string;
  nextAction: string;
  projectId?: string;
  areaId?: string;
}

export interface HobbySession {
  id: string;
  hobbyId?: string;
  funActivityId?: string;
  date: string;
  durationMinutes: number;
  blockId?: DayBlockId;
  status: HobbySessionStatus;
  energyBefore?: HobbyEnergy;
  energyAfter?: HobbyEnergy;
  enjoyment?: number;
  people: string[];
  notes: string;
}

export interface HobbyArtifact {
  id: string;
  hobbyId: string;
  title: string;
  type: string;
  date: string;
  url?: string;
  notes: string;
}

export interface FunActivity {
  id: string;
  title: string;
  energy: HobbyEnergy;
  socialMode: SocialMode;
  restorative: boolean;
  screenBased: boolean;
  defaultMinutes: number;
  notes: string;
}

export interface HobbyData {
  version: 1;
  hobbies: HobbyLane[];
  sessions: HobbySession[];
  artifacts: HobbyArtifact[];
  funMenu: FunActivity[];
}

export const emptyHobbyData = (): HobbyData => ({ version: 1, hobbies: [], sessions: [], artifacts: [], funMenu: [] });
export const newHobbyId = (prefix: 'hobby' | 'session' | 'artifact' | 'fun'): string => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const optionalText = (value: unknown): string | undefined => text(value) || undefined;
const strings = (value: unknown): string[] => array(value).filter((item): item is string => typeof item === 'string' && item.length > 0);
const number = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback;
const choice = <T extends string>(value: unknown, values: readonly T[], fallback: T): T => values.includes(value as T) ? value as T : fallback;
const blockId = (value: unknown): DayBlockId | undefined => DAY_BLOCKS.some((block) => block.id === value) ? value as DayBlockId : undefined;

export function parseHobbyData(value: unknown): HobbyData {
  const raw = object(value);
  return {
    version: 1,
    hobbies: array(raw.hobbies).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), layer: choice(item.layer, HOBBY_LAYERS, 'Custom'), title: text(item.title), purpose: text(item.purpose),
      status: choice(item.status, HOBBY_STATUSES, 'Queued'), anchor: choice(item.anchor, HOBBY_ANCHORS, 'None'), energy: choice(item.energy, HOBBY_ENERGIES, 'Medium'),
      energyEffect: choice(item.energyEffect, ENERGY_EFFECTS, 'Neutral'), socialMode: choice(item.socialMode, SOCIAL_MODES, 'Flexible'), artifactTarget: text(item.artifactTarget), cadence: text(item.cadence),
      trialStart: optionalText(item.trialStart), trialEnd: optionalText(item.trialEnd), setup: text(item.setup), location: text(item.location), nextAction: text(item.nextAction), projectId: optionalText(item.projectId), areaId: optionalText(item.areaId),
    })),
    sessions: array(raw.sessions).map(object).filter((item) => text(item.id) && text(item.date)).map((item) => ({
      id: text(item.id), hobbyId: optionalText(item.hobbyId), funActivityId: optionalText(item.funActivityId), date: text(item.date), durationMinutes: Math.max(0, number(item.durationMinutes)), blockId: blockId(item.blockId),
      status: choice(item.status, HOBBY_SESSION_STATUSES, 'Planned'), energyBefore: HOBBY_ENERGIES.includes(item.energyBefore as HobbyEnergy) ? item.energyBefore as HobbyEnergy : undefined,
      energyAfter: HOBBY_ENERGIES.includes(item.energyAfter as HobbyEnergy) ? item.energyAfter as HobbyEnergy : undefined, enjoyment: item.enjoyment === undefined ? undefined : Math.min(5, Math.max(1, number(item.enjoyment, 3))), people: strings(item.people), notes: text(item.notes),
    })),
    artifacts: array(raw.artifacts).map(object).filter((item) => text(item.id) && text(item.hobbyId) && text(item.title)).map((item) => ({
      id: text(item.id), hobbyId: text(item.hobbyId), title: text(item.title), type: text(item.type), date: text(item.date), url: optionalText(item.url), notes: text(item.notes),
    })),
    funMenu: array(raw.funMenu).map(object).filter((item) => text(item.id) && text(item.title)).map((item) => ({
      id: text(item.id), title: text(item.title), energy: choice(item.energy, HOBBY_ENERGIES, 'Medium'), socialMode: choice(item.socialMode, SOCIAL_MODES, 'Flexible'), restorative: Boolean(item.restorative), screenBased: Boolean(item.screenBased), defaultMinutes: Math.max(5, number(item.defaultMinutes, 60)), notes: text(item.notes),
    })),
  };
}

type Seed = Omit<HobbyLane, 'id' | 'trialStart' | 'trialEnd' | 'projectId' | 'areaId'>;
const lane = (layer: HobbyLayer, title: string, purpose: string, status: HobbyStatus, anchor: HobbyAnchor, energy: HobbyEnergy, energyEffect: EnergyEffect, socialMode: SocialMode, artifactTarget: string, cadence: string, setup: string, location: string, nextAction: string): Seed => ({ layer, title, purpose, status, anchor, energy, energyEffect, socialMode, artifactTarget, cadence, setup, location, nextAction });

export const DOCUMENTED_HOBBY_STACK: Seed[] = [
  lane('Kernel', 'Tech — Homelab, Code & Infra', 'Career leverage and logical systems-building.', 'Active', 'Artifact', 'High', 'Demanding', 'Solo', 'Deployed service, automation, or contribution', 'Weekly build block', 'Pi 5, DietPi, Docker, Paperless, Pi-hole, Portainer', 'Home lab', 'Choose the next Grafana, VictoriaMetrics, or Kubernetes experiment.'),
  lane('Hardware', 'Weightlifting', 'Strength and discipline.', 'Active', 'Body', 'High', 'Restorative', 'Solo', 'Training milestone', 'Program schedule', 'Training plan and gym bag ready', 'Gym', 'Complete the next programmed session.'),
  lane('Network', 'Running', 'Cardio, ADHD regulation, and decompression.', 'Active', 'None', 'Medium', 'Restorative', 'Flexible', 'Race, route, or personal best', '2–3 runs / week', 'Shoes and route ready', 'Outdoors', 'Schedule the next easy or quality run.'),
  lane('Fuel', 'Cooking', 'Nutrition, chemistry, and reliable batch preparation.', 'Active', 'None', 'Medium', 'Restorative', 'Flexible', 'Meal, recipe, or prep system', 'Weekly rotation', 'Meal plan and ingredients ready', 'Kitchen', 'Choose the next batch-prep recipe.'),
  lane('Output', 'Music Production', 'Creative expression through sampling, arrangement, and mixing.', 'Active', 'None', 'High', 'Demanding', 'Solo', 'Track sketch or finished track', 'Weekly studio block', 'REAPER template and samples ready', 'Studio', 'Pre-select the sound or arrangement task.'),
  lane('Interface', 'Guitar + Piano', 'Performance, flow, harmony, and theory.', 'Active', 'None', 'Medium', 'Restorative', 'Solo', 'Recording, repertoire piece, or demonstrated technique', 'Short recurring practice', 'Instrument visible and exercise selected', 'Home', 'Choose one technique or piece for the next session.'),
  lane('Database', 'Reading + Zettelkasten', 'Turn books and papers into durable knowledge and models.', 'Active', 'None', 'Low', 'Restorative', 'Solo', 'Processed note for every book or paper', 'Several short sessions / week', 'Reading queue and capture path ready', 'Anywhere', 'Pick the next source and its intended output.'),
  lane('Exploration', 'Urbex', 'Adventure, observation, and photography.', 'Active', 'People', 'High', 'Restorative', 'Flexible', 'Photo set or field note', 'Monthly expedition', 'Safe route, permissions, camera, and companion plan', 'Berlin', 'Select a safe, legal exploration node.'),
  lane('Aesthetics', 'Fashion + Style', 'Identity, signal, silhouette, and archetype experiments.', 'Active', 'None', 'Low', 'Restorative', 'Solo', 'Outfit experiment or style-playbook update', 'Seasonal sprint', 'Capsule visible and experiment defined', 'Home / Berlin', 'Define the next silhouette experiment.'),
  lane('R&D', 'Makerspace + Modular Synths', 'Electronics, audio, fabrication, and building.', 'Queued', 'Artifact', 'High', 'Demanding', 'Social', 'Working module', 'Six-session trial', 'Components, PCB, faceplate, soldering access', 'Makerspace', 'Build a passive multiple or mixer.'),
  lane('Multiplayer', 'TTRPGs', 'Recurring community and collaborative storytelling.', 'Queued', 'People', 'Medium', 'Restorative', 'Social', 'Played session or campaign artifact', 'Weekly group', 'Choose a system and find a fixed group', 'Berlin / online', 'Find a weekly Cyberpunk RED, Shadowrun, or D&D group.'),
  lane('Combat', 'Boxing / Muay Thai / BJJ', 'Confidence and embodied power.', 'Queued', 'Body', 'High', 'Demanding', 'Social', 'Six-week practice streak', '2–3 sessions / week', 'Choose one discipline and nearby gym', 'Gym', 'Book one trial class.'),
  lane('Vertical', 'Bouldering', 'Physical problem-solving and low-friction social contact.', 'Queued', 'None', 'High', 'Restorative', 'Social', 'Completed problem or grade milestone', 'Weekly', 'Shoes or rental plan ready', 'Bouldering gym', 'Choose a regular gym and session slot.'),
  lane('Fermentation', 'Fermentation', 'Iterative systems, food craft, and patience.', 'Queued', 'Artifact', 'Low', 'Restorative', 'Solo', 'Kimchi, kombucha, or sourdough batch', 'Batch cadence', 'Jar, ingredients, and reminder ready', 'Kitchen', 'Choose one first ferment and start date.'),
];

export function mergeDocumentedHobbyStack(data: HobbyData): HobbyData {
  const existing = new Set(data.hobbies.map((item) => item.title.toLocaleLowerCase()));
  const additions = DOCUMENTED_HOBBY_STACK.filter((item) => !existing.has(item.title.toLocaleLowerCase())).map((item, index) => ({ ...item, id: `documented-hobby-${index + 1}` }));
  const starterFun: FunActivity[] = data.funMenu.length ? [] : [
    { id: 'fun-low-solo', title: 'Low-energy restorative option', energy: 'Low', socialMode: 'Solo', restorative: true, screenBased: false, defaultMinutes: 45, notes: 'Keep the setup frictionless and name the actual activity.' },
    { id: 'fun-medium-flexible', title: 'Medium-energy play option', energy: 'Medium', socialMode: 'Flexible', restorative: true, screenBased: false, defaultMinutes: 60, notes: 'A creative, movement, or exploration choice.' },
    { id: 'fun-high-social', title: 'High-energy social option', energy: 'High', socialMode: 'Social', restorative: true, screenBased: false, defaultMinutes: 90, notes: 'A recurring community or shared adventure.' },
  ];
  return { ...data, hobbies: [...data.hobbies, ...additions], funMenu: [...data.funMenu, ...starterFun] };
}

export const hobbySessionsOn = (data: HobbyData, date: string): HobbySession[] => data.sessions.filter((session) => session.date === date).sort((a, b) => {
  const order = (id?: DayBlockId) => id ? DAY_BLOCKS.findIndex((block) => block.id === id) : DAY_BLOCKS.length;
  return order(a.blockId) - order(b.blockId);
});
export const completedSessions = (data: HobbyData, hobbyId: string): number => data.sessions.filter((session) => session.hobbyId === hobbyId && session.status === 'Done').length;
export const trialProgress = (data: HobbyData, hobbyId: string): number => Math.min(100, completedSessions(data, hobbyId) / 6 * 100);
export const peopleYouCanText = (data: HobbyData): string[] => [...new Set(data.sessions.filter((session) => session.status === 'Done').flatMap((session) => session.people).map((person) => person.trim()).filter(Boolean))].sort();
export const weeklyHobbySessions = (data: HobbyData, start: string, end: string): HobbySession[] => data.sessions.filter((session) => session.date >= start && session.date <= end && session.status === 'Done');
export const restorativeRatio = (data: HobbyData, sessions: HobbySession[]): number => {
  if (!sessions.length) return 0;
  const restorative = sessions.filter((session) => session.funActivityId ? data.funMenu.find((item) => item.id === session.funActivityId)?.restorative : data.hobbies.find((item) => item.id === session.hobbyId)?.energyEffect === 'Restorative').length;
  return restorative / sessions.length;
};
