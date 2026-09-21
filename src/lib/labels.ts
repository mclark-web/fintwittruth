import type { ReadoutKind } from "./scoring";

export const READOUT_META: Record<
  ReadoutKind,
  { label: string; role: string; time: string }
> = {
  monday: { label: "Monday", role: "Initial grade", time: "12:00 PM ET" },
  wednesday: { label: "Wednesday", role: "Mid-week update", time: "12:00 PM ET" },
  friday: { label: "Friday", role: "Final grade", time: "12:00 PM ET" },
};

export const DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo";
