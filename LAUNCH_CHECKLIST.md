# Sakhi — App Store & Play Store Launch Checklist

Compiled 2026-08-16. Store requirements researched against official Apple and
Google sources on that date; both stores change these rules often, so re-check
anything marked ⚠️ before you act on it.

Codebase findings were verified directly against this repo at commit `562d87e`.
Where a claim is research rather than something checked in the code, it says so.

---

## The headline

**Neither store accepts a URL.** Sakhi is a pure web PWA with no packaging
layer: no Capacitor, no Cordova, no Xcode project, no `assetlinks.json`.
Building that layer is the first real work, and it differs per store.

| | Approach | Effort |
|---|---|---|
| **Play** | Trusted Web Activity via Bubblewrap. Runs the live site inside Chrome's engine. Package is usually under 1 MB. | Low |
| **Apple** | Capacitor. Apple rejects thin webview wrappers under Guideline 4.2. Needs native camera picker, native navigation, push, some offline capability. | High |

**Play is achievable in weeks. Apple is the hard one.** Treat them as two
separate projects and ship Play first.

---

## Timeline

### Google Play, about 4 to 6 weeks, mostly waiting

- Identity verification: 2 to 5 business days
- **Closed test: 12 testers, opted in, 14 consecutive days.** Mandatory for
  personal accounts created after 13 Nov 2023. Interruptions reset the clock.
  This is the long pole. Recruit the 12 people before you start building.
  (Was 20 testers originally, reduced to 12 in Dec 2024.)
- Production access application: up to 7 days
- App review: 3 to 7 days for a first submission

### Apple, about 1 to 2 weeks, but budget one rejection

First submissions run 2 to 5 days per pass. A wrapped PWA that sends selfies to
a third-party AI is exactly the profile that gets bounced once. Assume
"rejected on 4.2 or 5.1.2(i), fix, resubmit" is the normal path, not bad luck.

---

## Accounts and money

- [ ] **Apple Developer Program, $99/year.** Enrol as an **individual**, not an
      organisation. No D-U-N-S number needed for individuals. Your legal name
      becomes the public seller name on the listing.
- [ ] **Play Console, $25 one-time.** Choose **Personal**, not Organization.
      Organization needs a D-U-N-S (up to 30 business days) and cannot be
      converted later without a new account and an app transfer.
- [ ] Government ID ready for both. The name must match your payment method.
      Google does not refund the $25 if verification fails.
- [ ] Tax and banking forms are only needed if you ever charge money. Skip for
      a free app, but expect App Store Connect to nag.

---

## Code blockers, in the order worth fixing

Every file reference below was verified against the repo.

### 1. The privacy policy contains two statements that are now false

`src/features/onboarding/PrivacyScreen.tsx`. This is a legal document a
reviewer can check against the running app, so fix it first.

- [ ] Line 17 says **"no other Sakhi user can see your wardrobe."** Public share
      links shipped in Aug 2026. Anyone holding a `/s/<token>` URL sees the
      owner's item photos, no login required.
- [ ] Line 31 says **"no third-party scripts."** `index.html:16` loads Google
      Fonts on every launch, which sends the user's IP to Google.
- [ ] Undisclosed processor: `src/lib/weather.ts:26-34` sends the user's home
      city to Open-Meteo.
- [ ] Undisclosed processor: `supabase/functions/shop-gap/index.ts:100` uses
      Claude's web-search tool, so the user's city, currency and wardrobe gap
      reach a search partner.
- [ ] Undisclosed data: profile avatar photo (`ProfileScreen.tsx:75-92`), trips
      (migration 006), and the email address itself.
- [ ] Missing sections, all required by the stores and by GDPR Art. 13:
      contact method, data retention period, user rights (access, correction,
      portability, objection), children's data / age policy.
- [ ] Consider hosting the policy as a static page rather than inside the SPA.
      A JS bundle error would make the store-listed policy URL render blank.

Reachability is fine: `App.tsx:78` puts `/privacy` in the signed-out route
branch, so the public URL works without login.

### 2. No password reset flow anywhere

No `resetPasswordForEmail` call exists in the codebase. A reviewer who mistypes
a password on a second device is locked out, which is a legitimate rejection
for broken account management. Cheapest fix is
`supabase.auth.resetPasswordForEmail` plus a link on the login screen.

### 3. Sign-up gives no feedback at all

