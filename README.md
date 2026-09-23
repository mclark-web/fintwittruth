# GradedCalls FinTwit

GradedCalls FinTwit is the FinTwit vertical under GradedCalls. It is a public scoreboard for FinTwit-style bullish and bearish calls. It grades **one cohort per week**, then watches that same book age against the market.

GradedCalls Analysts and GradedCalls Sports are sibling verticals. They are not this board. Grades describe a past post against a recorded print. They are not trade signals, and they are not for sale.

The npm package and the SQLite file stay named `fintwittruth`. That is the technical package name, not the public brand.

This repository ships a labeled demo book and a small verified book. Demo handles and posts are fictional. The latest board quotes two public posts and links each source. The market prints used to grade both books are real historical Yahoo Finance prices for those evaluation dates. The app does not scrape X or any ranking site, and it does not invent a price when a session is missing.

## Evaluation calendar

The calendar is fixed.

**Collect window:** Wednesday 12:00 PM America/New_York → Sunday 5:00 PM America/New_York.

That window is one cohort. The calls do not change for the rest of the week.

**Four readouts on that same cohort:**

| Readout | When | What it is |
| --- | --- | --- |
| Monday gap | Monday 9:30 AM ET | Friday regular-session close to the regular-session open |
| Weekend-noise grade | Monday 12:00 PM ET | Primary score against the noon print |
| Mid-week update | Wednesday 12:00 PM ET | Same calls, rescored |
| Final grade | Friday 12:00 PM ET | Last score on that cohort |

Wednesday noon is also when the **next** collect window opens. That is a new cohort. The Wednesday grade still belongs to the book that closed the previous Sunday.

Each cohort has two inclusion buckets: a named watchlist and a viral doom / hype spike set. Both feed the weekly board. Leaderboards are ranked inside each bucket.

The weekend reference is the **prior Friday regular-session close** for SPY, QQQ, and DIA, plus Friday's VIX close. Yahoo `adjclose` is stored beside it for audit and is **not** used for gap or noon moves, because the daily open and the 12:00 PM ET five-minute open are not dividend-adjusted. Comparing retrospectively rewritten adjclose to those prints invents a false gap. There is no invented Sunday cash print. Monday's gap uses the regular-session daily open. Monday, Wednesday, and Friday noon grades use the **open** of the 5-minute bar stamped 12:00 PM America/New_York. A closed session stays blank. Monday, September 7, 2026 was Labor Day, so that gap and noon stay ungraded. A Yahoo VIX daily bar on that holiday is ignored. A date with no print yet stays null. The series is committed in `src/lib/market-history.json` (chart API `query1.finance.yahoo.com`). `src/lib/quotes.ts` throws if a required print is missing.

The in-app methodology page states this again. The latest verified week has the Monday gap, Monday noon, and Wednesday noon published. Friday is still scheduled. The fictional open week uses those same prints and is labeled demo.

## Boards

Founder choice: hide pending until settle. The home tape, weekly rankings, leaderboards, and account scorecards list only calls that already have a settled grade. A readout is settled when its status is `published` (Monday gap, Monday noon, Wednesday noon, or Friday noon). The scorer writes grade rows at that gate and leaves a scheduled horizon empty. The board layer drops those empty horizons from the primary rankings.

Hit rate, STRONG rate, and WEAK rate are computed from settled grades only. A handle with no settled grade is not ranked. Hit rate is the share of settled grades where the tape moved with the call by at least 0.08%.

Calls still waiting on a tape are listed at `/pending` and `/weeks/[slug]/pending`. Those pages are linked from the boards and the footer. They are not in the primary nav and they are not mixed into the rankings. A cohort with nothing graded yet shows a short empty state instead of a table of blanks.

## Scoring

Every published grade shows the full **0–100** score, built from:

- **Direction (up to 50)** — equal-weight move of SPY, QQQ, and DIA from Friday's regular-session close. Bearish calls use the inverse.
- **Levels (up to 20)** — targets, invalidation, support, and resistance on the call's own symbol. A busted invalidation caps this part at 2. No level keeps a floor of 4.
- **Specificity (up to 15)** — naming a ticker, a target, an invalidation, and a band.
- **VIX (15)** — panic and selloff calls want VIX higher. Melt-up calls want VIX lower. The move is Friday's VIX close to the VIX print at the same stamp.

**GC Scale.** The horizontal tube fill is the 0–100 score. **STRONG** is the top 30% of the peer set **and** a score of at least 70. **WEAK** is any score under 70. **PROVISIONAL** is 70 or more outside that cut. **EXIT LIQUIDITY** is a 0% fill: an empty glass when no graded horizon has closed, or when the score is 0. Under 70 is never STRONG. On a readout, the peer set is every call on that weekly board. On a leaderboard, it is the accounts inside one bucket. Ties at the STRONG cutoff are included.

Monday noon is the primary weekend-noise grade. The Monday gap is the open. Wednesday and Friday age that same cohort.

The **Weekend Noise Index** is the share of the cohort tagged panic versus melt-up, shown next to the Monday equity return from Friday's close and the VIX change. It is descriptive. It is not a signal.

A **1–10 badge** sits beside the score. 0–9 maps to 1. 90–100 maps to 10.

Consensus is conviction-weighted (high 3, medium 2, low 1) and compared with the equal-weight equity tape.

## Run

