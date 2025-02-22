/*
  Warnings:

  - You are about to drop the column `eMail` on the `PreCustomerMaster` table. All the data in the column will be lost.
  - Added the required column `email` to the `PreCustomerMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PreCustomerMaster" DROP COLUMN "eMail",
ADD COLUMN     "email" VARCHAR(100) NOT NULL;
