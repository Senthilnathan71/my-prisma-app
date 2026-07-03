import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { MilestoneMasterDTO } from 'src/masters/DTO/milestone.dto';
import {
    ShipmentMilestoneBookingFlowDTO,
    ShipmentMilestoneCheckExistDTO,
    ShipmentMilestoneCreateDTO,
    ShipmentMilestoneFetchDTO,
    ShipmentMilestoneFetchWithCodeDTO,
    ShipmentMilestoneInsertByMasterJobDTO,
    ShipmentMilestoneJobFlowDTO,
    ShipmentMilestoneResponseDTO,
    ShipmentMilestoneSafeInsertDTO,
    ShipmentMilestoneUpdateDTO,
} from 'src/operation/DTO/shipment-milestone.dto';
import { getShipmentMilestones } from './shipment-milestone.helper';

@Injectable()
export class ShipmentMilestoneService {
    constructor(private _db: DatabaseService) { }

    async getJobFlow(payload: ShipmentMilestoneJobFlowDTO) {
        const currentHouse = await this._db.houseJob.findFirst({
            where: {
                HouseJobSid: payload.houseJobSid,
                CompanyMasterSid: payload.companyMasterSid,
                BranchMasterSid: payload.branchMasterSid,
                BookingHeaderSid: payload.bookingHeaderSid ?? null,
                DepartmentMasterSid: payload.departmentMasterSid,
                status: 'A',
                deletedAt: null,
            },
            include: {
                bookingHeader: {
                    select: { TranshipmentHouseSid: true },
                },
                departmentMaster: {
                    select: { departmentName: true },
                },
            },
        });

        if (!currentHouse) {
            throw new BadRequestException('House Job not found for the supplied job identity');
        }

        const currentItems = await this.findExactHouseMilestones(currentHouse);
        let previousHouseJobSid = currentHouse.bookingHeader?.TranshipmentHouseSid ?? null;

        if (!previousHouseJobSid) {
            const transferMap = await this._db.auditLog.findFirst({
                where: {
                    tableName: 'HouseJobTransfer',
                    recordId: String(currentHouse.HouseJobSid),
                    operation: 'EXPORT_TO_IMPORT',
                },
                orderBy: { changedAt: 'desc' },
                select: { changes: true },
            });
            const changes = transferMap?.changes as Record<string, unknown> | null;
            const mappedSourceSid = Number(changes?.sourceHouseJobSid);
            previousHouseJobSid = Number.isInteger(mappedSourceSid) && mappedSourceSid > 0
                ? mappedSourceSid
                : null;
        }

        const previousHouse = previousHouseJobSid
            ? await this._db.houseJob.findFirst({
                where: {
                    HouseJobSid: previousHouseJobSid,
                    status: 'A',
                    deletedAt: null,
                },
                include: {
                    departmentMaster: {
                        select: { departmentName: true },
                    },
                },
            })
            : null;
        const previousItems = previousHouse
            ? await this.findExactHouseMilestones(previousHouse)
            : [];

        return {
            previousMilestones: {
                title: previousHouse
                    ? `Previous ${previousHouse.departmentMaster?.departmentName || 'Job'} Milestones`
                    : 'Previous Milestones',
                readonly: true,
                items: previousItems,
            },
            currentMilestones: {
                title: `Current ${currentHouse.departmentMaster?.departmentName || 'Job'} Milestones`,
                readonly: false,
                items: currentItems,
            },
        };
    }

