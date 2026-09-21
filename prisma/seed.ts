import path from "path";
import { PrismaClient } from "@prisma/client";
import { buildDataset } from "../src/lib/dataset";

process.env.DATABASE_URL = `file:${path.join(process.cwd(), "prisma", "fintwittruth.db")}`;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const dataset = buildDataset();

  await prisma.grade.deleteMany();
  await prisma.readout.deleteMany();
  await prisma.call.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.account.deleteMany();

  await prisma.account.createMany({
    data: dataset.accounts,
  });

  for (const cohort of dataset.cohorts) {
    await prisma.cohort.create({
      data: {
        id: cohort.id,
        slug: cohort.slug,
        title: cohort.title,
        summary: cohort.summary,
        collectStart: cohort.collectStart,
        collectEnd: cohort.collectEnd,
        mondayAt: cohort.mondayAt,
        wednesdayAt: cohort.wednesdayAt,
        fridayAt: cohort.fridayAt,
        isLatest: cohort.isLatest,
        dataset: cohort.dataset,
        quotes: {
          create: cohort.quotes.map((quote) => ({
            id: quote.id,
            symbol: quote.symbol,
            name: quote.name,
            ref: quote.ref,
            mondayOpen: quote.mondayOpen,
            monday: quote.monday,
            wednesday: quote.wednesday,
            friday: quote.friday,
          })),
        },
        calls: {
          create: cohort.calls.map((call) => ({
            id: call.id,
            accountId: call.accountId,
            postedAt: call.postedAt,
            body: call.body,
            direction: call.direction,
            conviction: call.conviction,
            primary: call.primary,
            sentiment: call.sentiment,
            engagement: call.engagement,
            tickersJson: JSON.stringify(call.tickers),
            levelsJson: JSON.stringify(call.levels),
            explicit: call.explicit,
          })),
        },
        readouts: {
          create: cohort.readouts.map((readout) => ({
            id: readout.id,
            kind: readout.kind,
            status: readout.status,
            consensusBullish: readout.consensusBullish,
            consensusBearish: readout.consensusBearish,
            consensusDirection: readout.consensusDirection,
            realizedDirection: readout.realizedDirection,
            benchmarkSymbol: readout.benchmarkSymbol,
            benchmarkMovePct: readout.benchmarkMovePct,
            chadCutoff: readout.chadCutoff,
            narrative: readout.narrative,
          })),
        },
      },
    });

    if (cohort.grades.length > 0) {
      await prisma.grade.createMany({
        data: cohort.grades,
      });
    }
  }

  const calls = await prisma.call.count();
  const grades = await prisma.grade.count();
  console.log(`Seeded ${dataset.cohorts.length} demo cohorts, ${calls} calls, ${grades} grades.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
