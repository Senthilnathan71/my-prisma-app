-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('Pending', 'Approved', 'Rejected');

-- AlterTable
ALTER TABLE "QuoteHeader" ADD COLUMN     "AuthorizerRemarks" VARCHAR(100),
ADD COLUMN     "authorizerStatus" "ApprovalStatus";
