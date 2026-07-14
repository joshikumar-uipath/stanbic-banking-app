# App Store Submission Checklist — Aura

The web app has been wrapped with **Capacitor** so it can be built as a native iOS app. The functionality of the React/Vite code is unchanged — Capacitor renders the existing `dist/` bundle inside a native `WKWebView` and exposes native plugin APIs to JS where needed.

---

## ✅ Completed (already in the repo)

### Native shell
- **Capacitor 8** installed (`@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`)
- **Plugins installed**: `@capacitor/app`, `@capacitor/browser`, `@capacitor/status-bar`, `@capacitor/splash-screen`
- **iOS project scaffolded** at [`ios/`](ios/) — full Xcode project ready to open
- **Capacitor config** at [`capacitor.config.ts`](capacitor.config.ts):
  - `appId: com.uipath.aura` (change in Xcode if a different bundle ID is needed)
  - `appName: Aura`
  - `webDir: dist`
  - Splash screen and status bar plugin config

### Required iOS metadata ([`ios/App/App/Info.plist`](ios/App/App/Info.plist))
- `NSCameraUsageDescription` — explains camera use for image attachment
- `NSMicrophoneUsageDescription` — explains mic use for voice input
- `NSSpeechRecognitionUsageDescription` — explains speech-to-text
- `NSPhotoLibraryUsageDescription` — explains photo picker
- `NSPhotoLibraryAddUsageDescription` — for saving images
- `CFBundleURLTypes` — registers the `aura://` URL scheme for OAuth callback
- `LSApplicationQueriesSchemes` — allows opening external HTTPS URLs
- `ITSAppUsesNonExemptEncryption: false` — declares no custom crypto (saves a CCAT filing)

### Build/sync wired up
- `npm run build` produces the web bundle in `dist/`
- `npx cap sync ios` copies it into the Xcode project + updates plugins

---

## 🛠 What you need to do (in order)

### 1. Apple Developer account & Team
- Sign up for the **Apple Developer Program** ($99/year) if you haven't
- In **Xcode → Settings → Accounts**, add your Apple ID
- Note your **Team ID** (10-character string)

### 2. Configure signing in Xcode
```bash
cd "personal-assistant-branded"
npx cap open ios       # opens the Xcode project
```
In Xcode:
- Select the **App** target → **Signing & Capabilities** tab
- Tick **Automatically manage signing**
- Pick your Team
- Verify the **Bundle Identifier** is unique to you (`com.uipath.aura` works if no one has registered it; change to `com.<yourorg>.aura` otherwise)

### 3. App icon and launch screen
Capacitor scaffolded placeholder assets. To replace:

- **App icon**: replace files in [`ios/App/App/Assets.xcassets/AppIcon.appiconset/`](ios/App/App/Assets.xcassets/AppIcon.appiconset/). You need a **1024×1024 PNG** (no transparency, no alpha). Use [appicon.co](https://www.appicon.co/) or `cordova-res` to generate all required sizes from a single master.
- **Launch screen**: edit [`ios/App/App/Base.lproj/LaunchScreen.storyboard`](ios/App/App/Base.lproj/LaunchScreen.storyboard) in Xcode → Interface Builder, or replace the `splash.png` it references.

Tip: keep the launch screen **simple and brand-only** (logo on solid background). Apple requires it to render quickly without any dynamic content.

### 4. OAuth in native — REQUIRED for login to work

The current OAuth flow uses an HTTPS redirect URI (`https://mea.staging.uipath.host/aura`). In a native app, that redirect **navigates the WebView away from the app's hosted bundle**, breaking the auth callback.

You have two options:

#### Option A: Custom URL scheme (simpler)
1. The `aura://` URL scheme is already registered in `Info.plist`.
2. In your **UiPath External Application** (Client ID `ac4f272e-5f09-48cf-8866-275cbb65d70a`), add `aura://callback` to allowed Redirect URLs.
3. In the app, detect native context and override the redirect URI:
   ```ts
   import { Capacitor } from '@capacitor/core';
   const isNative = Capacitor.isNativePlatform();
   const redirectUri = isNative
     ? 'aura://callback'
     : 'https://mea.staging.uipath.host/aura';
   ```
4. Open the OAuth URL via `@capacitor/browser` instead of `window.location`:
   ```ts
   import { Browser } from '@capacitor/browser';
   await Browser.open({ url: oauthUrl });
   ```
5. Listen for the deep-link callback in `App.tsx`:
   ```ts
   import { App as CapacitorApp } from '@capacitor/app';
   CapacitorApp.addListener('appUrlOpen', (event) => {
     // event.url will be `aura://callback?code=...`
     // Pass to sdk.completeOAuth() with the URL
   });
   ```

#### Option B: Universal Links (more work, nicer UX)
Use the existing HTTPS redirect URI but configure iOS Universal Links so the app intercepts it. Requires hosting an `apple-app-site-association` file at `https://mea.staging.uipath.host/.well-known/apple-app-site-association` with your Team ID + bundle ID. The advantage: the URL works in both web and native without code branching.

