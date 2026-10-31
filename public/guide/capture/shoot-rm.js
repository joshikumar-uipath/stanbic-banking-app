async (page) => {
  // Screenshots for guide/rm.html (stanbic) — generated from _prelude.js + _rm.body.js by _assemble.sh.
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
  const EW = APP + '#employee-web';
  const rail = async (name) => { await page.locator('nav, aside').getByRole('button', { name: new RegExp('^' + name) }).first().click({ timeout: 10000 }).catch(async () => { await page.getByText(name, { exact: true }).first().click(); }); await page.waitForTimeout(1500); };
  const openCase = async (q, name) => { await rail('Open an account'); await page.getByPlaceholder(/Search name or reference/).fill(q); await page.waitForTimeout(800); await page.getByText(name, { exact: true }).first().click(); await page.waitForTimeout(5000); };
  // My desk
  await step('r-desk', async () => { await go(EW, 6000); await snap('r-desk'); });
  await step('r-desk-lanes', async () => { await toTop('Needs you now', 160); await snap('r-desk-lanes'); });
  // Directory
  await step('r-opening', async () => { await rail('Open an account'); await snap('r-opening'); });
  // Case detail on a live exception
  await step('r-case', async () => { await openCase('Blessing', 'Blessing Eze'); await snap('r-case'); });
  await step('r-case-live', async () => { await toTop('Live in Maestro', 120); await snap('r-case-live'); });
  await step('r-case-messages', async () => { await page.getByRole('tab', { name: 'Messages' }).or(page.getByRole('button', { name: 'Messages', exact: true })).first().click(); await page.waitForTimeout(900); await toTop('Messages', 60); await snap('r-case-messages'); });
  await step('r-case-activity', async () => { await page.getByRole('tab', { name: 'Activity' }).or(page.getByRole('button', { name: 'Activity', exact: true })).first().click(); await page.waitForTimeout(900); await snap('r-case-activity'); });
  await step('r-details', async () => { await page.getByRole('button', { name: 'Details', exact: true }).first().click(); await page.waitForTimeout(1500); await snap('r-details'); });
  await step('r-details-doc', async () => { await page.getByText('Document', { exact: true }).last().click(); await page.waitForTimeout(1500); await snap('r-details-doc'); });
  await step('r-details-web', async () => { await page.getByText('Web research', { exact: true }).last().click(); await page.waitForTimeout(6000); await snap('r-details-web'); await page.keyboard.press('Escape'); await page.waitForTimeout(600); });
  await step('r-voice', async () => { await go(EW, 4000); await openCase('Blessing', 'Blessing Eze'); await page.getByRole('button', { name: /Listen in|Open call history/ }).first().click(); await page.waitForTimeout(6000); await snap('r-voice'); await page.keyboard.press('Escape'); });
  // KYC link resend and account number on an activation-stage case
  await step('r-case-activation', async () => { await go(EW, 4000); await openCase('Aisha', 'Aisha Effiong'); await snap('r-case-activation'); });
  await step('r-case-104', async () => { await go(EW, 4000); await openCase('Tunde Abubakar', 'Tunde Abubakar'); await snap('r-case-105'); });
  await step('r-kyc-link', async () => { await page.getByRole('button', { name: /KYC link/ }).first().click(); await page.waitForTimeout(1000); await snap('r-kyc-link'); await btn('Cancel').catch(() => {}); });
  // Assisted capture
  await step('r-capture', async () => { await go(EW, 4000); await rail('Open an account'); await btn('New application', { ms: 1500 }); await snap('r-capture'); });
  await step('r-corp-1', async () => { await page.locator('.cx').getByText('Corporate', { exact: true }).first().click(); await page.waitForTimeout(1200); await snap('r-corp-1'); });
  await step('r-corp-2', async () => { await page.locator('.cx input:visible').first().fill('Adeyemi Ventures Ltd'); await btn('Continue', { exact: true, ms: 1200 }); await snap('r-corp-2'); });
  await step('r-corp-3', async () => { await btn('Continue', { exact: true, ms: 1200 }); await snap('r-corp-3'); await page.keyboard.press('Escape'); });
  // Approvals
  await step('r-approvals', async () => { await go(EW, 4000); await rail('Approvals'); await snap('r-approvals'); });
  await step('r-approval-open', async () => { await page.locator('main').getByRole('button').filter({ hasText: /₦|NGN/ }).first().click().catch(async () => { await page.getByText('Meridian Trading').first().click(); }); await page.waitForTimeout(1200); await snap('r-approval-open'); });
  await step('r-approval-reason', async () => { await page.getByRole('button', { name: /^Approve/ }).first().click(); await page.waitForTimeout(900); await snap('r-approval-reason'); });
  // Clients
  await step('r-clients', async () => { await rail('Clients'); await snap('r-clients'); });
  await step('r-client-360', async () => { await page.getByText('Adaeze Balogun', { exact: true }).first().click(); await page.waitForTimeout(1500); await snap('r-client-360'); });
  // Assistant section of the rail
  await step('r-chat', async () => { await rail('Chat'); await page.waitForTimeout(3000); await snap('r-chat'); });
  await step('r-explore', async () => { await rail('Explore agents'); await page.waitForTimeout(3000); await snap('r-explore'); });
  await step('r-alerts', async () => { await rail('Alerts'); await page.waitForTimeout(2000); await snap('r-alerts'); });
  await step('r-profile', async () => { await rail('Profile'); await page.waitForTimeout(2000); await snap('r-profile'); });
  // Mobile shell
  await step('r-mobile', async () => { await go(APP + '#employee-mobile', 6000); await snap('r-mobile'); });
  return log.join('\n') + `\nwrites swallowed: ${(ctx._writes || []).length}`;
}
