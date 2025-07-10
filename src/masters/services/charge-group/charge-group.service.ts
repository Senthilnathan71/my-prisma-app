import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ChargeGroupService {
    constructor(private _db: DatabaseService) { }

    async createNewChargeGroup(newData: any) {
        try {
            const newlyCreated = await this._db.chargeGroup.create({
                data: {
                    ...newData,
                    status: 'A' ,
                    CompanyMasterSid: Number(newData.CompanyMasterSid)
                }
            });
            return newlyCreated;
        } catch (error) {
            throw error;
        }
    }

    async getAllChargeGroups() {
        try {
            const allGroups = await this._db.chargeGroup.findMany({
                where: {
                    deletedAt: null
                },
                include: {
                    companyMaster: true
                }
            });
            return allGroups;
        } catch (error) {
            throw error;
        }
    }

    async getChargeGroupById(ChargeGroupSid: number) {
        try {
            const group = await this._db.chargeGroup.findUnique({
                where: {
                    ChargeGroupSid: ChargeGroupSid
                },
                include: {
                    companyMaster: true
                }
            });
            if (!group) {
                throw new BadRequestException(`Charge group with id: ${ChargeGroupSid} does not exist`);
            }
            return group;
        } catch (error) {
            throw error;
        }
    }

    async updateChargeGroupById(ChargeGroupSid: number, updateData: any) {
        try {
            const exist = await this._db.chargeGroup.findUnique({
                where: {
                    ChargeGroupSid: ChargeGroupSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Charge group with id: ${ChargeGroupSid} does not exist`);
            }
            const updated = await this._db.chargeGroup.update({
                where: {
                    ChargeGroupSid: ChargeGroupSid
                },
                data: updateData,
            });
            return updated;
        } catch (error) {
            throw error;
        }
    }

    async deleteChargeGroupById(ChargeGroupSid: number) {
        try {
            const exist = await this._db.chargeGroup.findUnique({
                where: {
                    ChargeGroupSid: ChargeGroupSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`Charge group with id: ${ChargeGroupSid} does not exist`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Charge group with id: ${ChargeGroupSid} is already deleted`);
            }
            const deleted = await this._db.chargeGroup.update({
                where: {
                    ChargeGroupSid: ChargeGroupSid
                },
                data: {
                    deletedAt: new Date()
                }
            });
            return deleted;
        } catch (error) {
            throw error;
        }
    }

    async searchChargeGroups(params: SearchVesselDto) {
  const { search = '', page = 1, pageSize = 10 } = params;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ChargeGroupWhereInput = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { GroupName: { contains: search, mode: 'insensitive' } },
            { Remarks: { contains: search, mode: 'insensitive' } },
            { status: { contains: search, mode: 'insensitive' } },
            { 
              companyMaster: {
                companyName: { contains: search, mode: 'insensitive' }
              }
            },
          ],
        } 
      : {}),
  };

  const [items, totalCount] = await this._db.$transaction([
    this._db.chargeGroup.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { ChargeGroupSid: 'desc' },
      include: {
        companyMaster: true
      }
    }),
    this._db.chargeGroup.count({ where }),
  ]);

  return {
    items,
    totalCount,
  };
}
}