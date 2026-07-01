import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CargoreceiptService {
  constructor(private _db: DatabaseService, private logger: Logger) { }

  async getLCLExportBookingById(BookingHeaderSid: number,CompanyMasterSid: number,BranchMasterSid: number) {
    try {
      const booking = await this._db.bookingHeader.findFirst({
        where: {
          BookingHeaderSid: BookingHeaderSid,
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: BranchMasterSid,
          departmentMaster: { ExportImport: 'Export', FCLLCL: 'LCL' },
          HBLNo: null,
          status: 'A',
        },
        select: {
          BookingHeaderSid: true,
          BookingNo: true,
          BookingDateTime: true,
          CustomerName: true,
          CustomerMasterSid: true,
          HBLNo: true,
          VesselName: true,
          VoyageNo: true,
          POO: true,
          POD: true,
          POL: true,
          FPD: true,
          departmentMaster: { select: { departmentName: true, DepartmentMasterSid: true } },
          bookingProduct: {
            select: {
              BookingProductSid: true,
              ProductName: true,
              ShippingBillNo: true,
              ShippingBillDate: true,
              ExternaPkg: true,
              ExternlQty: true,
              GrossWeight: true,
              NetWeight: true,
              Volume: true,
              CargoRecDate: true,
              CFS: true,
              RecdPack: true,
            },
          },
        },
      });

      if (!booking) {
            throw new UnauthorizedException('Access denied.');
          }

      // Format decimals and dates
      const formattedProducts = booking.bookingProduct.map(p => ({
        ...p,
        ExternlQty: p.ExternlQty != null ? p.ExternlQty.toString() : null,
        GrossWeight: p.GrossWeight != null ? Number(p.GrossWeight).toFixed(3) : null,
        NetWeight: p.NetWeight != null ? Number(p.NetWeight).toFixed(3) : null,
        Volume: p.Volume != null ? Number(p.Volume).toFixed(3) : null,
        CargoRecDate: p.CargoRecDate ? p.CargoRecDate.toISOString().split('T')[0] : null,
        RecdPack: p.RecdPack != null ? p.RecdPack.toString() : null,
      }));

      return { ...booking, bookingProduct: formattedProducts };
    } catch (error) {
      this.logger.error('Error fetching LCL Export Booking by ID', error);
      throw error;
    }
  }

  async updateBookingById(BookingHeaderSid: number, productsData: any[]) {
    try {
      const bookingHeader = await this._db.bookingHeader.findFirst({
        where: {
          BookingHeaderSid,
          HBLNo: null,
          departmentMaster: {
            ExportImport: 'Export',
            FCLLCL: 'LCL',
          },
        },
      });

      if (!bookingHeader) {
        // Return empty array with success
        return { success: true, message: 'No matching booking header', data: [] };
      }

      const updatedProducts = [];

      for (const productData of productsData) {
        const cargoRecDate = productData.CargoRecDate ? new Date(productData.CargoRecDate) : null;

        const updateData = {
          GrossWeight: productData.GrossWeight != null ? productData.GrossWeight.toString() : null,
          NetWeight: productData.NetWeight != null ? productData.NetWeight.toString() : null,
          ExternlQty: productData.ExternlQty != null ? productData.ExternlQty.toString() : null,
          Volume: productData.Volume != null ? productData.Volume.toString() : null,
          CargoRecDate: productData.CargoRecDate ? new Date(productData.CargoRecDate) : null,
          CFS: productData.CFS,
          RecdPack: productData.RecdPack != null ? productData.RecdPack.toString() : null,
          updatedBy: productData.updatedBy ?? null,
          updatedOn: new Date(),
        };

        // Match on the unique BookingProductSid. Matching on ShippingBillNo is unsafe
        // because it is often empty/duplicated, causing one product to overwrite another.
        if (productData.BookingProductSid == null) {
          continue;
        }

        const updateResult = await this._db.bookingProduct.updateMany({
          where: {
            BookingHeaderSid,
            status: 'A',
            BookingProductSid: Number(productData.BookingProductSid),
          },
          data: updateData,
        });

      }

      // Fetch final updated records
      const products = await this._db.bookingProduct.findMany({
        where: { BookingHeaderSid, status: 'A' },
        select: {
          BookingProductSid: true,
          ProductName: true,
          ShippingBillNo: true,
          ExternaPkg: true,
          ExternlQty: true,
          GrossWeight: true,
          NetWeight: true,
          Volume: true,
          CargoRecDate: true,
          CFS: true,
          RecdPack: true,
        },
      });

      const formattedProducts = products.map(p => ({
        ...p,
        ExternlQty: Number(p.ExternlQty),
        GrossWeight:p.GrossWeight != null ? Number(p.GrossWeight).toFixed(3) : null,
        NetWeight: p.NetWeight != null ? Number(p.NetWeight).toFixed(3) : null,
        Volume: p.Volume != null ? Number(p.Volume).toFixed(3) : null,
        CargoRecDate: p.CargoRecDate ? p.CargoRecDate.toISOString().split('T')[0] : null,
        CFS:p.CFS,
        RecdPack: Number(p.RecdPack),
      }));

      const headerUpdatedBy = productsData?.[0]?.updatedBy ?? null;

      const statusUpdatedBooking = await this._db.bookingHeader.update({
        where: {
          BookingHeaderSid: BookingHeaderSid
        },
        data: {
          BookingStatus: 'Cargo Received',
          updatedBy: headerUpdatedBy
        }
      })

      // Return success response to browser
      return {
        status: true,
        message: 'Booking products updated successfully',
        data: formattedProducts,
      };

    } catch (error) {
      this.logger.error('Unexpected error updating Booking by ID', error);
      // Throw as HTTP exception if needed
      throw new Error('Internal server error while updating booking products');
    }
  }



   async search(params: filterDto) {
    const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
    const skip = (page - 1) * pageSize;
    const dateFromRaw = (params as any).dateFrom ?? (params as any).DateFrom;
    const dateToRaw = (params as any).dateTo ?? (params as any).DateTo;
    const dateFieldRaw = (params as any).dateField ?? (params as any).DateField ?? 'BookingDateTime';
    const allowedDateFields = new Set(['BookingDateTime', 'MBLDate', 'ETD', 'ETA', 'HBLDate']);
    const dateField = allowedDateFields.has(dateFieldRaw) ? dateFieldRaw : 'BookingDateTime';
    const customerMasterSid = (params as any).CustomerMasterSid ?? (params as any).customerMasterSid ?? null;
    const departmentMasterSid = (params as any).DepartmentMasterSid ?? (params as any).departmentMasterSid ?? null;
    const pol = (params as any).POL ?? (params as any).pol ?? null;
    const pod = (params as any).POD ?? (params as any).pod ?? null;
    const dateRange: Prisma.DateTimeFilter = {};
    if (dateFromRaw) {
      const parsedFrom = new Date(dateFromRaw);
      if (!Number.isNaN(parsedFrom.getTime())) {
        dateRange.gte = parsedFrom;
      }
    }
    if (dateToRaw) {
      const parsedTo = new Date(dateToRaw);
      if (!Number.isNaN(parsedTo.getTime())) {
        dateRange.lte = parsedTo;
      }
    }

    const where: Prisma.BookingHeaderWhereInput = {
    CompanyMasterSid: activeCompanyId,
    BranchMasterSid: activeBranchId,
      status: 'A',
      HBLNo: null,
      ...(customerMasterSid ? { CustomerMasterSid: Number(customerMasterSid) } : {}),
      ...(departmentMasterSid ? { DepartmentMasterSid: Number(departmentMasterSid) } : {}),
      ...(pol ? { POL: String(pol) } : {}),
      ...(pod ? { POD: String(pod) } : {}),
      ...(Object.keys(dateRange).length ? { [dateField]: dateRange } : {}),
      departmentMaster: {
        ExportImport: 'Export',
        FCLLCL: 'LCL',
        departmentType:'Sea',
      },
      bookingProduct: {
    some: {
      status: 'A'
    }
  },
      ...(search
        ? {
          OR: [
            { departmentMaster: { departmentName: { contains: search, mode: 'insensitive' } } },
            { BookingNo: { contains: search, mode: 'insensitive' } },
            { CustomerName: { contains: search, mode: 'insensitive' } },
            { POO: { contains: search, mode: 'insensitive' } },
            { POL: { contains: search, mode: 'insensitive' } },
            { POD: { contains: search, mode: 'insensitive' } },
            { FPD: { contains: search, mode: 'insensitive' } },
            { status: { contains: search, mode: 'insensitive' } },
            { BookingStatus: { contains: search, mode: 'insensitive' } }
          ],
        }
        : {}
      ),
    };

    // First, get all bookings that match the basic criteria
    const allBookings = await this._db.bookingHeader.findMany({
      where,
      orderBy: { BookingDateTime: 'desc' },
      select: {
        BookingHeaderSid: true,
        BookingNo: true,
        BookingDateTime: true,
        CustomerName: true,
        VesselName: true,
        VoyageNo: true,
        POO: true,
        POL: true,
        POD: true,
        FPD: true,
        BookingStatus: true,
        departmentMaster: {
          select: {
            departmentName: true,
          }
        },
        status: true,
        bookingProduct: {
          select: {
            ProductName: true,
            ShippingBillNo: true,
            ExternaPkg: true,
            ExternlQty: true,
            GrossWeight: true,
            NetWeight: true,
            Volume: true,
            CargoRecDate: true,
            CFS: true,
            RecdPack: true,
          }
        }
      }
    });

    // Filter bookings based on status and recdPack logic
    const filteredBookings = allBookings.filter(booking => {
      // Only include 'Booked' and 'Cargo Received' statuses
      if (booking.BookingStatus === 'Booked') {
        return true;
      }
      
      // For 'Cargo Received' status, check the recdPack vs externlQty condition
      if (booking.BookingStatus === 'Cargo Received') {
        // Check if any product has recdPack < externlQty
        const hasIncompleteProducts = booking.bookingProduct.some(product => {
          const recdPack = Number(product.RecdPack) || 0;
          const externlQty = Number(product.ExternlQty) || 0;
          return recdPack < externlQty;
        });
        
        // Only include if there are incomplete products
        return hasIncompleteProducts;
      }
      
      // Exclude all other statuses (including 'Stuffed')
      return false;
    });

    // Apply pagination to the filtered results
    const paginatedItems = filteredBookings.slice(skip, skip + pageSize);
    const totalCount = filteredBookings.length;

    return {
      items: paginatedItems,
      totalCount,
    };
  }
}
