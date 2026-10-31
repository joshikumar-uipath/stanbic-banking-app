// The walkthrough, captured per bank (BRAND=firstbank | stanbic — config.cjs `story` holds
// what differs: bank, branch, forms). Four application flows, each end to end (see FLOWS):
//   Individual · upload  — the customer's paper form uploaded (only when story.individual.form is set).
//   Individual · fill in — Olumuyiwa Dada's form filled in on the desk.
//   Corporate · upload   — the bank's own completed corporate form (ABA Integrated / George Emore).
//   Corporate · fill in  — a demo business (Nwosu Logistics) filled in on the desk.
// then Bulk (an employer's batch, maker then verifier), the customer on their own, the RM,
// operations and behind the scenes. Each scene is a list of recorder calls (API at the top
// of the kit's scenes.cjs and in lib.cjs); `s` carries the story between scenes, one entry
// per flow (s.indf / s.corpu …: { id, inst, account }).
//
// The forms are the REDACTED copies (fixtures-firstbank/redacted/): the page images
// show in the frames, so identifiers and signatures are blacked out on them. The app
// reads them with the originals' masked transcriptions (src/fixtures/redactedCopies.ts).
//
// Maestro is simulated by overlay.cjs: a submitted application gets a walkthrough case,
// the desk's Approve completes its parked task, and `R.ov.park(inst, stage)` moves it
// between screens as the case engine would.
const path = require('path');
const C = require('./config.cjs');
const A = C.apps;
const ROOT = path.join(__dirname, '..', '..', '..');
const S = C.story;               // per brand: bank, branch, forms, company
const BANK = S.bank;
const FORM_IND = S.individual.form;
const FORM_CORP = S.corporate.form;
const BUNDLE = S.bulk;           // demo data, no real people
const MANIFEST = path.join(path.dirname(S.bulk), 'manifest-with-errors.csv');
const PKG_DIR = path.join(path.dirname(path.dirname(S.bulk)), 'documents', 'emeka-nwosu'); // a generated demo business

/** Olumuyiwa's details for a typed capture (the masked values his form reads to). */
const OLU = {
  firstName: 'Olumuyiwa', middleName: 'Oluwafemi', lastName: 'Dada', dob: '1992-12-02', motherMaidenName: 'Bakre',
  nationality: 'Nigerian', stateOfOrigin: 'Lagos', phone: '08126040258', email: 'demo.olumuyiwa@gmail.com',
  bvn: '22303594107', nin: '57076619354', idNumber: '57076619354', idExpiry: '2029-06-30', tin: '12345678-0001',
  address: '4 Tinubu Street, Alapere Ketu', city: 'Lagos', lga: 'Kosofe', stateOfResidence: 'Lagos', yearsAtAddress: '4',
  employer: 'Lagos State Government', occupation: 'Civil servant / Information officer',
  nokName: 'Oluwakemi Dada', nokPhone: '08053664513', nokAddress: '4 Tinubu Street, Alapere Ketu',
};
/** Fill every field of OLU that is on the current step (no frames). */
async function fillStep(R) {
  for (const [k, v] of Object.entries(OLU)) {
    const f = R.page.locator(`.dk-capture [name="${k}"]`).first();
    if (await f.count() && await f.isVisible().catch(() => false) && !(await f.inputValue().catch(() => ''))) await f.fill(v).catch(() => {});
  }
}

const btn = (R, text) => R.page.locator('button', { hasText: text }).first();
const exact = (R, text) => R.page.getByRole('button', { name: text, exact: true }).first();

/** The newest application in the browser's store, and the walkthrough case linked to it. */
const newest = (R) => R.page.evaluate(() => {
  const cs = JSON.parse(localStorage.getItem('aof_cases') || '[]');
  const r = cs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const links = JSON.parse(localStorage.getItem('aof_maestro_links') || '{}');
  return r && { id: r.id, name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(), inst: links[r.id] };
});

/** Walk a wizard's remaining steps with Continue (one frame each), stopping at `until`. */
async function steps(R, until, captions) {
  for (let i = 0; i < 10; i++) {
    if (await R.page.getByRole('heading', { name: until }).count()) return;
    await R.click(exact(R, 'Continue'), captions[i] ?? 'Next.', { minor: true, wait: 700 });
  }
}


/** Approve the stage the case is parked on, and wait for the case to move on. */
async function approve(R, stage, caption, opts = {}) {
  const b = R.page.locator('button', { hasText: new RegExp(`^Approve ${stage} & advance$`) }).first();
  await b.waitFor({ state: 'visible', timeout: 30000 });
  await R.click(b, caption, { wait: 600, ...opts });
  // The desk polls the case until the next stage's approval (or completion) shows.
  await R.page.waitForFunction((st) => {
    const t = document.querySelector('.dk-case-body')?.innerText || '';
    return !t.includes(`Approve ${st} & advance`) || /Onboarding case completed/.test(t);
  }, stage, { timeout: 40000 });
  await R.settle(900);
}


// ── The four application flows ──────────────────────────────────────────────────────
// Individual and corporate, each two ways in: the customer's completed paper form,
// uploaded and read, or the form filled in on the desk. A flow is its way in followed
// by the journey both ways share — the same scene code, run once per flow, so the
// reference, the case and the account on screen are always that flow's own. A scene
// that shows nothing of the application (the case in Maestro) is captured once and its
// frames reused: `same` names the scene to copy (run.cjs).
const IND_UPLOAD = 'Individual · upload';
const IND_FILL = 'Individual · fill in';
const CORP_UPLOAD = 'Corporate · upload';
const CORP_FILL = 'Corporate · fill in';

/** Who an individual flow is about, for its captions. */
const OLU_WHO = { first: 'Olumuyiwa', full: 'Olumuyiwa Dada', he: 'he', him: 'him', his: 'his', theirs: 'his' };
const cap = (w) => w[0].toUpperCase() + w.slice(1);

const field = (R, name) => R.page.locator(`.dk-capture [name="${name}"]`).first();
/** Pick an option in one of the wizard's labelled selects (no frame). */
const choose = (R, label, value) => R.page.locator('.dk-capture .cx-field', { hasText: label }).locator('select').first().selectOption(value);

// Opens whichever flow comes first.
const LAUNCH = {
  id: 'launch', persona: 'Overview', title: 'One place for every surface',
  async run(R) {
    await R.go(A.launcher, `Everything in this demo runs from one ${BANK} workspace: the customer’s app, the branch desk, operations, the core banking and messaging views, and the control tower.`, { wait: 1500 });
  },
};

