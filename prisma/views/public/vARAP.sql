SELECT
  vh."VoucherNumber",
  vh."VoucherHeaderSid",
  vh."VoucherDate",
  vt."DocumentTypeCode",
  vh."CurrencyCode",
  vh."Amount",
  vh."LocalAmount",
  bh."BookingHeaderSid",
  bh."CompanyMasterSid",
  bh."HBLNo"
FROM
  (
    (
      (
        "BookingHeader" bh
        JOIN "BookingRates" br ON ((bh."BookingHeaderSid" = br."BookingHeaderSid"))
      )
      JOIN "VoucherHeader" vh ON (
        (
          (
            br."RevenueVoucherHeaderSid" = vh."VoucherHeaderSid"
          )
          OR (
            (
              br."CostVoucherHeaderSid" = vh."VoucherHeaderSid"
            )
            AND (vh."Status" = 'A' :: bpchar)
          )
        )
      )
    )
    JOIN "VoucherTypeMaster" vt ON ((vt."VoucherTypeMasterSid" = vh."VoucherType"))
  );