`src/features/onboarding/LoginScreen.tsx:36-43`. On a successful sign-up it
clears the error, flips back to the sign-in form, blanks the password, and
shows nothing. If email confirmation is ON in the hosted project, the reviewer
creates an account, signs in, and hits "Email not confirmed" with no
explanation.

Whether this is fatal depends entirely on a dashboard setting nobody has
checked (see Dashboard Checks). `supabase/config.toml:226` says
`enable_confirmations = false` but that file governs local dev only.

### 4. Raw stack traces shown to end users

- `src/components/ErrorBoundary.tsx:32-46` renders "Screenshot this and send it
  over" plus `error.stack` in a red monospace block.
- `src/main.tsx:40-52` renders a startup-error panel with a raw stack.

Useful for debugging an installed PWA, reads as unfinished software to a
reviewer (Apple 2.1 / 4.0). Gate both behind a build flag.

### 5. User data logged to console

- `src/features/outfit-log/LogOutfitFlow.tsx:264` logs the full AI match payload
  (the user's wardrobe) on every outfit log.
- `supabase/functions-standalone/purchase-verdict.ts:141-254` logs user id, item
  name, price and image size. The `supabase/functions/` twin has none of these.
  Since standalone copies are what actually run in production, the verbose one
  is probably live. Resolve which is deployed.

### 6. Migration 002 still creates a public bucket

`supabase/migrations/002_storage_bucket.sql:2` sets `public = true` and lines
8-10 add an unscoped "Anyone can view wardrobe images" SELECT policy. The live
bucket was flipped private by hand, but anyone re-running migrations against a
fresh project re-exposes every mirror selfie. Fix the migration to match
reality.

### 7. Version and package name are placeholders

`package.json` has `"name": "pwa"` and `"version": "0.0.0"`. Set a real name and
`1.0.0`. Decide now how this drives the native `versionName`/`versionCode`
(Android) and `CFBundleShortVersionString`/`CFBundleVersion` (iOS). Play
rejects a duplicate `versionCode` outright and it is the most common
resubmission trip-up.

### 8. Everything assumes the Netlify origin

This is the largest iOS engineering task after the wrapper itself. In a
Capacitor build the origin becomes `capacitor://localhost` (iOS) or
`http://localhost` (Android), which breaks three things:

- [ ] **CORS.** `supabase/functions/_shared/cors.ts:1-12`, duplicated at the top
      of all 8 files in `supabase/functions-standalone/`, allows only the
      Netlify origin plus two localhost ports. Every AI feature and account
      deletion fails. The fallback returns the Netlify origin rather than
      refusing, so failures surface as opaque network errors, not clear 403s.
- [ ] **Share links.** `src/lib/api.ts:984` builds
      `` `${window.location.origin}/s/${token}` ``, which would produce dead
      `capacitor://localhost/s/...` links the moment one is shared to WhatsApp.
      Needs a hardcoded canonical https base.
- [ ] **OAuth redirect.** `src/lib/auth.tsx:55` uses `window.location.origin`,
      meaningless in a native shell. Only matters if social sign-in ships.

Also: `src/lib/supabase.ts:3` falls back to `https://placeholder.supabase.co`
when the env var is missing, so a wrapper build with a bad env ships silently
broken instead of failing the build.

### 9. `gap_results` has no migration

Written at `supabase/functions/wardrobe-gaps/index.ts:231` but absent from
`supabase/migrations/`, so it was created by hand and its delete cascade is
unverified. If `user_id` lacks `ON DELETE CASCADE`, account deletion either
fails on the FK or leaves AI-derived wardrobe data behind. Both stores require
genuine deletion. See Dashboard Checks.

### 10. Account deletion leaves photos behind at scale

`supabase/functions/delete-account/index.ts:23` lists storage with
`{ limit: 1000 }`, no pagination and no recursion. A user with more than 1000
item photos keeps the remainder forever, silently. Loop until a page returns
fewer than the limit.

Otherwise deletion is genuinely thorough: all cascades check out across
migrations 001, 005 and 006, and client `localStorage` plus the signed-URL
cache are cleared.

---

## Apple specifics

### Sign in with Apple is NOT required today

Verified: `LoginScreen.tsx` renders email and password only. The Google button
was removed in July 2026, so `signInWithGoogle` (`auth.tsx:52`) is dead code
and Guideline 4.8 is not triggered.

**But it is coupled.** `PLAN.md` lists "re-enable Google sign-in" as an open
TODO. The moment that button returns, Sign in with Apple becomes mandatory on
iOS, including:

- the native `ASAuthorizationAppleIDProvider` flow, not the web JS flow
- the Sign in with Apple capability and entitlement
- a token-revocation call wired into the existing account deletion

Treat those as one change. Never ship the Google button as a standalone tweak.

### Guideline 5.1.2(i), added November 2025 ⚠️

> "You must clearly disclose where personal data will be shared with third
> parties, including with third-party AI, and obtain explicit permission
> before doing so."

This lands squarely on Sakhi, which sends selfies to Claude.

- [ ] An in-app consent screen shown **before the first photo reaches Claude**,
      naming Anthropic, what is sent, and why, with a real allow/deny choice
      that is remembered. A mention buried in the privacy policy is no longer
      sufficient.
- [ ] Declare Anthropic as a distinct third-party AI recipient in the App
      Privacy labels. Reviewers now cross-check labels against real network
      traffic, and drift between them is an explicit rejection pattern.
- [ ] Note this is separate from App Tracking Transparency. An API call for app
      functionality is not "tracking" and does not need an ATT prompt.

### Other Apple items

- [ ] **Privacy manifest** (`PrivacyInfo.xcprivacy`). Mandatory since May 2024.
      A missing one fails at binary upload, before a human reviewer sees it.
      Any bundled Capacitor plugin also needs its own.
- [ ] **Age rating questionnaire.** Expanded in 2026 to ask specifically about
      AI assistant and chatbot functionality and what the model could surface.
      Required at submission. Sakhi's AI is narrow and structured rather than
      open chat, so a low rating is likely, but the questionnaire must actually
      be completed.
- [ ] **Demo account** with a populated wardrobe in the App Review notes. The
      app is useless empty and reviewers will try to log an outfit and get an
      AI result. If the Claude call fails during review, that is an automatic
      rejection.
- [ ] **The hidden diagnostics panel.** Five taps on the name in Profile
      (`ProfileScreen.tsx:24-32`, `:189`, `DiagFooter` at `:478-497`) reveals
      build stamp and viewport metrics. No user data is exposed, but Apple
      2.3.1 prohibits hidden or undocumented features. Either strip it from
      release builds or disclose it in the review notes.
- [ ] **Guideline 4.2 mitigation.** What makes wrapped apps pass: native camera
      picker instead of an HTML file input, native navigation chrome, push
      notifications, and something other than a blank screen when offline.
- [ ] Builds must use the current Xcode / iOS SDK. ⚠️ Check
      developer.apple.com/news/upcoming-requirements at submission time.

---

## Play specifics

- [ ] **`assetlinks.json`** at `https://<domain>/.well-known/assetlinks.json`,
      HTTPS, no redirects. **Use the SHA-256 from Play Console → Setup → App
      integrity, not your local upload keystore.** Google re-signs the bundle
      with its own key, so the wrong fingerprint is the number one cause of a
      TWA showing a browser address bar in production even though it worked
      locally. Update it after the first production upload.
- [ ] **Target API 36 (Android 16)**, required for submissions from 31 Aug 2026.
      An extension to 1 Nov 2026 can be requested in Play Console.
- [ ] **Android App Bundle plus Play App Signing.** Both mandatory. Back up the
      upload keystore somewhere you will not lose it.
- [ ] **Data Safety form.** Declare photos, email, and identifiers. For the
      Anthropic question, read their current API terms to decide whether they
      are a "service provider processing on your behalf" or a "third party".
      Err toward disclosing as shared; under-disclosure is what triggers
      suspensions.
- [ ] **A web account-deletion URL.** Play requires deletion reachable without
      the app installed, linked from the Data Safety form. A generic "email us"
      page does not satisfy this. Sakhi has nothing for this today, and the
      in-app flow only satisfies Apple.
- [ ] **Photo permissions.** A TWA using the browser file input is fine. If you
      move to Capacitor with a native gallery plugin requesting
      `READ_MEDIA_IMAGES`, you need a Play Console declaration justifying broad
      access instead of the system Photo Picker.
- [ ] **AI content policy.** Sakhi's backend analysis is probably outside the
      policy's core target (it aims at chatbots and generative media), but the
      text is ambiguous. Cheap insurance: add a "report an issue with this
      suggestion" affordance to AI output.

---

## Assets

| Asset | Spec | Status |
|---|---|---|
| Apple app icon | 1024×1024 PNG, **no alpha** | Missing. Both existing PNGs are RGBA, so flatten onto opaque background |
| Play listing icon | 512×512 32-bit PNG | Have it (`public/icon-512.png`) |
| Maskable icon | 512×512 with ~20% safe-zone padding | **Fake.** `vite.config.ts:29` declares the same unpadded icon a second time with `purpose: maskable`, so Android's adaptive mask will crop it |
| `apple-touch-icon.png` | 180×180 | **Referenced at `vite.config.ts:17` but does not exist.** `index.html:15` points at the 192px icon instead |
| Play feature graphic | 1024×500, no alpha | Missing |
| iPhone screenshots | 6.9" (1320×2868), 1 to 10 ⚠️ | Missing |
| Play screenshots | 1080×1920, minimum 2, up to 8 | Missing |
| Manifest `screenshots` array | for Play's rich install UI | Missing |
| Manifest `id` | stable app identity | Missing |
| Short description | ≤ 80 characters | Not written |
| Full description | ≤ 4000 characters | Not written |
| Privacy policy URL | public, accurate | Exists but inaccurate, see blocker 1 |
| Support URL | live page, not a bare mailto | Missing |
| Terms of Service | — | Missing entirely |

⚠️ Apple has changed required screenshot sets more than once. Recent guidance is
that only 6.9" iPhone (and 13" iPad if supported) are needed and Apple
auto-scales the rest, but verify on the live upload screen.

