-- DropForeignKey
ALTER TABLE "QuoteHeader" DROP CONSTRAINT "QuoteHeader_CustomerMasterSid_fkey";

-- AlterTable
ALTER TABLE "ChargeGroup" ALTER COLUMN "Remarks" DROP NOT NULL;

-- AlterTable
ALTER TABLE "EnquiryHeader" ALTER COLUMN "LeadOrCustomer" SET DEFAULT 'C';

-- AlterTable
ALTER TABLE "EnquiryRoute" ADD COLUMN     "DepartmentMasterSid" INTEGER;

-- AlterTable
ALTER TABLE "QuoteCharge" ADD COLUMN     "CostAgentBranchSid" INTEGER,
ADD COLUMN     "CostAgentMasterSid" INTEGER,
ADD COLUMN     "CostAmount" DECIMAL(15,3),
ADD COLUMN     "CostChargeUomSid" INTEGER,
ADD COLUMN     "CostCurrencyMasterSid" INTEGER,
ADD COLUMN     "CostDrCr" CHAR(1) DEFAULT 'D',
ADD COLUMN     "CostExchangeRate" DECIMAL(6,3),
ADD COLUMN     "CostLocalAmount" DECIMAL(15,3),
ADD COLUMN     "CostNumberOfUnit" DECIMAL(4,3),
ADD COLUMN     "CostPrepaidCollect" VARCHAR(10),
ADD COLUMN     "CostRate" DECIMAL(15,3),
ADD COLUMN     "RevenueAmount" DECIMAL(15,3),
ADD COLUMN     "RevenueCurrencyMasterSid" INTEGER,
ADD COLUMN     "RevenueCustomerBranchSid" INTEGER,
ADD COLUMN     "RevenueCustomerMasterSid" INTEGER,
ADD COLUMN     "RevenueDrCr" CHAR(1) DEFAULT 'C',
ADD COLUMN     "RevenueExchangeRate" DECIMAL(6,3),
ADD COLUMN     "RevenueLocalAmount" DECIMAL(15,3),
ADD COLUMN     "RevenueNumberOfUnit" DECIMAL(4,3),
ADD COLUMN     "RevenuePrepaidCollect" VARCHAR(10) DEFAULT 'Prepaid',
ADD COLUMN     "RevenueRate" DECIMAL(15,3),
ADD COLUMN     "RevenyeChargeUomSid" INTEGER;

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "FreightPPCC" VARCHAR(10) DEFAULT 'Prepaid',
ADD COLUMN     "LeadOrCustomer" VARCHAR(1) DEFAULT 'C',
ADD COLUMN     "PreCustomerMasterSid" INTEGER,
ALTER COLUMN "CustomerMasterSid" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteHeader" ADD CONSTRAINT "QuoteHeader_PreCustomerMasterSid_fkey" FOREIGN KEY ("PreCustomerMasterSid") REFERENCES "PreCustomerMaster"("PreCustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
