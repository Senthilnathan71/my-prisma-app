import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class ProfitCenterService {
    constructor(private _db: DatabaseService, private logger: Logger){ }
    
        async createProfitCenter(payload: any, user) {
            this.logger.warn(`createProfitCenter: ${payload}`);
    
            const existing = await this._db.profitCenterMaster.findFirst({
                where: {
                    OR: [
                        {
                            ProfitCenterName: {
                                equals: payload.ProfitCenterName.trim(),
                                mode: 'insensitive',
                            }
                        },
                        {
                            ProfitCenterCode: {
                                equals: payload.ProfitCenterCode.trim(),
                                mode: 'insensitive',
                            }
                        }
                    ]
                },
            });
    
            if (existing) {
                if (existing.ProfitCenterName === payload.ProfitCenterName) {
                    throw new BadRequestException('Profit-Center name already exists');
                }
                if (existing.ProfitCenterCode === payload.ProfitCenterCode) {
                    throw new BadRequestException('Profit-Center code already exists');
                }
            }
    
            try {
                const ProfitCenter = await this._db.profitCenterMaster.create({
                    data: {
                        ...payload,
                    }
                });
    
                return ProfitCenter;
            } catch (error) {
                console.log(error.stack)
                throw new Error(`Error creating Profit-Center: ${error.message}`);
            }
        }
    
        async getAllProfitCenter() {
            try {
                const ProfiCenterList = await this._db.profitCenterMaster.findMany({
                    where: {
                        Status: 'A'
                    }
                })
                return ProfiCenterList;
            } catch (error) {
                throw error
            }
        }
    
        async findOne(ProfitCenterMasterSid: any) {
            try {
                return await this._db.profitCenterMaster.findUnique({
                    where: {
                        ProfitCenterMasterSid: ProfitCenterMasterSid
                    },
                });
            } catch (error) {
                throw error;
            }
        }
    
        async updateProfitCenter(ProfitCenterMasterSid: number, payload: any, user) {
            const existing = await this._db.profitCenterMaster.findUnique({
                where: {
                    ProfitCenterMasterSid: ProfitCenterMasterSid
                }
            });
    
            if (!existing) {
                throw new Error('Profit-Center is not exists');
            }
    
            try {
                const ProfitCenter = await this._db.profitCenterMaster.update({
                    where: {
                        ProfitCenterMasterSid: ProfitCenterMasterSid
                    }, data: payload
                });
                return ProfitCenter;
            } catch (error) {
                throw new Error(`Error updating Profit-Center: ${error.message}`);
            }
        }
    
        async softDelete(id: number) {
            const existingProfitCenter = await this._db.profitCenterMaster.findUnique({
                where: {ProfitCenterMasterSid: id}
            });
    
            if (!existingProfitCenter) {
                throw new NotFoundException(`Profit-Center with ID ${id} not found`);
            }
    
            if (existingProfitCenter.deletedAt) {
                throw new Error(`Profit-Center with ID ${id} is already deleted`);
            }
    
            return this._db.profitCenterMaster.update({
                where: {ProfitCenterMasterSid: id},
                data: { deletedAt: new Date()}
            });
        }
    
        async searchList(dto: SearchListDto) {
            const { searchType, filterValue} = dto;
            const allowedFields = [
                'ProfitCenterName',
                'ProfitCenterCode',
                'Remarks',
                'Status',
            ];
    
            if (!allowedFields.includes(searchType)) {
                throw new BadRequestException('Invalid search type');
            }
    
            const ProfitCenters = this._db.profitCenterMaster.findMany({
                where: {
                    [searchType]: {
                        contains: filterValue,
                        mode: 'insensitive',
                    },
                    deletedAt: null,
                },
            }).catch(err => {
                throw new Error(`Error Search Profit-Center: ${err}`);
            });
            return ProfitCenters;
        }
    
}
