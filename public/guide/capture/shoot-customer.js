async (page) => {
  // Screenshots for guide/customer.html (stanbic) — generated from _prelude.js + _customer.body.js by _assemble.sh.
  const BANK = 'stanbic', BANK_NAME = 'Stanbic IBTC';
  const OUT = '/Users/joshikumar/Documents/coded-demo/first app/Stanbic Banking App/public/guide/capture/png';
  const FIX = 'fixtures';
  const THEME = null;
  // --- shared prelude (from shoot-template.js) -------------------------------------
  // BANK, BANK_NAME, OUT, FIX and THEME come from the per-bank header _assemble.sh writes above this line.
  const APP = 'http://localhost:5180/';
  const LOADING = /Loading…|Connecting to UiPath|Checking the live case…/;
  await page.setViewportSize({ width: 1440, height: 900 });
  // Put the bank's theme on before anything is shot — the same saved admin profile the apps (and the guide) read.
  // Stanbic is the built-in preset; any other bank is seeded from capture/<bank>-theme.json.
  if (!page.url().startsWith(APP)) await page.goto(APP);
  await page.evaluate(([theme, name]) => {
    const K = 'zara_local_profiles_v1';
    let s; try { s = JSON.parse(localStorage.getItem(K) || 'null'); } catch { s = null; }
    if (!s || !Array.isArray(s.profiles)) s = { activeId: null, profiles: [] };
    if (!theme) { s.activeId = '__preset_stanbic__'; }
    else {
      s.profiles = s.profiles.filter((p) => p.id !== 'guide-capture');
      s.profiles.push({ id: 'guide-capture', name, config: theme, updatedAt: new Date().toISOString() });
      s.activeId = 'guide-capture';
    }
    localStorage.setItem(K, JSON.stringify(s));
  }, [THEME, BANK_NAME]);
  const ctx = page.context();
  const log = [];
  let n = 0;
  const settle = async (ms = 900) => {
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
    try { await page.waitForFunction((re) => !new RegExp(re).test(document.body.innerText), LOADING.source, { timeout: 15000 }); } catch {}
    await page.waitForTimeout(ms);
  };
  const go = async (url, ms = 1500) => {
    n++;
    const [base, hash] = url.split('#');
    await page.goto(`${base}${base.includes('?') ? '&' : '?'}g=${Date.now().toString(36)}${n}#${hash ?? ''}`);
    await settle(ms);
  };
  const toTop = async (text, offset = 90) => {
    const el = page.getByText(text, { exact: false }).first();
    await el.waitFor({ timeout: 15000 });
    await el.evaluate((e, off) => { e.scrollIntoView({ block: 'start' }); let p = e.parentElement; while (p) { if (p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) { p.scrollTop -= off; break; } p = p.parentElement; } }, offset);
    await page.waitForTimeout(400);
  };
  const tap = async (text, o = {}) => { await page.getByText(text, { exact: !!o.exact }).first().click({ timeout: 10000 }); await page.waitForTimeout(o.ms ?? 900); };
  const btn = async (name, o = {}) => { await page.getByRole(o.role || 'button', { name, exact: !!o.exact }).first().click({ timeout: 10000 }); await page.waitForTimeout(o.ms ?? 900); };
  const snap = async (id, opts = {}) => { await page.screenshot({ path: `${OUT}/${id}.png`, fullPage: !!opts.full }); log.push(id); };
  const step = async (id, fn) => { try { await fn(); } catch (e) { log.push(`FAIL ${id}: ${String(e.message || e).split('\n')[0].slice(0, 160)}`); } };
  // --------------------------------------------------------------------------------
  const CW = APP + '#customer-web';
  // Tour
  await step('c-home', async () => { await go(CW, 2500); await snap('c-home'); });
  await step('c-pay', async () => { await btn('Pay & transfer'); await snap('c-pay'); });
  await step('c-transfer', async () => { await tap('Send Money'); await snap('c-transfer'); });
  await step('c-transfer-review', async () => {
    const inputs = await page.locator('input:visible').all();
    for (const i of inputs) { const ph = (await i.getAttribute('placeholder')) || ''; if (/07/.test(ph)) await i.fill('08031234567'); else if (/0\.00|0$/.test(ph)) await i.fill('25000'); else if (/for\?/.test(ph)) await i.fill('Rent contribution'); }
    await btn('Continue'); await snap('c-transfer-review');
  });
  await step('c-transfer-done', async () => { await btn(/Confirm/); await page.waitForTimeout(1500); await snap('c-transfer-done'); });
  await step('c-wealth', async () => { await go(CW, 2000); await btn('Wealth'); await snap('c-wealth'); });
  await step('c-more', async () => { await btn('More'); await snap('c-more'); });
  await step('c-notifications', async () => { await page.getByRole('button', { name: /Notifications/ }).first().click(); await page.waitForTimeout(900); await snap('c-notifications'); });
  await step('c-assistant', async () => { await go(CW, 2000); await page.getByRole('button', { name: /Digibot|Assistant/ }).first().click(); await page.waitForTimeout(1200); await snap('c-assistant'); });
  await step('c-assistant-answer', async () => { await tap('Check my balance', { ms: 2500 }); await snap('c-assistant-answer'); });
  // Apply
  await step('c-open', async () => { await go(CW, 2000); await btn('Open an account'); await snap('c-open'); });
  await step('c-wiz-1', async () => { await page.getByRole('button', { name: 'Open an account' }).last().click(); await page.waitForTimeout(1500); await snap('c-wiz-1'); });
  for (const [i, id] of [[2, 'c-wiz-2'], [3, 'c-wiz-3'], [4, 'c-wiz-4'], [5, 'c-wiz-5'], [6, 'c-wiz-6']]) {
    await step(id, async () => { await btn('Continue', { exact: true, ms: 1200 }); await page.evaluate(() => window.scrollTo(0, 0)); await snap(id); });
  }
  await step('c-wiz-6-bottom', async () => { await toTop('Next of kin', 200); await snap('c-wiz-6-bottom'); });
  // New ids come from a per-browser counter; park it past the ids other sessions already
  // linked to live cases in AOFMaestroLink, or the new record reads someone else's case.
  await page.evaluate(() => localStorage.setItem('aof_app_seq', '900'));
  await step('c-received', async () => { await btn('Submit application', { ms: 2500 }); await snap('c-received'); });
  await step('c-status', async () => { await page.getByRole('button', { name: /Track/ }).first().click(); await page.waitForTimeout(11000); await page.evaluate(() => window.scrollTo(0, 0)); await snap('c-status'); });
  await step('c-status-checks', async () => { await toTop('Checks', 120); await snap('c-status-checks'); });
  await step('c-inprogress', async () => { await go(CW, 2000); await btn('Open an account'); await toTop('Applications in progress', 200); await snap('c-inprogress'); });
  // Upload a completed form — route.js fakes the upload and the case start (ctx._fakeCase),
  // so the review opens in its own labelled "sample read" state. Nothing reaches the tenant.
  await step('c-upload', async () => { await go(CW, 2000); await btn('Open an account'); await page.getByRole('button', { name: 'Open an account' }).last().click(); await page.waitForTimeout(1200); await snap('c-upload'); });
  await step('c-review-reading', async () => {
    ctx._fakeCase = true;
    await page.locator('input[type=file]').first().setInputFiles('/Users/joshikumar/Documents/coded-demo/first app/Stanbic Banking App/' + FIX + '/documents/adaeze-okafor/account-opening-form.pdf');
    await page.waitForTimeout(2500); await snap('c-review-reading');
  });
  await step('c-review', async () => { await page.waitForTimeout(195000); await snap('c-review'); ctx._fakeCase = false; });
  await step('c-review-fields', async () => { await toTop('fields need checking', 120).catch(() => {}); await snap('c-review-fields'); });
  // KYC link
  const KYC = APP + '#kyc/DEMO01';
  await step('c-kyc-intro', async () => { await go(KYC, 2500); await snap('c-kyc-intro'); });
  await step('c-kyc-docs', async () => { await btn('Get started'); await snap('c-kyc-docs'); });
  await step('c-kyc-docs-done', async () => { await tap('Means of identification'); await tap('Proof of address'); await snap('c-kyc-docs-done'); });
  await step('c-kyc-selfie', async () => { await btn('Continue'); await page.waitForTimeout(6000); await snap('c-kyc-selfie'); });
  await step('c-kyc-sign', async () => { await page.getByRole('button', { name: /finished the check|Continue/ }).first().click(); await page.waitForTimeout(1200);
    const c = page.locator('canvas').first(); const b = await c.boundingBox();
    if (b) { await page.mouse.move(b.x + 40, b.y + b.height * .6); await page.mouse.down(); for (let k = 0; k < 30; k++) await page.mouse.move(b.x + 40 + k * 9, b.y + b.height * (.6 + .15 * Math.sin(k / 2.5))); await page.mouse.up(); }
    await snap('c-kyc-sign'); });
  await step('c-kyc-done', async () => { await btn('Finish', { ms: 1500 }); await snap('c-kyc-done'); });
  // Phone
  await step('c-mobile', async () => { await go(APP + '#customer-mobile', 2500); await snap('c-mobile'); });
  await step('c-mobile-open', async () => { await page.getByRole('button', { name: 'Open an account' }).first().click(); await page.waitForTimeout(1200); await snap('c-mobile-open'); });
  return log.join('\n') + `\nwrites swallowed: ${(ctx._writes || []).length}`;
}
