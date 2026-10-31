import type { OnboardingCase } from './liveData';

// ─────────────────────────────────────────────────────────────────────────────
// The relay's content model, and the layout pass that turns it into positions.
//
// The kit this came from had ONE architecture baked into relay.ts as module-level
// exports. This project walks three — individual, corporate and bulk — through
// the same component, so the kit's layout pass is wrapped in `buildModel()` and
// each journey is one call to it (./journeys/*.ts). The geometry, the layer/node/
// stage shapes and the TIMELINE / STAGE_START derivation are the kit's own,
// unchanged; only "which spec" became a parameter.
// ─────────────────────────────────────────────────────────────────────────────

// 'bank' is the bank's own estate — named, coloured and marked from the admin
// theme at render time (see RelayPage), so the legend says "Stanbic IBTC" under
// the Stanbic theme and "FirstBank" under FirstBank's.
export type Vendor = 'uipath' | 'bank' | 'data' | 'threep';

export interface RNode {
  id: string;
  label: string;
  sub?: string;
  plain: string;   // layman, "what this is" in one short line
  vendor: Vendor;
  logo: string;    // a name ProductLogo (./productLogos) or ./logos knows
  url?: string;
  layer: string;
  x: number; y: number; w: number; h: number;
}

const ORG = (import.meta.env.VITE_UIPATH_ORG_NAME as string) || 'mea';
const TENANT = (import.meta.env.VITE_UIPATH_TENANT_NAME as string) || 'DefaultTenant';
/** The tenant root, for product links. */
export const T = `https://staging.uipath.com/${ORG}/${TENANT}`;

// ── Geometry ─────────────────────────────────────────────────────────────────
// Layers are separate cards with gaps between them, and a gutter of their own to
// the left. That separation is what lets you see the stack as parts that come
// together rather than as a table.
export const CANVAS_W = 1120;
const X0 = 196, COL_W = 216, COL_GAP = 10;
const NODE_H = 64, ROW_GAP = 10, LAYER_GAP = 46, BAR_H = 50, TOP = 84;
const COLS = 4;
/** Full width of the product area — the orchestration bar spans it. */
export const SPAN_W = COLS * COL_W + (COLS - 1) * COL_GAP;
/** The container around a layer's products. */
export const BOX_PAD_X = 13, BOX_PAD_Y = 12;
export const BOX_X = X0 - BOX_PAD_X, BOX_W = SPAN_W + BOX_PAD_X * 2;

export interface Layer {
  key: string;
  label: string;
  sub: string;              // the gutter's one-line description
  vend: 'bank' | 'uip' | 'both' | 'threep';
  icon: string;             // lucide icon name, resolved in the component
  hero?: boolean;
  y: number; h: number;     // filled in by the layout pass
}

export type NodeSpec = Omit<RNode, 'x' | 'y' | 'w' | 'h' | 'layer'> & {
  bar?: boolean;
  /** Share of its row's width, 1 = an even quarter. Long product names need more
      than a quarter to stay on one line; their neighbours give it up. */
  flex?: number;
};
export type LayerSpec = Omit<Layer, 'y' | 'h'> & { nodes: NodeSpec[] };

export interface Stage {
  key: string;
  label: string;
  /** The card the case is "in" at this stage — it carries the LIVE chip. */
  primary: string;
  /** Where the first hand-off of the stage is drawn from. */
  from: string;
  /** Every product in play during the stage. */
  active: string[];
  /** The stage's own work, in order, each with the node that performs it. */
  tasks: { label: string; by: string }[];
  /** The human gate that closes the stage. Optional: a stage that ends in
      automated work (bulk's account opening, after its final sign-off) has none. */
  gate?: string;
  /** The node that gate is taken on. */
  gateBy?: string;
  note: string;     // technical
  plain: string;    // layman "what's happening"
}

export interface TimelineStep {
  stage: number;    // index into STAGES
  task: number;     // index into that stage's tasks; === tasks.length for its gate
  label: string;
  by: string;
  gate: boolean;
}

export type LabelOverrides = Record<string, string>;

export interface JourneySpec {
  key: string;
  /** Shown above the relay. */
  title: string;
  blurb: string;
  layers: LayerSpec[];
  stages: Stage[];
  /** What each product is DOING in a stage — the orchestration bar's pill. */
  actions: Record<string, Record<string, string>>;
  /** One line per product: why it is here. Shown in the "what's doing this now" panel. */
  why: Record<string, string>;
  /** The Maestro deployment the "Open in Maestro" links go to. */
  maestro: { url: string; folderKey: string };
  /** The node that IS this app — it gets the YOU ARE HERE tag. */
  thisApp?: string;
  /** The picker's cases. Status is a stage label. */
  cases: OnboardingCase[];
}

export interface RelayModel {
  key: string;
  title: string;
  blurb: string;
  LAYERS: Layer[];
  NODES: RNode[];
  NODE_BY_ID: Record<string, RNode>;
  STAGES: Stage[];
  ACTIONS: Record<string, Record<string, string>>;
  WHY: Record<string, string>;
  TIMELINE: TimelineStep[];
  STAGE_START: number[];
  STACK_BOTTOM: number;
  MAESTRO_CASE: string;
  FOLDER_KEY: string;
  thisApp?: string;
  cases: OnboardingCase[];
  statusToStage: (c: OnboardingCase) => number;
  nodeLabel: (id: string, ov: LabelOverrides) => string;
  nodeSub: (id: string, ov: LabelOverrides) => string | undefined;
}

