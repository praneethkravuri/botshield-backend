import prisma from "../db.server.js";
import { ONBOARDING_GUIDE_KEY } from "./onboarding.js";

export async function readGuideAcknowledgment(shop, database = prisma) {
  const record = await database.appSetting.findUnique({
    where: { shop_key: { shop, key: ONBOARDING_GUIDE_KEY } },
  });
  return record?.value === "acknowledged";
}

export async function acknowledgeGuide(shop, database = prisma) {
  await database.appSetting.upsert({
    where: { shop_key: { shop, key: ONBOARDING_GUIDE_KEY } },
    create: { shop, key: ONBOARDING_GUIDE_KEY, value: "acknowledged" },
    update: { value: "acknowledged" },
  });
}
