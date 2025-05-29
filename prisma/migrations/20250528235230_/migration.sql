/*
  Warnings:

  - You are about to drop the column `is_featured` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `is_show` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `link_demo` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `link_github` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the `profiles` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "is_featured",
DROP COLUMN "is_show",
DROP COLUMN "link_demo",
DROP COLUMN "link_github",
DROP COLUMN "updated_at",
ADD COLUMN     "isShow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "linkDemo" TEXT,
ADD COLUMN     "linkGithub" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "profiles";

-- CreateTable
CREATE TABLE "Profile" (
    "id" SERIAL NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Profile_order_idx" ON "Profile"("order");
