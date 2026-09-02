function normalizeShop(shop) {
  return String(shop || "").trim().toLowerCase();
}

export function buildClearTestDataWhere(shop) {
  return {
    shop: normalizeShop(shop),
    source: { not: "storefront-proxy" },
  };
}

export async function clearShopTestData(db, shop) {
  const result = await db.botEvent.deleteMany({
    where: buildClearTestDataWhere(shop),
  });

  return {
    ok: true,
    deleted: result.count,
  };
}
