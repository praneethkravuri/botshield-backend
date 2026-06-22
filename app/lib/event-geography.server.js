import db from "../db.server";
import { normalizeNetworkIntel } from "./network-intelligence";

function hasGeography(record) {
  return (
    record?.latitude != null &&
    record?.longitude != null &&
    Number.isFinite(Number(record.latitude)) &&
    Number.isFinite(Number(record.longitude))
  );
}

function geographyFromIntel(record) {
  if (!record) return null;

  if (hasGeography(record)) {
    return {
      country: record.country || "",
      countryCode: record.countryCode || "",
      city: record.city || "",
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
    };
  }

  if (!record.rawJson) return null;

  try {
    const normalized = normalizeNetworkIntel(JSON.parse(record.rawJson));
    return hasGeography(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export async function hydrateEventGeography(rows, shop) {
  const missingIps = [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.source === "storefront-proxy" &&
            (row.networkLatitude == null || row.networkLongitude == null),
        )
        .map((row) => row.ipAddress)
        .filter(Boolean),
    ),
  ];

  if (!missingIps.length) return rows;

  const cachedRows = await db.networkIntel.findMany({
    where: { ipAddress: { in: missingIps } },
  });
  const geographyByIp = new Map();

  for (const cached of cachedRows) {
    const geography = geographyFromIntel(cached);
    if (geography) geographyByIp.set(cached.ipAddress, geography);
  }

  if (!geographyByIp.size) return rows;

  const updates = [...geographyByIp.entries()].map(([ipAddress, geography]) =>
    db.botEvent.updateMany({
      where: {
        shop,
        ipAddress,
        source: "storefront-proxy",
        OR: [{ networkLatitude: null }, { networkLongitude: null }],
      },
      data: {
        networkCountry: geography.country || null,
        networkCountryCode: geography.countryCode || null,
        networkCity: geography.city || null,
        networkLatitude: geography.latitude,
        networkLongitude: geography.longitude,
      },
    }),
  );

  await Promise.allSettled(updates);

  return rows.map((row) => {
    const geography = geographyByIp.get(row.ipAddress);
    if (!geography || hasGeography({
      latitude: row.networkLatitude,
      longitude: row.networkLongitude,
    })) {
      return row;
    }

    return {
      ...row,
      networkCountry: geography.country || null,
      networkCountryCode: geography.countryCode || null,
      networkCity: geography.city || null,
      networkLatitude: geography.latitude,
      networkLongitude: geography.longitude,
    };
  });
}
