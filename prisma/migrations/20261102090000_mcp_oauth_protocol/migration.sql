-- AlterTable
ALTER TABLE "AuthHistory" ADD COLUMN     "codeChallenge" TEXT,
ADD COLUMN     "oauthClientId" TEXT,
ADD COLUMN     "oauthRedirectUri" TEXT,
ADD COLUMN     "oauthState" TEXT;

-- CreateIndex
CREATE INDEX "AuthHistory_oauthClientId_status_expiresAt_idx" ON "AuthHistory"("oauthClientId", "status", "expiresAt");