    /**
     * Booking-screen milestone flow (before a House Job is generated).
     *
     * Current  = the booking's own milestones (BookingHeaderSid, HouseJobSid NULL) — editable.
     * Previous = for a Transhipment Export booking, the source Import House's milestones,
     *            resolved via BookingHeader.TranshipmentHouseSid — read-only.
     *
     * A non-transhipment booking has no TranshipmentHouseSid, so `previous` is empty and
     * the screen behaves exactly as before (only its own milestones).
     */
    async getBookingFlow(payload: ShipmentMilestoneBookingFlowDTO) {
        const booking = await this._db.bookingHeader.findFirst({
            where: {
                BookingHeaderSid: payload.bookingHeaderSid,
                CompanyMasterSid: payload.companyMasterSid,
                BranchMasterSid: payload.branchMasterSid,
                status: 'A',
                deletedAt: null,
            },
            include: {
                departmentMaster: {
                    select: { departmentName: true },
                },
            },
        });

        if (!booking) {
            throw new BadRequestException('Booking not found for the supplied identity');
        }

        // Editable: the booking's own milestones, matched by BookingHeaderSid (same as the
        // existing booking fetch), scoped by Company + Branch, ordered by master SortBy.
        const currentItems = await getShipmentMilestones(this._db, {
            BookingHeaderSid: booking.BookingHeaderSid,
            CompanyMasterSid: payload.companyMasterSid,
            BranchMasterSid: payload.branchMasterSid,
        });

        // Read-only: the Transhipment source Import House milestones, if this is an
        // Export booking generated from an Import House.
        const previousHouse = booking.TranshipmentHouseSid
            ? await this._db.houseJob.findFirst({
                where: {
                    HouseJobSid: booking.TranshipmentHouseSid,
                    status: 'A',
                    deletedAt: null,
                },
                include: {
                    departmentMaster: {
                        select: { departmentName: true },
                    },
                },
            })
            : null;
        const previousItems = previousHouse
            ? await this.findExactHouseMilestones(previousHouse)
            : [];

        return {
            previousMilestones: {
                title: previousHouse
                    ? `Previous ${previousHouse.departmentMaster?.departmentName || 'Job'} Milestones`
                    : 'Previous Milestones',
                readonly: true,
                items: previousItems,
            },
            currentMilestones: {
                title: `Current ${booking.departmentMaster?.departmentName || 'Job'} Milestones`,
                readonly: false,
                items: currentItems,
            },
        };
    }

    private async findExactHouseMilestones(house: {
        HouseJobSid: number;
        CompanyMasterSid: number;
        BranchMasterSid: number | null;
        BookingHeaderSid: number | null;
        DepartmentMasterSid: number;
    }) {
        if (house.BranchMasterSid == null) {
            throw new BadRequestException(`Branch is missing for HouseJobSid ${house.HouseJobSid}`);
        }

        const rows = await this._db.shipmentMilestone.findMany({
            where: {
                CompanyMasterSid: house.CompanyMasterSid,
                BranchMasterSid: house.BranchMasterSid,
                BookingHeaderSid: house.BookingHeaderSid,
                HouseJobSid: house.HouseJobSid,
                Status: 'A',
                deletedAt: null,
                houseJob: {
                    is: {
                        DepartmentMasterSid: house.DepartmentMasterSid,
                    },
                },
            },
        });
        const masterSids = [...new Set(rows.map(row => row.MilestoneMasterSid))];
        const masters = masterSids.length
            ? await this._db.milestoneMaster.findMany({
                where: { MilestoneMasterSid: { in: masterSids } },
                select: { MilestoneMasterSid: true, SortBy: true },
            })
            : [];
        const sortMap = new Map(masters.map(item => [
            item.MilestoneMasterSid,
            Number(item.SortBy),
        ]));

        return rows
            .sort((left, right) => {
                const leftSort = sortMap.get(left.MilestoneMasterSid) ?? Number.MAX_SAFE_INTEGER;
                const rightSort = sortMap.get(right.MilestoneMasterSid) ?? Number.MAX_SAFE_INTEGER;
                return leftSort - rightSort ||
                    left.MilestoneDate.getTime() - right.MilestoneDate.getTime();
            })
            // Attach the configured SortBy so the frontend can order reliably by the row's
            // own value (its master may not be in the department dropdown it uses for lookup).
            .map(row => ({ ...row, SortBy: sortMap.get(row.MilestoneMasterSid) ?? null }));
    }

