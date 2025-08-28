SELECT
  row_number() OVER () AS unique_id,
  "CompanyMasterSid",
  "DepartmentMasterSid",
  "departmentName",
  "departmentCode",
  "departmentType",
  "ExportImport",
  "FCLLCL",
  "Division",
  "Status"
FROM
  "DepartmentMaster"
WHERE
  ("Status" = 'A' :: bpchar);