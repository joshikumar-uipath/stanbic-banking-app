// ─────────────────────────────────────────────────────────────────────────────
// Many customers at once — a four-step flow, one decision per screen:
//   1 How are they arriving?   2 About the batch   3 The customers   4 Check
// Same rules and engine as the desk's intake (bulkModel, engine): nothing
// incomplete enters the pipeline, and every rejection comes back with a reason.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react';
import { Icn } from '../../../components/customerUi';
import type { BulkChannel } from '../../../onboarding';
import { sampleZipApplicants, type ExtractedApplicant } from '../../bulk';
import { newBatchId, type IntakeRejection } from '../../bulk/batches';
import type { ZipEntry } from '../../bulk/zip';
import type { ViewerDoc } from '../../bulk/DocViewer';
import { readBundle, runBatch, validateIntake } from '../../bulk/engine';
import { SEGMENTS, MANIFEST_COLUMNS, sampleManifest, parseManifest, manifestRowCount, branchOptions, batchNameHint } from '../../bulk/bulkModel';
import { useNav } from '../nav';
import { NScreen, NSection, NGroup, NRow, NCard, NButton, NField, NStatus, NEmpty } from '../nkit';
import { useNk, C, haptic } from '../nk';
import { DocsOverlay } from './Docs';

type Step = 0 | 1 | 2 | 3;
const TITLES = ['How are they arriving?', 'About the batch', 'Add the customers', 'Ready to submit'];

