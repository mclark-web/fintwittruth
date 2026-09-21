import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Draft disclaimer: FinTwitTruth is not investment advice, not an adviser, and does not sell grades.",
};

export default function DisclaimerPage() {
  return (
    <LegalPage
      kicker="Disclaimer"
      title="Read this before you treat a score as a reason to trade."
      lede="FinTwitTruth is an accountability scoreboard for a style of short, public market commentary. A grade describes a past post against a past print. It is not a recommendation."
    >
      <LegalSection id="advice" title="Not investment advice">
        <p>
          Nothing on FinTwitTruth is investment, financial, trading, legal, or tax advice. Nothing on the board
          is a solicitation or an offer to buy or sell a security, future, option, or fund. A score, a badge, a
          consensus line, or a leaderboard rank is a description of the past under the published rules. It is
          not a view on what you should do next.
        </p>
        <p>
          Past accuracy is not a prediction of future results. A high score on a finished week does not mean
          the next call from that handle will work.
        </p>
      </LegalSection>

      <LegalSection id="ria" title="Not an adviser">
        <p>
          FinTwitTruth is not a registered investment adviser, not a broker-dealer, and not a commodity trading
          advisor. It does not manage money, custody assets, or tailor a recommendation to any person. Reading
          the board does not create an advisory relationship.
        </p>
      </LegalSection>

      <LegalSection id="sale" title="Grades are not for sale">
        <p>
          The board is free to read. FinTwitTruth does not sell grades, alerts, subscriptions, or trading
          signals. A payment, if one is accepted later, is a donation. It does not buy a score, a better rank,
          earlier access, or a signal. See{" "}
          <Link href="/donate" className="text-pine underline-offset-4 hover:underline">
            Donate
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="marks" title="Chad and Chud are opinions">
        <p>
          Chad means Accuracy &amp; Discipline. Chud means Uncertainty &amp; Doubt. Together they are the CH
          factor: opinion labels inside this methodology. Under 70 out of 100 is Chud territory. The top 30% of
          a peer set earns Chad. Both can be true at once. The words judge how a past call lined up with a past
          print. They are not a finding about a person’s character, competence, or fitness, and they are not
          advice.
        </p>
      </LegalSection>

      <LegalSection id="calendar" title="One cohort, three readouts">
        <p>
          The calendar is fixed. Posts are collected from Wednesday at 12:00 PM America/New_York through Sunday
          at 5:00 PM America/New_York. That same cohort is graded on Monday, Wednesday, and Friday, each time
          at 12:00 PM America/New_York. Wednesday noon also opens the next collect window. That new window is a
          different cohort. The Wednesday grade still belongs to the book that closed the previous Sunday.
        </p>
        <p>
          The rules are written out on the{" "}
          <Link href="/methodology" className="text-pine underline-offset-4 hover:underline">
            methodology
          </Link>{" "}
          page.
        </p>
      </LegalSection>

      <LegalSection id="prints" title="Market outcomes are real prints">
        <p>
          Grades use recorded market prices for the evaluation dates. The Sunday reference is the unadjusted
          Friday regular-session close. Each noon grade is the open of the 12:00 PM ET five-minute bar when the
          cash market was open. A closed session repeats the prior official close. A date that has not printed
          is left blank. FinTwitTruth does not invent a price path to make a call look right or wrong.
        </p>
        <p>
          Those prints come from a public market-data source named on the methodology page. FinTwitTruth is not
          affiliated with that source, with any exchange, or with any broker.
        </p>
      </LegalSection>

      <LegalSection id="demo" title="The demo is labeled">
        <p>
          The accounts and posts shipped with this deployment are a demo. They are labeled as demo data. They
          are not quotes from real people. The market prints underneath a published grade are the recorded
          prices for that date. If a live feed of public posts replaces the demo later, the demo label has to
          come off only after that change is real.
        </p>
      </LegalSection>

      <LegalSection id="public" title="Public posts only">
        <p>
          FinTwitTruth is about posts that are already public. It does not ask for private messages, group
          chats, paid rooms, or anything that was not published to a public audience. A grade is not a claim
          that FinTwitTruth was the intended reader.
        </p>
      </LegalSection>

      <LegalSection id="affiliation" title="No affiliation with X or Twitter">
        <p>
          FinTwitTruth is not affiliated with, endorsed by, or a product of X or Twitter. “FinTwit” names a
          public style of market commentary. It is not a claim of partnership. The app does not scrape X.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="You can lose money if you trade">
        <p>
          Markets move. Data can be late or wrong. A grade can be revised when a print or a post was recorded
          incorrectly. To the extent the law allows, FinTwitTruth is not liable for trading losses or for
          decisions you make from the board. The fuller limitation is in the{" "}
          <Link href="/terms" className="text-pine underline-offset-4 hover:underline">
            terms
          </Link>
          . This paragraph is draft language for counsel.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
