-- CreateTable
CREATE TABLE "CustomerBranch" (
    "CustomerBranchSid" SERIAL NOT NULL,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "StateMasterSid" INTEGER NOT NULL,
    "CityMasterSid" INTEGER NOT NULL,
    "BranchName" VARCHAR(20) NOT NULL,
    "Zip_PostBox" VARCHAR(10),
    "TanNo" VARCHAR(20),
    "Address" VARCHAR(200) NOT NULL,
    "Email" VARCHAR(200) NOT NULL,
    "Registered" CHAR(1) NOT NULL,
    "CustomerGstType" VARCHAR(10),
    "VendorGstType" VARCHAR(10),
    "GSTNo" VARCHAR(15),
    "ContactNo" VARCHAR(20),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "CustomerBranch_pkey" PRIMARY KEY ("CustomerBranchSid")
);

-- CreateTable
CREATE TABLE "CusBranchContact" (
    "CusBranchContactSid" SERIAL NOT NULL,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "ContactType" VARCHAR(10) NOT NULL,
    "ContactName" VARCHAR(50) NOT NULL,
    "ContactNo" VARCHAR(15),
    "MobileNo" VARCHAR(15),
    "Email" VARCHAR(100),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "CusBranchContact_pkey" PRIMARY KEY ("CusBranchContactSid")
);

-- CreateTable
CREATE TABLE "CustomerBrEmail" (
    "CustomerBrEmailSid" SERIAL NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "Toemail" VARCHAR(100) NOT NULL,
    "CCemail" VARCHAR(100),
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "CustomerBrEmail_pkey" PRIMARY KEY ("CustomerBrEmailSid")
);

-- CreateTable
CREATE TABLE "CustomerLogin" (
    "CustomerLoginSid" SERIAL NOT NULL,
    "CustomerMasterSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "LoginName" VARCHAR(50) NOT NULL,
    "LoginEmail" VARCHAR(50) NOT NULL,
    "LoginPassword" VARCHAR(10) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "CustomerLogin_pkey" PRIMARY KEY ("CustomerLoginSid")
);

-- CreateTable
CREATE TABLE "CustomerSalesTeam" (
    "CustomerSalesSid" SERIAL NOT NULL,
    "Salesman" INTEGER NOT NULL,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "EffectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "CustomerSalesTeam_pkey" PRIMARY KEY ("CustomerSalesSid")
);

-- CreateTable
CREATE TABLE "CustomerSupport" (
    "CustomerSupportSid" SERIAL NOT NULL,
    "UserMasterSid" INTEGER NOT NULL,
    "ContactType" VARCHAR(15) NOT NULL,
    "DepartmentMasterSid" INTEGER NOT NULL,
    "CustomerBranchSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "EffectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "CustomerSupport_pkey" PRIMARY KEY ("CustomerSupportSid")
);

-- AddForeignKey
ALTER TABLE "CustomerBranch" ADD CONSTRAINT "CustomerBranch_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBranch" ADD CONSTRAINT "CustomerBranch_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBranch" ADD CONSTRAINT "CustomerBranch_StateMasterSid_fkey" FOREIGN KEY ("StateMasterSid") REFERENCES "StateMaster"("StateMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBranch" ADD CONSTRAINT "CustomerBranch_CityMasterSid_fkey" FOREIGN KEY ("CityMasterSid") REFERENCES "CityMaster"("CityMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CusBranchContact" ADD CONSTRAINT "CusBranchContact_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CusBranchContact" ADD CONSTRAINT "CusBranchContact_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CusBranchContact" ADD CONSTRAINT "CusBranchContact_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBrEmail" ADD CONSTRAINT "CustomerBrEmail_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBrEmail" ADD CONSTRAINT "CustomerBrEmail_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerBrEmail" ADD CONSTRAINT "CustomerBrEmail_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLogin" ADD CONSTRAINT "CustomerLogin_CustomerMasterSid_fkey" FOREIGN KEY ("CustomerMasterSid") REFERENCES "CustomerMaster"("CustomerMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLogin" ADD CONSTRAINT "CustomerLogin_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLogin" ADD CONSTRAINT "CustomerLogin_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSupport" ADD CONSTRAINT "CustomerSupport_UserMasterSid_fkey" FOREIGN KEY ("UserMasterSid") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSupport" ADD CONSTRAINT "CustomerSupport_CustomerBranchSid_fkey" FOREIGN KEY ("CustomerBranchSid") REFERENCES "CustomerBranch"("CustomerBranchSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSupport" ADD CONSTRAINT "CustomerSupport_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSupport" ADD CONSTRAINT "CustomerSupport_DepartmentMasterSid_fkey" FOREIGN KEY ("DepartmentMasterSid") REFERENCES "DepartmentMaster"("DepartmentMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
