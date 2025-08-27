import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';

@Injectable()
export class BookingService {
  constructor(private db: DatabaseService, private logger: Logger) { }
  async create(payload, user) {
    try {
      return await this.db.$transaction(async (prisma) => {
        const dateString = moment().format('YYYYMMDD')
        const count = await this.db.bookingHeader.count({
          where: {
            BookingNo: {
              contains: dateString
            }
          }
        })
        const bookingNo = `booking-${dateString}-${(count + 1).toString().padStart(3, '0')}`
        // Step 1: Create Enquiry Header
        const bookingHeaderPayload: any = {
          DepartmentMasterSid: Number(payload.DepartmentMasterSid),
          CustomerMasterSid: Number(user.UserMasterSid),
          CompanyMasterSid: Number(user.userBranchMaster[0]?.CompanyMasterSid),
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