/** An individual's account opening, from the desk to the case in Maestro. */
function individualFlow({ act, key, upload, who, maestroFrom }) {
  const { first, full, he, him, his, theirs } = who;
  const He = cap(he), His = cap(his);
  return [
  {
    id: `${key}-apply`, act, persona: 'Relationship manager', title: upload ? `${first}’s paper form, uploaded` : `${first}’s form, filled in at the desk`,
    async run(R, s) {
      if (!upload) {
        await R.go(A.desk, `${full} walks into ${BANK}’s ${S.branch} branch to open a savings account. This is the relationship manager’s desk.`, { wait: 2500 });
        await R.click(btn(R, 'Open an account'), 'Open an account: every application the branch is working on, and where each one is in its case.', { minor: true, wait: 1200 });
        await R.click(btn(R, 'New application'), `A new application, captured with ${him} at the desk.`, { wait: 1200 });
        await R.type(R.page.locator('.dk-capture [name="firstName"]'), OLU.firstName, `The relationship manager takes ${his} details as guided questions — ${his} name…`, { short: `The RM captures ${his} details as guided questions.` });
        await R.type(R.page.locator('.dk-capture [name="lastName"]'), OLU.lastName, '', { minor: true });
        await fillStep(R);
        await R.type(R.page.locator('.dk-capture [name="phone"]'), OLU.phone, `…and how to reach ${him}. Everything else is the bank’s approved form, one step at a time.`, { minor: true });
        return;
      }
      await R.go(A.desk, `${full} walks into ${BANK}’s ${S.branch} branch with the account-opening form ${he} has already filled in by hand. This is the relationship manager’s desk.`, { wait: 2500 });
      await R.click(btn(R, 'Open an account'), 'Open an account: every application the branch is working on, and where each one is in its case.', { minor: true, wait: 1200 });
      await R.click(btn(R, 'New application'), 'A new application.', { wait: 1200 });
      await R.upload(R.page.locator('label.cx-drop:not(.pk-drop)'), S.individual.formName,
        'Instead of typing the paper form in, they upload a scan of it.', { path: FORM_IND, wait: 300 });
      await R.page.locator('.prv').waitFor({ state: 'visible', timeout: 20000 });
      await R.page.waitForTimeout(4000);
      await R.view('The form is read page by page, in the browser. (Identifiers on this sample scan are blacked out for the demo.)', R.page.locator('.prv'), { stay: true });
      await R.page.locator('.prv-foot button:not([disabled])', { hasText: 'Use these details' }).waitFor({ timeout: 40000 });
      await R.page.waitForTimeout(600);
      await R.view('Every field read off the form, each with how sure the read is. A low score marks a field to check, not a guess passed off as fact.', R.page.locator('.prv-fields'), { stay: true });
      await R.click(R.page.locator('.prv-foot button', { hasText: 'Use these details' }), 'They take the details into the application.', { stay: true, wait: 900 });
    },
  },
  {
    id: `${key}-submit`, act, persona: 'Relationship manager', title: `Checked with ${him}, step by step, and submitted`,
    async run(R, s) {
      if (upload) {
        await R.view(`The application has filled itself in from the form. The relationship manager checks each step with ${first} instead of retyping it.`, R.page.getByRole('heading', { name: 'Customer details' }), { short: 'The application fills itself in from the form; each step is checked with the customer.' });
        await steps(R, /Check the details/, ['Name and contact details are right. On to identity…', `…${his} BVN and NIN, as written on the form…`, `…${his} address…`, `…${his} work…`, `…and the account ${he} wants, with ${his} next of kin.`]);
      } else {
        // Typed capture: each step filled with him, the identity step shown.
        const caps = ['On to identity…', '', `…${his} address…`, `…${his} work…`, `…and the account ${he} wants, with ${his} next of kin.`];
        for (let i = 0; i < 10; i++) {
          if (await R.page.getByRole('heading', { name: /Check the details/ }).count()) break;
          await fillStep(R);
          const bvn = R.page.locator('.dk-capture [name="bvn"]');
          if (await bvn.count() && await bvn.isVisible().catch(() => false)) {
            await bvn.fill('');
            await R.type(bvn, OLU.bvn, `${His} BVN and NIN — checked at source with NIBSS and NIMC the moment the application is submitted.`, { short: `${His} BVN and NIN, checked at source on submit.` });
            await fillStep(R);
          }
          await R.click(exact(R, 'Continue'), caps[i] ?? 'Next.', { minor: true, wait: 700 });
        }
      }
      await R.view('One last look at everything before it goes in.', R.page.getByRole('heading', { name: /Check the details/ }));
      const consent = R.page.locator('.dk-capture input[type=checkbox]').last();
      if (await consent.count()) await R.click(consent, `${first} confirms the details are ${theirs} and consents to ${BANK} verifying them with NIBSS, NIMC and its screening partners.`);
      await R.click(btn(R, 'Submit application'), `Submit. That starts ${his} account-opening case in UiPath Maestro.`, { wait: 3500 });
      s[key] = await newest(R);
      await R.view('Received, with a reference. The checks start in the background straight away.', R.page.locator('.dk-capture').first(), { stay: true });
    },
  },
  {
    id: `${key}-kyc`, act, persona: 'Relationship manager · identity verification', title: `KYC with ${him} at the desk: the face check`,
    async run(R, s) {
      const cap = R.page.locator('.dk-capture').first();
      await R.click(btn(R, 'Complete KYC with them now'), `${He} is still at the desk, so instead of sending ${him} a link the relationship manager completes KYC with ${him} now.`, { wait: 1200 });
      // The face check itself, as recorded on the live service (0:41–0:55 of the Hackathon
      // submission video; another demo tenant, branded UiBank). The passport on file is
      // blurred except its photo. See recorded/face/ and HANDOVER.
      await R.video('recorded/face/face-check.mp4', path.join(__dirname, '..', 'recorded', 'face', 'face-check-poster.jpg'),
        'recorded: FaceID on Microsoft Azure · UiBank demo tenant',
        `${His} documents, then the face check — recorded here on the live Microsoft Azure service: Azure confirms a live person and matches the face to the identity on file. In the Verify console: the selfie against the passport on file (blurred), face match and liveness pass, the anti-spoof checks and the audit record.`,
        { short: 'Documents, then a live face check on Microsoft Azure: liveness and face match pass.' });
      // The KYC steps run to the end without frames, so his record carries the result.
      await btn(R, 'Get started').click(); await R.page.waitForTimeout(500);
      for (const d of await R.page.locator('.dk-capture .cx-drop').all()) await d.click();
      await R.page.locator('.dk-capture button', { hasText: /^Continue/ }).last().click(); await R.page.waitForTimeout(1500);
      await R.page.locator('.dk-capture button', { hasText: /finished the check|^Continue/ }).last().click(); await R.page.waitForTimeout(600);
      const pad = R.page.locator('.dk-capture canvas').first();
      const b = await pad.boundingBox();
      if (b) {
        await R.page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.6); await R.page.mouse.down();
        for (let i = 0; i <= 24; i++) await R.page.mouse.move(b.x + b.width * (0.2 + i * 0.025), b.y + b.height * (0.6 - 0.25 * Math.sin(i / 3)));
        await R.page.mouse.up();
      }
      await R.page.locator('.dk-capture button', { hasText: /^Finish/ }).click();
      await R.settle(1200);
      await R.view(`${He} signs with ${his} finger, and KYC is complete: documents, liveness, face match and signature, all on ${his} record.`, cap, { stay: true });
    },
  },
  {
    id: `${key}-intake`, act, persona: 'Relationship manager', title: `${His} case, live in Maestro`,
    async run(R, s) {
      await R.go(A.desk, '', { wait: 2500 });
      await R.page.locator('button', { hasText: 'Open an account' }).first().click();
      await R.settle(1200);
      const row = R.page.locator('button.dk-row', { hasText: s[key].id }).first();
      await R.view(`On the pipeline, ${his} application is already live in UiPath Maestro, at Intake.`, row);
      await R.click(row, 'Open it.', { minor: true, wait: 2500 });
      await R.page.locator('button', { hasText: /^Approve Intake & advance$/ }).first().waitFor({ timeout: 30000 });
      await R.view(`The next best action leads: the case has done its own intake work — read the form, looked ${him} up, pulled ${his} existing relationships — and is waiting on a person for the duplicate and risk pre-screen.`, R.page.locator('.dk-nba').first(), { short: 'The next best action: the case is waiting on a person at Intake.' });
      await R.scrollTo(R.page.locator('.dk-case-body').getByText('Live in Maestro', { exact: true }).first(), 'The live case: five stages, and every step of the current one with its status. Only the gate needs a person.', { minor: true });
      await approve(R, 'Intake', `${first} already banks with ${BANK} and nothing is on the risk list, so the relationship manager approves. The case moves to Verification.`);
      // Verification's automated steps: NIN, BVN, liveness, sanctions and PEP, documents.
      await R.engine((e, id) => e.verify(id), s[key].id);
      await R.settle(1200);
      await R.scrollTo(R.page.locator('.dk-case-body .dk-eyebrow', { hasText: 'Checks' }).first(), 'Verification ran on its own: NIN with NIMC, BVN with NIBSS, AML, PEP and fraud screening, all clear. Each one can be opened.');
    },
  },
  {
    id: `${key}-voice`, act, persona: 'Voice agent', title: `The voice agent calls ${him}`,
    async run(R, s) {
      // Screening's name-collision check diverts the case to its Voice Agent stage.
      R.ov.call(s[key].inst, 'start');
      await R.page.locator('.dk-calls-card.live').waitFor({ timeout: 30000 });
      await R.settle(900);
      await R.view(`Screening found a close match for ${his} name on a watchlist. Instead of parking the case for a person, Maestro hands it to the voice agent — an AI agent that rings ${first} now to confirm ${his} date and place of birth.`, R.page.locator('.dk-calls-card').first(), { short: `A name match on a watchlist: the voice agent rings ${first} to confirm who ${he} is.` });
      await R.scrollTo(R.page.locator('.dk-case-body').getByText('Live in Maestro', { exact: true }).first(), 'In the case, Voice Agent opens as its own stage beside Verification: place the call, speak to the customer, end the call, update the next steps.');
      R.ov.call(s[key].inst, 'end');
      await R.page.waitForFunction(() => /1 call on this case/.test(document.querySelector('.dk-calls-card')?.textContent || ''), null, { timeout: 30000 });
      await R.settle(900);
      await R.view(`${He} confirms, so the match is not ${him}. The call ends, it is logged on the case, and the case returns to Verification on its own — no one at the bank had to pick up the phone.`, R.page.locator('.dk-calls-card').first());
      // The same voice agent, recorded on the live service (Hackathon submission video,
      // 0:58–1:06 and 0:29–0:34; another demo tenant, branded UiBank). No ID documents on screen.
      const VA = (n) => path.join(__dirname, '..', 'recorded', 'voice', n);
      const URL = 'recorded: Voice agent on Azure Voice Live · UiBank demo tenant';
      await R.video('recorded/voice/screening-call.mp4', VA('screening-call-poster.jpg'), URL,
        'Recorded on the live service: the desk turns red while the voice agent is on the call, and in Maestro the Voice Agent stage runs its steps — place the call, speak to the customer, end the call, update the next steps.',
        { short: 'Recorded live: the desk shows the call, and Maestro runs the Voice Agent stage.' });
      await R.video('recorded/voice/rm-call.mp4', VA('rm-call-poster.jpg'), URL,
        `The relationship manager can place a call too. Here the case is waiting on missing documents, so the next best action is to call ${him}: the voice agent introduces itself, confirms it is speaking to ${first} and checks ${his} date of birth — with a live transcript as it talks.`,
        { short: `The RM places a call: the agent verifies ${him}, with a live transcript.` });
    },
  },
  {
    id: `${key}-checks`, act, persona: 'Relationship manager', title: 'Every check, with its evidence',
    async run(R, s) {
      await R.click(R.page.locator('.dk-case-body button', { hasText: /^View$/ }).first(), 'The NIN check…', { wait: 1500 });
      await R.view('…is the real NIMC call: what was sent, what came back, how long it took, and each field matched against the application. It can be re-run from here.', R.page.locator('.ad-scrim > *').first(), { stay: true });
      await R.click(R.page.locator('.ad-scrim').getByRole('tab', { name: 'BVN', exact: true }).first(), 'The BVN check with NIBSS, the same way.', { stay: true, minor: true, wait: 1000 });
      await R.view('', R.page.locator('.ad-scrim > *').first(), { stay: true, minor: true });
      await R.click(R.page.locator('.ad-scrim').getByRole('tab', { name: 'Document checks', exact: true }).first(), 'Document checks…', { stay: true, wait: 1200 });
      await R.view('…judged against the bank’s Document rules: each check, its outcome and the rule row that decided it. A referral asks a person; nothing is silently blocked.', R.page.locator('.ad-scrim > *').first(), { stay: true });
      await R.click(R.page.locator('.ad-scrim').getByRole('tab', { name: 'Applicant', exact: true }).first(), 'The record itself: every detail captured…', { stay: true, wait: 1000 });
      await R.view('…personal, identification, contact and address — each editable by the relationship manager, with every change logged.', R.page.locator('.ad-scrim > *').first(), { stay: true, minor: true });
      await R.click(R.page.locator('.ad-scrim').getByRole('tab', { name: 'Employment & account', exact: true }).first(), 'Employment, income and the account applied for.', { stay: true, minor: true, wait: 1000 });
      await R.view('', R.page.locator('.ad-scrim > *').first(), { stay: true, minor: true });
      // Web research calls a live web-search agent with the applicant's name, so it is
      // refused in the capture; the same tab, recorded on the live service (Hackathon video 1:10–1:14).
      await R.video('recorded/research/web-research.mp4', path.join(__dirname, '..', 'recorded', 'research', 'web-research-poster.jpg'),
        'recorded: Web research agent on Azure AI Foundry · UiBank demo tenant',
        `Web research, recorded on the live service: an AI agent searches the public web for the applicant, reads what comes back, and says whether anything can be tied to ${him} — here, no adverse media. Every search and source is kept.`,
        { short: 'Web research: an agent searches the public web — no adverse media.' });
      await R.click(R.page.locator('.ad-scrim button', { hasText: /^Close$/ }).last(), 'Back to the case.', { stay: true, minor: true, wait: 800 });
    },
  },
  {
    id: `${key}-decide`, act, persona: 'Relationship manager', title: 'Decision and activation',
    async run(R, s) {
      await R.top();
      await approve(R, 'Verification', 'No exceptions to review, so the analyst gate is approved…');
      await approve(R, 'Decision', '…the routing rules found nothing that needs enhanced due diligence, and the officer approves the decision.');
      // Activation's automated steps: the CIF and account in Finacle, channels, comms.
      s[key].account = await R.engine((e, id) => e.account(id), s[key].id);
      await R.settle(1200);
      await R.view(`Activation ran: ${BANK}’s core banking has opened ${his} CIF and account ${s[key].account ?? ''}, set up ${his} channels and card, and told ${him}.`, R.page.locator('.dk-case-body').first(), { stay: true });
      await approve(R, 'Activation', 'Activation is signed off…', { minor: true });
      await approve(R, 'Closure', '…and Closure assembles the case packet and the audit report.', { minor: true });
      await R.engine((e, id) => e.activate(id), s[key].id);
      await R.settle(1500);
      await R.top();
      await R.view('Done: every stage complete in Maestro, the account fully active, and every step on the record.', R.page.getByText('Onboarding case completed').first(), { short: 'The case is complete and the account fully active.' });
      await R.click(R.page.locator('.dk-tabs [role=tab]', { hasText: 'Messages' }).first(), `Messages: every SMS, WhatsApp and e-mail ${he} was sent, with delivery status…`, { wait: 1000 });
      await R.click(R.page.locator('.dk-tabs [role=tab]', { hasText: 'Activity' }).first(), '…and Activity: the full history of the application, step by step, for audit.', { wait: 1000 });
    },
  },
  {
    id: `${key}-account`, act, persona: 'Core banking · events · messaging', title: 'Finacle, the event stream and the customer',
    async run(R, s) {
      await R.go(A.finacle, `In Finacle, the core banking system: ${first}’s CIF and account ${s[key].account ?? ''}, active.`, { wait: 2500 });
      await R.go(A.kafka, `On the event stream, every step of ${his} case as it happened — the application, the checks, the account, the notifications — for any other system to act on.`, { wait: 2500 });
      await R.go(A.comms, `And the messages ${he} received: the welcome, with ${his} new account number.`, { wait: 2500 });
    },
  },
  {
    id: `${key}-maestro`, act, same: maestroFrom, persona: 'UiPath Maestro · case management', title: 'The case in UiPath Maestro',
    async run(R) {
      // A live OnboardingCase instance on staging, opened read-only. Pause / Cancel are
      // never clicked; the write guard would answer them locally anyway.
      const p = R.page;
      // The staging sign-in round trip (callback, token) is sometimes slow: one reload.
      const trail = p.getByText('Execution trail', { exact: true });
      for (let i = 0; i < 2; i++) {
        await p.goto(C.apps.maestro, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        if (await trail.waitFor({ timeout: 45000 }).then(() => true, () => false)) break;
        if (i === 1) throw new Error('Maestro did not load — is the capture profile still signed in to staging? (see HANDOVER)');
      }
      await p.waitForTimeout(4000);
      await R.view('Behind the desk is UiPath Maestro case management. This is a live onboarding case on the tenant: the case plan the desk has been reading all along — and, below, its execution trail.', undefined, { short: 'The case in UiPath Maestro: the case plan and its execution trail.' });
      await R.click(p.getByRole('button', { name: 'Hide execution trail and details' }), 'The plan in full…', { minor: true, wait: 800 });
      await R.click(p.getByRole('button', { name: 'Fit to view' }), '', { minor: true, wait: 1500 });
      await p.mouse.move(720, 125); await p.waitForTimeout(400); // clear the button's tooltip
      await R.view('Five primary stages — Intake, Verification, Decision, Activation, Closure — each with its tasks: robots and agents run in parallel, a person only at the gate (marked *). Entry points on the left: branch tablet, mobile app, fax, email, a regulatory deadline.', undefined, { stay: true });
      await R.view('Below, the secondary stages the case can divert into and come back from: EDD review for high-risk and PEP cases, compliance escalations, pending customer, and the terminal declined / withdrawn.', undefined, { stay: true });
      await R.view('Green is done, with how long each stage took. This case is at Decision, waiting on the onboarding officer — and past its SLA, which is why it shows red.', undefined, { stay: true, short: 'This case is at Decision, waiting on the officer and past its SLA.' });
      await R.click(p.getByRole('button', { name: 'Show execution trail and details' }), 'The execution trail…', { minor: true, wait: 1200 });
      await p.mouse.move(720, 125); await p.waitForTimeout(400);
      await R.view('…every step the case took, in which stage and when: the trigger, the case manager — the AI orchestrator deciding what runs next — and each task. Beside it, the case variables; Action history and Incidents record every pause, cancel, reassignment and failure.', p.getByText('Execution trail', { exact: true }).first(), { stay: true });
    },
  },
  ];
}

