# FinTwitTruth

FinTwitTruth is a public scoreboard for FinTwit-style bullish and bearish calls. It grades **one cohort per week**, then watches that same book age against the market.

This repository ships a labeled **demo**. Handles, posts, and prices are fictional. The app does not scrape X or any ranking site.

## Evaluation calendar

The calendar is fixed.

**Collect window:** Wednesday 12:00 PM America/New_York → Sunday 5:00 PM America/New_York.

That window is one cohort. The calls do not change for the rest of the week.

**Three readouts, all at 12:00 PM ET, on that same cohort:**

| Readout | When | What it is |
| --- | --- | --- |
| Initial grade | Monday 12:00 PM ET | First score after the Sunday futures reopen and the Monday morning session |
| Mid-week update | Wednesday 12:00 PM ET | Same calls, rescored |
| Final grade | Friday 12:00 PM ET | Last score on that cohort |

Wednesday noon is also when the **next** collect window opens. That is a new cohort. The Wednesday grade still belongs to the book that closed the previous Sunday.

The reference price is the last official cash close, frozen at the Sunday 5:00 PM ET cutoff. Index futures are shut from Friday 5:00 PM ET until Sunday 6:00 PM ET, so the cutoff ends the book. It is not a new cash print. Later grades measure the move from that same reference.

The in-app methodology page states this again, and the seed includes Monday, Wednesday, and Friday boards for each finished week. The latest demo week has Monday published and Wednesday/Friday still scheduled, so you can see an open book.

## Scoring

Every published grade shows the full **0–100** score, built from:

- **Direction (up to 60)** — the call’s symbol versus the Sunday reference. Bearish calls use the inverse move.
- **Levels (up to 25)** — targets, invalidation, support, and resistance. A busted invalidation caps this part. No level keeps a low floor.
- **Specificity (up to 15)** — naming a ticker, a target, an invalidation, and a band.

**Under 70 is Chud territory.** That line does not move with the field.

**The top 30% of the peer set earns Chad.** On a readout, the peer set is the calls in that cohort. On the leaderboard, it is the accounts. Ties at the cutoff are included. A call can be peer Chad and still sit in Chud territory. Both marks show, and the score stays visible.

A **1–10 badge** sits beside the score. 0–9 maps to 1 (Chud end). 90–100 maps to 10 (Chad end).

Consensus is conviction-weighted (high 3, medium 2, low 1) and compared with SPY’s move from the Sunday reference.

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
| `npm test` | Calendar, scoring, and Chad/Chud checks |
| `npm run db:seed` | Rebuild the demo rows in place |
| `npm run db:reset` | Recreate the SQLite file and seed it |
| `npm run build` | Generate the client, seed SQLite, and build Next.js |
| `npm start` | Serve the production build |

`npm install && npm run build` is enough for a production build. npm runs `prebuild` before `build`: Prisma generates the client, creates `prisma/fintwittruth.db`, and seeds it. Then `next build` prerenders the pages.

`DATABASE_URL` in `.env` is `file:./fintwittruth.db`. The Prisma CLI resolves that path next to `prisma/schema.prisma`. It is not a secret. Copy `.env.example` if you need a fresh env file.

## Demo data

Seed sources:

- `src/lib/demo-data.ts` — fictional accounts, cohorts, posts, and price paths
- `src/lib/dataset.ts` — applies the locked calendar and the scorer
- `prisma/seed.ts` — writes the result with Prisma

Finished cohorts in the demo (`2026-08-24`, `2026-08-31`, `2026-09-07`, `2026-09-14`) each have Monday, Wednesday, and Friday grades on the same calls. `2026-09-07` (“Gap and fade”) is the worked example: Monday’s bulls do not survive Friday. `2026-09-21` is the latest board: Monday is graded, Wednesday and Friday are scheduled.

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

Not investment advice. Past accuracy is not a prediction of future results. Demo accounts and prices are fictional. FinTwitTruth is not affiliated with X or Twitter.
