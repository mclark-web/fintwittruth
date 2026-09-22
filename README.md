# Charoof FinTwit

Charoof FinTwit is the FinTwit vertical under Charoof. It is a public scoreboard for FinTwit-style bullish and bearish calls. It grades **one cohort per week**, then watches that same book age against the market.

Charoof Analysts and Charoof Sports are sibling verticals. They are not this board. Grades describe a past post against a recorded print. They are not trade signals, and they are not for sale.

The npm package and the SQLite file stay named `fintwittruth`. That is the technical package name, not the public brand.

The live board grades verified public posts. Each one has a source URL and a timestamp inside the Wednesday-noon to Sunday-5pm ET window. Fictional handles and wording are labeled **DEMO** and stay on `/demo`. They are not ranked with the live book. The app does not scrape X, does not need a paid X API, and does not invent a tweet, a handle, or a price. A missing print is left blank.

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

The weekend reference is the **prior Friday regular-session close** for SPY, QQQ, and DIA, plus Friday's VIX close. Yahoo `adjclose` is stored beside it for audit and is **not** used for gap or noon moves, because the daily open and the 12:00 PM ET five-minute open are not dividend-adjusted. Comparing retrospectively rewritten adjclose to those prints invents a false gap. There is no invented Sunday cash print. Monday's gap uses the regular-session daily open. Monday, Wednesday, and Friday noon grades use the **open** of the 5-minute bar stamped 12:00 PM America/New_York. A closed session stays blank. Monday, September 7, 2026 was Labor Day, so that gap and noon stay ungraded. A Yahoo VIX daily bar on that holiday is ignored. A date with no print yet stays null. The series is committed in `src/lib/market-history.json` (chart API `query1.finance.yahoo.com`). `src/lib/quotes.ts` throws if a required print is missing. `npm run accuracy` fetches the same Yahoo chart endpoint and fails if a price on the live board disagrees with the print for that session.

The in-app methodology page states this again. The latest demo week has the Monday gap and Monday noon published, with Wednesday and Friday still scheduled.

## Boards

Founder choice: hide pending until settle. The home tape, weekly rankings, leaderboards, and account scorecards list only calls that already have a settled grade. A readout is settled when its status is `published` (Monday gap, Monday noon, Wednesday noon, or Friday noon). The scorer writes grade rows at that gate and leaves a scheduled horizon empty. The board layer drops those empty horizons from the primary rankings.

Hit rate, Chad rate, and Chud rate are computed from settled grades only. A handle with no settled grade is not ranked. Hit rate is the share of settled grades where the tape moved with the call by at least 0.08%.

Calls still waiting on a tape are listed at `/pending` and `/weeks/[slug]/pending`. Those pages are linked from the boards and the footer. They are not in the primary nav and they are not mixed into the rankings. A cohort with nothing graded yet shows a short empty state instead of a table of blanks.

## Scoring

Every published grade shows the full **0–100** score, built from:

- **Direction (up to 50)** — equal-weight move of SPY, QQQ, and DIA from Friday's regular-session close. Bearish calls use the inverse.
- **Levels (up to 20)** — targets, invalidation, support, and resistance on the call's own symbol. A busted invalidation caps this part at 2. No level keeps a floor of 4.
- **Specificity (up to 15)** — naming a ticker, a target, an invalidation, and a band.
- **VIX (15)** — panic and selloff calls want VIX higher. Melt-up calls want VIX lower. The move is Friday's VIX close to the VIX print at the same stamp.

**Charoof CH factor.** Chad means Accuracy & Discipline: the top 30% of the peer set **and** a score of at least 70. Chud means Uncertainty & Doubt: any score under 70. Under 70 is never Chad. On a readout, the peer set is every call on that weekly board. On a leaderboard, it is the accounts inside one bucket. Ties at the Chad cutoff are included.

Monday noon is the primary weekend-noise grade. The Monday gap is the open. Wednesday and Friday age that same cohort.

The **Weekend Noise Index** is the share of the cohort tagged panic versus melt-up, shown next to the Monday equity return from Friday's close and the VIX change. It is descriptive. It is not a signal.

