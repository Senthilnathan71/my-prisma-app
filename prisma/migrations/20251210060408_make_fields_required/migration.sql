BEGIN;

-- Verify NULL counts BEFORE backfill (optional but recommended)
-- SELECT COUNT(*) FROM "VoucherDetail" WHERE "DrCr" IS NULL;
-- SELECT COUNT(*) FROM "VoucherDetail" WHERE "COAMasterSid" IS NULL;
-- SELECT COUNT(*) FROM "VoucherDetail" WHERE "YearMasterSid" IS NULL;

-- 1) Backfill existing NULLs with valid IDs
UPDATE "VoucherDetail"
SET "DrCr" = 'D'
WHERE "DrCr" IS NULL;

UPDATE "VoucherDetail"
SET "COAMasterSid" = 54
WHERE "COAMasterSid" IS NULL;

UPDATE "VoucherDetail"
SET "YearMasterSid" = 21
WHERE "YearMasterSid" IS NULL;

-- 2) Verify NO NULLs remain BEFORE setting NOT NULL (safety check)
-- Run these separately first if you want to be extra safe:
-- SELECT COUNT(*) FROM "VoucherDetail" WHERE "DrCr" IS NULL;
-- SELECT COUNT(*) FROM "VoucherDetail" WHERE "COAMasterSid" IS NULL;
-- SELECT COUNT(*) FROM "VoucherDetail" WHERE "YearMasterSid" IS NULL;

-- 3) Enforce NOT NULL on all three columns
ALTER TABLE "VoucherDetail"
    ALTER COLUMN "DrCr" SET NOT NULL,
    ALTER COLUMN "COAMasterSid" SET NOT NULL,
    ALTER COLUMN "YearMasterSid" SET NOT NULL;

COMMIT;
