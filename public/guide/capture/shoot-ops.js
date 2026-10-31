async (page) => {
  // Screenshots for guide/ops.html (stanbic) — generated from _prelude.js + _ops.body.js by _assemble.sh.
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
  // Operations Workbench — public/ops-console.html inside an iframe. Actions on seeded cases are local.
  // Never press "Run in Maestro" or "Approve … & advance" in the case view: they are real.
  await go(APP, 800);
  await page.evaluate(() => ['aof_cases', 'aof_events', 'aof_seed_v', 'aof_seed_at', 'aof_my_apps', 'aof_bulk_batches'].forEach((k) => localStorage.removeItem(k)));
  const F = () => page.frameLocator('iframe').first();
  const fbtn = async (name, o = {}) => { await F().getByText(name, { exact: !!o.exact }).first().click({ timeout: 10000 }); await page.waitForTimeout(o.ms ?? 1200); };
  const fTop = async (text, off = 80) => { await F().getByText(text).first().evaluate((e, o) => { e.scrollIntoView({ block: 'start' }); let p = e.parentElement; while (p) { if (p.scrollHeight > p.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) { p.scrollTop -= o; break; } p = p.parentElement; } }, off); await page.waitForTimeout(500); };
  await step('o-attention', async () => { await go(APP + '#ops', 6000); await snap('o-attention'); });
  await step('o-causes', async () => { await fTop('ROOT CAUSES', 20); await snap('o-causes'); });
  await step('o-list', async () => { await fTop('Individual cases', 20); await snap('o-list'); });
  await step('o-case-mismatch', async () => { await fbtn('Aisha Yusuf'); await snap('o-case-mismatch'); });
  await step('o-case-liveness', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(600); await fbtn('Blessing Okoro'); await snap('o-case-liveness'); });
  await step('o-case-live', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(600); await fbtn('Blessing Eze'); await page.waitForTimeout(5000); await snap('o-case-live'); });
  await step('o-resolve', async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(600); await fbtn('Aisha Yusuf'); await fbtn('Accept NIMC name and continue', { ms: 1500 }); await snap('o-resolve'); });
  await step('o-bulk-retry', async () => { await page.keyboard.press('Escape'); await fbtn('Needs attention', { ms: 1500 }); await F().getByText(/^Retry NIN check on all/).first().click(); await page.waitForTimeout(1500); await snap('o-bulk-retry'); });
  await step('o-queue', async () => { await fbtn('Liveness', { exact: true, ms: 1500 }); await snap('o-queue'); });
  await step('o-bulk', async () => { await fbtn('Bulk failures', { ms: 1500 }); await fbtn('Ashaka Cement payroll', { ms: 1500 }); await snap('o-bulk'); await page.keyboard.press('Escape'); });
  await step('o-rules', async () => { for (let k = 0; k < 3; k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await F().locator('text=/^Rules/').first().click({ timeout: 10000 }); await page.waitForTimeout(1500); await snap('o-rules'); });
  await step('o-evidence', async () => { await fbtn('Review the 47 decisions', { ms: 1800 }); await snap('o-evidence'); });
  await step('o-promote', async () => { await F().getByText(/^Promote at/).first().click(); await page.waitForTimeout(1500); await snap('o-promote'); });
  await step('o-dmn', async () => { await fbtn('Edit', { exact: true, ms: 5000 }); await snap('o-dmn'); });
  return log.join('\n') + `\nwrites swallowed: ${(ctx._writes || []).length}`;
}
