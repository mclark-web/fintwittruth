/**
 * Fail when the newest real week is missing or more than 7 days old.
 * The settle, export, test, and commit steps stay exit 0. This step runs after them.
 */
import { stalenessMessage } from "../src/lib/freshness";
import { liveFile } from "../src/lib/live-book";

const newest = liveFile()
  .cohorts.map((cohort) => cohort.slug)
  .sort()
  .at(-1);
const message = stalenessMessage(newest ?? null, new Date());
if (message) {
  console.error(`::error::${message}`);
  process.exit(1);
}
console.log(`Newest real week ${newest} is inside 7 days.`);
