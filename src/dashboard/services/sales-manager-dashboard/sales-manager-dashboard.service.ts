import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';
import { SalesManagerQueryDto } from '../../DTO/sales-manager-dashboard.dto';
import {
  ReassignLeadDto,
  BulkReassignDto,
  CreateMeetingOnBehalfDto,
  SendReminderDto,
} from '../../DTO/sales-manager-actions.dto';

interface NormalizedParams {
  companyMasterSid: number;
  branchMasterSid: number;
  salespersonId: number | null;
  salespersonEmail: string | null;
  dateFrom: Date | string | null;
  dateTo: Date | string | null;
  compareDateFrom: string | null;
  compareDateTo: string | null;
  naiveDateFrom: string | null;
  naiveDateTo: string | null;
  compareNaiveDateFrom: string | null;
  compareNaiveDateTo: string | null;
  page: number;
  pageSize: number;
  search: string | null;
  bucket: 'overdue' | 'today' | 'future' | null;
}

interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

@Injectable()
export class SalesManagerDashboardService {
  private readonly defaultPageSize = 10;
  private readonly maxPageSize = 50;

  constructor(
    private readonly db: DatabaseService,
    private readonly emailService: EmailService,
  ) {}

  // ─── SALESPERSONS LIST ───────────────────────────────────────────────

  async getSalespersons(companyMasterSid: number, branchMasterSid: number) {
    const rows: any[] = await this.db.$queryRawUnsafe(
      `SELECT
        um."UserMasterSid",
        um."userName",
        um."userEmail",
        um."contactNumber"
      FROM "UserMaster" um
      INNER JOIN "UserBranchMaster" ubm
        ON um."UserMasterSid" = ubm."UserMasterSid"
      WHERE
        ubm."CompanyMasterSid" = $1
        AND ubm."BranchMasterSid" = $2
        AND um."isSalesperson" = '1'
        AND um."status" = 'A'
        AND ubm."status" = 'A'
      ORDER BY um."userName" ASC`,
      companyMasterSid,
      branchMasterSid,
    );

    return rows.map((r) => ({
      UserMasterSid: r.UserMasterSid,
      userName: r.userName,
      userEmail: r.userEmail,
      contactNumber: r.contactNumber,
      avatarColor: this.getAvatarColor(r.UserMasterSid),
    }));
  }

  // ─── TEAM AGGREGATE COUNTS ───────────────────────────────────────────

