/*
  Warnings:

  - You are about to drop the `_ProjectTags` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `category` to the `Tag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `color` to the `Tag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `icon` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_ProjectTags" DROP CONSTRAINT "_ProjectTags_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProjectTags" DROP CONSTRAINT "_ProjectTags_B_fkey";

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "color" TEXT NOT NULL,
ADD COLUMN     "icon" TEXT NOT NULL;

-- DropTable
DROP TABLE "_ProjectTags";
