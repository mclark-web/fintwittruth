import { CORRECTIONS_EMAIL } from "./legal";

export function disputeHref(input: { id: string; handle: string; sourceUrl: string }): string {
  const subject = `Dispute this grade ${input.id}`;
  const body = [
    `Handle: @${input.handle}`,
    `Source: ${input.sourceUrl}`,
    `Call: ${input.id}`,
    "",
    "What looks wrong:",
    "",
  ].join("\n");
  return `mailto:${CORRECTIONS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
