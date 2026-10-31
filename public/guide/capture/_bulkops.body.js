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
