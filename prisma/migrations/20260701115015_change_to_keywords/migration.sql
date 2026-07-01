/*
  Warnings:

  - You are about to drop the column `freeText` on the `Point` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Point" DROP COLUMN "freeText",
ADD COLUMN     "keywords" TEXT;
