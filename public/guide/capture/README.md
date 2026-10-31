# Taking the guide screenshots

Playwright scripts that fill `png/` with 1440 × 900 captures of the local app (port 5180), then
`to-jpeg.sh` turns them into `../shots/*.jpg` and rebuilds the guide.

Each `shoot-<persona>.js` is a self-contained `async (page) => { … }`, so it runs through the Playwright
MCP tool `browser_run_code_unsafe` (pass the file as `filename`) or any runner that calls it with a page.
They are generated: edit `_prelude.js` (shared helpers) or `_<persona>.body.js` (the steps) and run
`./_assemble.sh`.

1. `npm run dev` (port 5180). The demo token in `.env` signs the desk in; nothing else needs a login.
2. Run `route.js` FIRST, before the first page load, in the same browser context. **This app writes to the
   tenant just by being opened** (missing `AOFMaestroLink` rows are inserted on load), and Submit / upload /
   Approve / Run in Maestro / Process N applications call Orchestrator. `route.js` lets GET/HEAD/OPTIONS and
   Data Service `/query`·`/read` POSTs through and answers every other request locally, on every host.
   `page.context()._writes` lists what it swallowed.
   - With the route, StartJobs returns no instance, so a submit is not linked to a case and the app plays its
     own local story — that is what the customer Received / Status shots show.
   - `ctx._fakeCase = true` (set inside `shoot-customer.js` for the upload) answers the attachment upload and
     StartJobs with a fake instance, so the extraction review opens; after ~3 minutes it shows its own labelled
     “sample read”.
3. Run the scripts in this order: customer, rm, bulkops, ops, management, presenter. bulkops clears
   `aof_bulk_batches` and builds its own batches; ops clears the local demo data first.
4. `./to-jpeg.sh` — converts and deletes `png/` (public/ ships with the app build), rebuilds, and prints any
   shot id still missing.

Gotchas found while shooting:
- New record ids come from a per-browser counter (`aof_app_seq`). In a fresh browser they collide with ids other
  sessions already linked to live cases in `AOFMaestroLink`, and the new record shows someone else’s case.
  `shoot-customer.js` sets the counter to 900 first.
- The ops console and the FaceID console render inside iframes (`frameLocator('iframe')`).
- Hash-only navigation does not reload the SPA; `go()` adds a cache-busting query so every visit is a fresh load.
- Never press: “Approve … & advance”, “▶ Run in Maestro”, “Confirm and continue”, the voice agent’s call controls,
  Explore’s Run Now / Assign / Approve, the tower’s “Simulate an application”, admin Connect / Publish.
