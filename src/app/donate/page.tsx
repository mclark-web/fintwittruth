import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { CORRECTIONS_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Donate",
  description:
    "Draft donation page: FinTwitTruth is free to read. A donation is not a purchase of grades or signals.",
};

export default function DonatePage() {
  return (
    <LegalPage
      kicker="Donate"
      title="The board is free. A gift does not buy a grade."
      lede="FinTwitTruth is donation-only. You can read every cohort, score, and readout without paying. A donation is support. It is not the price of a signal."
    >
      <div className="panel p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Checkout</p>
        <p className="mt-2 font-serif text-2xl text-ink">No donation checkout is open on this draft.</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          When a way to give is added, it will be on this page, and the rest of these rules stay in force.
          Paying will still not buy a grade, a rank, or a trading signal.
        </p>
      </div>

      <LegalSection id="free" title="Reading is not a purchase">
        <p>
          Every published board is free. There is no subscription, no paid tier, and no fee for a Monday,
          Wednesday, or Friday readout. You do not need to donate to see a score.
        </p>
      </LegalSection>

      <LegalSection id="not-a-sale" title="Grades are not for sale">
        <p>
          FinTwitTruth does not sell grades, alerts, score changes, or trading signals. A donation does not
          buy a better Chad or Chud mark, an earlier look at the tape, a private call, or a recommendation. It
          does not create an advisory relationship. The{" "}
          <Link href="/disclaimer" className="text-pine underline-offset-4 hover:underline">
            disclaimer
          </Link>{" "}
          still applies to anyone who gives.
        </p>
      </LegalSection>

      <LegalSection id="gift" title="A donation is a gift">
        <p>
          If you donate later, you are making a voluntary gift to keep the scoreboard available. You are not
          buying a product. Access does not depend on the gift. FinTwitTruth does not owe you a particular
          grade, a correction you prefer, or ongoing signals in return.
        </p>
      </LegalSection>

      <LegalSection id="tax" title="Not tax-deductible unless stated">
        <p>
          A donation to FinTwitTruth is not tax-deductible unless a later notice on this page clearly says
          that it is. This draft makes no such statement. Do not claim a deduction from a gift to this project
          on the strength of this page.
        </p>
      </LegalSection>

      <LegalSection id="advice" title="A gift is not advice">
        <p>
          Donating does not make FinTwitTruth your adviser. FinTwitTruth is not a registered investment
          adviser, not a broker-dealer, and not a commodity trading advisor. Grades remain opinions about past
          public posts against recorded prints, including the Chad and Chud labels. They are not instructions
          for a donor.
        </p>
      </LegalSection>

      <LegalSection id="what-it-supports" title="What the board already is">
        <p>
          The calendar stays the same whether or not anyone gives: posts from Wednesday at 12:00 PM
          America/New_York through Sunday at 5:00 PM America/New_York, graded Monday, Wednesday, and Friday at
          12:00 PM America/New_York. Outcomes are recorded market prints. The shipped posts are a labeled demo.
          Only public posts belong on the board. FinTwitTruth is not affiliated with X or Twitter.
        </p>
        <p>
          The{" "}
          <Link href="/terms" className="text-pine underline-offset-4 hover:underline">
            terms
          </Link>{" "}
          limit liability for decisions made from the board. A donation does not waive that limit and does not
          buy a warranty.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Questions">
        <p>
          Write to{" "}
          <a className="text-pine underline-offset-4 hover:underline" href={`mailto:${CORRECTIONS_EMAIL}`}>
            {CORRECTIONS_EMAIL}
          </a>{" "}
          about a wrong print or a wrong grade. That address is a placeholder, not a live donations desk.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
