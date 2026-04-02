-- AlterTable
ALTER TABLE "CompanyMaster" ALTER COLUMN "companyCode" SET DATA TYPE VARCHAR(10);

-- AlterTable
ALTER TABLE "CostRevenueCharges" ADD COLUMN     "PaymentRequestSid" INTEGER;

-- AlterTable
ALTER TABLE "MatchingDetail" ADD COLUMN     "CreatedBy" VARCHAR(100),
ADD COLUMN     "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "UpdatedBy" VARCHAR(100),
ADD COLUMN     "UpdatedOn" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "RoleMenuDetail" ADD COLUMN     "PostRole" CHAR(1) DEFAULT 'N';

-- CreateTable
CREATE TABLE "PrintMaster" (
    "PrintMasterSid" SERIAL NOT NULL,
    "Name" VARCHAR(50) NOT NULL,
    "PrintMail" VARCHAR(20) NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "RoleMenuHeaderSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "Status" CHAR(1) DEFAULT 'A',
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedOn" TIMESTAMPTZ(6),
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedBy" VARCHAR(100),

    CONSTRAINT "PrintMaster_pkey" PRIMARY KEY ("PrintMasterSid")
);

-- CreateIndex
CREATE INDEX "PrintMaster_CompanyMasterSid_RoleMenuHeaderSid_MenuMasterSi_idx" ON "PrintMaster"("CompanyMasterSid", "RoleMenuHeaderSid", "MenuMasterSid", "Name", "Status");

-- CreateIndex
CREATE INDEX "PrintMaster_CompanyMasterSid_PrintMail_idx" ON "PrintMaster"("CompanyMasterSid", "PrintMail");

-- CreateIndex
CREATE INDEX "idx_audit_log" ON "AuditLog"("tableName", "recordId", "changedAt");

-- CreateIndex
CREATE INDEX "ChargeMaster_CompanyMasterSid_Status_idx" ON "ChargeMaster"("CompanyMasterSid", "Status");

-- CreateIndex
CREATE INDEX "MasterJobContainer_MasterJobSid_Status_idx" ON "MasterJobContainer"("MasterJobSid", "Status");

-- CreateIndex
CREATE INDEX "StateMaster_CountryMasterSid_status_idx" ON "StateMaster"("CountryMasterSid", "status");

-- CreateIndex
CREATE INDEX "idx_subledger_cr_coa" ON "SubledgerMaster"("CompanyMasterSid", "SubledgerMappingSid", "SubledgerType", "CrCOAMasterSid", "Status");

-- CreateIndex
CREATE INDEX "idx_subledger_dr_coa" ON "SubledgerMaster"("CompanyMasterSid", "SubledgerMappingSid", "SubledgerType", "DrCOAMasterSid", "Status");

-- CreateIndex
CREATE INDEX "idx_subledger_accrual_coa" ON "SubledgerMaster"("CompanyMasterSid", "SubledgerMappingSid", "SubledgerType", "AccrualCOAMasterSid", "Status");

-- CreateIndex
CREATE INDEX "UserLoginHistory_userId_loginTime_idx" ON "UserLoginHistory"("userId", "loginTime");

-- CreateIndex
CREATE INDEX "VoucherDetail_VoucherHeaderSid_idx" ON "VoucherDetail"("VoucherHeaderSid");

-- CreateIndex
CREATE INDEX "VoucherDetail_CompanyMasterSid_BranchMasterSid_VoucherHeade_idx" ON "VoucherDetail"("CompanyMasterSid", "BranchMasterSid", "VoucherHeaderSid");

-- CreateIndex
CREATE INDEX "VoucherTransaction_VoucherHeaderSid_idx" ON "VoucherTransaction"("VoucherHeaderSid");

-- CreateIndex
CREATE INDEX "VoucherTransaction_VoucherDetailSid_idx" ON "VoucherTransaction"("VoucherDetailSid");

-- CreateIndex
CREATE INDEX "VoucherTransaction_CompanyMasterSid_BranchMasterSid_Voucher_idx" ON "VoucherTransaction"("CompanyMasterSid", "BranchMasterSid", "VoucherHeaderSid");

-- AddForeignKey
ALTER TABLE "CostRevenueCharges" ADD CONSTRAINT "CostRevenueCharges_PaymentRequestSid_fkey" FOREIGN KEY ("PaymentRequestSid") REFERENCES "PaymentRequest"("PaymentRequestSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintMaster" ADD CONSTRAINT "PrintMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintMaster" ADD CONSTRAINT "PrintMaster_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintMaster" ADD CONSTRAINT "PrintMaster_RoleMenuHeaderSid_fkey" FOREIGN KEY ("RoleMenuHeaderSid") REFERENCES "RoleMenuHeader"("RoleMenuHeaderSid") ON DELETE RESTRICT ON UPDATE CASCADE;
