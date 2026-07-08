# Sakhi Backend — Implementation Plan

## What's Done

| Layer | Status | Details |
|-------|--------|---------|
| Database schema | ✅ Done | 8 tables, RLS, triggers, indexes — deployed to Supabase cloud |
| Storage bucket | ✅ Done | `wardrobe-images` with upload/view/delete policies |
| Supabase client | ✅ Done | `src/lib/supabase.ts` with env vars |
| Auth provider | ✅ Done | `src/lib/auth.tsx` — Email + Google OAuth, session management |
| API layer | ✅ Done | `src/lib/api.ts` — CRUD for items, outfits, verdicts, profiles, circles, stats |
| Wardrobe store | ✅ Done | `src/lib/wardrobe-store.tsx` — context provider, real data only |
| Edge functions | ✅ Scaffolded | 5 functions: analyze-item, suggest-outfit, purchase-verdict, match-outfit-photo, wardrobe-gaps |
| Shared utils | ✅ Done | `_shared/` — auth, CORS, Claude API helper (uses claude-sonnet-4) |

## What Needs to Be Built

### Phase 1: Make Auth Work ✅ DONE

- [x] **1.1** Email/password auth working — Google OAuth deferred to production
- [x] **1.2** Signup → profile auto-creation trigger fires (fixed search_path bug)
- [x] **1.3** Login → session persists → RLS allows data access
- [ ] **1.4** (Later) Enable Google OAuth in Supabase dashboard with Google Cloud Console credentials

### Phase 2: Update Types & API ✅ DONE

- [x] **2.1** Updated `src/types/index.ts` — added `seasons`, `style_tags`, `status`, `SocialCircle`, `UserStats`, `Profile`
- [x] **2.2** Updated `src/lib/api.ts` — added social circles CRUD, user stats, outfit circles junction, money saved tracking
- [x] **2.3** Updated `wardrobe-store.tsx` — removed sample data fallback, real data only
- [x] **2.4** Updated `analyze-item` edge function to return `seasons` and `style_tags`

### Phase 3: Deploy Edge Functions ✅ DONE

- [x] **3.1** Created standalone function bundles (inlined shared code for dashboard deploy)
- [x] **3.2** Deployed all 5 functions via Supabase dashboard
- [x] **3.3** Set `ANTHROPIC_API_KEY` secret in Edge Functions → Manage Secrets
- [x] **3.4** Verified all functions respond correctly (reject unauthenticated, accept authenticated)

### Phase 4: Add URL-to-Item Pipeline

Currently missing — no edge function for scraping product URLs.

- [ ] **4.1** Create `supabase/functions/scrape-url/index.ts`:
  - Accept `{ url: string }`
  - Fetch page HTML (simple HTTP GET)
  - Extract `og:image` meta tag (primary), JSON-LD product data (bonus)
  - Extract bonus metadata: brand, price, product name from og:/JSON-LD tags
  - Return `{ image_url, metadata: { brand?, price?, name?, fabric? } }`
- [ ] **4.2** Wire into frontend `AddItemScreen`:
  - User pastes URL → call `scrape-url` → get product image
  - Feed image to `analyze-item` for AI tagging
  - Merge scraped metadata (brand, price) with AI tags
  - Show confirmation screen → save to wardrobe

### Phase 5: Wire Up Remaining Frontend ↔ Backend Connections ✅ DONE

- [x] **5.1** `AddItemScreen` — photo upload → `analyze-item` edge fn → save to DB (added seasons/style_tags pass-through)
- [x] **5.2** `WardrobeScreen` — fetches real data via wardrobe-store context
- [x] **5.3** `ItemDetail` — edit/delete/laundry toggle hit real DB, currency changed to INR, removed demo checks
- [x] **5.4** `SuggestFlow` — calls `suggest-outfit` edge fn → displays results → "Wear This" logs outfit
- [x] **5.5** `LogOutfitFlow` — photo matching via `match-outfit-photo`, social circles fetched from DB, outfit logged with circle names
- [x] **5.6** `SakhiScreen` — real photo/text input for purchase verdicts, wardrobe gaps from edge fn, verdict history from DB, money saved from user stats
- [x] **5.7** `Onboarding` — saves frustrations, occasions, and style preferences to profiles via `updateProfile()`

### Phase 6: Polish & Edge Cases

- [ ] **6.1** Loading states — skeleton screens while data fetches
- [ ] **6.2** Error handling — toast notifications on API failures
- [ ] **6.3** Optimistic updates — laundry toggle, item edits feel instant
- [ ] **6.4** Empty states — "Add your first item" when wardrobe is empty
- [ ] **6.5** Image compression — resize before upload (keep under 1MB)

## Architecture Overview

```
User (PWA)
  │
  ├── Auth ──────────── Supabase Auth (Google OAuth)
  │
  ├── Data CRUD ─────── Supabase PostgREST (auto-generated REST API)
  │                      └── RLS ensures user isolation
  │
  ├── Image Upload ──── Supabase Storage (wardrobe-images bucket)
  │
  └── AI Features ───── Supabase Edge Functions (Deno)
       ├── analyze-item ────── Claude Sonnet Vision → item tags
       ├── suggest-outfit ──── Claude → outfit recommendation
       ├── purchase-verdict ── Claude → buy/skip/maybe
       ├── match-outfit-photo ─ Claude Vision → wardrobe matching
       ├── wardrobe-gaps ───── Claude → gap analysis
       └── scrape-url ──────── HTTP GET → og:image extraction (TODO)
```

## Key Files

| File | Purpose |
|------|---------|
| `supabase/migrations/001_initial_schema.sql` | All tables, triggers, RLS |
| `supabase/migrations/002_storage_bucket.sql` | Image storage setup |
| `supabase/functions/*/index.ts` | 5 AI edge functions |
| `supabase/functions/_shared/` | Auth, CORS, Claude API helpers |
| `src/lib/supabase.ts` | Supabase client init |
| `src/lib/auth.tsx` | Auth context + Google sign-in |
| `src/lib/api.ts` | All data operations + edge function calls |
| `src/lib/wardrobe-store.tsx` | Wardrobe data context |
| `src/types/index.ts` | TypeScript interfaces |
