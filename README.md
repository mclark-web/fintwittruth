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

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` generates the Prisma client, creates `prisma/dev.db`, and loads the demo seed.

## Build

```bash
npm install
npm run build
npm start
```

The build runs the scoring tests, writes the SQLite demo, and prerenders the pages. No API keys are required.

`DATABASE_URL` in `.env` points at the local SQLite file (`file:./dev.db`, resolved beside the Prisma schema). It is not a secret. Copy `.env.example` if you need a fresh env file.

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
6. For anything beyond this demo, point Prisma at a hosted database. Serverless instances can read a SQLite file created at build time; they are a poor place to persist live writes. The demo build is static on purpose.

`X_BEARER_TOKEN` is unused until the X adapter is implemented.

## Deploy

The demo is a Next.js App Router app aimed at a static deploy:

- Install command: `npm install`
- Build command: `npm run build`
- No required environment secrets

Pages are prerendered from the seeded database, so the scoreboard does not need a live database connection after the build. If you later ingest a real feed, move `DATABASE_URL` to a hosted Prisma database and stop baking grades at build time.

## Legal

Not investment advice. Past accuracy is not a prediction of future results. Demo accounts and prices are fictional. FinTwitTruth is not affiliated with X or Twitter.
