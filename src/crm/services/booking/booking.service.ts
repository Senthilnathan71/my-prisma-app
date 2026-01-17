import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';

@Injectable()
export class BookingService {
  constructor(
    private db: DatabaseService,
    private logger: Logger,
    private numberSeriesService: NumberSeriesService,
  ) { }

  async create(payload, user) {
    try {
      const CompanyMasterSid = Number(user.userBranchMaster[0]?.CompanyMasterSid);
      const BranchMasterSid = Number(user.userBranchMaster[0]?.BranchMasterSid);
      const DepartmentMasterSid = Number(payload.DepartmentMasterSid);

      // Get MenuMasterSid for Booking (look up by code or use provided value)
      let MenuMasterSid = payload.MenuMasterSid;
      if (!MenuMasterSid) {
        const bookingMenu = await this.db.menuMaster.findFirst({
          where: {
            OR: [
              { MenuCode: 'BKN' },
              { MenuCode: 'BK' },
              { MenuName: { contains: 'booking', mode: 'insensitive' } }
            ],
            status: 'A'
          }
        });
        MenuMasterSid = bookingMenu?.MenuMasterSid;
      }

      // Generate booking number using NumberSeriesService
      let bookingNo: string | null = null;
      if (MenuMasterSid) {
        bookingNo = await this.numberSeriesService.generateNextNumber(
          CompanyMasterSid,
          BranchMasterSid,
          MenuMasterSid,
          DepartmentMasterSid
        );
      }

      return await this.db.$transaction(async (prisma) => {
        // Step 1: Create Booking Header
        const bookingHeaderPayload: any = {
          DepartmentMasterSid: DepartmentMasterSid,
          CustomerMasterSid: Number(user.UserMasterSid),
          CompanyMasterSid: CompanyMasterSid,
          ShipmentType: payload.ShipmentType,
          createdBy: user['userEmail'],
          BookingNo: bookingNo,
          ETA: payload.ETA,
          ETD: payload.ETD,
          POL: payload.from,
          POD: payload.to,
          IncoTerms: payload.IncoTerms,
          FreightTerms: payload.FreightTerms
        };

        const bookingHeader = await prisma.bookingHeader.create({
          data: bookingHeaderPayload
        });

        const bookingCargoPayload = {
          BookingHeaderSid: bookingHeader.BookingHeaderSid,
          CompanyMasterSid: bookingHeader.CompanyMasterSid,
          CargoType: payload.CargoType,
          GrossWeight: Number(payload.GrossWeight),  // Convert to Decimal
          Volume: Number(payload.Volume),  // Convert to Decimal
          Qty: payload.Qty ? Number(payload.Qty) : Number(payload.numberOfContainers),   // Convert to Decimal
          ContainerType: payload.ContainerType,
          pkgType: payload.packageType,
          ShipmentTerms: payload.ShipmentTerms,
          createdBy: user['userEmail']
        }
        const bookingCargo = await prisma.bookingCargo.create({
          data: bookingCargoPayload
        });

        // Return Success Response
        return {
          message: 'Booking created successfully',
          data: {
            bookingHeader,
            bookingCargo,
          }
        };
      });
    } catch (error) {
      throw new Error(`Transaction failed: ${error.stack}`);
    }
  }

  async findAll() {
    return await this.db.bookingHeader.findMany({
      include: {
        bookingCargo: true
      }
    }).catch(err => {
      this.logger.warn(`Booking Service: findAll failed`)
      throw new InternalServerErrorException("Booking Service error: Something went wrong.")
    })
  }

  async findOne(id: number) {
    return await this.db.bookingHeader.findUnique({
      where: {
        BookingHeaderSid: id
      }, include: {
        bookingCargo: true
      }
    }).catch(err => {
      this.logger.warn(`Booking Service: findOne failed`)
      throw new InternalServerErrorException("Booking Service error: Something went wrong.")
    })
  }

  async update(id: number, payload: any, user: any) {
    try {
      return await this.db.$transaction(async (prisma) => {
        // Step 1: Update Enquiry Header
        const bookingHeaderPayload: any = {
          DepartmentMasterSid: Number(payload.DepartmentMasterSid),
          ShipmentType: payload.ShipmentType,
          createdBy: user['userEmail'],
          ETA: payload.ETA,
          ETD: payload.ETD,
          POL: payload.from,
          POD: payload.to
        };
        await this.db.bookingHeader.findUnique({
          where: {
            BookingHeaderSid: id
          }
        }).catch(err => {
          throw err
        })

        const bookingHeader = await prisma.bookingHeader.update({
          where: { BookingHeaderSid: id },
          data: bookingHeaderPayload
        });

        const bookingCargoPayload = {
          BookingHeaderSid: bookingHeader.BookingHeaderSid,
          CargoType: payload.CargoType,
          GrossWeight: Number(payload.GrossWeight),  // Convert to Decimal
          Volume: Number(payload.Volume),  // Convert to Decimal
          Qty: payload.Qty ? Number(payload.Qty) : Number(payload.numberOfContainers),   // Convert to Decimal
          ContainerType: payload.ContainerType,
          pkgType: payload.packageType,
          ShipmentTerms: payload.ShipmentTerms,
          createdBy: user['userEmail']
        }
        const bookingCargo = await prisma.bookingCargo.update({
          where: {
            BookingCargoSid: payload.BookingCargoSid
          },
          data: bookingCargoPayload
        });

        // Return Success Response
        return {
          message: 'Booking Updated successfully',
          data: {
            bookingHeader,
            bookingCargo,
          }
        };
      });
    } catch (error) {
      throw new Error(`Transaction failed: ${error.stack}`);
    }
  }

  async remove(id: number) {
    const bookingHeader = await this.db.bookingHeader.findUnique({
      where: { BookingHeaderSid: id }
    });

    if (!bookingHeader) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    if (bookingHeader.status === 'D') {
      throw new Error(`Quote with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this.db.bookingHeader.update({
      where: { BookingHeaderSid: id },
      data: { status : 'D'}
    });
  }


  async getAllPort() {
    return await this.db.portMaster.findMany({}).catch(err => {
      this.logger.warn(`Booking Service: getAllPort failed`)
      throw new InternalServerErrorException("Booking Service error: Something went wrong.")
    })
  }

  async getAllVesselMaster() {
    return await this.db.voyageMasterDetail.findMany({}).catch(err => {
      this.logger.warn(`Booking Service: getAllVesselMaster failed`)
      throw new InternalServerErrorException("Booking Service error: Something went wrong.")
    })
  }

}
