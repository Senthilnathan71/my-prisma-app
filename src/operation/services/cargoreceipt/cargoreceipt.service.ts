import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class CargoreceiptService {
  constructor(private _db: DatabaseService, private logger: Logger) { }

  async getLCLExportBookingById(BookingHeaderSid: number) {
    try {
      const booking = await this._db.bookingHeader.findFirst({
        where: {
          BookingHeaderSid,
          departmentMaster: {
            ExportImport: 'Export',
            FCLLCL: 'LCL',
          },
          HBLNo: null,
          status: 'A'
        },
        select: {
          BookingHeaderSid: true,
          BookingNo: true,
          BookingDateTime: true,
          departmentMaster: {
            select: {
              departmentName: true,
            }
          },
          CustomerName: true,
          HBLNo: true,
          VesselName: true,
          VoyageNo: true,
          POO: true,
          POD: true,
          POL: true,
          FPD: true,
          bookingProduct: {
            select: {
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
            }
          }
        },
      });
      return booking;
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
          GrossWeight: productData.GrossWeight?.toString(),
          NetWeight: productData.NetWeight?.toString(),
          ExternlQty: productData.ExternlQty?.toString(),
          Volume: productData.Volume?.toString(),
          CargoRecDate: cargoRecDate,
        };

        const updateResult = await this._db.bookingProduct.updateMany({
          where: {
            BookingHeaderSid,
            status: 'A',
            ShippingBillNo: productData.ShippingBillNo,
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
        GrossWeight: Number(p.GrossWeight),
        NetWeight: Number(p.NetWeight),
        Volume: Number(p.Volume),
        CargoRecDate: p.CargoRecDate ? p.CargoRecDate.toISOString().split('T')[0] : null,
      }));

      const statusUpdatedBooking = await this._db.bookingHeader.update({
        where: {
          BookingHeaderSid: BookingHeaderSid
        },
        data: {
          BookingStatus: 'Cargo Received'
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
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BookingHeaderWhereInput = {
      status: 'A',
      HBLNo: null,
      departmentMaster: {
        ExportImport: 'Export',
        FCLLCL: 'LCL',
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
            { status: { contains: search, mode: 'insensitive' } }
          ],
        }
        : {}
      ),
    };

    const [items, totalCount] = await this._db.$transaction([
      this._db.bookingHeader.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { BookingDateTime: 'asc' },
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
      }),
      this._db.bookingHeader.count({ where }),
    ]);

    return {
      items,
      totalCount,
    }
  }
}
