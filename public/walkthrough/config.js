// Walkthrough player settings. Two brands, one player: ?brand=stanbic plays the Stanbic IBTC
// capture (stanbic/), anything else the FirstBank one (frames/ + walkthrough.json).
(function () {
  const shared = {
    description: 'Individual and corporate account opening — each from an uploaded form or a form filled in at the desk — plus bulk, clicked through the real apps from start to finish.',
    shortTitle: 'Walkthrough',     // the header, beside the logo (the full title is the tab's)
    launcherHref: '../',               // the launcher (the app root)
    // Frames from other hosts, named by a part of their URL.
    hosts: { '/maestro_/': 'UiPath Maestro', 'recorded:': 'Recorded demo' },
  };
  const routes = (app) => ({
    'employee-web': 'Employee desk', 'customer-web': app, kyc: 'KYC link', ops: 'Operations workbench',
    finacle: 'Finacle', kafka: 'Event stream', comms: 'Notifications', tower: 'Control tower', cases: 'Case management',
  });
  const BRANDS = {
    firstbank: {
      title: 'FirstBank walkthrough',
      brandIcon: 'logo.svg',
      apps: { 5180: 'FirstBank account opening' },
      routes: routes('FirstBank app'),
      displayHost: 'open.firstbanknigeria.com',
      storagePrefix: 'wt-aof',
      data: './walkthrough.json', frames: 'frames/',
      // FirstBank: blue #003B65, gold #F0BD2D (the admin theme).
      colours: { brand: '#003B65', brandRgb: '0, 59, 101', accent: '#F0BD2D', accentRgb: '240, 189, 45', navy: '#002a48' },
    },
    stanbic: {
      title: 'Stanbic IBTC walkthrough',
      brandIcon: 'stanbic/logo.png',
      apps: { 5180: 'Stanbic IBTC account opening' },
      routes: routes('Stanbic IBTC app'),
      displayHost: 'open.stanbicibtcbank.com',
      storagePrefix: 'wt-aof-stanbic',
      data: './stanbic/walkthrough.json', frames: 'stanbic/frames/',
      // Stanbic IBTC: blue #0033A1, sky #0091DA, deep #012169 (the admin theme).
      colours: { brand: '#0033A1', brandRgb: '0, 51, 161', accent: '#0091DA', accentRgb: '0, 145, 218', navy: '#012169' },
    },
  };
  const key = new URLSearchParams(location.search).get('brand') === 'stanbic' ? 'stanbic' : 'firstbank';
  const b = BRANDS[key];
  const r = document.documentElement.style;
  r.setProperty('--brand', b.colours.brand); r.setProperty('--brand-rgb', b.colours.brandRgb);
  r.setProperty('--accent', b.colours.accent); r.setProperty('--accent-rgb', b.colours.accentRgb);
  r.setProperty('--navy', b.colours.navy);
  window.WT_CONFIG = Object.assign({ brand: key }, shared, b);
})();
