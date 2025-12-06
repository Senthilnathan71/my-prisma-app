import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

type PipelineMode = 'pending' | 'processed' | 'all';

interface ResourceSummaryRow {
  userId: number;
  userName: string;
  rateRequests: number;
  quotations: number;
  bookings: number;
  jobs: number;
  invoices: number;
}

@Injectable()
export class ActivityAllocationService {
  constructor(private readonly db: DatabaseService) {}



  async getPipelineCountsByUser(options: {
    mode?: PipelineMode;
    fromDate?: Date;
    toDate?: Date;
    userId?: number;
  }): Promise<ResourceSummaryRow[]> {
    const mode: PipelineMode = options.mode || 'pending';
    const { fromDate, toDate, userId } = options;

    
    const users = await this.db.userMaster.findMany({
      where: {
        status: 'A',
        ...(userId && { UserMasterSid: userId }),
      },
      select: {
        UserMasterSid: true,
        userName: true,
      },
    });

   
    const results: ResourceSummaryRow[] = [];

    for (const user of users) {
      const [rateRequests, quotations, bookings, jobs, invoices] =
        await Promise.all([
          this.countStageForUser(user.UserMasterSid, 'RATE_REQUEST', mode, fromDate, toDate),
          this.countStageForUser(user.UserMasterSid, 'QUOTATION', mode, fromDate, toDate),
          this.countStageForUser(user.UserMasterSid, 'BOOKING', mode, fromDate, toDate),
          this.countStageForUser(user.UserMasterSid, 'JOB', mode, fromDate, toDate),
          this.countStageForUser(user.UserMasterSid, 'INVOICE', mode, fromDate, toDate),
        ]);

      if (rateRequests || quotations || bookings || jobs || invoices) {
        results.push({
          userId: user.UserMasterSid,
          userName: user.userName,
          rateRequests,
          quotations,
          bookings,
          jobs,
          invoices,
        });
      }
    }

    return results;
  }

  private async countStageForUser(
    userId: number,
    stage:
      | 'RATE_REQUEST'
      | 'QUOTATION'
      | 'BOOKING'
      | 'JOB'
      | 'INVOICE',
    mode: PipelineMode,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<number> {
    const where: any = {
     
      UserMasterSid: userId,
    };

    switch (stage) {
      case 'RATE_REQUEST':
        where.EnquiryHeaderSid = { not: null };
        break;
      case 'QUOTATION':
        where.QuoteHeaderSid = { not: null };
        break;
      case 'BOOKING':
        where.BookingHeaderSid = { not: null };
        break;
      case 'JOB':
        where.HouseJobSid = { not: null };
        break;
      case 'INVOICE':
        where.VoucherHeaderSid = { not: null };
        break;
    }

    if (mode === 'pending') {
    } else if (mode === 'processed') {
    }

    if (fromDate || toDate) {
      where.CreatedOn = {};
      if (fromDate) where.CreatedOn.gte = fromDate;
      if (toDate) where.CreatedOn.lte = toDate;
    }

    return (this.db as any).activityResourceAllocation.count({ where });
  }


  async getDashboardData() {
    const [resourceSummary, userUpdate, menuWiseUser, workLoadDetail] =
      await Promise.all([
        this.getResourceSummary('pending'),
        this.getUserUpdate(7),
        this.getMenuWiseUser(),
        this.getWorkLoadDetail(1, 10),
      ]);

    const items = workLoadDetail.items || [];
    const totalItems = items.length;
    const pendingItems = items.filter(
      (x) => x.status === 'Not Allocated' || x.status === 'Partially Allocated',
    ).length;
    const processedItems = items.filter(
      (x) => x.status === 'Fully Allocated',
    ).length;
    const completionRate =
      totalItems === 0 ? 0 : Math.round((processedItems / totalItems) * 100);

    const metrics = {
      totalItems,
      pendingItems,
      processedItems,
      completionRate,
    };

    return {
      resourceSummary,  
      userUpdate,
      menuWiseUser,
      workLoadDetail,    
      metrics,
    };
  }

  async getResourceSummary(mode: PipelineMode = 'pending') {
    return this.getPipelineCountsByUser({ mode });
  }

  async getUserUpdate(days = 7) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    return this.getPipelineCountsByUser({ mode: 'all', fromDate });
  }

