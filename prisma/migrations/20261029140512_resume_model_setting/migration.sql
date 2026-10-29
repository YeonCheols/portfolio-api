-- CreateEnum
CREATE TYPE "ResumeModelEnvironment" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "ResumeModelProvider" AS ENUM ('openrouter');

-- CreateTable
CREATE TABLE "ResumeModelSetting" (
    "id" SERIAL NOT NULL,
    "environment" "ResumeModelEnvironment" NOT NULL,
    "provider" "ResumeModelProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeModelSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeModelSetting_environment_idx" ON "ResumeModelSetting"("environment");

-- CreateIndex
-- 환경마다 활성 설정은 하나여야 한다. Prisma 스키마로 표현할 수 없는 부분 유니크 인덱스라 직접 추가한다
CREATE UNIQUE INDEX "ResumeModelSetting_environment_active_key" ON "ResumeModelSetting"("environment") WHERE "isActive";
