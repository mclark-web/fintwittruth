import type { ReadoutKind } from "./scoring";

export const READOUT_META: Record<
  ReadoutKind,
  { label: string; role: string; time: string }
> = {
  monday: { label: "Monday", role: "Weekend-noise grade", time: "12:00 PM ET" },
  wednesday: { label: "Wednesday", role: "Same cohort, mid-week", time: "12:00 PM ET" },
  friday: { label: "Friday", role: "Same cohort, final", time: "12:00 PM ET" },
};

/** Opinion labels. Chad is Accuracy & Discipline. Chud is Uncertainty & Doubt. */
export const CH_FACTOR = "CH factor";
export const CHAD_MEANING = "Accuracy & Discipline";
export const CHUD_MEANING = "Uncertainty & Doubt";

export const DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo";