---

## Dashboard checks nobody has done

Not verifiable from code. The first two are the catastrophic-if-wrong kind.

- [ ] **RLS actually enabled on every table.**
      `select tablename, rowsecurity from pg_tables where schemaname='public';`
      then `select * from pg_policies;`
      Cover `wardrobe_items`, `outfits`, `outfit_items`, `profiles`,
      `purchase_verdicts`, `social_circles`, `trips`, `trip_entries`,
      `wardrobe_shares`, `gap_results`.
- [ ] **Storage bucket is genuinely private**, with an owner-scoped SELECT
      policy comparing the path's first folder to `auth.uid()`.
- [ ] **`gap_results` cascade.**
      `select conname, confdeltype from pg_constraint where conrelid='gap_results'::regclass;`
      Expect `c`.
- [ ] **Email confirmation on or off** in Auth → Providers → Email. Determines
      whether code blocker 3 is fatal or merely rough.
- [ ] **Auth redirect URL allowlist** lists only your domains, plus any native
      scheme you add later.
- [ ] **Per-user rate limiting on AI endpoints.** None exists. An Anthropic
      spend cap protects your wallet but means one abusive user can break the
      app for everyone, including a reviewer mid-review.
- [ ] Swap `NETLIFY_AUTH_TOKEN` for a scoped PAT rather than a personal CLI
      token.

