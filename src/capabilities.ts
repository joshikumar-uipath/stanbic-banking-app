// Hardcoded capability tiles for the Explore tab. Not configurable per
// tenant — every tenant sees the same six tiles in the same order.

const TEAL = '#FF3333';
const ORANGE = '#FF3333';

export interface Capability {
  id: string;
  label: string;
  subtitle: string;
  videoSrc?: string;
  videoScale?: number;
  gradient: string;
  accentColor: string;
  glowColor: string;
  hasVideo: boolean;
}

export const CAPABILITIES: Capability[] = [
  {
    id: 'agents',
    label: 'Agents',
    subtitle: 'AI agents, always on',
    videoSrc: undefined,
    gradient: 'linear-gradient(145deg,#03131a 0%,#072838 100%)',
    accentColor: TEAL,
    glowColor: 'rgba(255,51,51,0.55)',
    hasVideo: true,
  },
  {
    id: 'rpa',
    label: 'RPA Workflow',
    subtitle: 'Robotic process automation',
    videoSrc: './rpa-card.mp4',
    videoScale: 3.7,
    gradient: 'linear-gradient(145deg,#160804 0%,#3d1106 100%)',
    accentColor: ORANGE,
    glowColor: 'rgba(255,51,51,0.5)',
    hasVideo: false,
  },
  {
    id: 'maestro',
    label: 'Maestro',
    subtitle: 'Orchestrate at scale',
    videoSrc: './maestro-card.mp4',
    videoScale: 2.5,
    gradient: 'linear-gradient(145deg,#03131a 0%,#072838 100%)',
    accentColor: TEAL,
    glowColor: 'rgba(255,51,51,0.45)',
    hasVideo: false,
  },
  {
    id: 'case',
    label: 'Case Management',
    subtitle: 'Track & resolve cases',
    videoSrc: './case-card.mp4',
    videoScale: 1.4,
    gradient: 'linear-gradient(145deg,#160804 0%,#3d1106 100%)',
    accentColor: ORANGE,
    glowColor: 'rgba(255,51,51,0.4)',
    hasVideo: false,
  },
  {
    id: 'delegate',
    label: 'Delegate',
    subtitle: 'Assign & hand off work',
    videoSrc: './delegate-card.mp4',
    videoScale: 1.4,
    gradient: 'linear-gradient(145deg,#03131a 0%,#072838 100%)',
    accentColor: TEAL,
    glowColor: 'rgba(255,51,51,0.45)',
    hasVideo: false,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    subtitle: 'Human-in-the-loop actions',
    videoSrc: './tasks-card.mp4',
    videoScale: 1.2,
    gradient: 'linear-gradient(145deg,#160804 0%,#3d1106 100%)',
    accentColor: ORANGE,
    glowColor: 'rgba(255,51,51,0.45)',
    hasVideo: false,
  },
];
