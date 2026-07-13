# Frida → Apple: the playbook

Everything repo-side is done (PWA layer, icons, Capacitor config, build
scripts). The steps below are the parts only Jenni can do — enrollment,
Xcode, and the App Store paperwork. Written July 2026.

---

## Part 1 — Enroll in the Apple Developer Program (~15 min + up to 48h review)

Fastest path is the iPhone app:

1. On your iPhone, download **"Apple Developer"** from the App Store.
2. Open it → Account tab → sign in with your Apple ID → **Enroll Now**.
3. Choose **Individual** (recommended — "Jenni Tang" shows as the seller;
   Organization requires a D-U-N-S number and takes weeks).
4. It scans your driver's license and takes a selfie for identity
   verification, then charges **$99/year**.
5. Approval email usually lands within 48 hours.

Alternative: developer.apple.com/programs/enroll in a browser — same flow,
slower identity verification.

## Part 2 — One-time Mac setup (after enrollment approval)

```
cd /Users/jennitang/Developer/TangSkin
npm install
xcode-select --install        # if Xcode command line tools are missing
sudo gem install cocoapods    # or: brew install cocoapods
npm run cap:build             # builds index.html and stages www/
npx cap add ios               # generates the ios/ Xcode project (once)
npx cap sync ios
```

Then open the project:

```
cd /Users/jennitang/Developer/TangSkin
npm run cap:open
```

In Xcode, four one-time settings:

1. **Signing** — select the App target → Signing & Capabilities → check
   "Automatically manage signing" → pick your new team.
2. **Camera permission** — App/App/Info.plist → add:
   - `NSCameraUsageDescription` → "Frida uses the camera for your daily
     skin check-in photos."
   - `NSPhotoLibraryUsageDescription` → "Frida can read photos you choose
     to add to your skin journal."
   - `NSPhotoLibraryAddUsageDescription` → "Frida can save exports to your
     photo library."
3. **Display name** — target → General → Display Name: `Frida`.
4. **Version** — start at 1.0.0, build 1. Bump the build number on every
   TestFlight upload.

## Part 3 — Every subsequent release

```
cd /Users/jennitang/Developer/TangSkin
npm run cap:sync              # rebuild + copy into the iOS shell
npm run cap:open              # then in Xcode: Product → Archive
```

Archive → Distribute App → App Store Connect → Upload. It appears in
App Store Connect (appstoreconnect.apple.com) under TestFlight within
~15 minutes.

## Part 4 — TestFlight (friends & family)

1. appstoreconnect.apple.com → Apps → Frida → TestFlight.
2. Internal testing (you + Gainey via Apple IDs): instant, no review.
3. External testing (friends link, up to 10,000 people): needs a light
   "Beta App Review" — usually approved in a day.

## Part 5 — App Store submission (when ready for strangers)

Checklist before hitting submit:

- [ ] **Privacy policy URL** — REQUIRED. Must accurately say: photos are
      stored in your Supabase project; images are sent to Google
      (always, for analysis via the proxy) and to Anthropic/OpenAI only
      when the user adds their own key; no data is sold.
- [ ] **App Privacy labels** (in App Store Connect): declare
      Photos/Videos (linked to user), Email (account), User Content
      (journal). Nothing "used to track you."
- [ ] **Screenshots** — 6.7" and 6.1" iPhone sizes minimum. Use real
      check-in flows; keep the editorial voice in captions.
- [ ] **Description in Tang & Gainey voice** but say clearly it is
      educational, not medical diagnosis (Apple guideline 1.4.1 —
      the app's own framing already matches; keep the listing aligned).
- [ ] **Guideline 4.2 (minimum functionality)** — wrapped web apps get
      extra scrutiny. Mitigation before submitting publicly: add push
      notifications for check-in reminders via @capacitor/push-notifications
      (genuinely useful + reads as native). TestFlight does NOT need this.
- [ ] **No payments** in-app (currently true) — nothing to do. If Frida
      ever charges, it must use Apple in-app purchase.
- [ ] Sign-in is email/password via Supabase only — no third-party OAuth,
      so "Sign in with Apple" is NOT required. (Adding Google/Facebook
      login later would trigger that requirement.)

## Notes

- The PWA layer (manifest + service worker) shipped separately — iPhone
  users can already "Add to Home Screen" from Safari today, no Apple
  account needed. That's the zero-cost distribution while enrollment
  processes.
- `www/` and `ios/Pods/` are build products — gitignored. The `ios/`
  project folder itself SHOULD be committed once generated.
- Camera works in the Capacitor shell via the same getUserMedia code —
  no code changes expected. Test the guided capture flow first thing.
