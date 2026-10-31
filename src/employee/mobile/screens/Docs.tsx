// A customer's documents, one at a time, full width. Rendering is the desk's own
// (DocStage): image, PDF, text — or a plainly-marked placeholder for the sample
// bundle, which has no file behind it.
import { useState } from 'react';
import { fullName } from '../../../onboarding';
import { DOC_LABEL, type DocKind } from '../../bulk';
import { DocStage, type ViewerDoc } from '../../bulk/DocViewer';
import { docsFor } from '../../bulk/docs';
import { useNav, useWorkData } from '../nav';
import { NScreen, NChips, NStatus, NEmpty, NImmersive } from '../nkit';
import { C } from '../nk';
import '../../bulk/bulk.css';

export default function Docs({ id, start = 0 }: { id: string; start?: number }) {
  const nav = useNav();
  const c = useWorkData().byId(id);
  return <DocsView title={c ? fullName(c) || 'Unnamed' : id} docs={docsFor(id)} missing={[]} start={start} onClose={nav.pop} />;
}

/** Full-screen, over everything — for intake, before a case exists. */
export function DocsOverlay(p: { title: string; docs: ViewerDoc[]; missing: DocKind[]; onClose: () => void }) {
  return <NImmersive><DocsView {...p} /></NImmersive>;
}

function DocsView({ title, docs, missing, start = 0, onClose }: { title: string; docs: ViewerDoc[]; missing: DocKind[]; start?: number; onClose: () => void }) {
  const [i, setI] = useState(String(Math.min(start, Math.max(docs.length - 1, 0))));
  const doc = docs[Number(i)];
  return (
    <NScreen title={title} onBack={onClose} large={false}
      header={docs.length > 1 ? <NChips value={i} onChange={setI} options={docs.map((d, n) => ({ id: String(n), label: DOC_LABEL[d.kind] }))} /> : undefined}>
      {missing.length > 0 && <NStatus color={C.orange}>Missing {missing.map((k) => DOC_LABEL[k].toLowerCase()).join(' and ')}</NStatus>}
      {doc ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{doc.name}</span>
            <NStatus color={doc.confidence >= 90 ? C.green : C.orange}>{Math.round(doc.confidence)}% sure</NStatus>
          </div>
          <div className="mw-docstage"><DocStage doc={doc} /></div>
        </>
      ) : <NEmpty icon="doc" title="No documents kept" color={C.gray}>Uploaded files are held for the session they arrived in.</NEmpty>}
    </NScreen>
  );
}
