SELECT
  DISTINCT bh."CompanyMasterSid",
  bh."BookingHeaderSid",
  vh."VoucherHeaderSid",
  vh."VoucherNumber",
  date_trunc(
    'D' :: text,
    (vh."VoucherDate") :: timestamp WITH time zone
  ) AS "VoucherDate",
  bh."HBLNo",
  vt."DocumentTypeCode",
  vh."CurrencyCode",
  vh."Amount",
  vh."LocalAmount",
  vh."PostStatus"
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
            (
              br."RevenueVoucherHeaderSid" = vh."VoucherHeaderSid"
            )
            OR (
              br."CostVoucherHeaderSid" = vh."VoucherHeaderSid"
            )
          )
          AND (vh."Status" = 'A' :: bpchar)
        )
      )
    )
    JOIN "VoucherTypeMaster" vt ON ((vt."VoucherTypeMasterSid" = vh."VoucherType"))
  );