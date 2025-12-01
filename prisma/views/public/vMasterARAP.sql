SELECT
  mj."CompanyMasterSid",
  mj."MasterJobSid",
  mj."MBLNo",
  vh."VoucherNumber",
  vh."VoucherHeaderSid",
  vh."VoucherDate",
  vt."DocumentTypeCode",
  vh."CurrencyCode",
  vh."Amount",
  vh."LocalAmount"
FROM
  (
    (
      (
        "MasterJob" mj
        JOIN "CostRevenueCharges" cr ON ((mj."MasterJobSid" = cr."TransactionSid"))
      )
      JOIN "VoucherHeader" vh ON (
        (
          (
            cr."CostVoucherHeaderSid" = vh."VoucherHeaderSid"
          )
          OR (
            cr."RevenueVoucherHeaderSid" = vh."VoucherHeaderSid"
          )
        )
      )
    )
    JOIN "VoucherTypeMaster" vt ON (
      (
        vt."VoucherTypeMasterSid" = vh."VoucherTypeMasterSid"
      )
    )
  );