import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';


@Injectable()
export class DivisionService {
    constructor(private _db: DatabaseService) { }
    async createNewDivision(newData: any) {
        try {
            const newlyCreated = await this._db.divisionMaster.create({
                data: {
                    ...newData,
                    createdBy: 'admin@crm.com'
                }
            })
            return newlyCreated;
        } catch (error) {
            throw error;
        }
    }

    async getAllDivisions() {
        try {
            const allDivisions = await this._db.divisionMaster.findMany({
                where: {
                    deletedAt: null,
                }
            })
            return allDivisions;
        } catch (error) {
            throw error;
        }
    }

    async getDivisionById(divisionId: number) {
        try {
            const ourDivision = await this._db.divisionMaster.findUnique({
                where: {
                    DivisionMasterSid: divisionId
                }
            })
            if (!ourDivision) {
                throw new BadRequestException(`Division with id : ${divisionId} not exist`);
            }
            return ourDivision;
        } catch (error) {
            throw error;
        }
    }

    async editDivisionById(divisionId: number, newData: any) {
        try {
            const existing = await this._db.divisionMaster.findUnique({
                where: {
                    DivisionMasterSid: divisionId
                }
            })
            if (!existing) {
                throw new BadRequestException(`Division with id : ${divisionId} not exist`);
            }
            const editedDivision = await this._db.divisionMaster.update({
                where: {
                    DivisionMasterSid: divisionId
                },
                data: newData
            })
            return editedDivision;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteDivision(divisionId: number) {
        try {
            const existing = await this._db.divisionMaster.findUnique({
                where: {
                    DivisionMasterSid: divisionId
                }
            })
            if (!existing) {
                throw new BadRequestException(`Division with id : ${divisionId} not exist`);
            }
            if (existing.deletedAt) {
                throw new BadRequestException(`Division with id : ${divisionId} is already deleted`);
            }
            const deletedDivision = await this._db.divisionMaster.update({
                where: {
                    DivisionMasterSid: divisionId
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedDivision;
        } catch (error) {
            throw error;
        }
    }

    async searchDivision(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const acceptedType = [
            "DivisionName",
            "DivisionCode",
            "status"
        ];
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }
        const searchResults = await this._db.divisionMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive'
                },
                deletedAt:null
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${err}`);
        })
        return searchResults;
    }
}
