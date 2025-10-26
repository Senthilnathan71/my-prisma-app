-- CreateTable
CREATE TABLE "PaymentRequest" (
    "PaymentRequestSid" SERIAL NOT NULL,
    "PaymentRequestNumber" VARCHAR(20) NOT NULL,
    "PaymentRequestDate" DATE NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6),
    "UpdatedBy" VARCHAR(100),
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "CashBank" VARCHAR(10),
    "DepartmentMasterSid" INTEGER NOT NULL,
    "PaymentRequestStatus" "ApprovalStatus" NOT NULL,
    "Party" INTEGER NOT NULL,
    "PayableTo" VARCHAR(100) NOT NULL,
    "BookingSid" INTEGER,
    "MasterJobSid" INTEGER,
    "HouseJobSid" INTEGER,
    "Remarks" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "VoucherSid" INTEGER,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("PaymentRequestSid")
);

-- CreateTable
CREATE TABLE "PaymentRequestDetail" (
    "PaymentRequestDtlSid" SERIAL NOT NULL,
    "PaymentRequestSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6),
    "UpdatedBy" VARCHAR(100),
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "SerialNumber" DECIMAL(3,0),
    "ChargeMasterSid" INTEGER,
    "ChargeDescription" VARCHAR(100),
    "CostChargeUomSid" INTEGER,
    "CostCurrencyMasterSid" INTEGER,
    "CostExchangeRate" DECIMAL(9,3),
    "CostRate" DECIMAL(15,3),
    "CostNumberOfUnit" DECIMAL(4,3),
    "CostDrCr" CHAR(1),
    "CostAmount" DECIMAL(15,3),
    "CostLocalAmount" DECIMAL(15,3),
    "CostAgentMasterSid" INTEGER,
    "CostAgentBranchSid" INTEGER,

    CONSTRAINT "PaymentRequestDetail_pkey" PRIMARY KEY ("PaymentRequestDtlSid")
);

-- CreateTable
CREATE TABLE "CustomerCreditRequest" (
    "CustomerCreditRequestSid" SERIAL NOT NULL,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6) NOT NULL,
    "UpdatedBy" VARCHAR(100),
    "Status" CHAR(1) NOT NULL DEFAULT 'A',
    "CompanyMasterSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER,
    "CustomerBranchSid" INTEGER,
    "SalesmanSid" INTEGER,
    "CreditDays" INTEGER NOT NULL,
    "CreditLimit" INTEGER NOT NULL,
    "PublishedDays" INTEGER NOT NULL,
    "PublishedLimit" INTEGER NOT NULL,
    "EffectiveFrom" TIMESTAMP(3) NOT NULL,
    "EffectiveTo" TIMESTAMP(3) NOT NULL,
    "ApprovalStatus" "ApprovalStatus" NOT NULL,

    CONSTRAINT "CustomerCreditRequest_pkey" PRIMARY KEY ("CustomerCreditRequestSid")
);

-- CreateTable
CREATE TABLE "CustomerKyc" (
    "CustomerKycSid" SERIAL NOT NULL,
    "CustomerMasterSid" INTEGER,
    "CreatedOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "CreatedBy" VARCHAR(100) NOT NULL,
    "UpdatedOn" TIMESTAMPTZ(6),
    "UpdatedBy" VARCHAR(100),
    "CompanyMasterSid" INTEGER NOT NULL,
    "CustomerCreditRequestSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER,
    "KycSno" INTEGER NOT NULL,
    "KycDocName" VARCHAR(30) NOT NULL,
    "KycDocNumber" VARCHAR(30) NOT NULL,
    "AttachDocumentSid" INTEGER NOT NULL,

    CONSTRAINT "CustomerKyc_pkey" PRIMARY KEY ("CustomerKycSid")
);

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_Party_fkey" FOREIGN KEY ("Party") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_BookingSid_fkey" FOREIGN KEY ("BookingSid") REFERENCES "BookingHeader"("BookingHeaderSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_MasterJobSid_fkey" FOREIGN KEY ("MasterJobSid") REFERENCES "MasterJob"("MasterJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_HouseJobSid_fkey" FOREIGN KEY ("HouseJobSid") REFERENCES "HouseJob"("HouseJobSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_PaymentRequestSid_fkey" FOREIGN KEY ("PaymentRequestSid") REFERENCES "PaymentRequest"("PaymentRequestSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_ChargeMasterSid_fkey" FOREIGN KEY ("ChargeMasterSid") REFERENCES "ChargeMaster"("ChargeMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_CostChargeUomSid_fkey" FOREIGN KEY ("CostChargeUomSid") REFERENCES "UOMMaster"("UOMMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_CostCurrencyMasterSid_fkey" FOREIGN KEY ("CostCurrencyMasterSid") REFERENCES "CurrencyMaster"("CurrencyMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_CostAgentMasterSid_fkey" FOREIGN KEY ("CostAgentMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRequestDetail" ADD CONSTRAINT "PaymentRequestDetail_CostAgentBranchSid_fkey" FOREIGN KEY ("CostAgentBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditRequest" ADD CONSTRAINT "CustomerCreditRequest_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditRequest" ADD CONSTRAINT "CustomerCreditRequest_SalesmanSid_fkey" FOREIGN KEY ("SalesmanSid") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditRequest" ADD CONSTRAINT "CustomerCreditRequest_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditRequest" ADD CONSTRAINT "CustomerCreditRequest_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerKyc" ADD CONSTRAINT "CustomerKyc_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerKyc" ADD CONSTRAINT "CustomerKyc_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerKyc" ADD CONSTRAINT "CustomerKyc_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerKyc" ADD CONSTRAINT "CustomerKyc_CustomerCreditRequestSid_fkey" FOREIGN KEY ("CustomerCreditRequestSid") REFERENCES "CustomerCreditRequest"("CustomerCreditRequestSid") ON DELETE RESTRICT ON UPDATE CASCADE;
