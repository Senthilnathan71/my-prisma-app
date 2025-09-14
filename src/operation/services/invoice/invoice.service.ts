import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InvoiceService {

    constructor(
        private _db: DatabaseService,
        private logger: Logger,
    ) { }

    async fetchInvoices() {
        try {
            const result = await this._db.voucherHeader.findMany({
                where: {
                    Status: 'A'
                }
            })
            return result;
        } catch (error) {
            throw new InternalServerErrorException("Something Went Wrong while fetching the data");
        }
    }

    async findVoucherHeaderById(VoucherHeaderSid: number) {
        try {
            const isExistsVoucherHeader: any = await this._db.voucherHeader.findUnique({
                where: {
                    VoucherHeaderSid: VoucherHeaderSid
                },
                include: {
                    VoucherDetail: {
                        select: {
                            HSSACMasterSid: true,
                            TaxableAmount: true,
                            ChargeDescription: true,
                            Amount: true,
                            Rate: true
                        }
                    },
                    VoucherOthers: true,
                    VoucherTDS: true,
                    VoucherTransaction: true
                }
            })
            return isExistsVoucherHeader
        } catch (error) {
            throw new InternalServerErrorException("Something Went Wrong while fetching the data");
        }
    }

    async createInvoice(payload: any) {
        try {
            const voucherHeader = await this._db.voucherHeader.create(payload).catch(err => { throw new Error('Something Went Wrong While Creating VoucherHeader') })
            let voucherDetails
            if (voucherHeader) {
                voucherDetails = await this._db.voucherDetail.createMany(payload.voucherDetails).catch(err => { throw new Error('Something Went Wrong While Creating VoucherDetails') })
            }
            let voucherOthers
            if (voucherHeader && voucherDetails) {
                voucherOthers = await this._db.voucherOthers.createMany(payload.voucherOthers).catch(err => { throw new Error('Something Went Wrong While Creating VoucherOthers') })
            }
            let voucherTds
            if (voucherHeader && voucherDetails) {
                voucherTds = await this._db.voucherTDS.createMany(payload.voucherTds).catch(err => { throw new Error('Something Went Wrong While Creating VoucherTDS') })
            }

            let voucherTransactions
            if (voucherHeader && voucherDetails) {
                voucherTransactions = await this._db.voucherTransaction.createMany(payload.voucherTransactions).catch(err => { throw new Error('Something Went Wrong While Creating VoucherTDS') })
            }
        } catch (error) {
            throw new Error('Something Went Wrong While Creating VoucherHeader')
        }
    }

    async updateVoucherHeaderById(VoucherHeaderById: number, payload: any) {

    }


    async deleteVoucherHeader(VoucherHeaderSid: number) {
        try {
            const existing = await this._db.voucherHeader.findUnique({
                where: {
                    VoucherHeaderSid: VoucherHeaderSid,
                    Status: "A"
                }
            }).catch(err => {
                throw new BadRequestException('Provided Voucher Header id is already deleted');
            })

            const result = await this._db.$transaction(async (prisma) => {
                const deletedVoucherHeader = await prisma.voucherHeader.update({
                    where: { VoucherHeaderSid: VoucherHeaderSid },
                    data: { Status: 'D' }
                })

                const deletedVoucherDetails = await prisma.voucherDetail.updateMany({
                    where: { VoucherHeaderSid: VoucherHeaderSid },
                    data: { Status: 'D' }
                })
                const deletedVoucherTds = await prisma.voucherTDS.updateMany({
                    where: { VoucherHeaderSid: VoucherHeaderSid },
                    data: { Status: 'D' }
                })
                const deletedOthers = await prisma.voucherOthers.updateMany({
                    where: { VoucherHeaderSid: VoucherHeaderSid },
                    data: { Status: 'D' }
                })
                const deletedTransactions = await prisma.voucherTransaction.updateMany({
                    where: { VoucherHeaderSid: VoucherHeaderSid },
                    data: { Status: 'D' }
                })


                return {
                    deletedVoucherHeader,
                    deletedVoucherDetails,
                    deletedVoucherTds,
                    deletedOthers,
                    deletedTransactions
                }
            })
            return result;
        } catch (error) {
            throw error;
        }
    }

    async searchVoucherHeader(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoucherHeaderWhereInput = {
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            Status: 'A',
            ...(search && {
                OR: [
                    { VoucherNumber: { contains: search, mode: 'insensitive' } },
                    { departmentMaster: { departmentName: { contains: search, mode: 'insensitive' } } }
                ],
            }),
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.voucherHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VoucherHeaderSid: 'desc' }
            }),
            this._db.voucherHeader.count({ where }),
        ]);



        return { items: items, totalCount };
    }
}
