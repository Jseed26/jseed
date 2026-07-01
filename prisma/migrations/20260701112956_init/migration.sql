/*
  Warnings:

  - You are about to drop the column `tags` on the `Point` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Point" DROP COLUMN "tags",
ADD COLUMN     "freeText" TEXT;
