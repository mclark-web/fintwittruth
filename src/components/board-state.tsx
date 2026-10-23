import Link from "next/link";
import { pendingHorizonsClause, type PendingClosure } from "@/lib/grades";

export function NothingGraded({ href, horizon }: { href: string; horizon?: string }) {
  return (
    <div className="panel p-5">
      <h2 className="font-serif text-2xl text-ink">No graded calls yet this week</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        {horizon
          ? `${horizon} has not settled, so these calls are off the board.`
          : "No graded calls yet this week. Scores land here after Monday noon, or a later close, once the prices are in."}
      </p>
      <p className="mt-3 text-sm">
        <Link href={href} className="accent-link font-medium underline-offset-4 hover:underline">
          Not graded yet
        </Link>
        <span className="text-muted"> lists what has no grade yet. It is not part of the ranking.</span>
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
      <Link href={href} className="accent-link font-medium underline-offset-4 hover:underline">
        Not graded yet
      </Link>
      {waiting != null && waiting > 0
        ? ` · ${pendingHorizonsClause(waiting, upcoming)}`
        : " · calls without a grade stay off this board until the prices are in."}
    </p>
  );
}
