import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SalesDashboardQueryDto } from '../../DTO/sales-dashboard.dto';

@Injectable()
export class SalesDashboardService {
  constructor(private readonly db: DatabaseService) {}

  async getSalesDashboardData(query: SalesDashboardQueryDto) {
    const [
      leadsNoMeeting,
      meetingsScheduled,
      meetingsWithFollowup,
      meetingsNotConverted,
      customersNoQuote,
      quotesNotApproved,
      quotesNoBooking,
      summaryKpis,
      leadStatusDistribution,
    ] = await Promise.all([
      this.getLeadsNoMeeting(query),
      this.getMeetingsScheduled(query),
      this.getMeetingsWithFollowup(query),
      this.getMeetingsNotConverted(query),
      this.getCustomersNoQuote(query),
      this.getQuotesNotApproved(query),
      this.getQuotesNoBooking(query),
      this.getSummaryKpis(query),
      this.getLeadStatusDistribution(query),
    ]);

    const funnelCounts = {
      leadsNoMeeting: leadsNoMeeting.length,
      meetingsScheduled:
        meetingsScheduled.overdue.length +
        meetingsScheduled.today.length +
        meetingsScheduled.future.length,
      followUpsPending: meetingsWithFollowup.length,
      meetingsNotConverted: meetingsNotConverted.length,
      customersNoQuote: customersNoQuote.length,
      quotesNotApproved: quotesNotApproved.length,
      quotesNoBooking: quotesNoBooking.length,
      totalBookings: summaryKpis.bookings.totalBookings,
    };

    return {
      sections: {
        leadsNoMeeting,
        meetingsScheduled,
        meetingsWithFollowup,
        meetingsNotConverted,
        customersNoQuote,
        quotesNotApproved,
        quotesNoBooking,
        summaryKpis,
      },
      charts: {
        funnelCounts,
        meetingsBoardCounts: {
          overdue: meetingsScheduled.overdue.length,
          today: meetingsScheduled.today.length,
          future: meetingsScheduled.future.length,
        },
        leadStatusDistribution,
      },
    };
  }

  async getSectionData(sectionNumber: number, query: SalesDashboardQueryDto) {
    switch (sectionNumber) {
      case 1:
        return this.getLeadsNoMeeting(query);
      case 2:
        return this.getMeetingsScheduled(query);
      case 3:
        return this.getMeetingsWithFollowup(query);
      case 4:
        return this.getMeetingsNotConverted(query);
      case 5:
        return this.getCustomersNoQuote(query);
      case 6:
        return this.getQuotesNotApproved(query);
      case 7:
        return this.getQuotesNoBooking(query);
      case 8:
        return this.getSummaryKpis(query);
      default:
        throw new Error(`Invalid section number: ${sectionNumber}`);
    }
  }

  async getSalesDashboardCounts(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, salespersonEmail, dateFrom, dateTo } = this.normalizeParams(query);