/** A company's account opening, from the desk to its account in Finacle. */
function corporateFlow({ act, key, upload, co }) {
  return [
  {
    id: `${key}-apply`, act, persona: 'Relationship manager', title: upload ? `${co.company}: the corporate form, uploaded` : `${co.company}: the corporate form, filled in at the desk`,
    async run(R, s) {
      await R.go(A.desk, upload
        ? `${co.company}, ${co.what}, wants a corporate current account. Its directors bring the completed corporate account-opening form to the branch.`
        : `${co.company}, ${co.what}, wants a business current account. There is no completed form: the relationship manager fills it in with the owner at the desk.`, { wait: 2500 });
      await R.click(btn(R, 'Open an account'), '', { minor: true, wait: 1200 });
      await R.click(btn(R, 'New application'), 'A new application…', { minor: true, wait: 1200 });
      const corp = R.page.locator('.dk-capture button', { hasText: /^Corporate$/ }).first();
      // The pipeline can still be settling on arrival: open the capture again if it missed.
      if (!(await corp.waitFor({ timeout: 8000 }).then(() => true, () => false))) {
        await btn(R, 'New application').click();
        await corp.waitFor({ timeout: 15000 });
      }
      await R.click(corp, '…for a company.', { wait: 1200 });
      if (!upload) {
        const t = co.typed;
        await R.type(field(R, 'company'), t.company, 'The relationship manager fills in the corporate form with the owner: the business name…', { short: 'The RM fills in the corporate form with the owner.' });
        await R.type(field(R, 'rc'), t.rc, '…its registration number with the Corporate Affairs Commission…', { minor: true });
        await R.type(field(R, 'tin'), t.tin, '…and its tax ID. Both are checked at source — CAC and FIRS — when the application is submitted.', { minor: true });
        for (const k of ['sector', 'address', 'email', 'phone']) await field(R, k).fill(t[k]);
        await choose(R, 'Category of business', t.bizType);
        await choose(R, 'Annual turnover', t.turnover);
        return;
      }
      await R.upload(R.page.locator('.dk-capture label.cx-drop:not(.pk-drop)'), co.formName,
        `The completed corporate form is uploaded, all ${co.pages} pages.`, { path: co.form, wait: 300 });
      await R.page.locator('.prv').waitFor({ state: 'visible', timeout: 30000 });
      await R.page.waitForTimeout(4000);
      await R.view('Read the same way: the entity, its registration and tax numbers, the turnover, and every director and signatory. (Identifiers and signatures on this sample scan are blacked out.)', R.page.locator('.prv'), { stay: true });
      await R.page.locator('.prv-foot button:not([disabled])', { hasText: 'Use these details' }).waitFor({ timeout: 60000 });
      await R.page.waitForTimeout(600);
      await R.view('', R.page.locator('.prv-fields'), { stay: true, minor: true });
      await R.click(R.page.locator('.prv-foot button', { hasText: 'Use these details' }), 'Into the application.', { stay: true, minor: true, wait: 900 });
    },
  },
  {
    id: `${key}-submit`, act, persona: 'Relationship manager', title: 'The company and its director, checked and submitted',
    async run(R, s) {
      await R.view(upload ? 'The company, exactly as registered — filled in from the form.' : 'The company as registered: name, RC number, TIN, category, turnover and contact details.', R.page.getByRole('heading', { name: 'Business details' }));
      await R.click(exact(R, 'Continue'), '', { minor: true, wait: 800 });
      if (!upload) {
        const d = co.typed.directors[0];
        await R.type(field(R, 'd-name-0'), d.name, `Then everyone who signs. ${d.name}…`, { minor: true });
        await R.type(field(R, 'd-bvn-0'), d.bvn, '…with the BVN that NIBSS verifies in the background.', { minor: true });
        for (const [k, v] of [['d-id-0', d.idNumber], ['d-ph-0', d.phone], ['d-em-0', d.email]]) await field(R, k).fill(v);
        await choose(R, 'Role', d.role);
      }
      await R.view(`${co.directors} Everyone who signs is verified with NIBSS in the background; more can be added.`, R.page.getByRole('heading', { name: /Directors/ }));
      await R.click(exact(R, 'Continue'), '', { minor: true, wait: 800 });
      await R.view('A last check…', R.page.getByRole('heading', { name: /Check the details/ }), { minor: true });
      await R.click(R.page.locator('.dk-capture input[type=checkbox]').last(), 'The signatory confirms the details and consents to the checks on the company and each director.', { minor: true });
      await R.click(btn(R, 'Submit application'), 'Submitted: the company’s own corporate onboarding case starts in Maestro.', { wait: 3500 });
      s[key] = await newest(R);
    },
  },
  {
    id: `${key}-case`, act, persona: 'Relationship manager', title: 'A corporate case, its own stages',
    async run(R, s) {
      await R.page.mouse.click(8, 450); // close the capture (its backdrop)
      await R.settle(800);
      const row = R.page.locator('button.dk-row', { hasText: s[key].id }).first();
      await R.click(row, 'On the pipeline, the company’s application, live at Intake.', { wait: 2500 });
      await R.page.locator('button', { hasText: /^Approve Intake & advance$/ }).first().waitFor({ timeout: 30000 });
      await R.scrollTo(R.page.locator('.dk-case-body').getByText('Live in Maestro', { exact: true }).first(), 'The corporate case plan does more at Intake: it analyses the CAC pack, verifies the RC number with the CAC registry and the TIN with FIRS, then asks a person for the entity duplicate and risk pre-screen.');
      await approve(R, 'Intake', 'Clean, so it is approved.');
      await R.engine((e, id) => e.verify(id), s[key].id);
      await R.settle(1200);
      await R.click(R.page.locator('.dk-case-body button', { hasText: /^View$/ }).first(), 'The checks are open to inspect, as for an individual…', { minor: true, wait: 1500 });
      await R.click(R.page.locator('.ad-scrim').getByRole('tab', { name: /^Directors/ }).first(), '…with a tab for the directors.', { stay: true, wait: 1000 });
      await R.view('Each director and signatory with their role and BVN — the people Verification checks, along with the beneficial owners.', R.page.locator('.ad-scrim > *').first(), { stay: true });
      await R.click(R.page.locator('.ad-scrim button', { hasText: /^Close$/ }).last(), '', { stay: true, minor: true, wait: 800 });
    },
  },
  {
    id: `${key}-open`, act, persona: 'Relationship manager', title: 'Mandate, signatories, account',
    async run(R, s) {
      await R.top();
      await approve(R, 'Verification', 'Directors and beneficial owners verified, SCUML checked: approved…');
      await approve(R, 'Decision', '…the corporate risk rating needs no enhanced due diligence, and the mandate decision is approved.');
      s[key].account = await R.engine((e, id) => e.account(id), s[key].id);
      await R.settle(1200);
      await R.view(`Activation: the corporate CIF and account ${s[key].account ?? ''} in Finacle, the mandate and signing limits, the specimen signatures and online banking tokens.`, R.page.locator('.dk-case-body').first(), { stay: true });
      await approve(R, 'Activation', 'The signatories are activated…', { minor: true });
      await approve(R, 'Closure', '…and the corporate case closes with its packet and audit report.', { minor: true });
      await R.engine((e, id) => e.activate(id), s[key].id);
      await R.settle(1500);
      await R.top();
      await R.view(`${co.company} is open for business with ${BANK}.`, R.page.getByText('Onboarding case completed').first());
      await R.go(A.finacle, `In Finacle, the company’s CIF and account ${s[key].account ?? ''}, active.`, { wait: 2500 });
    },
  },
  ];
}

