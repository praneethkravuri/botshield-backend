ALTER TABLE "BotEvent"
ADD COLUMN "networkCountry" TEXT,
ADD COLUMN "networkCountryCode" TEXT,
ADD COLUMN "networkCity" TEXT,
ADD COLUMN "networkLatitude" DOUBLE PRECISION,
ADD COLUMN "networkLongitude" DOUBLE PRECISION;

ALTER TABLE "NetworkIntel"
ADD COLUMN "country" TEXT,
ADD COLUMN "countryCode" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;
