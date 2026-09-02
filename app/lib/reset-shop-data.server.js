export const RESET_CONFIRMATION_TEXT = "RESET";
export const BILLING_SETTING_KEY_PREFIX = "billing";

export const DEFAULT_MERCHANT_SETTINGS = {
  autoBlock: "true",
  strictMode: "false",
  blockLevel: "Medium",
  protectionPausedUntil: "",
  repeatedActivityEnabled: "true",
  elevatedRateEnabled: "true",
  burstTrafficEnabled: "true",
  repeatOffenderEnabled: "true",
  pathScanningEnabled: "true",
  emailAlerts: "false",
  highRiskAlertsOnly: "true",
  alertEmail: "",
  weeklyReportsEnabled: "false",
};

function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

export function isBillingSettingKey(key) {
  return String(key || "").startsWith(BILLING_SETTING_KEY_PREFIX);
}

export function shouldDeleteAppSettingKey(key) {
  return !isBillingSettingKey(key);
}

export async function resetShopBotShieldData(db, shop) {
  const normalizedShop = normalizeShop(shop);
  if (!normalizedShop) {
    throw new Error("A valid shop is required");
  }

  return db.$transaction(async (tx) => {
    const [botEvents, blockedIPs, whitelistIPs, merchantSettings] =
      await Promise.all([
        tx.botEvent.deleteMany({ where: { shop: normalizedShop } }),
        tx.blockedIP.deleteMany({ where: { shop: normalizedShop } }),
        tx.whitelistIP.deleteMany({ where: { shop: normalizedShop } }),
        tx.appSetting.deleteMany({
          where: {
            shop: normalizedShop,
            NOT: {
              key: {
                startsWith: BILLING_SETTING_KEY_PREFIX,
              },
            },
          },
        }),
      ]);

    await Promise.all(
      Object.entries(DEFAULT_MERCHANT_SETTINGS).map(([key, value]) =>
        tx.appSetting.upsert({
          where: { shop_key: { shop: normalizedShop, key } },
          create: { shop: normalizedShop, key, value },
          update: { value },
        }),
      ),
    );

    return {
      ok: true,
      shop: normalizedShop,
      deleted: {
        botEvents: botEvents.count,
        blockedIPs: blockedIPs.count,
        whitelistIPs: whitelistIPs.count,
        merchantSettings: merchantSettings.count,
      },
    };
  });
}
