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
        const existing = await this._db.stdRateHeader.findFirst({
            where: {
                CompanyMasterSid: payload.CompanyMasterSid,
                DepartmentMasterSid: payload.DepartmentMasterSid,
                Status: 'A'
            },
            select: {
                StdRateHeaderSid: true,
                DepartmentMaster: {
                    select: {
                        departmentName: true
                    }
                }
            }
        });
        if (existing) {
            throw new BadRequestException(`Standard Rate for ${existing.DepartmentMaster?.departmentName} already exists.`);
        }

        try {
            const result = await this._db.$transaction(async (prisma) => {
                const createdHeader = await prisma.stdRateHeader.create({
                    data: {
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
        try {
            return await this._db.stdRateHeader.findUnique({
                where: { StdRateHeaderSid },
                include: {
                    StdTariffDetails: {
                        where: {
                            Status: 'A'
                        }
                    }
                }
            });
        } catch (error) {
            throw error
        }
    }

    async getStdCharges(CompanyMasterSid: number, DepartmentMasterSid: number) {
        try {
            const stdCharge = await this._db.stdRateHeader.findFirst({
                where: {
                    Status: "A",
                    CompanyMasterSid: CompanyMasterSid,
                    DepartmentMasterSid: DepartmentMasterSid
                },
                include: {
                    StdTariffDetails: {
                        where: {
                            Status: "A"
                        }
                    }
                }
            });

            if (!stdCharge) {
                throw new NotFoundException("Standard Charge not found for this department");
            }

            return stdCharge;
        } catch (error) {
            throw error;
        }
    }



    async updateStdChargeById(StdRateHeaderSid: number, payload: any) {
        try {
            const existing = await this._db.stdRateHeader.findFirst({
                where: {
                    StdRateHeaderSid: { not: StdRateHeaderSid },
                    CompanyMasterSid: payload.CompanyMasterSid,
                    DepartmentMasterSid: payload.DepartmentMasterSid,
                    Status: 'A'
                },
                select: {
                    StdRateHeaderSid: true,
                    DepartmentMaster: {
                        select: {
                            departmentName: true
                        }
                    }
                }
            });
            if (existing) {
                throw new BadRequestException(`Standard Rate for ${existing.DepartmentMaster?.departmentName} already exists.`);
            }
            const result = await this._db.$transaction(async (prisma) => {
                const updatedHeader = await prisma.stdRateHeader.update({
                    where: {
                        StdRateHeaderSid: StdRateHeaderSid
                    },
                    data: {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        Status: payload.Status,
                        Remarks: payload.Remarks,
                        UpdatedBy: payload.UpdatedBy,
                        UpdatedOn: new Date(),
                    }
                });

                const allDetailPayload = payload.StdTariffDetails || [];

                /**
                 *  id - Edit
                 *  no id - create
                 */

                const finalDetail: any[] = [];
                for (const detail of allDetailPayload) {
                    let updatedDetail: any;
                    let createdDetail: any;
                    if (detail.StdTariffDetailSid) {
                        updatedDetail = await prisma.stdTariffDetail.update({
                            where: { StdTariffDetailSid: detail.StdTariffDetailSid },
                            data: {
                                CompanyMasterSid: payload.CompanyMasterSid,
                                UpdatedBy: payload.UpdatedBy,
                                UpdatedOn: new Date(),
                                CargoType: detail.CargoType,
                                ChargeMasterSid: detail.ChargeMasterSid,
                                UomSid: detail.UomSid,
                                SaleCurrency: detail.SaleCurrency,
                                SaleAmount: detail.SaleAmount,
                                CostCurrency: detail.CostCurrency,
                                CostAmount: detail.CostAmount,
                                ValidFrom: detail.ValidFrom,
                                ValidTo: detail.ValidTo,
                                Status: detail.Status,
                                ChargeName: detail.ChargeName
                            }
                        })
                    } else {
                        createdDetail = await prisma.stdTariffDetail.create({
                            data: {
                                StdRateHeaderSid: updatedHeader.StdRateHeaderSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                CreatedBy: payload.UpdatedBy,
                                CreatedOn: new Date(),
                                CargoType: detail.CargoType,
                                ChargeMasterSid: detail.ChargeMasterSid,
                                UomSid: detail.UomSid,
                                SaleCurrency: detail.SaleCurrency,
                                SaleAmount: detail.SaleAmount,
                                CostCurrency: detail.CostCurrency,
                                CostAmount: detail.CostAmount,
                                ValidFrom: detail.ValidFrom,
                                ValidTo: detail.ValidTo,
                                Status: detail.Status,
                                ChargeName: detail.ChargeName
                            }
                        })
                    }
                    finalDetail.push(updatedDetail || createdDetail);
                }
                return {
                    updatedHeader,
                    finalDetail
                }

            })

            return result

        } catch (error) {
            throw error;
        }
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
            where: {
                StdRateHeaderSid: id
            },
            data: { Status: 'D' }
        })

        return deletedRecord;
    }

    async getStdTariffDetailById(StdTariffDetailSid: number , email ?: string) {
        const record = await this._db.stdTariffDetail.findUnique({
            where: {
                StdTariffDetailSid: StdTariffDetailSid,
                Status : 'A'
            }
        })

        if(!record){
            throw new NotFoundException(`Standard Tariff Detail with ID ${StdTariffDetailSid} not found`);
        }

        if(record?.Status === 'D'){
            throw new BadRequestException(`Standard Tariff Detail with ID ${StdTariffDetailSid} is already deleted`);
        }

        const deletedRecord = await this._db.stdTariffDetail.update({
            where: { StdTariffDetailSid: StdTariffDetailSid },
            data: { Status: 'D' , UpdatedBy : email , UpdatedOn : new Date() },
        });

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
