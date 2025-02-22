-- AlterTable
ALTER TABLE "ChargeGroup" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChargeMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CityMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CountryMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CurrencyMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DepartmentMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PortMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PreCustomerMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PreCustomerMeeting" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SectorMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StateMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserBranchMaster" ALTER COLUMN "updatedBy" DROP NOT NULL;
