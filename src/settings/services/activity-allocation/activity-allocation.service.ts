import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';

export type Stage =
  | 'RateRequest'
  | 'Quotation'
  | 'Booking'
  | 'LoadPlan'
  | 'MasterJob';

export type SummaryMode = 'All' | 'Pending' | 'Processed';

export interface SummaryRow {
  userSid: number;
  userName: string;
  rateRequestCount: number;
  quotationCount: number;
  bookingCount: number;
  masterJobCount: number;
}

export interface WorkloadRow {
  activityId: number;
  userSid: number;
  userName: string;
  stage: Stage;
  status: 'Pending' | 'Processed';
  // Stage-specific primary document number (Enquiry/Quotation/Booking/Master Job/House Job No)
  documentNo: string;
  quotationNo: string;
  bookingNo: string;
  customerName: string;
  salesPersonName: string;
  customerServiceName: string;
  documentationName: string;
  etd: string;
  createdOn: string;
  updatedOn: string;
}

export interface WorkloadDetailResponse {
  data: WorkloadRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  availableUsers: { userSid: number; userName: string }[];
}

interface CachedUsers {
  data: { userSid: number; userName: string }[];
  timestamp: number;
}

class AsyncQueue {
  private running = 0;
  private readonly queue: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

@Injectable()
export class ActivityAllocationService {
  private logger = new Logger(ActivityAllocationService.name);
  private userCache: Map<string, CachedUsers> = new Map();
  private readonly cacheExpiry: number = 5 * 60 * 1000; 
  private readonly maxCacheSize: number = 100;

 
  private readonly dbQueue = new AsyncQueue(8);

