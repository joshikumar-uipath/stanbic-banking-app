async (page) => {
  // Test-browser safety net for the guide screenshots. Run this FIRST, before the first page
  // load, in the same Playwright context the shoot scripts use (browser_run_code_unsafe).
  //
  // This app writes to the tenant in more places than a button: opening ANY route inserts
  // missing rows into Data Fabric AOFMaestroLink (onboarding/maestro.ts seedFabric), every
  // non-seeded record is mirrored to AOFCase, and Submit / upload / Approve / Run in Maestro
  // call Orchestrator StartJobs, Attachments, AssignTasks and CompleteAppTask. Dev traffic goes
  // through the Vite proxy (localhost:5180/mea/DefaultTenant/…); builds call staging directly;
  // the kiosk calls AWS; the corporate path calls IXP (du_).
  //
  // So the rule is by method, on every host:
  //  - GET / HEAD / OPTIONS pass through (reads: Orchestrator, pims_, Data Service /read);
  //  - POST to a Data Service /query or /read passes through (reads that happen to be POSTs);
  //  - EVERYTHING ELSE is answered here with a plausible 200 and NEVER sent.
  // Check it: after a shoot, `page.context()._writes` lists every write that was swallowed.
  // Remove it with `await page.context().unrouteAll()` — after that the browser writes for real.
  const CFG = {
    hosts: '**/*',                                          // every request the page makes
    readPosts: /\/dataservice_\/.*\/(query|read)(\?|$)/i,   // POSTs that are reads
  };
  const ctx = page.context();
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  ctx._writes = [];
  const uid = () => 'fake-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10);
  await ctx.route(CFG.hosts, async (route) => {
    const r = route.request();
    const m = r.method();
    const url = r.url();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    if (m === 'POST' && CFG.readPosts.test(url)) return route.continue();
    ctx._writes.push(m + ' ' + url.slice(0, 160));
    // Opt-in (ctx._fakeCase = true): answer an upload and a case start the way the tenant
    // would, so the extraction review opens. Its instance does not exist, so the review
    // falls back to its own labelled "sample read" — the honest state for a screenshot.
    if (ctx._fakeCase && /\/odata\/Attachments(\?|$)/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        Id: uid(), Name: 'account-opening-form.pdf',
        BlobFileAccess: { Uri: 'https://fake-blob.invalid/upload', Verb: 'PUT', Headers: { Keys: [], Values: [] } } }) });
    }
    if (ctx._fakeCase && /StartJobs/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: [{ Key: uid(), Id: 1 }] }) });
    }
    let body = null;
    try { body = r.postDataJSON(); } catch { body = null; }
    const out = Array.isArray(body)
      ? { successRecords: body.map((b) => ({ ...(b && typeof b === 'object' ? b : {}), Id: uid() })), failureRecords: [], value: [] }
      : { ...(body && typeof body === 'object' ? body : {}), Id: (body && body.Id) || uid(), value: [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
  });
  return 'route installed — every write is answered locally';
}
