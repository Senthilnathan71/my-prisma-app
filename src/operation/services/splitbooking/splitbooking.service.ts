import { BadRequestException, Injectable } from '@nestjs/common';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment';

@Injectable()
export class SplitbookingService {
    constructor(
        private _db: DatabaseService,
        private globalConfigService: GlobalConfigService
    ) { }

    async getAllBookings(payload: any){
        try {
            let whereClause = {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                DepartmentMasterSid: payload.DepartmentMasterSid,
                status: 'A'
            };
            if(payload.isFilteringRequired){
                whereClause['BookingStatus'] = "Cargo Received";
            } else {
                whereClause['BookingStatus'] = "Booked";
            }

            const allBookings = await this._db.bookingHeader.findMany({
                where: whereClause,
                include: {
                    bookingProduct: true
                },
                orderBy : {
                    BookingHeaderSid : 'desc'
                }
            })

           const enrichedItems = await Promise.all(
        allBookings.map(async (item) => {
          const salesman = item.SalesmanSid
            ? await this.globalConfigService.getMasterData('user_master', item.SalesmanSid)
            : { UserMasterSid: null, userName: '' };

          return {
            BookingHeaderSid: item.BookingHeaderSid,
            CustomerMasterSid: item.CustomerMasterSid,
            ShipperName: item.ShipperName || '',
            ConsigneeName: item.ConsigneeName || '',
            POL: item.POL || '',
            POD: item.POD || '',
            FPD: item.FPD || null,
            DepartmentMasterSid: item.DepartmentMasterSid,
            bookingProduct: item.bookingProduct || [],
            salesman
          };
        })
      );

      return enrichedItems;
    } catch (error) {
      throw error;
    }
  }

  // Split booking
  // Split booking
async splitBooking(payload: SplitDTO) {
  const { bookingSid, selectedProducts } = payload;

  // Normalize splitType to handle case variations
  const normalizedProducts = selectedProducts.map(prod => ({
    ...prod,
    splitType: prod.splitType.toLowerCase() as 'full' | 'part'
  }));

  // 1. Fetch total products
const totalProducts = await this._db.bookingProduct.count({
  where: { BookingHeaderSid: bookingSid }
});

// 2. Only block if all products are selected AND all are full split
const allSelected = normalizedProducts.length === totalProducts;
const allFullSelected = normalizedProducts.every(p => p.splitType === 'full');

if (allSelected && allFullSelected) {
  throw new BadRequestException(
    'You cannot split all products fully. At least one product must remain.'
  );
}


  // 3. Fetch parent booking
  const parentBooking = await this._db.bookingHeader.findUnique({
    where: { BookingHeaderSid: bookingSid },
    include: { bookingProduct: true }
  });

  if (!parentBooking) throw new BadRequestException('Booking not found');

  // 4. Create new booking
  const newBooking = await this._db.bookingHeader.create({
    data: {
      ...parentBooking,
      BookingHeaderSid: undefined,
      BookingNo: await this.generateNewBookingNo(),
      bookingProduct: undefined
    }
  });

  const updatedOldProducts: any[] = [];
  const newProducts: any[] = [];

  for (const prod of normalizedProducts) {
    const oldProduct = await this._db.bookingProduct.findUnique({
      where: { BookingProductSid: prod.BookingProductSid }
    });
    if (!oldProduct) continue;

    // 5. Handle full split
    if (prod.splitType === 'full') {
      const moved = await this._db.bookingProduct.update({
        where: { BookingProductSid: prod.BookingProductSid },
        data: { BookingHeaderSid: newBooking.BookingHeaderSid }
      });
      newProducts.push(moved);
    } 
    // 6. Handle partial split
    else if (prod.splitType === 'part') {
      if (!prod.PartPackages || !prod.PartGrossWeight || !prod.PartCBM) {
        throw new BadRequestException(
          'Part split requires package, weight and CBM values'
        );
      }

      // Validate quantities
      if (
        prod.PartPackages > Number(oldProduct.ExternlQty) ||
        prod.PartGrossWeight > Number(oldProduct.GrossWeight) ||
        prod.PartCBM > Number(oldProduct.Volume)
      ) {
        throw new BadRequestException(
          'Part quantities cannot exceed original product quantities'
        );
      }

      // Reduce old product
      const reduced = await this._db.bookingProduct.update({
        where: { BookingProductSid: prod.BookingProductSid },
        data: {
          ExternlQty: String(Number(oldProduct.ExternlQty) - prod.PartPackages),
          GrossWeight: String(Number(oldProduct.GrossWeight) - prod.PartGrossWeight),
          Volume: String(Number(oldProduct.Volume) - prod.PartCBM)
        }
      });
      updatedOldProducts.push(reduced);

      // Add new product to new booking
      const newProduct = await this._db.bookingProduct.create({
        data: {
          ...oldProduct,
          BookingProductSid: undefined,
          BookingHeaderSid: newBooking.BookingHeaderSid,
          ExternlQty: String(prod.PartPackages),
          GrossWeight: String(prod.PartGrossWeight),
          Volume: String(prod.PartCBM)
        }
      });
      newProducts.push(newProduct);
    }
  }

  const enrichedNewBooking = await this._db.bookingHeader.findUnique({
    where: { BookingHeaderSid: newBooking.BookingHeaderSid },
    include: { bookingProduct: true }
  });

  return {
    message: 'Split booking created successfully',
    newBooking: enrichedNewBooking,
    updatedOldProducts
  };
}


  private async generateNewBookingNo(): Promise<string> {
    const dateString = moment().format('YYYYMMDD');
    const count = await this._db.bookingHeader.count({
      where: { BookingNo: { contains: dateString } }
    });
    return `booking-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
  }
}

export interface SplitDTO {
  bookingSid: number;
  selectedProducts: {
    BookingProductSid: number;
    splitType: 'Full' | 'Part';
    PartPackages?: number;
    PartGrossWeight?: number;
    PartCBM?: number;
  }[];
}