A **1–10 badge** sits beside the score. 0–9 maps to 1 (Chud end). 90–100 maps to 10 (Chad end).

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
| `npm test` | Calendar, scoring, the green-Monday crash check, ingest refusals, Yahoo bar parsing, and the graded-only board filter |
| `npm run ingest -- --cohort=YYYY-MM-DD --file=paste.txt` | Paste a public post into `src/lib/live-calls.json` after the source page is checked |
| `npm run accuracy` | Compare the live board's Friday close, Monday open, and Monday noon with Yahoo. Exit 1 on a mismatch |
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
- `src/lib/demo-data.ts` — fictional DEMO accounts and posts. Stated levels are offsets from the real Friday reference, not a made-up spot
- `src/lib/live-calls.json` — verified public posts for the live board. Each row has a source URL, a timestamp, and a verification note
- `src/lib/dataset.ts` — applies the locked calendar and the scorer
- `prisma/seed.ts` — writes the result with Prisma

DEMO cohorts (`2026-08-24`, `2026-08-31`, `2026-09-07`, `2026-09-14`, `demo-2026-09-21`) use fictional posts. `2026-09-07` is the worked example because Monday was Labor Day: the grade uses Friday's close, and Wednesday and Friday use real noon prints. The live board is `2026-09-21`: verified posts, Monday's open and noon in, Wednesday and Friday still scheduled. The fictional copy of that week is `demo-2026-09-21` and is not the live board.

Cohort slugs are the readout Monday (`YYYY-MM-DD`).

## Operator ingest

No paid X API. Paste a public post, check it against the source page, and store it in `src/lib/live-calls.json`. The seed reads that file. A call without a source URL, a timestamp, or a direction is refused. A post outside Wednesday 12:00 PM ET through Sunday 5:00 PM ET is refused. The script also refuses when the pasted sentences are not on the source page.

```text
source: https://example.com/the-post
handle: someone
name: Display Name
posted: 2026-09-20T04:52:42.466Z
direction: bearish
primary: SPY
tickers: SPX
---
The exact sentences from the public post.
```

A status URL works the same way. The handle is read from `x.com/{handle}/status/...`. The timestamp and the post text still have to be in the paste.

```bash
npm run ingest -- --cohort=2026-09-21 --file=paste.txt
npm run db:reset
npm run accuracy
```

`--cohort` is the readout Monday (`YYYY-MM-DD`). After a new call lands, rebuild the database before trusting the board. `npm run accuracy` is the check that the cents on the live tape match Yahoo for Friday's close, Monday's open, and the 12:00 PM ET bar. It fails if a print is missing or if the page would show a different number. Wednesday and Friday stay blank until those noon bars exist.

The committed live book for the week of September 21, 2026 is two public posts, not a full FinTwit scrape:

- The Pulse Of The Market, bearish, September 20, 2026: [Weekly Market Review (9/19/2026)](https://smtraderca.substack.com/p/weekly-market-review-9192026)
- Piggo's Trading Desk, bearish, September 17, 2026: [Tomorrow's Market Picks](https://piggostradingdesk.substack.com/p/tomorrows-market-picks-september-905)

Monday, September 21 was green. Those bearish calls are graded and are not Chad. DEMO fiction for the same week is at `/weeks/demo-2026-09-21`.

## Replace the seed with a real feed

Keep the calendar and the scorer. The paste file is the feed until a licensed source exists.

1. Keep adding posts with `npm run ingest`. Do not scrape X.
2. `src/lib/yahoo.ts` reads the Yahoo chart API for the accuracy guard. Grading still uses the committed series in `src/lib/market-history.json`. Refresh that file only from the chart API, then rerun `npm run accuracy`.
3. `src/lib/feeds/x-api-feed.ts` stays unimplemented. Do not set `FEED_PROVIDER=x-api` until a licensed adapter exists.
4. Map posts into the cohort / call / quote tables (see `prisma/schema.prisma` and `buildDataset` in `src/lib/dataset.ts` for the shape). Run grading with `scoreCall` and `rankPeers` from `src/lib/scoring.ts` at each readout: Monday, Wednesday, and Friday at 12:00 PM ET.
5. Leave `NEXT_PUBLIC_DATA_MODE` unset. The live board and the DEMO board are separate in the data, not by that flag. Past scores are still not a forecast.
6. Postgres, when you outgrow the file: point `DATABASE_URL` at a `postgresql://` URL, change the Prisma datasource provider to `postgresql`, and run `prisma db push`. `src/lib/prisma.ts` already uses a Postgres URL when it sees one, and otherwise opens the SQLite file. Grades still have to be written by your feed job.

`X_BEARER_TOKEN` is unused.

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

Not investment advice. Past accuracy is not a prediction of future results. Demo accounts and posts are fictional. The prints used to grade them are historical Yahoo Finance prices for the evaluation dates. Charoof FinTwit is not affiliated with X, Twitter, or Yahoo Finance. The corrections address on those pages is a placeholder.
