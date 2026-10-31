// ─────────────────────────────────────────────────────────────────────────────
// The workspace's roles.
//
// The desk and the Operations Workbench deliberately share a design language —
// they are one platform, not two products. That only reads as intentional if the
// app says whose eyes you're looking through and lets you change them, so this
// is the single list both tools render. Keep it in step with the copy in
// public/ops-console.html, which shows the same switcher.
// ─────────────────────────────────────────────────────────────────────────────

export interface Role {
  id: string;
  /** Who you are. Leads the rail — it's the thing that differs between tools. */
  name: string;
  /** The tool that role uses. */
  sub: string;
  /** What this role actually does all day — shown in the switcher. */
  blurb: string;
  href: string;
}

/**
 * Personas inside this app, as opposed to the tools above.
 *
 * Bulk account opening is a maker-checker process: §9.1 of the BRD has a maker
 * confirm what OCR read and a separate verifier open the accounts, and the two
 * may not be the same person. Both jobs live on THIS desk — the screens are
 * React and reuse the extraction review — so switching between them is a change
 * of persona, not a change of tool, and no navigation happens.
 */
export type Persona = 'rm' | 'maker' | 'verifier';

export interface PersonaRole {
  id: Persona;
  name: string;
  sub: string;
  blurb: string;
}

export const PERSONAS: PersonaRole[] = [
  {
    id: 'rm',
    name: 'Relationship Manager',
    sub: 'Branch desk',
    blurb: 'Submit batches, track them, and take back the exceptions routed to you.',
  },
  {
    id: 'maker',
    name: 'Operations · Maker',
    sub: 'Extraction review',
    blurb: 'Confirm what OCR read against the form it was read from, and correct it.',
  },
  {
    id: 'verifier',
    name: 'Operations · Verifier',
    sub: 'Authorisation',
    blurb: 'Set the PND position and open the accounts a maker has confirmed.',
  },
];

export const personaById = (id: string): PersonaRole => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

export const ROLES: Role[] = [
  {
    id: 'rm',
    name: 'Relationship Manager',
    sub: 'Branch desk',
    blurb: 'Open accounts, chase your own pipeline, approve, and look after your clients.',
    href: '/employee-web',
  },
  {
    id: 'ops',
    name: 'Operations analyst',
    sub: 'Exception triage',
    blurb: 'Clear stuck cases across the whole bank by cause, in bulk, and write rules so they stop.',
    href: '/ops',
  },
];

export const roleById = (id: string): Role => ROLES.find((r) => r.id === id) ?? ROLES[0];
