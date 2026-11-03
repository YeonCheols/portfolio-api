-- AlterTable
ALTER TABLE "ResumeModelSetting" ADD COLUMN     "apiKey" TEXT,
ALTER COLUMN "secretRef" DROP NOT NULL;