  async getCounts(query: SalesManagerQueryDto) {
    const {
      companyMasterSid,
      branchMasterSid,
      salespersonId,
      salespersonEmail,
      dateFrom,
      dateTo,
      naiveDateFrom,
      naiveDateTo,
      compareDateFrom,
      compareDateTo,
      compareNaiveDateFrom,
      compareNaiveDateTo,
    } = this.normalizeParams(query);

    const [
      s1Result,
      s2Result,
      s3Result,
      s4Result,
      s5Result,
      s6Result,
      s7Result,
      s8Result,
      kpiResult,
    ] = await Promise.all([
      // S1: Leads no meeting
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
          AND ($3::int IS NULL OR TRUE)
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
      // S2: Meetings scheduled (overdue/today/future)
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
          AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
      ),
      // S3: Follow-ups pending
      this.db.$queryRawUnsafe(
        `SELECT COUNT(*) AS "count"
        FROM "PreCustomerMeeting" pcmm
        WHERE
          pcmm."followUpDate" IS NOT NULL
          AND pcmm."status" = 'A'
          AND pcmm."CompanyMasterSid" = $1
          AND pcmm."BranchMasterSid" = $2
          AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
          AND ($4::timestamp IS NULL OR pcmm."followUpDate" >= $4::timestamp)
          AND ($5::timestamp IS NULL OR pcmm."followUpDate" <= $5::timestamp)
          AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')`,
        companyMasterSid,
        branchMasterSid,
        salespersonId,
        naiveDateFrom,
        naiveDateTo,
      ),
      // S4: Business not converted
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
      // S5: Customer no quote/booking
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
      // S6: Enquiry counts
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
        dateFrom,
        dateTo,
      ),
      // S7: Quotes pending approval
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
        dateFrom,
        dateTo,
      ),
      // S8: Approved quotes no booking
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
        dateFrom,
        dateTo,
      ),
      this.getKPIData(query),
    ]);

    const s1 = (s1Result as any[])[0] || {};
    const s2 = (s2Result as any[])[0] || {};
    const s3 = (s3Result as any[])[0] || {};
    const s4 = (s4Result as any[])[0] || {};
    const s5 = (s5Result as any[])[0] || {};
    const s6 = (s6Result as any[])[0] || {};
    const s7 = (s7Result as any[])[0] || {};
    const s8 = (s8Result as any[])[0] || {};
    const kpiData = kpiResult || {};

    return {
      counts: {
        leadsNoMeeting: Number(s1.count) || 0,
        meetingsScheduled:
          (Number(s2.overdue) || 0) + (Number(s2.today) || 0) + (Number(s2.future) || 0),
        meetingsOverdue: Number(s2.overdue) || 0,
        meetingsToday: Number(s2.today) || 0,
        meetingsFuture: Number(s2.future) || 0,
        followUpsPending: Number(s3.count) || 0,
        meetingsNotConverted: Number(s4.count) || 0,
        customersNoQuote: Number(s5.count) || 0,
        enquiriesNoQuotation: Number(s6.enquiriesNoQuotation) || 0,
        quotesNotApproved: Number(s7.count) || 0,
        quotesNoBooking: Number(s8.count) || 0,
      },
      kpi: kpiResult,
    };
  }

  // ─── SECTION DATA (reuses salesperson queries with optional filter) ──

  async getSectionData(sectionNumber: number, query: SalesManagerQueryDto) {
    const params = this.normalizeParams(query);

    switch (sectionNumber) {
      case 1:
        return this.getLeadsNoMeetingPage(params);
      case 2:
        if (params.bucket) return this.getMeetingsScheduledBucket(params, params.bucket);
        return this.getMeetingsScheduledAll(params);
      case 3:
        return this.getFollowUpsPendingPage(params);
      case 4:
        return this.getMeetingsNotConvertedPage(params);
      case 5:
        return this.getCustomersNoQuotePage(params);
      case 6:
        return this.getEnquiriesNoQuotationPage(params);
      case 7:
        return this.getQuotesPendingApprovalPage(params);
      case 8:
        return this.getQuotesNoBookingPage(params);
      default:
        throw new Error(`Invalid section number: ${sectionNumber}`);
    }
  }

  async getKPIData(query: SalesManagerQueryDto) {
    const [current, previous] = await Promise.all([
      this.getKPIBlock(query, 'current'),
      this.getKPIBlock(query, 'previous'),
    ]);

    return {
      leadsCreated: this.buildKpiMetric(
        current.leadsCreated,
        previous.leadsCreated
      ),

      meetingScheduled: this.buildKpiMetric(
        current.meetingScheduled,
        previous.meetingScheduled
      ),

      quoteCreated: this.buildKpiMetric(
        current.quoteCreated,
        previous.quoteCreated
      ),

      leadConvertedToCustomer: this.buildKpiMetric(
        current.leadConvertedToCustomer,
        previous.leadConvertedToCustomer
      ),

      profitAtQuote: this.buildKpiMetric(
        current.profitAtQuote,
        previous.profitAtQuote
      ),
    };
  }

  async getKPIBlock(query: SalesManagerQueryDto, state : 'current' | 'previous') {
    const { 
      companyMasterSid, branchMasterSid, 
      dateFrom, dateTo , 
      naiveDateFrom , naiveDateTo ,
      compareDateFrom, compareDateTo,
      compareNaiveDateFrom, compareNaiveDateTo
    } = this.normalizeParams(query);

    const from = state === 'current' ? dateFrom : compareDateFrom;
    const to = state === 'current' ? dateTo : compareDateTo;

    const naiveFrom = state === 'current' ? naiveDateFrom : compareNaiveDateFrom;
    const naiveTo = state === 'current' ? naiveDateTo : compareNaiveDateTo;

    if (state === 'previous' && (!from || !to)) {
      return {
        leadsCreated: 0,
        meetingScheduled: 0,
        quoteCreated: 0,
        leadConvertedToCustomer: 0,
        profitAtQuote: 0
      };
    }

    const result : any[] = await this.db.$queryRawUnsafe(`
    SELECT
    (
      SELECT COUNT(*) FROM "PreCustomerMaster" pcm
      WHERE 
        pcm."CompanyMasterSid" = $1 AND 
        pcm."BranchMasterSid" = $2 AND 
        pcm."createdOn" >= $3::timestamptz AND 
        pcm."createdOn" <= $4::timestamptz AND
        pcm."status" = 'A'
    ) AS "leadsCreated",
     
    (
      SELECT COUNT(*) FROM "PreCustomerMeeting" pcmm
      WHERE 
        pcmm."CompanyMasterSid" = $1 AND 
        pcmm."BranchMasterSid" = $2 AND 
        pcmm."meetingDate"::date >= $5::date AND 
        pcmm."meetingDate"::date <= $6::date AND
        pcmm."status" = 'A'
    ) AS "meetingScheduled",
     
    (
      SELECT COUNT(*) FROM "CustomerMaster" cm
      INNER JOIN "PreCustomerMaster" pcm3 
        ON cm."PreCustomerMasterSid" = pcm3."PreCustomerMasterSid"
      WHERE 
        cm."CompanyMasterSid" = $1 AND 
        pcm3."BranchMasterSid" = $2 AND
        cm."createdOn" >= $3::timestamptz AND
        cm."createdOn" <= $4::timestamptz AND
        cm."status" = 'A'
    ) AS "leadConvertedToCustomer",
      
    (
      SELECT COUNT(*) FROM "QuoteHeader" qh
      WHERE 
        qh."status" = 'A' AND 
        qh."CompanyMasterSid" = $1 AND 
        qh."BranchMasterSid" = $2 AND
        qh."QuoteDate" >= $3::date AND
        qh."QuoteDate" <= $4::date
    ) AS "quoteCreated",
       
    (
      SELECT 
        COALESCE(SUM(
          COALESCE(qc."RevenueLocalAmount", 0) - 
          COALESCE(qc."CostLocalAmount", 0)
        ), 0)
      FROM "QuoteHeader" qh
      JOIN "QuoteRoute" qr 
        ON qr."QuoteHeaderSid" = qh."QuoteHeaderSid" 
        AND qr."status" = 'A'
      JOIN "QuoteCarrier" qcarr 
        ON qcarr."QuoteRouteSid" = qr."QuoteRouteSid"
        AND qcarr."ApprovalStatus" = 'Approved'
        AND qcarr."status" = 'A'
      JOIN "QuoteCharge" qc 
        ON qc."QuoteCarrierSid" = qcarr."QuoteCarrierSid" 
        AND qc."status" = 'A'
      WHERE 
        qh."CompanyMasterSid" = $1
        AND qh."BranchMasterSid" = $2
        AND qh."QuoteDate" >= $3::date 
        AND qh."QuoteDate" <= $4::date
        AND qh."status" = 'A'
    ) AS "profitAtQuote"
  `,
      companyMasterSid,
      branchMasterSid,
      from,
      to,
      naiveFrom,
      naiveTo,
    );

    return {
      leadsCreated: Number(result[0].leadsCreated || 0),
      meetingScheduled: Number(result[0].meetingScheduled || 0),
      quoteCreated: Number(result[0].quoteCreated || 0),
      leadConvertedToCustomer: Number(result[0].leadConvertedToCustomer || 0),
      profitAtQuote: Number(result[0].profitAtQuote || 0),
    };
  }

  private async getLeadMilestoneFunnelCounts(query: SalesManagerQueryDto) {
    const { companyMasterSid, branchMasterSid, dateFrom, dateTo } =
      this.normalizeParams(query);

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

    const results: any[] = await this.db.$queryRawUnsafe(
      `WITH filtered_leads AS (
        SELECT DISTINCT pcm."PreCustomerMasterSid"
        FROM "PreCustomerMaster" pcm
        WHERE
          COALESCE(pcm."status", 'A') = 'A'
          AND pcm."CompanyMasterSid" = $1
          AND pcm."BranchMasterSid" = $2
          AND ($3::date IS NULL OR pcm."createdOn"::date >= $3::date)
          AND ($4::date IS NULL OR pcm."createdOn"::date <= $4::date)
      ),
      lead_customers AS (
        SELECT
          fl."PreCustomerMasterSid",
          cm."CustomerMasterSid",
          cm."createdOn"::date AS "customerCreatedDate"
        FROM filtered_leads fl
        INNER JOIN "CustomerMaster" cm
          ON cm."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND COALESCE(cm."status", 'A') = 'A'
      ),
      meetings_stage AS (
        SELECT DISTINCT fl."PreCustomerMasterSid"
        FROM filtered_leads fl
        INNER JOIN "PreCustomerMeeting" pcmm
          ON pcmm."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND COALESCE(pcmm."status", 'A') = 'A'
         AND ($3::date IS NULL OR pcmm."meetingDate"::date >= $3::date)
         AND ($4::date IS NULL OR pcmm."meetingDate"::date <= $4::date)
      ),
      enquiry_stage AS (
        SELECT
          fl."PreCustomerMasterSid",
          BOOL_OR(eh."PreCustomerMasterSid" = fl."PreCustomerMasterSid") AS "viaLead",
          BOOL_OR(lc."CustomerMasterSid" IS NOT NULL) AS "viaCustomer"
        FROM filtered_leads fl
        INNER JOIN "EnquiryHeader" eh
          ON COALESCE(eh."status", 'A') = 'A'
         AND ($3::date IS NULL OR eh."EnquiryDate" >= $3::date)
         AND ($4::date IS NULL OR eh."EnquiryDate" <= $4::date)
        LEFT JOIN lead_customers lc
          ON lc."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND eh."CustomerMasterSid" = lc."CustomerMasterSid"
        WHERE
          eh."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
          OR lc."CustomerMasterSid" IS NOT NULL
        GROUP BY fl."PreCustomerMasterSid"
      ),
      quote_stage AS (
        SELECT
          fl."PreCustomerMasterSid",
          BOOL_OR(qh."PreCustomerMasterSid" = fl."PreCustomerMasterSid") AS "viaLead",
          BOOL_OR(lc."CustomerMasterSid" IS NOT NULL) AS "viaCustomer"
        FROM filtered_leads fl
        INNER JOIN "QuoteHeader" qh
          ON COALESCE(qh."status", 'A') = 'A'
         AND ($3::date IS NULL OR qh."QuoteDate" >= $3::date)
         AND ($4::date IS NULL OR qh."QuoteDate" <= $4::date)
        LEFT JOIN lead_customers lc
          ON lc."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
         AND qh."CustomerMasterSid" = lc."CustomerMasterSid"
        WHERE
          qh."PreCustomerMasterSid" = fl."PreCustomerMasterSid"
          OR lc."CustomerMasterSid" IS NOT NULL
        GROUP BY fl."PreCustomerMasterSid"
      ),
      approved_quote_stage AS (
        SELECT
          fl."PreCustomerMasterSid",
          BOOL_OR(qh."PreCustomerMasterSid" = fl."PreCustomerMasterSid") AS "viaLead",
          BOOL_OR(lc."CustomerMasterSid" IS NOT NULL) AS "viaCustomer"
        FROM filtered_leads fl
        INNER JOIN "QuoteHeader" qh
          ON COALESCE(qh."status", 'A') = 'A'
         AND ($3::date IS NULL OR qh."QuoteDate" >= $3::date)
         AND ($4::date IS NULL OR qh."QuoteDate" <= $4::date)
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
         AND ($3::date IS NULL OR bh."BookingDateTime"::date >= $3::date)
         AND ($4::date IS NULL OR bh."BookingDateTime"::date <= $4::date)
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
          AND ($3::date IS NULL OR pcmm."meetingDate"::date >= $3::date)
          AND ($4::date IS NULL OR pcmm."meetingDate"::date <= $4::date)
      ),
      approved_quote_customer_origin AS (
        SELECT DISTINCT qh."PreCustomerMasterSid"
        FROM "QuoteHeader" qh
        WHERE
          COALESCE(qh."status", 'A') = 'A'
          AND ($3::date IS NULL OR qh."QuoteDate" >= $3::date)
          AND ($4::date IS NULL OR qh."QuoteDate" <= $4::date)
          AND ${approvedQuotePredicate}
      ),
      customer_stage AS (
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
          ($3::date IS NULL OR lc."customerCreatedDate" >= $3::date)
          AND ($4::date IS NULL OR lc."customerCreatedDate" <= $4::date)
        GROUP BY lc."PreCustomerMasterSid"
      )
      SELECT
        COUNT(*) AS "totalLeads",
        COUNT(*) FILTER (WHERE meetings_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithMeeting",
        COUNT(*) FILTER (WHERE enquiry_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithEnquiry",
        COUNT(*) FILTER (WHERE quote_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithQuote",
        COUNT(*) FILTER (WHERE approved_quote_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithApprovedQuote",
        COUNT(*) FILTER (WHERE booking_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsWithBooking",
        COUNT(*) FILTER (WHERE customer_stage."PreCustomerMasterSid" IS NOT NULL) AS "leadsTurnedCustomer"
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
      dateFrom,
      dateTo,
    );

    const row = results[0] || {};

    return {
      leadsCreated: Number(row.totalLeads) || 0,
      meetingsHeld: Number(row.leadsWithMeeting) || 0,
      convertedToCustomer: Number(row.leadsTurnedCustomer) || 0,
      enquiryCreated: Number(row.leadsWithEnquiry) || 0,
      quoteCreated: Number(row.leadsWithQuote) || 0,
      quoteApproved: Number(row.leadsWithApprovedQuote) || 0,
      bookingCreated: Number(row.leadsWithBooking) || 0,
    };
  }

  // ─── SCOREBOARD ──────────────────────────────────────────────────────

  async getScoreboard(query: SalesManagerQueryDto) {
    const { companyMasterSid, branchMasterSid, dateFrom, dateTo, naiveDateFrom, naiveDateTo } =
      this.normalizeParams(query);

    const rows: any[] = await this.db.$queryRawUnsafe(
      `WITH salespersons AS (
        SELECT um."UserMasterSid", um."userName", um."userEmail"
        FROM "UserMaster" um
        INNER JOIN "UserBranchMaster" ubm ON um."UserMasterSid" = ubm."UserMasterSid"
        WHERE ubm."CompanyMasterSid" = $1 AND ubm."BranchMasterSid" = $2
          AND um."isSalesperson" = '1' AND um."status" = 'A' AND ubm."status" = 'A'
      ),
      s1 AS (
        SELECT pcm."createdBy" AS email, COUNT(*) AS cnt
        FROM "PreCustomerMaster" pcm
        LEFT JOIN "PreCustomerMeeting" pcmm ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
        WHERE pcmm."PreCustomerMeetingSid" IS NULL AND pcm."status" = 'A'
          AND pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
          AND ($3::timestamptz IS NULL OR pcm."createdOn" >= $3::timestamptz)
          AND ($4::timestamptz IS NULL OR pcm."createdOn" <= $4::timestamptz)
        GROUP BY pcm."createdBy"
      ),
      s2 AS (
        SELECT pcmm."leadAssignTo" AS uid, COUNT(*) AS cnt
        FROM "PreCustomerMeeting" pcmm
        WHERE pcmm."status" = 'A' AND pcmm."meetingDate" IS NOT NULL
          AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
        GROUP BY pcmm."leadAssignTo"
      ),
      s3 AS (
        SELECT pcmm."leadAssignTo" AS uid, COUNT(*) AS cnt
        FROM "PreCustomerMeeting" pcmm
        WHERE pcmm."followUpDate" IS NOT NULL AND pcmm."status" = 'A'
          AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
          AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')
          AND ($5::timestamp IS NULL OR pcmm."followUpDate" >= $5::timestamp)
          AND ($6::timestamp IS NULL OR pcmm."followUpDate" <= $6::timestamp)
        GROUP BY pcmm."leadAssignTo"
      ),
      s4 AS (
        SELECT pcmm."leadAssignTo" AS uid, COUNT(DISTINCT pcm."PreCustomerMasterSid") AS cnt
        FROM "PreCustomerMaster" pcm
        INNER JOIN "PreCustomerMeeting" pcmm ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
        WHERE pcm."status" = 'A' AND pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
          AND EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm3
            WHERE pcmm3."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm3."meetingStatus" IN ('Completed', 'Confirmed')
          )
          AND NOT EXISTS (
            SELECT 1 FROM "CustomerMaster" cm
            WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND cm."status" = 'A'
          )
          AND ($5::timestamp IS NULL OR pcmm."meetingDate" >= $5::timestamp)
          AND ($6::timestamp IS NULL OR pcmm."meetingDate" <= $6::timestamp)
        GROUP BY pcmm."leadAssignTo"
      ),
      s5 AS (
        SELECT pcmm."leadAssignTo" AS uid, COUNT(DISTINCT cm."CustomerMasterSid") AS cnt
        FROM "CustomerMaster" cm
        INNER JOIN "PreCustomerMaster" pcm ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
        INNER JOIN "PreCustomerMeeting" pcmm ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
        WHERE cm."status" = 'A' AND cm."CompanyMasterSid" = $1
          AND ($2::int IS NULL OR pcm."BranchMasterSid" = $2)
          AND NOT EXISTS (SELECT 1 FROM "QuoteHeader" qh WHERE qh."CustomerMasterSid" = cm."CustomerMasterSid")
          AND NOT EXISTS (SELECT 1 FROM "BookingHeader" bh WHERE bh."CustomerMasterSid" = cm."CustomerMasterSid")
          AND ($3::timestamptz IS NULL OR cm."createdOn" >= $3::timestamptz)
          AND ($4::timestamptz IS NULL OR cm."createdOn" <= $4::timestamptz)
        GROUP BY pcmm."leadAssignTo"
      ),
      s6 AS (
        SELECT eh."UserMasterSid" AS uid, COUNT(*) AS cnt
        FROM "EnquiryHeader" eh
        WHERE COALESCE(eh."status", 'A') = 'A'
          AND eh."CompanyMasterSid" = $1 AND eh."BranchMasterSid" = $2
          AND eh."QuoteHeaderSid" IS NULL
          AND ($3::date IS NULL OR eh."EnquiryDate" >= $3::date)
          AND ($4::date IS NULL OR eh."EnquiryDate" <= $4::date)
        GROUP BY eh."UserMasterSid"
      ),
      s7 AS (
        SELECT qh."SalesmanSid" AS uid, COUNT(*) AS cnt
        FROM "QuoteHeader" qh
        WHERE qh."status" = 'A' AND qh."CompanyMasterSid" = $1 AND qh."BranchMasterSid" = $2
          AND ($3::date IS NULL OR qh."QuoteDate" >= $3::date)
          AND ($4::date IS NULL OR qh."QuoteDate" <= $4::date)
          AND EXISTS (
            SELECT 1 FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
            AND qc."ApprovalStatus"::text = 'Approved'
          )
          AND EXISTS (
            SELECT 1 FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
            AND COALESCE(qc."ApprovalStatus"::text, '') <> 'Rejected'
          )
        GROUP BY qh."SalesmanSid"
      ),
      s8 AS (
        SELECT qh."SalesmanSid" AS uid, COUNT(*) AS cnt
        FROM "QuoteHeader" qh
        WHERE qh."status" = 'A' AND qh."BookingHeaderSid" IS NULL
          AND qh."CompanyMasterSid" = $1 AND qh."BranchMasterSid" = $2
          AND ($3::date IS NULL OR qh."QuoteDate" >= $3::date)
          AND ($4::date IS NULL OR qh."QuoteDate" <= $4::date)
          AND EXISTS (
            SELECT 1 FROM "QuoteCarrier" qc
            WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
            AND qc."ApprovalStatus"::text = 'Approved'
          )
          AND NOT EXISTS (
            SELECT 1 FROM "BookingHeader" bh
            WHERE bh."QuotationHeaderSid" = qh."QuoteHeaderSid" AND bh."status" = 'A'
          )
        GROUP BY qh."SalesmanSid"
      )
      SELECT
        sp."UserMasterSid",
        sp."userName",
        sp."userEmail",
        COALESCE(s1.cnt, 0) AS "s1",
        COALESCE(s2.cnt, 0) AS "s2",
        COALESCE(s3.cnt, 0) AS "s3",
        COALESCE(s4.cnt, 0) AS "s4",
        COALESCE(s5.cnt, 0) AS "s5",
        COALESCE(s6.cnt, 0) AS "s6",
        COALESCE(s7.cnt, 0) AS "s7",
        COALESCE(s8.cnt, 0) AS "s8"
      FROM salespersons sp
      LEFT JOIN s1 ON s1.email = sp."userEmail"
      LEFT JOIN s2 ON s2.uid = sp."UserMasterSid"
      LEFT JOIN s3 ON s3.uid = sp."UserMasterSid"
      LEFT JOIN s4 ON s4.uid = sp."UserMasterSid"
      LEFT JOIN s5 ON s5.uid = sp."UserMasterSid"
      LEFT JOIN s6 ON s6.uid = sp."UserMasterSid"
      LEFT JOIN s7 ON s7.uid = sp."UserMasterSid"
      LEFT JOIN s8 ON s8.uid = sp."UserMasterSid"
      ORDER BY sp."userName" ASC`,
      companyMasterSid,
      branchMasterSid,
      dateFrom,
      dateTo,
      naiveDateFrom,
      naiveDateTo,
    );

    return rows.map((r) => ({
      UserMasterSid: r.UserMasterSid,
      userName: r.userName,
      userEmail: r.userEmail,
      avatarColor: this.getAvatarColor(r.UserMasterSid),
      s1: Number(r.s1) || 0,
      s2: Number(r.s2) || 0,
      s3: Number(r.s3) || 0,
      s4: Number(r.s4) || 0,
      s5: Number(r.s5) || 0,
      s6: Number(r.s6) || 0,
      s7: Number(r.s7) || 0,
      s8: Number(r.s8) || 0,
      total:
        (Number(r.s1) || 0) + (Number(r.s2) || 0) + (Number(r.s3) || 0) + (Number(r.s4) || 0) +
        (Number(r.s5) || 0) + (Number(r.s6) || 0) + (Number(r.s7) || 0) + (Number(r.s8) || 0),
    }));
  }

  // ─── HEATMAP ─────────────────────────────────────────────────────────

  async getHeatmap(query: SalesManagerQueryDto) {
    const scoreboard = await this.getScoreboard(query);
    const sectionLabels = [
      'Leads No Mtg', 'Meetings', 'Follow-Ups', 'Not Converted',
      'Cust. No Quote', 'Enq. No Quotation', 'Pending Approval', 'Appr. No Booking',
    ];

    return scoreboard.map((sp) => ({
      userName: sp.userName,
      data: sectionLabels.map((label, i) => ({
        x: label,
        y: sp[`s${i + 1}`] || 0,
      })),
    }));
  }

  // ─── WEEKLY TREND ────────────────────────────────────────────────────

  async getWeeklyTrend(query: SalesManagerQueryDto) {
    const { companyMasterSid, branchMasterSid, salespersonId } = this.normalizeParams(query);

    const rows: any[] = await this.db.$queryRawUnsafe(
      `WITH weeks AS (
        SELECT generate_series(
          date_trunc('week', CURRENT_DATE - INTERVAL '11 weeks'),
          date_trunc('week', CURRENT_DATE),
          '1 week'::interval
        ) AS week_start
      )
      SELECT
        w.week_start,
        (SELECT COUNT(*) FROM "PreCustomerMaster" pcm
          WHERE pcm."status" = 'A' AND pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
          AND ($3::int IS NULL OR pcm."leadAssignTo" = $3)
          AND pcm."createdOn" >= w.week_start AND pcm."createdOn" < w.week_start + INTERVAL '1 week'
        ) AS "newLeads",
        (SELECT COUNT(*) FROM "PreCustomerMeeting" pcmm
          WHERE pcmm."status" = 'A' AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
          AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
          AND pcmm."meetingDate" >= w.week_start AND pcmm."meetingDate" < w.week_start + INTERVAL '1 week'
        ) AS "meetings",
        (SELECT COUNT(*) FROM "CustomerMaster" cm
          INNER JOIN "PreCustomerMaster" pcm2 ON cm."PreCustomerMasterSid" = pcm2."PreCustomerMasterSid"
          WHERE cm."status" = 'A' AND cm."CompanyMasterSid" = $1
          AND ($2::int IS NULL OR pcm2."BranchMasterSid" = $2)
          AND ($3::int IS NULL OR pcm2."leadAssignTo" = $3)
          AND cm."createdOn" >= w.week_start AND cm."createdOn" < w.week_start + INTERVAL '1 week'
        ) AS "conversions"
      FROM weeks w
      ORDER BY w.week_start ASC`,
      companyMasterSid,
      branchMasterSid,
      salespersonId,
    );

    return rows.map((r) => ({
      weekStart: r.week_start,
      newLeads: Number(r.newLeads) || 0,
      meetings: Number(r.meetings) || 0,
      conversions: Number(r.conversions) || 0,
    }));
  }

  // ─── RESPONSE TIMES ──────────────────────────────────────────────────

  async getResponseTimes(query: SalesManagerQueryDto) {
    const { companyMasterSid, branchMasterSid } = this.normalizeParams(query);

    const rows: any[] = await this.db.$queryRawUnsafe(
      `WITH salespersons AS (
        SELECT um."UserMasterSid", um."userName", um."userEmail"
        FROM "UserMaster" um
        INNER JOIN "UserBranchMaster" ubm ON um."UserMasterSid" = ubm."UserMasterSid"
        WHERE ubm."CompanyMasterSid" = $1 AND ubm."BranchMasterSid" = $2
          AND um."isSalesperson" = '1' AND um."status" = 'A' AND ubm."status" = 'A'
      ),
      lead_to_meeting AS (
        SELECT
          pcmm."leadAssignTo" AS uid,
          AVG(EXTRACT(EPOCH FROM (pcmm."meetingDate" - pcm."createdOn")) / 86400) AS avg_days
        FROM "PreCustomerMeeting" pcmm
        INNER JOIN "PreCustomerMaster" pcm ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
        WHERE pcmm."status" = 'A' AND pcm."status" = 'A'
          AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
          AND pcmm."meetingDate" IS NOT NULL AND pcm."createdOn" IS NOT NULL
        GROUP BY pcmm."leadAssignTo"
      ),
      lead_to_customer AS (
        SELECT
          pcm."leadAssignTo" AS uid,
          AVG(EXTRACT(EPOCH FROM (cm."createdOn" - pcm."createdOn")) / 86400) AS avg_days
        FROM "CustomerMaster" cm
        INNER JOIN "PreCustomerMaster" pcm ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
        WHERE cm."status" = 'A' AND pcm."status" = 'A'
          AND cm."CompanyMasterSid" = $1
          AND cm."createdOn" IS NOT NULL AND pcm."createdOn" IS NOT NULL
        GROUP BY pcm."leadAssignTo"
      ),
      quote_to_approval AS (
        SELECT
          qh."SalesmanSid" AS uid,
          AVG(EXTRACT(EPOCH FROM (COALESCE(auth."AuthorisedDate", qc."updatedOn") - qh."QuoteDate")) / 86400) AS avg_days
        FROM "QuoteHeader" qh
        INNER JOIN "QuoteCarrier" qc ON qc."QuoteHeaderSid" = qh."QuoteHeaderSid"
        LEFT JOIN LATERAL (
          SELECT al."AuthorisedDate"
          FROM "AuthorityLog" al
          WHERE al."DocumentSid" = qh."QuoteHeaderSid"
            AND al."CompanyMasterSid" = qh."CompanyMasterSid"
            AND al."BranchMasterSid" = qh."BranchMasterSid"
            AND COALESCE(al."Status", 'A') = 'A'
            AND al."ApprovalStatus" = 'Approved'
          ORDER BY al."AuthorisedDate" DESC
          LIMIT 1
        ) auth ON true
        WHERE qh."status" = 'A' AND COALESCE(qc."status", 'A') = 'A'
          AND qh."CompanyMasterSid" = $1 AND qh."BranchMasterSid" = $2
          AND qc."ApprovalStatus"::text = 'Approved'
          AND COALESCE(auth."AuthorisedDate", qc."updatedOn") IS NOT NULL
          AND qh."QuoteDate" IS NOT NULL
        GROUP BY qh."SalesmanSid"
      )
      SELECT
        sp."UserMasterSid",
        sp."userName",
        ROUND(COALESCE(ltm.avg_days, 0)::numeric, 1) AS "avgLeadToMeeting",
        ROUND(COALESCE(ltc.avg_days, 0)::numeric, 1) AS "avgLeadToCustomer",
        ROUND(COALESCE(qta.avg_days, 0)::numeric, 1) AS "avgQuoteToApproval"
      FROM salespersons sp
      LEFT JOIN lead_to_meeting ltm ON ltm.uid = sp."UserMasterSid"
      LEFT JOIN lead_to_customer ltc ON ltc.uid = sp."UserMasterSid"
      LEFT JOIN quote_to_approval qta ON qta.uid = sp."UserMasterSid"
      ORDER BY sp."userName" ASC`,
      companyMasterSid,
      branchMasterSid,
    );

    return rows.map((r) => ({
      UserMasterSid: r.UserMasterSid,
      userName: r.userName,
      avgLeadToMeeting: Number(r.avgLeadToMeeting) || 0,
      avgLeadToCustomer: Number(r.avgLeadToCustomer) || 0,
      avgQuoteToApproval: Number(r.avgQuoteToApproval) || 0,
    }));
  }

  // ─── ACTIVITY FEED ───────────────────────────────────────────────────

  async getActivityFeed(query: SalesManagerQueryDto) {
    const { companyMasterSid, branchMasterSid } = this.normalizeParams(query);

    const rows: any[] = await this.db.$queryRawUnsafe(
      `(
        SELECT
          'meeting_completed' AS "activityType",
          pcmm."updatedOn" AS "activityDate",
          um."userName" AS "salesperson",
          COALESCE(pcm."preCustomerName", cm."CustomerName", 'Unknown') AS "entityName",
          pcmm."meetingType" AS "details"
        FROM "PreCustomerMeeting" pcmm
        LEFT JOIN "PreCustomerMaster" pcm ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
        LEFT JOIN "CustomerMaster" cm ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
        LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
        WHERE pcmm."meetingStatus" IN ('Completed', 'Confirmed')
          AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
          AND pcmm."updatedOn" IS NOT NULL
        ORDER BY pcmm."updatedOn" DESC
        LIMIT 10
      )
      UNION ALL
      (
        SELECT
          'quote_created' AS "activityType",
          qh."createdOn" AS "activityDate",
          um."userName" AS "salesperson",
          cm."CustomerName" AS "entityName",
          qh."QuoteNumber" AS "details"
        FROM "QuoteHeader" qh
        LEFT JOIN "CustomerMaster" cm ON qh."CustomerMasterSid" = cm."CustomerMasterSid"
        LEFT JOIN "UserMaster" um ON qh."SalesmanSid" = um."UserMasterSid"
        WHERE qh."status" = 'A'
          AND qh."CompanyMasterSid" = $1 AND qh."BranchMasterSid" = $2
          AND qh."createdOn" IS NOT NULL
        ORDER BY qh."createdOn" DESC
        LIMIT 10
      )
      UNION ALL
      (
        SELECT
          'booking_created' AS "activityType",
          bh."createdOn" AS "activityDate",
          um."userName" AS "salesperson",
          cm."CustomerName" AS "entityName",
          bh."BookingNo" AS "details"
        FROM "BookingHeader" bh
        LEFT JOIN "CustomerMaster" cm ON bh."CustomerMasterSid" = cm."CustomerMasterSid"
        LEFT JOIN "UserMaster" um ON bh."SalesmanSid" = um."UserMasterSid"
        WHERE bh."status" = 'A'
          AND bh."CompanyMasterSid" = $1 AND bh."BranchMasterSid" = $2
          AND bh."createdOn" IS NOT NULL
        ORDER BY bh."createdOn" DESC
        LIMIT 10
      )
      ORDER BY "activityDate" DESC
      LIMIT 20`,
      companyMasterSid,
      branchMasterSid,
    );

    return rows.map((r) => ({
      activityType: r.activityType,
      activityDate: r.activityDate,
      salesperson: r.salesperson,
      entityName: r.entityName,
      details: r.details,
    }));
  }

  // ─── ALERTS ──────────────────────────────────────────────────────────

  async getAlerts(query: SalesManagerQueryDto) {
    const { companyMasterSid, branchMasterSid } = this.normalizeParams(query);

    const [idleLeads, overdueMeetings, staleFollowups, unconvertedHighTouch] =
      await Promise.all([
        this.db.$queryRawUnsafe(
          `SELECT pcm."createdBy" AS "salespersonEmail", um."userName",
            COUNT(*) AS "total",
            COUNT(*) FILTER (WHERE pcm."createdOn" < NOW() - INTERVAL '14 days') AS "critical"
          FROM "PreCustomerMaster" pcm
          LEFT JOIN "UserMaster" um ON pcm."createdBy" = um."userEmail"
          WHERE pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
            AND pcm."status" = 'A'
            AND pcm."createdOn" < NOW() - INTERVAL '7 days'
            AND NOT EXISTS (
              SELECT 1 FROM "PreCustomerMeeting" m
              WHERE m."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND m."status" = 'A'
            )
          GROUP BY pcm."createdBy", um."userName"
          HAVING COUNT(*) > 0`,
          companyMasterSid,
          branchMasterSid,
        ),
        this.db.$queryRawUnsafe(
          `SELECT pcmm."leadAssignTo", um."userName", COUNT(*) AS "total"
          FROM "PreCustomerMeeting" pcmm
          LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
          WHERE pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
            AND pcmm."status" = 'A'
            AND pcmm."meetingDate"::date < CURRENT_DATE
            AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')
          GROUP BY pcmm."leadAssignTo", um."userName"
          HAVING COUNT(*) > 0
          ORDER BY COUNT(*) DESC`,
          companyMasterSid,
          branchMasterSid,
        ),
        this.db.$queryRawUnsafe(
          `SELECT pcmm."leadAssignTo", um."userName", COUNT(*) AS "total",
            MAX(CURRENT_DATE - pcmm."followUpDate"::date) AS "oldestDays"
          FROM "PreCustomerMeeting" pcmm
          LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
          WHERE pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
            AND pcmm."status" = 'A'
            AND pcmm."followUpDate" IS NOT NULL
            AND pcmm."followUpDate"::date < CURRENT_DATE
            AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')
          GROUP BY pcmm."leadAssignTo", um."userName"
          HAVING COUNT(*) > 0
          ORDER BY COUNT(*) DESC`,
          companyMasterSid,
          branchMasterSid,
        ),
        this.db.$queryRawUnsafe(
          `SELECT pcmm."leadAssignTo", um."userName",
            COUNT(DISTINCT pcm."PreCustomerMasterSid") AS "total",
            COUNT(DISTINCT pcm."PreCustomerMasterSid") FILTER (
              WHERE (SELECT COUNT(*) FROM "PreCustomerMeeting" pcmm5
                WHERE pcmm5."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
                AND pcmm5."meetingStatus" IN ('Completed', 'Confirmed')) >= 3
            ) AS "highTouch"
          FROM "PreCustomerMaster" pcm
          INNER JOIN "PreCustomerMeeting" pcmm ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
          LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
          WHERE pcm."status" = 'A' AND pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
            AND EXISTS (
              SELECT 1 FROM "PreCustomerMeeting" pcmm3
              WHERE pcmm3."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
              AND pcmm3."meetingStatus" IN ('Completed', 'Confirmed')
            )
            AND NOT EXISTS (
              SELECT 1 FROM "CustomerMaster" cm
              WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND cm."status" = 'A'
            )
          GROUP BY pcmm."leadAssignTo", um."userName"
          HAVING COUNT(DISTINCT pcm."PreCustomerMasterSid") > 0`,
          companyMasterSid,
          branchMasterSid,
        ),
      ]);

    const alerts: any[] = [];

    for (const r of idleLeads as any[]) {
      const severity = Number(r.critical) > 0 ? 'danger' : 'warning';
      alerts.push({
        alertType: 'idle_leads',
        severity,
        salesperson: r.userName || r.salespersonEmail,
        count: Number(r.total),
        description: `${Number(r.total)} leads with no meeting${Number(r.critical) > 0 ? ` (${Number(r.critical)} aging >14 days)` : ''}`,
      });
    }

    const totalOverdue = (overdueMeetings as any[]).reduce((sum, r) => sum + Number(r.total), 0);
    if (totalOverdue > 0) {
      const breakdown = (overdueMeetings as any[])
        .slice(0, 3)
        .map((r) => `${r.userName} (${Number(r.total)})`)
        .join(', ');
      alerts.push({
        alertType: 'overdue_meetings',
        severity: 'danger',
        salesperson: 'Team',
        count: totalOverdue,
        description: `${totalOverdue} overdue meetings across ${(overdueMeetings as any[]).length} reps — ${breakdown}`,
      });
    }

    for (const r of staleFollowups as any[]) {
      alerts.push({
        alertType: 'stale_followups',
        severity: 'warning',
        salesperson: r.userName,
        count: Number(r.total),
        description: `${Number(r.total)} stale follow-ups (oldest: ${Number(r.oldestDays)} days)`,
      });
    }

    for (const r of unconvertedHighTouch as any[]) {
      if (Number(r.highTouch) > 0) {
        alerts.push({
          alertType: 'unconverted_hightouch',
          severity: 'warning',
          salesperson: r.userName,
          count: Number(r.total),
          description: `${Number(r.total)} leads met but not converted (${Number(r.highTouch)} with 3+ meetings each)`,
        });
      }
    }

    alerts.sort((a, b) => {
      const sev = { danger: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2) || b.count - a.count;
    });

    return alerts;
  }

  // ─── AGING ANALYSIS ──────────────────────────────────────────────────

  async getAgingAnalysis(query: SalesManagerQueryDto) {
    const { companyMasterSid, branchMasterSid } = this.normalizeParams(query);

    const rows: any[] = await this.db.$queryRawUnsafe(
      `WITH salespersons AS (
        SELECT um."UserMasterSid", um."userName", um."userEmail"
        FROM "UserMaster" um
        INNER JOIN "UserBranchMaster" ubm ON um."UserMasterSid" = ubm."UserMasterSid"
        WHERE ubm."CompanyMasterSid" = $1 AND ubm."BranchMasterSid" = $2
          AND um."isSalesperson" = '1' AND um."status" = 'A' AND ubm."status" = 'A'
      )
      SELECT
        sp."userName",
        COUNT(*) FILTER (WHERE CURRENT_DATE - pcm."createdOn"::date BETWEEN 0 AND 7) AS "days0to7",
        COUNT(*) FILTER (WHERE CURRENT_DATE - pcm."createdOn"::date BETWEEN 8 AND 30) AS "days8to30",
        COUNT(*) FILTER (WHERE CURRENT_DATE - pcm."createdOn"::date BETWEEN 31 AND 60) AS "days31to60",
        COUNT(*) FILTER (WHERE CURRENT_DATE - pcm."createdOn"::date > 60) AS "days60plus"
      FROM salespersons sp
      LEFT JOIN "PreCustomerMaster" pcm
        ON pcm."createdBy" = sp."userEmail"
        AND pcm."status" = 'A'
        AND pcm."CompanyMasterSid" = $1
        AND pcm."BranchMasterSid" = $2
        AND NOT EXISTS (
          SELECT 1 FROM "CustomerMaster" cm
          WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND cm."status" = 'A'
        )
      GROUP BY sp."userName"
      ORDER BY sp."userName" ASC`,
      companyMasterSid,
      branchMasterSid,
    );

    return rows.map((r) => ({
      userName: r.userName,
      days0to7: Number(r.days0to7) || 0,
      days8to30: Number(r.days8to30) || 0,
      days31to60: Number(r.days31to60) || 0,
      days60plus: Number(r.days60plus) || 0,
    }));
  }

  // ─── MEETINGS BOARD ──────────────────────────────────────────────────

  async getMeetingsBoard(query: SalesManagerQueryDto) {
    const params = this.normalizeParams(query);
    const [overdue, today, upcoming] = await Promise.all([
      this.getMeetingsScheduledBucket(params, 'overdue'),
      this.getMeetingsScheduledBucket(params, 'today'),
      this.getMeetingsScheduledBucket(params, 'future'),
    ]);
    return { overdue, today, upcoming };
  }

  // ─── ACTION: REASSIGN LEAD ───────────────────────────────────────────

  async reassignLead(dto: ReassignLeadDto) {
    return this.db.preCustomerMeeting.update({
      where: { PreCustomerMeetingSid: dto.PreCustomerMeetingSid },
      data: {
        leadAssignTo: dto.newSalespersonId,
        updatedBy: dto.updatedBy,
        updatedOn: new Date(),
      },
    });
  }

  // ─── ACTION: BULK REASSIGN ───────────────────────────────────────────

  async bulkReassign(dto: BulkReassignDto) {
    return this.db.$transaction(
      dto.PreCustomerMeetingSids.map((sid) =>
        this.db.preCustomerMeeting.update({
          where: { PreCustomerMeetingSid: sid },
          data: {
            leadAssignTo: dto.newSalespersonId,
            updatedBy: dto.updatedBy,
            updatedOn: new Date(),
          },
        }),
      ),
    );
  }

  // ─── ACTION: CREATE MEETING ON BEHALF ────────────────────────────────

  async createMeetingOnBehalf(dto: CreateMeetingOnBehalfDto) {
    return this.db.preCustomerMeeting.create({
      data: {
        PreCustomerMasterSid: dto.PreCustomerMasterSid,
        leadAssignTo: dto.leadAssignTo,
        meetingDate: new Date(dto.meetingDate),
        meetingType: dto.meetingType,
        meetingNote: dto.meetingNote || null,
        meetingStatus: 'Scheduled',
        LeadOrCustomer: 'L',
        CompanyMasterSid: dto.CompanyMasterSid,
        BranchMasterSid: dto.BranchMasterSid,
        createdBy: dto.createdBy,
        createdOn: new Date(),
        status: 'A',
      },
      include: {
        preCustomerMaster: true,
      },
    });
  }

  // ─── ACTION: SEND REMINDER ───────────────────────────────────────────

  async sendReminder(dto: SendReminderDto) {
    const user = await this.db.userMaster.findUnique({
      where: { UserMasterSid: dto.salespersonId },
      select: { userName: true, userEmail: true },
    });

    if (!user?.userEmail) {
      throw new Error('Salesperson email not found');
    }

    const subjectMap = {
      'overdue-meetings': 'Reminder: You have overdue meetings',
      'idle-leads': 'Reminder: Leads awaiting your attention',
      'pending-followups': 'Reminder: Follow-ups pending action',
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #044a6c; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Sales Activity Reminder</h2>
        </div>
        <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${user.userName},</p>
          <p>This is a reminder from your sales manager <strong>${dto.senderName}</strong> regarding your <strong>${dto.reminderType.replace(/-/g, ' ')}</strong>.</p>
          ${dto.customMessage ? `<div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #044a6c;"><p style="margin: 0;">${dto.customMessage}</p></div>` : ''}
          <p>Please log in to the CRM dashboard to review and take action.</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px;">This is an automated message from the Sales Manager Dashboard.</p>
        </div>
      </div>`;

    await this.emailService.sendEmail({
      email: user.userEmail,
      subject: subjectMap[dto.reminderType],
      html,
    });

    return { sent: true, to: user.userEmail };
  }

  // ─── PRIVATE: Section data queries ───────────────────────────────────

  private async getLeadsNoMeetingPage(params: NormalizedParams): Promise<PagedResult<any>> {
    const baseParams: any[] = [
      params.companyMasterSid,
      params.branchMasterSid,
      params.dateFrom,
      params.dateTo,
      params.salespersonEmail,
    ];
    const search = this.buildSearchClause(params.search, [
      `pcm."preCustomerName"`, `pcm."contactPerson"`, `pcm."phone"`, `pcm."email"`, `um."userName"`,
    ], baseParams.length + 1);

    const dataSql = `
      SELECT pcm."PreCustomerMasterSid", pcm."preCustomerName", pcm."contactPerson",
        pcm."phone", pcm."email", pcm."leadStatus", pcm."leadReferredBy" AS "leadFrom",
        pcm."customerType", pcm."leadAssignTo", pcm."createdOn", pcm."createdBy",
        um."userName" AS "salespersonName"
      FROM "PreCustomerMaster" pcm
      LEFT JOIN "PreCustomerMeeting" pcmm ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE pcmm."PreCustomerMeetingSid" IS NULL AND pcm."status" = 'A'
        AND pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
        AND ($3::timestamptz IS NULL OR pcm."createdOn" >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR pcm."createdOn" <= $4::timestamptz)
        AND ($5::text IS NULL OR pcm."createdBy" = $5)
        ${search.clause}
      ORDER BY pcm."createdOn" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "PreCustomerMaster" pcm
      LEFT JOIN "PreCustomerMeeting" pcmm ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE pcmm."PreCustomerMeetingSid" IS NULL AND pcm."status" = 'A'
        AND pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
        AND ($3::timestamptz IS NULL OR pcm."createdOn" >= $3::timestamptz)
        AND ($4::timestamptz IS NULL OR pcm."createdOn" <= $4::timestamptz)
        AND ($5::text IS NULL OR pcm."createdBy" = $5)
        ${search.clause}`;

    return this.executePagedQuery(dataSql, countSql, [...baseParams, ...search.params], [...baseParams, ...search.params], params.page, params.pageSize);
  }

  private getMeetingBucketClause(bucket: 'overdue' | 'today' | 'future') {
    if (bucket === 'overdue') return `pcmm."meetingDate"::date < CURRENT_DATE`;
    if (bucket === 'today') return `pcmm."meetingDate"::date = CURRENT_DATE`;
    return `pcmm."meetingDate"::date > CURRENT_DATE`;
  }

  private async getMeetingsScheduledBucket(params: NormalizedParams, bucket: 'overdue' | 'today' | 'future'): Promise<PagedResult<any>> {
    const baseParams: any[] = [params.companyMasterSid, params.branchMasterSid, params.salespersonId];
    const search = this.buildSearchClause(params.search, [
      `pcm."preCustomerName"`, `cm."CustomerName"`, `pcmm."meetingType"`, `um."userName"`,
    ], baseParams.length + 1);
    const bucketClause = this.getMeetingBucketClause(bucket);
    const orderDir = bucket === 'overdue' ? 'DESC' : 'ASC';

    const dataSql = `
      SELECT pcmm."PreCustomerMeetingSid", pcmm."meetingDate", pcmm."meetingType",
        pcmm."meetingStatus", pcmm."meetingNote", pcmm."leadAssignTo", pcmm."LeadOrCustomer",
        CASE WHEN pcmm."LeadOrCustomer" = 'L' THEN pcm."preCustomerName" ELSE cm."CustomerName" END AS "name",
        pcm."PreCustomerMasterSid", cm."CustomerMasterSid",
        um."userName" AS "salespersonName"
      FROM "PreCustomerMeeting" pcmm
      LEFT JOIN "PreCustomerMaster" pcm ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE pcmm."status" = 'A' AND pcmm."meetingDate" IS NOT NULL
        AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        AND ${bucketClause}
        ${search.clause}
      ORDER BY pcmm."meetingDate" ${orderDir}`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "PreCustomerMeeting" pcmm
      LEFT JOIN "PreCustomerMaster" pcm ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE pcmm."status" = 'A' AND pcmm."meetingDate" IS NOT NULL
        AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        AND ${bucketClause}
        ${search.clause}`;

    return this.executePagedQuery(dataSql, countSql, [...baseParams, ...search.params], [...baseParams, ...search.params], params.page, params.pageSize);
  }

  private async getMeetingsScheduledAll(params: NormalizedParams) {
    const [overdue, today, future] = await Promise.all([
      this.getMeetingsScheduledBucket(params, 'overdue'),
      this.getMeetingsScheduledBucket(params, 'today'),
      this.getMeetingsScheduledBucket(params, 'future'),
    ]);
    return { overdue, today, future };
  }

  private async getFollowUpsPendingPage(params: NormalizedParams): Promise<PagedResult<any>> {
    const baseParams: any[] = [
      params.companyMasterSid, params.branchMasterSid, params.salespersonId,
      params.naiveDateFrom, params.naiveDateTo,
    ];
    const search = this.buildSearchClause(params.search, [
      `pcm."preCustomerName"`, `cm."CustomerName"`, `pcmm."meetingType"`, `um."userName"`,
    ], baseParams.length + 1);

    const dataSql = `
      SELECT pcmm."PreCustomerMeetingSid", pcmm."meetingDate", pcmm."meetingType",
        pcmm."meetingStatus", pcmm."followUpDate", pcmm."followUpNote", pcmm."leadAssignTo",
        pcm."PreCustomerMasterSid", pcm."preCustomerName", pcm."contactPerson",
        cm."CustomerMasterSid", cm."CustomerName",
        um."userName" AS "salespersonName",
        CASE WHEN pcmm."followUpDate" < CURRENT_DATE THEN 'Overdue'
          WHEN pcmm."followUpDate" = CURRENT_DATE THEN 'Due Today'
          ELSE 'Upcoming' END AS "followUpStatus"
      FROM "PreCustomerMeeting" pcmm
      LEFT JOIN "PreCustomerMaster" pcm ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE pcmm."followUpDate" IS NOT NULL AND pcmm."status" = 'A'
        AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        AND ($4::timestamp IS NULL OR pcmm."followUpDate" >= $4::timestamp)
        AND ($5::timestamp IS NULL OR pcmm."followUpDate" <= $5::timestamp)
        AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')
        ${search.clause}
      ORDER BY pcmm."followUpDate" ASC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "PreCustomerMeeting" pcmm
      LEFT JOIN "PreCustomerMaster" pcm ON pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "CustomerMaster" cm ON pcmm."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE pcmm."followUpDate" IS NOT NULL AND pcmm."status" = 'A'
        AND pcmm."CompanyMasterSid" = $1 AND pcmm."BranchMasterSid" = $2
        AND ($3::int IS NULL OR pcmm."leadAssignTo" = $3)
        AND ($4::timestamp IS NULL OR pcmm."followUpDate" >= $4::timestamp)
        AND ($5::timestamp IS NULL OR pcmm."followUpDate" <= $5::timestamp)
        AND pcmm."meetingStatus" NOT IN ('Completed', 'Confirmed')
        ${search.clause}`;

    return this.executePagedQuery(dataSql, countSql, [...baseParams, ...search.params], [...baseParams, ...search.params], params.page, params.pageSize);
  }

  private async getMeetingsNotConvertedPage(params: NormalizedParams): Promise<PagedResult<any>> {
    const baseParams: any[] = [
      params.companyMasterSid, params.branchMasterSid, params.salespersonId,
      params.naiveDateFrom, params.naiveDateTo, params.salespersonEmail,
    ];
    const search = this.buildSearchClause(params.search, [
      `pcm."preCustomerName"`, `pcm."contactPerson"`, `pcm."phone"`, `pcm."email"`,
    ], baseParams.length + 1);

    const dataSql = `
      SELECT pcm."PreCustomerMasterSid", pcm."preCustomerName", pcm."contactPerson",
        pcm."phone", pcm."email", pcm."leadStatus", pcm."createdBy" AS "leadCreatedBy",
        pcm."createdOn" AS "leadCreatedOn",
        COUNT(pcmm."PreCustomerMeetingSid") AS "meetingCount",
        MAX(pcmm."meetingDate") AS "lastMeetingDate",
        um."userName" AS "salespersonName"
      FROM "PreCustomerMaster" pcm
      INNER JOIN "PreCustomerMeeting" pcmm ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcmm."leadAssignTo" = um."UserMasterSid"
      WHERE pcm."status" = 'A' AND pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
        AND EXISTS (
          SELECT 1 FROM "PreCustomerMeeting" pcmm3
          WHERE pcmm3."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
          AND pcmm3."meetingStatus" IN ('Completed', 'Confirmed')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "CustomerMaster" cm
          WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND cm."status" = 'A'
        )
        AND (
          ($3::int IS NULL AND $6::text IS NULL)
          OR pcm."createdBy" = $6
          OR EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm4
            WHERE pcmm4."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND pcmm4."leadAssignTo" = $3
          )
        )
        AND ($4::timestamp IS NULL OR pcmm."meetingDate" >= $4::timestamp)
        AND ($5::timestamp IS NULL OR pcmm."meetingDate" <= $5::timestamp)
        ${search.clause}
      GROUP BY pcm."PreCustomerMasterSid", pcm."preCustomerName", pcm."contactPerson",
        pcm."phone", pcm."email", pcm."leadStatus", pcm."createdBy", pcm."createdOn", um."userName"
      ORDER BY MAX(pcmm."meetingDate") DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count" FROM (
        SELECT pcm."PreCustomerMasterSid"
        FROM "PreCustomerMaster" pcm
        INNER JOIN "PreCustomerMeeting" pcmm ON pcm."PreCustomerMasterSid" = pcmm."PreCustomerMasterSid"
        WHERE pcm."status" = 'A' AND pcm."CompanyMasterSid" = $1 AND pcm."BranchMasterSid" = $2
          AND EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm3
            WHERE pcmm3."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
            AND pcmm3."meetingStatus" IN ('Completed', 'Confirmed')
          )
          AND NOT EXISTS (
            SELECT 1 FROM "CustomerMaster" cm
            WHERE cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND cm."status" = 'A'
          )
          AND (
            ($3::int IS NULL AND $6::text IS NULL)
            OR pcm."createdBy" = $6
            OR EXISTS (
              SELECT 1 FROM "PreCustomerMeeting" pcmm4
              WHERE pcmm4."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND pcmm4."leadAssignTo" = $3
            )
          )
          AND ($4::timestamp IS NULL OR pcmm."meetingDate" >= $4::timestamp)
          AND ($5::timestamp IS NULL OR pcmm."meetingDate" <= $5::timestamp)
          ${search.clause}
        GROUP BY pcm."PreCustomerMasterSid"
      ) t`;

    return this.executePagedQuery(dataSql, countSql, [...baseParams, ...search.params], [...baseParams, ...search.params], params.page, params.pageSize,
      (row) => ({ ...row, meetingCount: Number(row.meetingCount) }));
  }

  private async getCustomersNoQuotePage(params: NormalizedParams): Promise<PagedResult<any>> {
    const baseParams: any[] = [
      params.companyMasterSid, params.branchMasterSid, params.salespersonId,
      params.dateFrom, params.dateTo, params.salespersonEmail,
    ];
    const search = this.buildSearchClause(params.search, [
      `cm."CustomerName"`, `pcm."preCustomerName"`, `pcm."contactPerson"`,
    ], baseParams.length + 1);

    const dataSql = `
      SELECT cm."CustomerMasterSid", cm."CustomerName", cm."CustomerAddress1",
        cm."PreCustomerMasterSid", cm."createdOn" AS "customerCreatedOn",
        pcm."preCustomerName", pcm."contactPerson", pcm."phone", pcm."email",
        pcm."createdBy" AS "leadCreatedBy",
        um."userName" AS "salespersonName"
      FROM "CustomerMaster" cm
      INNER JOIN "PreCustomerMaster" pcm ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE cm."status" = 'A' AND cm."CompanyMasterSid" = $1
        AND ($2::int IS NULL OR pcm."BranchMasterSid" = $2)
        AND NOT EXISTS (SELECT 1 FROM "QuoteHeader" qh WHERE qh."CustomerMasterSid" = cm."CustomerMasterSid")
        AND NOT EXISTS (SELECT 1 FROM "BookingHeader" bh WHERE bh."CustomerMasterSid" = cm."CustomerMasterSid")
        AND (
          ($3::int IS NULL AND $6::text IS NULL)
          OR pcm."createdBy" = $6
          OR EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm
            WHERE pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND pcmm."leadAssignTo" = $3
          )
        )
        AND ($4::timestamptz IS NULL OR cm."createdOn" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR cm."createdOn" <= $5::timestamptz)
        ${search.clause}
      ORDER BY cm."createdOn" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "CustomerMaster" cm
      INNER JOIN "PreCustomerMaster" pcm ON cm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid"
      LEFT JOIN "UserMaster" um ON pcm."leadAssignTo" = um."UserMasterSid"
      WHERE cm."status" = 'A' AND cm."CompanyMasterSid" = $1
        AND ($2::int IS NULL OR pcm."BranchMasterSid" = $2)
        AND NOT EXISTS (SELECT 1 FROM "QuoteHeader" qh WHERE qh."CustomerMasterSid" = cm."CustomerMasterSid")
        AND NOT EXISTS (SELECT 1 FROM "BookingHeader" bh WHERE bh."CustomerMasterSid" = cm."CustomerMasterSid")
        AND (
          ($3::int IS NULL AND $6::text IS NULL)
          OR pcm."createdBy" = $6
          OR EXISTS (
            SELECT 1 FROM "PreCustomerMeeting" pcmm
            WHERE pcmm."PreCustomerMasterSid" = pcm."PreCustomerMasterSid" AND pcmm."leadAssignTo" = $3
          )
        )
        AND ($4::timestamptz IS NULL OR cm."createdOn" >= $4::timestamptz)
        AND ($5::timestamptz IS NULL OR cm."createdOn" <= $5::timestamptz)
        ${search.clause}`;

    return this.executePagedQuery(dataSql, countSql, [...baseParams, ...search.params], [...baseParams, ...search.params], params.page, params.pageSize);
  }

  private async getEnquiriesNoQuotationPage(params: NormalizedParams): Promise<PagedResult<any>> {
    const baseParams: any[] = [
      params.companyMasterSid, params.branchMasterSid, params.salespersonId,
      params.dateFrom, params.dateTo,
    ];
    const search = this.buildSearchClause(params.search, [
      `eh."EnquiryNumber"`, `cm."CustomerName"`, `um."userName"`,
    ], baseParams.length + 1);

    const dataSql = `
      SELECT eh."EnquiryHeaderSid", eh."EnquiryNumber", eh."EnquiryDate",
        eh."CustomerMasterSid", cm."CustomerName",
        eh."UserMasterSid", um."userName" AS "salespersonName",
        eh."createdOn"
      FROM "EnquiryHeader" eh
      LEFT JOIN "CustomerMaster" cm ON eh."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON eh."UserMasterSid" = um."UserMasterSid"
      WHERE COALESCE(eh."status", 'A') = 'A'
        AND eh."CompanyMasterSid" = $1 AND eh."BranchMasterSid" = $2
        AND eh."QuoteHeaderSid" IS NULL
        AND ($3::int IS NULL OR eh."UserMasterSid" = $3)
        AND ($4::date IS NULL OR eh."EnquiryDate" >= $4::date)
        AND ($5::date IS NULL OR eh."EnquiryDate" <= $5::date)
        ${search.clause}
      ORDER BY eh."EnquiryDate" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "EnquiryHeader" eh
      LEFT JOIN "CustomerMaster" cm ON eh."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON eh."UserMasterSid" = um."UserMasterSid"
      WHERE COALESCE(eh."status", 'A') = 'A'
        AND eh."CompanyMasterSid" = $1 AND eh."BranchMasterSid" = $2
        AND eh."QuoteHeaderSid" IS NULL
        AND ($3::int IS NULL OR eh."UserMasterSid" = $3)
        AND ($4::date IS NULL OR eh."EnquiryDate" >= $4::date)
        AND ($5::date IS NULL OR eh."EnquiryDate" <= $5::date)
        ${search.clause}`;

    return this.executePagedQuery(dataSql, countSql, [...baseParams, ...search.params], [...baseParams, ...search.params], params.page, params.pageSize);
  }

  private async getQuotesPendingApprovalPage(params: NormalizedParams): Promise<PagedResult<any>> {
    const baseParams: any[] = [
      params.companyMasterSid, params.branchMasterSid, params.salespersonId,
      params.dateFrom, params.dateTo,
    ];
    const search = this.buildSearchClause(params.search, [
      `qh."QuoteNumber"`, `cm."CustomerName"`, `um."userName"`,
    ], baseParams.length + 1);

    const dataSql = `
      SELECT qh."QuoteHeaderSid", qh."QuoteNumber", qh."QuoteDate",
        qh."CustomerMasterSid", cm."CustomerName",
        qh."SalesmanSid", um."userName" AS "salespersonName",
        qh."createdOn"
      FROM "QuoteHeader" qh
      LEFT JOIN "CustomerMaster" cm ON qh."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON qh."SalesmanSid" = um."UserMasterSid"
      WHERE qh."status" = 'A' AND qh."CompanyMasterSid" = $1 AND qh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
        AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
        AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
        AND EXISTS (
          SELECT 1 FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        )
        AND EXISTS (
          SELECT 1 FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
          AND COALESCE(qc."ApprovalStatus"::text, '') <> 'Rejected'
        )
        ${search.clause}
      ORDER BY qh."QuoteDate" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "QuoteHeader" qh
      LEFT JOIN "CustomerMaster" cm ON qh."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON qh."SalesmanSid" = um."UserMasterSid"
      WHERE qh."status" = 'A' AND qh."CompanyMasterSid" = $1 AND qh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
        AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
        AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
        AND EXISTS (
          SELECT 1 FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        )
        AND EXISTS (
          SELECT 1 FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
          AND COALESCE(qc."ApprovalStatus"::text, '') <> 'Rejected'
        )
        ${search.clause}`;

    return this.executePagedQuery(dataSql, countSql, [...baseParams, ...search.params], [...baseParams, ...search.params], params.page, params.pageSize);
  }

  private async getQuotesNoBookingPage(params: NormalizedParams): Promise<PagedResult<any>> {
    const baseParams: any[] = [
      params.companyMasterSid, params.branchMasterSid, params.salespersonId,
      params.dateFrom, params.dateTo,
    ];
    const search = this.buildSearchClause(params.search, [
      `qh."QuoteNumber"`, `cm."CustomerName"`, `um."userName"`,
    ], baseParams.length + 1);

    const dataSql = `
      SELECT qh."QuoteHeaderSid", qh."QuoteNumber", qh."QuoteDate",
        qh."CustomerMasterSid", cm."CustomerName",
        qh."SalesmanSid", um."userName" AS "salespersonName",
        qh."createdOn"
      FROM "QuoteHeader" qh
      LEFT JOIN "CustomerMaster" cm ON qh."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON qh."SalesmanSid" = um."UserMasterSid"
      WHERE qh."status" = 'A' AND qh."BookingHeaderSid" IS NULL
        AND qh."CompanyMasterSid" = $1 AND qh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
        AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
        AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
        AND EXISTS (
          SELECT 1 FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "BookingHeader" bh
          WHERE bh."QuotationHeaderSid" = qh."QuoteHeaderSid" AND bh."status" = 'A'
        )
        ${search.clause}
      ORDER BY qh."QuoteDate" DESC`;

    const countSql = `
      SELECT COUNT(*) AS "count"
      FROM "QuoteHeader" qh
      LEFT JOIN "CustomerMaster" cm ON qh."CustomerMasterSid" = cm."CustomerMasterSid"
      LEFT JOIN "UserMaster" um ON qh."SalesmanSid" = um."UserMasterSid"
      WHERE qh."status" = 'A' AND qh."BookingHeaderSid" IS NULL
        AND qh."CompanyMasterSid" = $1 AND qh."BranchMasterSid" = $2
        AND ($3::int IS NULL OR qh."SalesmanSid" = $3)
        AND ($4::date IS NULL OR qh."QuoteDate" >= $4::date)
        AND ($5::date IS NULL OR qh."QuoteDate" <= $5::date)
        AND EXISTS (
          SELECT 1 FROM "QuoteCarrier" qc
          WHERE qc."QuoteHeaderSid" = qh."QuoteHeaderSid" AND COALESCE(qc."status", 'A') = 'A'
          AND qc."ApprovalStatus"::text = 'Approved'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "BookingHeader" bh
          WHERE bh."QuotationHeaderSid" = qh."QuoteHeaderSid" AND bh."status" = 'A'
        )
        ${search.clause}`;

    return this.executePagedQuery(dataSql, countSql, [...baseParams, ...search.params], [...baseParams, ...search.params], params.page, params.pageSize);
  }

  // ─── UTILITY ─────────────────────────────────────────────────────────

  private normalizeParams(query: SalesManagerQueryDto): NormalizedParams {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || this.defaultPageSize;

    const {
      compareDateFrom,
      compareDateTo,
      compareNaiveDateFrom,
      compareNaiveDateTo
    } = this.buildCompareRanges(
      query.dateFrom ? query.dateFrom : null,
      query.dateTo ? query.dateTo : null,
      query.naiveDateFrom ? query.naiveDateFrom : null,
      query.naiveDateTo ? query.naiveDateTo : null,
      query.preset
    );

    return {
      companyMasterSid: Number(query.companyMasterSid),
      branchMasterSid: Number(query.branchMasterSid),
      salespersonId: query.salespersonId ? Number(query.salespersonId) : null,
      salespersonEmail: query.salespersonEmail || null,
      dateFrom: query.dateFrom || null,
      dateTo: query.dateTo || null,
      compareDateFrom: compareDateFrom || null,
      compareDateTo: compareDateTo || null,
      naiveDateFrom: query.naiveDateFrom || null,
      naiveDateTo: query.naiveDateTo || null,
      compareNaiveDateFrom: compareNaiveDateFrom || null,
      compareNaiveDateTo: compareNaiveDateTo || null,
      page: page > 0 ? page : 1,
      pageSize: Math.min(Math.max(pageSize, 1), this.maxPageSize),
      search: query.search?.trim() || null,
      bucket: query.bucket || null,
    };
  }

  private buildCompareRanges(
    dateFrom: string | null,
    dateTo: string | null,
    naiveFrom: string | null,
    naiveTo: string | null,
    preset?: string
  ) {
    if (!dateFrom || !dateTo) {
      return {
        compareDateFrom: null,
        compareDateTo: null,
        compareNaiveDateFrom: null,
        compareNaiveDateTo: null,
      };
    }

    const dFrom = new Date(dateFrom);
    const dTo = new Date(dateTo);

    const nFrom = naiveFrom ? new Date(naiveFrom) : null;
    const nTo = naiveTo ? new Date(naiveTo) : null;

    const isUtcStartOfDay = (date: Date) =>
      date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0 &&
      date.getUTCMilliseconds() === 0;

    const isUtcEndOfDay = (date: Date) =>
      date.getUTCHours() === 23 &&
      date.getUTCMinutes() === 59 &&
      date.getUTCSeconds() === 59 &&
      date.getUTCMilliseconds() === 0;

    const snapUtcStartOfDay = (date: Date) => {
      const value = new Date(date);
      value.setUTCHours(0, 0, 0, 0);
      return value;
    };

    const snapUtcEndOfDay = (date: Date) => {
      const value = new Date(date);
      value.setUTCHours(23, 59, 59, 0);
      return value;
    };

    const startOfUtcDay = (year: number, month: number, day: number) =>
      new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

    const endOfUtcDay = (year: number, month: number, day: number) =>
      new Date(Date.UTC(year, month, day, 23, 59, 59, 0));

    const shiftRange = (from: Date, to: Date) => {
      const diff = to.getTime() - from.getTime();
      let shiftedFrom = new Date(from.getTime() - diff - 86400000);
      let shiftedTo = new Date(to.getTime() - diff - 86400000);

      // Keep full-day filters aligned to full-day boundaries after shifting.
      if (isUtcStartOfDay(from)) {
        shiftedFrom = snapUtcStartOfDay(shiftedFrom);
      }

      if (isUtcEndOfDay(to)) {
        shiftedTo = snapUtcEndOfDay(shiftedTo);
      }

      return {
        from: shiftedFrom,
        to: shiftedTo,
      };
    };

    let compareDate, compareNaive;

    switch (preset) {

      case 'today': {
        const prevFrom = new Date(dFrom);
        const prevTo = new Date(dTo);

        prevFrom.setDate(prevFrom.getDate() - 1);
        prevTo.setDate(prevTo.getDate() - 1);

        compareDate = { from: prevFrom, to: prevTo };

        if (nFrom && nTo) {
          compareNaive = {
            from: startOfUtcDay(
              nFrom.getUTCFullYear(),
              nFrom.getUTCMonth(),
              nFrom.getUTCDate() - 1,
            ),
            to: endOfUtcDay(
              nTo.getUTCFullYear(),
              nTo.getUTCMonth(),
              nTo.getUTCDate() - 1,
            ),
          };
        } else {
          compareNaive = compareDate;
        }

        break;
      }

      case 'month': {
        compareDate = {
          from: new Date(dFrom.getFullYear(), dFrom.getMonth() - 1, 1),
          to: new Date(dFrom.getFullYear(), dFrom.getMonth(), 0),
        };

        if (nFrom) {
          compareNaive = {
            from: startOfUtcDay(
              nFrom.getUTCFullYear(),
              nFrom.getUTCMonth() - 1,
              1,
            ),
            to: endOfUtcDay(
              nFrom.getUTCFullYear(),
              nFrom.getUTCMonth(),
              0,
            ),
          };
        } else {
          compareNaive = compareDate;
        }

        break;
      }

      case 'lastMonth': {
        compareDate = {
          from: new Date(dFrom.getFullYear(), dFrom.getMonth() - 2, 1),
          to: new Date(dFrom.getFullYear(), dFrom.getMonth() - 1, 0),
        };

        compareNaive = nFrom
          ? {
              from: startOfUtcDay(
                nFrom.getUTCFullYear(),
                nFrom.getUTCMonth() - 2,
                1,
              ),
              to: endOfUtcDay(
                nFrom.getUTCFullYear(),
                nFrom.getUTCMonth() - 1,
                0,
              ),
            }
          : compareDate;
        break;
      }

      case 'fy': {
        compareDate = {
          from: new Date(dFrom.getFullYear() - 1, dFrom.getMonth(), dFrom.getDate()),
          to: new Date(dTo.getFullYear() - 1, dTo.getMonth(), dTo.getDate()),
        };

        compareNaive = nFrom && nTo
          ? {
              from: startOfUtcDay(
                nFrom.getUTCFullYear() - 1,
                nFrom.getUTCMonth(),
                nFrom.getUTCDate(),
              ),
              to: endOfUtcDay(
                nTo.getUTCFullYear() - 1,
                nTo.getUTCMonth(),
                nTo.getUTCDate(),
              ),
            }
          : compareDate;
        break;
      }

      default: {
        compareDate = shiftRange(dFrom, dTo);

        compareNaive = (nFrom && nTo)
          ? shiftRange(nFrom, nTo)
          : compareDate;
      }
    }

    return {
      compareDateFrom: compareDate.from,
      compareDateTo: compareDate.to,
      compareNaiveDateFrom: compareNaive.from,
      compareNaiveDateTo: compareNaive.to,
    };
  }

  private buildKpiMetric(current: number, previous: number) {
    let percent = 0;

    if (previous === 0) {
      percent = current > 0 ? 100 : 0;
    } else {
      percent = ((current - previous) / previous) * 100;
    }

    return {
      current,
      previous,
      percent: Number(percent.toFixed(1)),
      direction: current >= previous ? 'up' : 'down',
    };
  }

  private buildSearchClause(search: string | null, columns: string[], startIndex: number) {
    if (!search) return { clause: '', params: [] as any[] };
    const predicate = columns.map((col) => `COALESCE(${col}::text, '') ILIKE $${startIndex}`).join(' OR ');
    return { clause: ` AND (${predicate})`, params: [`%${search}%`] };
  }

  private toPagedResult<T>(rows: T[], page: number, pageSize: number, totalCount: number): PagedResult<T> {
    return { items: rows, page, pageSize, totalCount, hasMore: page * pageSize < totalCount };
  }

  private async executePagedQuery<T>(
    dataSql: string, countSql: string,
    dataParams: any[], countParams: any[],
    page: number, pageSize: number,
    mapFn?: (row: any) => T,
  ): Promise<PagedResult<T>> {
    const offset = (page - 1) * pageSize;
    const [rows, countResult] = await Promise.all([
      this.db.$queryRawUnsafe(
        `${dataSql} LIMIT $${dataParams.length + 1} OFFSET $${dataParams.length + 2}`,
        ...dataParams, pageSize, offset,
      ),
      this.db.$queryRawUnsafe(countSql, ...countParams),
    ]);
    const totalCount = Number((countResult as any[])[0]?.count) || 0;
    const items = mapFn ? (rows as any[]).map(mapFn) : ((rows as unknown) as T[]);
    return this.toPagedResult(items, page, pageSize, totalCount);
  }

  private getAvatarColor(sid: number): string {
    const colors = ['#05608D', '#16a34a', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#0d9488', '#4f46e5'];
    return colors[(sid || 0) % colors.length];
  }
}
