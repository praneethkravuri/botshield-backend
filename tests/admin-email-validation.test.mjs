import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  EMAIL_PATTERN,
  isValidAlertEmail,
} from "../app/lib/email-validation.js";

test("BotShieldAdminExperience imports EMAIL_PATTERN for Settings email validation", async () => {
  const adminSource = await readFile(
    new URL("../app/components/admin/BotShieldAdminExperience.jsx", import.meta.url),
    "utf8",
  );

  assert.match(adminSource, /import \{ EMAIL_PATTERN \} from "\.\.\/\.\.\/lib\/email-validation\.js"/);
  assert.match(adminSource, /EMAIL_PATTERN\.test\(model\.alertEmail/);
  assert.match(adminSource, /EMAIL_PATTERN\.test\(draft\.alertEmail\)/);
  assert.doesNotMatch(adminSource, /const EMAIL_PATTERN =/);
});

test("Settings email validation accepts valid addresses and rejects invalid ones", () => {
  assert.equal(isValidAlertEmail("merchant@example.com"), true);
  assert.equal(isValidAlertEmail(" alerts@shopify.com "), true);
  assert.equal(isValidAlertEmail(""), false);
  assert.equal(isValidAlertEmail("not-an-email"), false);
  assert.equal(isValidAlertEmail("@missing-local.com"), false);
  assert.equal(EMAIL_PATTERN.test("merchant@example.com"), true);
});

test("admin bundle dependencies resolve EMAIL_PATTERN at module load time", async () => {
  assert.doesNotThrow(() => {
    assert.ok(EMAIL_PATTERN instanceof RegExp);
    assert.equal(typeof isValidAlertEmail, "function");
  });
});
