# Sakhi PWA — Plan

## TODO
- [x] Profile/settings screen (`/profile`, 4th nav tab) — edit name, gender, home city, and all onboarding style preferences; log out; delete account
  - [ ] Deploy NEW `delete-account` edge function via dashboard (`functions-standalone/delete-account.ts`) — account deletion fails until then
  - [ ] Pending redeploys from earlier: `suggest-outfit` (JSON prefill), `purchase-verdict` (style column)
- [x] Deleting a wardrobe item no longer deletes it from logged outfits — delete is now a soft delete (`status='archived'`); outfit history joins item data so archived pieces still render; AI features filter to active items
- [x] Fixed `generateId()` infinite recursion in api.ts (crashed image upload path on modern browsers)
- [x] Fix Ask Sakhi issues
- [x] Improve outfit suggestions — fixed ethnic/western mixing (explicit W/E/V style column, saree-blouse pre-filter, deterministic post-validation with retry). Code done in both `supabase/functions/` and `supabase/functions-standalone/`.
  - [ ] Deploy ALL 5 updated bundles via Supabase dashboard (`functions-standalone/*.ts`) — every function changed in the prompt-review pass (grounded purchase-verdict, pipe-format wardrobe-gaps, saree-blouse fix in match-outfit-photo, weather + voice in suggest-outfit, not-clothing guard in analyze-item)
  - [ ] Re-check any existing items where a saree blouse was tagged as plain "Blouse" (edit category to "Saree Blouse" in item detail)
- [ ] Swap individual items in suggested outfit — tap a specific piece (e.g. the top) to swap just that item while keeping the rest of the outfit intact
- [ ] Edit logged outfits — add/remove items from an outfit, update the occasion, from the outfit detail screen
- [ ] Add streaming to AI features — use Claude's SSE streaming + edge function proxy so partial results arrive faster. Best suited for suggest-outfit (show styling_note progressively) or a future chat-style Sakhi interaction. For JSON responses, consider splitting into a plain-text first line (verdict/title) + JSON body so the headline can render immediately while the rest streams in.

