import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const routesDirectory = new URL("../app/routes/", import.meta.url);

test("every admin API route authenticates its Shopify request", async () => {
  const routeNames = (await readdir(routesDirectory)).filter(
    (name) => name.startsWith("api.") && name.endsWith(".jsx"),
  );

  assert.ok(routeNames.length > 0);
  for (const routeName of routeNames) {
    const source = await readFile(new URL(routeName, routesDirectory), "utf8");
    assert.match(
      source,
      /authenticate\.admin\(request\)/,
      `${routeName} must authenticate the Shopify admin request`,
    );
    if (/export async function action|export const action/.test(source)) {
      assert.match(
        source,
        /request\.method/,
        `${routeName} must reject unsupported mutation methods`,
      );
    }
  }
});

test("every enabled admin action button has a real handler or destination", async () => {
  const source = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  const actionButtons = [
    ...source.matchAll(/<BotShieldActionButton(?<attributes>[^>]*)>/gs),
  ];
  for (const match of actionButtons) {
    const attributes = match.groups?.attributes || "";
    const enabled = !/\bdisabled(?:=|\s|>|$)/.test(attributes);
    if (enabled) {
      assert.match(
        attributes,
        /\bonClick=|\bhref=|\bcommandFor=/,
        "Enabled action button is missing an onClick handler, href, or commandFor target",
      );
    }
  }

  const asyncButtons = [
    ...source.matchAll(/<BotShieldAsyncButton(?<attributes>[^>]*)>/gs),
  ];
  for (const match of asyncButtons) {
    assert.match(
      match.groups?.attributes || "",
      /\baction=/,
      "Async action button is missing its action",
    );
  }

  const protectionPage = source.slice(
    source.indexOf("function ProtectionPage"),
    source.indexOf("function IpList"),
  );
  assert.doesNotMatch(
    protectionPage,
    /actions\.setPage\("(?:blocklist|trusted)"\)/,
    "List management must open its working editor instead of a retired route",
  );
});

test("active navigation exposes the five supported BotShield pages", async () => {
  const shell = await readFile(
    new URL("../app/routes/app.jsx", import.meta.url),
    "utf8",
  );
  const fraudRoute = await readFile(
    new URL("../app/routes/app.fraud-orders.jsx", import.meta.url),
    "utf8",
  );

  assert.match(shell, /Overview/);
  assert.match(shell, /href="\/app"/);
  assert.doesNotMatch(shell, /rel="home"/);
  assert.match(shell, />Fraud Orders</);
  assert.match(shell, /href="\/app\/fraud-orders"/);
  assert.match(fraudRoute, /export \{ default \} from "\.\/app\._index"/);
});

