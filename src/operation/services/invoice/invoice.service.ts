import { VoucherDetail } from './../../../../node_modules/.prisma/client/index.d';
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { VoucherDetail, VoucherHeader } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

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

    async searchBooking(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        let salesmanIds: number[] = [];
        let shipmentNosByMilestone: string[] = [];

        if (search) {
            /**
             *  Taking all UserSId associated with search
             */

            const users = await this._db.userMaster.findMany({
                where: { userName: { contains: search, mode: 'insensitive' }, status: 'A' },
                select: { UserMasterSid: true },
            });
            salesmanIds = users.map(u => u.UserMasterSid);

            /**
            |--------------------------------------------------
                |   1.Taking allMilestoneSid , ShipmentNo associated with search 
                |   2.Sorting based on ShipmentMilestoneSid(pk) to get latest one
                |--------------------------------------------------
            */

            const milestones = await this._db.shipmentMilestone.findMany({
                where: { MilestoneName: { contains: search, mode: 'insensitive' }, Status: 'A', CompanyMasterSid: activeCompanyId, BranchMasterSid: activeBranchId },
                select: { ShipmentNo: true, ShipmentMilestoneSid: true },
                orderBy: [{ ShipmentNo: 'asc' }, { ShipmentMilestoneSid: 'desc' }],
            });
            shipmentNosByMilestone = [...new Map(milestones.map(m => [m.ShipmentNo, m])).keys()];
        }

        const where: Prisma.BookingHeaderWhereInput = {
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            status: 'A',
            ...(search && {
                OR: [
                    { BookingNo: { contains: search, mode: 'insensitive' } },
                    { departmentMaster: { departmentName: { contains: search, mode: 'insensitive' } } },
                    { POL: { contains: search, mode: 'insensitive' } },
                    { POD: { contains: search, mode: 'insensitive' } },
                    { FPD: { contains: search, mode: 'insensitive' } },
                    { VesselName: { contains: search, mode: 'insensitive' } },
                    { VoyageNo: { contains: search, mode: 'insensitive' } },
                    ...(salesmanIds.length ? [{ SalesmanSid: { in: salesmanIds } }] : []),
                    ...(shipmentNosByMilestone.length ? [{ ShipmentNo: { in: shipmentNosByMilestone } }] : []),
                ],
            }),
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.bookingHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { BookingHeaderSid: 'desc' }
            }),
            this._db.bookingHeader.count({ where }),
        ]);

        /**
            * Taking DepartmentName using globalConfig Service 
         */
        items = await Promise.all(
            items.map(async (item) => {
                const [departmentMaster, salesman] = await Promise.all([
                    item.DepartmentMasterSid !== null ?
                        this.globalConfigService.getMasterData('department_master', item.DepartmentMasterSid) :
                        { DepartmentMasterSid: null, departmentName: '' },

                    item.SalesmanSid !== null ?
                        this.globalConfigService.getMasterData('user_master', item.SalesmanSid) :
                        { UserMasterSid: null, userName: '' }
                ])
                return {
                    ...item,
                    departmentMaster,
                    salesman
                }
            })
        )

        const shipmentNos = [...new Set(items.map(i => i.ShipmentNo).filter(Boolean))] as string[];
        const milestones = shipmentNos.length
            ? await this._db.shipmentMilestone.findMany({
                where: { ShipmentNo: { in: shipmentNos } },
                select: { ShipmentNo: true, ShipmentMilestoneSid: true, MilestoneName: true },
                orderBy: { ShipmentMilestoneSid: 'desc' },
            })
            : [];

        const milestoneMap = new Map(milestones.map(m => [m.ShipmentNo, m]));



        const formattedItems = items.map(item => ({
            ...item,
            Milestone: item.ShipmentNo && milestoneMap.get(item.ShipmentNo) || null,
        }));

        return { items: formattedItems, totalCount };
    }
}
