-- CreateEnum
CREATE TYPE "AuthHistoryStatus" AS ENUM ('pending', 'authenticated', 'failed', 'revoked');

-- CreateTable
CREATE TABLE "AuthHistory" (
    "id" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" INTEGER,
    "redirectUri" TEXT,
    "stateHash" TEXT,
    "stateExpiresAt" TIMESTAMP(3),
    "stateConsumedAt" TIMESTAMP(3),
    "audience" TEXT,
    "scope" TEXT,
    "status" "AuthHistoryStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserToken" (
    "id" UUID NOT NULL,
    "authHistoryId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthHistory_stateHash_key" ON "AuthHistory"("stateHash");

-- CreateIndex
CREATE INDEX "AuthHistory_userId_clientId_status_idx" ON "AuthHistory"("userId", "clientId", "status");

-- CreateIndex
CREATE INDEX "AuthHistory_expiresAt_idx" ON "AuthHistory"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_tokenHash_key" ON "UserToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UserToken_authHistoryId_revokedAt_idx" ON "UserToken"("authHistoryId", "revokedAt");

-- CreateIndex
CREATE INDEX "UserToken_expiresAt_idx" ON "UserToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "AuthHistory" ADD CONSTRAINT "AuthHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_authHistoryId_fkey" FOREIGN KEY ("authHistoryId") REFERENCES "AuthHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
