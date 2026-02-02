import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class StandardChargeService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
    ) { }

    async getAllStdCharges() {
        return this._db.stdRateHeader.findMany({
            where: { Status: 'A' },
        });
    }

    async createNewStdCharge(payload: any) {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                const createdHeader = await prisma.stdRateHeader.create({
                    data: {
                        StdRateHeaderSid: payload.StdRateHeaderSid,
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        Status: payload.Status,
                        Remarks: payload.Remarks,
                        CreatedBy: payload.CreatedBy,
                        CreatedOn: new Date(),
                        CompanyMasterSid: payload.CompanyMasterSid
                    },
                });

                const detailPayload = (payload.StdTariffDetails || []).map(
                    dtl => {
                        return {
                            StdRateHeaderSid: createdHeader.StdRateHeaderSid,
                            StdTariffDetailSid: payload.StdTariffDetailSid,
                            CompanyMasterSid: payload.CompanyMasterSid,
                            CreatedBy: payload.CreatedBy,
                            CreatedOn: new Date(),
                            CargoType: dtl.CargoType,
                            ChargeMasterSid: dtl.ChargeMasterSid,
                            UomSid: dtl.UomSid,
                            SaleCurrency: dtl.SaleCurrency,
                            SaleAmount: dtl.SaleAmount,
                            CostCurrency: dtl.CostCurrency,
                            CostAmount: dtl.CostAmount,
                            ValidFrom: dtl.ValidFrom,
                            ValidTo: dtl.ValidTo,
                            Status: dtl.Status,
                            ChargeName: dtl.ChargeName
                        }
                    }
                )
                const createdDetails = await prisma.stdTariffDetail.createMany({
                    data: detailPayload,
                });
                return createdDetails
            })
            return result;
        } catch (error) {
            throw error;
        }
    }

    async fetchStdChargeById(StdRateHeaderSid: number) {
        const record = await this._db.stdRateHeader.findUnique({
            where: { StdRateHeaderSid },
        });

        if (!record) {
            throw new BadRequestException(
                `Standard Charge with id ${StdRateHeaderSid} not found`,
            );
        }
        return record;
    }

    async updateStdChargeById(StdRateHeaderSid: number, payload: any) {
        const existingStdcharge = await this._db.stdRateHeader.findUnique({
            where: { StdRateHeaderSid: StdRateHeaderSid },
        });

        if(!existingStdcharge){}
        
       const stdHeader=await this._db.stdRateHeader.update({
            where: { StdRateHeaderSid ,Status:'A'},
            data: payload,
        });

        await this._db.stdTariffDetail.updateMany({
            where:{
                StdRateHeaderSid,
                Status:'A'
            },
            data:payload
        })
        return stdHeader
    }

    async deleteStdCharge(id: number) {
        const existingStdcharge = await this._db.stdRateHeader.findUnique({
            where: { StdRateHeaderSid: id },
        });

        if (!existingStdcharge) {
            throw new NotFoundException(`Standard-charge with ID ${id} not found`);
        }

        if (existingStdcharge.Status === 'D') {
            throw new Error(`Standard-charge  with ID ${id} is already deleted`);
        }

        const deletedRecord = await this._db.stdRateHeader.update({
            where: { StdRateHeaderSid: id },
            data: { Status: 'D' },
        });

        await this._db.stdTariffDetail.updateMany({
            where : {
                StdRateHeaderSid : id
            },
            data : { Status : 'D'}
        })

        return deletedRecord;
    }

    async searchStdHeaderNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.StdRateHeaderWhereInput = {

            Status: statusWhereClause,
            ...(search
                ? {
                    OR: [
                        { DepartmentMaster: { departmentName: { contains: search, mode: 'insensitive' } } },
                        { Remarks: { contains: search, mode: 'insensitive' } },
                        { Status: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.stdRateHeader.findMany({
                where,
                include: {
                    DepartmentMaster: {
                        select: {
                            departmentName: true
                        }
                    }
                },
                skip,
                take: pageSize,
                orderBy: { StdRateHeaderSid: 'desc' },
            }),
            this._db.stdRateHeader.count({ where }),
        ]);

        return {
            items,
            totalCount
        };
    }

    async getAuditLogs(tableName: string, recordId?: string) {
        const where: any = { tableName };
        if (recordId) where.recordId = recordId;

        return this._db.auditLog.findMany({
            where,
            orderBy: { changedAt: 'desc' },
        });
    }
}