    async getShipmentMilestoneByShipmentNo(
        payload: ShipmentMilestoneFetchDTO,
        prisma?: PrismaClient | Prisma.TransactionClient,
    ): Promise<ShipmentMilestoneResponseDTO> {
        try {
            const tx = prisma || this._db;
            const { ShipmentNo, CompanyMasterSid, BranchMasterSid } = payload;

            const shipmentMilestone = await tx.shipmentMilestone.findFirst({
                where: {
                    ShipmentNo: ShipmentNo,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    Status: 'A',
                },
            });

            if (!shipmentMilestone) {
                throw new BadRequestException('Shipment Milestone not found');
            }

            return shipmentMilestone;
        } catch (error) {
            throw error;
        }
    }

    async createShipmentMilestone(
        payload: ShipmentMilestoneCreateDTO,
        prisma?: PrismaClient | Prisma.TransactionClient,
    ): Promise<ShipmentMilestoneResponseDTO> {
        try {
            const tx = prisma || this._db;
            await this.validateMilestoneOwnership(tx, payload);

            const newShipmentMilestone = await tx.shipmentMilestone.create({
                data: payload,
            });

            return newShipmentMilestone;
        } catch (error) {
            throw error;
        }
    }

    async updateShipmentMilestone(
        ShipmentMilestoneSid: number,
        payload: ShipmentMilestoneUpdateDTO,
        prisma?: PrismaClient | Prisma.TransactionClient,
    ): Promise<ShipmentMilestoneResponseDTO> {
        try {
            const tx = prisma || this._db;
            if (!payload.CompanyMasterSid || !payload.BranchMasterSid) {
                throw new BadRequestException('CompanyMasterSid and BranchMasterSid are required for milestone update');
            }
            const existing = await tx.shipmentMilestone.findFirst({
                where: {
                    ShipmentMilestoneSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    deletedAt: null,
                },
            });
            if (!existing) {
                throw new BadRequestException('Shipment Milestone not found for the supplied company and branch');
            }
            await this.validateMilestoneOwnership(tx, {
                ...existing,
                ...payload,
            });

            const shipmentMilestone = await tx.shipmentMilestone.update({
                where: {
                    ShipmentMilestoneSid: ShipmentMilestoneSid,
                },
                data: payload,
            });

            return shipmentMilestone;
        } catch (error) {
            throw error;
        }
    }

