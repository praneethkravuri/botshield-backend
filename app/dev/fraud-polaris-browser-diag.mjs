/**
 * Browser diagnostic for Fraud Orders polaris TypeError (real Chrome + polaris.js).
 *
 * Prerequisite: shopify app dev running (or any dev server serving the app).
 *
 * Run:
 *   npx shopify app dev
 *   npx vite-node app/dev/fraud-polaris-browser-diag.mjs [--base=http://localhost:PORT]
 */
import puppeteer from "puppeteer-core";

const MODES = ["A", "B", "C", "D", "E"];
const baseUrl =
  process.argv.find((arg) => arg.startsWith("--base="))?.split("=")[1] ||
  process.env.BOTSHIELD_DEV_BASE_URL ||
  "http://localhost:5173";

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.CHROME_PATH,
].filter(Boolean);

async function launchBrowser() {
  for (const executablePath of chromePaths) {
    try {
      return await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    } catch {
      // try next path
    }
  }
  throw new Error("Could not launch Chrome. Set CHROME_PATH.");
}

async function probeMode(browser, mode) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const consoleInfos = [];

  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error") consoleErrors.push(text);
    if (text.includes("[botshield-polaris-diag]")) consoleInfos.push(text);
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(error?.message || String(error));
  });

  const url = `${baseUrl}/ui-preview?view=fraud-orders&polarisDiag=1&fraudDiag=${mode}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
  await page.waitForTimeout(1500);

  const report = await page.evaluate(() => {
    const modal = document.getElementById("botshield-fraud-review-modal");
    const ModalClass = customElements.get("s-modal");
    const diag = globalThis.__BOTSHIELD_POLARIS_DIAG__ || { events: [], errors: [] };
    const imperativeCalls = diag.events.filter((entry) => entry.method);
    const lastImperative = imperativeCalls[imperativeCalls.length - 1] || null;
    const privateErrors = diag.errors.filter((entry) =>
      /private member/i.test(entry.message || ""),
    );

    return {
      href: location.href,
      modalPresent: Boolean(modal),
      modalTag: modal?.tagName?.toLowerCase?.() || null,
      modalConstructor: modal?.constructor?.name || null,
      modalRegistered: Boolean(ModalClass),
      modalInstanceof: Boolean(modal && ModalClass && modal instanceof ModalClass),
      imperativeCallCount: imperativeCalls.length,
      lastImperativeCall: lastImperative,
      diagPrivateErrors: privateErrors,
      diagEventCount: diag.events.length,
    };
  });

  await page.close();

  const privateMemberErrors = [
    ...consoleErrors.filter((message) => /private member/i.test(message)),
    ...report.diagPrivateErrors.map((entry) => entry.message),
  ];

  return {
    mode,
    pass: privateMemberErrors.length === 0,
    url,
    privateMemberErrors,
    consoleErrors: consoleErrors.filter((message) => /private member|polaris/i.test(message)),
    diag: report,
    diagLogs: consoleInfos.slice(-8),
  };
}

console.log(`\n=== Fraud Orders browser polaris diag (base: ${baseUrl}) ===\n`);

const browser = await launchBrowser();
const results = [];

for (const mode of MODES) {
  try {
    const result = await probeMode(browser, mode);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const fail = { mode, pass: false, error: error.message };
    results.push(fail);
    console.log(JSON.stringify(fail, null, 2));
  }
}

await browser.close();

console.log("\n=== PASS/FAIL table ===");
for (const result of results) {
  console.log(
    `${result.mode}: ${result.pass ? "PASS" : "FAIL"}${
      result.privateMemberErrors?.length
        ? ` (${result.privateMemberErrors[0]})`
        : result.error
          ? ` (${result.error})`
          : ""
    }`,
  );
}

const firstFail = results.find((result) => !result.pass);
const lastPass = [...results].reverse().find((result) => result.pass);
if (firstFail && lastPass) {
  console.log(`\nBoundary: ${lastPass.mode} (PASS) → ${firstFail.mode} (FAIL)`);
  if (firstFail.diag?.lastImperativeCall) {
    console.log("\nLast imperative call before/at failure:");
    console.log(JSON.stringify(firstFail.diag.lastImperativeCall, null, 2));
  }
}

process.exit(firstFail ? 1 : 0);
