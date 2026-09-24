import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Draft disclaimer: GradedCalls FinTwit is not investment advice, not an adviser, and does not sell grades.",
};

export default function DisclaimerPage() {
  return (
    <LegalPage
      kicker="Disclaimer"
      title="Read this before you treat a score as a reason to trade."
      lede="GradedCalls FinTwit is an accountability scoreboard for a style of short, public market commentary. A grade describes a past post against a past print. It is not a recommendation."
    >
      <LegalSection id="advice" title="Not investment advice">
        <p>
          Nothing on GradedCalls FinTwit is investment, financial, trading, legal, or tax advice. Nothing on the board
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
          GradedCalls FinTwit is not a registered investment adviser, not a broker-dealer, and not a commodity trading
          advisor. It does not manage money, custody assets, or tailor a recommendation to any person. Reading
          the board does not create an advisory relationship.
        </p>
      </LegalSection>

      <LegalSection id="sale" title="Grades are not for sale">
        <p>
          The board is free to read. GradedCalls FinTwit does not sell grades, alerts, subscriptions, or trading
          signals. A payment, if one is accepted later, is a donation. It does not buy a score, a better rank,
          earlier access, or a signal. See{" "}
          <Link href="/donate" className="text-pine underline-offset-4 hover:underline">
            Donate
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="marks" title="Grade pills are opinions">
        <p>
          STRONG, WEAK, PROVISIONAL, and EXIT LIQUIDITY are GC Scale labels. STRONG is a score of 70 or
          more. WEAK is under 40. PROVISIONAL is 40 or more and under 70. EXIT LIQUIDITY is a 0% fill, when
          no graded horizon has closed or the score is 0. The words judge how a past call lined up with a past
          print. They are not a finding about a person’s character, competence, or fitness, and they are not advice.
        </p>
      </LegalSection>

      <LegalSection id="calendar" title="One cohort, four readouts">
        <p>
          The calendar is fixed. Posts are collected from Wednesday at 12:00 PM America/New_York through Sunday
          at 5:00 PM America/New_York. That same cohort is graded on the Monday regular-session open, then at
          12:00 PM America/New_York on Monday, Wednesday, and Friday. Wednesday noon also opens the next collect
          window. That new window is a different cohort. The Wednesday grade still belongs to the book that
          closed the previous Sunday.
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
          Grades use recorded market prices for the evaluation dates. The weekend reference is the prior Friday
          regular-session close for SPY, QQQ, and DIA, and Friday&apos;s VIX close. Monday&apos;s gap uses the
          regular-session open. Noon grades use the open of the 12:00 PM ET five-minute bar. A closed session
          stays blank. A date that has not printed is left blank. GradedCalls FinTwit does not invent a price path to
          make a call look right or wrong, and it does not turn a grade into a buy or sell instruction.
        </p>
        <p>
          Those prints come from a public market-data source named on the methodology page. GradedCalls FinTwit is not
          affiliated with that source, with any exchange, or with any broker.
        </p>
      </LegalSection>

      <LegalSection id="demo" title="The demo is labeled">
        <p>
          Fictional accounts and posts are labeled demo and kept on the demo weeks. They are not quotes from real
          people. The latest board quotes verified public posts and links each source. The market prints
          underneath a published grade are the recorded prices for that date. A missing print stays blank.
        </p>
      </LegalSection>

      <LegalSection id="public" title="Public posts only">
        <p>
          GradedCalls FinTwit is about posts that are already public. It does not ask for private messages, group
          chats, paid rooms, or anything that was not published to a public audience. A grade is not a claim
          that GradedCalls FinTwit was the intended reader.
        </p>
      </LegalSection>

      <LegalSection id="affiliation" title="No affiliation with X or Twitter">
        <p>
          GradedCalls FinTwit is the FinTwit vertical under GradedCalls. GradedCalls Analysts and GradedCalls Sports are
          sibling verticals and are not graded on this board. GradedCalls FinTwit is not affiliated with, endorsed
          by, or a product of X or Twitter. “FinTwit” names a public style of market commentary. It is not a
          claim of partnership. The app does not scrape X.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="You can lose money if you trade">
        <p>
          Markets move. Data can be late or wrong. A grade can be revised when a print or a post was recorded
          incorrectly. To the extent the law allows, GradedCalls FinTwit is not liable for trading losses or for
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
