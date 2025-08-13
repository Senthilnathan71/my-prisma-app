-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "newVal" JSONB,
ADD COLUMN     "oldVal" JSONB;
