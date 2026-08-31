export async function deleteShopScopedData(db, shopDomain) {
  const normalizedShop = String(shopDomain || "").trim();
  if (!normalizedShop) {
    return {
      deleted: false,
      shop: null,
      counts: {
        sessions: 0,
        botEvents: 0,
        blockedIPs: 0,
        whitelistIPs: 0,
        appSettings: 0,
      },
    };
  }

  const [sessions, botEvents, blockedIPs, whitelistIPs, appSettings] =
    await db.$transaction([
      db.session.deleteMany({ where: { shop: normalizedShop } }),
      db.botEvent.deleteMany({ where: { shop: normalizedShop } }),
      db.blockedIP.deleteMany({ where: { shop: normalizedShop } }),
      db.whitelistIP.deleteMany({ where: { shop: normalizedShop } }),
      db.appSetting.deleteMany({ where: { shop: normalizedShop } }),
    ]);

  return {
    deleted: true,
    shop: normalizedShop,
    counts: {
      sessions: sessions.count,
      botEvents: botEvents.count,
      blockedIPs: blockedIPs.count,
      whitelistIPs: whitelistIPs.count,
      appSettings: appSettings.count,
    },
  };
}
