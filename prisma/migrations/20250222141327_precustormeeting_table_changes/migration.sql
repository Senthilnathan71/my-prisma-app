/*
  Warnings:

  - You are about to alter the column `status` on the `PreCustomerMeeting` table. The data in that column could be lost. The data in that column will be cast from `VarChar(10)` to `Char(1)`.

*/
-- AlterTable
ALTER TABLE "PreCustomerMeeting" ALTER COLUMN "remarks" DROP NOT NULL,
ALTER COLUMN "status" SET DATA TYPE CHAR(1);
