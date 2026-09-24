import Link from "next/link";
import { pendingHorizonsClause, type PendingClosure } from "@/lib/grades";

export function NothingGraded({ href, horizon }: { href: string; horizon?: string }) {
  return (
    <div className="panel p-5">
      <h2 className="font-serif text-2xl text-ink">Nothing graded yet</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        {horizon
          ? `${horizon} has not settled, so these calls are off the board.`
          : "This cohort has no settled grade yet. Scores land here after Monday's open, Monday noon, or a later close prints."}
      </p>
      <p className="mt-3 text-sm">
        <Link href={href} className="font-medium text-pine underline-offset-4 hover:underline">
          Pending settle
        </Link>
        <span className="text-muted"> lists what is waiting. It is not part of the ranking.</span>
      </p>
    </div>
  );
}

export function PendingSettleLink({
  href,
  waiting,
  closure,
}: {
  href: string;
  waiting?: number;
  closure?: PendingClosure;
}) {
  const upcoming = closure ?? { closed: 0, upcoming: waiting ?? 0, name: null };
  return (
    <p className="text-sm text-muted">
      <Link href={href} className="font-medium text-pine underline-offset-4 hover:underline">
        Pending settle
      </Link>
      {waiting != null && waiting > 0
        ? ` · ${pendingHorizonsClause(waiting, upcoming)}`
        : " · unscored calls stay off this board until the tape prints."}
    </p>
  );
}
