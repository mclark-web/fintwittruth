import type { Extraction } from "./extract-call";
import type { Conviction, Direction, Level, Sentiment } from "./scoring";

export type IntakeStatus = "pending" | "confirmed" | "rejected" | "not_gradable";

export type ReviewedCall = {
  symbol: string;
  direction: Direction;
  horizon: string;
  conviction: Conviction;
  sentiment: Sentiment;
  postedAt: string;
  levels: Level[];
  gradable: boolean;
};

export type IntakePost = {
  id: string;
  sourceUrl: string;
  statusId: string;
  handle: string;
  authorName: string;
  text: string;
  postedAtLabel: string;
  textSource?: "oembed" | "manual";
  fetchedAt: string;
  status: IntakeStatus;
  extraction: Extraction;
  suggestion: Extraction | null;
  llmNote: string;
  review: ReviewedCall | null;
  rejectNote: string;
};

export type DisputeStatus = "open" | "resolved";

export type Dispute = {
  id: string;
  callId: string;
  name: string;
  email: string;
  reason: string;
  status: DisputeStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type IntakeBook = {
  version: 1;
  posts: IntakePost[];
  disputes: Dispute[];
};

export function emptyBook(): IntakeBook {
  return { version: 1, posts: [], disputes: [] };
}
