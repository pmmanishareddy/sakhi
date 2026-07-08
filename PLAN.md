# Sakhi PWA — Plan

## Deployed
- GitHub: https://github.com/pmmanishareddy/sakhi (private). Sample data (`public/outfits/`, `sampleData.ts`) and `.env` are gitignored — local only.
- Netlify: https://sakhi-550.netlify.app — env vars set, SPA redirects via `netlify.toml`. Manual deploys: `npx netlify deploy --build --prod` (connect the repo in Netlify UI for auto-deploy on push).
- All 6 edge functions live and verified: 60/60 live tests pass (suggest-outfit across 6 occasions, grounded purchase-verdict, wardrobe-gaps, analyze-item, match-outfit-photo, delete-account).

## TODO
- [x] Profile/settings screen (`/profile`, 4th nav tab) — edit name, gender, home city, and all onboarding style preferences; log out; delete account
- [x] Deleting a wardrobe item no longer deletes it from logged outfits — delete is now a soft delete (`status='archived'`); outfit history joins item data so archived pieces still render; AI features filter to active items
- [x] Fixed `generateId()` infinite recursion in api.ts (crashed image upload path on modern browsers)
- [x] Fix Ask Sakhi issues
- [x] Improve outfit suggestions — fixed ethnic/western mixing (explicit W/E/V style column, saree-blouse pre-filter, deterministic post-validation with retry). suggest-outfit also hardened against reasoning-preamble truncation (no prefill — model rejects it; 1500 max_tokens; reformat retry) and hallucinated item ids (violation retry + final strip).
  - [ ] Re-check any existing items where a saree blouse was tagged as plain "Blouse" (edit category to "Saree Blouse" in item detail)
- [ ] Per-user AI rate limit — small counter table checked in each edge function; needed once there are real users so one person can't exhaust the Anthropic spend cap ($10/mo, set 2026-07-09) for everyone
- [ ] Swap individual items in suggested outfit — tap a specific piece (e.g. the top) to swap just that item while keeping the rest of the outfit intact
- [ ] Edit logged outfits — add/remove items from an outfit, update the occasion, from the outfit detail screen
- [ ] Add streaming to AI features — use Claude's SSE streaming + edge function proxy so partial results arrive faster. Best suited for suggest-outfit (show styling_note progressively) or a future chat-style Sakhi interaction. For JSON responses, consider splitting into a plain-text first line (verdict/title) + JSON body so the headline can render immediately while the rest streams in.