**Recommendation**: start with Option A — it's contained to the app and doesn't need server-side coordination.

### 5. Privacy policy URL (mandatory for App Store)
Apple requires a publicly accessible privacy policy. Must mention:
- That you collect/store an OAuth token in device storage
- That you call UiPath APIs (data leaves the device)
- Camera/mic/photo library use
- Any analytics or telemetry (currently none configured)
- Contact email for data-deletion requests

Host it anywhere (GitHub Pages, a Notion page, your company site). Provide the URL in App Store Connect during submission.

### 6. App Store Connect listing
Create the app in [App Store Connect](https://appstoreconnect.apple.com/):
- Bundle ID matches Xcode project (`com.uipath.aura` or your override)
- App name: **Aura**
- Subtitle: short tagline (≤30 chars), e.g. "Your UiPath AI agents"
- Category: Primary = **Business**; Secondary = **Productivity**
- Age rating: 4+ (no objectionable content)
- App icon: 1024×1024 PNG
- Screenshots: required for **iPhone 6.9"** (1290×2796) and **iPhone 6.5"** (1284×2778). At least 2, max 10. Capture in Simulator: **Cmd+S**.
- Description, keywords, support URL, marketing URL

### 7. Submission notes — provide reviewer credentials
Apple reviewers cannot create UiPath accounts. In **App Store Connect → App Review Information**, provide:
- A test username + password for a UiPath staging account, OR
- A note explaining the app requires an existing UiPath organization account, with steps to obtain one

Without this, the app **will be rejected** for "unable to evaluate."

---

## 🚨 Open concerns (flagged earlier — still apply)

These were not changed because they affect functionality/data:

| Concern | Status | Action needed |
|---|---|---|
| **Hardcoded staging URLs** in `.env` and config | unchanged | Decide: ship pointing at staging (label app as "beta"), or set up production URLs |
| **Hardcoded Serper API key** in client bundle | unchanged | Move to a server-side proxy before public release. Anyone can extract it from the JS. |
| **Demo/test data** (Property Claim Review, Joshi Kumar, etc.) | unchanged | Reviewers may flag as PII or unfinished. Consider gating behind a "demo mode" toggle. |
| **Sign in with Apple** (Apple Guideline 4.8) | not added | If your app is publicly available on App Store and uses third-party login, Apple may require offering Sign in with Apple alongside. B2B/enterprise carve-outs exist — be prepared to argue. |
| **Memory: ~80–100 MB of video preloaded as Blobs** | unchanged | Low-end iOS devices may terminate. Monitor crash reports; may need on-demand loading. |
| **Accessibility** — VoiceOver labels, dynamic type | unchanged | Run `axe-core` audit; add ARIA labels and ensure text scales. |
| **Bundle size** (792 KB JS) | unchanged | Code-split via dynamic imports if Apple flags performance. Not an automatic rejection. |

---

## 📦 Local dev workflow (after this setup)

```bash
# Make code changes in src/
# Then:
npm run build          # produces dist/
npx cap sync ios       # copies dist/ into Xcode project + updates plugins

# Open in Xcode:
npx cap open ios

# Or run on simulator from CLI (after sync):
npx cap run ios
```

If you change anything in `capacitor.config.ts` or add/remove plugins, run `npx cap sync ios` again.

---

## 🚀 Submitting the build

In Xcode:
1. **Product → Archive** (must be a Real Device build, not Simulator — pick "Any iOS Device" as target)
2. After archive completes → **Window → Organizer**
3. Select the archive → **Distribute App** → **App Store Connect** → **Upload**
4. Once processed (10–30 min), the build appears in App Store Connect under TestFlight
5. Submit for **TestFlight** review first (faster, looser) — get internal testers to validate
6. When ready: **App Store Review** submission

Typical first-submission review time: **24–48 hours**. Be ready to respond to reviewer questions in App Store Connect Resolution Center if rejected.

---

## File map of what changed

```
personal-assistant-branded/
├── capacitor.config.ts                    NEW — Capacitor configuration
├── package.json                           updated — Capacitor deps added
├── package-lock.json                      updated — locked versions
├── ios/                                   NEW — full Xcode project
│   ├── App/
│   │   ├── App.xcodeproj/
│   │   ├── App/
│   │   │   ├── Info.plist                 NEW — permissions + URL scheme
│   │   │   ├── Assets.xcassets/           placeholder icons (replace before submit)
│   │   │   └── Base.lproj/                LaunchScreen.storyboard (customize)
│   │   └── Podfile                        NEW — CocoaPods dependencies
│   └── .gitignore                         NEW — ignores Pods/, build/
└── APP_STORE_CHECKLIST.md                 NEW — this file
```

No source files in `src/` were modified. The web app behavior is identical.
