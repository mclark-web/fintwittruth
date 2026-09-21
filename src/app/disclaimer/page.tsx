import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "FinTwitTruth is a demo scoreboard, not investment advice, and is not affiliated with X or Twitter.",
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-4xl text-ink">Disclaimer</h1>
      <div className="mt-6 space-y-4 text-ink/80">
        <p>
          FinTwitTruth is an accountability scoreboard for a style of short market commentary. It is not
          investment, financial, trading, or tax advice. Nothing on the board is a solicitation to buy or sell
          any security, future, or fund.
        </p>
        <p>
          Past accuracy is not a prediction of future results. A high score, a Chad mark, or a 10 badge describes
          how a past call lined up with a past print under this methodology. It does not mean the next call will
          do the same.
        </p>
        <p>
          The accounts and posts shipped with this app are a fictional demo. They are labeled as demo data. They
          are not quotes from real people. The market prints used to grade them are historical Yahoo Finance
          prices for those evaluation dates: the unadjusted Friday cash close, and the 12:00 PM ET 5-minute open
          when the cash market was open. A closed session repeats the prior official close. Prices that had not
          printed yet are left blank.
        </p>
        <p>
          FinTwitTruth is not affiliated with, endorsed by, or a product of X, Twitter, Yahoo Finance, or any
          exchange, broker, or data vendor. &quot;FinTwit&quot; describes a public style of market commentary. It
          is not a claim of partnership.
        </p>
        <p>
          The grading rules are published on the{" "}
          <Link href="/methodology" className="text-pine underline-offset-4 hover:underline">
            methodology
          </Link>{" "}
          page. If a live feed replaces the demo later, labels and licensing have to change with it. Until then,
          treat the posts as an illustration of the calendar and the score. The prints underneath a published
          grade are the recorded market prices for that date.
        </p>
      </div>
    </div>
  );
}
