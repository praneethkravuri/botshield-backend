import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  buildOverviewThreatActivityResponse,
  buildThreatActivityDayBuckets,
  utcDateKey,
} from "../app/lib/overview-threat-activity.server.js";

test("overview threat activity buckets use UTC dates matching event keys", () => {
  // Reproduces botshield-test-2 evening storefront visit (US Central, UTC-5):
  // event createdAt 2026-09-04T02:57:16Z must land in today's chart bucket.
  const eventCreatedAt = new Date("2026-09-04T02:57:16.053Z");
  const now = eventCreatedAt;

  const { days } = buildOverviewThreatActivityResponse(
    [{ action: "challenged", createdAt: eventCreatedAt }],
    { now },
  );

  const todayBucket = days[days.length - 1];
  assert.equal(todayBucket.date, "2026-09-04");
  assert.equal(todayBucket.challenged, 1);
  assert.equal(todayBucket.allowed, 0);
  assert.equal(todayBucket.blocked, 0);
});

test("legacy local-midnight bucket keys miss UTC evening storefront events", () => {
  const eventCreatedAt = new Date("2026-09-04T02:57:16.053Z");
  const eventKey = utcDateKey(eventCreatedAt);
  const buckets = buildThreatActivityDayBuckets(90, eventCreatedAt);

  // US Central evening visit: merchant-local calendar day is still Sep 3,
  // but persisted createdAt UTC key is Sep 4.
  const legacyLocalLastBucketKey = "2026-09-03";

  assert.equal(eventKey, "2026-09-04");
  assert.equal(buckets[buckets.length - 1].date, "2026-09-04");
  assert.notEqual(legacyLocalLastBucketKey, eventKey);
});

test("overview threat activity route delegates UTC aggregation to shared helper", async () => {
  const routeSource = await readFile(
    new URL("../app/routes/api.overview-threat-activity.jsx", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /buildOverviewThreatActivityResponse/);
  assert.doesNotMatch(routeSource, /setHours\(0, 0, 0, 0\)/);
});
