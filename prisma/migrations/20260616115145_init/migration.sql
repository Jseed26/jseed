-- AlterTable
ALTER TABLE "Point" ADD COLUMN     "address" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "website" TEXT;
