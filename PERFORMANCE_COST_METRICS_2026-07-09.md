# Sakhi — Performance & Cost Metrics (2026-07-09)

Measured against production edge functions with the test account (27-item wardrobe),
3 timed runs per function, all 15 calls successful. Costs estimated from reconstructed
prompt sizes (chars÷4, ~2,000 vision tokens per compressed photo) at
Sonnet 4.6 $3/$15 and Haiku 4.5 $1/$5 per million tokens.

## Latency (seconds, 3 runs)

| Feature | Model | min | avg | max |
|---|---|---|---|---|
| Analyze item (add photo) | claude-haiku-4-5 | 3.3 | **3.7** | 4.4 |
| Match outfit photo | claude-sonnet-4-6 | 3.4 | **4.5** | 6.0 |
| Suggest outfit | claude-sonnet-4-6 | 7.2 | **7.4** | 7.7 |
| Purchase verdict | claude-sonnet-4-6 | 7.1 | **7.6** | 8.0 |
| Wardrobe gaps | claude-sonnet-4-6 | 22.5 | **23.1** | 23.8 |

## Cost per call (estimated)

| Feature | ~Input tokens | ~Output tokens | Cost/call (USD) |
|---|---|---|---|
| Analyze item | 2,550 (incl. image) | 145 | ~$0.003 |
| Purchase verdict | 1,550 | 160 | ~$0.007 |
| Match outfit photo | 3,150 (incl. image) | 90 | ~$0.011 |
| Suggest outfit | 2,250 | 400 | ~$0.013 (×2 when violation-retry fires — rare) |
| Wardrobe gaps | 1,700 | 825 | ~$0.017 |

System prompt sizes at measurement time: suggest-outfit 1,280 tok, match-outfit-photo 634,
purchase-verdict 604, analyze-item 528, wardrobe-gaps 522. Wardrobe pipe list: ~700 tok
for 27 items (scales linearly with wardrobe size).

## Monthly projection

Heavy personal use (per week: 5 suggestions, 3 verdicts, 2 photo logs, 5 item adds,
1 gaps check) ≈ **$0.60/month** — roughly 16× headroom under the $10 Anthropic spend cap,
or ~15 users at this usage level before per-user rate limits (backlogged) matter.

## Tier 1 latency fixes (shipped later the same day)

Measured numbers above are the pre-fix baseline. What changed:

| Feature | Before (felt) | After (felt) | How |
|---|---|---|---|
| Wardrobe gaps, repeat visits | 23s spinner | Instant | Last result shows immediately from a local cache; the ~23s refresh runs behind a small "taking a fresh look" pill and swaps in when ready. First-ever visit unchanged. |
| Add item analysis | ~4s after tapping Analyze | Usually under 1s | Analysis starts the moment the photo is picked, while the user is on the preview. The Analyze tap awaits an already-running (often finished) call. Same tokens, zero extra cost. |
| Log outfit save | 2 to 5s on mobile upload | Sub-second | Outfit row saves first; the selfie uploads in the background and attaches itself via an image_url patch. Failure mode: outfit logged, photo missing, no data loss. |
| Purchase verdict | 7.6s | ~5 to 6s expected | Tighter output budgets in the prompt (reason under 30 words, 2 evidence points under 12 words). Needs the purchase-verdict.ts paste; re-measure after. |

Still open (Tier 2/3, see PLAN.md backlog): precompute "Today's look" daily suggestion, precompute gaps on wardrobe change (also the brand-collab foundation), SSE streaming for on-demand calls. After those, the only cold waits left are first-run gaps and a cold suggest.

## Findings

- **Wardrobe-gaps is output-bound**: ~825 output tokens at Sonnet generation speed *is*
  the 23s — its input is no larger than the others'. It is also the most expensive call.
  Proportionate fixes when wanted: cap at 3–4 cards with 2-sentence bodies (≈halves time
  and cost), and/or the backlogged streaming work so cards render progressively.
- Photo features are correctly on the cheap/fast path (Haiku for analysis; client-side
  compression keeps vision tokens ~2k instead of ~5k+ for raw phone photos).
- Latencies are consistent across runs — no retry storms; the suggest-outfit
  hallucination/violation retry did not fire in any measured run.
- Incidental verification during measurement: raw storage URLs return an error
  (bucket private), only signed URLs serve images — photo privacy working as designed.
