SELECT
  hj."CompanyMasterSid",
  hj."HouseJobSid",
  hj."HBLNo",
  vh."VoucherNumber",
  vh."VoucherHeaderSid",
  vh."VoucherDate",
  vt."DocumentTypeCode",
  vh."CurrencyCode",
  vh."Amount"
FROM
  (
    (
      (
        "HouseJob" hj
        JOIN "CostRevenueCharges" cr ON ((hj."HouseJobSid" = cr."TransactionSid"))
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