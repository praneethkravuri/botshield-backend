-- CreateTable
CREATE TABLE "BotEvent" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "threatLevel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "path" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "reasonSummary" TEXT,
    "source" TEXT NOT NULL DEFAULT 'local-engine',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedIP" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'local-engine',
    "hits" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockedIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhitelistIP" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhitelistIP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "id" SERIAL NOT NULL,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotEvent_shop_createdAt_idx" ON "BotEvent"("shop", "createdAt");

-- CreateIndex
CREATE INDEX "BotEvent_shop_ipAddress_createdAt_idx" ON "BotEvent"("shop", "ipAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedIP_shop_ipAddress_key" ON "BlockedIP"("shop", "ipAddress");

-- CreateIndex
CREATE INDEX "BlockedIP_shop_updatedAt_idx" ON "BlockedIP"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistIP_shop_ipAddress_key" ON "WhitelistIP"("shop", "ipAddress");

-- CreateIndex
CREATE INDEX "WhitelistIP_shop_updatedAt_idx" ON "WhitelistIP"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_shop_key_key" ON "AppSetting"("shop", "key");

-- CreateIndex
CREATE INDEX "AppSetting_shop_updatedAt_idx" ON "AppSetting"("shop", "updatedAt");
