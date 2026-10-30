SELECT
  mj."CompanyMasterSid",
  mj."MasterJobSid",
  vh."VoucherHeaderSid",
  vh."VoucherNumber",
  date_trunc(
    'D' :: text,
    (vh."VoucherDate") :: timestamp WITH time zone
  ) AS "VoucherDate",
  mj."MBLNo",
  vt."DocumentTypeCode",
  vh."CurrencyCode",
  sum(vd."Amount") AS "Amount",
  sum(vd."LocalAmount") AS "LocalAmount",
  vh."PostStatus"
FROM
  (
    (
      (
        "MasterJob" mj
        JOIN "VoucherDetail" vd ON ((vd."MasterJobSid" = mj."MasterJobSid"))
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
  mj."CompanyMasterSid",
  mj."MasterJobSid",
  vh."VoucherHeaderSid",
  vh."VoucherNumber",
  vh."VoucherDate",
  mj."MBLNo",
  vt."DocumentTypeCode",
  vh."CurrencyCode",
  vh."PostStatus";