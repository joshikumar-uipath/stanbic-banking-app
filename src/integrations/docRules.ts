// ─────────────────────────────────────────────────────────────────────────────
// The Document rules DMN — read and evaluated in the app.
//
// public/document-rules.dmn is the default. The Ops console (Rules → Document
// rules → Edit) saves an edited copy to this browser under DOC_RULES_KEY, and
// everything here reads THAT copy when it exists — so changing "ageDays > 90" to
// "ageDays > 60" in the editor changes which utility bills fail, on the next
// check, with no rebuild. Nothing is written to the tenant.
//
// The table: When Document · And Check · And Condition → Outcome · Reason, hit
// policy COLLECT. Every rule that matches fires and the strictest outcome wins
// (Fail > Refer > Quick review > Pass), so adding a softer rule can never quietly
// downgrade a hard one.
//
// Conditions are a deliberately small language — dotted fact names, numbers,
// quoted strings, true/false, < <= > >= == !=, AND / OR and brackets. It is
// parsed here rather than eval'd: a saved DMN is user input.
// ─────────────────────────────────────────────────────────────────────────────
import DEFAULT_DMN from '../../public/document-rules.dmn?raw';

export const DOC_RULES_KEY = 'aof_document_rules_dmn';

export type Outcome = 'Pass' | 'Quick review' | 'Refer' | 'Fail';
export const SEVERITY: Record<Outcome, number> = { Pass: 0, 'Quick review': 1, Refer: 2, Fail: 3 };
export const strictest = (a: Outcome, b: Outcome): Outcome => (SEVERITY[b] > SEVERITY[a] ? b : a);

export interface DocRule {
  /** 1-based row number, as the DMN editor shows it. */
  row: number;
  document: string;
  check: string;
  condition: string;
  outcome: Outcome;
  reason: string;
  /** The annotation — carries the BR reference. */
  note: string;
  /** "BR-DOC-06", lifted from the annotation. */
  ref: string;
}

/** Document types that count as identification for a rule written against "id". */
export const ID_TYPES = ['passport', 'national-id', 'nin-slip', 'drivers-licence', 'voters-card'];

const unquote = (s: string) => s.trim().replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1');

let cache: { xml: string; rules: DocRule[] } | null = null;

/** The DMN in force: this browser's saved edit, else the shipped default. */
export function rulesXml(): string {
  try { return localStorage.getItem(DOC_RULES_KEY) || DEFAULT_DMN; } catch { return DEFAULT_DMN; }
}
/** Whether the rules in force are an edit made in this browser. */
export function rulesEdited(): boolean {
  try { return Boolean(localStorage.getItem(DOC_RULES_KEY)); } catch { return false; }
}

function parse(xml: string): DocRule[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) return [];
  const byLocal = (el: Element | Document, name: string) =>
    Array.from(el.getElementsByTagName('*')).filter((n) => n.localName === name);
  const out: DocRule[] = [];
  byLocal(doc, 'rule').forEach((r, i) => {
    const ins = byLocal(r, 'inputEntry').map((e) => byLocal(e, 'text')[0]?.textContent ?? '');
    const outs = byLocal(r, 'outputEntry').map((e) => byLocal(e, 'text')[0]?.textContent ?? '');
    const note = byLocal(r, 'description')[0]?.textContent?.trim() ?? '';
    const outcome = unquote(outs[0] ?? '') as Outcome;
    out.push({
      row: i + 1,
      document: unquote(ins[0] ?? '-') || '-',
      check: unquote(ins[1] ?? '-') || '-',
      condition: (ins[2] ?? '').trim(),
      outcome: SEVERITY[outcome] !== undefined ? outcome : 'Pass',
      reason: unquote(outs[1] ?? ''),
      note,
      ref: note.match(/BR-[A-Z]+-\d+/)?.[0] ?? '',
    });
  });
  return out;
}

/** Every rule in force, parsed once per distinct DMN. */
export function rules(): DocRule[] {
  const xml = rulesXml();
  if (!cache || cache.xml !== xml) {
    let parsed = parse(xml);
    // A saved DMN that no longer parses must not switch every check off.
    if (!parsed.length && xml !== DEFAULT_DMN) parsed = parse(DEFAULT_DMN);
    cache = { xml, rules: parsed };
  }
  return cache.rules;
}

// ── The condition language ───────────────────────────────────────────────────
type Tok = { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'bool'; v: boolean } | { t: 'id'; v: string }
  | { t: 'op'; v: string } | { t: 'and' } | { t: 'or' } | { t: '(' } | { t: ')' };

