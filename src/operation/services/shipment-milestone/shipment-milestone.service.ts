import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { MilestoneMasterDTO } from 'src/masters/DTO/milestone.dto';
import {
    ShipmentMilestoneCheckExistDTO,
    ShipmentMilestoneCreateDTO,
    ShipmentMilestoneFetchDTO,
    ShipmentMilestoneFetchWithCodeDTO,
    ShipmentMilestoneResponseDTO,
    ShipmentMilestoneSafeInsertDTO,
    ShipmentMilestoneUpdateDTO,
} from 'src/operation/DTO/shipment-milestone.dto';

@Injectable()
export class ShipmentMilestoneService {
    constructor(private _db: DatabaseService) { }

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
                    BranchMasterSid: BranchMasterSid,
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
            } = payload;

            const tx = prisma || this._db;

            // Check if already a milestone exist for the same Shipment No
            const shipmentMilestone = await tx.shipmentMilestone.findFirst({
                where: {
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    ShipmentNo: ShipmentNo,
                    MilestoneMasterSid: MilestoneMasterSid,
                    Status: 'A',
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
        prisma?: PrismaClient | Prisma.TransactionClient,
    ) {
        try {
            const tx = prisma || this._db;
            const exist = await tx.shipmentMilestone.findUnique({
                where: {
                    ShipmentMilestoneSid: ShipmentMilestoneSid,
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
                MilestoneMasterSid: milestone.MilestoneMasterSid
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
                HouseJobSid: null
            }, tx);

            return insertedMilestone;
        } catch (error) {
            throw error;
        }
    }
}
