-- CreateTable
CREATE TABLE "BranchBank" (
    "BranchBankSid" SERIAL NOT NULL,
    "BankCode" VARCHAR(50) NOT NULL,
    "BankName" VARCHAR(100) NOT NULL,
    "BankAddress" VARCHAR(500),
    "IFSCCode" VARCHAR(20),
    "BankAccountNo" VARCHAR(50),
    "BeneficiaryName" VARCHAR(100),
    "BranchMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300),

    CONSTRAINT "BranchBank_pkey" PRIMARY KEY ("BranchBankSid")
);

-- CreateTable
CREATE TABLE "UserCompanyMaster" (
    "UserCompanyMasterSid" SERIAL NOT NULL,
    "UserMasterSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "GiveAccess" CHAR(1) DEFAULT 'N',
    "IsDefault" CHAR(1) DEFAULT 'N',

    CONSTRAINT "UserCompanyMaster_pkey" PRIMARY KEY ("UserCompanyMasterSid")
);

-- CreateTable
CREATE TABLE "PreCustomerEvent" (
    "PreCustomerEventSid" SERIAL NOT NULL,
    "EventName" VARCHAR(100) NOT NULL,
    "EventCity" VARCHAR(100) NOT NULL,
    "EventDate" TIMESTAMP(3) NOT NULL,
    "TotalLeadRecd" INTEGER NOT NULL DEFAULT 0,
    "TotalLeadSuccess" INTEGER NOT NULL DEFAULT 0,
    "EventLeader" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300),

    CONSTRAINT "PreCustomerEvent_pkey" PRIMARY KEY ("PreCustomerEventSid")
);

-- CreateTable
CREATE TABLE "ContainerTypeMaster" (
    "ContainerTypeMasterSid" SERIAL NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "ContainerCode" VARCHAR(4) NOT NULL,
    "ContainerSize" CHAR(2) NOT NULL,
    "ContainerIsoCode" VARCHAR(4),
    "ContainerName" VARCHAR(30) NOT NULL,
    "ContainerCateory" VARCHAR(10),
    "MaxVolume" DECIMAL(3,0) NOT NULL,
    "TareWeight" DECIMAL(6,3) NOT NULL,
    "GrossWeight" DECIMAL(8,3) NOT NULL,
    "NoofTeu" DECIMAL(1,0) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300),

    CONSTRAINT "ContainerTypeMaster_pkey" PRIMARY KEY ("ContainerTypeMasterSid")
);

-- CreateTable
CREATE TABLE "ModuleMaster" (
    "ModuleMasterSid" SERIAL NOT NULL,
    "ModuleName" VARCHAR(20) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300),

    CONSTRAINT "ModuleMaster_pkey" PRIMARY KEY ("ModuleMasterSid")
);

-- CreateTable
CREATE TABLE "UserRoleMaster" (
    "UserRoleMasterSid" SERIAL NOT NULL,
    "UserMasterSid" INTEGER NOT NULL,
    "RoleMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300),

    CONSTRAINT "UserRoleMaster_pkey" PRIMARY KEY ("UserRoleMasterSid")
);

-- CreateTable
CREATE TABLE "MenuMaster" (
    "MenuMasterSid" SERIAL NOT NULL,
    "MenuCode" CHAR(3) NOT NULL,
    "MenuName" VARCHAR(50) NOT NULL,
    "MenuType" VARCHAR(50) NOT NULL,
    "ModuleMasterSid" INTEGER NOT NULL,
    "ModuleName" VARCHAR(50) NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300),

    CONSTRAINT "MenuMaster_pkey" PRIMARY KEY ("MenuMasterSid")
);

-- CreateTable
CREATE TABLE "RoleMaster" (
    "RoleMasterSid" SERIAL NOT NULL,
    "UserRoleCode" CHAR(3) NOT NULL,
    "UserRoleName" VARCHAR(50) NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',
    "Remarks" VARCHAR(300),

    CONSTRAINT "RoleMaster_pkey" PRIMARY KEY ("RoleMasterSid")
);

-- CreateTable
CREATE TABLE "RoleMenuMaster" (
    "RoleMenuMasterSid" SERIAL NOT NULL,
    "RoleMasterSid" INTEGER NOT NULL,
    "MenuMasterSid" INTEGER NOT NULL,
    "CompanyMasterSid" INTEGER NOT NULL,
    "InsertRole" CHAR(1) DEFAULT 'Y',
    "ViewRole" CHAR(1) DEFAULT 'Y',
    "UpdateRole" CHAR(1) DEFAULT 'Y',
    "DeleteRole" CHAR(1) DEFAULT 'N',
    "createdOn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedOn" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMP(3),
    "createdBy" VARCHAR(100) NOT NULL,
    "updatedBy" VARCHAR(100),
    "status" CHAR(1) DEFAULT 'A',

    CONSTRAINT "RoleMenuMaster_pkey" PRIMARY KEY ("RoleMenuMasterSid")
);

-- AddForeignKey
ALTER TABLE "BranchBank" ADD CONSTRAINT "BranchBank_BranchMasterSid_fkey" FOREIGN KEY ("BranchMasterSid") REFERENCES "BranchMaster"("BranchMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompanyMaster" ADD CONSTRAINT "UserCompanyMaster_UserMasterSid_fkey" FOREIGN KEY ("UserMasterSid") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompanyMaster" ADD CONSTRAINT "UserCompanyMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreCustomerEvent" ADD CONSTRAINT "PreCustomerEvent_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerTypeMaster" ADD CONSTRAINT "ContainerTypeMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleMaster" ADD CONSTRAINT "UserRoleMaster_UserMasterSid_fkey" FOREIGN KEY ("UserMasterSid") REFERENCES "UserMaster"("UserMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleMaster" ADD CONSTRAINT "UserRoleMaster_RoleMasterSid_fkey" FOREIGN KEY ("RoleMasterSid") REFERENCES "RoleMaster"("RoleMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuMaster" ADD CONSTRAINT "MenuMaster_ModuleMasterSid_fkey" FOREIGN KEY ("ModuleMasterSid") REFERENCES "ModuleMaster"("ModuleMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMaster" ADD CONSTRAINT "RoleMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuMaster" ADD CONSTRAINT "RoleMenuMaster_RoleMasterSid_fkey" FOREIGN KEY ("RoleMasterSid") REFERENCES "RoleMaster"("RoleMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuMaster" ADD CONSTRAINT "RoleMenuMaster_MenuMasterSid_fkey" FOREIGN KEY ("MenuMasterSid") REFERENCES "MenuMaster"("MenuMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuMaster" ADD CONSTRAINT "RoleMenuMaster_CompanyMasterSid_fkey" FOREIGN KEY ("CompanyMasterSid") REFERENCES "CompanyMaster"("CompanyMasterSid") ON DELETE RESTRICT ON UPDATE CASCADE;