    async getMilestoneByCode(
        payload: ShipmentMilestoneFetchWithCodeDTO,
        prisma?: PrismaClient | Prisma.TransactionClient,
    ): Promise<MilestoneMasterDTO> {
        try {
            const {
                CompanyMasterSid,
                BranchMasterSid,
                DepartmentName,
                JobType,
                MilestoneCode,
            } = payload;

            const tx = prisma || this._db;

            const milestone = await tx.milestoneMaster.findFirst({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    // MilestoneMaster is company-level (not differentiated by branch)
                    DepartmentMasterSid: { has: DepartmentName },
                    ShipmentType: JobType,
                    MilestoneCode: MilestoneCode,
                    status: 'A',
                },
            });

            if (!milestone) {
                throw new BadRequestException('Milestone not found');
            }

            return milestone;
        } catch (error) {
            throw error;
        }
    }

    async checkIfAlreadyShipmentMilestoneExist(
        payload: ShipmentMilestoneCheckExistDTO,
        prisma?: PrismaClient | Prisma.TransactionClient,
    ): Promise<Boolean> {
        try {
            const {
                CompanyMasterSid,
                BranchMasterSid,
                ShipmentNo,
                MilestoneMasterSid,
                HouseJobSid,
                BookingHeaderSid,
            } = payload;

            const tx = prisma || this._db;

            const identityWhere = HouseJobSid != null
                ? { HouseJobSid }
                : BookingHeaderSid != null
                    ? { BookingHeaderSid, HouseJobSid: null }
                    : { ShipmentNo };

            const shipmentMilestone = await tx.shipmentMilestone.findFirst({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    ...identityWhere,
                    MilestoneMasterSid: MilestoneMasterSid,
                    Status: 'A',
                    deletedAt: null,
                },
            });

            // If already a milestone exist for the same Shipment No, return false
            if (!shipmentMilestone) {
                return false;
            } else {
                return true;
            }
        } catch (error) {
            throw error;
        }
    }

    async deleteShipmentMilestone(
        ShipmentMilestoneSid: number,
        CompanyMasterSid: number,
        BranchMasterSid: number,
        prisma?: PrismaClient | Prisma.TransactionClient,
    ) {
        try {
            const tx = prisma || this._db;
            const exist = await tx.shipmentMilestone.findFirst({
                where: {
                    ShipmentMilestoneSid: ShipmentMilestoneSid,
                    CompanyMasterSid,
                    BranchMasterSid,
                    deletedAt: null,
                },
            });
            if (!exist) {
                throw new BadRequestException('Shipment Milestone not found');
            }
            if (exist.Status === 'D') {
                throw new BadRequestException('Shipment Milestone is already deleted');
            }
            const deletedShipmentMilestone = await tx.shipmentMilestone.update({
                where: {
                    ShipmentMilestoneSid: ShipmentMilestoneSid,
                },
                data: {
                    Status: 'D',
                },
            });
            return deletedShipmentMilestone;
        } catch (error) {
            throw error;
        }
    }

    async safeInsertShipmentMilestone(
        payload: ShipmentMilestoneSafeInsertDTO,
        prisma?: PrismaClient | Prisma.TransactionClient,
    ) {
        try {
            const tx = prisma || this._db;

            // Check if already a milestone exist for the same Shipment No
            const milestone = await this.getMilestoneByCode({
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                DepartmentName: payload.DepartmentName,
                JobType: payload.JobType,
                MilestoneCode: payload.MilestoneCode
            }, tx);

            if (!milestone) {
                throw new BadRequestException(`Milestone not found for the provided code ${payload.MilestoneCode}`);
            }

            const alreadyExist = await this.checkIfAlreadyShipmentMilestoneExist({
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                ShipmentNo: payload.ShipmentNo,
                MilestoneMasterSid: milestone.MilestoneMasterSid,
                HouseJobSid: payload.HouseJobSid,
                BookingHeaderSid: payload.BookingHeaderSid,
            }, tx);

            if (alreadyExist) {
                throw new BadRequestException(`Shipment Milestone already exist for ${payload.ShipmentNo}`);
            }
            const insertedMilestone = await this.createShipmentMilestone({
                ShipmentNo: payload.ShipmentNo,
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                CreatedBy: payload.createdBy,
                Status: 'A',
                MilestoneMasterSid: milestone.MilestoneMasterSid,
                MilestoneName: milestone.MilestoneName,
                MilestoneDate: payload.MilestoneDate || new Date(),
                AutoCaptured: 'Y',
                Remarks: payload.Remarks || "System auto inserted",
                BookingHeaderSid: payload.BookingHeaderSid ?? null,
                HouseJobSid: payload.HouseJobSid ?? null
            }, tx);

            return insertedMilestone;
        } catch (error) {
            throw error;
        }
    }

    async insertMilestoneByMasterJob(
        payload: ShipmentMilestoneInsertByMasterJobDTO,
        prisma?: PrismaClient | Prisma.TransactionClient,
    ) {
        try {
            const tx = prisma || this._db;

            const houseJobs = await tx.houseJob.findMany({
                where: {
                    MasterJobSid: payload.MasterJobSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    status: 'A',
                },
                select: {
                    HouseJobSid: true,
                    BookingHeaderSid: true,
                    ShipmentNo: true,
                    JobType: true,
                    departmentMaster: {
                        select: {
                            departmentName: true,
                        },
                    },
                },
            });

            if (!houseJobs.length) {
                throw new BadRequestException(`No house jobs found for MasterJobSid ${payload.MasterJobSid}`);
            }

            let insertedCount = 0;
            let skippedCount = 0;
            let missingMilestoneConfigCount = 0;

            for (const house of houseJobs) {
                const shipmentNo = (house.ShipmentNo || '').trim();
                if (!shipmentNo) {
                    skippedCount++;
                    continue;
                }

                const departmentName = house.departmentMaster?.departmentName;
                const jobType = house.JobType || undefined;

                let milestone : any = null;
                if (departmentName && jobType) {
                    milestone = await tx.milestoneMaster.findFirst({
                        where: {
                            CompanyMasterSid: payload.CompanyMasterSid,
                            // MilestoneMaster is company-level (not differentiated by branch)
                            DepartmentMasterSid: { has: departmentName },
                            ShipmentType: jobType,
                            MilestoneCode: payload.MilestoneCode,
                            status: 'A',
                        },
                    });
                }

                if (!milestone) {
                    milestone = await tx.milestoneMaster.findFirst({
                        where: {
                            CompanyMasterSid: payload.CompanyMasterSid,
                            // MilestoneMaster is company-level (not differentiated by branch)
                            MilestoneCode: payload.MilestoneCode,
                            status: 'A',
                        },
                    });
                }

                if (!milestone) {
                    missingMilestoneConfigCount++;
                    skippedCount++;
                    continue;
                }

                const alreadyExist = await tx.shipmentMilestone.findFirst({
                    where: {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        HouseJobSid: house.HouseJobSid,
                        MilestoneMasterSid: milestone.MilestoneMasterSid,
                        Status: 'A',
                    },
                });

                if (alreadyExist) {
                    skippedCount++;
                    continue;
                }

                await tx.shipmentMilestone.create({
                    data: {
                        ShipmentNo: shipmentNo,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        CreatedBy: payload.createdBy,
                        Status: 'A',
                        MilestoneMasterSid: milestone.MilestoneMasterSid,
                        MilestoneName: milestone.MilestoneName,
                        MilestoneDate: payload.MilestoneDate || new Date(),
                        AutoCaptured: 'Y',
                        Remarks: payload.Remarks || 'System auto inserted',
                        HouseJobSid: house.HouseJobSid,
                        BookingHeaderSid: house.BookingHeaderSid ?? null,
                    },
                });
                insertedCount++;
            }

            return {
                MasterJobSid: payload.MasterJobSid,
                MilestoneCode: payload.MilestoneCode,
                totalHouseJobs: houseJobs.length,
                insertedCount,
                skippedCount,
                missingMilestoneConfigCount,
            };
        } catch (error) {
            throw error;
        }
    }

    private async validateMilestoneOwnership(
        tx: PrismaClient | Prisma.TransactionClient,
        payload: {
            CompanyMasterSid: number;
            BranchMasterSid: number;
            MilestoneMasterSid: number;
            HouseJobSid?: number | null;
            BookingHeaderSid?: number | null;
        },
    ): Promise<void> {
        const milestoneMaster = await tx.milestoneMaster.findFirst({
            where: {
                MilestoneMasterSid: payload.MilestoneMasterSid,
                CompanyMasterSid: payload.CompanyMasterSid,
                status: 'A',
            },
            select: { MilestoneMasterSid: true },
        });
        if (!milestoneMaster) {
            throw new BadRequestException('Milestone master does not belong to the supplied company and branch');
        }

        if (payload.HouseJobSid != null) {
            const houseJob = await tx.houseJob.findFirst({
                where: {
                    HouseJobSid: payload.HouseJobSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    status: 'A',
                    deletedAt: null,
                },
                select: { HouseJobSid: true },
            });
            if (!houseJob) {
                throw new BadRequestException('House Job does not belong to the supplied company and branch');
            }
        }

        if (payload.BookingHeaderSid != null) {
            const booking = await tx.bookingHeader.findFirst({
                where: {
                    BookingHeaderSid: payload.BookingHeaderSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    status: 'A',
                    deletedAt: null,
                },
                select: { BookingHeaderSid: true },
            });
            if (!booking) {
                throw new BadRequestException('Booking does not belong to the supplied company and branch');
            }
        }
    }
}
