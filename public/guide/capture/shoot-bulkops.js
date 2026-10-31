async (page) => {
  // Screenshots for guide/bulkops.html (stanbic) — generated from _prelude.js + _bulkops.body.js by _assemble.sh.
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
  // Batches — the RM's intake, then the maker and verifier. Run after shoot-rm.js.
  // "Process N applications" starts Maestro cases for the first 8 rows; route.js answers
  // StartJobs with no instance, so every row runs on the local engine and nothing is started.
  const EW = APP + '#employee-web';
  const persona = async (name) => { await page.getByRole('button', { name: new RegExp('^' + name) }).last().click({ timeout: 10000 }); await page.waitForTimeout(1500); };
  const tab = async (name) => { await page.getByRole('tab', { name: new RegExp('^' + name) }).first().click({ timeout: 10000 }); await page.waitForTimeout(1500); };
  await step('r-batch-new', async () => { await go(EW, 1000); await page.evaluate(() => localStorage.removeItem('aof_bulk_batches')); await go(EW, 5000); await page.getByText('Batches', { exact: true }).first().click(); await page.waitForTimeout(2000); await snap('r-batch-new'); });
  await step('r-batch-bundle', async () => { await tap('AOP bundle'); await btn('Load a sample bundle', { ms: 2000 }); await toTop('Batch name', 120); await snap('r-batch-bundle'); });
  await step('r-batch-doc', async () => { await page.getByText('View', { exact: true }).first().click(); await page.waitForTimeout(2000); await snap('r-batch-doc'); await page.keyboard.press('Escape'); await page.waitForTimeout(500); await btn('Close').catch(() => {}); });
  await step('r-batch-intake', async () => { await page.getByRole('button', { name: /^Validate/ }).first().click(); await page.waitForTimeout(2500); await snap('r-batch-intake'); });
  await step('r-batch-rejections', async () => { await toTop('Rejected at intake', 120); await snap('r-batch-rejections'); });
  await step('r-batch-monitor', async () => { await page.getByRole('button', { name: /^Process/ }).first().click(); await page.waitForTimeout(6000); await snap('r-batch-monitor'); });
  await step('r-batch-monitor-done', async () => { await page.waitForTimeout(25000); await page.evaluate(() => window.scrollTo(0, 0)); await snap('r-batch-monitor-done'); });
  await step('r-batch-sheet', async () => { await page.getByRole('button', { name: 'Ngozi Balogun', exact: true }).first().click(); await page.waitForTimeout(3000); await snap('r-batch-sheet'); });
  await step('r-batch-sheet-docs', async () => { await page.getByText('Documents', { exact: true }).first().click(); await page.waitForTimeout(1500); await snap('r-batch-sheet-docs'); });
  await step('r-batch-sheet-extract', async () => { await page.getByText('Extraction', { exact: true }).first().click(); await page.waitForTimeout(1500); await snap('r-batch-sheet-extract'); await btn('Close', { exact: true }); await page.waitForTimeout(800); });
  // Maker
  await step('b-persona', async () => { await persona('Maker'); await snap('b-persona'); });
  await step('b-queue', async () => { await snap('b-queue'); });
  await step('b-review', async () => { await page.getByRole('button', { name: /^Review/ }).filter({ hasNotText: 'queue' }).nth(0).click(); await page.waitForTimeout(2500); await snap('b-review'); });
  await step('b-review-recon', async () => { await toTop('Reconciliation', 120); await snap('b-review-recon'); });
  await step('b-review-verif', async () => { await toTop('Verification outcomes', 120); await snap('b-review-verif'); });
  await step('b-flag', async () => { await btn('Flag as exception', { ms: 1200 }); await snap('b-flag'); await btn('Cancel'); });
  await step('b-approve', async () => { for (let k = 0; k < 6; k++) { const b = page.getByRole('button', { name: /^Approve/ }).first(); if (!(await b.count())) break; await b.click(); await page.waitForTimeout(2500); } await snap('b-approve'); });
  // Verifier
  await step('b-authorise', async () => { await persona('Verifier'); await snap('b-authorise'); });
  await step('b-created', async () => { await page.getByRole('button', { name: /^Create \d+ account/ }).first().click(); await page.waitForTimeout(3500); await snap('b-created'); });
  // Exceptions (RM)
  await step('b-exception', async () => { await persona('Relationship Manager'); await tab('Batch'); await btn('Parked →', { ms: 2000 }); await snap('b-exception'); });
  await step('b-exception-dispose', async () => { await toTop('Reason code', 200); await snap('b-exception-dispose'); });
  await step('r-batch-complete', async () => { await tab('Batch'); await page.evaluate(() => window.scrollTo(0, 0)); await snap('r-batch-complete'); });
  // Manifest batch → invitations
  await step('r-manifest', async () => { await tab('New submission'); await tap('Excel manifest'); await btn('Load a sample manifest', { ms: 1500 }); await toTop('Batch name', 120); await snap('r-manifest'); });
  await step('r-manifest-intake', async () => { await page.getByRole('button', { name: /^Validate/ }).first().click(); await page.waitForTimeout(2500); await snap('r-manifest-intake'); });
  await step('r-invites', async () => { await page.getByRole('button', { name: /^Process/ }).first().click(); await page.waitForTimeout(20000); await tab('Invitations'); await snap('r-invites'); });
  return log.join('\n') + `\nwrites swallowed: ${(ctx._writes || []).length}`;
}
