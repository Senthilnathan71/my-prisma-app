SELECT
  hj."CompanyMasterSid",
  hj."HouseJobSid",
  vh."VoucherHeaderSid",
  vh."VoucherNumber",
  date_trunc('D' :: text, vh."VoucherDate") AS "VoucherDate",
  hj."HBLNo",
  vt."DocumentTypeCode",
  vh."CurrencyCode",
  sum(vd."Amount") AS "Amount",
  sum(vd."LocalAmount") AS "LocalAmount",
  vh."PostStatus"
FROM
  (
    (
      (
        "HouseJob" hj
        JOIN "VoucherDetail" vd ON ((vd."HouseJobSid" = hj."HouseJobSid"))
      )
      JOIN "VoucherHeader" vh ON ((vh."VoucherHeaderSid" = vd."VoucherHeaderSid"))
    )
    JOIN "VoucherTypeMaster" vt ON (
      (
        vt."VoucherTypeMasterSid" = vh."VoucherTypeMasterSid"
      )
    )
  )
GROUP BY
  hj."CompanyMasterSid",
  hj."HouseJobSid",
  vh."VoucherHeaderSid",
  vh."VoucherNumber",
  vh."VoucherDate",
  hj."HBLNo",
  vt."DocumentTypeCode",
  vh."CurrencyCode",
  vh."PostStatus";