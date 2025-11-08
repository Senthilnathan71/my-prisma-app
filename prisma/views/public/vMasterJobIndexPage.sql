SELECT
  mj."MasterJobSid",
  mj."CompanyMasterSid",
  mj."BranchMasterSid",
  dm."departmentName",
  dm."departmentType",
  mj."MasterJobNumber",
  mj."MasterJobDate",
  mj."MBLNo",
  mj."MBLDate",
  mj."POL",
  mj."POD",
  mj."FPD" AS "FDC",
  COALESCE(cc."NoOfContainers", 0) AS "NoOfContainers",
  COALESCE(hc."NoOfHouses", 0) AS "NoOfHouses",
  mj."Status"
FROM
  (
    (
      (
        "MasterJob" mj
        LEFT JOIN (
          SELECT
            "MasterJobContainer"."MasterJobSid",
            (count(*)) :: integer AS "NoOfContainers"
          FROM
            "MasterJobContainer"
          WHERE
            ("MasterJobContainer"."Status" = 'A' :: bpchar)
          GROUP BY
            "MasterJobContainer"."MasterJobSid"
        ) cc ON ((mj."MasterJobSid" = cc."MasterJobSid"))
      )
      LEFT JOIN (
        SELECT
          "HouseJob"."MasterJobSid",
          (count(*)) :: integer AS "NoOfHouses"
        FROM
          "HouseJob"
        WHERE
          ("HouseJob".status = 'A' :: bpchar)
        GROUP BY
          "HouseJob"."MasterJobSid"
      ) hc ON ((mj."MasterJobSid" = hc."MasterJobSid"))
    )
    LEFT JOIN "DepartmentMaster" dm ON (
      (
        mj."DepartmentMasterSid" = dm."DepartmentMasterSid"
      )
    )
  )
WHERE
  (mj."Status" = 'A' :: bpchar);