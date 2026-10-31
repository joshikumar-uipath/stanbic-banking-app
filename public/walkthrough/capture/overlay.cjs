// Write guard for the walkthrough capture — this project's version.
//
// The capture clicks through the real app on one new case per journey. The app keeps
// its records in the browser (localStorage), so the story carries from screen to
// screen on its own; what has to be handled here is everything that would leave it:
//
//   • every request that is not a read is answered HERE and recorded in `writes` —
//     on every host (UiPath, the Azure blob store, the voice agent, telemetry). The
//     only POSTs that pass are Data Service reads (query / read).
//   • every AOF* Data Fabric table read is answered empty (AOFCase, AOFMaestroLink), so
//     the desk shows the seeded demo records and the walkthrough's own — never a
//     colleague's live case, and never a different story on a second run.
//   • Maestro cases are SIMULATED. Starting a case returns a walkthrough instance id;
//     every read the desk makes about it (job state, stage progress, the parked
//     approval, its tasks) is answered from `cases`, and completing the parked task
//     moves the case to its next stage. Scenes can also move a case directly
//     (`ov.park(instance, stageIndex)`), as the case engine would between screens.
//     The approver lookup (GetCurrentUserExtended) is answered here too, so an
//     approval never depends on a live read.
//
// Nothing is sent. `writes` lists everything that was answered locally.
const C = require('./config.cjs');

// The case plans' own stage and step names (OnboardingCase / CorporateOnboardingCase),
// so the desk's stage strip, step list and checks read exactly as for a live case.
const PLANS = {
  individual: [
    { stage: 'Intake', auto: ['IXP - Extract pack', 'Lookup customer & KYC profile', 'Pull relationships & CIF'], review: 'Confirm extracted details', gate: 'Duplicate & risk pre-screen' },
    { stage: 'Verification', auto: ['Assemble verification package', 'NIN validation', 'BVN validation', 'Liveness & face match', 'Sanctions & PEP screening', 'Address & document authenticity'], gate: 'Analyst review & exceptions' },
    { stage: 'Decision', auto: ['Apply routing rules', 'Risk-based EDD trigger', 'Notify outcome'], gate: 'Onboarding officer decision' },
    { stage: 'Activation', auto: ['Create CIF & account (Finacle)', 'Provision channels & card', 'Mandate & funding setup', 'Customer & RM comms'], gate: 'Activation sign-off' },
    { stage: 'Closure', auto: ['Case packet assembly', 'Schedule periodic KYC review'], gate: 'Generate audit report' },
  ],
  corporate: [
    { stage: 'Intake', auto: ['IXP - Extract pack', 'Analyse CAC pack', 'Lookup entity & KYC profile', 'RC / CAC registry verification', 'TIN verification (FIRS)'], review: 'Confirm extracted details', gate: 'Entity duplicate & risk pre-screen' },
    { stage: 'Verification', auto: ['Assemble entity verification package', 'Director NIN validation', 'Director BVN validation', 'Sanctions & PEP — entity and directors', 'Signatory liveness & face match', 'Business address & document authenticity', 'UBO determination (>5% ownership)', 'SCUML registration check'], gate: 'Directors & UBO verification' },
    { stage: 'Decision', auto: ['Apply corporate routing rules', 'Corporate risk rating & EDD trigger', 'Notify outcome'], gate: 'Corporate mandate decision' },
    { stage: 'Activation', auto: ['Create corporate CIF & account (Finacle)', 'Provision corporate channels & tokens', 'Mandate, signing limits & funding setup', 'Capture specimen signatures', 'Entity & RM comms'], gate: 'Mandate and signatory activation' },
    { stage: 'Closure', auto: ['Corporate case packet assembly', 'Schedule risk-based KYC review'], gate: 'Corporate audit report' },
  ],
};
const CORP_RELEASE = '441e0bda-1ea1-4b7e-8021-19bb048f55b6';
const CORP_FOLDER_ID = 3353156, IND_FOLDER_ID = 3352699;

