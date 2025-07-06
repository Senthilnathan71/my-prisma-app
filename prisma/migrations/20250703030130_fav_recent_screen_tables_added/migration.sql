-- AlterTable
ALTER TABLE "FavouriteScreen" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RecentScreen" ADD COLUMN     "deletedAt" TIMESTAMP(3);
