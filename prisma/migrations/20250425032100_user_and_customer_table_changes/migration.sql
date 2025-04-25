/*
  Warnings:

  - You are about to drop the column `PreCustomerAddress1` on the `CustomerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `PreCustomerAddress2` on the `CustomerMaster` table. All the data in the column will be lost.
  - You are about to drop the column `userLogin` on the `UserMaster` table. All the data in the column will be lost.
  - Added the required column `CustomerAddress1` to the `CustomerMaster` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomerMaster" DROP COLUMN "PreCustomerAddress1",
DROP COLUMN "PreCustomerAddress2",
ADD COLUMN     "CustomerAddress1" VARCHAR(300) NOT NULL,
ADD COLUMN     "CustomerAddress2" VARCHAR(300),
ADD COLUMN     "LocalLanguage" VARCHAR(100);

-- AlterTable
ALTER TABLE "UserMaster" DROP COLUMN "userLogin",
ADD COLUMN     "CostRevenue" VARCHAR(10),
ADD COLUMN     "DefaultDept" VARCHAR(20),
ADD COLUMN     "DeptHead" INTEGER,
ADD COLUMN     "Principal" INTEGER,
ADD COLUMN     "isLoginUser" CHAR(1),
ALTER COLUMN "status" SET DEFAULT 'A';
