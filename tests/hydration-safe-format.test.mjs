import assert from "node:assert/strict";
import test from "node:test";
import {
  formatHydrationStableDateTime,
  formatHydrationStableNumber,
  HYDRATION_STABLE_LOCALE,
  HYDRATION_STABLE_TIME_ZONE,
} from "../app/lib/hydration-safe-format.js";

test("hydration-safe format uses fixed locale and UTC timezone", () => {
  assert.equal(HYDRATION_STABLE_LOCALE, "en-US");
  assert.equal(HYDRATION_STABLE_TIME_ZONE, "UTC");

  const formatted = formatHydrationStableDateTime("2026-03-01T15:30:00.000Z");
  assert.equal(formatted, "3/1/2026, 3:30:00 PM");
});

test("hydration-safe number formatting uses fixed locale", () => {
  assert.equal(formatHydrationStableNumber(1234567), "1,234,567");
});
