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
