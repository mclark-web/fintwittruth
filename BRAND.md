# GradedCalls brand guidelines

Updated Thu Sep 24, 2026. This covers all four boards: Hub/Sports (charoof.vercel.app), Analysts (bank-troof.vercel.app), FinTwit (fintwittruth.vercel.app) and GCBot (charoofbot.vercel.app). Everything below is locked. A deviation is an automatic MUST-FIX in design review.

## 1. Visual direction
Scientific, lab / journal / metrology. It should read as trust and transparency, not flashy sports or fintech neon. Name: GradedCalls. The bot product is GCBot. "Chad", "Chud" and "Charoof" never appear in the UI (visible text, titles, meta, og tags, alt text).

## 2. Backgrounds: dark everywhere
- The page is a charcoal gradient. `html` has its own solid dark `background-color` (#0a0b0d to #0b0c0e), so overscroll never flashes white. The dark background covers the full document height.
- Every surface is dark: cards, panels, tables, forms, inputs, selects, textareas, modals and dialogs, menus, tooltips, code and pre blocks, and chat bubbles.
- No white, cream or light-grey surface anywhere. Any effective surface lighter than #3a3a3a (relative luminance above about 0.042) is a MUST-FIX, and that includes semi-transparent white composited over charcoal. The only exceptions are text, the grade pills, the orange liquid and its bloom, orange primary CTAs, and glass highlights.

## 3. GC tubes and the GC Scale
- The label is exactly "GC Scale" (GC = Grade Calibration). Don't add a qualifier inside the label ("GC Scale · Amplifier"). Put context in a heading above it instead. Don't redefine the letters (for example, "G = Graded, C = Calibrated").
- Boards use horizontal GC tubes. The GC Scale page uses vertical vials.
- The liquid is neon orange #eb6505 with a bloom and a pale meniscus, inside glass with a highlight. Liquid is always orange; no grey or other colours inside a tube. If a breakdown is needed, use orange-family bands only (#ee9a44, #eb6505, #d15202, #7a3402).
- A graded 0% shows an empty glass with the EXIT LIQUIDITY pill.

## 4. Legibility: text never sits on the glow (new 2026-09-24)
- The bloom and halo stay on the glass. Crop them off above the label row (`.gc-meta`: the GC Scale label, % readout and grade pill), for example with `clip-path` on `.gc-bloom`. Label rows sit on charcoal (about #14171e).
- Every grade pill, GC Scale label and % readout measures at least 4.5:1 against what is actually rendered behind it, measured by pixel-sampling with the text hidden. Large text (24px and up, or 18.66px bold) needs at least 3:1.
- The STRONG pill carries its own charcoal backing, so it stays readable on any surface: `background: linear-gradient(rgba(235,101,5,.12), rgba(235,101,5,.12)), #14171e`.
- The same 4.5:1 rule applies to any text on orange, such as numbers in orange graph nodes. Use dark text (#1a1005) on #eb6505.

## 5. Grade pills
All four grades are uppercase and use the same pill type (same size, radius and line-height everywhere, including tables, with `line-height: 18px` set on the pill).
| Grade | Text | Fill | Border |
|---|---|---|---|
| STRONG | #eb6505 | rgba(235,101,5,.12) over #14171e | rgba(235,101,5,.35) |
| WEAK | #c9c9cf | rgba(154,154,163,.12) | rgba(154,154,163,.35) |
| PROVISIONAL | #c9c9cf | rgba(154,154,163,.12) | rgba(154,154,163,.35), dashed |
| EXIT LIQUIDITY | #9a9aa3 | transparent | rgba(154,154,163,.35) |

- EXIT LIQUIDITY means a graded 0% only. Horizons that haven't been graded yet read "Not graded yet" in #9a9aa3, with the empty glass and aria-label "GC Scale, not graded yet". Never show them as EXIT LIQUIDITY or 0%.
- Nothing that isn't a grade (tags such as "Clone", "New <30d", categories) may look like a grade pill. Give those a neutral outline: #c9c9cf text, transparent fill, a rgba(154,154,163,.35) border, and mixed case.

## 6. Colour meaning
- Green #4CC38A and rose #F26D7D only ever mean right or wrong: readout bubbles, tape, with/against the call, HIT/MISS, and Sports WIN/LOSS pills with a check or cross.
- These are neutral: direction tags (BULLISH/BEARISH), price moves, stats, recommendation verbs, and the scoreboard ("Market print · not a grade").
- Muted text is #9a9aa3.

## 7. Type, touch and layout
- No text under 12px.
- Every interactive element has a hit area of at least 44×44, and expanded hit areas don't overlap their neighbours. Inline text links keep the normal paragraph line-height, with the 44px area coming from `::before`.
- No horizontal overflow at 390, 820 or 1440. Tables and leaderboards fit their width, and at 390 they stack as cards instead of scrolling sideways.
- Menus and dropdowns are never clipped by a parent with `overflow: hidden`.

## 8. Review gate (what design review checks before anything ships)
Every route is checked at 390, 820 and 1440 with full-page screenshots. The review covers:
- the full-page background (html, body and elementFromPoint every 200px at left, centre and right)
- surface checks
- the pill, label and readout contrast pixel-sampled against the rendered background
- locked tokens
- colour scoping
- the 12px minimum
- 44px tap targets and hit-area overlap
- overflow
- banned words

The result is PASS or a numbered MUST-FIX list.
