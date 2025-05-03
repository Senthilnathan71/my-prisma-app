import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class PortService {
    logger: any;
    constructor(
        private _db: DatabaseService
    ) { }

    async createPort(payload, user) {
       // this.logger.warn(`createPortUser: ${payload}`);


        const existing = await this._db.portMaster.findFirst({
            where: {
                OR:  [
                    {
                        PortName: {
                            equals: payload.PortName.trim(),
                            mode: 'insensitive',
                          }
                    },
                    {
                        PortCode: {
                            equals: payload.PortCode.trim(),
                            mode: 'insensitive',
                          }
                    }
                ]
            },
        });

        if (existing) {
          
            if (existing.PortName === payload.PortName) {
                throw new BadRequestException('Port name already exists');
            }
            if (existing.PortCode === payload.PortCode) {
                throw new BadRequestException('Port code already exists');
            }
        }
       
        try {
            const port = await this._db.portMaster.create({
                data: payload
            });
           
            return port;
        } catch (error) {
            throw new Error(`Error creating port: ${error.message}`);
        } 
    }



    async getAllPorts() {
        try {
            const port = await this._db.portMaster.findMany({
                include: {
                    countryMaster: {
                        select: {
                            countryName: true,
                        }
                    },
                    sectorMaster: {
                        select: {
                            sectorName: true,
                        }
                    },
                    stateMaster: {
                        select: {
                            stateName: true,
                        }
                    }
                },
                where: {
                    deletedAt: {
                        equals: null
                      }
                }
            });
            return port;
        } catch (error) {
            throw error
        }
    }


    async findOne(PortMasterSid: any) {
        try {
            return await this._db.portMaster.findUnique({
                include: {
                    countryMaster: {
                        select: {
                            countryName: true,
                        }
                    },
                    sectorMaster: {
                        select: {
                            sectorName: true,
                        }
                    },
                    stateMaster: {
                        select: {
                            stateName: true,
                        }
                    }
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

        const existing = await this._db.portMaster.findFirst({
            where: {
                AND: [
                    {
                        OR:  [
                            {
                                PortName: {
                                    equals: payload.PortName.trim(),
                                    mode: 'insensitive',
                                  }
                            },
                            {
                                PortCode: {
                                    equals: payload.PortCode.trim(),
                                    mode: 'insensitive',
                                  }
                            }
                        ]
                    },
                    {
                        NOT: {
                            PortMasterSid: PortMasterSid, 
                          }
                    }
            ]
            },
        });

        if (existing) {
            if (existing.PortName === payload.PortName) {
            //throw new Error('Port name already exists');
            throw new BadRequestException('Port name already exists');
            }
            if (existing.PortCode === payload.PortCode) {
                throw new BadRequestException('Port code already exists');
            }
        }

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
            throw new NotFoundException(`Port with ID ${id} not found`);
        }

        if (existingPort.deletedAt) {
            throw new Error(`Port with ID ${id} is already deleted`);
        }

        // Perform soft delete by updating deletedAt field
        return this._db.portMaster.update({
            where: { PortMasterSid: id },
            data: { deletedAt: new Date() }
        });
    }










}