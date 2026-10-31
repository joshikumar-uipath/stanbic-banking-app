// The bank the demo is dressed as — derived from the loaded theme, so no screen
// names one bank while another bank's theme is on. `appName` is the short name
// ("FirstBank", "Stanbic IBTC"); the rest (legal name, KYC link domain, storage
// slug) comes from optional Branding overrides, else a known-bank table, else is
// derived from the name.
import { useConfig } from './ConfigContext';
import type { Branding } from './types';

export interface BankIdentity {
  /** Short name, as the customer sees it: "FirstBank". */
  name: string;
  /** Formal name, for document headers: "First Bank of Nigeria Limited". */
  legalName: string;
  /** Host of the customer's KYC link: "kyc.firstbanknigeria.com". */
  kycDomain: string;
  /** Lower-case id for references and storage paths: "firstbank". */
  slug: string;
}

const KNOWN: { match: RegExp; legalName: string; kycDomain: string; slug: string }[] = [
  { match: /stanbic/i, legalName: 'Stanbic IBTC Bank', kycDomain: 'kyc.stanbicibtc.com', slug: 'stanbic' },
  { match: /first\s*bank|\bfbn\b/i, legalName: 'First Bank of Nigeria Limited', kycDomain: 'kyc.firstbanknigeria.com', slug: 'firstbank' },
];

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'bank';

export function bankIdentity(b: Pick<Branding, 'appName' | 'legalName' | 'kycDomain'>): BankIdentity {
  const name = (b.appName || 'Bank').trim();
  const known = KNOWN.find((k) => k.match.test(name));
  const slug = known?.slug ?? slugOf(name);
  return {
    name,
    legalName: b.legalName?.trim() || known?.legalName || name,
    kycDomain: b.kycDomain?.trim() || known?.kycDomain || `kyc.${slug}.com`,
    slug,
  };
}

// Non-React modules (comms, fixtures, reference generators) read the bank of the
// theme currently on screen. Every ConfigProvider publishes its effective
// branding here; until one has rendered, the Stanbic identity is the fallback,
// matching the app-wide theme fallback.
let active: BankIdentity = bankIdentity({ appName: 'Stanbic IBTC' });

export function setActiveBank(b: Branding): void {
  active = bankIdentity(b);
}

export function activeBank(): BankIdentity {
  return active;
}

/** The bank of the theme this component is rendered under. */
export function useBank(): BankIdentity {
  return bankIdentity(useConfig().branding);
}
