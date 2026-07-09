# Sakhi PWA — Plan

## Deployed
- GitHub: https://github.com/pmmanishareddy/sakhi (private). Sample data (`public/outfits/`, `sampleData.ts`) and `.env` are gitignored — local only.
- Netlify: https://sakhi-550.netlify.app — auto-deploys on push to main via GitHub Actions (`.github/workflows/deploy.yml`; Netlify's own repo linking never worked). Manual fallback: `npx netlify deploy --build --prod`.
- All 6 edge functions live and verified (2026-07-09 post-audit paste round: full live suite + 15/15 perf-eval calls pass). Storage bucket private, signed URLs. Latency/cost baseline: `PERFORMANCE_COST_METRICS_2026-07-09.md`.

## TODO
- [x] Profile/settings screen (`/profile`, 4th nav tab) — edit name, gender, home city, and all onboarding style preferences; log out; delete account
- [x] Deleting a wardrobe item no longer deletes it from logged outfits — delete is now a soft delete (`status='archived'`); outfit history joins item data so archived pieces still render; AI features filter to active items
- [x] Fixed `generateId()` infinite recursion in api.ts (crashed image upload path on modern browsers)
- [x] Fix Ask Sakhi issues
- [x] Improve outfit suggestions — fixed ethnic/western mixing (explicit W/E/V style column, saree-blouse pre-filter, deterministic post-validation with retry). suggest-outfit also hardened against reasoning-preamble truncation (no prefill — model rejects it; 1500 max_tokens; reformat retry) and hallucinated item ids (violation retry + final strip).
  - [ ] Re-check any existing items where a saree blouse was tagged as plain "Blouse" (edit category to "Saree Blouse" in item detail)
- [ ] Per-user AI rate limit — small counter table checked in each edge function; needed once there are real users so one person can't exhaust the Anthropic spend cap ($10/mo, set 2026-07-09) for everyone
- [ ] Re-enable Google sign-in — button removed from the login screen 2026-07-09 (email/password only for now). The auth provider code (`signInWithGoogle` in `src/lib/auth.tsx`) and Supabase Google OAuth config are still in place; restoring is re-adding the button. Before re-enabling: verify redirect URLs for the Netlify domain and complete Google OAuth app verification (privacy policy page at /privacy already satisfies one requirement).
- [ ] Swap individual items in suggested outfit — tap a specific piece (e.g. the top) to swap just that item while keeping the rest of the outfit intact
- [ ] Edit logged outfits — add/remove items from an outfit, update the occasion, from the outfit detail screen
- [ ] Add streaming to AI features — use Claude's SSE streaming + edge function proxy so partial results arrive faster. Best suited for suggest-outfit (show styling_note progressively) or a future chat-style Sakhi interaction. For JSON responses, consider splitting into a plain-text first line (verdict/title) + JSON body so the headline can render immediately while the rest streams in.

## Gap analysis as the brand-collab surface (decided 2026-07-09)
Direction: wardrobe-gaps grows into a brand-collaboration feature. Quality is the monetizable asset — stays on Sonnet; the Haiku downgrade was considered for latency and explicitly rejected.
- [x] Deck redesign (2026-07-09) — swipeable full-screen gap cards with kind badges (Worth buying / Already yours / Quick fix), photo evidence collages from the user's own items, dashed ghost tile for the missing piece, mix summary line, per-kind actions, closing honesty card. New structured GapCard schema (kind, evidence_ids, ghost, unlocks_ids, gap {role, occasions, colors, price_band}) with #index→uuid mapping server-side.
- [x] "Show me options" shopping (2026-07-09) — NEW `shop-gap` edge function: Claude + web search finds 3-5 real purchasable products (title, brand, price, url, source) matching the gap object and the user's country/currency; bottom sheet UI. Every option carries a `sponsored` flag; sponsored placements will always be labeled to stay truthful. Cost note: web search ~$0.01/search + tokens, only on explicit user tap.
- [ ] Precompute + store gap analysis — run in background on wardrobe change (item add/edit/archive), store cards as structured rows, serve the Gaps screen instantly with a "refreshed" timestamp. Solves latency completely and cuts cost to one run per wardrobe change.
- [ ] Brand-collab matching layer (future) — match stored gap objects against partner catalogs, injected as labeled sponsored options in the shop sheet; every recommendation must stay grounded in the user's real wardrobe or it reads as an ad.

## Backlog — small latency wins
- [ ] Parallelize sequential DB fetches in edge functions with Promise.all where not already done (check suggest-outfit; wardrobe-gaps standalone already does)
- [ ] Compress photos to ~1100px instead of 1600px before upload/analysis — fewer vision tokens, slightly faster first token, no visible quality loss for garment recognition