  async getMenuWiseUser() {
    const data = await this.getPipelineCountsByUser({ mode: 'pending' });

    return [
      {
        stage: 'Rate Request',
        userCount: data.filter((u) => u.rateRequests > 0).length,
        pendingCount: data.reduce((sum, u) => sum + u.rateRequests, 0),
      },
      {
        stage: 'Quotation',
        userCount: data.filter((u) => u.quotations > 0).length,
        pendingCount: data.reduce((sum, u) => sum + u.quotations, 0),
      },
      {
        stage: 'Booking',
        userCount: data.filter((u) => u.bookings > 0).length,
        pendingCount: data.reduce((sum, u) => sum + u.bookings, 0),
      },
      {
        stage: 'Job',
        userCount: data.filter((u) => u.jobs > 0).length,
        pendingCount: data.reduce((sum, u) => sum + u.jobs, 0),
      },
      {
        stage: 'Invoice',
        userCount: data.filter((u) => u.invoices > 0).length,
        pendingCount: data.reduce((sum, u) => sum + u.invoices, 0),
      },
    ];
  }

 
  async getWorkLoadDetail(page = 1, pageSize = 10) {
    const p = page < 1 ? 1 : page;
    const size = pageSize < 1 ? 10 : pageSize;

    const [bookings, total] = await Promise.all([
      this.db.bookingHeader.findMany({
        where: { status: 'A' },
        select: {
          BookingHeaderSid: true,
          BookingNo: true,
          CustomerName: true,
          DepartmentMasterSid: true,
          POL: true,
          POD: true,
          BookingStatus: true,
        },
        orderBy: { BookingHeaderSid: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.db.bookingHeader.count({ where: { status: 'A' } }),
    ]);

    if (!bookings.length) {
      return { items: [], total };
    }

    const ids = bookings.map((b) => b.BookingHeaderSid);
    const others = await this.db.bookingOthers.findMany({
      where: { BookingHeaderSid: { in: ids }, status: 'A' },
      select: {
        BookingOthersSid: true,
        BookingHeaderSid: true,
        CustomerServiceuser: true,
        DocumentationUser: true,
      },
    });

    const othersBySid = new Map<number, { cs?: string | null; doc?: string | null }>();
    others.forEach((o) => {
      if (o.BookingHeaderSid != null) {
        othersBySid.set(o.BookingHeaderSid, {
          cs: o.CustomerServiceuser ?? null,
          doc: o.DocumentationUser ?? null,
        });
      }
    });

    const items = bookings.map((b) => {
      const o =
        b.BookingHeaderSid != null
          ? othersBySid.get(b.BookingHeaderSid) || {}
          : {};
      const status = this.getAllocationStatus(o.cs, o.doc);

      return {
        id: b.BookingHeaderSid,
        bookingHeaderSid: b.BookingHeaderSid,
        quotationNo: null,             
        bookingNo: b.BookingNo,
        customer: b.CustomerName,
        salesPerson: 'Unassigned',
        csUser: o.cs || null,
        docUser: o.doc || null,
        status,
      };
    });

    return { items, total };
  }

  private getAllocationStatus(
    csUser?: string | null,
    docUser?: string | null,
  ): string {
    if (csUser && docUser) return 'Fully Allocated';
    if (csUser || docUser) return 'Partially Allocated';
    return 'Not Allocated';
  }

 
  async searchWorkload(query: string, page = 1, pageSize = 10) {
    const term = (query || '').trim();
    const p = page < 1 ? 1 : page;
    const size = pageSize < 1 ? 10 : pageSize;

    if (!term) {
      return this.getWorkLoadDetail(p, size);
    }

    const [bookings, total] = await Promise.all([
      this.db.bookingHeader.findMany({
        where: {
          status: 'A',
          OR: [
            { BookingNo: { contains: term, mode: 'insensitive' } },
            { CustomerName: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          BookingHeaderSid: true,
          BookingNo: true,
          CustomerName: true,
          DepartmentMasterSid: true,
          POL: true,
          POD: true,
          BookingStatus: true,
        },
        orderBy: { BookingHeaderSid: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.db.bookingHeader.count({
        where: {
          status: 'A',
          OR: [
            { BookingNo: { contains: term, mode: 'insensitive' } },
            { CustomerName: { contains: term, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    if (!bookings.length) {
      return { items: [], total };
    }

    const ids = bookings.map((b) => b.BookingHeaderSid);
    const others = await this.db.bookingOthers.findMany({
      where: { BookingHeaderSid: { in: ids }, status: 'A' },
      select: {
        BookingHeaderSid: true,
        CustomerServiceuser: true,
        DocumentationUser: true,
      },
    });

    const othersBySid = new Map<number, { cs?: string | null; doc?: string | null }>();
    others.forEach((o) => {
      if (o.BookingHeaderSid != null) {
        othersBySid.set(o.BookingHeaderSid, {
          cs: o.CustomerServiceuser ?? null,
          doc: o.DocumentationUser ?? null,
        });
      }
    });

    const items = bookings.map((b) => {
      const o =
        b.BookingHeaderSid != null
          ? othersBySid.get(b.BookingHeaderSid) || {}
          : {};
      const status = this.getAllocationStatus(o.cs, o.doc);

      return {
        id: b.BookingHeaderSid,
        bookingHeaderSid: b.BookingHeaderSid,
        quotationNo: null,
        bookingNo: b.BookingNo,
        customer: b.CustomerName,
        salesPerson: 'Unassigned',
        csUser: o.cs || null,
        docUser: o.doc || null,
        status,
      };
    });

    return { items, total };
  }

 

  async allocateItems(dto: {
    itemIds: number[];
    stage: 'Quotation' | 'Booking' | 'Job';
    csUser?: string;
    docUser?: string;
    operationUser?: string;
  }) {
    const { itemIds, stage, csUser, docUser, operationUser } = dto;

    if (!itemIds?.length) {
      throw new BadRequestException('No items selected for allocation');
    }

    if (stage === 'Booking') {
      for (const id of itemIds) {
        const existing = await this.db.bookingOthers.findFirst({
          where: { BookingHeaderSid: id, status: 'A' },
          select: { BookingOthersSid: true },
        });

        if (existing) {
          await this.db.bookingOthers.update({
            where: { BookingOthersSid: existing.BookingOthersSid },
            data: {
              CustomerServiceuser: csUser ?? null,
              DocumentationUser: docUser ?? null,
            },
          });
        } else {
          await this.db.bookingOthers.create({
            data: {
              BookingHeaderSid: id,
              CustomerServiceuser: csUser ?? null,
              DocumentationUser: docUser ?? null,
              status: 'A',
              createdOn: new Date(),
            } as any,
          });
        }
      }
    }

    if (stage === 'Job') {
      for (const id of itemIds) {
        const existing = await this.db.houseJobOthers.findFirst({
          where: { HouseJobSid: id },
          select: { HouseJobOthersSid: true },
        });

        if (existing) {
          await this.db.houseJobOthers.update({
            where: { HouseJobOthersSid: existing.HouseJobOthersSid },
            data: {
              CustomerServiceuser: csUser ?? null,
              DocumentationUser: docUser ?? null,
              OperationUser: operationUser ?? null,
            },
          });
        } else {
          await this.db.houseJobOthers.create({
            data: {
              HouseJobSid: id,
              CustomerServiceuser: csUser ?? null,
              DocumentationUser: docUser ?? null,
              OperationUser: operationUser ?? null,
              status: 'A',
              createdOn: new Date(),
            } as any,
          });
        }
      }
    }

    if (stage === 'Quotation') {
      
    }

    return {
      success: true,
      message: 'Items allocated successfully',
    };
  }
}
