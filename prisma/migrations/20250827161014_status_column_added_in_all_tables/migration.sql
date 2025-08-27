-- AlterTable
ALTER TABLE "BookingRates" ALTER COLUMN "Status" DROP NOT NULL,
ALTER COLUMN "Status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "BranchMaster" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "COAMaster" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ChargeGroup" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "ChargeMaster" ALTER COLUMN "Status" DROP NOT NULL,
ALTER COLUMN "Status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "ChargeTaxMaster" ALTER COLUMN "Status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "CityMaster" ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CompanyMaster" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "ContainerActivityMaster" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CostCenterMaster" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CountryMaster" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "CurrencyExchange" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "CurrencyMaster" ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DepartmentMaster" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DepartmentOnTerms" ADD COLUMN     "status" CHAR(1) DEFAULT 'A';

-- AlterTable
ALTER TABLE "DivisionMaster" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "EmailLog" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EnquiryRoute" ADD COLUMN     "status" CHAR(1) DEFAULT 'A';

-- AlterTable
ALTER TABLE "FavouriteScreen" ADD COLUMN     "status" CHAR(1) DEFAULT 'A';

-- AlterTable
ALTER TABLE "IncoMaster" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MeetingFollowup" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PreCustomerMaster" ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "PreCustomerMeeting" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "ProfitCenterMaster" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RecentScreen" ADD COLUMN     "status" CHAR(1) DEFAULT 'A';

-- AlterTable
ALTER TABLE "RoutingHeader" ADD COLUMN     "status" CHAR(1) DEFAULT 'A';

-- AlterTable
ALTER TABLE "SectorMaster" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "ShipmentMilestone" ALTER COLUMN "Status" DROP NOT NULL,
ALTER COLUMN "Status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "ShortCut" ADD COLUMN     "status" CHAR(1) DEFAULT 'A';

-- AlterTable
ALTER TABLE "StateMaster" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "TaxMaster" ALTER COLUMN "Status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UnitMaster" ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserBranchMaster" ALTER COLUMN "status" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'A';

-- AlterTable
ALTER TABLE "UserLoginHistory" ADD COLUMN     "status" CHAR(1) DEFAULT 'A';

-- AlterTable
ALTER TABLE "UserMaster" ALTER COLUMN "status" DROP NOT NULL;
