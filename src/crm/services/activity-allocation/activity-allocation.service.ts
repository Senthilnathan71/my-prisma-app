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
  availableUsers: { userSid: number; userName: string }[];
}

@Injectable()
export class ActivityAllocationService {
  private logger = new Logger(ActivityAllocationService.name);

  constructor(private readonly db: DatabaseService) {}

  async getSummary(
    mode: string = 'Pending',
    search?: string,
    companyMasterSid?: number,
    branchMasterSid?: number,
  ): Promise<{ data: SummaryRow[]; total: number }> {
    const startTime = Date.now();

    if (!companyMasterSid) companyMasterSid = 7;

    const summary = await this.buildSummaryOptimized(
      companyMasterSid,
      branchMasterSid,
      mode as SummaryMode,
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
    this.logger.log(`✅ Summary loaded in ${duration}ms for ${summary.length} users`);

    if (duration > 3000) {
      this.logger.warn(`⚠️ Slow query detected: ${duration}ms`);
    }

    return { data: summary, total };
  }

  private async buildSummaryOptimized(
    companyMasterSid: number,
    branchMasterSid: number | undefined,
    mode: SummaryMode,
    search?: string,
  ): Promise<SummaryRow[]> {
    let users = await this.db.userMaster.findMany({
      where: { status: 'A' },
      select: { UserMasterSid: true, userName: true, userEmail: true },
      orderBy: { userName: 'asc' },
    });

    if (search && search.trim()) {
      const q = search.toLowerCase();
      users = users.filter((u) => u.userName.toLowerCase().includes(q));
    }

    const countsPromises = users.map((u) =>
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
            `Error getting counts for user ${u.userName}: ${error.message}`,
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
    );

    const results = await Promise.all(countsPromises);

    const rows: SummaryRow[] = [];

    for (const { user: u, counts } of results) {
      if (
        counts.RateRequest > 0 ||
        counts.Quotation > 0 ||
        counts.Booking > 0 ||
        counts.LoadPlan > 0 ||
        counts.MasterJob > 0 ||
        counts.Job > 0 ||
        counts.BL > 0 ||
        counts.SI > 0 ||
        counts.Invoice > 0
      ) {
        rows.push({
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
        });
      }
    }

    return rows;
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
    const baseCompanyWhere: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
    };
    if (branchMasterSid) {
      baseCompanyWhere.BranchMasterSid = branchMasterSid;
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
      this.db.enquiryHeader
        .count({
          where: {
            ...baseCompanyWhere,
            UserMasterSid: userSid,
            ...(mode === 'Processed' && { QuoteHeaderSid: { not: null } }),
            ...(mode === 'Pending' && { QuoteHeaderSid: null }),
          },
        })
        .catch(() => 0),

      this.db.quoteHeader
        .count({
          where: {
            ...baseCompanyWhere,
            createdBy: userEmail,
            ...(mode === 'Processed' && { BookingHeaderSid: { not: null } }),
            ...(mode === 'Pending' && { BookingHeaderSid: null }),
          },
        })
        .catch(() => 0),

      this.db.bookingHeader
        .count({
          where: {
            ...baseCompanyWhere,
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

      this.db.bookingHeader
        .count({
          where: {
            ...baseCompanyWhere,
            SalesmanSid: userSid,
            MBLNo: null,
            MasterNoSid: null,
            BookingStatus: { in: ['Booked', 'Cargo Received'] },
          },
        })
        .catch(() => 0),

      this.db.masterJob
        .count({
          where: {
            CompanyMasterSid: companyMasterSid,
            Status: 'A',
            ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
            houseJob: {
              some: {
                status: 'A',
                Others: {
                  some: {
                    OperationUser: userName,
                  },
                },
              },
            },
          },
        })
        .catch(() => 0),

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
        .catch(() => 0),

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
        .catch(() => 0),

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
        .catch(() => 0),

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
        .catch(() => 0),
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

  async getWorkloadDetails(
    userSid: number,
    stage: Stage,
    mode: SummaryMode = 'Pending',
    companyMasterSid?: number,
    branchMasterSid?: number,
  ): Promise<WorkloadDetailResponse> {
    if (!companyMasterSid) companyMasterSid = 7;

    const user = await this.db.userMaster.findUnique({
      where: { UserMasterSid: userSid },
      select: { userName: true, userEmail: true },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    let data: WorkloadRow[] = [];

    try {
      if (stage === 'RateRequest') {
        data = await this.getEnquiryWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      } else if (stage === 'Quotation') {
        data = await this.getQuotationWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      } else if (stage === 'Booking') {
        data = await this.getBookingWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      } else if (stage === 'LoadPlan') {
        data = await this.getLoadPlanWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      } else if (stage === 'MasterJob') {
        data = await this.getMasterJobWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      } else if (stage === 'Job') {
        data = await this.getJobWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      } else if (stage === 'BL') {
        data = await this.getBLWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      } else if (stage === 'SI') {
        data = await this.getSIWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      } else if (stage === 'Invoice') {
        data = await this.getInvoiceWorkload(
          userSid,
          user,
          mode,
          companyMasterSid,
          branchMasterSid,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error fetching workload details for ${stage}: ${error.message}`,
      );
      throw new BadRequestException(
        `Failed to fetch ${stage} workload details`,
      );
    }

    const availableUsers = await this.db.userMaster.findMany({
      where: { status: 'A' },
      select: { UserMasterSid: true, userName: true },
      orderBy: { userName: 'asc' },
    });

    return {
      data,
      availableUsers: availableUsers.map((u) => ({
        userSid: u.UserMasterSid,
        userName: u.userName,
      })),
    };
  }

  private async getEnquiryWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      UserMasterSid: userSid,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') {
      where.QuoteHeaderSid = null;
    } else if (mode === 'Processed') {
      where.QuoteHeaderSid = { not: null };
    }

    const enquiries = await this.db.enquiryHeader.findMany({
      where,
      orderBy: { EnquiryHeaderSid: 'desc' },
      take: 100,
    });

    return enquiries.map((e) => ({
      activityId: e.EnquiryHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'RateRequest' as Stage,
      status: e.QuoteHeaderSid ? 'Processed' : 'Pending',
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
  }

  private async getQuotationWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      createdBy: user.userEmail,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') {
      where.BookingHeaderSid = null;
    } else if (mode === 'Processed') {
      where.BookingHeaderSid = { not: null };
    }

    const quotes = await this.db.quoteHeader.findMany({
      where,
      orderBy: { QuoteHeaderSid: 'desc' },
      take: 100,
      include: {
        bookingHeader: {          
          select: { BookingNo: true },
        },
      },
    });

    return quotes.map((q) => ({
      activityId: q.QuoteHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'Quotation' as Stage,
      status: q.BookingHeaderSid ? 'Processed' : 'Pending',
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
  }

  private async getBookingWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      SalesmanSid: userSid,
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') {
      where.BookingStatus = { in: ['Pending', 'Hold'] };
    } else if (mode === 'Processed') {
      where.BookingStatus = { notIn: ['Pending', 'Hold'] };
    }

    const bookings = await this.db.bookingHeader.findMany({
      where,
      orderBy: { BookingHeaderSid: 'desc' },
      take: 100,
      include: {
        quotationHeader: {
          select: { QuoteNumber: true },
        },
      },
    });

    return bookings.map((b) => ({
      activityId: b.BookingHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'Booking' as Stage,
      status:
        b.BookingStatus && ['Pending', 'Hold'].includes(b.BookingStatus)
          ? 'Pending'
          : 'Processed',
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
  }

  private async getLoadPlanWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      SalesmanSid: userSid,
      MBLNo: null,
      MasterNoSid: null,
      BookingStatus: { in: ['Booked', 'Cargo Received'] },
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;

    const bookings = await this.db.bookingHeader.findMany({
      where,
      orderBy: { BookingHeaderSid: 'desc' },
      take: 100,
      include: {
        quotationHeader: {
          select: { QuoteNumber: true },
        },
      },
    });

    return bookings.map((b) => ({
      activityId: b.BookingHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'LoadPlan' as Stage,
      status: 'Pending',
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
  }

  private async getInvoiceWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
    const where: any = {
      CompanyMasterSid: companyMasterSid,
      Status: 'A',
      CreatedBy: user.userEmail,
      voucherTypeMaster: {
        DocumentTypeName: 'Invoice',
      },
    };
    if (branchMasterSid) where.BranchMasterSid = branchMasterSid;
    if (mode === 'Pending') {
      where.PostStatus = { not: 'Posted' };
    } else if (mode === 'Processed') {
      where.PostStatus = 'Posted';
    }

    const invoices = await this.db.voucherHeader.findMany({
      where,
      orderBy: { VoucherHeaderSid: 'desc' },
      take: 100,
    });

    return invoices.map((inv) => ({
      activityId: inv.VoucherHeaderSid,
      userSid,
      userName: user.userName,
      stage: 'Invoice' as Stage,
      status: inv.PostStatus === 'Posted' ? 'Processed' : 'Pending',
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
  }

  private async getMasterJobWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
    const masterJobs = await this.db.masterJob.findMany({
      where: {
        CompanyMasterSid: companyMasterSid,
        Status: 'A',
        ...(branchMasterSid ? { BranchMasterSid: branchMasterSid } : {}),
        houseJob: {
          some: {
            status: 'A',
            Others: {
              some: {
                OperationUser: user.userName,
              },
            },
          },
        },
      },
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
      take: 100,
    });

    return masterJobs.map((mj) => {
      const houseJob = mj.houseJob?.[0];
      const voyage = mj.voyages?.[0];

      return {
        activityId: mj.MasterJobSid,
        userSid,
        userName: user.userName,
        stage: 'MasterJob' as Stage,
        status: 'Pending',
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
  }

  private async getJobWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
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

    const jobs = await this.db.houseJob.findMany({
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
      take: 100,
    });

    return jobs.map((j) => ({
      activityId: j.HouseJobSid,
      userSid,
      userName: user.userName,
      stage: 'Job' as Stage,
      status:
        j.HBLNo && !j.HBLNo.startsWith('HOUSE-') ? 'Processed' : 'Pending',
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
  }

  private async getBLWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
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

    const bls = await this.db.houseJob.findMany({
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
      take: 100,
    });

    return bls.map((bl) => {
      const others = bl.Others?.[0];
      return {
        activityId: bl.HouseJobSid,
        userSid,
        userName: user.userName,
        stage: 'BL' as Stage,
        status:
          others?.ReleaseType && others?.BacktoBack ? 'Processed' : 'Pending',
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
  }

  private async getSIWorkload(
    userSid: number,
    user: { userName: string; userEmail: string },
    mode: SummaryMode,
    companyMasterSid: number,
    branchMasterSid?: number,
  ): Promise<WorkloadRow[]> {
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

    const sis = await this.db.houseJob.findMany({
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
      take: 100,
    });

    return sis.map((si) => {
      const others = si.Others?.[0];
      return {
        activityId: si.HouseJobSid,
        userSid,
        userName: user.userName,
        stage: 'SI' as Stage,
        status: others?.PickupDate ? 'Processed' : 'Pending',
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
  }

  async updateActivityAllocation(
    allocationSid: number,
    stage: Stage,
    payload: { status?: string; userSid?: number },
  ) {
    const { userSid, status } = payload;

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
          select: { userName: true },
        });

        if (newUser) {
          const masterJob = await this.db.masterJob.findUnique({
            where: { MasterJobSid: allocationSid },
            include: {
              houseJob: {
                where: { status: 'A' },
                select: { HouseJobSid: true },
              },
            },
          });

          if (masterJob?.houseJob) {
            for (const house of masterJob.houseJob) {
              await this.db.houseJobOthers.updateMany({
                where: { HouseJobSid: house.HouseJobSid },
                data: { OperationUser: newUser.userName },
              });
            }
          }
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

    return { success: true, message: `${stage} updated successfully` };
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
}