function lex(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push({ t: c }); i++; continue; }
    const op = src.slice(i).match(/^(<=|>=|==|!=|<|>|=)/);
    if (op) { out.push({ t: 'op', v: op[1] === '=' ? '==' : op[1] }); i += op[1].length; continue; }
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) return null;
      out.push({ t: 'str', v: src.slice(i + 1, end) }); i = end + 1; continue;
    }
    const num = src.slice(i).match(/^-?\d+(\.\d+)?/);
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const word = src.slice(i).match(/^[A-Za-z_][\w.]*/);
    if (word) {
      const w = word[0], lw = w.toLowerCase();
      if (lw === 'and') out.push({ t: 'and' });
      else if (lw === 'or') out.push({ t: 'or' });
      else if (lw === 'true' || lw === 'false') out.push({ t: 'bool', v: lw === 'true' });
      else out.push({ t: 'id', v: w });
      i += w.length; continue;
    }
    return null;
  }
  return out;
}

export type Facts = Record<string, number | string | boolean | null | undefined>;

/**
 * Evaluate a condition against the facts. Returns null when it cannot be
 * decided — a fact it names is missing (the check had nothing to look at), or
 * the text does not parse. Null is "not applicable", never a pass.
 */
export function evaluate(condition: string, facts: Facts): boolean | null {
  const c = condition.trim();
  if (!c || c === '-') return true;
  const toks = lex(c);
  if (!toks) return null;
  let p = 0;
  let missing = false;
  const value = (): number | string | boolean | null => {
    const t = toks[p++];
    if (!t) return null;
    if (t.t === 'num' || t.t === 'str' || t.t === 'bool') return t.v;
    if (t.t === 'id') {
      const v = facts[t.v];
      if (v === undefined || v === null) { missing = true; return null; }
      return v;
    }
    return null;
  };
  const comparison = (): boolean => {
    if (toks[p]?.t === '(') { p++; const v = disjunction(); p++; return v; }
    const a = value();
    const op = toks[p];
    if (!op || op.t !== 'op') return Boolean(a);
    p++;
    const b = value();
    if (a === null || b === null) return false;
    switch (op.v) {
      case '<': return Number(a) < Number(b);
      case '<=': return Number(a) <= Number(b);
      case '>': return Number(a) > Number(b);
      case '>=': return Number(a) >= Number(b);
      case '==': return a === b || String(a) === String(b);
      case '!=': return !(a === b || String(a) === String(b));
      default: return false;
    }
  };
  const conjunction = (): boolean => {
    let v = comparison();
    while (toks[p]?.t === 'and') { p++; const r = comparison(); v = v && r; }
    return v;
  };
  const disjunction = (): boolean => {
    let v = conjunction();
    while (toks[p]?.t === 'or') { p++; const r = conjunction(); v = v || r; }
    return v;
  };
  const v = disjunction();
  return missing ? null : v;
}

/** Does a rule written for `ruleDoc` apply to a document of type `docType`? */
export function appliesTo(ruleDoc: string, docType: string): boolean {
  const d = ruleDoc.toLowerCase();
  if (d === 'any' || d === '-' || d === '') return true;
  if (d === 'id') return ID_TYPES.includes(docType);
  return d === docType;
}

export interface Verdict {
  outcome: Outcome;
  reason: string;
  rule: DocRule | null;
  /** True when every rule for this check needed a fact that was not there. */
  undecided: boolean;
}

/** Run one check for one document: every applicable rule, strictest wins. */
export function judge(docType: string, check: string, facts: Facts): Verdict {
  const mine = rules().filter((r) => r.check === check && appliesTo(r.document, docType));
  let best: Verdict = { outcome: 'Pass', reason: '', rule: null, undecided: mine.length > 0 };
  for (const r of mine) {
    const hit = evaluate(r.condition, facts);
    if (hit === null) continue;
    best.undecided = false;
    if (!hit) continue;
    if (SEVERITY[r.outcome] > SEVERITY[best.outcome]) best = { outcome: r.outcome, reason: r.reason, rule: r, undecided: false };
    // Two rules at the same severity both say why — "saved by an editor" and
    // "re-saved after creation" are different evidence, not one.
    else if (r.outcome === best.outcome && r.outcome !== 'Pass' && r.reason && !best.reason.includes(r.reason)) best.reason += `; ${r.reason.charAt(0).toLowerCase()}${r.reason.slice(1)}`;
  }
  return best;
}

/**
 * The number a rule compares a fact against — the threshold the screens show.
 * `limit('any', 'confidence', 'field.confidence', 0.8)` reads rule 1's "< 0.80".
 * Falls back when the rule has been deleted or reworded past recognition.
 */
export function limit(document: string, check: string, fact: string, fallback: number): number {
  const r = rules().find((x) => x.check === check && x.document === document && x.condition.includes(fact));
  const m = r?.condition.match(new RegExp(`${fact.replace(/\./g, '\\.')}\\s*(?:<=|>=|<|>|==)\\s*(-?\\d+(?:\\.\\d+)?)`));
  return m ? Number(m[1]) : fallback;
}

/** The confidence threshold as a percentage (rule: field.confidence < 0.80 → 80). */
export const confidenceThresholdPct = (): number => Math.round(limit('any', 'confidence', 'field.confidence', 0.8) * 100);
/** The utility-bill currency window in days (rule: ageDays > 90 → 90). */
export const billWindowDays = (): number => limit('utility-bill', 'age', 'ageDays', 90);
