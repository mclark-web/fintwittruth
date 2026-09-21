import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { CORRECTIONS_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Draft terms for Charoof FinTwit: free scoreboard, donation-only, public posts, and a limitation of liability.",
};

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Terms of use"
      title="Terms for reading the board."
      lede="These terms say what Charoof FinTwit is, what a grade means, and what a payment does not buy. They are a draft for legal review."
    >
      <LegalSection id="agreement" title="Using the site">
        <p>
          If you read Charoof FinTwit, you are using it on these terms. If you do not agree with them, do not use
          the site. The{" "}
          <Link href="/disclaimer" className="text-pine underline-offset-4 hover:underline">
            disclaimer
          </Link>{" "}
          is part of these terms.
        </p>
      </LegalSection>

      <LegalSection id="service" title="What the service is">
        <p>
          Charoof FinTwit publishes a weekly scoreboard. It collects one cohort of bullish and bearish calls,
          then grades that same cohort at the Monday open and at Monday, Wednesday, and Friday noon. It is a
          reading of public commentary against recorded market prints. It is not a broker, a signal service, or
          a feed sold by the post.
        </p>
      </LegalSection>

      <LegalSection id="calendar" title="The calendar does not move">
        <p>
          Collect window: Wednesday at 12:00 PM America/New_York through Sunday at 5:00 PM America/New_York.
          The posts in that window are one cohort. The cohort does not grow after Sunday.
        </p>
        <p>
          Readouts on that same cohort: Monday at 9:30 AM America/New_York (the gap, from Friday&apos;s adjusted
          close to the regular-session open), then Monday, Wednesday, and Friday at 12:00 PM America/New_York.
          Wednesday at 12:00 PM also opens the next collect window. That is a new cohort. The Wednesday grade
          still belongs to the book that closed the previous Sunday. A closed session stays blank.
        </p>
      </LegalSection>

      <LegalSection id="public" title="Public posts only">
        <p>
          The board is limited to posts that are public. Charoof FinTwit does not seek private messages, direct
          messages, closed groups, or paid rooms. Do not send non-public material to the corrections address
          and expect it to be graded. A live feed, if one is added later, has to stay inside public posts and
          a licensed source. The site does not scrape X or Twitter.
        </p>
        <p>
          Charoof FinTwit is the FinTwit vertical under Charoof, alongside Charoof Analysts and Charoof Sports.
          It is not affiliated with, endorsed by, or a product of X or Twitter. “FinTwit” describes a public
          style of commentary.
        </p>
      </LegalSection>

      <LegalSection id="data" title="Demo posts, real outcomes">
        <p>
          This deployment is a labeled demo. Handles and wording in the seed are fictional. They are not quotes
          from real people. Market outcomes are not fictional. A published grade uses the recorded print for
          that evaluation date: the prior Friday adjusted close as the weekend reference, the regular-session
          open for Monday&apos;s gap, and the 12:00 PM ET print on Monday, Wednesday, and Friday when the cash
          market is open. VIX is part of every published grade. A closed session stays blank. A future session
          stays blank. Missing history is not filled in.
        </p>
      </LegalSection>

      <LegalSection id="marks" title="Scores and opinion labels">
        <p>
          Every published grade shows a score from 0 to 100 and a badge from 1 to 10. Under 70 is Chud,
          Uncertainty &amp; Doubt. Chad, Accuracy &amp; Discipline, is the top 30% of the peer set and also a
          score of at least 70. Those labels are the Charoof CH factor: opinions about a past call under the
          published formula. They are not statements of fact about a person’s character, and they are not a
          recommendation to follow or fade that person.
        </p>
      </LegalSection>

      <LegalSection id="advice" title="Not advice and not an adviser">
        <p>
          Charoof FinTwit does not give investment, financial, trading, or tax advice. It is not a registered
          investment adviser, not a broker-dealer, and not a commodity trading advisor. It does not manage
          money. You are responsible for your own decisions. Past grades are not a forecast.
        </p>
      </LegalSection>

      <LegalSection id="sale" title="Grades are not for sale">
        <p>
          Access to the board is free. Charoof FinTwit does not sell grades, score improvements, alerts,
          subscriptions, or trading signals. Paying does not change a score, a rank, or what you can read.
        </p>
      </LegalSection>

      <LegalSection id="donations" title="Donations">
        <p>
          Support is donation-only. A donation is a voluntary gift. It is not the price of a signal, a grade,
          or access. Unless Charoof FinTwit later publishes a clear statement that donations are tax-deductible,
          they are not tax-deductible. This draft makes no such statement. Details are on the{" "}
          <Link href="/donate" className="text-pine underline-offset-4 hover:underline">
            donate
          </Link>{" "}
          page.
        </p>
      </LegalSection>

      <LegalSection id="corrections" title="Corrections">
        <p>
          If a print, a grade, or a page is wrong, write to{" "}
          <a className="text-pine underline-offset-4 hover:underline" href={`mailto:${CORRECTIONS_EMAIL}`}>
            {CORRECTIONS_EMAIL}
          </a>
          . That address is a placeholder. It is not a monitored inbox until it is replaced after legal review.
          A correction can change a published grade when the underlying print or post was recorded wrong. It
          does not exist to renegotiate a score you dislike.
        </p>
      </LegalSection>

      <LegalSection id="use" title="Acceptable use">
        <p>
          You may read the board and share links to it. You may not present a grade as Charoof FinTwit’s advice
          to buy or sell, scrape the site in order to resell the grades, or remove the demo label from demo
          posts. You may not send private or unlawful material and ask for it to be published.
        </p>
      </LegalSection>

      <LegalSection id="warranty" title="No warranty">
        <p>
          The site is provided as-is. Prints, timestamps, and scores can be wrong, late, or revised. The demo
          can differ from a future live feed. Charoof FinTwit does not warrant that the board is complete,
          uninterrupted, or fit for a trading decision.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Limitation of liability">
        <p>
          To the fullest extent the law allows, Charoof FinTwit is not liable for trading losses, missed moves,
          lost profits, or decisions you make from a grade, a badge, a Chad or Chud label, a consensus line, or
          a print. It is not liable for errors, delays, or interruptions in the board.
        </p>
        <p>
          If a claim about the site is allowed anyway, the total liability is limited to the amount you donated
          to Charoof FinTwit in the three months before the claim, or zero if you donated nothing. Charoof FinTwit is
          not liable for indirect, incidental, special, or consequential damages, to the extent the law allows
          that exclusion.
        </p>
        <p>
          Some places do not allow these limits. Where they do not, the limits apply only as far as they can.
          Which law governs these terms, and where a dispute would be heard, is blank until counsel fills it
          in. Do not treat this page as a completed contract.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes">
        <p>
          These terms can be updated after counsel review. The page will keep the “Draft for legal review”
          label until that review is done and the label is removed on purpose. Continued use after an update
          is how later versions apply.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
