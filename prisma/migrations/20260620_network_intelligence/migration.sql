ALTER TABLE "BotEvent"
ADD COLUMN "networkAsn" INTEGER,
ADD COLUMN "networkOrg" TEXT,
ADD COLUMN "networkType" TEXT,
ADD COLUMN "networkProvider" TEXT;

CREATE TABLE "NetworkIntel" (
    "id" SERIAL NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "asn" INTEGER,
    "organization" TEXT,
    "networkType" TEXT,
    "provider" TEXT,
    "isVpn" BOOLEAN NOT NULL DEFAULT false,
    "isProxy" BOOLEAN NOT NULL DEFAULT false,
    "isDatacenter" BOOLEAN NOT NULL DEFAULT false,
    "isTor" BOOLEAN NOT NULL DEFAULT false,
    "isAbuser" BOOLEAN NOT NULL DEFAULT false,
    "rawJson" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkIntel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NetworkIntel_ipAddress_key" ON "NetworkIntel"("ipAddress");
CREATE INDEX "NetworkIntel_expiresAt_idx" ON "NetworkIntel"("expiresAt");
