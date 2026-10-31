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
