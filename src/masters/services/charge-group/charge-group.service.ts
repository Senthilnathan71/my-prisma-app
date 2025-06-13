import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

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

    async searchChargeGroups(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "GroupName",
            "Remarks",
            "status",
            "CompanyMasterSid"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }
        const searchResults = await this._db.chargeGroup.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                },
                deletedAt: null
            },
            include: {
                companyMaster: true
            }
        }).catch((err) => {
            throw new Error(`Error Occurred: ${JSON.stringify(err)}`);
        });
        return searchResults;
    }
}