export default function NewBatch() {
  const nav = useNav();
  const nk = useNk();
  const branches = branchOptions();
  const [step, setStep] = useState<Step>(0);
  const [channel, setChannel] = useState<BulkChannel>('bundle');
  const [nameV, setName] = useState('');
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [branch, setBranch] = useState(branches[0]);
  const [manifest, setManifest] = useState('');
  const [bundle, setBundle] = useState<ExtractedApplicant[]>([]);
  const [bundleName, setBundleName] = useState('');
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [reading, setReading] = useState(false);
  const [viewing, setViewing] = useState<ExtractedApplicant | null>(null);
  const [accepted, setAccepted] = useState<ExtractedApplicant[]>([]);
  const [rejections, setRejections] = useState<IntakeRejection[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitted = channel === 'manifest' ? manifestRowCount(manifest) : bundle.length;
  const ready = channel === 'manifest' ? manifest.trim().length > 0 : bundle.length > 0;

  const onFile = (f: File) => {
    setErr(null);
    if (channel === 'manifest') { const r = new FileReader(); r.onload = () => setManifest(String(r.result)); r.readAsText(f); return; }
    setBundleName(f.name); setReading(true); setBundle([]); setEntries([]);
    const r = new FileReader();
    r.onload = () => { void readBundle(r.result as ArrayBuffer).then(({ found, entries: es }) => { setBundle(found); setEntries(es); setReading(false); }).catch(() => { setReading(false); setErr('Could not read that archive.'); }); };
    r.onerror = () => { setReading(false); setErr('Could not read that file. Use a .zip.'); };
    r.readAsArrayBuffer(f);
  };
  const sample = () => {
    haptic();
    if (channel === 'manifest') { setManifest(sampleManifest()); return; }
    setBundleName('sample-documents.zip'); setReading(true);
    window.setTimeout(() => { setBundle(sampleZipApplicants()); setEntries([]); setReading(false); }, 700);
  };
  const check = () => {
    if (channel === 'manifest') { const { rows, bad } = parseManifest(manifest); setAccepted(rows); setRejections(bad); }
    else { const r = validateIntake(bundle); setAccepted(r.accepted); setRejections(r.rejections); }
    setStep(3);
  };
  const start = async () => {
    setBusy(true);
    const id = newBatchId();
    await runBatch(accepted, {
      batchId: id, name: nameV.trim() || (channel === 'manifest' ? 'Manifest batch' : 'AOP batch'),
      channel, segment, branch, corporate: !segment.startsWith('Retail'), submitted, rejections, entries,
    });
    haptic('success');
    nav.replace({ k: 'batch', id });
  };

  const back = () => (step === 0 ? nav.pop() : setStep((s) => (s - 1) as Step));
  const progress = (
    <div className="mw-steps" aria-label={`Step ${step + 1} of 4`}>
      {[0, 1, 2, 3].map((i) => <i key={i} style={{ background: i <= step ? 'var(--nk-accent)' : nk.fill }} />)}
    </div>
  );

  const footer = step === 0 ? <NButton onClick={() => setStep(1)}>Continue</NButton>
    : step === 1 ? <NButton onClick={() => setStep(2)}>Continue</NButton>
    : step === 2 ? <NButton disabled={!ready || reading} onClick={check}>{reading ? 'Reading…' : `Check ${submitted || ''} ${channel === 'manifest' ? 'row' : 'customer'}${submitted === 1 ? '' : 's'}`}</NButton>
    : <NButton disabled={!accepted.length || busy} onClick={() => void start()}>{busy ? 'Starting…' : `Start ${accepted.length} application${accepted.length === 1 ? '' : 's'}`}</NButton>;

  return (
    <>
      <NScreen title={TITLES[step]} eyebrow={`New batch · step ${step + 1} of 4`} onBack={back} header={progress} footer={footer}>
        {step === 0 && (
          <>
            {([
              { id: 'bundle' as const, icon: 'layers', title: 'Filled forms', sub: 'A .zip of account opening packages. Each is read automatically, then an Operations maker confirms it.', tags: ['Read by IXP', 'Maker review'] },
              { id: 'manifest' as const, icon: 'mail', title: 'A list of people', sub: 'Who may be onboarded. Each person gets a link and fills the form on their own phone.', tags: ['No paperwork', 'No review needed'] },
            ]).map((o) => {
              const on = channel === o.id;
              return (
                <button key={o.id} type="button" className="mw-choice tap" onClick={() => { haptic(); setChannel(o.id); }} aria-pressed={on}
                  style={{ background: nk.card, boxShadow: on ? 'inset 0 0 0 2px var(--nk-accent)' : 'none' }}>
                  <span className="mw-choice-i" style={{ background: on ? 'var(--nk-brand)' : nk.fill, color: on ? '#fff' : nk.accent }}><Icn name={o.icon} size={24} color="currentColor" strokeWidth={2} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="mw-choice-t" style={{ color: nk.ink }}>{o.title}</span>
                    <span className="mw-choice-s" style={{ color: nk.ink2 }}>{o.sub}</span>
                    <span className="mw-choice-tags">{o.tags.map((t) => <NStatus key={t} color={nk.dark ? C.gray : C.blue}>{t}</NStatus>)}</span>
                  </span>
                  <span className="mw-radio" style={{ borderColor: on ? 'var(--nk-accent)' : nk.ink3 }}>{on && <i />}</span>
                </button>
              );
            })}
          </>
        )}

        {step === 1 && (
          <>
            <NField label="Batch name" hint="So you can find it later.">
              <input value={nameV} onChange={(e) => setName(e.target.value)} placeholder={batchNameHint()} />
            </NField>
            <NField label="Segment"><select value={segment} onChange={(e) => setSegment(e.target.value)}>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select></NField>
            <NField label="Booking branch"><select value={branch} onChange={(e) => setBranch(e.target.value)}>{branches.map((b) => <option key={b}>{b}</option>)}</select></NField>
          </>
        )}

        {step === 2 && (
          <>
            <div className="mw-pick">
              <button type="button" className="mw-pick-b tap" style={{ background: nk.card, color: nk.ink }} onClick={() => { haptic(); fileRef.current?.click(); }}>
                <span className="mw-choice-i" style={{ background: nk.brandFill, color: '#fff' }}><Icn name="upload" size={22} color="currentColor" strokeWidth={2.2} /></span>
                <b>From Files</b><span style={{ color: nk.ink2 }}>{channel === 'manifest' ? 'A .csv' : 'A .zip'} from your phone or drive</span>
              </button>
              <button type="button" className="mw-pick-b tap" style={{ background: nk.card, color: nk.ink }} onClick={sample}>
                <span className="mw-choice-i" style={{ background: nk.fill, color: nk.accent }}><Icn name="sparkle" size={22} color="currentColor" strokeWidth={2} /></span>
                <b>Use the sample</b><span style={{ color: nk.ink2 }}>A demo {channel === 'manifest' ? 'list of 12' : 'bundle of 9'}</span>
              </button>
            </div>
            {err && <NStatus color={C.red}>{err}</NStatus>}
            {channel === 'manifest' ? (
              <NField label={`Rows · ${submitted > 0 ? submitted : 'none yet'}`} hint={`Columns: ${MANIFEST_COLUMNS.join(', ')}`}>
                <textarea value={manifest} onChange={(e) => setManifest(e.target.value)} spellCheck={false} rows={6} placeholder="Or paste the list here" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }} />
              </NField>
            ) : reading ? (
              <NCard><div className="mw-reading"><span className="mw-spin" />Reading documents and sorting them by customer…</div></NCard>
            ) : bundle.length ? (
              <NSection title={`${bundle.length} customers in ${bundleName}`} footer="Tap anyone to see what arrived for them.">
                <NGroup>
                  {bundle.map((a, i) => {
                    const who = `${a.firstName} ${a.lastName}`.trim() || 'Unnamed';
                    return <NRow key={i} avatar={who} title={who} subtitle={`${a.docs.length} document${a.docs.length === 1 ? '' : 's'}`}
                      value={a.complete ? <NStatus color={C.green}>Complete</NStatus> : <NStatus color={C.orange}>Missing {a.missing.join(' + ')}</NStatus>}
                      onClick={() => setViewing(a)} />;
                  })}
                </NGroup>
              </NSection>
            ) : (
              <NEmpty icon="layers" title="No customers yet" color={C.blue}>Add the bundle from Files, or use the sample to see the flow.</NEmpty>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="mw-tally">
              <div style={{ background: nk.card }}><b style={{ color: C.green }}>{accepted.length}</b><span style={{ color: nk.ink2 }}>will start</span></div>
              <div style={{ background: nk.card }}><b style={{ color: rejections.length ? C.red : nk.ink3 }}>{rejections.length}</b><span style={{ color: nk.ink2 }}>sent back</span></div>
            </div>
            {rejections.length > 0 ? (
              <NSection title="Sent back to you" footer="Each comes back with a reason — nothing is silently dropped. They don’t count against the batch.">
                <NGroup>
                  {rejections.map((r, i) => (
                    <NRow key={i} icon={{ name: 'alert', color: C.red }} title={r.customer || 'Not identified'} subtitle={r.reason}
                      detail={`${r.source} · ${r.fixable ? 'fix and re-upload' : 'needs a review'}`} />
                  ))}
                </NGroup>
              </NSection>
            ) : (
              <NEmpty title="Everything passed intake" color={C.green}>Nothing to send back.</NEmpty>
            )}
          </>
        )}
      </NScreen>

      <input ref={fileRef} type="file" accept={channel === 'manifest' ? '.csv,text/csv' : '.zip,application/zip'} style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {viewing && (
        <DocsOverlay title={`${viewing.firstName} ${viewing.lastName}`.trim() || 'Unnamed'} missing={viewing.missing}
          docs={viewing.docs.map<ViewerDoc>((d) => ({ name: d.file, kind: d.kind, confidence: d.confidence, entry: entries.find((e) => e.name === d.file && e.path.toLowerCase().includes(viewing.firstName.toLowerCase())) }))}
          onClose={() => setViewing(null)} />
      )}
    </>
  );
}
