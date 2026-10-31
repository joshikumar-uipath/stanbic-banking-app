  // Control tower — the local store plus a synthetic 60-day history. Never press "Simulate an application":
  // it creates a record that is mirrored to Data Fabric (route.js would swallow it, but it changes the numbers).
  const T = APP + '#tower';
  const page_ = async (name) => { await page.getByText(name, { exact: true }).last().click({ timeout: 10000 }); await page.waitForTimeout(2500); };
  await step('m-overview', async () => { await go(T, 6000); await snap('m-overview'); });
  await step('m-exceptions', async () => { await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim().startsWith('Exceptions & SLA')).pop().click()); await page.waitForTimeout(2500); await snap('m-exceptions'); });
  await step('m-flow', async () => { await page_('Flow'); await snap('m-flow'); });
  await step('m-channels', async () => { await page_('Channels'); await snap('m-channels'); });
  await step('m-verification', async () => { await page_('Verification'); await snap('m-verification'); });
  await step('m-timing', async () => { await page_('Timing'); await snap('m-timing'); });
  await step('m-filters', async () => { await page_('Overview'); await page.getByRole('button', { name: /^Filters/ }).first().click(); await page.waitForTimeout(1500); await snap('m-filters'); });
  await step('m-filtered', async () => { await page.getByText('Bulk payroll', { exact: true }).first().click(); await page.waitForTimeout(2000); await snap('m-filtered'); });
  await step('m-range', async () => { await page.getByRole('button', { name: '7 days', exact: true }).first().click(); await page.waitForTimeout(2000); await snap('m-range'); });
