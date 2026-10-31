// Links to the phone's dialler, SMS, mail and WhatsApp, built from customer data
// that may have been typed by the customer. Numbers are reduced to digits (and a
// leading +); emails and message bodies are encoded, so nothing in them can add
// recipients or parameters. Each returns undefined when there is nothing to use.
import { getActiveCountry } from '../../config/countries';

const digits = (p?: string) => (p ?? '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');

/** International digits (no +), using the bank's country code for local numbers. */
function intl(p?: string): string | undefined {
  const d = digits(p);
  if (!d) return undefined;
  if (d.startsWith('+')) return d.slice(1);
  const cc = (getActiveCountry() as { dialCode?: string }).dialCode?.replace(/\D/g, '') || '234';
  return d.startsWith('0') ? `${cc}${d.slice(1)}` : d;
}

export const telHref = (p?: string) => (digits(p) ? `tel:${digits(p)}` : undefined);
export const smsHref = (p?: string, body = '') => (digits(p) ? `sms:${digits(p)}?&body=${encodeURIComponent(body)}` : undefined);
export const waHref = (p?: string, body = '') => (intl(p) ? `https://wa.me/${intl(p)}?text=${encodeURIComponent(body)}` : undefined);
export function mailHref(e?: string): string | undefined {
  const v = (e ?? '').trim();
  if (!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(v)) return undefined;
  return `mailto:${encodeURIComponent(v).replace('%40', '@')}`;
}
