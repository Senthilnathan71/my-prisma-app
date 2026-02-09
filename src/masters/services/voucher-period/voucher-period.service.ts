import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class VoucherPeriodService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllVoucherPeriods(CompanyMasterSid: number, BranchMasterSid: number, YearMasterSid: number) {
        try {
            const allVoucherPeriods = await this._db.voucherPeriod.findMany({
                where: {
                    Status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    YearMasterSid: YearMasterSid
                },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            });
            return allVoucherPeriods;
        } catch (error) {
            throw error;
        }
    }

    async createVoucherPeriod(payload: any) {
        try {
            const { CompanyMasterSid, BranchMasterSid, YearMasterSid, createdBy, status, ...rest } = payload;

            // Check for duplicate PeriodCode within the same Year
            const existingPeriod = await this._db.voucherPeriod.findFirst({
                where: {
                    PeriodCode: rest.PeriodCode,
                    YearMasterSid: YearMasterSid,
                    Status: { not: 'D' }
                }
            });

            if (existingPeriod) {
                throw new BadRequestException(`Period with code ${rest.PeriodCode} already exists for this year`);
            }

            const createdVoucherPeriod = await this._db.voucherPeriod.create({
                data: {
                    ...rest,
                    Status: status,
                    CreatedBy: createdBy,
                    CompanyMaster: {
                        connect: { CompanyMasterSid },
                    },
                    BranchMaster: {
                        connect: { BranchMasterSid },
                    },
                    YearMaster: {
                        connect: { YearMasterSid },
                    },
                },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                },
            });

            return createdVoucherPeriod;
        } catch (error) {
            console.log(error.stack);
            throw error;
        }
    }

    async fetchVoucherPeriodById(VoucherPeriodSid: number) {
        try {
            const voucherPeriod = await this._db.voucherPeriod.findUnique({
                where: {
                    VoucherPeriodSid: VoucherPeriodSid
                },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            });
            if (!voucherPeriod) {
                throw new BadRequestException(`VoucherPeriod with Id : ${VoucherPeriodSid} not exists`);
            }
            return voucherPeriod;
        } catch (error) {
            throw error;
        }
    }

   async updateVoucherPeriodById(VoucherPeriodSid: number, payload: any) {
  try {
    const exist = await this._db.voucherPeriod.findUnique({
      where: { VoucherPeriodSid },
    });

    if (!exist) {
      throw new BadRequestException(
        `VoucherPeriod with Id : ${VoucherPeriodSid} not exists`
      );
    }

    const data = {
      Remarks: payload.Remarks,
      APClosed: payload.APClosed,
      APGraceDays: payload.APGraceDays
        ? new Prisma.Decimal(payload.APGraceDays)
        : null,

      ARClosed: payload.ARClosed,
      ARGraceDays: payload.ARGraceDays
        ? new Prisma.Decimal(payload.ARGraceDays)
        : null,

      GLClosed: payload.GLClosed,
      GLGraceDays: payload.GLGraceDays
        ? new Prisma.Decimal(payload.GLGraceDays)
        : null,
      UpdatedOn: new Date(),
    };

    const updatedVoucherPeriod = await this._db.voucherPeriod.update({
      where: { VoucherPeriodSid },
      data,
      include: {
        YearMaster: true,
        CompanyMaster: true,
        BranchMaster: true,
      },
    });

    return updatedVoucherPeriod;
  } catch (error) {
    console.log("VoucherPeriod Updation Error:", error);
    throw error;
  }
}


    async deleteVoucherPeriod(VoucherPeriodSid: number) {
        try {
            const exist = await this._db.voucherPeriod.findUnique({
                where: {
                    VoucherPeriodSid: VoucherPeriodSid
                }
            });
            if (!exist) {
                throw new BadRequestException(`VoucherPeriod with Id : ${VoucherPeriodSid} not exists`);
            }
            if (exist.Status === 'D') {
                throw new BadRequestException(`VoucherPeriod with Id :${VoucherPeriodSid} is already deleted`);
            }
            const deletedVoucherPeriod = await this._db.voucherPeriod.update({
                where: {
                    VoucherPeriodSid: VoucherPeriodSid
                },
                data: {
                    Status: 'D'
                },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            });
            return deletedVoucherPeriod;
        } catch (error) {
            throw error;
        }
    }

    async searchVoucherPeriodNew(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        const where: any = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,

            ...(search
                ? {
                    OR: [
                        { PeriodName: { contains: search, mode: 'insensitive' } },
                        { PeriodCode: !isNaN(Number(search)) ? Number(search) : undefined },
                        { Remarks: { contains: search, mode: 'insensitive' } },
                        { status: { contains: search, mode: 'insensitive' } },
                    ].filter(Boolean),
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.voucherPeriod.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VoucherPeriodSid: 'desc' },
                include: {
                    YearMaster: true,
                    CompanyMaster: true,
                    BranchMaster: true
                }
            }),
            this._db.voucherPeriod.count({ where }),
        ]);

        // Add computed PeriodClosed field
        const itemsWithPeriodClosed = items.map(item => ({
            ...item,
            PeriodClosed: (item.GLClosed === 'Y' && item.ARClosed === 'Y' && item.APClosed === 'Y') ? 'Y' : 'N'
        }));

        return {
            items: itemsWithPeriodClosed,
            totalCount,
        };
    }

    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            const whereClause: any = { tableName };
            if (recordId) whereClause.recordId = recordId;

            const logs = await this._db.auditLog.findMany({
                where: whereClause,
                orderBy: { changedAt: 'desc' },
            });

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    /**
     * Check if voucher periods already exist for a given year
     */
    async checkPeriodsExistForYear(
        YearMasterSid: number,
        CompanyMasterSid: number,
        BranchMasterSid: number
    ): Promise<boolean> {
        try {
            const existingPeriods = await this._db.voucherPeriod.findFirst({
                where: {
                    YearMasterSid,
                    CompanyMasterSid,
                    BranchMasterSid,
                    Status: { not: 'D' }
                }
            });
            return !!existingPeriods;
        } catch (error) {
            this.logger.warn(`checkPeriodsExistForYear Error: ${error}`);
            throw error;
        }
    }

    /**
     * Create 12 monthly periods for a given year
     */
    async createPeriodsForYear(payload: {
        YearMasterSid: number;
        CompanyMasterSid: number;
        BranchMasterSid: number;
        CreatedBy: string;
    }) {
        try {
            const { YearMasterSid, CompanyMasterSid, BranchMasterSid, CreatedBy } = payload;

            // 1. Get YearMaster to get start/end dates
            const yearMaster = await this._db.yearMaster.findUnique({
                where: { YearMasterSid }
            });

            if (!yearMaster) {
                throw new BadRequestException(`Year with ID ${YearMasterSid} not found`);
            }

            // 2. Check if periods already exist
            const periodsExist = await this.checkPeriodsExistForYear(
                YearMasterSid,
                CompanyMasterSid,
                BranchMasterSid
            );

            if (periodsExist) {
                throw new BadRequestException(
                    `Voucher periods already exist for year ${yearMaster.YearName}`
                );
            }

            // 3. Generate 12 monthly periods
            const periods: Prisma.VoucherPeriodCreateInput[] = [];
            const startDate = new Date(yearMaster.StartDate);
            const endDate = new Date(yearMaster.EndDate);

            const monthAbbrevs = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

            // Start from the 1st of the startDate's month
            let currentYear = startDate.getFullYear();
            let currentMonth = startDate.getMonth();
            let periodSeq = 1;

            while (periodSeq <= 12) {
                // Always 1st of the month (UTC to avoid timezone shift)
                const periodStartDate = new Date(Date.UTC(currentYear, currentMonth, 1));

                // Last day of month (handles leap year & 28/29/30/31 automatically)
                const periodEndDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0));

                if (periodStartDate > endDate) break;

                const paddedSeq = String(periodSeq).padStart(2, '0');
                const periodCode = Number(`${yearMaster.YearCode}${paddedSeq}`);
                const periodName = `${yearMaster.YearCode}${paddedSeq}(${monthAbbrevs[currentMonth]})`;

                periods.push({
                    PeriodCode: periodCode,
                    PeriodName: periodName,
                    StartDate: periodStartDate,
                    EndDate: periodEndDate,
                    CreatedBy,
                    Status: 'A',
                    GLClosed: 'N',
                    GLGraceDays: 0,
                    ARClosed: 'N',
                    ARGraceDays: 0,
                    APClosed: 'N',
                    APGraceDays: 0,
                    Remarks: 'Generated from Year',
                    CompanyMaster: { connect: { CompanyMasterSid } },
                    BranchMaster: { connect: { BranchMasterSid } },
                    YearMaster: { connect: { YearMasterSid } },
                });

                // Move to next month
                currentMonth++;
                if (currentMonth > 11) {
                    currentMonth = 0;
                    currentYear++;
                }
                periodSeq++;
            }

            // 4. Create all periods in a transaction
            const createdPeriods = await this._db.$transaction(
                periods.map(period =>
                    this._db.voucherPeriod.create({ data: period })
                )
            );

            return {
                message: `Successfully created ${createdPeriods.length} periods for year ${yearMaster.YearName}`,
                periods: createdPeriods
            };
        } catch (error) {
            this.logger.warn(`createPeriodsForYear Error: ${error}`);
            throw error;
        }
    }

    /**
     * Validate if a voucher can be posted for a given date and module
     * Takes into account period closure and grace days
     */
    async validateVoucherPeriod(payload: {
        voucherDate: Date | string;
        module: 'GL' | 'AR' | 'AP';
        CompanyMasterSid: number;
        BranchMasterSid: number;
    }): Promise<{ allowed: boolean; message: string }> {
        try {
            const { voucherDate, module, CompanyMasterSid, BranchMasterSid } = payload;
            const vDate = new Date(voucherDate);

            // Find the period that contains the voucher date
            const period = await this._db.voucherPeriod.findFirst({
                where: {
                    CompanyMasterSid,
                    BranchMasterSid,
                    Status: 'A',
                    StartDate: { lte: vDate },
                    EndDate: { gte: vDate }
                }
            });

            if (!period) {
                return {
                    allowed: false,
                    message: `No voucher period found for date ${vDate.toLocaleDateString()}`
                };
            }

            // Determine which closed flag and grace days to use based on module
            let isClosed: boolean;
            let graceDays: number;
            let closedFieldName: string;

            switch (module) {
                case 'GL':
                    isClosed = period.GLClosed === 'Y';
                    graceDays = Number(period.GLGraceDays) || 0;
                    closedFieldName = 'GL';
                    break;
                case 'AR':
                    isClosed = period.ARClosed === 'Y';
                    graceDays = Number(period.ARGraceDays) || 0;
                    closedFieldName = 'AR';
                    break;
                case 'AP':
                    isClosed = period.APClosed === 'Y';
                    graceDays = Number(period.APGraceDays) || 0;
                    closedFieldName = 'AP';
                    break;
                default:
                    return { allowed: false, message: `Invalid module: ${module}` };
            }

            // If period is not closed, allow
            if (!isClosed) {
                return { allowed: true, message: 'Period is open' };
            }

            // Period is closed - check grace days
            const periodEndDate = new Date(period.EndDate);
            const graceEndDate = new Date(periodEndDate);
            graceEndDate.setDate(graceEndDate.getDate() + graceDays);

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (today <= graceEndDate) {
                return {
                    allowed: true,
                    message: `${closedFieldName} period is closed but within grace period (until ${graceEndDate.toLocaleDateString()})`
                };
            }

            // Grace period has ended
            return {
                allowed: false,
                message: `${closedFieldName} period '${period.PeriodName}' is closed. Grace period ended on ${graceEndDate.toLocaleDateString()}.`
            };
        } catch (error) {
            this.logger.warn(`validateVoucherPeriod Error: ${error}`);
            throw error;
        }
    }
}
