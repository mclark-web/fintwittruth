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

/** Opinion labels. Chad is Accuracy & Discipline. Chud is Uncertainty & Doubt. */
export const CH_FACTOR = "Charoof CH factor";
export const CHAD_MEANING = "Accuracy & Discipline";
export const CHUD_MEANING = "Uncertainty & Doubt";

export const DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo";
