-- AlterTable
ALTER TABLE "BookingHeader" ADD COLUMN     "AuthorizerRemarks" VARCHAR(100),
ADD COLUMN     "authorizerStatus" "ApprovalStatus";

-- AlterTable
ALTER TABLE "EnquiryHeader" ADD COLUMN     "AuthorizerRemarks" VARCHAR(100),
ADD COLUMN     "authorizerStatus" "ApprovalStatus";