function install(ctx) {
  const writes = [];
  /** instanceId → { kind, stage (index), done, taskId, startedAt } */
  const cases = new Map();
  let seq = 0, taskSeq = 900000;
  const newId = () => `0000wt00-0000-4000-a000-${String(++seq).padStart(12, '0')}`;
  const IDS = /0000wt00-0000-4000-a000-\d{12}/;
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  const park = (inst, stage) => {
    const c = cases.get(inst); if (!c) throw new Error(`overlay: no simulated case ${inst}`);
    const plan = PLANS[c.kind];
    if (stage >= plan.length) { c.done = true; c.stage = plan.length - 1; c.taskId = null; return; }
    c.stage = stage; c.done = false; c.taskId = ++taskSeq;
  };

  /** The element executions the case service would return for a simulated case. */
  const elements = (c) => {
    const plan = PLANS[c.kind];
    const at = (n) => new Date(c.startedAt + n * 60_000).toISOString();
    const link = (id) => `https://staging.uipath.com/${C.org}/${C.tenant}/actions_/tasks/${id}`;
    const out = [];
    plan.forEach((p, i) => {
      const sid = `stage_${i}`;
      const st = c.done || i < c.stage ? 'Completed' : i === c.stage ? 'InProgress' : 'NotStarted';
      out.push({ elementType: 'CaseStage', elementName: p.stage, elementId: sid, status: st, startedTimeUtc: st === 'NotStarted' ? undefined : at(i * 10) });
      const stepSt = st === 'NotStarted' ? 'NotStarted' : 'Completed';
      p.auto.forEach((name, k) => out.push({ elementType: 'ServiceTask', elementName: name, caseStageElementId: sid, status: stepSt, startedTimeUtc: stepSt === 'NotStarted' ? undefined : at(i * 10 + k + 1) }));
      if (p.review) out.push({ elementType: 'UserTask', elementName: p.review, caseStageElementId: sid, status: stepSt, externalLink: link(800000 + i), startedTimeUtc: at(i * 10 + 1) });
      const gateSt = c.done || i < c.stage ? 'Completed' : i === c.stage ? 'InProgress' : 'NotStarted';
      out.push({ elementType: 'UserTask', elementName: p.gate, caseStageElementId: sid, status: gateSt,
        externalLink: gateSt === 'InProgress' && c.taskId ? link(c.taskId) : undefined, startedTimeUtc: gateSt === 'NotStarted' ? undefined : at(i * 10 + 8) });
    });
    // The voice agent: a secondary "Voice Agent" stage beside the stage it diverted
    // from, its tasks named as the case plan names them. "Speaking to Customer" in
    // progress is what the desk reads as "on a call now" (maestro.ts callWait).
    if (c.voice) {
      const on = !c.voice.ended;
      const t0 = at(c.voice.atMin), t1 = at(c.voice.atMin + 3);
      out.push({ elementType: 'CaseStage', elementName: 'Voice Agent', elementId: 'stage_va', status: on ? 'InProgress' : 'Completed', startedTimeUtc: t0,
        elementRuns: on ? [{ status: 'InProgress', startedTimeUtc: t0 }] : [{ status: 'InProgress', startedTimeUtc: t0 }, { status: 'Completed', startedTimeUtc: t1 }] });
      const step = (name, type, st, k) => ({ elementType: type, elementName: name, caseStageElementId: 'stage_va', status: st, startedTimeUtc: st === 'NotStarted' ? undefined : at(c.voice.atMin + k) });
      out.push(step('Voice Call', 'ServiceTask', 'Completed', 0));
      out.push(step('Speaking to Customer', 'ReceiveTask', on ? 'InProgress' : 'Completed', 1));
      out.push(step('Ending Call', 'ServiceTask', on ? 'NotStarted' : 'Completed', 2));
      out.push(step('Update Next Steps', 'ServiceTask', on ? 'NotStarted' : 'Completed', 2));
    }
    return out;
  };
  /** Divert a case to the voice agent from the stage it is on ('start'), or end the call ('end'). */
  const call = (inst, what) => {
    const c = cases.get(inst); if (!c) throw new Error(`overlay: no simulated case ${inst}`);
    if (what === 'start') c.voice = { atMin: c.stage * 10 + 5, ended: false };
    else if (c.voice) c.voice.ended = true;
  };
  const caseOf = (url) => { const m = url.match(IDS); return m ? [m[0], cases.get(m[0])] : [null, null]; };

  const handler = async (route) => {
    const r = route.request();
    const m = r.method();
    const url = r.url();
    const [inst, c] = caseOf(decodeURIComponent(url));

    // Never loaded, not even a read: the live voice service places calls over
    // WebSocket/WebRTC, and AWS (the FaceID backend, Cognito, Rekognition) would take
    // the camera stream — channels this guard cannot see. Refused outright.
    if (/banking-demo-voice-agent|amazonaws\.com|amazoncognito|bigdatacloud/i.test(url)) { writes.push({ op: 'BLOCKED', url: url.split('?')[0].slice(0, 160) }); return route.abort(); }
    // The KYC selfie step frames the hosted FaceID app; in the capture it opens this
    // app's own port of the same kiosk instead (src/faceid). Its camera pre-screen is
    // local; the AWS hand-off after it is refused above.
    if (/\/face-id-verify/i.test(url) && m === 'GET') {
      writes.push({ op: 'REDIRECT', url: url.split('?')[0].slice(0, 160) });
      return route.fulfill({ status: 302, headers: { location: `${C.apps.launcher}#faceid-kiosk` } });
    }

    // ── Reads about a simulated case ──────────────────────────────────────
    if (c && m === 'GET') {
      if (/\/pims_\/api\/v1\/element-executions\/case-instances\//.test(url)) return json(route, { elementExecutions: elements(c) });
      if (/\/pims_\/api\/v1\/instances\/[^/?]+\/variables/.test(url)) return json(route, { elements: [] });
      if (/\/pims_\/api\/v1\/instances\//.test(url)) return json(route, { latestRunStatus: c.done ? 'Completed' : 'Running' });
      if (/\/odata\/Jobs\b/.test(url)) return json(route, { value: [{ Key: inst, State: c.done ? 'Successful' : 'Running' }] });
      if (/GetTasksAcrossFolders/.test(url)) {
        const plan = PLANS[c.kind];
        const open = !c.done && c.taskId && !/Status eq 'Completed'/.test(decodeURIComponent(url))
          ? [{ Id: c.taskId, Title: plan[c.stage].gate, Status: 'Unassigned', OrganizationUnitId: c.kind === 'corporate' ? CORP_FOLDER_ID : IND_FOLDER_ID, CreatorJobKey: inst }]
          : [];
        return json(route, { value: open });
      }
      return json(route, { value: [] });
    }

    // ── Who is approving: answered here, so Approve never hangs on a live read.
    // (The assignment and completion it leads to are answered below, never sent.)
    if (m === 'GET' && /GetCurrentUserExtended/.test(url)) return json(route, { Id: 1, UserName: 'walkthrough', Name: 'Relationship', Surname: 'Manager' });

    // ── Shared Data Fabric tables: answered empty (see the header) ────────
    if (/\/EntityService\/AOF\w+\/(read|query)\b/.test(url)) return json(route, { value: [], totalRecordCount: 0 });
    if (m === 'POST' && /\/dataservice_\/.*\/(query|read)(\?|$)/.test(url)) {
      if (/\/entity\/[^/]+\/query/.test(url)) return json(route, { value: [], totalRecordCount: 0 });
      return route.continue();
    }

    // ── Sign-in: the token exchange for the staging session (Maestro's own UI).
    // It changes no data; recorded as AUTH so the log shows it passed.
    if (m === 'POST' && /^https:\/\/staging\.uipath\.com\/identity_\/connect\/token(\?|$)/.test(url)) {
      writes.push({ op: 'AUTH', url: url.split('?')[0] });
      return route.continue();
    }

    // ── Reads pass ───────────────────────────────────────────────────────
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();

    // ── Writes: answered here, never sent ────────────────────────────────
    let body = null; try { body = r.postDataJSON(); } catch { body = null; }
    writes.push({ op: m, url: url.split('?')[0].slice(0, 160) });

    if (/StartJobs/.test(url)) {
      const id = newId();
      const kind = String(body?.startInfo?.ReleaseKey || '').toLowerCase() === CORP_RELEASE ? 'corporate' : 'individual';
      cases.set(id, { kind, stage: 0, done: false, taskId: null, startedAt: Date.now() });
      park(id, 0);
      return json(route, { value: [{ Key: id, Id: seq, State: 'Running' }] });
    }
    if (/CompleteAppTask/.test(url)) {
      const tid = Number(body?.taskId);
      for (const [id, cs] of cases) if (cs.taskId === tid) park(id, cs.stage + 1);
      return json(route, {});
    }
    if (/\/odata\/Attachments(\?|$)/.test(url) && m === 'POST') {
      return json(route, { Id: `0000wt00-0000-4000-b000-${String(++seq).padStart(12, '0')}`, Name: body?.Name || 'document.pdf',
        BlobFileAccess: { Uri: 'https://wt-upload.invalid/blob', Verb: 'PUT', RequiresAuth: false, Headers: { Keys: [], Values: [] } } });
    }
    if (/\/insert$/.test(url)) {
      const list = Array.isArray(body) ? body : [body || {}];
      return json(route, { successRecords: list.map((x, i) => ({ ...x, Id: `wt-row-${seq}-${i}` })), failureRecords: [] });
    }
    return json(route, m === 'PUT' ? {} : { value: [] });
  };

  // Before the first page: the FirstBank theme (the saved admin profile the apps read)
  // and the application-id counter. Only if absent, so a scene can still change them.
  const theme = JSON.parse(require('fs').readFileSync(C.themeFile, 'utf8'));
  const seed = ctx.addInitScript(([theme, name, appSeq]) => {
    try {
      const K = 'zara_local_profiles_v1';
      let st; try { st = JSON.parse(localStorage.getItem(K) || 'null'); } catch { st = null; }
      if (!st || st.activeId !== 'walkthrough') {
        st = { activeId: 'walkthrough', profiles: [{ id: 'walkthrough', name, config: theme, updatedAt: new Date().toISOString() }] };
        localStorage.setItem(K, JSON.stringify(st));
      }
      if (!localStorage.getItem('aof_app_seq')) localStorage.setItem('aof_app_seq', String(appSeq));
    } catch { /* storage unavailable */ }
  }, [theme, C.themeName, C.appSeq]);

  // The KYC selfie frame points at the hosted FaceID app. In the capture it is pointed
  // at this app's own port of the same kiosk before it loads, so the frame's camera
  // permission (granted to its src origin) applies — a redirect would not carry it.
  const kiosk = ctx.addInitScript(() => {
    // The dev "← Launcher" pill, hidden in every frame (lib.cjs hides it on the page only).
    document.addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = 'button[title="Back to the launcher"], a[title="Back to the launcher"] { display: none !important; }';
      document.head.appendChild(st);
    });
    const fix = (f) => { if (f.tagName === 'IFRAME' && /\/face-id-verify/i.test(f.getAttribute('src') || '')) f.setAttribute('src', location.origin + '/#faceid-kiosk'); };
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      fix(n); n.querySelectorAll?.('iframe').forEach(fix);
    }))).observe(document, { childList: true, subtree: true });
  });

  return Promise.all([seed, kiosk]).then(() => ctx.route('**/*', handler)).then(() => ({
    writes,
    cases,
    /** Move a simulated case to a stage, parked on that stage's approval — as the case
     *  engine does between screens. `stage` past the last one finishes the case. */
    park,
    /** The voice agent rings the customer ('start') and hangs up ('end'), as the case's Voice Agent stage does. */
    call,
    /** The walkthrough's simulated instances, newest last. */
    instances: () => [...cases.keys()],
  }));
}

module.exports = { install, PLANS };
