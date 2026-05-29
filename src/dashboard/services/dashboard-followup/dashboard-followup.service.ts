import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { DashboardFollowupsQueryDto } from '../../DTO/sales-dashboard.dto';

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

@Injectable()
export class DashboardFollowupService {
  constructor(private readonly db: DatabaseService) {}

  async getDashboardFollowups(
    query: DashboardFollowupsQueryDto,
    userId: number,
    userEmail: string,
  ): Promise<PagedResult<any>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const mode = query.mode ?? 'our';

    const safeEmail = (userEmail || '').replace(/'/g, "''");
    const modeClause = mode === 'our'
      ? `f."InternalUser" = $3::int`
      : `f."CreatedBy" = '${safeEmail}'`;

    const baseParams: any[] = mode === 'our'
      ? [
          Number(query.companyMasterSid),
          Number(query.branchMasterSid),
          userId ? Number(userId) : null,
          query.menuMasterSid != null ? Number(query.menuMasterSid) : null,
        ]
      : [
          Number(query.companyMasterSid),
          Number(query.branchMasterSid),
          query.menuMasterSid != null ? Number(query.menuMasterSid) : null,
        ];

    const menuParamIndex = mode === 'our' ? 4 : 3;
    const menuClause = `($${menuParamIndex}::int IS NULL OR f."MenuMasterSid" = $${menuParamIndex}::int)`;

    let statusClause = '';
    if (query.followUpStatus === 'overdue') {
      statusClause = `AND f."FollowupDate"::date < CURRENT_DATE`;
    } else if (query.followUpStatus === 'today') {
      statusClause = `AND f."FollowupDate"::date = CURRENT_DATE`;
    } else if (query.followUpStatus === 'upcoming') {
      statusClause = `AND f."FollowupDate"::date > CURRENT_DATE`;
    }

    const whereClause = `
      f."Status" = 'A'
      AND COALESCE(f."IsCompleted", 'N') = 'N'
      AND f."CompanyMasterSid" = $1::int
      AND f."BranchMasterSid" = $2::int
      AND ${modeClause}
      AND ${menuClause}
      ${statusClause}
    `;

    const offset = (page - 1) * pageSize;

    const [rows, countResult] = await Promise.all([
      this.db.$queryRawUnsafe(
        `SELECT
          f."FollowupSid",
          f."DocumentSid",
          COALESCE(
            eh."EnquiryNumber",
            qh."QuoteNumber",
            bh."BookingNo",
            hj."HBLNo",
            mj."MasterJobNumber",
            f."AttachDocmentNo"
          ) AS "documentNo",
          f."Subject",
          f."FollowupDate" AS "followupDate",
          f."MenuMasterSid",
          mm."MenuName" AS "menuName",
          mm."path" AS "menuPath",
          CASE
            WHEN f."FollowupDate"::date < CURRENT_DATE THEN 'Overdue'
            WHEN f."FollowupDate"::date = CURRENT_DATE THEN 'Due Today'
            ELSE 'Upcoming'
          END AS "followUpStatus"
        FROM "Followup" f
        LEFT JOIN "MenuMaster" mm ON f."MenuMasterSid" = mm."MenuMasterSid"
        LEFT JOIN "EnquiryHeader" eh ON mm."path" LIKE '%/crm/enquiry%' AND f."DocumentSid" = eh."EnquiryHeaderSid"
        LEFT JOIN "QuoteHeader" qh ON mm."path" LIKE '%/crm/quotation%' AND f."DocumentSid" = qh."QuoteHeaderSid"
        LEFT JOIN "BookingHeader" bh ON mm."path" LIKE '%operation/booking/%' AND f."DocumentSid" = bh."BookingHeaderSid"
        LEFT JOIN "HouseJob" hj ON mm."path" LIKE '%/operation/house-job%' AND f."DocumentSid" = hj."HouseJobSid"
        LEFT JOIN "MasterJob" mj ON mm."path" LIKE '%operation/master-job%' AND f."DocumentSid" = mj."MasterJobSid"
        WHERE ${whereClause}
        ORDER BY f."FollowupDate" DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
        ...baseParams,
      ),
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "Followup" f
        WHERE ${whereClause}`,
        ...baseParams,
      ),
    ]);

    const totalCount = Number((countResult as any[])[0]?.count) || 0;
    return {
      items: rows as any[],
      page,
      pageSize,
      totalCount,
      hasMore: page * pageSize < totalCount,
    };
  }

  async completeDashboardFollowup(followupSid: number, updatedBy: string) {
    return this.db.followup.update({
      where: { FollowupSid: followupSid },
      data: { IsCompleted: 'Y', UpdatedBy: updatedBy, UpdatedOn: new Date() },
    });
  }
}