export function buildModel(spec: JourneySpec): RelayModel {
  // ── Layout pass ────────────────────────────────────────────────────────────
  // Positions are derived, not hand-typed: a layer's height falls out of how many
  // rows its products wrap to, and the next layer starts immediately below it.
  const LAYERS: Layer[] = [];
  const NODES: RNode[] = [];
  let y = TOP;
  for (const L of spec.layers) {
    const bar = L.nodes.find((n) => n.bar);
    const grid = L.nodes.filter((n) => !n.bar);
    const rows = Math.ceil(grid.length / COLS);
    const gridTop = y + (bar ? BAR_H + ROW_GAP : 0);
    const h = (bar ? BAR_H + ROW_GAP : 0) + rows * NODE_H + (rows - 1) * ROW_GAP;

    if (bar) NODES.push({ ...bar, layer: L.key, x: X0, y, w: SPAN_W, h: BAR_H });
    // Rows are laid out by flex share of the columns they occupy, so a row of
    // three still stops at the third column while its members trade width.
    for (let r = 0; r * COLS < grid.length; r++) {
      const row = grid.slice(r * COLS, r * COLS + COLS);
      const cardTotal = row.length * COL_W;
      const sumFlex = row.reduce((t, n) => t + (n.flex ?? 1), 0);
      let x = X0;
      for (const n of row) {
        const w = (cardTotal * (n.flex ?? 1)) / sumFlex;
        NODES.push({ ...n, layer: L.key, x, y: gridTop + r * (NODE_H + ROW_GAP), w, h: NODE_H });
        x += w + COL_GAP;
      }
    }

    LAYERS.push({ key: L.key, label: L.label, sub: L.sub, vend: L.vend, icon: L.icon, hero: L.hero, y, h });
    y += h + LAYER_GAP;
  }
  const STACK_BOTTOM = LAYERS[LAYERS.length - 1].y + LAYERS[LAYERS.length - 1].h;
  const NODE_BY_ID: Record<string, RNode> = Object.fromEntries(NODES.map((n) => [n.id, n]));

  // ── The timeline ───────────────────────────────────────────────────────────
  // One TASK at a time, not one stage at a time: stepping by stage skipped the
  // thing the diagram is for — which product picks the work up next. A stage's
  // closing gate is the last entry in that stage.
  const TIMELINE: TimelineStep[] = spec.stages.flatMap((st, stage) => [
    ...st.tasks.map((t, task) => ({ stage, task, label: t.label, by: t.by, gate: false })),
    ...(st.gate && st.gateBy ? [{ stage, task: st.tasks.length, label: st.gate, by: st.gateBy, gate: true }] : []),
  ]);
  const STAGE_START: number[] = spec.stages.map((_, i) => TIMELINE.findIndex((t) => t.stage === i));

  if (import.meta.env.DEV) {
    // A typo in a stage's `by` or `active` renders as a silently missing card.
    for (const st of spec.stages) {
      for (const id of [st.primary, st.from, ...(st.gateBy ? [st.gateBy] : []), ...st.active, ...st.tasks.map((t) => t.by)]) {
        if (!NODE_BY_ID[id]) console.warn(`[relay:${spec.key}] stage ${st.key} names unknown node "${id}"`);
      }
    }
  }

  const stageIndex = new Map(spec.stages.map((s, i) => [s.label.toLowerCase(), i]));

  return {
    key: spec.key, title: spec.title, blurb: spec.blurb,
    LAYERS, NODES, NODE_BY_ID, STAGES: spec.stages, ACTIONS: spec.actions, WHY: spec.why,
    TIMELINE, STAGE_START, STACK_BOTTOM,
    MAESTRO_CASE: spec.maestro.url, FOLDER_KEY: spec.maestro.folderKey,
    thisApp: spec.thisApp, cases: spec.cases,
    statusToStage: (c) => stageIndex.get(String(c.Status).toLowerCase()) ?? 0,
    // A saved override wins over the baked-in default.
    nodeLabel: (id, ov) => (ov[`node.${id}.label`]?.trim() || NODE_BY_ID[id]?.label) ?? '',
    nodeSub: (id, ov) => ov[`node.${id}.sub`]?.trim() || NODE_BY_ID[id]?.sub,
  };
}

// SVG <text> doesn't wrap — split a long label into (at most) two word-balanced
// lines so it fits its box instead of overflowing. Short labels stay one line.
export function labelLines(label: string, maxChars = 24): string[] {
  if (label.length <= maxChars) return [label];
  const words = label.split(' ');
  if (words.length < 2) return [label];
  let best = 1, bestMax = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const m = Math.max(a, b);
    if (m < bestMax) { bestMax = m; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

export const layerLabel = (key: string, def: string, ov: LabelOverrides): string =>
  ov[`layer.${key}`]?.trim() || def;
export const layerSub = (key: string, def: string, ov: LabelOverrides): string =>
  ov[`layer.${key}.sub`]?.trim() || def;

// The fill an ACTIVE card takes — the vendor's colour, darkened enough to carry
// white text. A working card goes solid rather than picking up another tint.
export const VENDOR_DEEP: Record<Vendor, string> = {
  uipath: '#E5400F',
  bank: '#012169',     // fallback only — the theme's deepBlue wins
  data: '#4A5A68',
  threep: '#0D9488',
};

export const VENDOR_COLOR: Record<Vendor, string> = {
  uipath: '#fa4616',
  bank: '#0033A1',     // fallback only — the theme's primaryColor wins
  data: '#6b7c8f',
  threep: '#2dd4bf',
};
