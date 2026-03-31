import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';

export type Stage =
  | 'RateRequest'
  | 'Quotation'
  | 'Booking'
  | 'LoadPlan'
  | 'MasterJob'
  | 'Job'
  | 'BL'
  | 'SI'
  | 'Invoice';

export type SummaryMode = 'All' | 'Pending' | 'Processed';

export interface SummaryRow {
  userSid: number;
  userName: string;
  rateRequestCount: number;
  quotationCount: number;
  bookingCount: number;
  loadPlanCount: number;
  masterJobCount: number;
  jobCount: number;
  blCount: number;
  siCount: number;
  invoiceCount: number;
}

export interface WorkloadRow {
  activityId: number;
  userSid: number;
  userName: string;
  stage: Stage;
  status: 'Pending' | 'Processed';
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

    if (!companyMasterSid) companyMasterSid = 7;

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
        r.loadPlanCount +
        r.masterJobCount +
        r.jobCount +
        r.blCount +
        r.siCount +
        r.invoiceCount,
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
      
      let users = await this.db.userMaster.findMany({
        where: { status: 'A' },
        select: { UserMasterSid: true, userName: true, userEmail: true },
        orderBy: { UserMasterSid: 'desc' },
      });

      
      const seenNames = new Map<string, typeof users[0]>();
      users = users.filter((u) => {
        const key = u.userName.toLowerCase().trim();
        if (seenNames.has(key)) {
          this.logger.warn(
            `⚠️ Duplicate user skipped: ${u.userName} (Sid: ${u.UserMasterSid})`,
          );
          return false;
        }
        seenNames.set(key, u);
        return true;
      });

      
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        users = users.filter((u) => u.userName.toLowerCase().includes(q));
      }

      this.logger.log(`📊 Processing ${users.length} unique users for summary`);

      
      const results: { user: typeof users[0]; counts: any }[] = [];
      const chunkSize = 10;

      for (let i = 0; i < users.length; i += chunkSize) {
        const chunk = users.slice(i, i + chunkSize);

        const chunkResults = await Promise.all(
          chunk.map((u) =>
            this.getCountsForUser(
              u.UserMasterSid,
              u.userEmail,
              u.userName,
              companyMasterSid,
              branchMasterSid,
              mode,
            )
              .then((counts) => ({ user: u, counts }))
              .catch((error) => {
                this.logger.error(
                  `❌ Error getting counts for ${u.userName}: ${error.message}`,
                );
                return {
                  user: u,
                  counts: {
                    RateRequest: 0,
                    Quotation: 0,
                    Booking: 0,
                    LoadPlan: 0,
                    MasterJob: 0,
                    Job: 0,
                    BL: 0,
                    SI: 0,
                    Invoice: 0,
                  },
                };
              }),
          ),
        );

        results.push(...chunkResults);
      }

      
      const rows: SummaryRow[] = results
        .filter(
          ({ counts }) =>
            counts.RateRequest > 0 ||
            counts.Quotation > 0 ||
            counts.Booking > 0 ||
            counts.LoadPlan > 0 ||
            counts.MasterJob > 0 ||
            counts.Job > 0 ||
            counts.BL > 0 ||
            counts.SI > 0 ||
            counts.Invoice > 0,
        )
        .map(({ user: u, counts }) => ({
          userSid: u.UserMasterSid,
          userName: u.userName,
          rateRequestCount: counts.RateRequest,
          quotationCount: counts.Quotation,
          bookingCount: counts.Booking,
          loadPlanCount: counts.LoadPlan,
          masterJobCount: counts.MasterJob,
          jobCount: counts.Job,
          blCount: counts.BL,
          siCount: counts.SI,
          invoiceCount: counts.Invoice,
        }));

      this.clearExpiredCache();

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
    Job: number;
    BL: number;
    SI: number;
    Invoice: number;
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
      jobCount,
      blCount,
      siCount,
      invoiceCount,
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
          .catch((err) => {
            this.logger.error(`RateRequest count error for ${userName}: ${err.message}`);
            return 0;
          }),
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
          .catch((err) => {
            this.logger.error(`Quotation count error for ${userName}: ${err.message}`);
            return 0;
          }),
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
          .catch((err) => {
            this.logger.error(`Booking count error for ${userName}: ${err.message}`);
            return 0;
          }),
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
          .catch((err) => {
            this.logger.error(`LoadPlan count error for ${userName}: ${err.message}`);
            return 0;
          }),
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
          .catch((err) => {
            this.logger.error(`MasterJob count error for ${userName}: ${err.message}`);
            return 0;
          }),
      ),

      
      this.dbQueue.run(() =>
        this.db.houseJob
          .count({
            where: {
              CompanyMasterSid: companyMasterSid,
              status: 'A',
              ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
              Others: {
                some: {
                  CustomerServiceuser: userName,
                },
              },
            },
          })
          .catch((err) => {
            this.logger.error(`Job count error for ${userName}: ${err.message}`);
            return 0;
          }),
      ),

      
      this.dbQueue.run(() =>
        this.db.houseJob
          .count({
            where: {
              CompanyMasterSid: companyMasterSid,
              status: 'A',
              HBLNo: { not: null },
              ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
              Others: {
                some: {
                  DocumentationUser: userName,
                },
              },
            },
          })
          .catch((err) => {
            this.logger.error(`BL count error for ${userName}: ${err.message}`);
            return 0;
          }),
      ),

      
      this.dbQueue.run(() =>
        this.db.houseJob
          .count({
            where: {
              CompanyMasterSid: companyMasterSid,
              status: 'A',
              ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
              Others: {
                some: {
                  DocumentationUser: userName,
                },
              },
            },
          })
          .catch((err) => {
            this.logger.error(`SI count error for ${userName}: ${err.message}`);
            return 0;
          }),
      ),

      this.dbQueue.run(() =>
        this.db.voucherHeader
          .count({
            where: {
              CompanyMasterSid: companyMasterSid,
              Status: 'A',
              CreatedBy: userEmail,
              voucherTypeMaster: {
                DocumentTypeName: 'Invoice',
              },
              ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
              ...(mode === 'Pending' && { PostStatus: { not: 'Posted' } }),
              ...(mode === 'Processed' && { PostStatus: 'Posted' }),
            },
          })
          .catch((err) => {
            this.logger.error(`Invoice count error for ${userName}: ${err.message}`);
            return 0;
          }),
      ),
    ]);

    return {
      RateRequest: rateRequestCount,
      Quotation: quotationCount,
      Booking: bookingCount,
      LoadPlan: loadPlanCount,
      MasterJob: masterJobCount,
      Job: jobCount,
      BL: blCount,
      SI: siCount,
      Invoice: invoiceCount,
    };
  }

  
  private async getAvailableUsers(): Promise<{ userSid: number; userName: string }[]> {
    const cacheKey = 'available_users';
    const cached = this.userCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const allUsers = await this.db.userMaster.findMany({
      where: { status: 'A' },
      select: { UserMasterSid: true, userName: true },
      orderBy: { UserMasterSid: 'desc' },
    });

    const seen = new Set<string>();
    const uniqueUsers = allUsers.filter((u) => {
      const key = u.userName.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const result = uniqueUsers.map((u) => ({
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
  ): Promise<WorkloadDetailResponse> {
    if (!companyMasterSid) companyMasterSid = 7;

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
      );
      data = result.data;
      total = result.total;
    } catch (error: any) {
      this.logger.error(
        `❌ Error fetching ${stage} workload: ${error.message}`,
      );
      throw new BadRequestException(
        `Failed to fetch ${stage} workload details`,
      );
    }

    const availableUsers = await this.getAvailableUsers();
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
      Job: this.getJobWorkload.bind(this),
      BL: this.getBLWorkload.bind(this),
      SI: this.getSIWorkload.bind(this),
      Invoice: this.getInvoiceWorkload.bind(this),
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
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      UserMasterSid: userSid,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') where.QuoteHeaderSid = null;
    else if (mode === 'Processed') where.QuoteHeaderSid = { not: null };

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
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      createdBy: user.userEmail,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') where.BookingHeaderSid = null;
    else if (mode === 'Processed') where.BookingHeaderSid = { not: null };

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
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      SalesmanSid: userSid,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') where.BookingStatus = { in: ['Pending', 'Hold'] };
    else if (mode === 'Processed') where.BookingStatus = { notIn: ['Pending', 'Hold'] };

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
      status:
        (b.BookingStatus && ['Pending', 'Hold'].includes(b.BookingStatus)
          ? 'Pending'
          : 'Processed') as 'Pending' | 'Processed',
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
  ): Promise<{ data: WorkloadRow[]; total: number }> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      Status: 'A',
      CreatedBy: user.userEmail,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;

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
        quotationNo: '',
        bookingNo: mj.MasterJobNumber || '',
        customerName: houseJob?.CustomerName || '',
        salesPersonName: '',
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

  private async getInvoiceWorkload(
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
      Status: 'A',
      CreatedBy: user.userEmail,
      voucherTypeMaster: {
        DocumentTypeName: 'Invoice',
      },
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') where.PostStatus = { not: 'Posted' };
    else if (mode === 'Processed') where.PostStatus = 'Posted';

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      this.db.voucherHeader.findMany({
        where,
        orderBy: { VoucherHeaderSid: 'desc' },
        skip,
        take: limit,
      }),
      this.db.voucherHeader.count({ where }),
    ]);

    const data = invoices.map((inv) => ({
      activityId: inv.VoucherHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'Invoice' as Stage,
      status: (inv.PostStatus === 'Posted' ? 'Processed' : 'Pending') as
        | 'Pending'
        | 'Processed',
      quotationNo: '',
      bookingNo: inv.HouseNumber || '',
      customerName: inv.PartyName || '',
      salesPersonName: user.userName,
      customerServiceName: '',
      documentationName: '',
      etd: '',
      createdOn: inv.CreatedOn
        ? moment(inv.CreatedOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
      updatedOn: inv.UpdatedOn
        ? moment(inv.UpdatedOn).format('YYYY-MM-DD HH:mm:ss')
        : '',
    }));

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
          await this.db.enquiryHeader.update({
            where: { EnquiryHeaderSid: allocationSid },
            data: { UserMasterSid: userSid },
          });
        }
      } else if (stage === 'Quotation') {
        if (userSid) {
          const newUser = await this.db.userMaster.findUnique({
            where: { UserMasterSid: userSid },
            select: { userEmail: true },
          });
          if (newUser) {
            await this.db.quoteHeader.update({
              where: { QuoteHeaderSid: allocationSid },
              data: { createdBy: newUser.userEmail },
            });
          }
        }
      } else if (stage === 'Booking' || stage === 'LoadPlan') {
        const data: any = {};
        if (userSid) data.SalesmanSid = userSid;
        if (status) data.BookingStatus = status;
        if (Object.keys(data).length) {
          await this.db.bookingHeader.update({
            where: { BookingHeaderSid: allocationSid },
            data,
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
      LoadPlan: r.loadPlanCount,
      MasterJob: r.masterJobCount,
      Job: r.jobCount,
      BL: r.blCount,
      SI: r.siCount,
      Invoice: r.invoiceCount,
      Total:
        r.rateRequestCount +
        r.quotationCount +
        r.bookingCount +
        r.loadPlanCount +
        r.masterJobCount +
        r.jobCount +
        r.blCount +
        r.siCount +
        r.invoiceCount,
    }));

    return {
      data,
      total: result.total,
      generatedDate: moment().format('YYYY-MM-DD HH:mm:ss'),
    };
  }

  // ─── Menu User Config ────────────────────────────────────────

  async getMenuUserConfig(
    companyMasterSid: number,
    branchMasterSid?: number,
  ) {
    try {
      const where: any = {
        CompanyMasterSid: companyMasterSid,
        Status: 'A',
      };
      if (branchMasterSid) {
        where.BranchMasterSid = branchMasterSid;
      }

      const configs = await (this.db as any).resourceConfiguration.findMany({
        where,
        include: {
          branchMaster: { select: { branchName: true, BranchMasterSid: true } },
          userMaster: { select: { userName: true, UserMasterSid: true } },
        },
        orderBy: { ResourceConfigurationSid: 'asc' },
      });

      return configs.map((c) => ({
        ResourceConfigurationSid: c.ResourceConfigurationSid,
        BranchMasterSid: c.BranchMasterSid,
        branchName: c.branchMaster?.branchName || '',
        stage: c.Stage,
        assignedRole: c.AssignedRole || null,
        UserMasterSid: c.UserMasterSid || null,
        userName: c.userMaster?.userName || '',
      }));
    } catch (error: any) {
      this.logger.error(`Error fetching menu user config: ${error.message}`);
      throw error;
    }
  }

  async saveMenuUserConfig(
    configs: {
      ResourceConfigurationSid?: number;
      BranchMasterSid: number;
      stage: string;
      assignedRole: string | null;
      UserMasterSid?: number;
    }[],
    companyMasterSid: number,
    userName: string,
  ) {
    try {
      const results: any[] = [];

      for (const cfg of configs) {
        if (cfg.ResourceConfigurationSid) {
          // Update existing
          const updated = await (this.db as any).resourceConfiguration.update({
            where: { ResourceConfigurationSid: cfg.ResourceConfigurationSid },
            data: {
              AssignedRole: cfg.assignedRole,
              UserMasterSid: cfg.UserMasterSid || null,
              UpdatedBy: userName,
              UpdatedOn: new Date(),
            },
          });
          results.push(updated);
        } else {
          // Upsert: check if exists for this branch+stage
          const existing = await (this.db as any).resourceConfiguration.findFirst({
            where: {
              CompanyMasterSid: companyMasterSid,
              BranchMasterSid: cfg.BranchMasterSid,
              Stage: cfg.stage,
              Status: 'A',
            },
          });

          if (existing) {
            const updated = await (this.db as any).resourceConfiguration.update({
              where: { ResourceConfigurationSid: existing.ResourceConfigurationSid },
              data: {
                AssignedRole: cfg.assignedRole,
                UserMasterSid: cfg.UserMasterSid || null,
                UpdatedBy: userName,
                UpdatedOn: new Date(),
              },
            });
            results.push(updated);
          } else {
            const created = await (this.db as any).resourceConfiguration.create({
              data: {
                CompanyMasterSid: companyMasterSid,
                BranchMasterSid: cfg.BranchMasterSid,
                Stage: cfg.stage,
                AssignedRole: cfg.assignedRole,
                UserMasterSid: cfg.UserMasterSid || null,
                CreatedBy: userName,
                Status: 'A',
              },
            });
            results.push(created);
          }
        }
      }

      return { success: true, count: results.length };
    } catch (error: any) {
      this.logger.error(`Error saving menu user config: ${error.message}`);
      throw error;
    }
  }

  // ─── CS Users ────────────────────────────────────────────────

  async getCSUsers(companyMasterSid?: number) {
    try {
      const where: any = {
        status: 'A',
        department: { hasSome: ['CS', 'Customer Service', 'Documentation', 'DOC'] },
      };

      const users = await this.db.userMaster.findMany({
        where,
        select: {
          UserMasterSid: true,
          userName: true,
          department: true,
        },
        orderBy: { userName: 'asc' },
      });

      return users.map((u) => ({
        userSid: u.UserMasterSid,
        userName: u.userName,
      }));
    } catch (error: any) {
      this.logger.error(`Error fetching CS users: ${error.message}`);
      throw error;
    }
  }

  // ─── Update CS Person ────────────────────────────────────────

  async updateCSPerson(
    activityId: number,
    csUserSid: number,
    updatedBy: string,
  ) {
    try {
      // Find the ActivityResourceAllocation record
      const record = await this.db.activityResourceAllocation.findUnique({
        where: { ActivityResourceAllocationSid: activityId },
      });

      if (!record) {
        throw new BadRequestException(
          `Activity allocation record ${activityId} not found`,
        );
      }

      // Verify the CS user exists
      const csUser = await this.db.userMaster.findUnique({
        where: { UserMasterSid: csUserSid },
        select: { UserMasterSid: true, userName: true },
      });

      if (!csUser) {
        throw new BadRequestException(`CS user ${csUserSid} not found`);
      }

      // Update BookingOthers or HouseJobOthers CustomerServiceuser (stored as userName string)
      if (record.BookingHeaderSid) {
        await this.db.bookingOthers.updateMany({
          where: { BookingHeaderSid: record.BookingHeaderSid },
          data: { CustomerServiceuser: csUser.userName },
        });
      }

      if (record.HouseJobSid) {
        await this.db.houseJobOthers.updateMany({
          where: { HouseJobSid: record.HouseJobSid },
          data: { CustomerServiceuser: csUser.userName },
        });
      }

      // Also update the allocation record's UpdatedBy/UpdatedOn
      await this.db.activityResourceAllocation.update({
        where: { ActivityResourceAllocationSid: activityId },
        data: {
          UpdatedBy: updatedBy,
          UpdatedOn: new Date(),
        },
      });

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