const FLOWS = [
  ...(FORM_IND ? individualFlow({ act: IND_UPLOAD, key: 'indu', upload: true, who: S.individual.who || OLU_WHO }) : []),
  ...individualFlow({ act: IND_FILL, key: 'indf', upload: false, who: OLU_WHO, maestroFrom: FORM_IND ? 'indu-maestro' : null }),
  ...corporateFlow({ act: CORP_UPLOAD, key: 'corpu', upload: true, co: S.corporate }),
  {
    id: 'corp-package', act: CORP_UPLOAD, persona: 'Relationship manager', title: 'Or the whole package at once',
    async run(R) {
      await R.go(A.desk, '', { wait: 2500 });
      await R.page.locator('button', { hasText: 'Open an account' }).first().click(); await R.settle(1000);
      await R.click(btn(R, 'New application'), 'A business often brings everything at once: the form, its CAC certificate, board resolution, TIN and IDs.', { wait: 1200 });
      const corp = R.page.locator('.dk-capture button', { hasText: /^Corporate$/ }).first();
      if (!(await corp.waitFor({ timeout: 8000 }).then(() => true, () => false))) { await btn(R, 'New application').click(); await corp.waitFor({ timeout: 15000 }); }
      await corp.click(); await R.page.waitForTimeout(1000);
      const files = require('fs').readdirSync(PKG_DIR).map((f) => path.join(PKG_DIR, f));
      await R.upload(R.page.locator('.dk-capture label.pk-drop'), `${files.length} files`, 'So the whole package is uploaded in one go. (Generated demo documents — no real business.)', { path: files, wait: 4000 });
      const close = R.page.locator('.prv .cx-x').first();
      if (await R.page.locator('.prv').count()) {
        await R.page.waitForTimeout(2500);
        await R.view('Each file is identified from its content and read in turn, one tab per document — the customer’s first, then third parties, then the bank’s own.', R.page.locator('.prv'), { stay: true, short: 'Each document identified and read, one tab each.' });
        await close.click(); await R.page.waitForTimeout(600);
      }
      await R.view('Then the package, sorted by who produced each document — customer, third party (CAC), bank (TIN) — and what was read from each. Any file can be opened beside what was read off it.', R.page.locator('.dk-capture .pk').first(), { stay: true });
      await R.page.locator('.dk-capture .pk button', { hasText: 'Remove' }).first().click().catch(() => {});
      await R.page.mouse.click(8, 450); await R.page.waitForTimeout(600);
    },
  },
  ...corporateFlow({ act: CORP_FILL, key: 'corpf', upload: false, co: S.corporateTyped }),
];

