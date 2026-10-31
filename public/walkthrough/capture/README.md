# Capturing the walkthrough

1. Fill `config.cjs` (and `../config.js` for the player). Optional: `python3 make-camera.py`.
2. Start the local apps. Copy a Chrome profile signed in to them:
   `rsync -a --exclude 'Singleton*' --exclude '*Cache*' <profile>/ /tmp/wt-profile/`
3. Write scenes with a live capture browser:
   ```
   PW=<path to playwright-core> PROFILE=/tmp/wt-profile node explore.cjs     # port 9555
   ```
   Send it commands (POST the body of an async function to http://localhost:9555); `dev.cjs`
   has `dump(page)` (what is clickable), `shot(page, n)` and `run(page, state, fromId, toId)`.
   Set `WT_FRAMES` / `WT_JSON` to a scratch folder while experimenting.
4. Full capture:
   ```
   PW=<path to playwright-core> PROFILE=/tmp/wt-profile node run.cjs
   ```
   Prints each scene's frame count, any `OFF SCREEN` click, and how many writes were answered
   locally. Writes `../frames.next/` + `../walkthrough.next.json` and swaps them into
   `../frames/` + `../walkthrough.json` only when every scene succeeds.
5. Re-capture a scene that doesn't depend on the case (e.g. a dashboard):
   `ONLY=<scene id> PW=… PROFILE=… node only.cjs`
