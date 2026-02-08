-- CreateTable
CREATE TABLE "IvSnapshot" (
    "id" SERIAL NOT NULL,
    "underlying" TEXT NOT NULL,
    "expiry" TEXT NOT NULL,
    "strike" DOUBLE PRECISION NOT NULL,
    "optionType" TEXT NOT NULL,
    "iv" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "oi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IvSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtmIvHistory" (
    "id" SERIAL NOT NULL,
    "underlying" TEXT NOT NULL,
    "atmIv" DOUBLE PRECISION NOT NULL,
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtmIvHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "underlying" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" SERIAL NOT NULL,
    "underlying" TEXT NOT NULL,
    "totalOptions" INTEGER NOT NULL,
    "totalVolume" DOUBLE PRECISION NOT NULL,
    "totalOi" DOUBLE PRECISION NOT NULL,
    "putCallRatio" DOUBLE PRECISION NOT NULL,
    "avgIv" DOUBLE PRECISION NOT NULL,
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IvSnapshot_underlying_createdAt_idx" ON "IvSnapshot"("underlying", "createdAt");

-- CreateIndex
CREATE INDEX "IvSnapshot_underlying_expiry_strike_optionType_idx" ON "IvSnapshot"("underlying", "expiry", "strike", "optionType");

-- CreateIndex
CREATE INDEX "AtmIvHistory_underlying_createdAt_idx" ON "AtmIvHistory"("underlying", "createdAt");

-- CreateIndex
CREATE INDEX "Signal_type_createdAt_idx" ON "Signal"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Signal_underlying_createdAt_idx" ON "Signal"("underlying", "createdAt");

-- CreateIndex
CREATE INDEX "MarketSnapshot_underlying_createdAt_idx" ON "MarketSnapshot"("underlying", "createdAt");