test("production cannot expose the in-memory UI preview as a real app", async () => {
  const source = await readFile(
    new URL("../app/routes/ui-preview.jsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /process\.env\.NODE_ENV === "production"/);
  assert.match(source, /redirect\("\/app"\)/);
  assert.doesNotMatch(source, /saveFraudOrderSettings|fraudOrderAutoBlock/);
});

test("retired raw and legacy pages return merchants to supported screens", async () => {
  const botLogRoute = await readFile(
    new URL("../app/routes/app.bot-log.jsx", import.meta.url),
    "utf8",
  );
  const billingReturnRoute = await readFile(
    new URL("../app/routes/app.billing-return.jsx", import.meta.url),
    "utf8",
  );
  const billingRoute = await readFile(
    new URL("../app/routes/app.billing.jsx", import.meta.url),
    "utf8",
  );
  const setupRoute = await readFile(
    new URL("../app/routes/app.setup.jsx", import.meta.url),
    "utf8",
  );

  assert.match(botLogRoute, /redirect\("\/app\/analytics"\)/);
  assert.doesNotMatch(botLogRoute, /prisma|JSON\.stringify/);
  assert.match(
    billingReturnRoute,
    /buildBillingSettingsRedirectPath\(\{ updated: true \}\)/,
  );
  assert.match(billingRoute, /redirect\(`\/app\/settings\?\$\{params\.toString\(\)\}`\)/);
  assert.match(setupRoute, /redirect\("\/app"\)/);

  const visitorsRoute = await readFile(
    new URL("../app/routes/app.visitors.jsx", import.meta.url),
    "utf8",
  );
  const blocklistRoute = await readFile(
    new URL("../app/routes/app.blocklist.jsx", import.meta.url),
    "utf8",
  );
  assert.match(visitorsRoute, /redirect\("\/app\/analytics"\)/);
  assert.match(blocklistRoute, /redirect\("\/app\/protection-rules"\)/);
});

test("public storefront decisions do not expose merchant settings", async () => {
  const source = await readFile(
    new URL("../app/lib/storefront-enforcement.server.js", import.meta.url),
    "utf8",
  );
  const publicResponse = source.slice(source.lastIndexOf("  return {"));

  assert.doesNotMatch(publicResponse, /\n\s+settings,/);
  assert.doesNotMatch(publicResponse, /alertEmail|emailProvider/);
  assert.doesNotMatch(
    publicResponse,
    /\n {4}(?:ipAddress|riskScore|threatLevel|reasonCodes|networkIntelligence|alertDelivery|referer)[,:]/,
  );
  assert.match(source, /set\("ip", maskIpAddress\(ipAddress\)\)/);
});

test("storefront script sends only fields required for enforcement", async () => {
  const source = await readFile(
    new URL(
      "../extensions/botshield-theme-app-extension/assets/botshield.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /client_user_agent|shop_domain|document\.referrer|console\.info|payload\.reasonCodes/,
  );
  assert.match(source, /params\.set\("path", currentPath\)/);
  assert.match(source, /params\.set\("challenge_token", challengeToken\)/);
});

test("visitor filters are applied by the database before result limiting", async () => {
  const source = await readFile(
    new URL("../app/routes/api.incident-list.jsx", import.meta.url),
    "utf8",
  );
  const query = source.slice(
    source.indexOf("db.botEvent.findMany"),
    source.indexOf("db.botEvent.count"),
  );

  assert.match(query, /where: incidentWhere/);
  assert.match(source, /source = "storefront-proxy"/);
  assert.match(source, /action = \{ in: \["allowed", "whitelisted"\] \}/);
  assert.match(source, /contains: search/);
});

test("settings backend persists only supported protection and email features", async () => {
  const source = await readFile(
    new URL("../app/lib/bot-control.server.js", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /fraudOrder/);
  assert.match(
    source,
    /emailAlerts === "true" \|\| weeklyReportsEnabled === "true"/,
  );
});

test("merchant product actions stay connected to real backend workflows", async () => {
  const indexSource = await readFile(
    new URL("../app/routes/app._index.jsx", import.meta.url),
    "utf8",
  );
  const adminSource = await readFile(
    new URL(
      "../app/components/admin/BotShieldAdminExperience.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(indexSource, /protectionEntryIntent/);
  assert.match(indexSource, /setProtectionEntryIntent\("blocklist"\)/);
  assert.match(indexSource, /clearProtectionEntryIntent/);
  assert.match(indexSource, /await refreshBackendState\(\)/);
  assert.match(indexSource, /refreshAnalytics/);
  assert.match(indexSource, /cache: "no-store"/);
  assert.match(adminSource, /highRiskAlertsOnly/);
  assert.match(adminSource, /actions\.addTrustedIp\(visitorIp\)/);
  assert.match(adminSource, /actions\.addBlockedIp\(ip\)/);
  assert.match(adminSource, /actions\.removeBlockedIp\(ip\)/);
  assert.match(adminSource, /actions\.removeTrustedIp\(ip\)/);
  assert.match(adminSource, /actions\.runSimulation\(\)/);
  assert.match(adminSource, /blocklist: openBlocklist/);
  assert.match(adminSource, /openProtectionModule\?\.\(row\.module\)/);
});
