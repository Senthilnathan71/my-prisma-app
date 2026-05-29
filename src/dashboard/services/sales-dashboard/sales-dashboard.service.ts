import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/settings/services/menu/menu.service';
import { SalesDashboardQueryDto } from '../../DTO/sales-dashboard.dto';

type SectionBucket = 'overdue' | 'today' | 'future';

interface NormalizedParams {
  companyMasterSid: number;
  branchMasterSid: number;
  salespersonId: number | null;
  salespersonEmail: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  naiveDateFrom: string | null;
  naiveDateTo: string | null;
  page: number;
  pageSize: number;
  search: string | null;
  bucket: SectionBucket | null;
  meetingDateFilter: 'none' | 'range';
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

interface BucketedPagedResult<T> {
  overdue: PagedResult<T>;
  today: PagedResult<T>;
  future: PagedResult<T>;
}

@Injectable()
export class SalesDashboardService {
  private readonly defaultPageSize = 10;
  private readonly maxPageSize = 50;
  private quotationMenuSid: number | null | undefined;

  constructor(
    private readonly db: DatabaseService,
    private readonly menuService: MenuService,
  ) {}

  async getSalesDashboardData(query: SalesDashboardQueryDto) {
    const [
      leadsNoMeeting,
      meetingsScheduled,
      meetingsWithFollowup,
      meetingsNotConverted,
      customersNoQuote,
      enquiryCounts,
      enquiriesNoQuotation,
      quotesNotApproved,
      quotesNoBooking,
      summaryKpis,
      leadSourceDistribution,
      leadAgeCohorts,
      funnelCounts,
    ] = await Promise.all([
      this.getLeadsNoMeetingPage(query),
      this.getMeetingsScheduledSectionData(query),
      this.getMeetingsWithFollowupPage(query),
      this.getMeetingsNotConvertedPage(query),
      this.getCustomersNoQuotePage(query),
      this.getEnquiryCounts(query),
      this.getEnquiriesNoQuotationPage(query),
      this.getQuotesNotApprovedPage(query),
      this.getQuotesNoBookingPage(query),
      this.getSummaryKpis(query),
      this.getLeadSourceDistribution(query),
      this.getLeadAgeCohorts(query),
      this.getLeadMilestoneFunnelCounts(query),
    ]);

    return {
      sections: {
        leadsNoMeeting,
        meetingsScheduled,
        meetingsWithFollowup,
        meetingsNotConverted,
        customersNoQuote,
        enquiriesNoQuotation,
        quotesNotApproved,
        quotesNoBooking,
        summaryKpis,
      },
      charts: {
        funnelCounts,
        meetingsBoardCounts: {
          overdue: meetingsScheduled.overdue.totalCount,
          today: meetingsScheduled.today.totalCount,
          future: meetingsScheduled.future.totalCount,
        },
        leadSourceDistribution,
        leadAgeCohorts,
      },
    };
  }

  async getSectionData(sectionNumber: number, query: SalesDashboardQueryDto) {
    switch (sectionNumber) {
      case 1:
        return this.getLeadsNoMeetingPage(query);
      case 2:
        if (query.bucket) {
          return this.getMeetingsScheduledBucket(query, query.bucket);
        }
        return this.getMeetingsScheduledSectionData(query);
      case 3:
        return this.getMeetingsWithFollowupPage(query);
      case 4:
        return this.getMeetingsNotConvertedPage(query);
      case 5:
        return this.getCustomersNoQuotePage(query);
      case 6:
        return this.getEnquiriesNoQuotationPage(query);
      case 7:
        return this.getQuotesNotApprovedPage(query);
      case 8:
        return this.getQuotesNoBookingPage(query);
      case 9:
        return this.getSummaryKpis(query);
      default:
        throw new Error(`Invalid section number: ${sectionNumber}`);
    }
  }

