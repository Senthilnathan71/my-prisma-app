-- CreateTable
CREATE TABLE "TermsAndConditionsMaster" (
    "TermsAndConditionsMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "BranchMasterSid" INTEGER NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "PrintType" VARCHAR(20) NOT NULL,
    "POL" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "POD" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "FDC" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "Carrier" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(500),

    CONSTRAINT "TermsAndConditionsMaster_pkey" PRIMARY KEY ("TermsAndConditionsMasterSid")
);

-- CreateTable
CREATE TABLE "DepartmentOnTerms" (
    "DepartmentOnTermSid" SERIAL NOT NULL,
    "termsId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DepartmentOnTerms_pkey" PRIMARY KEY ("DepartmentOnTermSid")
);

-- CreateTable
CREATE TABLE "TermsAndConditionsDetail" (
    "TermsAndConditionsDetailSid" SERIAL NOT NULL,
    "TermsAndConditionsMasterSid" INTEGER NOT NULL,
    "TandC" VARCHAR(500) NOT NULL,
    "Type" VARCHAR(20),
    "TypeValue" VARCHAR(20),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "IsDefaut" CHAR(1) NOT NULL DEFAULT 'A',

    CONSTRAINT "TermsAndConditionsDetail_pkey" PRIMARY KEY ("TermsAndConditionsDetailSid")
);

-- AddForeignKey
ALTER TABLE "TermsAndConditionsMaster" ADD CONSTRAINT "TermsAndConditionsMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAndConditionsMaster" ADD CONSTRAINT "TermsAndConditionsMaster_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAndConditionsMaster" ADD CONSTRAINT "TermsAndConditionsMaster_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentOnTerms" ADD CONSTRAINT "DepartmentOnTerms_termsId_fkey" FOREIGN KEY ("termsId") REFERENCES "TermsAndConditionsMaster"("TermsAndConditionsMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentOnTerms" ADD CONSTRAINT "DepartmentOnTerms_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAndConditionsDetail" ADD CONSTRAINT "TermsAndConditionsDetail_TermsAndConditionsMasterSid_fkey" FOREIGN KEY ("TermsAndConditionsMasterSid") REFERENCES "TermsAndConditionsMaster"("TermsAndConditionsMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
