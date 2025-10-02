-- AlterTable
ALTER TABLE "CustomerSalesTeam" ALTER COLUMN "Salesman" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_Salesman_fkey" FOREIGN KEY ("Salesman") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_DocPerson_fkey" FOREIGN KEY ("DocPerson") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSalesTeam" ADD CONSTRAINT "CustomerSalesTeam_CSPerson_fkey" FOREIGN KEY ("CSPerson") REFERENCES "UserMaster"("UserMasterSid") ON DELETE SET NULL ON UPDATE CASCADE;