---

## Local hygiene

- [ ] **`dist/outfits/` currently holds 51 personal outfit photos.**
      `public/outfits/` is gitignored so CI never ships them, but `PLAN.md`
      documents `npx netlify deploy --build --prod` as a manual fallback.
      Running that from this working copy would publish all 51 publicly.
      Do not use that fallback, or clear `dist/` first.
- [ ] Drop `puppeteer` from devDependencies if it is no longer used.
- [ ] `README.md` is still the stock Vite template.
- [ ] Reconcile `supabase/functions/` with `supabase/functions-standalone/` and
      get edge functions into CI, so the deployed code is knowable. The two
      copies have drifted more than once and it is the top source of "the AI
      feature is broken".

---

## Suggested sequencing

1. **Cheap and gates both stores:** privacy policy accuracy and missing
   sections, password reset, sign-up feedback, version number, stack traces,
   console logs.
2. **Dashboard checks**, especially RLS and the bucket. Do these before any
   submission, not after.
3. **Play TWA.** Recruit 12 testers, build with Bubblewrap, get
   `assetlinks.json` right, start the 14-day clock early since it runs in the
   background while you keep working.
4. **iOS Capacitor wrapper** as its own project: origin handling, native camera,
   the 5.1.2(i) consent screen, privacy manifest.
5. **Sign in with Apple**, only if and when the Google button returns.

---

## Sources

Apple: App Store Review Guidelines, Apple Developer Program enrolment help,
account deletion requirement (Developer News `mdkbobfo`), App Privacy Details,
updated age ratings (Developer News `ks775ehf`), upcoming requirements.

Google: Play Console Help on testing requirements for new personal accounts,
developer account types, identity verification, target API levels, Data Safety,
account deletion requirements, AI-generated content policy, Play App Signing,
store listing best practices; Android Developers docs on Trusted Web Activities
and App Links troubleshooting.
