import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class PortService {
    constructor(
        // @InjectModel(CityMaster)
        // private readonly cityMaster : typeof CityMaster
        private _db: DatabaseService
    ) { }

    async createPort(payload, user) {
        try {
            const port = await this._db.portMaster.create({
                data: payload
            });
            return port;
        } catch (error) {
            throw new Error(`creation failed: ${error.stack}`);
        }
    }



    async getAllPorts() {
        try {
            const customer = await this._db.portMaster.findMany({include: {
                countryMaster: { select: {
                    countryName: true, 
                  }}, 
                sectorMaster : { select: {
                    sectorName: true, 
                  }},
                stateMaster : { select: {
                    stateName: true, 
                  }}
              }});
            return customer;
        } catch (error) {
            throw error
        }
    }


    async findOne(PortMasterSid: any) {
        try {
            return await this._db.portMaster.findUnique({
                include: {
                    countryMaster: { select: {
                        countryName: true, 
                      }}, 
                    sectorMaster : { select: {
                        sectorName: true, 
                      }},
                    stateMaster : { select: {
                        stateName: true, 
                      }}
                  },
                where: {
                    PortMasterSid: PortMasterSid
                }
            });
        } catch (error) {
            throw error;
        }
    }


    async updatePort(PortMasterSid: number, payload, user) {
        try {
            const port = await this._db.portMaster.update({
                where: {
                    PortMasterSid: PortMasterSid
                }, data: payload
            });
            return port;
        } catch (error) {
            throw new Error(`Error updating port: ${error.message}`);
        }
    }

    async softDelete(id: number) {
        const existingPort = await this._db.portMaster.findUnique({
            where: { PortMasterSid: id }
        });

        if (!existingPort) {
            throw new NotFoundException(`Enquiry with ID ${id} not found`);
        }

        if (existingPort.deletedAt) {
            throw new Error(`Enquiry with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.portMaster.update({
            where: { PortMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }










}