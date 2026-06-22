import db from "../db.server";
import { normalizeIpAddress } from "./bot-detection.server";
import { normalizeNetworkIntel } from "./network-intelligence";

const API_ENDPOINT = "https://api.ipapi.is";
const LOOKUP_TIMEOUT_MS = 900;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isPublicIp(ipAddress) {
  const ip = normalizeIpAddress(ipAddress).toLowerCase();
  if (!ip || ip === "0.0.0.0" || ip === "::1") return false;
  if (
    ip.startsWith("10.") ||
    ip.startsWith("127.") ||
    ip.startsWith("169.254.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80:")
  ) {
    return false;
  }
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return false;
  }
  return true;
}

export async function lookupNetworkIntelligence(ipAddress) {
  const normalizedIp = normalizeIpAddress(ipAddress);
  if (!isPublicIp(normalizedIp)) {
    return { status: "not_public", intel: null };
  }

  const cached = await db.networkIntel
    .findUnique({ where: { ipAddress: normalizedIp } })
    .catch(() => null);
  if (cached && cached.expiresAt.getTime() > Date.now()) {
    if (
      cached.rawJson &&
      (!cached.country || cached.latitude == null || cached.longitude == null)
    ) {
      try {
        const normalized = normalizeNetworkIntel(JSON.parse(cached.rawJson));
        const enriched = await db.networkIntel.update({
          where: { ipAddress: normalizedIp },
          data: normalized,
        });
        return { status: "cached_enriched", intel: enriched };
      } catch {
        // Keep the valid cached network record if legacy raw data cannot parse.
      }
    }
    return { status: "cached", intel: cached };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const body = {
      q: normalizedIp,
      ...(process.env.IPAPI_IS_KEY?.trim()
        ? { key: process.env.IPAPI_IS_KEY.trim() }
        : {}),
    };
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
      return { status: "provider_error", intel: cached || null };
    }

    const normalized = normalizeNetworkIntel(payload);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    const intel = await db.networkIntel.upsert({
      where: { ipAddress: normalizedIp },
      create: {
        ipAddress: normalizedIp,
        ...normalized,
        rawJson: JSON.stringify(payload),
        expiresAt,
      },
      update: {
        ...normalized,
        rawJson: JSON.stringify(payload),
        expiresAt,
      },
    });
    return { status: "fresh", intel };
  } catch (error) {
    return {
      status: error?.name === "AbortError" ? "timeout" : "lookup_error",
      intel: cached || null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