  async getSalesDashboardCounts(query: SalesDashboardQueryDto) {
    const {
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
      naiveDateFrom,
      naiveDateTo,
    } = this.normalizeParams(query);

    const [
      leadsNoMeetingCount,
      meetingsScheduledCounts,
      followUpsPendingCount,
      meetingsNotConvertedCount,
      customersNoQuoteCount,
      enquiryCounts,
      quotesNotApprovedCount,
      quotesNoBookingCount,
      summaryKpis,
      leadSourceDistribution,
      leadAgeCohorts,
      funnelCounts,
    ] = await Promise.all([
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "PreCustomerMaster" pcm
        LEFT JOIN "PreCustomerMeeting" pcmm
          ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
        WHERE
          pcmm."PreCustomerMeetingSid" IS NULL
          AND pcm."status" = 'A'
          AND pcm."CompanyMasterSid" = $1
          AND pcm."BranchMasterSid" = $2
          AND ($4::timestamptz IS NULL OR pcm."createdOn" >= $4::timestamptz)
          AND ($5::timestamptz IS NULL OR pcm."createdOn" <= $5::timestamptz)
          AND ($6::text IS NULL OR pcm."createdBy" = $6)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        dateFrom,
        dateTo,
        salespersonEmail,
      ),
      this.db.$queryRawUnsafe(
        `SELECT
          COUNT(*) FILTER (WHERE pcmm."meetingDate"::date < CURRENT_DATE) AS "overdue",
          COUNT(*) FILTER (WHERE pcmm."meetingDate"::date = CURRENT_DATE) AS "today",
          COUNT(*) FILTER (WHERE pcmm."meetingDate"::date > CURRENT_DATE) AS "future"
        FROM "PreCustomerMeeting" pcmm
        WHERE
          pcmm."status" = 'A'
          AND pcmm."meetingDate" IS NOT NULL
          AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')
          AND pcmm."CompanyMasterSid" = $1
          AND pcmm."BranchMasterSid" = $2
          AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
          `,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
      ),
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "MeetingFollowup" mf
        INNER JOIN "PreCustomerMeeting" pcmm
          ON mf."PreCustomerMeetingSid" = pcmm."PreCustomerMeetingSid"
        WHERE
          mf."Status" = 'A'
          AND COALESCE(mf."IsCompleted", 'N') != 'Y'
          AND mf."CompanyMasterSid" = $1
          AND mf."BranchMasterSid" = $2
          AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
          AND ($4::timestamp IS NULL OR mf."FollowupDate" >= $4::timestamp)
          AND ($5::timestamp IS NULL OR mf."FollowupDate" <= $5::timestamp)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        naiveDateFrom,
        naiveDateTo,
      ),
      this.db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT pcm."PreCustomerMasterSid") AS "count"
        FROM "PreCustomerMaster" pcm
        INNER JOIN "PreCustomerMeeting" pcmm
          ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
        WHERE
          pcm."status" = 'A'
          AND EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm3
            WHERE pcmm3."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm3."meetingStatus" IN ('Completed', 'Confirmed')
          )
          AND NOT EXISTS (
            SELECT 1 FROM "CustomerMaster" cm
            WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND cm."status" = 'A'
          )
          AND pcm."CompanyMasterSid" = $1
          AND pcm."BranchMasterSid" = $2
          AND (
            ($3::int IS NULL AND $6::text IS NULL)
            OR pcm."createdBy" = $6
            OR EXISTS (
              SELECT 1 FROM "PreCustomerMeeting" pcmm4
              WHERE pcmm4."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
              AND pcmm4."leadAssignTo" = $3
            )
          )
          AND ($4::timestamp IS NULL OR pcmm."meetingDate" >= $4::timestamp)
          AND ($5::timestamp IS NULL OR pcmm."meetingDate" <= $5::timestamp)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        naiveDateFrom,
        naiveDateTo,
        salespersonEmail,
      ),
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "CustomerMaster" cm
        INNER JOIN "PreCustomerMaster" pcm
          ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
        WHERE
          cm."status" = 'A'
          AND cm."CompanyMasterSid" = $1
          AND ($2::int IS NULL OR pcm."BranchMasterSid" = $2)
          AND NOT EXISTS (
            SELECT 1 FROM "QuoteHeader" qh
            WHERE qh."CustomerMasterSid" = cm."CustomerMasterSid"
          )
          AND NOT EXISTS (
            SELECT 1 FROM "BookingHeader" bh
            WHERE bh."CustomerMasterSid" = cm."CustomerMasterSid"
          )
          AND (
            ($3::int IS NULL AND $6::text IS NULL)
            OR pcm."createdBy" = $6
            OR EXISTS (
              SELECT 1 FROM "PreCustomerMeeting" pcmm
              WHERE pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
              AND pcmm."leadAssignTo" = $3
            )
          )
          AND ($4::timestamptz IS NULL OR cm."createdOn" >= $4::timestamptz)
          AND ($5::timestamptz IS NULL OR cm."createdOn" <= $5::timestamptz)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        dateFrom,
        dateTo,
        salespersonEmail,
      ),
      this.db.$queryRawUnsafe(
        `SELECT
          COUNT(*) AS "enquiryCreated",
          COUNT(*) FILTER (WHERE eh."QuoteHeaderSid" IS NOT NULL) AS "enquiryConvertedToQuotation",
          COUNT(*) FILTER (WHERE eh."QuoteHeaderSid" IS NULL) AS "enquiriesNoQuotation"
        FROM "EnquiryHeader" eh
        WHERE
          COALESCE(eh."status", 'A') = 'A'
          AND eh."CompanyMasterSid" = $1
          AND eh."BranchMasterSid" = $2
          AND ($3::int IS NULL OR eh."UserMasterSid" = $3)
          AND ($4::date IS NULL OR eh."EnquiryDate" >= $4::date)
          AND ($5::date IS NULL OR eh."EnquiryDate" <= $5::date)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        naiveDateFrom,
        naiveDateTo,
      ),
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "QuoteHeader" qh
        WHERE
          qh."status" = 'A'
          AND qh."CompanyMasterSid" = $1
          AND qh."BranchMasterSid" = $2
          AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
          AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
          AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
          AND EXISTS (
            SELECT 1 FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
            AND COALESCE(qc."status", 'A') = 'A'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
            AND COALESCE(qc."status", 'A') = 'A'
            AND qc."ApprovalStatus"::text = 'Approved'
          )
          AND EXISTS (
            SELECT 1 FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
            AND COALESCE(qc."status", 'A') = 'A'
            AND COALESCE(qc."ApprovalStatus"::text, '') <> 'Rejected'
          )`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        naiveDateFrom,
        naiveDateTo,
      ),
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "QuoteHeader" qh
        WHERE
          qh."status" = 'A'
          AND qh."BookingHeaderSid" IS NULL
          AND qh."CompanyMasterSid" = $1
          AND qh."BranchMasterSid" = $2
          AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
          AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
          AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
          AND EXISTS (
            SELECT 1 FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
            AND COALESCE(qc."status", 'A') = 'A'
            AND qc."ApprovalStatus"::text = 'Approved'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "BookingHeader" bh
            WHERE bh."QuotationHeaderSid" = qh."QuoteHeaderSid"
            AND bh."status" = 'A'
          )`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        naiveDateFrom,
        naiveDateTo,
      ),
      this.getSummaryKpis(query),
      this.getLeadSourceDistribution(query),
      this.getLeadAgeCohorts(query),
      this.getLeadMilestoneFunnelCounts(query),
    ]);

    const s1 = (leadsNoMeetingCount as any[])[0] || {};
    const s2 = (meetingsScheduledCounts as any[])[0] || {};
    const s3 = (followUpsPendingCount as any[])[0] || {};
    const s4 = (meetingsNotConvertedCount as any[])[0] || {};
    const s5 = (customersNoQuoteCount as any[])[0] || {};
    const s6 = (enquiryCounts as any[])[0] || {};
    const s7 = (quotesNotApprovedCount as any[])[0] || {};
    const s8 = (quotesNoBookingCount as any[])[0] || {};

    const counts = {
      leadsNoMeeting: Number(s1.count) || 0,
      meetingsScheduled:
        (Number(s2.overdue) || 0) +
        (Number(s2.today) || 0) +
        (Number(s2.future) || 0),
      followUpsPending: Number(s3.count) || 0,
      meetingsNotConverted: Number(s4.count) || 0,
      customersNoQuote: Number(s5.count) || 0,
      enquiryCreated: Number(s6.enquiryCreated) || 0,
      enquiryConvertedToQuotation: Number(s6.enquiryConvertedToQuotation) || 0,
      enquiriesNoQuotation: Number(s6.enquiriesNoQuotation) || 0,
      quotesNotApproved: Number(s7.count) || 0,
      quotesNoBooking: Number(s8.count) || 0,
      totalBookings: summaryKpis.bookings.totalBookings,
    };

    return {
      counts,
      summaryKpis,
      charts: {
        funnelCounts,
        meetingsBoardCounts: {
          overdue: Number(s2.overdue) || 0,
          today: Number(s2.today) || 0,
          future: Number(s2.future) || 0,
        },
        leadSourceDistribution,
        leadAgeCohorts,
      },
    };
  }

  async getFunnelJourneys(query: SalesDashboardQueryDto) {
    const {
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
      naiveDateFrom,
      naiveDateTo,
    } = this.normalizeParams(query);

    const leadScopePredicate = `(
      ($3::int IS NULL AND $4::text IS NULL)
      OR pcm."createdBy" = $4
      OR EXISTS (
        SELECT 1 FROM "PreCustomerMeeting" pcmm_scope
        WHERE pcmm_scope."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND COALESCE(pcmm_scope."status", 'A') = 'A'
          AND pcmm_scope."leadAssignTo" = $3
      )
    )`;

    const baseWhere = `
      COALESCE(pcm."status",'A') = 'A'
      AND pcm."CompanyMasterSid" = $1
      AND pcm."BranchMasterSid" = $2
      AND ${leadScopePredicate}
      AND ($5::timestamptz IS NULL OR pcm."createdOn" >= $5::timestamptz)
      AND ($6::timestamptz IS NULL OR pcm."createdOn" <= $6::timestamptz)
    `;

    const dataSql = `
      SELECT
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."leadStatus",
        pcm."createdOn",
        um."userName" AS "salespersonName",

        (SELECT row_to_json(m) FROM (
          SELECT pcmm."PreCustomerMeetingSid" AS "sid", pcmm."meetingDate", pcmm."meetingStatus"
          FROM "PreCustomerMeeting" pcmm
          WHERE pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND COALESCE(pcmm."status",'A') = 'A'
            AND ($7::timestamp IS NULL OR pcmm."meetingDate" >= $7::timestamp)
            AND ($8::timestamp IS NULL OR pcmm."meetingDate" <= $8::timestamp)
          ORDER BY pcmm."meetingDate" DESC LIMIT 1
        ) m) AS "meeting",

        (SELECT row_to_json(c) FROM (
          SELECT cm."CustomerMasterSid" AS "sid", cm."CustomerName" AS "name"
          FROM "CustomerMaster" cm
          WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND COALESCE(cm."status",'A') = 'A' LIMIT 1
        ) c) AS "customer",

        (SELECT row_to_json(e) FROM (
          SELECT eh."EnquiryHeaderSid" AS "sid", eh."EnquiryNumber" AS "number", eh."EnquiryDate" AS "date"
          FROM "EnquiryHeader" eh
          WHERE COALESCE(eh."status",'A') = 'A'
            AND ($7::date IS NULL OR eh."EnquiryDate" >= $7::date)
            AND ($8::date IS NULL OR eh."EnquiryDate" <= $8::date)
            AND (
              eh."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
              OR eh."CustomerMasterSid" IN (
                SELECT cm2."CustomerMasterSid" FROM "CustomerMaster" cm2
                WHERE cm2."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
                  AND COALESCE(cm2."status",'A') = 'A'
              )
            )
          ORDER BY eh."EnquiryDate" DESC LIMIT 1
        ) e) AS "enquiry",

        (SELECT row_to_json(q) FROM (
          SELECT qh."QuoteHeaderSid" AS "sid", qh."QuoteNumber" AS "number", qh."QuoteDate" AS "date"
          FROM "QuoteHeader" qh
          WHERE COALESCE(qh."status",'A') = 'A'
            AND ($7::date IS NULL OR qh."QuoteDate" >= $7::date)
            AND ($8::date IS NULL OR qh."QuoteDate" <= $8::date)
            AND (
              qh."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
              OR qh."CustomerMasterSid" IN (
                SELECT cm3."CustomerMasterSid" FROM "CustomerMaster" cm3
                WHERE cm3."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
                  AND COALESCE(cm3."status",'A') = 'A'
              )
            )
          ORDER BY qh."QuoteDate" DESC LIMIT 1
        ) q) AS "quote",

        (SELECT row_to_json(aq) FROM (
          SELECT qha."QuoteHeaderSid" AS "sid", qha."QuoteNumber" AS "number"
          FROM "QuoteHeader" qha
          WHERE COALESCE(qha."status",'A') = 'A'
            AND (
              qha."authorizerStatus"::text = 'Approved'
              OR EXISTS (
                SELECT 1 FROM "QuoteCarrier" qc
                WHERE qc."QuoteHeaderSid" = qha."QuoteHeaderSid"
                  AND COALESCE(qc."status",'A') = 'A'
                  AND qc."ApprovalStatus"::text = 'Approved'
              )
            )
            AND (
              qha."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
              OR qha."CustomerMasterSid" IN (
                SELECT cm4."CustomerMasterSid" FROM "CustomerMaster" cm4
                WHERE cm4."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
                  AND COALESCE(cm4."status",'A') = 'A'
              )
            )
          LIMIT 1
        ) aq) AS "approvedQuote",

        (SELECT row_to_json(bk) FROM (
          SELECT bh."BookingHeaderSid" AS "sid", bh."BookingNo" AS "bookingNo"
          FROM "BookingHeader" bh
          WHERE COALESCE(bh."status",'A') = 'A'
            AND ($5::timestamptz IS NULL OR bh."BookingDateTime" >= $5::timestamptz)
            AND ($6::timestamptz IS NULL OR bh."BookingDateTime" <= $6::timestamptz)
            AND bh."CustomerMasterSid" IN (
              SELECT cm5."CustomerMasterSid" FROM "CustomerMaster" cm5
              WHERE cm5."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
                AND COALESCE(cm5."status",'A') = 'A'
            )
            AND EXISTS (
              SELECT 1 FROM "QuoteHeader" qhx
              WHERE COALESCE(qhx."status",'A') = 'A'
                AND (
                  qhx."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
                  OR qhx."CustomerMasterSid" IN (
                    SELECT cm6."CustomerMasterSid" FROM "CustomerMaster" cm6
                    WHERE cm6."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
                      AND COALESCE(cm6."status",'A') = 'A'
                  )
                )
                AND (
                  qhx."authorizerStatus"::text = 'Approved'
                  OR EXISTS (
                    SELECT 1 FROM "QuoteCarrier" qcx
                    WHERE qcx."QuoteHeaderSid" = qhx."QuoteHeaderSid"
                      AND COALESCE(qcx."status",'A') = 'A'
                      AND qcx."ApprovalStatus"::text = 'Approved'
                  )
                )
            )
          ORDER BY bh."BookingDateTime" DESC LIMIT 1
        ) bk) AS "booking"

      FROM "PreCustomerMaster" pcm
      LEFT JOIN "UserMaster" um ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE ${baseWhere}
      ORDER BY pcm."createdOn" DESC
    `;

    const countSql = `
      SELECT COUNT(*) AS count
      FROM "PreCustomerMaster" pcm
      WHERE ${baseWhere}
    `;

    const queryParams = [
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
      naiveDateFrom,
      naiveDateTo,
    ];
    const countParams = [
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
    ];

    const [rows, countResult] = await Promise.all([
      this.db.$queryRawUnsafe(dataSql, ...queryParams),
      this.db.$queryRawUnsafe(countSql, ...countParams),
    ]);

    return {
      items: rows as any[],
      totalCount: Number((countResult as any[])[0]?.count) || 0,
    };
  }

  private normalizeParams(query: SalesDashboardQueryDto): NormalizedParams {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || this.defaultPageSize;

    return {
      companyMasterSid: Number(query.companyMasterSid),
      branchMasterSid: Number(query.branchMasterSid),
      salespersonId: query.salespersonId ? Number(query.salespersonId) : null,
      salespersonEmail: query.salespersonEmail || null,
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
      naiveDateFrom: query.naiveDateFrom || null,
      naiveDateTo: query.naiveDateTo || null,
      page: page > 0 ? page : 1,
      pageSize: Math.min(Math.max(pageSize, 1), this.maxPageSize),
      search: query.search?.trim() || null,
      bucket: query.bucket || null,
      meetingDateFilter: query.meetingDateFilter === 'range' ? 'range' : 'none',
    };
  }

  private buildSearchClause(search: string | null, columns: string[], startIndex: number) {
    if (!search) {
      return { clause: '', params: [] as any[] };
    }

    const predicate = columns
      .map((column) => `COALESCE(${column}::text, '') ILIKE $${startIndex}`)
      .join(' OR ');

    return {
      clause: ` AND (${predicate})`,
      params: [`%${search}%`],
    };
  }

  private toPagedResult<T>(rows: T[], page: number, pageSize: number, totalCount: number): PagedResult<T> {
    return {
      items: rows,
      page,
      pageSize,
      totalCount,
      hasMore: page * pageSize < totalCount,
    };
  }

  private async executePagedQuery<T>(
    dataSql: string,
    countSql: string,
    dataParams: any[],
    countParams: any[],
    page: number,
    pageSize: number,
    mapFn?: (row: any) => T,
  ): Promise<PagedResult<T>> {
    const offset = (page - 1) * pageSize;
    const [rows, countResult] = await Promise.all([
      this.db.$queryRawUnsafe(
        `${dataSql} LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`,
        ...dataParams,
        pageSize,
        offset,
      ),
      this.db.$queryRawUnsafe(countSql, ...countParams),
    ]);

    const totalCount = Number((countResult as any[])[0]?.count) || 0;
    const items = mapFn ? (rows as any[]).map(mapFn) : ((rows as unknown) as T[]);

    return this.toPagedResult(items, page, pageSize, totalCount);
  }

  private async getLeadsNoMeetingPage(query: SalesDashboardQueryDto): Promise<PagedResult<any>> {
    const params = this.normalizeParams(query);
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.dateFrom,
      params.dateTo,
      params.salespersonEmail,
    ];
    const search = this.buildSearchClause(
      params.search,
      [
        `pcm."preCustomerName"`,
        `pcm."contactPerson"`,
        `pcm."phone"`,
        `pcm."email"`,
        `pcm."leadStatus"`,
        `pcm."leadReferredBy"`,
        `um."userName"`,
      ],
      baseParams.length + 1,
    );

    const dataSql = `
      SELECT
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."phone",
        pcm."email",
        pcm."leadStatus",
        pcm."leadReferredBy" AS "leadFrom",
        pcm."customerType",
        pcm."leadAssignTo",
        pcm."createdOn",
        um."userName" AS "salespersonName"
      FROM "PreCustomerMaster" pcm
      LEFT JOIN "PreCustomerMeeting" pcmm
        ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
      AND NOT EXISTS (
        SELECT 1 FROM "CustomerMaster" cm
        WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
        AND cm."status" = 'A'
      )
      LEFT JOIN "UserMaster" um
        ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE
        pcmm."PreCustomerMeetingSid" IS NULL
        AND pcm."status" = 'A'
        AND pcm."CompanyMasterSid" = $1
        AND pcm."BranchMasterSid" = $2
        AND ($3::timestamptz IS NULL OR pcm."createdOn" >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR pcm."createdOn" <= $4::timestamptz)
        AND ($5::text IS NULL OR pcm."createdBy" = $5)
        AND NOT EXISTS (
          SELECT 1 FROM "CustomerMaster" cm
          WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND cm."status" = 'A'
        )
        ${search.clause}
      ORDER BY pcm."createdOn" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "PreCustomerMaster" pcm
      LEFT JOIN "PreCustomerMeeting" pcmm
        ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE
        pcmm."PreCustomerMeetingSid" IS NULL
        AND pcm."status" = 'A'
        AND pcm."CompanyMasterSid" = $1
        AND pcm."BranchMasterSid" = $2
        AND ($3::timestamptz IS NULL OR pcm."createdOn" >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR pcm."createdOn" <= $4::timestamptz)
        AND ($5::text IS NULL OR pcm."createdBy" = $5)
        AND NOT EXISTS (
          SELECT 1 FROM "CustomerMaster" cm
          WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND cm."status" = 'A'
        )
        ${search.clause}`;

    return this.executePagedQuery<any>(
      dataSql,
      countSql,
      [...baseParams, ...search.params],
      [...baseParams, ...search.params],
      params.page,
      params.pageSize,
    );
  }

  private async getMeetingsScheduledSectionData(
    query: SalesDashboardQueryDto,
  ): Promise<BucketedPagedResult<any>> {
    const [overdue, today, future] = await Promise.all([
      this.getMeetingsScheduledBucket(query, 'overdue'),
      this.getMeetingsScheduledBucket(query, 'today'),
      this.getMeetingsScheduledBucket(query, 'future'),
    ]);

    return { overdue, today, future };
  }

  private getMeetingBucketClause(bucket: SectionBucket) {
    if (bucket === 'overdue') {
      return `pcmm."meetingDate"::date < CURRENT_DATE`;
    }
    if (bucket === 'today') {
      return `pcmm."meetingDate"::date = CURRENT_DATE`;
    }
    return `pcmm."meetingDate"::date > CURRENT_DATE`;
  }

  private async getMeetingsScheduledBucket(
    query: SalesDashboardQueryDto,
    bucket: SectionBucket,
  ): Promise<PagedResult<any>> {
    const params = this.normalizeParams(query);
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.salespersonId,
    ];
    const meetingDateClause =
      params.meetingDateFilter === 'range'
        ? `AND ($4::timestamp IS NULL OR pcmm."meetingDate" >= $4::timestamp)
        AND ($5::timestamp IS NULL OR pcmm."meetingDate" <= $5::timestamp)`
        : '';

    if (params.meetingDateFilter === 'range') {
      baseParams.push(params.naiveDateFrom, params.naiveDateTo);
    }

    const search = this.buildSearchClause(
      params.search,
      [
        `pcm."preCustomerName"`,
        `cm."CustomerName"`,
        `pcmm."meetingType"`,
        `um."userName"`,
      ],
      baseParams.length + 1,
    );
    const bucketClause = this.getMeetingBucketClause(bucket);
    const orderDir = bucket === 'overdue' ? 'DESC' : 'ASC';

    const dataSql = `
      SELECT
        pcmm."PreCustomerMeetingSid",
        pcmm."meetingDate",
        pcmm."meetingType",
        pcmm."meetingStatus",
        pcmm."meetingNote",
        pcmm."meetingDuration",
        pcmm."leadAssignTo",
        pcmm."LeadOrCustomer",
        CASE
          WHEN pcmm."LeadOrCustomer" = 'L' THEN pcm."preCustomerName"
          ELSE cm."CustomerName"
        END AS "name",
        pcm."PreCustomerMasterSid",
        cm."CustomerMasterSid",
        um."userName" AS "salespersonName"
      FROM "PreCustomerMeeting" pcmm
      LEFT JOIN "PreCustomerMaster" pcm
        ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm
        ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE
        pcmm."status" = 'A'
        AND pcmm."meetingDate" IS NOT NULL
        AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')
        AND pcmm."CompanyMasterSid" = $1
        AND pcmm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        ${meetingDateClause}
        AND ${bucketClause}
        ${search.clause}
      ORDER BY pcmm."meetingDate" ${orderDir}`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "PreCustomerMeeting" pcmm
      LEFT JOIN "PreCustomerMaster" pcm
        ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm
        ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE
        pcmm."status" = 'A'
        AND pcmm."meetingDate" IS NOT NULL
        AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')
        AND pcmm."CompanyMasterSid" = $1
        AND pcmm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        ${meetingDateClause}
        AND ${bucketClause}
        ${search.clause}`;

    return this.executePagedQuery<any>(
      dataSql,
      countSql,
      [...baseParams, ...search.params],
      [...baseParams, ...search.params],
      params.page,
      params.pageSize,
    );
  }

  private async getMeetingsWithFollowupPage(query: SalesDashboardQueryDto): Promise<PagedResult<any>> {
    const params = this.normalizeParams(query);
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.salespersonId,
      params.naiveDateFrom,
      params.naiveDateTo,
    ];
    const search = this.buildSearchClause(
      params.search,
      [
        `pcm."preCustomerName"`,
        `cm."CustomerName"`,
        `mf."FollowupNote"`,
      ],
      baseParams.length + 1,
    );

    const dataSql = `
      SELECT
        mf."MeetingFollowupSid",
        mf."FollowupDate" AS "followUpDate",
        mf."FollowupNote" AS "followUpNote",
        mf."MeetingNote" AS "meetingNote",
        pcmm."PreCustomerMeetingSid",
        pcmm."meetingDate",
        pcmm."meetingType",
        pcmm."meetingStatus",
        pcmm."leadAssignTo",
        pcmm."LeadOrCustomer",
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        cm."CustomerMasterSid",
        cm."CustomerName",
        um."userName" AS "salespersonName",
        CASE
          WHEN mf."FollowupDate"::date < CURRENT_DATE THEN 'Overdue'
          WHEN mf."FollowupDate"::date = CURRENT_DATE THEN 'Due Today'
          ELSE 'Upcoming'
        END AS "followUpStatus"
      FROM "MeetingFollowup" mf
      INNER JOIN "PreCustomerMeeting" pcmm
        ON mf."PreCustomerMeetingSid" = pcmm."PreCustomerMeetingSid"
      LEFT JOIN "PreCustomerMaster" pcm
        ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm
        ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE
        mf."Status" = 'A'
        AND COALESCE(mf."IsCompleted", 'N') != 'Y'
        AND mf."CompanyMasterSid" = $1
        AND mf."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        AND ($4::timestamp IS NULL OR mf."FollowupDate" >= $4::timestamp)
        AND ($5::timestamp IS NULL OR mf."FollowupDate" <= $5::timestamp)
        ${search.clause}
      ORDER BY mf."FollowupDate" ASC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "MeetingFollowup" mf
      INNER JOIN "PreCustomerMeeting" pcmm
        ON mf."PreCustomerMeetingSid" = pcmm."PreCustomerMeetingSid"
      LEFT JOIN "PreCustomerMaster" pcm
        ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm
        ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      WHERE
        mf."Status" = 'A'
        AND COALESCE(mf."IsCompleted", 'N') != 'Y'
        AND mf."CompanyMasterSid" = $1
        AND mf."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        AND ($4::timestamp IS NULL OR mf."FollowupDate" >= $4::timestamp)
        AND ($5::timestamp IS NULL OR mf."FollowupDate" <= $5::timestamp)
        ${search.clause}`;

    return this.executePagedQuery<any>(
      dataSql,
      countSql,
      [...baseParams, ...search.params],
      [...baseParams, ...search.params],
      params.page,
      params.pageSize,
    );
  }

  async completeMeetingFollowup(meetingFollowupSid: number, updatedBy: string) {
    return this.db.meetingFollowup.update({
      where: { MeetingFollowupSid: meetingFollowupSid },
      data: { IsCompleted: 'Y', updatedBy, updatedOn: new Date() },
    });
  }

  private async getMeetingsNotConvertedPage(query: SalesDashboardQueryDto): Promise<PagedResult<any>> {
    const params = this.normalizeParams(query);
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.salespersonId,
      params.naiveDateFrom,
      params.naiveDateTo,
      params.salespersonEmail,
    ];
    const search = this.buildSearchClause(
      params.search,
      [
        `pcm."preCustomerName"`,
        `pcm."contactPerson"`,
        `pcm."phone"`,
        `pcm."email"`,
        `pcm."leadStatus"`,
      ],
      baseParams.length + 1,
    );

    const dataSql = `
      SELECT
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."phone",
        pcm."email",
        pcm."leadStatus",
        pcm."createdBy" AS "leadCreatedBy",
        pcm."createdOn" AS "leadCreatedOn",
        COUNT(pcmm."PreCustomerMeetingSid") AS "meetingCount",
        MAX(pcmm."meetingDate") AS "lastMeetingDate",
        CASE
          WHEN pcm."createdBy" = $6 AND EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm2
            WHERE pcmm2."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm2."leadAssignTo" = $3
          ) THEN 'Created & Assigned to you'
          WHEN pcm."createdBy" = $6 THEN 'Created by you'
          WHEN EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm2
            WHERE pcmm2."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm2."leadAssignTo" = $3
          ) THEN 'Assigned to you'
        END AS "matchedVia"
      FROM "PreCustomerMaster" pcm
      INNER JOIN "PreCustomerMeeting" pcmm
        ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
      WHERE
        pcm."status" = 'A'
        AND pcm."CompanyMasterSid" = $1
        AND pcm."BranchMasterSid" = $2
        AND EXISTS (
          SELECT 1 FROM "PreCustomerMeeting" pcmm3
          WHERE pcmm3."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND pcmm3."meetingStatus" IN ('Completed', 'Confirmed')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "CustomerMaster" cm
          WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND cm."status" = 'A'
        )
        AND (
          ($3::int IS NULL AND $6::text IS NULL)
          OR pcm."createdBy" = $6
          OR EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm4
            WHERE pcmm4."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm4."leadAssignTo" = $3
          )
        )
        AND ($4::timestamp IS NULL OR pcmm."meetingDate" >= $4::timestamp)
        AND ($5::timestamp IS NULL OR pcmm."meetingDate" <= $5::timestamp)
        ${search.clause}
      GROUP BY
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."phone",
        pcm."email",
        pcm."leadStatus",
        pcm."createdBy",
        pcm."createdOn"
      ORDER BY MAX(pcmm."meetingDate") DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM (
        SELECT pcm."PreCustomerMasterSid"
        FROM "PreCustomerMaster" pcm
        INNER JOIN "PreCustomerMeeting" pcmm
          ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
        WHERE
          pcm."status" = 'A'
          AND pcm."CompanyMasterSid" = $1
          AND pcm."BranchMasterSid" = $2
          AND EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm3
            WHERE pcmm3."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm3."meetingStatus" IN ('Completed', 'Confirmed')
          )
          AND NOT EXISTS (
            SELECT 1 FROM "CustomerMaster" cm
            WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND cm."status" = 'A'
          )
          AND (
            ($3::int IS NULL AND $6::text IS NULL)
            OR pcm."createdBy" = $6
            OR EXISTS (
              SELECT 1 FROM "PreCustomerMeeting" pcmm4
              WHERE pcmm4."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
              AND pcmm4."leadAssignTo" = $3
            )
          )
          AND ($4::timestamp IS NULL OR pcmm."meetingDate" >= $4::timestamp)
          AND ($5::timestamp IS NULL OR pcmm."meetingDate" <= $5::timestamp)
          ${search.clause}
        GROUP BY pcm."PreCustomerMasterSid"
      ) t`;

    return this.executePagedQuery<any>(
      dataSql,
      countSql,
      [...baseParams, ...search.params],
      [...baseParams, ...search.params],
      params.page,
      params.pageSize,
      (row) => ({
        ...row,
        meetingCount: Number(row.meetingCount),
      }),
    );
  }

  private async getCustomersNoQuotePage(query: SalesDashboardQueryDto): Promise<PagedResult<any>> {
    const params = this.normalizeParams(query);
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.salespersonId,
      params.dateFrom,
      params.dateTo,
      params.salespersonEmail,
    ];
    const search = this.buildSearchClause(
      params.search,
      [
        `cm."CustomerName"`,
        `cm."CustomerAddress1"`,
        `pcm."preCustomerName"`,
        `pcm."contactPerson"`,
      ],
      baseParams.length + 1,
    );

    const dataSql = `
      SELECT
        cm."CustomerMasterSid",
        cm."CustomerName",
        cm."CustomerAddress1",
        cm."PreCustomerMasterSid",
        cm."createdOn" AS "customerCreatedOn",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."phone",
        pcm."email",
        pcm."createdBy" AS "leadCreatedBy",
        CASE
          WHEN pcm."createdBy" = $6 AND EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm2
            WHERE pcmm2."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm2."leadAssignTo" = $3
          ) THEN 'Created & Assigned to you'
          WHEN pcm."createdBy" = $6 THEN 'Created by you'
          WHEN EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm2
            WHERE pcmm2."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm2."leadAssignTo" = $3
          ) THEN 'Assigned to you'
        END AS "matchedVia"
      FROM "CustomerMaster" cm
      INNER JOIN "PreCustomerMaster" pcm
        ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      WHERE
        cm."status" = 'A'
        AND cm."CompanyMasterSid" = $1
        AND ($2::int IS NULL OR pcm."BranchMasterSid" = $2)
        AND NOT EXISTS (
          SELECT 1 FROM "QuoteHeader" qh
          WHERE qh."CustomerMasterSid" = cm."CustomerMasterSid"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "BookingHeader" bh
          WHERE bh."CustomerMasterSid" = cm."CustomerMasterSid"
        )
        AND (
          ($3::int IS NULL AND $6::text IS NULL)
          OR pcm."createdBy" = $6
          OR EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm
            WHERE pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm."leadAssignTo" = $3
          )
        )
        AND ($4::timestamptz IS NULL OR cm."createdOn" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR cm."createdOn" <= $5::timestamptz)
        ${search.clause}
      ORDER BY cm."createdOn" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "CustomerMaster" cm
      INNER JOIN "PreCustomerMaster" pcm
        ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      WHERE
        cm."status" = 'A'
        AND cm."CompanyMasterSid" = $1
        AND ($2::int IS NULL OR pcm."BranchMasterSid" = $2)
        AND NOT EXISTS (
          SELECT 1 FROM "QuoteHeader" qh
          WHERE qh."CustomerMasterSid" = cm."CustomerMasterSid"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "BookingHeader" bh
          WHERE bh."CustomerMasterSid" = cm."CustomerMasterSid"
        )
        AND (
          ($3::int IS NULL AND $6::text IS NULL)
          OR pcm."createdBy" = $6
          OR EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm
            WHERE pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm."leadAssignTo" = $3
          )
        )
        AND ($4::timestamptz IS NULL OR cm."createdOn" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR cm."createdOn" <= $5::timestamptz)
        ${search.clause}`;

    return this.executePagedQuery<any>(
      dataSql,
      countSql,
      [...baseParams, ...search.params],
      [...baseParams, ...search.params],
      params.page,
      params.pageSize,
    );
  }

  private async getEnquiryCounts(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, naiveDateFrom, naiveDateTo } =
      this.normalizeParams(query);

    const results = await this.db.$queryRawUnsafe(
      `SELECT
        COUNT(*) AS "enquiryCreated",
        COUNT(*) FILTER (WHERE eh."QuoteHeaderSid" IS NOT NULL) AS "enquiryConvertedToQuotation",
        COUNT(*) FILTER (WHERE eh."QuoteHeaderSid" IS NULL) AS "enquiriesNoQuotation"
      FROM "EnquiryHeader" eh
      WHERE
        COALESCE(eh."status", 'A') = 'A'
        AND eh."CompanyMasterSid" = $1
        AND eh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR eh."UserMasterSid" = $3)
        AND ($4::date IS NULL OR eh."EnquiryDate" >= $4::date)
        AND ($5::date IS NULL OR eh."EnquiryDate" <= $5::date)`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      naiveDateFrom,
      naiveDateTo,
    );

    const row = (results as any[])[0] || {};

    return {
      enquiryCreated: Number(row.enquiryCreated) || 0,
      enquiryConvertedToQuotation: Number(row.enquiryConvertedToQuotation) || 0,
      enquiriesNoQuotation: Number(row.enquiriesNoQuotation) || 0,
    };
  }

  private async getEnquiriesNoQuotationPage(query: SalesDashboardQueryDto): Promise<PagedResult<any>> {
    const params = this.normalizeParams(query);
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.salespersonId,
      params.naiveDateFrom,
      params.naiveDateTo,
    ];
    const search = this.buildSearchClause(
      params.search,
      [
        `eh."EnquiryNumber"`,
        `eh."CustomerName"`,
        `eh."authorizerStatus"`,
        `dm."departmentName"`,
        `pol."PortCode"`,
        `pod."PortCode"`,
      ],
      baseParams.length + 1,
    );

    const dataSql = `
      SELECT
        eh."EnquiryHeaderSid",
        eh."EnquiryNumber",
        eh."EnquiryDate",
        eh."CustomerName",
        eh."authorizerStatus",
        eh."LeadOrCustomer",
        dm."departmentName",
        pol."PortCode" AS "polCode",
        pod."PortCode" AS "podCode"
      FROM "EnquiryHeader" eh
      LEFT JOIN LATERAL (
        SELECT er."DepartmentMasterSid", er."POLSid", er."PODSid"
        FROM "EnquiryRoute" er
        WHERE er."EnquiryHeaderSid" = eh."EnquiryHeaderSid"
          AND COALESCE(er."status", 'A') = 'A'
        ORDER BY er."EnquiryRouteSid" ASC
        LIMIT 1
      ) fer ON true
      LEFT JOIN "DepartmentMaster" dm
        ON COALESCE(fer."DepartmentMasterSid", eh."DepartmentMasterSid") = dm."DepartmentMasterSid"
      LEFT JOIN "PortMaster" pol
        ON fer."POLSid" = pol."PortMasterSid"
      LEFT JOIN "PortMaster" pod
        ON fer."PODSid" = pod."PortMasterSid"
      WHERE
        COALESCE(eh."status", 'A') = 'A'
        AND eh."QuoteHeaderSid" IS NULL
        AND eh."CompanyMasterSid" = $1
        AND eh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR eh."UserMasterSid" = $3)
        AND ($4::date IS NULL OR eh."EnquiryDate" >= $4::date)
        AND ($5::date IS NULL OR eh."EnquiryDate" <= $5::date)
        ${search.clause}
      ORDER BY eh."EnquiryDate" DESC, eh."EnquiryHeaderSid" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "EnquiryHeader" eh
      LEFT JOIN LATERAL (
        SELECT er."DepartmentMasterSid", er."POLSid", er."PODSid"
        FROM "EnquiryRoute" er
        WHERE er."EnquiryHeaderSid" = eh."EnquiryHeaderSid"
          AND COALESCE(er."status", 'A') = 'A'
        ORDER BY er."EnquiryRouteSid" ASC
        LIMIT 1
      ) fer ON true
      LEFT JOIN "DepartmentMaster" dm
        ON COALESCE(fer."DepartmentMasterSid", eh."DepartmentMasterSid") = dm."DepartmentMasterSid"
      LEFT JOIN "PortMaster" pol
        ON fer."POLSid" = pol."PortMasterSid"
      LEFT JOIN "PortMaster" pod
        ON fer."PODSid" = pod."PortMasterSid"
      WHERE
        COALESCE(eh."status", 'A') = 'A'
        AND eh."QuoteHeaderSid" IS NULL
        AND eh."CompanyMasterSid" = $1
        AND eh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR eh."UserMasterSid" = $3)
        AND ($4::date IS NULL OR eh."EnquiryDate" >= $4::date)
        AND ($5::date IS NULL OR eh."EnquiryDate" <= $5::date)
        ${search.clause}`;

    return this.executePagedQuery<any>(
      dataSql,
      countSql,
      [...baseParams, ...search.params],
      [...baseParams, ...search.params],
      params.page,
      params.pageSize,
    );
  }

  private async getQuotesNotApprovedPage(query: SalesDashboardQueryDto): Promise<PagedResult<any>> {
    const params = this.normalizeParams(query);
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.salespersonId,
      params.naiveDateFrom,
      params.naiveDateTo,
    ];
    const search = this.buildSearchClause(
      params.search,
      [
        `qh."QuoteNumber"`,
        `qh."CustomerName"`,
        `pcm."preCustomerName"`,
        `dm."departmentName"`,
        `pol."PortCode"`,
        `pod."PortCode"`,
      ],
      baseParams.length + 1,
    );

    const dataSql = `
      SELECT
        qh."QuoteHeaderSid",
        qh."QuoteNumber",
        qh."QuoteDate",
        qh."authorizerStatus",
        qh."AuthorizerRemarks",
        qh."QuoteValidFrom",
        qh."QuoteValidTo",
        qh."SalesmanSid",
        qh."LeadOrCustomer",
        qh."PreCustomerMasterSid",
        qh."CustomerMasterSid",
        qh."CustomerName",
        pcm."preCustomerName",
        um."userName" AS "salespersonName",
        dm."departmentName",
        pol."PortCode" AS "polCode",
        pod."PortCode" AS "podCode"
      FROM "QuoteHeader" qh
      LEFT JOIN "PreCustomerMaster" pcm
        ON qh."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON qh."SalesmanSid" = um."UserMasterSid"
      LEFT JOIN LATERAL (
        SELECT qr."DepartmentMasterSid", qr."POLSid", qr."PODSid"
        FROM "QuoteRoute" qr
        WHERE qr."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qr."status", 'A') = 'A'
        ORDER BY qr."QuoteRouteSid" ASC
        LIMIT 1
      ) fr ON true
      LEFT JOIN "DepartmentMaster" dm
        ON fr."DepartmentMasterSid" = dm."DepartmentMasterSid"
      LEFT JOIN "PortMaster" pol
        ON fr."POLSid" = pol."PortMasterSid"
      LEFT JOIN "PortMaster" pod
        ON fr."PODSid" = pod."PortMasterSid"
      WHERE
        qh."status" = 'A'
        AND qh."CompanyMasterSid" = $1
        AND qh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
        AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
        AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
        AND EXISTS (
          SELECT 1
          FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        )
        AND EXISTS (
          SELECT 1
          FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND COALESCE(qc."ApprovalStatus"::text, '') <> 'Rejected'
        )
        ${search.clause}
      ORDER BY qh."QuoteDate" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "QuoteHeader" qh
      LEFT JOIN "PreCustomerMaster" pcm
        ON qh."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON qh."SalesmanSid" = um."UserMasterSid"
      LEFT JOIN LATERAL (
        SELECT qr."DepartmentMasterSid", qr."POLSid", qr."PODSid"
        FROM "QuoteRoute" qr
        WHERE qr."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qr."status", 'A') = 'A'
        ORDER BY qr."QuoteRouteSid" ASC
        LIMIT 1
      ) fr ON true
      LEFT JOIN "DepartmentMaster" dm
        ON fr."DepartmentMasterSid" = dm."DepartmentMasterSid"
      LEFT JOIN "PortMaster" pol
        ON fr."POLSid" = pol."PortMasterSid"
      LEFT JOIN "PortMaster" pod
        ON fr."PODSid" = pod."PortMasterSid"
      WHERE
        qh."status" = 'A'
        AND qh."CompanyMasterSid" = $1
        AND qh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
        AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
        AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
        AND EXISTS (
          SELECT 1
          FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        )
        AND EXISTS (
          SELECT 1
          FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND COALESCE(qc."ApprovalStatus"::text, '') <> 'Rejected'
        )
        ${search.clause}`;

    return this.executePagedQuery<any>(
      dataSql,
      countSql,
      [...baseParams, ...search.params],
      [...baseParams, ...search.params],
      params.page,
      params.pageSize,
    );
  }

  private async getQuotesNoBookingPage(query: SalesDashboardQueryDto): Promise<PagedResult<any>> {
    const params = this.normalizeParams(query);
    const quotationMenuSid = await this.getQuotationMenuSid();
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.salespersonId,
      params.naiveDateFrom,
      params.naiveDateTo,
      quotationMenuSid,
    ];
    const search = this.buildSearchClause(
      params.search,
      [
        `qh."QuoteNumber"`,
        `qh."CustomerName"`,
        `pcm."preCustomerName"`,
        `dm."departmentName"`,
        `pol."PortCode"`,
        `pod."PortCode"`,
        `ac."ApprovedBy"`,
      ],
      baseParams.length + 1,
    );

    const dataSql = `
      SELECT
        qh."QuoteHeaderSid",
        qh."QuoteNumber",
        qh."QuoteDate",
        qh."SalesmanSid",
        qh."LeadOrCustomer",
        qh."PreCustomerMasterSid",
        qh."CustomerMasterSid",
        qh."CustomerBranchSid",
        qh."CustomerName",
        pcm."preCustomerName",
        salesperson."userName" AS "salespersonName",
        ac."ApprovedBy" AS "approvedBy",
        COALESCE(auth."AuthorisedDate", ac."updatedOn") AS "approvedOn",
        dm."departmentName",
        pol."PortCode" AS "polCode",
        pod."PortCode" AS "podCode"
      FROM "QuoteHeader" qh
      LEFT JOIN "PreCustomerMaster" pcm
        ON qh."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" salesperson
        ON qh."SalesmanSid" = salesperson."UserMasterSid"
      LEFT JOIN LATERAL (
        SELECT qc."ApprovedBy", qc."QuoteRouteSid", qc."updatedOn"
        FROM "QuoteCarrier" qc
        WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        ORDER BY qc."QuoteCarrierSid" ASC
        LIMIT 1
      ) ac ON true
      LEFT JOIN "QuoteRoute" qr
        ON ac."QuoteRouteSid" = qr."QuoteRouteSid"
      LEFT JOIN "DepartmentMaster" dm
        ON qr."DepartmentMasterSid" = dm."DepartmentMasterSid"
      LEFT JOIN "PortMaster" pol
        ON qr."POLSid" = pol."PortMasterSid"
      LEFT JOIN "PortMaster" pod
        ON qr."PODSid" = pod."PortMasterSid"
      LEFT JOIN LATERAL (
        SELECT al."AuthorisedDate"
        FROM "AuthorityLog" al
        INNER JOIN "AuthorityDetail" ad
          ON al."AuthorityDetailSid" = ad."AuthorityDetailSid"
        INNER JOIN "AuthorityMaster" am
          ON ad."AuthorityMasterSid" = am."AuthorityMasterSid"
        WHERE al."DocumentSid" = qh."QuoteHeaderSid"
          AND al."CompanyMasterSid" = $1
          AND al."BranchMasterSid" = $2
          AND COALESCE(al."Status", 'A') = 'A'
          AND al."ApprovalStatus" = 'Approved'
          AND ($6::int IS NULL OR am."MenuMaster" = $6)
        ORDER BY al."AuthorisedDate" DESC
        LIMIT 1
      ) auth ON true
      WHERE
        qh."status" = 'A'
        AND qh."BookingHeaderSid" IS NULL
        AND qh."CompanyMasterSid" = $1
        AND qh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
        AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
        AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
        AND EXISTS (
          SELECT 1
          FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "BookingHeader" bh
          WHERE bh."QuotationHeaderSid" = qh."QuoteHeaderSid"
          AND bh."status" = 'A'
        )
        ${search.clause}
      ORDER BY qh."QuoteDate" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "QuoteHeader" qh
      LEFT JOIN "PreCustomerMaster" pcm
        ON qh."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" salesperson
        ON qh."SalesmanSid" = salesperson."UserMasterSid"
      LEFT JOIN LATERAL (
        SELECT qc."ApprovedBy", qc."QuoteRouteSid", qc."updatedOn"
        FROM "QuoteCarrier" qc
        WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        ORDER BY qc."QuoteCarrierSid" ASC
        LIMIT 1
      ) ac ON true
      LEFT JOIN "QuoteRoute" qr
        ON ac."QuoteRouteSid" = qr."QuoteRouteSid"
      LEFT JOIN "DepartmentMaster" dm
        ON qr."DepartmentMasterSid" = dm."DepartmentMasterSid"
      LEFT JOIN "PortMaster" pol
        ON qr."POLSid" = pol."PortMasterSid"
      LEFT JOIN "PortMaster" pod
        ON qr."PODSid" = pod."PortMasterSid"
      WHERE
        qh."status" = 'A'
        AND qh."BookingHeaderSid" IS NULL
        AND qh."CompanyMasterSid" = $1
        AND qh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
        AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
        AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
        AND EXISTS (
          SELECT 1
          FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "BookingHeader" bh
          WHERE bh."QuotationHeaderSid" = qh."QuoteHeaderSid"
          AND bh."status" = 'A'
        )
        ${search.clause}`;

    return this.executePagedQuery<any>(
      dataSql,
      countSql,
      [...baseParams, ...search.params],
      [...baseParams, ...search.params],
      params.page,
      params.pageSize,
    );
  }

  private async getQuotationMenuSid(): Promise<number | null> {
    if (this.quotationMenuSid !== undefined) {
      return this.quotationMenuSid;
    }

    try {
      this.quotationMenuSid = await this.menuService.getMenuSidByName('Quotation');
    } catch {
      this.quotationMenuSid = null;
    }

    return this.quotationMenuSid;
  }

  private async getSummaryKpis(query: SalesDashboardQueryDto) {
    const {
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      naiveDateFrom,
      naiveDateTo,
    } = this.normalizeParams(query);
    const [quoteResults, bookingResults] = await Promise.all([
      this.db.$queryRawUnsafe(
        `SELECT
          COUNT(*) AS "totalQuotes",
          COUNT(*) FILTER (WHERE qs."quoteStatus" = 'Approved') AS "approvedQuotes",
          COUNT(*) FILTER (WHERE qs."quoteStatus" = 'Open') AS "openQuotes",
          COUNT(*) FILTER (WHERE qs."quoteStatus" = 'Pending') AS "pendingQuotes",
          COUNT(*) FILTER (WHERE qs."quoteStatus" = 'Rejected') AS "rejectedQuotes",
          COUNT(*) FILTER (WHERE qs."quoteStatus" = 'Waiting') AS "waitingQuotes",
          COUNT(*) FILTER (WHERE qs."quoteStatus" = 'Other') AS "otherQuotes",
          COUNT(*) FILTER (WHERE qh."BookingHeaderSid" IS NOT NULL) AS "quotesWithBooking",
          COUNT(*) FILTER (WHERE qh."EnquirySid" IS NOT NULL) AS "quotesFromEnquiry",
          COUNT(*) FILTER (WHERE qh."EnquirySid" IS NULL) AS "directQuotes"
        FROM "QuoteHeader" qh
        LEFT JOIN LATERAL (
          SELECT CASE
            WHEN carrier_flags."hasApproved" THEN 'Approved'
            WHEN carrier_flags."allRejected" THEN 'Rejected'
            WHEN carrier_flags."hasOpen" THEN 'Open'
            WHEN carrier_flags."hasWaiting" THEN 'Waiting'
            WHEN carrier_flags."hasPending" THEN 'Pending'
            ELSE 'Other'
          END AS "quoteStatus"
          FROM (
            SELECT
              BOOL_OR(qc."ApprovalStatus"::text = 'Approved') AS "hasApproved",
              BOOL_OR(qc."ApprovalStatus"::text = 'Open') AS "hasOpen",
              BOOL_OR(qc."ApprovalStatus"::text = 'Pending') AS "hasPending",
              BOOL_OR(qc."ApprovalStatus"::text IN ('WaitingForFinalApproval', 'WaitingForCustomerApproval')) AS "hasWaiting",
              COUNT(*) > 0 AND BOOL_AND(qc."ApprovalStatus"::text = 'Rejected') AS "allRejected"
            FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
              AND COALESCE(qc."status", 'A') = 'A'
          ) carrier_flags
        ) qs ON true
        WHERE
          qh."status" = 'A'
          AND qh."CompanyMasterSid" = $1
          AND qh."BranchMasterSid" = $2
          AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
          AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
          AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        naiveDateFrom,
        naiveDateTo,
      ),
      this.db.$queryRawUnsafe(
        `SELECT
          COUNT(*) AS "totalBookings",
          COUNT(*) FILTER (WHERE bh."QuotationHeaderSid" IS NOT NULL) AS "bookingsFromQuote",
          COUNT(*) FILTER (WHERE bh."QuotationHeaderSid" IS NULL) AS "directBookings",
          COUNT(*) FILTER (
            WHERE CASE
              WHEN UPPER(COALESCE(dm."departmentType", '')) = 'AIR' THEN 'AIR'
              ELSE UPPER(COALESCE(dm."FCLLCL", ''))
            END = 'FCL'
          ) AS "fclBookings",
          COUNT(*) FILTER (
            WHERE CASE
              WHEN UPPER(COALESCE(dm."departmentType", '')) = 'AIR' THEN 'AIR'
              ELSE UPPER(COALESCE(dm."FCLLCL", ''))
            END = 'LCL'
          ) AS "lclBookings",
          COUNT(*) FILTER (
            WHERE CASE
              WHEN UPPER(COALESCE(dm."departmentType", '')) = 'AIR' THEN 'AIR'
              ELSE UPPER(COALESCE(dm."FCLLCL", ''))
            END = 'AIR'
          ) AS "airBookings"
        FROM "BookingHeader" bh
        LEFT JOIN "DepartmentMaster" dm
          ON bh."DepartmentMasterSid" = dm."DepartmentMasterSid"
        WHERE
          bh."status" = 'A'
          AND bh."CompanyMasterSid" = $1
          AND ($2::int IS NULL OR bh."BranchMasterSid" = $2)
          AND ($3::int IS NULL OR bh."SalesmanSid" = $3)
          AND ($4::date IS NULL OR bh."BookingDateTime" >= $4::date)
          AND ($5::date IS NULL OR bh."BookingDateTime" <= $5::date)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        naiveDateFrom,
        naiveDateTo,
      ),
    ]);

    const quotes = (quoteResults as any[])[0] || {};
    const bookings = (bookingResults as any[])[0] || {};

    return {
      quotes: {
        totalQuotes: Number(quotes.totalQuotes) || 0,
        approvedQuotes: Number(quotes.approvedQuotes) || 0,
        openQuotes: Number(quotes.openQuotes) || 0,
        pendingQuotes: Number(quotes.pendingQuotes) || 0,
        rejectedQuotes: Number(quotes.rejectedQuotes) || 0,
        waitingQuotes: Number(quotes.waitingQuotes) || 0,
        otherQuotes: Number(quotes.otherQuotes) || 0,
        quotesWithBooking: Number(quotes.quotesWithBooking) || 0,
        quotesFromEnquiry: Number(quotes.quotesFromEnquiry) || 0,
        directQuotes: Number(quotes.directQuotes) || 0,
      },
      bookings: {
        totalBookings: Number(bookings.totalBookings) || 0,
        bookingsFromQuote: Number(bookings.bookingsFromQuote) || 0,
        directBookings: Number(bookings.directBookings) || 0,
        fclBookings: Number(bookings.fclBookings) || 0,
        lclBookings: Number(bookings.lclBookings) || 0,
        airBookings: Number(bookings.airBookings) || 0,
      },
    };
  }

  private async getLeadSourceDistribution(query: SalesDashboardQueryDto) {
    const {
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
    } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `WITH scoped_leads AS (
        SELECT
          pcm."PreCustomerMasterSid",
          CASE
            WHEN pcm."createdBy" = $4 THEN COALESCE(NULLIF(TRIM(pcm."leadReferredBy"), ''), 'Unknown')
            ELSE 'Assigned'
          END AS "source"
        FROM "PreCustomerMaster" pcm
        WHERE
          pcm."status" = 'A'
          AND pcm."CompanyMasterSid" = $1
          AND pcm."BranchMasterSid" = $2
          AND ($5::timestamptz IS NULL OR pcm."createdOn" >= $5::timestamptz)
          AND ($6::timestamptz IS NULL OR pcm."createdOn" <= $6::timestamptz)
          AND (
            ($3::int IS NULL AND $4::text IS NULL)
            OR pcm."createdBy" = $4
            OR EXISTS (
              SELECT 1
              FROM "PreCustomerMeeting" pcmm_scope
              WHERE pcmm_scope."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
                AND COALESCE(pcmm_scope."status", 'A') = 'A'
                AND pcmm_scope."leadAssignTo" = $3
            )
          )
      )
      SELECT
        "source",
        COUNT(*) AS "count"
      FROM scoped_leads
      GROUP BY "source"
      ORDER BY "count" DESC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
    );

    return results.map((row) => ({
      source: row.source,
      count: Number(row.count),
    }));
  }

  private async getLeadMilestoneFunnelCounts(query: SalesDashboardQueryDto) {
    const {
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
      naiveDateFrom,
      naiveDateTo,
    } = this.normalizeParams(query);

    const leadScopePredicate = `(
      ($3::int IS NULL AND $4::text IS NULL)
      OR pcm."createdBy" = $4
      OR EXISTS (
        SELECT 1 FROM "PreCustomerMeeting" pcmm_scope
        WHERE pcmm_scope."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND COALESCE(pcmm_scope."status", 'A') = 'A'
          AND pcmm_scope."leadAssignTo" = $3
      )
    )`;
    const approvedQuotePredicate = `(
      qh."authorizerStatus"::text = 'Approved'
      OR EXISTS (
        SELECT 1
        FROM "QuoteCarrier" qc
        WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
          AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
      )
    )`;
    // $1=companyMasterSid, $2=branchMasterSid, $3=salespersonId, $4=salespersonEmail
    // $5=dateFrom (timestamptz), $6=dateTo (timestamptz)
    // $7=naiveDateFrom (::timestamp for meetingDate), $8=naiveDateTo
    const results: any[] = await this.db.$queryRawUnsafe(
      `WITH filtered_leads AS (
        SELECT DISTINCT pcm."PreCustomerMasterSid"
        FROM "PreCustomerMaster" pcm
        WHERE
          COALESCE(pcm."status", 'A') = 'A'
          AND pcm."CompanyMasterSid" = $1
          AND pcm."BranchMasterSid" = $2
          AND ${leadScopePredicate}
          AND ($5::timestamptz IS NULL OR pcm."createdOn" >= $5::timestamptz)
          AND ($6::timestamptz IS NULL OR pcm."createdOn" <= $6::timestamptz)
      ),
      lead_customers AS (
        SELECT
          fl."PreCustomerMasterSid",
          cm."CustomerMasterSid",
          cm."createdOn" AS "customerCreatedOn"
        FROM filtered_leads fl
        INNER JOIN "CustomerMaster" cm
          ON cm."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND COALESCE(cm."status", 'A') = 'A'
      ),
      meetings_stage AS (
        -- Any scheduled meeting against the original lead within range.
        SELECT DISTINCT fl."PreCustomerMasterSid"
        FROM filtered_leads fl
        INNER JOIN "PreCustomerMeeting" pcmm
          ON pcmm."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND COALESCE(pcmm."status", 'A') = 'A'
         AND ($7::timestamp IS NULL OR pcmm."meetingDate" >= $7::timestamp)
         AND ($8::timestamp IS NULL OR pcmm."meetingDate" <= $8::timestamp)
      ),
      enquiry_stage AS (
        -- Enquiries created either directly for the lead or later for its customer.
        SELECT
          fl."PreCustomerMasterSid",
          BOOL_OR(eh."PreCustomerMasterSid" = fl."PreCustomerMasterSid") AS "viaLead",
          BOOL_OR(lc."CustomerMasterSid" IS NOT NULL) AS "viaCustomer"
        FROM filtered_leads fl
        INNER JOIN "EnquiryHeader" eh
          ON COALESCE(eh."status", 'A') = 'A'
         AND ($7::date IS NULL OR eh."EnquiryDate" >= $7::date)
         AND ($8::date IS NULL OR eh."EnquiryDate" <= $8::date)
        LEFT JOIN lead_customers lc
          ON lc."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND eh."CustomerMasterSid" = lc."CustomerMasterSid"
        WHERE
          eh."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
          OR lc."CustomerMasterSid" IS NOT NULL
        GROUP BY fl."PreCustomerMasterSid"
      ),
      quote_stage AS (
        -- Quotes created either directly for the lead or later for its customer.
        SELECT
          fl."PreCustomerMasterSid",
          BOOL_OR(qh."PreCustomerMasterSid" = fl."PreCustomerMasterSid") AS "viaLead",
          BOOL_OR(lc."CustomerMasterSid" IS NOT NULL) AS "viaCustomer"
        FROM filtered_leads fl
        INNER JOIN "QuoteHeader" qh
          ON COALESCE(qh."status", 'A') = 'A'
         AND ($7::date IS NULL OR qh."QuoteDate" >= $7::date)
         AND ($8::date IS NULL OR qh."QuoteDate" <= $8::date)
        LEFT JOIN lead_customers lc
          ON lc."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND qh."CustomerMasterSid" = lc."CustomerMasterSid"
        WHERE
          qh."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
          OR lc."CustomerMasterSid" IS NOT NULL
        GROUP BY fl."PreCustomerMasterSid"
      ),
      approved_quote_stage AS (
        -- Approved quotes in either path. Approval may exist on header or carrier.
        SELECT
          fl."PreCustomerMasterSid",
          BOOL_OR(qh."PreCustomerMasterSid" = fl."PreCustomerMasterSid") AS "viaLead",
          BOOL_OR(lc."CustomerMasterSid" IS NOT NULL) AS "viaCustomer"
        FROM filtered_leads fl
        INNER JOIN "QuoteHeader" qh
          ON COALESCE(qh."status", 'A') = 'A'
         AND ($7::date IS NULL OR qh."QuoteDate" >= $7::date)
         AND ($8::date IS NULL OR qh."QuoteDate" <= $8::date)
        LEFT JOIN lead_customers lc
          ON lc."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND qh."CustomerMasterSid" = lc."CustomerMasterSid"
        WHERE
          ${approvedQuotePredicate}
          AND (
            qh."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
            OR lc."CustomerMasterSid" IS NOT NULL
          )
        GROUP BY fl."PreCustomerMasterSid"
      ),
      booking_links AS (
        -- Normalize booking linkage so the final booking stage is easier to read.
        SELECT
          fl."PreCustomerMasterSid",
          qh."PreCustomerMasterSid" AS "quoteLeadSid",
          eh."PreCustomerMasterSid" AS "enquiryLeadSid",
          bh."CustomerMasterSid" AS "bookingCustomerSid",
          qh."CustomerMasterSid" AS "quoteCustomerSid",
          eh."CustomerMasterSid" AS "enquiryCustomerSid"
        FROM filtered_leads fl
        INNER JOIN "BookingHeader" bh
          ON COALESCE(bh."status", 'A') = 'A'
         AND ($5::timestamptz IS NULL OR bh."BookingDateTime" >= $5::timestamptz)
         AND ($6::timestamptz IS NULL OR bh."BookingDateTime" <= $6::timestamptz)
        LEFT JOIN "QuoteHeader" qh
          ON bh."QuotationHeaderSid" = qh."QuoteHeaderSid"
         AND COALESCE(qh."status", 'A') = 'A'
        LEFT JOIN "EnquiryHeader" eh
          ON (
            bh."EnquiryHeaderSid" = eh."EnquiryHeaderSid"
            OR qh."EnquirySid" = eh."EnquiryHeaderSid"
          )
         AND COALESCE(eh."status", 'A') = 'A'
      ),
      booking_stage AS (
        -- Bookings always belong to customers, but we attribute them back to the original lead
        -- through either the lead-linked quote/enquiry chain or the derived customer record.
        SELECT
          bl."PreCustomerMasterSid",
          BOOL_OR(
            bl."quoteLeadSid" = bl."PreCustomerMasterSid"
            OR bl."enquiryLeadSid" = bl."PreCustomerMasterSid"
          ) AS "viaLead",
          BOOL_OR(lc."CustomerMasterSid" IS NOT NULL) AS "viaCustomer"
        FROM booking_links bl
        LEFT JOIN lead_customers lc
          ON lc."PreCustomerMasterSid" = bl."PreCustomerMasterSid"
         AND (
           bl."bookingCustomerSid" = lc."CustomerMasterSid"
           OR bl."quoteCustomerSid" = lc."CustomerMasterSid"
           OR bl."enquiryCustomerSid" = lc."CustomerMasterSid"
         )
        WHERE
          bl."quoteLeadSid" = bl."PreCustomerMasterSid"
          OR bl."enquiryLeadSid" = bl."PreCustomerMasterSid"
          OR lc."CustomerMasterSid" IS NOT NULL
        GROUP BY bl."PreCustomerMasterSid"
      ),
      confirmed_meeting_customer_origin AS (
        SELECT DISTINCT pcmm."PreCustomerMasterSid"
        FROM "PreCustomerMeeting" pcmm
        WHERE
          COALESCE(pcmm."status", 'A') = 'A'
          AND pcmm."meetingStatus" = 'Confirmed'
          AND ($7::timestamp IS NULL OR pcmm."meetingDate" >= $7::timestamp)
          AND ($8::timestamp IS NULL OR pcmm."meetingDate" <= $8::timestamp)
      ),
      approved_quote_customer_origin AS (
        SELECT DISTINCT qh."PreCustomerMasterSid"
        FROM "QuoteHeader" qh
        WHERE
          COALESCE(qh."status", 'A') = 'A'
          AND ($7::date IS NULL OR qh."QuoteDate" >= $7::date)
          AND ($8::date IS NULL OR qh."QuoteDate" <= $8::date)
          AND ${approvedQuotePredicate}
      ),
      customer_stage AS (
        -- Customers created from leads, with source path classification.
        SELECT
          lc."PreCustomerMasterSid",
          BOOL_OR(cmco."PreCustomerMasterSid" IS NOT NULL) AS "viaMeeting",
          BOOL_OR(aqco."PreCustomerMasterSid" IS NOT NULL) AS "viaApprovedQuote"
        FROM lead_customers lc
        LEFT JOIN confirmed_meeting_customer_origin cmco
          ON cmco."PreCustomerMasterSid" = lc."PreCustomerMasterSid"
        LEFT JOIN approved_quote_customer_origin aqco
          ON aqco."PreCustomerMasterSid" = lc."PreCustomerMasterSid"
        WHERE
          ($5::timestamptz IS NULL OR lc."customerCreatedOn" >= $5::timestamptz)
          AND ($6::timestamptz IS NULL OR lc."customerCreatedOn" <= $6::timestamptz)
        GROUP BY lc."PreCustomerMasterSid"
      )
      SELECT
        COUNT(*) AS "totalLeads",
        COUNT(*) FILTER (WHERE meetings_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithMeeting",
        COUNT(*) FILTER (WHERE enquiry_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithEnquiry",
        COUNT(*) FILTER (WHERE quote_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithQuote",
        COUNT(*) FILTER (WHERE approved_quote_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithApprovedQuote",
        COUNT(*) FILTER (WHERE booking_stage."PreCustomerMasterSid" IS NOT NULL AND approved_quote_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithBooking",
        COUNT(*) FILTER (WHERE customer_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsTurnedCustomer",
        COUNT(*) FILTER (WHERE enquiry_stage."viaLead" IS TRUE) AS "enquiriesViaLead",
        COUNT(*) FILTER (WHERE enquiry_stage."viaCustomer" IS TRUE) AS "enquiriesViaCustomer",
        COUNT(*) FILTER (WHERE quote_stage."viaLead" IS TRUE) AS "quotesViaLead",
        COUNT(*) FILTER (WHERE quote_stage."viaCustomer" IS TRUE) AS "quotesViaCustomer",
        COUNT(*) FILTER (WHERE approved_quote_stage."viaLead" IS TRUE) AS "approvedQuotesViaLead",
        COUNT(*) FILTER (WHERE approved_quote_stage."viaCustomer" IS TRUE) AS "approvedQuotesViaCustomer",
        COUNT(*) FILTER (WHERE booking_stage."viaLead" IS TRUE AND approved_quote_stage."PreCustomerMasterSid" IS NOT NULL) AS "bookingsViaLead",
        COUNT(*) FILTER (WHERE booking_stage."viaCustomer" IS TRUE AND approved_quote_stage."PreCustomerMasterSid" IS NOT NULL) AS "bookingsViaCustomer",
        COUNT(*) FILTER (WHERE customer_stage."viaMeeting" IS TRUE) AS "customersViaMeeting",
        COUNT(*) FILTER (WHERE customer_stage."viaApprovedQuote" IS TRUE) AS "customersViaApprovedQuote"
      FROM filtered_leads fl
      LEFT JOIN meetings_stage
        ON meetings_stage."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
      LEFT JOIN enquiry_stage
        ON enquiry_stage."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
      LEFT JOIN quote_stage
        ON quote_stage."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
      LEFT JOIN approved_quote_stage
        ON approved_quote_stage."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
      LEFT JOIN booking_stage
        ON booking_stage."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
      LEFT JOIN customer_stage
        ON customer_stage."PreCustomerMasterSid" = fl."PreCustomerMasterSid"`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
      naiveDateFrom,
      naiveDateTo,
    );

    const row = results[0] || {};

    return {
      totalLeads: Number(row.totalLeads) || 0,
      leadsWithMeeting: Number(row.leadsWithMeeting) || 0,
      leadsWithEnquiry: Number(row.leadsWithEnquiry) || 0,
      leadsWithQuote: Number(row.leadsWithQuote) || 0,
      leadsWithApprovedQuote: Number(row.leadsWithApprovedQuote) || 0,
      leadsWithBooking: Number(row.leadsWithBooking) || 0,
      leadsTurnedCustomer: Number(row.leadsTurnedCustomer) || 0,
      pathMix: {
        enquiry: {
          viaLead: Number(row.enquiriesViaLead) || 0,
          viaCustomer: Number(row.enquiriesViaCustomer) || 0,
        },
        quote: {
          viaLead: Number(row.quotesViaLead) || 0,
          viaCustomer: Number(row.quotesViaCustomer) || 0,
        },
        approvedQuote: {
          viaLead: Number(row.approvedQuotesViaLead) || 0,
          viaCustomer: Number(row.approvedQuotesViaCustomer) || 0,
        },
        booking: {
          viaLead: Number(row.bookingsViaLead) || 0,
          viaCustomer: Number(row.bookingsViaCustomer) || 0,
        },
        customer: {
          viaMeeting: Number(row.customersViaMeeting) || 0,
          viaApprovedQuote: Number(row.customersViaApprovedQuote) || 0,
        },
      },
    };
  }


  private async getLeadAgeCohorts(query: SalesDashboardQueryDto) {
    const {
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
    } = this.normalizeParams(query);

    // Use the same broad salesperson scope as the funnel chart:
    // createdBy = email  OR  assigned via PreCustomerMeeting.leadAssignTo = id
    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        COUNT(*) FILTER (WHERE pcm."createdOn" >= NOW() - INTERVAL '7 days') AS "days0to7",
        COUNT(*) FILTER (WHERE pcm."createdOn" >= NOW() - INTERVAL '30 days'
                         AND pcm."createdOn" < NOW() - INTERVAL '7 days') AS "days7to30",
        COUNT(*) FILTER (WHERE pcm."createdOn" >= NOW() - INTERVAL '60 days'
                         AND pcm."createdOn" < NOW() - INTERVAL '30 days') AS "days30to60",
        COUNT(*) FILTER (WHERE pcm."createdOn" < NOW() - INTERVAL '60 days') AS "days60plus"
      FROM "PreCustomerMaster" pcm
      WHERE
        pcm."status" = 'A'
        AND pcm."CompanyMasterSid" = $1
        AND pcm."BranchMasterSid" = $2
        AND (
          ($3::int IS NULL AND $4::text IS NULL)
          OR pcm."createdBy" = $4
          OR EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm_scope
            WHERE pcmm_scope."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
              AND COALESCE(pcmm_scope."status", 'A') = 'A'
              AND pcmm_scope."leadAssignTo" = $3
          )
        )
        AND ($5::timestamptz IS NULL OR pcm."createdOn" >= $5::timestamptz)
        AND ($6::timestamptz IS NULL OR pcm."createdOn" <= $6::timestamptz)
        AND NOT EXISTS (
          SELECT 1 FROM "CustomerMaster" cm
          WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND cm."status" = 'A'
        )`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
    );

    const row = results[0] || {};
    const days0to7 = Number(row.days0to7) || 0;
    const days7to30 = Number(row.days7to30) || 0;
    const days30to60 = Number(row.days30to60) || 0;
    const days60plus = Number(row.days60plus) || 0;

    return {
      days0to7,
      days7to30,
      days30to60,
      days60plus,
      total: days0to7 + days7to30 + days30to60 + days60plus,
    };
  }

}