    const [
      leadsNoMeetingCount,
      meetingsScheduledCounts,
      followUpsPendingCount,
      meetingsNotConvertedCount,
      customersNoQuoteCount,
      quotesNotApprovedCount,
      quotesNoBookingCount,
      summaryKpis,
      leadStatusDistribution,
    ] = await Promise.all([
      // Section 1: Leads No Meeting count
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
          AND ($3::int IS NULL OR pcm."leadAssignTo" = $3)
          AND ($6::text IS NULL OR pcm."createdBy" = $6)`,
        companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo, salespersonEmail,
      ),
      // Section 2: Meetings Scheduled — split by overdue/today/future
      this.db.$queryRawUnsafe(
        `SELECT
          COUNT(*) FILTER (WHERE pcmm."meetingDate"::date < CURRENT_DATE) AS "overdue",
          COUNT(*) FILTER (WHERE pcmm."meetingDate"::date = CURRENT_DATE) AS "today",
          COUNT(*) FILTER (WHERE pcmm."meetingDate"::date > CURRENT_DATE) AS "future"
        FROM "PreCustomerMeeting" pcmm
        WHERE
          pcmm."status" = 'A'
          AND pcmm."meetingDate" IS NOT NULL
          AND pcmm."CompanyMasterSid" = $1
          AND pcmm."BranchMasterSid" = $2
          AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
          AND ($4::timestamptz IS NULL OR pcmm."createdOn" >= $4::timestamptz)
          AND ($5::timestamptz IS NULL OR pcmm."createdOn" <= $5::timestamptz)`,
        companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo,
      ),
      // Section 3: Follow-Ups Pending count
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "PreCustomerMeeting" pcmm
        WHERE
          pcmm."followUpDate" IS NOT NULL
          AND pcmm."status" = 'A'
          AND pcmm."CompanyMasterSid" = $1
          AND pcmm."BranchMasterSid" = $2
          AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
          AND ($4::timestamptz IS NULL OR pcmm."followUpDate" >= $4::timestamptz)
          AND ($5::timestamptz IS NULL OR pcmm."followUpDate" <= $5::timestamptz)
          AND pcmm."meetingStatus" <> 'Completed'`,
        companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo,
      ),
      // Section 4: Meetings Not Converted count
      this.db.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT pcm."PreCustomerMasterSid") AS "count"
        FROM "PreCustomerMaster" pcm
        INNER JOIN "PreCustomerMeeting" pcmm
          ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
        WHERE
          pcm."status" = 'A'
          AND pcm."leadStatus"::text NOT IN ('DealWon', 'ContractSigned')
          AND NOT EXISTS (
            SELECT 1 FROM "CustomerMaster" cm
            WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND cm."status" = 'A'
          )
          AND pcm."CompanyMasterSid" = $1
          AND pcm."BranchMasterSid" = $2
          AND ($3::int IS NULL OR pcm."leadAssignTo" = $3)
          AND ($4::timestamptz IS NULL OR pcmm."meetingDate" >= $4::timestamptz)
          AND ($5::timestamptz IS NULL OR pcmm."meetingDate" <= $5::timestamptz)`,
        companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo,
      ),
      // Section 5: Customers No Quote count
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "CustomerMaster" cm
        LEFT JOIN "QuoteHeader" qh
          ON cm."CustomerMasterSid" = qh."CustomerMasterSid" AND qh."status" = 'A'
        LEFT JOIN "BookingHeader" bh
          ON cm."CustomerMasterSid" = bh."CustomerMasterSid" AND bh."status" = 'A'
        LEFT JOIN "PreCustomerMaster" pcm
          ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
        WHERE
          qh."QuoteHeaderSid" IS NULL
          AND bh."BookingHeaderSid" IS NULL
          AND cm."PreCustomerMasterSid" IS NOT NULL
          AND cm."status" = 'A'
          AND cm."CompanyMasterSid" = $1
          AND ($2::int IS NULL OR pcm."BranchMasterSid" = $2)
          AND ($3::int IS NULL OR pcm."leadAssignTo" = $3)
          AND ($4::timestamptz IS NULL OR cm."createdOn" >= $4::timestamptz)
          AND ($5::timestamptz IS NULL OR cm."createdOn" <= $5::timestamptz)`,
        companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo,
      ),
      // Section 6: Quotes Not Approved count
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
        companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo,
      ),
      // Section 7: Quotes No Booking count
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
        companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo,
      ),
      // Summary KPIs (reuse existing)
      this.getSummaryKpis(query),
      // Lead Status Distribution (reuse existing)
      this.getLeadStatusDistribution(query),
    ]);

    const s1 = (leadsNoMeetingCount as any[])[0] || {};
    const s2 = (meetingsScheduledCounts as any[])[0] || {};
    const s3 = (followUpsPendingCount as any[])[0] || {};
    const s4 = (meetingsNotConvertedCount as any[])[0] || {};
    const s5 = (customersNoQuoteCount as any[])[0] || {};
    const s6 = (quotesNotApprovedCount as any[])[0] || {};
    const s7 = (quotesNoBookingCount as any[])[0] || {};

    const counts = {
      leadsNoMeeting: Number(s1.count) || 0,
      meetingsScheduled: (Number(s2.overdue) || 0) + (Number(s2.today) || 0) + (Number(s2.future) || 0),
      followUpsPending: Number(s3.count) || 0,
      meetingsNotConverted: Number(s4.count) || 0,
      customersNoQuote: Number(s5.count) || 0,
      quotesNotApproved: Number(s6.count) || 0,
      quotesNoBooking: Number(s7.count) || 0,
      totalBookings: summaryKpis.bookings.totalBookings,
    };

    return {
      counts,
      summaryKpis,
      charts: {
        funnelCounts: counts,
        meetingsBoardCounts: {
          overdue: Number(s2.overdue) || 0,
          today: Number(s2.today) || 0,
          future: Number(s2.future) || 0,
        },
        leadStatusDistribution,
      },
    };
  }

  // ── Normalize query params (query string values arrive as strings) ──

  private normalizeParams(query: SalesDashboardQueryDto) {
    return {
      companyMasterSid: Number(query.companyMasterSid),
      branchMasterSid: Number(query.branchMasterSid),
      salespersonId: query.salespersonId ? Number(query.salespersonId) : null,
      salespersonEmail: query.salespersonEmail || null,
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
    };
  }

  // ── Section 1: Leads Created/Assigned — No Meeting Scheduled ──

  private async getLeadsNoMeeting(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, salespersonEmail, dateFrom, dateTo } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."phone",
        pcm."email",
        pcm."leadStatus",
        pcm."leadFrom",
        pcm."customerType",
        pcm."leadAssignTo",
        pcm."createdOn",
        um."userName" AS "salespersonName"
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
        AND ($6::text IS NULL OR pcm."createdBy" = $6)
      ORDER BY pcm."createdOn" DESC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      dateFrom,
      dateTo,
      salespersonEmail,
    );

    return results;
  }

  // ── Section 2: Meetings Scheduled — Overdue / Today / Future ──

  private async getMeetingsScheduled(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        pcmm."PreCustomerMeetingSid",
        pcmm."meetingDate",
        pcmm."meetingType",
        pcmm."meetingStatus",
        pcmm."meetingNote",
        pcmm."meetingDuration",
        pcmm."leadAssignTo",
        pcmm."LeadOrCustomer",
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."phone",
        cm."CustomerMasterSid",
        cm."CustomerName",
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
        AND pcmm."CompanyMasterSid" = $1
        AND pcmm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        AND ($4::timestamptz IS NULL OR pcmm."createdOn" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR pcmm."createdOn" <= $5::timestamptz)
      ORDER BY pcmm."meetingDate" ASC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      dateFrom,
      dateTo,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const overdue = results.filter((m) => new Date(m.meetingDate) < today);
    const todayArr = results.filter((m) => {
      const d = new Date(m.meetingDate);
      return d >= today && d < tomorrow;
    });
    const future = results.filter((m) => new Date(m.meetingDate) >= tomorrow);

    return { overdue, today: todayArr, future };
  }

  // ── Section 3: Meetings with Follow-Up ──

  private async getMeetingsWithFollowup(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        pcmm."PreCustomerMeetingSid",
        pcmm."meetingDate",
        pcmm."meetingType",
        pcmm."meetingStatus",
        pcmm."meetingNote",
        pcmm."followUpDate",
        pcmm."followUpNote",
        pcmm."leadAssignTo",
        pcmm."LeadOrCustomer",
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        cm."CustomerMasterSid",
        cm."CustomerName",
        um."userName" AS "salespersonName",
        CASE
          WHEN pcmm."followUpDate" < CURRENT_DATE THEN 'Overdue'
          WHEN pcmm."followUpDate" = CURRENT_DATE THEN 'Due Today'
          ELSE 'Upcoming'
        END AS "followUpStatus"
      FROM "PreCustomerMeeting" pcmm
      LEFT JOIN "PreCustomerMaster" pcm
        ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm
        ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE
        pcmm."followUpDate" IS NOT NULL
        AND pcmm."status"= 'A'
        AND pcmm."CompanyMasterSid" = $1
        AND pcmm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        AND ($4::timestamptz IS NULL OR pcmm."followUpDate" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR pcmm."followUpDate" <= $5::timestamptz)
        AND pcmm."meetingStatus" <> 'Completed'
      ORDER BY pcmm."followUpDate" ASC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      dateFrom,
      dateTo,
    );

    return results;
  }

  // ── Section 4: Meeting Conducted but Lead Not Converted ──

  private async getMeetingsNotConverted(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."phone",
        pcm."email",
        pcm."leadStatus",
        pcm."leadAssignTo",
        pcm."createdOn" AS "leadCreatedOn",
        COUNT(pcmm."PreCustomerMeetingSid") AS "meetingCount",
        MAX(pcmm."meetingDate") AS "lastMeetingDate",
        um."userName" AS "salespersonName"
      FROM "PreCustomerMaster" pcm
      INNER JOIN "PreCustomerMeeting" pcmm
        ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE
        pcm."status" = 'A'
        AND pcm."leadStatus"::text NOT IN ('DealWon', 'ContractSigned')
        AND NOT EXISTS (
          SELECT 1 FROM "CustomerMaster" cm
          WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND cm."status" = 'A'
        )
        AND pcm."CompanyMasterSid" = $1
        AND pcm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcm."leadAssignTo" = $3)
        AND ($4::timestamptz IS NULL OR pcmm."meetingDate" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR pcmm."meetingDate" <= $5::timestamptz)
      GROUP BY
        pcm."PreCustomerMasterSid",
        pcm."preCustomerName",
        pcm."contactPerson",
        pcm."phone",
        pcm."email",
        pcm."leadStatus",
        pcm."leadAssignTo",
        pcm."createdOn",
        um."userName"
      ORDER BY MAX(pcmm."meetingDate") DESC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      dateFrom,
      dateTo,
    );

    return results.map((r) => ({
      ...r,
      meetingCount: Number(r.meetingCount),
    }));
  }

  // ── Section 5: Lead Converted to Customer — No Quote or Booking ──

  private async getCustomersNoQuote(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        cm."CustomerMasterSid",
        cm."CustomerName",
        cm."CustomerAddress1",
        cm."PreCustomerMasterSid",
        cm."createdOn" AS "customerCreatedOn",
        pcm."preCustomerName",
        pcm."leadAssignTo",
        um."userName" AS "salespersonName"
      FROM "CustomerMaster" cm
      LEFT JOIN "QuoteHeader" qh
        ON cm."CustomerMasterSid" = qh."CustomerMasterSid"
        AND qh."status" = 'A'
      LEFT JOIN "BookingHeader" bh
        ON cm."CustomerMasterSid" = bh."CustomerMasterSid"
        AND bh."status" = 'A'
      LEFT JOIN "PreCustomerMaster" pcm
        ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE
        qh."QuoteHeaderSid" IS NULL
        AND bh."BookingHeaderSid" IS NULL
        AND cm."PreCustomerMasterSid" IS NOT NULL
        AND cm."status" = 'A'
        AND cm."CompanyMasterSid" = $1
        AND ($2::int IS NULL OR pcm."BranchMasterSid" = $2)
        AND ($3::int IS NULL OR pcm."leadAssignTo" = $3)
        AND ($4::timestamptz IS NULL OR cm."createdOn" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR cm."createdOn" <= $5::timestamptz)
      ORDER BY cm."createdOn" DESC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      dateFrom,
      dateTo,
    );

    return results;
  }

  // ── Section 6: Quote Given but Not Approved ──

  private async getQuotesNotApproved(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
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
        qh."FreightPPCC",
        qh."TransportType",
        pcm."preCustomerName",
        um."userName" AS "salespersonName"
      FROM "QuoteHeader" qh
      LEFT JOIN "PreCustomerMaster" pcm
        ON qh."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON qh."SalesmanSid" = um."UserMasterSid"
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
      ORDER BY qh."QuoteDate" DESC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      dateFrom,
      dateTo,
    );

    return results;
  }

  // ── Section 7: Quote Approved but Booking Not Created ──

  private async getQuotesNoBooking(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        qh."QuoteHeaderSid",
        qh."QuoteNumber",
        qh."QuoteDate",
        qh."SalesmanSid",
        qh."LeadOrCustomer",
        qh."PreCustomerMasterSid",
        qh."CustomerMasterSid",
        qh."CustomerName",
        qh."TransportType",
        qh."FreightPPCC",
        pcm."preCustomerName",
        um."userName" AS "salespersonName"
      FROM "QuoteHeader" qh
      LEFT JOIN "PreCustomerMaster" pcm
        ON qh."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um
        ON qh."SalesmanSid" = um."UserMasterSid"
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
      ORDER BY qh."QuoteDate" DESC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      dateFrom,
      dateTo,
    );

    return results;
  }

  // ── Section 8: Summary — Quotation vs Booking KPIs ──

  private async getSummaryKpis(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo } = this.normalizeParams(query);

    const [quoteResults, bookingResults] = await Promise.all([
      this.db.$queryRawUnsafe(
        `SELECT
          COUNT(*) AS "totalQuotes",
          COUNT(*) FILTER (WHERE qh."authorizerStatus"::text = 'Approved') AS "approvedQuotes",
          COUNT(*) FILTER (WHERE qh."authorizerStatus"::text = 'Pending') AS "pendingQuotes",
          COUNT(*) FILTER (WHERE qh."authorizerStatus"::text = 'Rejected') AS "rejectedQuotes",
          COUNT(*) FILTER (WHERE qh."authorizerStatus"::text IN ('WaitingForFinalApproval', 'WaitingForCustomerApproval')) AS "waitingQuotes",
          COUNT(*) FILTER (WHERE qh."BookingHeaderSid" IS NOT NULL) AS "quotesWithBooking"
        FROM "QuoteHeader" qh
        WHERE
          qh."status" IN ('A', 'S')
          AND qh."CompanyMasterSid" = $1
          AND qh."BranchMasterSid" = $2
          AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
          AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
          AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        dateFrom,
        dateTo,
      ),
      this.db.$queryRawUnsafe(
        `SELECT
          COUNT(*) AS "totalBookings",
          COUNT(*) FILTER (WHERE bh."QuotationHeaderSid" IS NOT NULL) AS "bookingsFromQuote",
          COUNT(*) FILTER (WHERE bh."QuotationHeaderSid" IS NULL) AS "directBookings",
          COUNT(*) FILTER (WHERE bh."ShipmentType" = 'FCL') AS "fclBookings",
          COUNT(*) FILTER (WHERE bh."ShipmentType" = 'LCL') AS "lclBookings",
          COUNT(*) FILTER (WHERE bh."ShipmentType" = 'AIR') AS "airBookings"
        FROM "BookingHeader" bh
        WHERE
          bh."status" IN ('A', 'S')
          AND bh."CompanyMasterSid" = $1
          AND ($2::int IS NULL OR bh."BranchMasterSid" = $2)
          AND ($3::int IS NULL OR bh."SalesmanSid" = $3)
          AND ($4::date IS NULL OR bh."BookingDateTime" >= $4::date)
          AND ($5::date IS NULL OR bh."BookingDateTime" <= $5::date)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        dateFrom,
        dateTo,
      ),
    ]);

    const quotes = (quoteResults as any[])[0] || {};
    const bookings = (bookingResults as any[])[0] || {};

    return {
      quotes: {
        totalQuotes: Number(quotes.totalQuotes) || 0,
        approvedQuotes: Number(quotes.approvedQuotes) || 0,
        pendingQuotes: Number(quotes.pendingQuotes) || 0,
        rejectedQuotes: Number(quotes.rejectedQuotes) || 0,
        waitingQuotes: Number(quotes.waitingQuotes) || 0,
        quotesWithBooking: Number(quotes.quotesWithBooking) || 0,
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

  // ── Chart: Lead Status Distribution ──

  private async getLeadStatusDistribution(query: SalesDashboardQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId, dateFrom, dateTo } = this.normalizeParams(query);

    const results: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        pcm."leadStatus"::text AS "status",
        COUNT(*) AS "count"
      FROM "PreCustomerMaster" pcm
      WHERE
        pcm."status" IN ('A', 'S')
        AND pcm."CompanyMasterSid" = $1
        AND pcm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcm."leadAssignTo" = $3)
        AND ($4::timestamptz IS NULL OR pcm."createdOn" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR pcm."createdOn" <= $5::timestamptz)
      GROUP BY pcm."leadStatus"
      ORDER BY "count" DESC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      dateFrom,
      dateTo,
    );

    return results.map((r) => ({
      status: r.status,
      count: Number(r.count),
    }));
  }
}
