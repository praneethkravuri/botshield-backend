import {
  BOT_EVENT_RETENTION_DAYS,
  BOT_EVENT_RETENTION_MS,
} from "../config/data-retention.js";

export { BOT_EVENT_RETENTION_DAYS, BOT_EVENT_RETENTION_MS };

export const DEFAULT_RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_RETENTION_STARTUP_DELAY_MS = 60 * 1000;

export function getBotEventRetentionCutoff(now = Date.now()) {
  return new Date(now - BOT_EVENT_RETENTION_MS);
}

export function getNetworkIntelExpiryCutoff(now = Date.now()) {
  return new Date(now);
}

export async function purgeExpiredBotEvents(db, { batchSize = 1000, now = Date.now() } = {}) {
  const cutoff = getBotEventRetentionCutoff(now);
  let totalDeleted = 0;

  while (true) {
    const stale = await db.botEvent.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: batchSize,
    });

    if (!stale.length) break;

    const result = await db.botEvent.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });
    totalDeleted += result.count;

    if (stale.length < batchSize) break;
  }

  return totalDeleted;
}

export async function purgeExpiredNetworkIntel(db, { now = Date.now() } = {}) {
  const cutoff = getNetworkIntelExpiryCutoff(now);
  const result = await db.networkIntel.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return result.count;
}

export async function runDataRetentionPurge(db, options = {}) {
  const [botEventsDeleted, networkIntelDeleted] = await Promise.all([
    purgeExpiredBotEvents(db, options),
    purgeExpiredNetworkIntel(db, options),
  ]);

  return {
    botEventsDeleted,
    networkIntelDeleted,
  };
}

export function startDataRetentionScheduler(db, options = {}) {
  const intervalMs = Number(
    options.intervalMs ??
      process.env.DATA_RETENTION_INTERVAL_MS ??
      DEFAULT_RETENTION_INTERVAL_MS,
  );
  const startupDelayMs = Number(
    options.startupDelayMs ??
      process.env.DATA_RETENTION_STARTUP_DELAY_MS ??
      DEFAULT_RETENTION_STARTUP_DELAY_MS,
  );
  const enabled = options.enabled ?? process.env.DATA_RETENTION_ENABLED !== "false";

  if (!enabled) {
    return { stop: () => {} };
  }

  let running = false;
  let intervalId = null;
  let startupTimeoutId = null;

  const execute = async (trigger) => {
    if (running) return;
    running = true;
    try {
      const result = await runDataRetentionPurge(db, options);
      if (result.botEventsDeleted || result.networkIntelDeleted) {
        console.log(
          `[botshield] data retention (${trigger}): deleted ${result.botEventsDeleted} bot events older than ${BOT_EVENT_RETENTION_DAYS} days and ${result.networkIntelDeleted} expired network-intel rows`,
        );
      }
    } catch (error) {
      console.error(`[botshield] data retention (${trigger}) failed`, error);
    } finally {
      running = false;
    }
  };

  startupTimeoutId = setTimeout(() => {
    void execute("startup");
    intervalId = setInterval(() => {
      void execute("interval");
    }, intervalMs);
  }, startupDelayMs);

  if (typeof startupTimeoutId.unref === "function") {
    startupTimeoutId.unref();
  }

  return {
    stop: () => {
      if (startupTimeoutId) clearTimeout(startupTimeoutId);
      if (intervalId) clearInterval(intervalId);
    },
  };
}
