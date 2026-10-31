// Capture settings for the FirstBank account opening POC. lib.cjs, overlay.cjs and
// run.cjs read this. One app serves every surface; screens differ by #route.
const APP = 'http://localhost:5180/';
const path = require('path');
// Which bank the walkthrough is captured as: BRAND=stanbic node run.cjs (default firstbank).
const BRAND = process.env.BRAND === 'stanbic' ? 'stanbic' : 'firstbank';
const ROOT = path.join(__dirname, '..', '..', '..');
// Corporate · fill in: a generated demo business (EVB-004 in src/fixtures/identities.ts;
// its documents are fixtures/documents/emeka-nwosu/), typed on the desk. Shared by both brands.
const CORPORATE_TYPED = {
  company: 'Nwosu Logistics Enterprises', what: 'a haulage and freight business in Port Harcourt',
  directors: 'Its owner and only signatory, Emeka Nwosu.',
  typed: {
    company: 'Nwosu Logistics Enterprises', rc: 'BN 2481907', tin: '20481907-0001',
    bizType: 'Sole Proprietor', sector: 'Haulage and freight forwarding', turnover: 'Less than ₦400m',
    address: '219 Aba Rd, Port Harcourt', email: 'accounts@nwosulogistics.example', phone: '08030000104',
    directors: [{ name: 'Emeka Nwosu', bvn: '22210000104', idNumber: '10120000104', phone: '08030000104', email: 'emeka.nwosu@nwosulogistics.example', role: 'Director' }],
  },
};
const BRANDS = {
  firstbank: {
    themeFile: path.join(__dirname, '../../guide/capture/firstbank-theme.json'),
    themeName: 'FirstBank',
    displayHost: 'open.firstbanknigeria.com',
    out: path.join(__dirname, '..'),                 // frames/ + walkthrough.json
    story: {
      bank: 'FirstBank', app: 'the FirstBank app', branch: 'Alapere',
      // Individual: the customer's completed paper form, uploaded and read.
      individual: { form: path.join(ROOT, 'fixtures-firstbank', 'redacted', 'AOF Individual (redacted).pdf'), formName: 'AOF Individual (redacted).pdf' },
      corporate: {
        form: path.join(ROOT, 'fixtures-firstbank', 'redacted', 'AOF Corporate (redacted).pdf'), formName: 'AOF Corporate (redacted).pdf', pages: 13,
        company: 'ABA Integrated Solutions Ltd', what: 'an IT company in Abuja', match: 'ABA INTEGRATED',
        directors: 'Its director and signatory, Adelaja Babajide Adetayo.',
      },
      corporateTyped: CORPORATE_TYPED,
      bulk: path.join(ROOT, 'fixtures-firstbank', 'bulk', 'document-package.zip'),
    },
  },
  stanbic: {
    themeFile: path.join(__dirname, '../../guide/capture/stanbic-theme.json'),
    themeName: 'Stanbic IBTC',
    displayHost: 'open.stanbicibtcbank.com',
    out: path.join(__dirname, '..', 'stanbic'),      // stanbic/frames/ + stanbic/walkthrough.json
    story: {
      bank: 'Stanbic IBTC', app: 'the Stanbic IBTC app', branch: 'Alausa',
      // Individual · upload is captured only once a Stanbic individual form is set here:
      // { form, formName, who: { first, full, he, him, his, theirs } } (who defaults to Olumuyiwa).
      // Until then the Stanbic walkthrough has Individual · fill in only.
      individual: { form: null },
      corporate: {
        form: path.join(ROOT, 'fixtures', 'redacted', 'Stanbic entity AOF - George Emore (redacted).pdf'), formName: 'Stanbic entity AOF (redacted).pdf', pages: 12,
        company: 'George Emore Technical Enterprises Ltd', what: 'an IT consultancy in Lagos', match: 'GEORGE EMORE',
        directors: 'Its two directors and signatories, Efe George Emore and Kehinde Omotayo Akerele.',
      },
      corporateTyped: CORPORATE_TYPED,
      bulk: path.join(ROOT, 'fixtures', 'bulk', 'document-package.zip'),
    },
  },
};
const B = BRANDS[BRAND];
module.exports = {
  brand: BRAND,
  out: B.out,
  story: B.story,
  apps: {
    launcher: APP,
    desk: `${APP}#employee-web`,
    customer: `${APP}#customer-web`,
    ops: `${APP}#ops`,
    finacle: `${APP}#finacle`,
    kafka: `${APP}#kafka`,
    comms: `${APP}#comms`,
    tower: `${APP}#tower`,
    cases: `${APP}#cases`,
    kyc: `${APP}#kyc/`,
    faceid: `${APP}#faceid`,
    // A live OnboardingCase instance in UiPath Maestro (staging, read-only; needs the
    // capture profile signed in to staging once — see HANDOVER).
    maestro: 'https://staging.uipath.com/mea/DefaultTenant/maestro_/cases/381f59ef-2dd1-4c00-8395-4b3d055fe430/instances/48b2e1b3-4f6d-423b-b5e6-92bdfa75cafd',
  },
  // The desk loads the seeded demo records on first open.
  warmUpUrl: `${APP}#employee-web`,

  // --- Write guard (overlay.cjs) -------------------------------------------------------
  // This project's guard answers every non-read on EVERY host and simulates Maestro
  // (see overlay.cjs); the kit's entity-table settings are not used.
  org: 'mea',
  tenant: 'DefaultTenant',
  // The bank the screens are dressed as: the admin profile the apps read, seeded before
  // the first page loads. Same file the feature guide's FirstBank capture uses.
  themeFile: B.themeFile,
  themeName: B.themeName,
  // Seeded into the per-browser application-id counter before the first load. In
  // practice the app's own seeding resets it, so from a clean browser (run.cjs clears
  // storage first) the story's records are AO-2026-000147 (Olumuyiwa), 000148 (ABA
  // Integrated) and the batch after them.
  appSeq: 700,

  // --- Screens (lib.cjs) ---------------------------------------------------------------
  // Hidden in every screenshot: the dev "← Launcher" pill.
  hide: 'button[title="Back to the launcher"], a[title="Back to the launcher"]',
  loadingText: /Loading…|Connecting to UiPath|Checking the live case…|Opening .*…$/m,
  toastClose: null,
  displayHost: B.displayHost,
  roleStorageKey: '',

  // --- Automated steps between frames ------------------------------------------------------
  // Maestro's stage progress is simulated by the overlay (approvals, ov.park). The
  // record's automated outcomes — validations, the Finacle account, activation — run
  // through the app's dev-only hook (src/demo/walkthroughEngine.ts).
  engine: { url: `${APP}#employee-web`, global: '__aofEngine' },

  // --- Face checks ------------------------------------------------------------------------
  // KYC liveness is the external FaceID app; the capture shows its screen and posts
  // FaceID's own completion message instead (see scenes.cjs).
  face: { consent: '', modal: '', start: '', fallback: '', done: /^$/, open: /^$/, live: /^$/ },
};
