-- CreateEnum
CREATE TYPE "ProjectSource" AS ENUM ('personal', 'company');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "source" "ProjectSource" NOT NULL DEFAULT 'personal';

-- 기존 회사 프로젝트만 재분류하며 콘텐츠와 수정 시각은 유지합니다.
UPDATE "Project"
SET "source" = 'company'
WHERE "slug" IN ('jobkorea-bizcenter', 'albamon', 'albamon-deeplink-library');
