# Sakhi — Security, Privacy & Responsible AI Review (2026-07-08)

Scope: full codebase + deployed architecture (Supabase, Netlify, GitHub Actions, Anthropic API).
Severity: 🔴 High · 🟡 Medium · 🟢 Low / good.

## Security

- 🔴 → ✅ **Wardrobe photos live at public URLs.** *(Fixed 2026-07-09, pending bucket flip.)* All reads now go through 7-day signed URLs with an on-device cache (cleared on logout/delete); the DB keeps canonical URLs and write paths sanitize signed URLs back to canonical form. Signing verified working against production with a user token. **Remaining manual step:** Dashboard → Storage → wardrobe-images → set bucket to private. Then confirm the storage SELECT policy is owner-scoped (`select * from pg_policies where schemaname='storage';` — the `using` clause should compare the path's first folder to `auth.uid()`).
- 🟡 **RLS is load-bearing and unverified from code.** The client talks to PostgREST with the anon key + user JWT; nothing in the repo proves `wardrobe_items`, `outfits`, `outfit_items`, `profiles`, `purchase_verdicts`, `social_circles` have owner-only row-level security. If any table lacks it, any logged-in user can read everyone's data. **Verify (5 min):** run `select tablename, rowsecurity from pg_tables where schemaname='public';` and `select * from pg_policies;` in the SQL editor.
- 🟡 **CORS is `Access-Control-Allow-Origin: *`** on all edge functions (`_shared/cors.ts`). Auth still gates every call, so impact is limited, but pinning it to `https://sakhi-550.netlify.app` is a one-line hardening.
- 🟡 **No rate limiting on AI endpoints.** Every function verifies the JWT (good — all six use `getUser`, and delete-account correctly rejects unauthenticated calls), but an authenticated user can loop `suggest-outfit` and burn Anthropic spend. **Cheapest fix:** set a monthly spend limit in the Anthropic console today; add a per-user daily counter table only if the app gets real users.
- 🟡 **No request-size validation on image endpoints.** `analyze-item` and `match-outfit-photo` pass `image_base64` straight to Claude. Claude rejects oversized images anyway, so this is mostly self-limiting; a `if (image_base64.length > 7_000_000) return 400` guard is cheap insurance.
- 🟢 **Prompt injection via item names** is contained: a user can only poison their own prompts, and suggest-outfit post-validates item ids and style rules deterministically.
- 🟢 **Secrets hygiene is sound.** Anon key in the client bundle is by design (RLS is the boundary); service-role key exists only in edge-function env; `.env` is gitignored; CI secrets are encrypted. One note: `NETLIFY_AUTH_TOKEN` in GitHub is your personal CLI token — swap it for a scoped PAT (Netlify → User settings → Applications) if the repo ever gains collaborators.

## Data privacy

- 🔴 → ✅ **No consent or privacy surface anywhere.** *(Fixed 2026-07-09.)* Added `/privacy` (plain-language: what's stored, where it lives, the Anthropic processing and no-training note, no-analytics statement, deletion). Linked from a consent line on the login screen and a Privacy row in Profile. Account deletion and sign-out now also clear on-device `sakhi_*` localStorage.
- 🟡 **Photo sensitivity compounds the public-bucket issue** — outfit *selfies* are photos of the user, the most sensitive data in the app. The bucket decision above is really a privacy decision.
- 🟢 **Deletion is genuinely complete.** `delete-account` removes both storage folders, then `deleteUser` cascades through the tables (verify FKs are `on delete cascade`: `select conname, confdeltype from pg_constraint where contype='f';` — expect `c`). Minor gap: on-device `localStorage` (`sakhi_name`, flags) isn't cleared on account deletion — one line in `deleteAccount()`.
- 🟢 **No analytics, no trackers, no third-party scripts.** localStorage holds only first name and UX flags. Data flows to exactly three processors: Supabase (storage/DB), Anthropic (AI), Netlify (static hosting — no user data).

## Responsible AI

- 🟡 **Prompts hardcode she/her while onboarding collects gender** (including male / non-binary / prefer-not-to-say) — e.g. wardrobe-gaps: "Factor in *her* location." **Fix:** switch prompts to "the user/you" (the output voice is already second-person) — cosmetic edit across the six prompts.
- 🟡 **Purchase verdicts are confident financial advice.** The grounding is good (real overlap items, CPW math, "maybe is a last resort") — but the UI presents "SKIP" as a ruling. Aligned with Sakhi's own philosophy ("trust the user's taste"), add one microcopy line under verdicts: *"Sakhi's take — you know your closet best."* Keeps decisiveness, removes false authority.
- 🟡 **No explicit body-comment guardrail.** Nothing today invites body/size/attractiveness commentary, but styling prompts + user photos make it possible. One system-prompt line in each function — "Comment on garments, never on the user's body, size, or attractiveness" — is cheap, permanent insurance.
- 🟢 **Hallucination guards** are strong where it matters most: suggest-outfit validates every item id, retries with named violations, and strips invalid pieces. Verdicts/gaps are free-text grounded in the real inventory; worst case is a mistaken claim, not a broken flow. Errors fail as friendly messages, not raw stack traces (one exception: analyze-item surfaces a raw Claude error on undecodable images — cosmetic).
- 🟢 **AI is honestly presented** — Sakhi is explicitly an AI stylist persona, so outputs are inherently labeled. The cultural rules for ethnic wear are a deliberate, user-requested feature; manual outfit logging remains the escape hatch for fusion styles the rules would block.

## Do these first

1. **Verify RLS on every table** (SQL above) — the one item that would be catastrophic if wrong.
2. **Set an Anthropic monthly spend cap** — 2 minutes, caps the worst-case cost bug.
3. **Decide the photo-bucket question** — private + signed URLs, or documented acceptance of UUID obscurity.
4. **Add the privacy line + page at login** — discloses the Anthropic processing, unblocks future OAuth verification.
5. **De-gender the prompts + add the body-comment guardrail** — one editing pass across six prompt strings.

## Could not verify from the repo (dashboard checks)

| What | How to check |
|---|---|
| RLS enabled + policies per table | SQL editor: `select tablename, rowsecurity from pg_tables where schemaname='public';` then `select * from pg_policies;` |
| Bucket public vs private | Dashboard → Storage → wardrobe-images → configuration (Public toggle) |
| FK cascade on delete | `select conname, confdeltype from pg_constraint where contype='f';` (`c` = cascade) |
| Edge functions' `verify_jwt` setting | Dashboard → Edge Functions → each function → Details (delete-account already probed: returns 401 unauthenticated ✓) |
| Auth redirect-URL allowlist | Dashboard → Authentication → URL Configuration (should list only your domains) |
| Anthropic spend limit | Anthropic console → Billing → Limits |
