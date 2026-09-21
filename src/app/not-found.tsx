import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <p className="text-xs uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-2 font-serif text-4xl text-ink">That page is not on the board.</h1>
      <p className="mt-3 text-muted">The cohort, account, or call may be outside this demo.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-pine px-5 py-2.5 text-sm text-lime">
        Back to {PRODUCT_NAME}
      </Link>
    </div>
  );
}
