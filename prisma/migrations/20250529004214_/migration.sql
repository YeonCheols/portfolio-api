/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Tag` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "createdAt",
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
CREATE SEQUENCE project_order_seq;
ALTER TABLE "Project" ALTER COLUMN "order" SET DEFAULT nextval('project_order_seq');
ALTER SEQUENCE project_order_seq OWNED BY "Project"."order";

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "createdAt",
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