Requires Node.js 22.

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` runs `predev` first, which creates `prisma/fintwittruth.db` and seeds it when the file is missing. No API keys are required.

| Command | What it does |
| --- | --- |
| `npm test` | Calendar, scoring, GC Scale pills, and the graded-only board filter |
| `npm run db:seed` | Rebuild the demo rows in place |
| `npm run db:reset` | Recreate the SQLite file and seed it |
| `npm run build` | Generate the client, seed SQLite, and build Next.js |
| `npm start` | Serve the production build |

`npm install && npm run build` is enough for a production build. npm runs `prebuild` before `build`: Prisma generates the client, creates `prisma/fintwittruth.db`, and seeds it. Then `next build` prerenders the pages. A schema change on an existing demo file needs `npm run db:reset` first.

`DATABASE_URL` in `.env` is `file:./fintwittruth.db`. The Prisma CLI resolves that path next to `prisma/schema.prisma`. It is not a secret. Copy `.env.example` if you need a fresh env file.

## Demo data

Seed sources:

- `src/lib/market-history.json` — recorded Yahoo Finance Friday session closes, adjclose (audit), regular-session opens, and 12:00 PM ET prints
- `src/lib/quotes.ts` — reads that file and refuses a missing print
- `src/lib/live-calls.json` — verified public posts for the latest readout week, each with a source URL
- `src/lib/demo-data.ts` — fictional accounts and posts in a watchlist bucket and a viral bucket. Stated levels are offsets from the real Friday reference, not a made-up spot
- `src/lib/dataset.ts` — applies the locked calendar and the scorer to both books
- `prisma/seed.ts` — writes the result with Prisma

Finished demo cohorts (`2026-08-24`, `2026-08-31`, `2026-09-07`, `2026-09-14`) each have Monday, Wednesday, and Friday grades on the same calls. `2026-09-07` is the worked example because Monday was Labor Day: the grade uses Friday's close, and Wednesday and Friday use real noon prints. `demo-2026-09-21` keeps the fictional doom and melt-up posts for the open week, graded on the real Monday prints, off the live board. `2026-09-21` is the verified book: two public posts, with Monday and Wednesday noon prints in. Friday stays scheduled because that session had not printed at fetch time. Conviction weights stay high 3, medium 2, low 1. Every published grade uses the equal-weight SPY, QQQ, and DIA tape plus VIX.

Cohort slugs are the readout Monday (`YYYY-MM-DD`).

## Replace the seed with a real feed

Keep the calendar and the scorer. Swap the inputs.

1. Implement `fetchPosts` in `src/lib/feeds/x-api-feed.ts` using a **licensed** X API or approved firehose. Page only the collect window (Wednesday 12:00 PM ET through Sunday 5:00 PM ET). Do not scrape the website.
2. Implement `fetchPrints` in `src/lib/feeds/licensed-market-feed.ts` for official reference and noon prices.
3. Set `FEED_PROVIDER=x-api` and `MARKET_DATA_PROVIDER=licensed-bars`. `src/lib/feeds/index.ts` selects the adapters. The demo adapters stay in place until those variables are set.
4. Map posts into the cohort / call / quote tables (see `prisma/schema.prisma` and `buildDataset` in `src/lib/dataset.ts` for the shape). Run grading with `scoreCall` and `rankPeers` from `src/lib/scoring.ts` at each readout: Monday, Wednesday, and Friday at 12:00 PM ET.
5. Set `NEXT_PUBLIC_DATA_MODE=live` only after demo rows are gone, so the demo banner comes off. Keep the disclaimer. Past scores are still not a forecast.
6. Postgres, when you outgrow the file: point `DATABASE_URL` at a `postgresql://` URL, change the Prisma datasource provider to `postgresql`, and run `prisma db push`. `src/lib/prisma.ts` already uses a Postgres URL when it sees one, and otherwise opens the SQLite file. Grades still have to be written by your feed job. This demo does not call a market-data vendor.

`X_BEARER_TOKEN` is unused until the X adapter is implemented.

## Deploy on Vercel

Import the GitHub repository. No environment variables and no secrets. The demo database is created during the build.

Use these settings. The defaults already match. Do not override the build command.

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | repository root |
| Node.js version | 22.x (`engines` in `package.json`) |
| Install command | `npm install` (leave the default) |
| Build command | `npm run build` (leave the default) |
| Output directory | leave the Next.js default |
| Environment variables | none |

`npm run build` runs `prebuild` first: Prisma generates the client (including the Vercel runtime engine), creates `prisma/fintwittruth.db`, and seeds it. That file is traced into the server bundle. Pages are prerendered from it. On Vercel the filesystem is read-only except `/tmp`, so a server instance copies the seed to `/tmp/fintwittruth.db` before reading it.

Do not change the build command to bare `next build`. That skips the seed and the routes have no database.

Do not set `DATABASE_URL` in the project settings for the demo. Do not set `NODE_ENV` yourself. A `postgresql://` `DATABASE_URL` is only for a later hosted database, and it also requires changing the Prisma datasource provider to `postgresql`.

This deploy is a read-only demo. A writable live feed should use Postgres rather than SQLite on serverless disk.

## Legal

Draft pages, labeled “Draft for legal review” until counsel signs off:

- `/disclaimer` — not investment advice, not an adviser, grades not for sale
- `/terms` — public posts, the locked calendar, real prints, liability limitation
- `/donate` — donation-only; a gift is not a signal and is not tax-deductible unless a later notice says so

Not investment advice. Past accuracy is not a prediction of future results. Demo accounts and posts are fictional. Verified cards quote public posts and link the source. The prints used to grade them are historical Yahoo Finance prices for the evaluation dates. GradedCalls FinTwit is not affiliated with X, Twitter, or Yahoo Finance. The corrections address on those pages is a placeholder.
