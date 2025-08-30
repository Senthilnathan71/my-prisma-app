SELECT
  (row_number() OVER ()) :: integer AS unique_id,
  "CompanyMasterSid",
  "DepartmentMasterSid",
  "departmentName",
  "departmentCode",
  "departmentType",
  "ExportImport",
  "FCLLCL"
FROM
  "DepartmentMaster"
WHERE
  ("Status" = 'A' :: bpchar);