const SCENES = [
  { ...LAUNCH, act: FLOWS[0].act },
  ...FLOWS,
  // ── Bulk ──────────────────────────────────────────────────────────────────────────
  {
    id: 'bulk-intake', act: 'Bulk', persona: 'Relationship manager', title: 'Twenty staff accounts in one upload',
    async run(R, s) {
      await R.go(A.desk, '', { wait: 2500 });
      await R.click(btn(R, 'Open an account'), 'An employer is opening salary accounts for its staff. The relationship manager does not capture them one by one…', { minor: true, wait: 1200 });
      await R.click(btn(R, 'Bulk upload'), '…it is a bulk upload.', { wait: 1500 });
      await R.view('Two channels into the same process: an Excel manifest of who may be onboarded, or a bundle of completed account-opening packages. This employer sends packages.', R.page.getByText('AOP bundle', { exact: true }).first());
      await R.type(R.page.locator('input[placeholder="e.g. Flour Mills — Sept drive"]'), 'Lagos State Government — October staff drive', 'The batch is named…', { minor: true });
      await R.pick(R.page.locator('select').nth(1), 'Retail — Employee Value Banking', '…as Employee Value Banking.', { minor: true });
      await R.upload(R.page.locator('button', { hasText: 'Choose .zip' }), 'document-package.zip', 'One ZIP: a folder per employee with their form, ID and utility bill. (Demo data — no real people.)', { path: BUNDLE, wait: 1500 });
      await R.click(R.page.locator('button', { hasText: /^Validate/ }), 'Nothing is created until intake has checked it.', { wait: 3000 });
      await R.view('Twenty customers found. Five go back with a reason instead of being silently dropped: no ID, a bill too old, no proof of address, a BVN that appears twice, and a file in no one’s folder.', R.page.getByText('Rejected — returned to you', { exact: false }).first(), { short: 'Intake checks every folder: 15 accepted, 5 returned with a reason.' });
      await R.click(R.page.locator('button', { hasText: /^Process 15 applications/ }), 'The other fifteen are processed.', { wait: 8000 });
      await R.view('Each one is verified in parallel — NIN, BVN, TIN, ID, sanctions, watchlists, adverse media — and reconciled against the form. Here the first eight run as live Maestro cases.', R.page.getByText(/running live in Maestro/).first());
    },
  },
  {
    id: 'bulk-maker', act: 'Bulk', persona: 'Operations maker', title: 'The maker confirms what was read',
    async run(R, s) {
      await R.click(R.page.locator('button', { hasText: /^Maker/ }), 'Now operations, as the maker.', { wait: 1500 });
      await R.view('The maker’s queue. The scanned forms were read by OCR, so a person confirms each one before any account exists — lowest confidence first.', R.page.getByText('Extraction review', { exact: true }).first());
      await R.click(R.page.locator('button', { hasText: /^Review next/ }), 'The first one.', { minor: true, wait: 2000 });
      await R.view('The form beside what was read from it. The date of birth was read at 69%, so it is ringed on both sides; the sources reconcile, and every check has already run.', R.page.locator('main, .dk-main').first(), { stay: true });
      const next = R.page.locator('button', { hasText: /^Approve (and take the next|extraction)/ }).first();
      await R.click(next, 'Correct, so it is approved and the next one opens.', { wait: 1500 });
      for (let i = 0; i < 6 && (await next.count()); i++) await R.click(next, '', { minor: true, wait: 1500 });
    },
  },
  {
    id: 'bulk-verify', act: 'Bulk', persona: 'Operations verifier', title: 'The verifier opens the accounts',
    async run(R, s) {
      await R.click(R.page.locator('button', { hasText: /^Verifier/ }), 'A second person — the verifier — authorises. Maker and checker are always different people.', { wait: 1500 });
      await R.view('Each account with its post-no-debit position set by rule: savings and salary accounts open operative; a current account opens on PND until its documents are complete.', R.page.getByText('PND by rule', { exact: false }).first());
      await R.click(R.page.locator('button', { hasText: /^Create \d+ accounts/ }), 'Create the accounts. It is idempotent: a retry never opens a second account for the same application.', { wait: 3000 });
      await R.click(R.page.locator('button', { hasText: /^Relationship Manager$/ }), 'Back with the relationship manager…', { minor: true, wait: 1500 });
      await R.view('…the batch: accounts open, the exceptions with their reasons, and nothing left unexplained.', R.page.locator('main, .dk-main').first(), { stay: true, short: 'The batch: accounts open, every exception with its reason.' });
      const exc = R.page.locator('.bk-tabs [role=tab]', { hasText: /^Exceptions/ }).first();
      if (await exc.count()) {
        await R.click(exc, 'Exceptions: the applications that need a decision…', { wait: 1500 });
        await R.view('…each one a case of its own: what triggered it, the evidence beside it, and the disposition to choose — every choice recorded.', R.page.locator('main, .dk-main').first(), { stay: true });
      }
    },
  },
  {
    id: 'bulk-manifest', act: 'Bulk', persona: 'Relationship manager', title: 'The other channel: an Excel manifest',
    async run(R) {
      await R.click(R.page.locator('button', { hasText: 'New submission' }).first(), 'The second channel: an employer sends only a list of who may be onboarded — an Excel manifest — and each person fills in their own form.', { wait: 1200 });
      await R.click(R.page.locator('button', { hasText: 'Excel manifest' }).first(), '', { minor: true, wait: 800 });
      await R.upload(R.page.locator('button', { hasText: 'Upload .csv' }), 'manifest-with-errors.csv', 'The manifest is uploaded (this sample has deliberate mistakes)…', { path: MANIFEST, wait: 1200 });
      await R.click(R.page.locator('button', { hasText: /^Validate/ }), '…and checked row by row before anything starts.', { wait: 2500 });
      await R.view('Every bad row goes back with its reason: no reference, no name, neither BVN nor NIN, no way to contact them, a duplicate reference. Only clean rows go on.', R.page.getByText('Rejected — returned to you', { exact: false }).first(), { short: 'Bad rows returned with a reason; only clean rows go on.' });
      await R.click(R.page.locator('button', { hasText: /^Process \d+ application/ }), 'Process the rest: each person gets an invitation link tied to their manifest row.', { wait: 6000 });
      await R.click(R.page.locator('.bk-tabs [role=tab]', { hasText: 'Invitations' }), 'Invitations…', { wait: 1500 });
      await R.view('…how far each invited person has got: invited, opened the link, completed — and a chaser for anyone who has not responded. The link fixes the reference, BVN and NIN, so the manifest stays a control on who is onboarded.', R.page.locator('main, .dk-main').first(), { stay: true, short: 'The invitation funnel, and a chaser for anyone who has not responded.' });
    },
  },
  // ── The customer, on their own ────────────────────────────────────────────────────
  {
    id: 'cust-apply', act: 'Customer', persona: 'Customer', title: 'An existing customer opens an account herself',
    async run(R, s) {
      await R.go(A.customer, `Adaeze Okafor already banks with ${BANK}. She opens a second account herself, in ${S.app} — no branch visit.`, { wait: 2000 });
      await R.click(R.page.locator('button', { hasText: 'Open an account' }).first(), 'Open an account: about five minutes, her BVN and NIN checked at source in the background.', { wait: 1200 });
      await R.click(R.page.locator('button', { hasText: 'Open an account' }).nth(1), 'She starts.', { minor: true, wait: 1200 });
      await R.type(R.page.locator('[name="firstName"]').first(), 'Adaeze', 'Her name…', { short: 'She fills in the form herself; most of it comes from her profile.' });
      await R.type(R.page.locator('[name="lastName"]').first(), 'Okafor', '', { minor: true });
      await R.view('She already banks here, so most of the rest — identity, address, work — comes from her profile; she checks each step.', R.page.locator('h1').first(), { minor: true });
      for (let i = 0; i < 8; i++) {
        if (await R.page.locator('button', { hasText: /^Submit/ }).count()) break;
        await R.click(exact(R, 'Continue'), '', { minor: true, wait: 600 });
      }
      await R.click(R.page.locator('input[type=checkbox]').last(), 'She consents to the checks…', { minor: true });
      await R.click(R.page.locator('button', { hasText: /^Submit/ }).first(), '…and submits. Her case starts in Maestro, like any other.', { wait: 3500 });
      // Her record: the reference on the confirmation screen.
      const ref = ((await R.page.evaluate(() => document.body.innerText)).match(/AO-\d{4}-\d{6}/) || [])[0];
      s.cust = await R.page.evaluate((id) => { const r = JSON.parse(localStorage.getItem('aof_cases') || '[]').find((c) => c.id === id); return r && { id: r.id, token: r.kycToken }; }, ref);
      if (!s.cust) throw new Error(`customer record ${ref} not found`);
      await R.view('Received, with her reference. She does not wait on a queue; the bank texts her when her account number is ready.', R.page.getByText('Application received', { exact: false }).first());
      await R.click(R.page.locator('button', { hasText: 'Track my application' }), 'She can follow it any time…', { wait: 2000 });
      await R.view('…in plain words: where it is, every check, and what happens next.', R.page.getByText(/^progress$/i).first(), { minor: true });
    },
  },
  {
    id: 'cust-kyc', act: 'Customer', persona: 'Customer', title: 'Her account opens; she finishes KYC from a link',
    async run(R, s) {
      // The case's automated steps: verification and the Finacle account.
      await R.engine((e, id) => e.verify(id), s.cust.id);
      await R.engine((e, id) => e.account(id), s.cust.id);
      await R.go(A.comms, 'Her account opens straight away, and the notification service texts her the account number with a link to finish KYC.', { wait: 2500 });
      await R.go(`${C.apps.launcher}kyc/${s.cust.token}`, 'The link opens on her phone — no login; the token is the key.', { wait: 2000 });
      await R.click(btn(R, 'Get started'), 'Three things: her documents, a selfie, her signature.', { minor: true, wait: 800 });
      for (const d of await R.page.locator('.cx-drop').all()) await d.click();
      await R.view('Her ID and proof of address, photographed…', R.page.locator('h1').first(), { minor: true });
      await R.page.locator('button', { hasText: /^Continue/ }).last().click(); await R.page.waitForTimeout(1500);
      // The selfie is the same live face check shown at the desk (the recorded clip).
      await R.page.locator('button', { hasText: /finished the check|^Continue/ }).last().click(); await R.page.waitForTimeout(600);
      const pad = R.page.locator('canvas').first(); const b = await pad.boundingBox();
      if (b) { await R.page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.6); await R.page.mouse.down(); for (let i = 0; i <= 24; i++) await R.page.mouse.move(b.x + b.width * (0.2 + i * 0.025), b.y + b.height * (0.6 - 0.25 * Math.sin(i / 3))); await R.page.mouse.up(); }
      await R.view('…the same live face check, then she signs with her finger.', R.page.locator('canvas').first());
      await R.click(btn(R, 'Finish'), 'Finish.', { minor: true, wait: 1200 });
      await R.view('All set: every limit lifted, her account fully active — without ever coming to the branch.', R.page.locator('h1').first());
    },
  },
  // ── What the relationship manager can do ─────────────────────────────────────────
  {
    id: 'rm-desk', act: 'Relationship manager', persona: 'Relationship manager', title: 'My desk: what needs me next',
    async run(R) {
      await R.go(A.desk, 'The relationship manager’s day starts on My desk. One card says what to do next and why — here a bulk-batch application with a check only a person can clear.', { wait: 2500 });
      await R.view('Then the numbers that matter: what needs them, what is breaching its SLA, what is in flight with no action needed, and how much of their book went straight through.', R.page.getByText('Needs you', { exact: false }).first());
      await R.scrollTo(R.page.getByText('Needs you now', { exact: false }).first(), 'Every application they own — walk-in, corporate and bulk — sorted by what needs them first, with its live Maestro stage.');
    },
  },
  {
    id: 'rm-approvals', act: 'Relationship manager', persona: 'Relationship manager', title: 'Approvals: maker-checker',
    async run(R) {
      await R.click(R.page.locator('button', { hasText: /^Approvals/ }).first(), 'Approvals: requests from across the branch that need their authority — payments, limits, waivers, exceptions — with the value and the SLA.', { wait: 1500 });
      await R.click(R.page.getByText('Overdraft limit increase').first(), 'An overdraft limit increase for Meridian Trading…', { wait: 1500 });
      await R.view('…with the maker’s justification and the facts beside it. It is above the RM’s own limit, so the recommendation is to route it for dual approval. Every decision is logged with a reason code.', undefined, { short: 'Each request with its justification; above their limit it routes for dual approval.' });
    },
  },
  {
    id: 'rm-clients', act: 'Relationship manager', persona: 'Relationship manager', title: 'Clients: the relationship book',
    async run(R) {
      await R.page.keyboard.press('Escape').catch(() => {});
      await R.click(R.page.locator('button', { hasText: /^Clients/ }).first(), 'Clients: their key relationships, each with a headline — a deposit maturing, churn risk, an overdraft near its limit, a dormant account, KYC due.', { wait: 1500 });
      await R.click(R.page.getByText('Adaeze Balogun').first(), 'A premier client…', { minor: true, wait: 1500 });
      await R.view('…with next best actions worked out from her accounts: a ₦250m term deposit matures in 7 days, so offer the rollover; she holds no investments despite high balances, so schedule a portfolio review. Her products, signals and notes sit beside them.', undefined, { short: 'Each client with next best actions, products, signals and notes.' });
    },
  },
  // ── What the operations analyst can do ─────────────────────────────────────────────
  {
    id: 'ops-overview', act: 'Operations analyst', persona: 'Operations analyst', title: 'The exception workbench',
    async run(R) {
      const ops = R.page.frameLocator('iframe');
      await R.go(A.ops, 'The operations analyst works every application that did not go straight through — from every channel and branch — in one workbench.', { wait: 2500 });
      await R.view('Across the top: straight-through rate against its 80% target, cases past SLA, unassigned work, and the reviewer hours automation gave back this week.', ops.locator('#health'), { short: 'The numbers: straight-through, past SLA, unassigned, hours returned.' });
      await R.view('Above them, the one thing to know first: how many cases are past SLA, and how many share a single cause — here the NIMC gateway timing out. Clear the cause, not the cases.', ops.locator('#triage'), { minor: true });
      await R.view('On the left, every way to slice the work: by view (needs attention, all, mine, unassigned), by pipeline queue — NIN, BVN, liveness, documents, Finacle — and exceptions and bulk failures. Below, the live health of each upstream service: NIMC recovered at 14:31, NIBSS degraded.', ops.getByText('UPSTREAM', { exact: true }).first(), { short: 'Views, pipeline queues, and the live health of NIMC, NIBSS, liveness and Finacle.' });
    },
  },
  {
    id: 'ops-bulk', act: 'Operations analyst', persona: 'Operations analyst', title: 'Bulk failures',
    async run(R) {
      const ops = R.page.frameLocator('iframe');
      await R.click(ops.locator('button.nav[data-view="q-bulk"]'), 'Bulk failures: a payroll file from a corporate portal.', { wait: 1200 });
      await R.click(ops.locator('button.row', { hasText: 'Ashaka Cement' }).first(), 'Ashaka Cement’s 180 rows…', { minor: true, wait: 1500 });
      await R.view('…168 accounts opened; 12 failed, all at the NIN check, all in the same 18 minutes the NIMC gateway was down. The failures can be downloaded, or retried — only the 12, never the 168 already live.', undefined, { stay: true, short: '168 opened, 12 failed during the NIMC outage: retry only the 12.' });
      await R.click(ops.locator('button', { hasText: 'Retry the 12 failed rows' }).first(), 'The failed rows can be downloaded for the client, or retried — the twelve, nothing else.', { stay: true, wait: 1500 });
      await ops.locator('body').press('Escape'); await R.page.waitForTimeout(500);
    },
  },
  {
    id: 'ops-causes', act: 'Operations analyst', persona: 'Operations analyst', title: 'Fix the cause, not the cases',
    async run(R) {
      const ops = R.page.frameLocator('iframe');
      await R.click(ops.locator('button.nav[data-view="attention"]'), '', { minor: true, wait: 1200 });
      await R.scrollTo(ops.locator('button', { hasText: /Retry NIN check on all/ }).first(), 'Needs attention groups the open cases by root cause, each with one action for all of them — retry NIN on every case the outage caught, retry BVN, request a new selfie, resend a chaser — or review them one by one.');
      await R.click(ops.locator('button', { hasText: /Retry NIN check on all/ }).first(), 'NIMC is healthy again, so they are retried together.', { wait: 1500 });
      await R.view('One click instead of opening each case by hand.', undefined, { minor: true });
    },
  },
  {
    id: 'ops-case', act: 'Operations analyst', persona: 'Operations analyst', title: 'Working a case',
    async run(R) {
      const ops = R.page.frameLocator('iframe');
      await R.click(ops.locator('button.nav[data-view="unassigned"]'), 'Work can be picked up from Unassigned…', { wait: 1000 });
      await R.click(ops.locator('button.nav[data-view="mine"]'), '…or from what is already assigned to the analyst.', { minor: true, wait: 1000 });
      await R.click(ops.locator('button.nav[data-view="all"]'), 'All cases…', { wait: 1200 });
      await R.click(ops.locator('[data-sort="risk"]').first(), '…sortable by urgency, risk, age or name — here, highest risk first.', { wait: 800 });
      await R.click(ops.locator('button.row', { hasText: 'Aisha Yusuf' }).filter({ hasText: /name mismatch/i }).first(), 'A name mismatch: Aisha Yusuf.', { wait: 1500 });
      await R.view('The case opens on the problem: the form says Yusuff, NIMC says Yusuf — the difference highlighted, everything else matching. Beside it, the agent trail, every check, the risk score and why, and the applicant.', undefined, { stay: true, short: 'The problem side by side, the trail, the checks and the risk.' });
      await R.click(ops.locator('button', { hasText: 'Accept NIMC name and continue' }).first(), 'Accept the NIMC spelling: it writes back to her application and the case carries on. J/K moves between cases, A accepts, R re-runs, E escalates.', { stay: true, wait: 1500 });
      await ops.locator('body').press('Escape'); await R.page.waitForTimeout(500);
    },
  },
  {
    id: 'ops-pattern', act: 'Operations analyst', persona: 'Operations analyst', title: 'A pattern becomes a rule',
    async run(R) {
      const ops = R.page.frameLocator('iframe');
      await R.click(ops.locator('button.nav[data-view="attention"]'), '', { minor: true, wait: 1200 });
      await R.scrollTo(ops.getByText('Pattern found', { exact: false }).first(), 'That decision has been made before. The console learns from how people decide: Ruth has accepted the NIMC spelling on every one of 47 name mismatches — six weeks, no reversal. A policy nobody has written down.');
      await R.click(ops.locator('button', { hasText: 'Review the 47 decisions' }).first(), 'The evidence…', { wait: 1500 });
      await R.view('…every one of the 47, weakest match first, and where they sit. A rule at 0.91 covers all 47, and the open cases it would settle are listed; its condition is written out in full.', undefined, { stay: true, short: 'All 47 decisions, the threshold and the condition, in full.' });
      const thr = ops.locator('#thr');
      await thr.evaluate((e) => { e.value = '0.94'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      await R.page.waitForTimeout(600);
      await R.view('Move the threshold and the coverage updates — at 0.94 it would cover fewer past decisions, so it would still send some to a person.', ops.locator('#thr'), { stay: true, minor: true });
      await thr.evaluate((e) => { e.value = '0.91'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
      await R.page.waitForTimeout(400);
      await R.click(ops.locator('button', { hasText: /^Promote at/ }).first(), 'Promote at 0.91: about four cases a day stop landing on someone’s desk. A single reversal later pauses it.', { stay: true, wait: 1500 });
    },
  },
  {
    id: 'ops-automation', act: 'Operations analyst', persona: 'Operations analyst', title: 'The automation rules',
    async run(R) {
      const ops = R.page.frameLocator('iframe');
      await R.click(ops.locator('button.nav[data-view="rules"]'), 'Rules: what decides without a person.', { wait: 1200 });
      await R.scrollTo(ops.getByText('Live rules', { exact: false }).first(), 'Each live rule in plain words, its condition, and what it has done: cases deflected, reviewer hours returned, reversals. Any of them can be paused.');
      await R.click(ops.locator('[data-rules-mode="edit"]'), 'Edit…', { wait: 4000 });
      await R.view('…and the same rules are a DMN decision table — the standard format UiPath Maestro’s business-rule tasks run: when the check and condition match, then the automated action. Download it, and the case runs the same decision.', ops.locator('#dmn-host'), { stay: true, short: 'The same rules as a DMN decision table.' });
    },
  },
  {
    id: 'ops-dmn', act: 'Operations analyst', persona: 'Operations analyst', title: 'Document rules — a live DMN',
    async run(R) {
      const ops = R.page.frameLocator('iframe');
      await R.click(ops.locator('[data-rules-set="documents"]'), 'The Document rules…', { wait: 4000 });
      await R.view('…the decision table every document is judged against: the document, the check, the condition, the outcome and the reason, each tied to a BRD rule. The hit policy is Collect — every rule that matches fires, and the strictest outcome wins.', ops.locator('#dmn-host'), { stay: true, short: 'The Document rules as a DMN table: every match fires, strictest wins.' });
      // Change the utility-bill currency window from 90 to 60 days, in the table itself.
      const cell = ops.locator('td', { hasText: /^\s*ageDays > 90\s*$/ }).first();
      await R.click(cell, 'Policy changes: utility bills must now be under 60 days old, not 90.', { stay: true, wait: 300 });
      const fr = R.page.frames().find((x) => x !== R.page.mainFrame());
      await fr.evaluate(() => { const s = window.getSelection(); const r = document.createRange(); r.selectNodeContents(document.activeElement); s.removeAllRanges(); s.addRange(r); });
      await R.page.keyboard.type('ageDays > 60');
      await ops.locator('.dmn-note').click({ position: { x: 4, y: 4 } }).catch(() => {});
      await R.page.waitForTimeout(400);
      await R.view('Edited in the table…', ops.locator('td', { hasText: /ageDays > 60/ }).first(), { stay: true, minor: true });
      await R.click(ops.locator('#dmn-save'), '…and saved. It is live: every document on every application is judged against the new rule from now on — no release, no developer.', { stay: true, wait: 1500 });
      await R.click(ops.locator('[data-rules-mode="view"]'), '', { minor: true, wait: 1500 });
      await R.scrollTo(ops.getByText('utility-bill · age', { exact: false }).first(), 'In View, the rule reads in plain words with its new threshold, marked as edited — and Reset puts the bank’s default back.');
      await ops.locator('[data-docrules-reset]').click().catch(() => {}); // leave the default in place
      await R.page.waitForTimeout(600);
    },
  },
  // ── Behind the scenes ────────────────────────────────────────────────────────────
  {
    id: 'bts-tower', act: 'Behind the scenes', persona: 'Management', title: 'The control tower',
    async run(R) {
      await R.go(A.tower, 'For management, the control tower: one report over every application, live — applications received, straight-through rate, accounts opened, exceptions, against the previous period.', { wait: 3000, short: 'The control tower: the whole factory, live.' });
      for (const [pg, cap] of [['Exceptions & SLA', 'Exceptions and SLA: what is breaching, and why.'], ['Flow', 'Flow: where every application sits, stage by stage.'], ['Channels', 'Channels: branch, digital and bulk payroll, side by side.'], ['Verification', 'Verification: how each check performs — NIN, BVN, liveness, screening.']]) {
        const t = R.page.getByText(pg, { exact: true }).last();
        if (await t.count()) await R.click(t, cap, { wait: 2000, minor: pg !== 'Exceptions & SLA' });
      }
    },
  },
  {
    id: 'bts-cases', act: 'Behind the scenes', persona: 'Operations', title: 'Case management',
    async run(R) {
      await R.go(A.cases, 'Case management: any application’s case drawn as its case plan — each stage, each task, who does it (agent, robot, person, app), and where it is now. It can be run in Maestro from here.', { wait: 3000 });
    },
  },
  {
    id: 'bts-relay', act: 'Behind the scenes', persona: 'Architecture', title: 'How it fits together',
    async run(R) {
      await R.go(`${C.apps.launcher}#relay-individual`, 'And the architecture: one application, stage by stage, and which part of the platform does each step — UiPath Maestro, agents, robots and IXP, the bank’s own systems, and third parties.', { wait: 3000, short: 'The architecture, stage by stage.' });
      const walk = R.page.locator('button', { hasText: 'Walk the case' }).first();
      if (await walk.count()) {
        await R.click(walk, 'Walk the case: it steps through each stage…', { wait: 3500 });
        await R.view('…lighting up who acts at every step, and what each part is doing.', undefined, { minor: true });
      }
      for (const [k, cap] of [['Corporate', 'The same for a corporate account…'], ['Bulk', '…and for a bulk batch.']]) {
        const a = R.page.locator('a', { hasText: new RegExp(`^${k}$`) }).first();
        if (await a.count()) await R.click(a, cap, { minor: true, wait: 2500 });
      }
    },
  },
];

// Short labels for the player's header, one or two words, by scene (the part after the flow's
// prefix: indf-kyc → kyc). The full title is the tooltip and the caption panel's heading.
const TAGS = {
  launch: 'Overview', apply: 'Form', submit: 'Submit', kyc: 'KYC', intake: 'Intake', voice: 'Voice agent',
  checks: 'Checks', decide: 'Decision', account: 'Core banking', maestro: 'Maestro', case: 'Case', open: 'Account',
  package: 'Package', 'bulk-intake': 'Intake', maker: 'Maker', verify: 'Verifier', manifest: 'Manifest',
  'cust-apply': 'Apply', 'cust-kyc': 'KYC link', desk: 'My desk', approvals: 'Approvals', clients: 'Clients',
  overview: 'Workbench', 'ops-bulk': 'Bulk failures', causes: 'Root causes', 'ops-case': 'A case', pattern: 'Pattern',
  automation: 'Automation', dmn: 'Document rules', tower: 'Control tower', cases: 'Case plans', relay: 'Architecture',
};
const tagOf = (id) => TAGS[id] ?? TAGS[id.split('-').slice(1).join('-')];
for (const sc of SCENES) sc.tag = sc.tag ?? tagOf(sc.id);

module.exports = { SCENES, tagOf };
