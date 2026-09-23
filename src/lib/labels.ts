import type { ReadoutKind } from "./scoring";

export const READOUT_META: Record<
  ReadoutKind,
  { label: string; short: string; role: string; time: string }
> = {
  "monday-gap": { label: "Monday gap", short: "Gap", role: "Friday close to the open", time: "9:30 AM ET" },
  monday: { label: "Monday noon", short: "Noon", role: "Weekend-noise grade", time: "12:00 PM ET" },
  wednesday: { label: "Wednesday", short: "Wed", role: "Same cohort, noon", time: "12:00 PM ET" },
  friday: { label: "Friday", short: "Fri", role: "Same cohort, final", time: "12:00 PM ET" },
};

/** User-facing name for the 0–100 fill. The peer cut still lives in scoring.ts. */
export const GC_FACTOR = "GC Scale";

export const DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo";