  constructor(private readonly db: DatabaseService) {}

  
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.userCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.userCache.delete(key);
      }
    }

    if (this.userCache.size > this.maxCacheSize) {
      const oldestKey = this.userCache.keys().next().value;
      if (oldestKey) {
        this.userCache.delete(oldestKey);
      }
    }
  }

    
  async getSummary(
    mode: SummaryMode = 'Pending',  
    search?: string,
    companyMasterSid?: number,
    branchMasterSid?: number,
  ): Promise<{ data: SummaryRow[]; total: number }> {
    const startTime = Date.now();

    if (!companyMasterSid) {
      throw new BadRequestException('companyMasterSid is required');
    }

    const summary = await this.buildSummaryOptimized(
      companyMasterSid,
      branchMasterSid,
      mode, 
      search,
    );

    const total = summary.reduce(
      (sum, r) =>
        sum +
        r.rateRequestCount +
        r.quotationCount +
        r.bookingCount +
        r.masterJobCount,
      0,
    );

    const duration = Date.now() - startTime;
    this.logger.log(
      `✅ Summary loaded in ${duration}ms for ${summary.length} users (mode: ${mode}, total activities: ${total})`,
    );

    if (duration > 3000) {
      this.logger.warn(`⚠️ Slow query detected: ${duration}ms`);
    }

    return { data: summary, total };
  }

  
  async getResourceSummary(
    mode: SummaryMode = 'Pending',
    search?: string,
    companyMasterSid?: number,
    branchMasterSid?: number,
  ): Promise<SummaryRow[]> {
    const { data } = await this.getSummary(mode, search, companyMasterSid, branchMasterSid);
    return data;
  }


  
  private async buildSummaryOptimized(
    companyMasterSid: number,
    branchMasterSid: number | undefined,
    mode: SummaryMode,
    search?: string,
  ): Promise<SummaryRow[]> {
    try {
      const branchFilter = branchMasterSid
        ? `AND "BranchMasterSid" = ${branchMasterSid}`
        : '';

      // Run 5 aggregate queries in parallel (one per stage) instead of N*9 per-user queries
      const [
        enquiryCounts,
        quotationCounts,
        bookingCounts,
        masterJobCounts,
      ] = await Promise.all([
        // Enquiry (RateRequest) — enquiries WITHOUT a QuoteHeaderSid,
        // attributed to the EnquiryOther.ResourcePerson (= UserMasterSid)
        this.db.$queryRawUnsafe<{ user_sid: number; cnt: bigint }[]>(`
          SELECT eo."ResourcePerson" as user_sid,
                 COUNT(DISTINCT eh."EnquiryHeaderSid") as cnt
          FROM "EnquiryHeader" eh
          JOIN "EnquiryOther" eo ON eo."EnquiryHeaderSid" = eh."EnquiryHeaderSid"
          WHERE eh."CompanyMasterSid" = ${companyMasterSid}
            AND eh."status" = 'A'
            AND eo."ResourcePerson" IS NOT NULL
            ${branchMasterSid ? `AND eh."BranchMasterSid" = ${branchMasterSid}` : ''}
            ${mode === 'Pending' ? 'AND eh."QuoteHeaderSid" IS NULL' : ''}
            ${mode === 'Processed' ? 'AND eh."QuoteHeaderSid" IS NOT NULL' : ''}
          GROUP BY eo."ResourcePerson"
        `),

        // Quotation — quotations WITHOUT a BookingHeaderSid,
        // attributed to the QuoteHeader.ResourcePerson (= UserMasterSid)
        this.db.$queryRawUnsafe<{ user_sid: number; cnt: bigint }[]>(`
          SELECT q."ResourcePerson" as user_sid, COUNT(*) as cnt
          FROM "QuoteHeader" q
          WHERE q."CompanyMasterSid" = ${companyMasterSid}
            AND q."status" = 'A'
            AND q."ResourcePerson" IS NOT NULL
            ${branchMasterSid ? `AND q."BranchMasterSid" = ${branchMasterSid}` : ''}
            ${mode === 'Pending' ? 'AND q."BookingHeaderSid" IS NULL' : ''}
            ${mode === 'Processed' ? 'AND q."BookingHeaderSid" IS NOT NULL' : ''}
          GROUP BY q."ResourcePerson"
        `),

        // Booking — bookings WITHOUT a MasterNoSid,
        // attributed to the BookingOthers.ResourcePerson (= UserMasterSid)
        this.db.$queryRawUnsafe<{ user_sid: number; cnt: bigint }[]>(`
          SELECT bo."ResourcePerson" as user_sid,
                 COUNT(DISTINCT bh."BookingHeaderSid") as cnt
          FROM "BookingHeader" bh
          JOIN "BookingOthers" bo ON bo."BookingHeaderSid" = bh."BookingHeaderSid"
          WHERE bh."CompanyMasterSid" = ${companyMasterSid}
            AND bh."status" = 'A'
            AND bo."ResourcePerson" IS NOT NULL
            ${branchMasterSid ? `AND bh."BranchMasterSid" = ${branchMasterSid}` : ''}
            ${mode === 'Pending' ? 'AND bh."MasterNoSid" IS NULL' : ''}
            ${mode === 'Processed' ? 'AND bh."MasterNoSid" IS NOT NULL' : ''}
          GROUP BY bo."ResourcePerson"
        `),

        // MasterJob — grouped by CreatedBy (email), join to get UserMasterSid
        this.db.$queryRawUnsafe<{ user_sid: number; cnt: bigint }[]>(`
          SELECT u."UserMasterSid" as user_sid, COUNT(*) as cnt
          FROM "MasterJob" m
          JOIN "UserMaster" u ON u."userEmail" = m."CreatedBy"
          WHERE m."CompanyMasterSid" = ${companyMasterSid}
            AND m."Status" = 'A'
            ${branchMasterSid ? `AND m."BranchMasterSid" = ${branchMasterSid}` : ''}
          GROUP BY u."UserMasterSid"
        `),
      ]);

      // Build lookup maps from query results
      const toMap = (rows: { user_sid: number; cnt: bigint }[]) => {
        const m = new Map<number, number>();
        for (const r of rows) {
          if (r.user_sid) m.set(r.user_sid, Number(r.cnt));
        }
        return m;
      };

      const enquiryMap = toMap(enquiryCounts);
      const quotationMap = toMap(quotationCounts);
      const bookingMap = toMap(bookingCounts);
      const masterJobMap = toMap(masterJobCounts);

      const users = await this.getAvailableUsers(companyMasterSid, branchMasterSid);

      let rows: SummaryRow[] = users.map((user) => {
        const sid = user.userSid;
        const rateRequestCount = enquiryMap.get(sid) || 0;
        const quotationCount = quotationMap.get(sid) || 0;
        const bookingCount = bookingMap.get(sid) || 0;
        const masterJobCount = masterJobMap.get(sid) || 0;

        return {
          userSid: sid,
          userName: user.userName,
          rateRequestCount,
          quotationCount,
          bookingCount,
          masterJobCount,
        };
      });

      // Apply search filter
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        rows = rows.filter(r => r.userName.toLowerCase().includes(q));
      }

      // Sort by userName
      rows.sort((a, b) => a.userName.localeCompare(b.userName));

      this.logger.log(
        `📊 Summary built for ${rows.length} users in company ${companyMasterSid}${branchMasterSid ? `, branch ${branchMasterSid}` : ''}`,
      );

      return rows;
    } catch (error: any) {
      this.logger.error(`❌ Critical error in buildSummaryOptimized: ${error.message}`);
      throw new BadRequestException('Failed to build summary');
    }
  }

 
  private async getCountsForUser(
    userSid: number,
    userEmail: string,
    userName: string,
    companyMasterSid: number,
    branchMasterSid?: number,
    mode?: SummaryMode,
  ): Promise<{
    RateRequest: number;
    Quotation: number;
    Booking: number;
    LoadPlan: number;
    MasterJob: number;
  }> {
    const baseWhere: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
    };
    if (branchMasterSid) {
      baseWhere.BranchMasterSid = branchMasterSid;
    }

    const [
      rateRequestCount,
      quotationCount,
      bookingCount,
      loadPlanCount,
      masterJobCount,
    ] = await Promise.all([
      this.dbQueue.run(() =>
        this.db.enquiryHeader
          .count({
            where: {
              ...baseWhere,
              UserMasterSid: userSid,
              ...(mode === 'Processed' && { QuoteHeaderSid: { not: null } }),
              ...(mode === 'Pending' && { QuoteHeaderSid: null }),
            },
          })
          .catch(() => 0),
      ),

      this.dbQueue.run(() =>
        this.db.quoteHeader
          .count({
            where: {
              ...baseWhere,
              createdBy: userEmail,
              ...(mode === 'Processed' && { BookingHeaderSid: { not: null } }),
              ...(mode === 'Pending' && { BookingHeaderSid: null }),
            },
          })
          .catch(() => 0),
      ),

      this.dbQueue.run(() =>
        this.db.bookingHeader
          .count({
            where: {
              ...baseWhere,
              SalesmanSid: userSid,
              ...(mode === 'Pending' && {
                BookingStatus: { in: ['Pending', 'Hold'] },
              }),
              ...(mode === 'Processed' && {
                BookingStatus: { notIn: ['Pending', 'Hold'] },
              }),
            },
          })
          .catch(() => 0),
      ),

      this.dbQueue.run(() =>
        this.db.bookingHeader
          .count({
            where: {
              ...baseWhere,
              SalesmanSid: userSid,
              MBLNo: null,
              MasterNoSid: null,
              BookingStatus: { in: ['Booked', 'Cargo Received'] },
            },
          })
          .catch(() => 0),
      ),

      this.dbQueue.run(() =>
        this.db.masterJob
          .count({
            where: {
              CompanyMasterSid: companyMasterSid,
              Status: 'A',
              ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
              CreatedBy: userEmail,
            },
          })
          .catch(() => 0),
      ),
    ]);

    return {
      RateRequest: rateRequestCount,
      Quotation: quotationCount,
      Booking: bookingCount,
      LoadPlan: loadPlanCount,
      MasterJob: masterJobCount,
    };
  }

  
  private async getAvailableUsers(
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<{ userSid: number; userName: string }[]> {
    const cacheKey = `available_users:${companyMasterSid}:${branchMasterSid || 'all'}`;
    const cached = this.userCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const allUsers = await this.db.userMaster.findMany({
      where: {
        status: 'A',
        // Resource Summary lists salespersons only
        isSalesperson: '1',
        userCompanyMaster: {
          some: {
            CompanyMasterSid: companyMasterSid,
            GiveAccess: 'Y',
            status: 'A',
          },
        },
        ...(branchMasterSid
          ? {
              userBranchMaster: {
                some: {
                  CompanyMasterSid: companyMasterSid,
                  BranchMasterSid: branchMasterSid,
                  GiveAccess: 'Y',
                  status: 'A',
                },
              },
            }
          : {}),
      },
      select: { UserMasterSid: true, userName: true },
      orderBy: { userName: 'asc' },
    });

    const result = allUsers.map((u) => ({
      userSid: u.UserMasterSid,
      userName: u.userName,
    }));

    this.userCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    this.clearExpiredCache();

    return result;
  }

 
  async getWorkloadDetails(
    userSid: number,
    stage: Stage,
    mode: SummaryMode = 'Pending',
    companyMasterSid?: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 100,
    search: string = '',
  ): Promise<WorkloadDetailResponse> {
    if (!companyMasterSid) {
      throw new BadRequestException('companyMasterSid is required');
    }

    this.logger.log(`🔍 getWorkloadDetails: ${stage} for user ${userSid} (mode: ${mode})`);

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const safePage = Math.max(Number(page) || 1, 1);

    const user = await this.db.userMaster.findUnique({
      where: { UserMasterSid: userSid },
      select: { userName: true, userEmail: true },
    });

    if (!user) {
      this.logger.error(`❌ User not found: ${userSid}`);
      throw new BadRequestException('User not found');
    }

    let data: WorkloadRow[] = [];
    let total = 0;

    try {
      const workloadMethod = this.getWorkloadMethod(stage);
      const result = await workloadMethod(
        userSid,
        user,
        mode,
        companyMasterSid,
        branchMasterSid,
        safePage,
        safeLimit,
        search?.trim() || '',
      );
      data = result.data;
      total = result.total;
    } catch (error: any) {
      this.logger.error(
        `❌ Error fetching ${stage} workload: ${error.message}`,
      );
      this.logger.error(`   Stack: ${error.stack}`);
      throw new BadRequestException(
        `Failed to fetch ${stage} workload details: ${error.message}`,
      );
    }

    const availableUsers = await this.getAvailableUsers(
      companyMasterSid,
      branchMasterSid,
    );
    const totalPages = Math.ceil(total / safeLimit);

    this.logger.log(
      `✅ Workload: ${stage}, page ${safePage}/${totalPages}, total: ${total}, returned: ${data.length}`,
    );

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
      availableUsers,
    };
  }

 
  private getWorkloadMethod(stage: Stage) {
    const methods = {
      RateRequest: this.getEnquiryWorkload.bind(this),
      Quotation: this.getQuotationWorkload.bind(this),
      Booking: this.getBookingWorkload.bind(this),
      LoadPlan: this.getLoadPlanWorkload.bind(this),
      MasterJob: this.getMasterJobWorkload.bind(this),
    };
    return methods[stage];
  }


  private async getEnquiryWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 50,
    search: string = '',
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      // Attributed to the EnquiryOther.ResourcePerson, matching the summary count
      enquiryOther: { some: { ResourcePerson: userSid } },
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') where.QuoteHeaderSid = null;
    else if (mode === 'Processed') where.QuoteHeaderSid = { not: null };
    if (search) {
      where.OR = [
        { EnquiryNumber: { contains: search, mode: 'insensitive' } },
        { CustomerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [enquiries, total] = await Promise.all([
      this.db.enquiryHeader.findMany({
        where,
        orderBy: { EnquiryHeaderSid: 'desc' },
        skip,
        take: limit,
      }),
      this.db.enquiryHeader.count({ where }),
    ]);

    const data = enquiries.map((e) => ({
      activityId: e.EnquiryHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'RateRequest' as Stage,
      status: (e.QuoteHeaderSid ? 'Processed' : 'Pending') as 'Pending' | 'Processed',
      documentNo: e.EnquiryNumber || '',
      quotationNo: '',
      bookingNo: '',
      customerName: e.CustomerName || '',
      salesPersonName: user.userName,
      customerServiceName: '',
      documentationName: '',
      etd: e.ShipmentExpectedDate
        ? moment(e.ShipmentExpectedDate).format('YYYY-MM-DD')
        : '',
      createdOn: e.createdOn
        ? moment(e.createdOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
      updatedOn: e.updatedOn
        ? moment(e.updatedOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
    }));

    return { data, total };
  }

  private async getQuotationWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 50,
    search: string = '',
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      // Attributed to the QuoteHeader.ResourcePerson, matching the summary count
      ResourcePerson: userSid,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') where.BookingHeaderSid = null;
    else if (mode === 'Processed') where.BookingHeaderSid = { not: null };
    if (search) {
      where.OR = [
        { QuoteNumber: { contains: search, mode: 'insensitive' } },
        { CustomerName: { contains: search, mode: 'insensitive' } },
        { bookingHeader: { is: { BookingNo: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [quotes, total] = await Promise.all([
      this.db.quoteHeader.findMany({
        where,
        orderBy: { QuoteHeaderSid: 'desc' },
        skip,
        take: limit,
        include: {
          bookingHeader: {
            select: { BookingNo: true },
          },
        },
      }),
      this.db.quoteHeader.count({ where }),
    ]);

    const data = quotes.map((q) => ({
      activityId: q.QuoteHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'Quotation' as Stage,
      status: (q.BookingHeaderSid ? 'Processed' : 'Pending') as 'Pending' | 'Processed',
      documentNo: q.QuoteNumber || '',
      quotationNo: q.QuoteNumber || '',
      bookingNo: q.bookingHeader?.BookingNo || '',
      customerName: q.CustomerName || '',
      salesPersonName: user.userName,
      customerServiceName: '',
      documentationName: '',
      etd: '',
      createdOn: q.createdOn
        ? moment(q.createdOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
      updatedOn: q.updatedOn
        ? moment(q.updatedOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
    }));

    return { data, total };
  }

  private async getBookingWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 50,
    search: string = '',
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      // Attributed to the BookingOthers.ResourcePerson, matching the summary count
      bookingOthers: { some: { ResourcePerson: userSid } },
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') where.MasterNoSid = null;
    else if (mode === 'Processed') where.MasterNoSid = { not: null };
    if (search) {
      where.OR = [
        { BookingNo: { contains: search, mode: 'insensitive' } },
        { CustomerName: { contains: search, mode: 'insensitive' } },
        { quotationHeader: { is: { QuoteNumber: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.db.bookingHeader.findMany({
        where,
        orderBy: { BookingHeaderSid: 'desc' },
        skip,
        take: limit,
        include: {
          quotationHeader: {
            select: { QuoteNumber: true },
          },
        },
      }),
      this.db.bookingHeader.count({ where }),
    ]);

    const data = bookings.map((b) => ({
      activityId: b.BookingHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'Booking' as Stage,
      status: (b.MasterNoSid ? 'Processed' : 'Pending') as
        | 'Pending'
        | 'Processed',
      documentNo: b.BookingNo || '',
      quotationNo: b.quotationHeader?.QuoteNumber || '',
      bookingNo: b.BookingNo || '',
      customerName: b.CustomerName || '',
      salesPersonName: user.userName,
      customerServiceName: '',
      documentationName: '',
      etd: b.ETD ? moment(b.ETD).format('YYYY-MM-DD') : '',
      createdOn: b.createdOn
        ? moment(b.createdOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
      updatedOn: b.updatedOn
        ? moment(b.updatedOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
    }));

    return { data, total };
  }

  private async getLoadPlanWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 50,
    search: string = '',
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      SalesmanSid: userSid,
      MBLNo: null,
      MasterNoSid: null,
      BookingStatus: { in: ['Booked', 'Cargo Received'] },
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (search) {
      where.OR = [
        { BookingNo: { contains: search, mode: 'insensitive' } },
        { CustomerName: { contains: search, mode: 'insensitive' } },
        { quotationHeader: { is: { QuoteNumber: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      this.db.bookingHeader.findMany({
        where,
        orderBy: { BookingHeaderSid: 'desc' },
        skip,
        take: limit,
        include: {
          quotationHeader: {
            select: { QuoteNumber: true },
          },
        },
      }),
      this.db.bookingHeader.count({ where }),
    ]);

    const data = bookings.map((b) => ({
      activityId: b.BookingHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'LoadPlan' as Stage,
      status: 'Pending' as 'Pending' | 'Processed',
      documentNo: b.BookingNo || '',
      quotationNo: b.quotationHeader?.QuoteNumber || '',
      bookingNo: b.BookingNo || '',
      customerName: b.CustomerName || '',
      salesPersonName: user.userName,
      customerServiceName: '',
      documentationName: '',
      etd: b.ETD ? moment(b.ETD).format('YYYY-MM-DD') : '',
      createdOn: b.createdOn
        ? moment(b.createdOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
      updatedOn: b.updatedOn
        ? moment(b.updatedOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
    }));

    return { data, total };
  }

  private async getMasterJobWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 50,
    search: string = '',
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      Status: 'A',
      CreatedBy: user.userEmail,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (search) {
      where.OR = [
        { MasterJobNumber: { contains: search, mode: 'insensitive' } },
        { houseJob: { some: { CustomerName: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [masterJobs, total] = await Promise.all([
      this.db.masterJob.findMany({
        where,
        include: {
          houseJob: {
            where: { status: 'A' },
            take: 1,
          },
          voyages: {
            where: { Status: 'A' },
            take: 1,
          },
        },
        orderBy: { MasterJobSid: 'desc' },
        skip,
        take: limit,
      }),
      this.db.masterJob.count({ where }),
    ]);

    const data = masterJobs.map((mj) => {
      const houseJob = mj.houseJob?.[0];
      const voyage = mj.voyages?.[0];

      return {
        activityId: mj.MasterJobSid,
        userSid,
        userName: user.userName,
        stage: 'MasterJob' as Stage,
        status: 'Pending' as 'Pending' | 'Processed',
        documentNo: mj.MasterJobNumber || '',
        quotationNo: '',
        bookingNo: mj.MasterJobNumber || '',
        customerName: houseJob?.CustomerName || '',
        salesPersonName: user.userName,
        customerServiceName: '',
        documentationName: user.userName,
        etd: voyage?.ETD ? moment(voyage.ETD).format('YYYY-MM-DD') : '',
        createdOn: mj.CreatedOn
          ? moment(mj.CreatedOn).format('YYYY-MM-DD HH:mm:ss')
          : '',
        updatedOn: mj.UpdatedOn
          ? moment(mj.UpdatedOn).format('YYYY-MM-DD HH:mm:ss')
          : '',
      };
    });

    return { data, total };
  }

  private async getJobWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
      Others: {
        some: {
          CustomerServiceuser: user.userName,
        },
      },
    };

    if (mode === 'Pending') {
      where.OR = [{ HBLNo: null }, { HBLNo: { startsWith: 'HOUSE-' } }];
    } else if (mode === 'Processed') {
      where.HBLNo = { not: null };
      where.NOT = {
        HBLNo: { startsWith: 'HOUSE-' },
      };
    }

    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      this.db.houseJob.findMany({
        where,
        include: {
          Others: {
            where: {
              CustomerServiceuser: user.userName,
            },
            take: 1,
          },
        },
        orderBy: { HouseJobSid: 'desc' },
        skip,
        take: limit,
      }),
      this.db.houseJob.count({ where }),
    ]);

    const data = jobs.map((j) => ({
      activityId: j.HouseJobSid,
      userSid,
      userName: user.userName,
      stage: 'Job' as Stage,
      status:
        (j.HBLNo && !j.HBLNo.startsWith('HOUSE-') ? 'Processed' : 'Pending') as
          | 'Pending'
          | 'Processed',
      documentNo: j.HBLNo || j.BookingNo || '',
      quotationNo: '',
      bookingNo: j.BookingNo || '',
      customerName: j.CustomerName || '',
      salesPersonName: '',
      customerServiceName: user.userName,
      documentationName: '',
      etd: j.ETD ? moment(j.ETD).format('YYYY-MM-DD') : '',
      createdOn: j.createdOn
        ? moment(j.createdOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
      updatedOn: j.updatedOn
        ? moment(j.updatedOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
    }));

    return { data, total };
  }

  private async getBLWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      HBLNo: { not: null },
      ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
      Others: {
        some: {
          DocumentationUser: user.userName,
          ...(mode === 'Pending' && {
            OR: [{ ReleaseType: null }, { BacktoBack: null }],
          }),
          ...(mode === 'Processed' && {
            ReleaseType: { not: null },
            BacktoBack: { not: null },
          }),
        },
      },
    };

    const skip = (page - 1) * limit;

    const [bls, total] = await Promise.all([
      this.db.houseJob.findMany({
        where,
        include: {
          Others: {
            where: {
              DocumentationUser: user.userName,
            },
            take: 1,
          },
        },
        orderBy: { HouseJobSid: 'desc' },
        skip,
        take: limit,
      }),
      this.db.houseJob.count({ where }),
    ]);

    const data = bls.map((bl) => {
      const others = bl.Others?.[0];
      return {
        activityId: bl.HouseJobSid,
        userSid,
        userName: user.userName,
        stage: 'BL' as Stage,
        status:
          (others?.ReleaseType && others?.BacktoBack
            ? 'Processed'
            : 'Pending') as 'Pending' | 'Processed',
        documentNo: bl.HBLNo || '',
        quotationNo: '',
        bookingNo: bl.HBLNo || '',
        customerName: bl.CustomerName || '',
        salesPersonName: '',
        customerServiceName: '',
        documentationName: user.userName,
        etd: bl.ETD ? moment(bl.ETD).format('YYYY-MM-DD') : '',
        createdOn: bl.createdOn
          ? moment(bl.createdOn).format('YYYY-MM-DD HH:mm:ss')
          : '',
        updatedOn: bl.updatedOn
          ? moment(bl.updatedOn).format('YYYY-MM-DD HH:mm:ss')
          : '',
      };
    });

    return { data, total };
  }

  private async getSIWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
      Others: {
        some: {
          DocumentationUser: user.userName,
          ...(mode === 'Pending' && {
            PickupDate: null,
          }),
          ...(mode === 'Processed' && {
            PickupDate: { not: null },
          }),
        },
      },
    };

    if (mode === 'Pending') {
      where.BookingStatus = { in: ['Booked', 'Cargo Received'] };
    }

    const skip = (page - 1) * limit;

    const [sis, total] = await Promise.all([
      this.db.houseJob.findMany({
        where,
        include: {
          Others: {
            where: {
              DocumentationUser: user.userName,
            },
            take: 1,
          },
        },
        orderBy: { HouseJobSid: 'desc' },
        skip,
        take: limit,
      }),
      this.db.houseJob.count({ where }),
    ]);

    const data = sis.map((si) => {
      const others = si.Others?.[0];
      return {
        activityId: si.HouseJobSid,
        userSid,
        userName: user.userName,
        stage: 'SI' as Stage,
        status: (others?.PickupDate ? 'Processed' : 'Pending') as
          | 'Pending'
          | 'Processed',
        documentNo: si.HBLNo || si.BookingNo || '',
        quotationNo: '',
        bookingNo: si.BookingNo || '',
        customerName: si.CustomerName || '',
        salesPersonName: '',
        customerServiceName: '',
        documentationName: user.userName,
        etd: si.ETD ? moment(si.ETD).format('YYYY-MM-DD') : '',
        createdOn: si.createdOn
          ? moment(si.createdOn).format('YYYY-MM-DD HH:mm:ss')
          : '',
        updatedOn: si.updatedOn
          ? moment(si.updatedOn).format('YYYY-MM-DD HH:mm:ss')
          : '',
      };
    });

    return { data, total };
  }

  async updateActivityAllocation(
    allocationSid: number,
    stage: Stage,
    payload: { status?: string; userSid?: number },
  ) {
    const { userSid, status } = payload;

    try {
      if (stage === 'RateRequest') {
        if (userSid) {
          // Reassign the enquiry to the new resource person (matches the count/list)
          await this.db.enquiryOther.updateMany({
            where: { EnquiryHeaderSid: allocationSid },
            data: { ResourcePerson: userSid },
          });
        }
      } else if (stage === 'Quotation') {
        if (userSid) {
          await this.db.quoteHeader.update({
            where: { QuoteHeaderSid: allocationSid },
            data: { ResourcePerson: userSid },
          });
        }
      } else if (stage === 'Booking' || stage === 'LoadPlan') {
        if (userSid) {
          await this.db.bookingOthers.updateMany({
            where: { BookingHeaderSid: allocationSid },
            data: { ResourcePerson: userSid },
          });
        }
        if (status) {
          await this.db.bookingHeader.update({
            where: { BookingHeaderSid: allocationSid },
            data: { BookingStatus: status },
          });
        }
      } else if (stage === 'MasterJob') {
        if (userSid) {
          const newUser = await this.db.userMaster.findUnique({
            where: { UserMasterSid: userSid },
            select: { userEmail: true },
          });

          if (newUser) {
            await this.db.masterJob.update({
              where: { MasterJobSid: allocationSid },
              data: { CreatedBy: newUser.userEmail },
            });
          }
        }
      } else if (stage === 'Job') {
        if (userSid) {
          const newUser = await this.db.userMaster.findUnique({
            where: { UserMasterSid: userSid },
            select: { userName: true },
          });

          if (newUser) {
            await this.db.houseJobOthers.updateMany({
              where: { HouseJobSid: allocationSid },
              data: { CustomerServiceuser: newUser.userName },
            });
          }
        }
      } else if (stage === 'BL' || stage === 'SI') {
        if (userSid) {
          const newUser = await this.db.userMaster.findUnique({
            where: { UserMasterSid: userSid },
            select: { userName: true },
          });

          if (newUser) {
            await this.db.houseJobOthers.updateMany({
              where: { HouseJobSid: allocationSid },
              data: { DocumentationUser: newUser.userName },
            });
          }
        }
        if (status && stage === 'BL') {
          await this.db.houseJobOthers.updateMany({
            where: { HouseJobSid: allocationSid },
            data: { ReleaseType: status },
          });
        }
      } else if (stage === 'Invoice') {
        if (userSid) {
          const newUser = await this.db.userMaster.findUnique({
            where: { UserMasterSid: userSid },
            select: { userEmail: true },
          });
          if (newUser) {
            await this.db.voucherHeader.update({
              where: { VoucherHeaderSid: allocationSid },
              data: { CreatedBy: newUser.userEmail },
            });
          }
        }
      }

      this.logger.log(`✅ ${stage} updated successfully: ${allocationSid}`);
      return { success: true, message: `${stage} updated successfully` };
    } catch (error: any) {
      this.logger.error(`❌ Update failed for ${stage}: ${error.message}`);
      throw new BadRequestException(`Failed to update ${stage}: ${error.message}`);
    }
  }

  
  async generateReport(
    mode: SummaryMode = 'Pending',
    companyMasterSid?: number,
    branchMasterSid?: number,
  ) {
    const result = await this.getSummary(
      mode,
      undefined,
      companyMasterSid,
      branchMasterSid,
    );

    const data = result.data.map((r) => ({
      User: r.userName,
      RateRequest: r.rateRequestCount,
      Quotation: r.quotationCount,
      Booking: r.bookingCount,
      MasterJob: r.masterJobCount,
      Total:
        r.rateRequestCount +
        r.quotationCount +
        r.bookingCount +
        r.masterJobCount,
    }));

    return {
      data,
      total: result.total,
      generatedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    };
  }

  // ─── Update CS Person ────────────────────────────────────────

  async updateCSPerson(
    activityId: number,
    csUserSid: number,
    stage: string,
    updatedBy: string,
  ) {
    try {
      // Verify the CS user exists
      const csUser = await this.db.userMaster.findUnique({
        where: { UserMasterSid: csUserSid },
        select: { UserMasterSid: true, userName: true },
      });

      if (!csUser) {
        throw new BadRequestException(`CS user ${csUserSid} not found`);
      }

      // activityId is the stage record's PK (e.g. EnquiryHeaderSid, BookingHeaderSid, etc.)
      // Update the CS person based on the stage
      switch (stage) {
        case 'RateRequest': {
          // EnquiryOther doesn't have CustomerServiceuser — update via CustomerSalesTeam
          const enquiry = await this.db.enquiryHeader.findUnique({
            where: { EnquiryHeaderSid: activityId },
            select: { CustomerMasterSid: true, CompanyMasterSid: true },
          });
          if (enquiry?.CustomerMasterSid) {
            await this.db.customerSalesTeam.updateMany({
              where: {
                CustomerMasterSid: enquiry.CustomerMasterSid,
                CompanyMasterSid: enquiry.CompanyMasterSid,
                status: 'A',
              },
              data: { CSPerson: csUserSid },
            });
          }
          break;
        }

        case 'Quotation':
          // QuoteHeader doesn't have a separate "others" table — update via ActivityResourceAllocation if exists
          const quotaAlloc = await this.db.activityResourceAllocation.findFirst({
            where: { QuoteHeaderSid: activityId },
          });
          if (quotaAlloc) {
            await this.db.activityResourceAllocation.update({
              where: { ActivityResourceAllocationSid: quotaAlloc.ActivityResourceAllocationSid },
              data: { EnquiryUser: csUserSid, UpdatedBy: updatedBy, UpdatedOn: new Date() },
            });
          }
          break;

        case 'Booking':
          await this.db.bookingOthers.updateMany({
            where: { BookingHeaderSid: activityId },
            data: { CustomerServiceuser: csUser.userName },
          });
          break;

        case 'LoadPlan':
          await this.db.bookingOthers.updateMany({
            where: { BookingHeaderSid: activityId },
            data: { CustomerServiceuser: csUser.userName },
          });
          break;

        case 'MasterJob':
          // MasterJob uses HouseJobOthers through related house jobs
          const houseJobs = await this.db.houseJob.findMany({
            where: { MasterJobSid: activityId },
            select: { HouseJobSid: true },
          });
          if (houseJobs.length > 0) {
            await this.db.houseJobOthers.updateMany({
              where: { HouseJobSid: { in: houseJobs.map(h => h.HouseJobSid) } },
              data: { CustomerServiceuser: csUser.userName },
            });
          }
          break;

        default:
          throw new BadRequestException(`Invalid stage: ${stage}`);
      }

      return {
        success: true,
        message: `CS person updated to ${csUser.userName}`,
      };
    } catch (error: any) {
      this.logger.error(`Error updating CS person: ${error.message}`);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Failed to update CS person');
    }
  }
}
