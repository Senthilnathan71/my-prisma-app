import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
    MilestoneTrackerFetchDTO,
    MilestoneTrackerSearchDTO,
    MilestoneTrackerSubmitDTO,
} from 'src/operation/DTO/milestone-tracker.dto';

@Injectable()
export class MilestoneTrackerService {
    constructor(private _db: DatabaseService) { }

    /**
     * Build the lightweight header summary shown above the milestone panels.
     */
    private toHeader(house: any) {
        return {
            HouseJobSid: house.HouseJobSid,
            // The House Job milestone tab loads milestones by the *booking
            // header's* ShipmentNo, which can differ from (and outlive) the
            // HouseJob's own ShipmentNo. Use it as the effective shipment number
            // so milestones saved here reconcile with that tab.
            ShipmentNo:
                house.bookingHeader?.ShipmentNo || house.ShipmentNo || '',
            BookingNo: house.BookingNo,
            HBLNo: house.HBLNo,
            // MBL No is carried on the Master Job the house is attached to, not
            // the HouseJob itself — take it from there, falling back to the
            // house's own MBLNo only when there is no master job.
            MBLNo: house.masterJob?.MBLNo ?? house.MBLNo,
            MasterJobNumber: house.masterJob?.MasterJobNumber ?? null,
            BookingHeaderSid: house.BookingHeaderSid,
            JobType: house.JobType,
            ShipperName: house.ShipperName,
            CustomerName: house.CustomerName,
            VesselName: house.VesselName,
            VoyageNo: house.VoyageNo,
            ETD: house.ETD,
            ETA: house.ETA,
            // Surface the department SID (not just the name) so the achieved
            // panel can reuse the shared milestone/job-flow fetch.
            DepartmentMasterSid: house.DepartmentMasterSid,
            DepartmentName: house.departmentMaster?.departmentName ?? null,
        };
    }

    /**
     * Find house shipments matching the HBL or MBL reference (case-insensitive).
     * HBL typically resolves to a single house; MBL may resolve to several, in
     * which case the UI shows a picker.
     */
    async searchHouses(dto: MilestoneTrackerSearchDTO) {
        const { Ref, Type, CompanyMasterSid, BranchMasterSid } = dto;
        const ref = Ref.trim();

        const where: any = {
            CompanyMasterSid,
            BranchMasterSid,
            status: 'A',
        };
        if (Type === 'hbl') {
            where.HBLNo = { equals: ref, mode: 'insensitive' };
        } else if (Type === 'mbl') {
            where.MBLNo = { equals: ref, mode: 'insensitive' };
        } else {
            where.masterJob = {
                MasterJobNumber: { equals: ref, mode: 'insensitive' },
            };
        }

        const houses = await this._db.houseJob.findMany({
            where,
            select: {
                HouseJobSid: true,
                ShipmentNo: true,
                BookingNo: true,
                HBLNo: true,
                MBLNo: true,
                BookingHeaderSid: true,
                JobType: true,
                ShipperName: true,
                CustomerName: true,
                VesselName: true,
                VoyageNo: true,
                ETD: true,
                ETA: true,
                DepartmentMasterSid: true,
                departmentMaster: { select: { departmentName: true } },
                masterJob: { select: { MasterJobNumber: true, MBLNo: true } },
                bookingHeader: { select: { ShipmentNo: true } },
            },
            orderBy: { HouseJobSid: 'asc' },
        });

        if (!houses.length) {
            const label =
                Type === 'masterjob' ? 'Master Job No' : `${Type.toUpperCase()} No`;
            throw new BadRequestException(
                `No shipment found for ${label} : ${ref}`,
            );
        }

        return houses.map((h) => this.toHeader(h));
    }

    /**
     * Resolve a single house and return its header summary plus the department(s)
     * whose milestones the pending list should cover.
     *
     * The milestone lists themselves are not returned here — the frontend sources
     * the applicable master milestones from the shared ff-booking/milestone API
     * (the same list the House Job milestone tab uses) and the achieved
     * milestones from the milestone/job-flow API, then shows as pending only
     * those that fall after the last achieved milestone (by SortBy).
     *
     * `milestoneDepartments` covers BOTH directions of the shipment's department:
     * the current department and its opposite-direction sibling of the SAME mode
     * — e.g. an LCL Import job also shows LCL Export (never FCL or Air). Returned
     * as both names and SIDs so the milestone filter matches masters tagged
     * either way.
     */
    async getMilestones(dto: MilestoneTrackerFetchDTO) {
        const { HouseJobSid, CompanyMasterSid, BranchMasterSid } = dto;

        const house = await this._db.houseJob.findFirst({
            where: { HouseJobSid, CompanyMasterSid, BranchMasterSid, status: 'A' },
            select: {
                HouseJobSid: true,
                ShipmentNo: true,
                BookingNo: true,
                HBLNo: true,
                MBLNo: true,
                BookingHeaderSid: true,
                JobType: true,
                ShipperName: true,
                CustomerName: true,
                VesselName: true,
                VoyageNo: true,
                ETD: true,
                ETA: true,
                DepartmentMasterSid: true,
                departmentMaster: { select: { departmentName: true } },
                masterJob: { select: { MasterJobNumber: true, MBLNo: true } },
                bookingHeader: { select: { ShipmentNo: true } },
            },
        });

        if (!house) {
            throw new BadRequestException('Shipment not found');
        }

        const header = this.toHeader(house);
        const milestoneDepartments = await this.resolveMilestoneDepartments(
            house,
            CompanyMasterSid,
        );

        return { header, milestoneDepartments };
    }

    /**
     * Department names + SIDs whose milestones the pending list should span: the
     * current department and its opposite-direction sibling of the SAME mode
     * (e.g. "LCL Import" -> "LCL Export"). Pairing is by the department name's
     * direction word, so an LCL job stays paired only with its LCL counterpart —
     * never FCL or Air. If no direction word is present, only the current
     * department is returned.
     */
    private async resolveMilestoneDepartments(
        house: {
            DepartmentMasterSid: number | null;
            departmentMaster: { departmentName: string | null } | null;
        },
        CompanyMasterSid: number,
    ): Promise<{ names: string[]; sids: number[] }> {
        const names = new Set<string>();
        const sids = new Set<number>();

        const currentName = house.departmentMaster?.departmentName?.trim();
        if (currentName) names.add(currentName);
        if (house.DepartmentMasterSid != null) sids.add(house.DepartmentMasterSid);

        const siblingName = this.oppositeDirectionName(currentName);
        if (siblingName) {
            const sibling = await this._db.departmentMaster.findFirst({
                where: {
                    CompanyMasterSid,
                    Status: 'A',
                    deletedAt: null,
                    departmentName: { equals: siblingName, mode: 'insensitive' },
                },
                select: { DepartmentMasterSid: true, departmentName: true },
            });
            names.add(sibling?.departmentName?.trim() || siblingName);
            if (sibling?.DepartmentMasterSid != null) {
                sids.add(sibling.DepartmentMasterSid);
            }
        }

        return { names: [...names], sids: [...sids] };
    }

    /**
     * The opposite-direction department name of the same mode: swaps the
     * Import/Export word in the name ("LCL Import" <-> "LCL Export"). Returns null
     * when the name carries no direction word.
     */
    private oppositeDirectionName(name: string | null | undefined): string | null {
        const value = (name || '').trim();
        if (!value) return null;
        if (/import/i.test(value)) return value.replace(/import/gi, 'Export');
        if (/export/i.test(value)) return value.replace(/export/gi, 'Import');
        return null;
    }

    /**
     * Persist the milestones the user filled in on the Pending panel, then
     * return the refreshed header. Runs in one transaction; milestones already
     * recorded for the shipment are skipped (idempotent).
     */
    async submit(dto: MilestoneTrackerSubmitDTO) {
        const {
            ShipmentNo,
            HouseJobSid,
            BookingHeaderSid,
            CompanyMasterSid,
            BranchMasterSid,
            CreatedBy,
            Items,
        } = dto;

        const shipmentNo = (ShipmentNo || '').trim();
        const matchKeys: any[] = [{ HouseJobSid }];
        if (shipmentNo) {
            matchKeys.push({ ShipmentNo: shipmentNo });
        }

        await this._db.$transaction(async (tx) => {
            for (const item of Items) {
                // Skip if this milestone is already recorded for the house —
                // either against HouseJobSid or its ShipmentNo (auto-captured).
                const alreadyExist = await tx.shipmentMilestone.findFirst({
                    where: {
                        CompanyMasterSid,
                        BranchMasterSid,
                        MilestoneMasterSid: item.MilestoneMasterSid,
                        Status: 'A',
                        OR: matchKeys,
                    },
                });

                if (alreadyExist) {
                    // Skip rather than fail the whole submit – it is already achieved.
                    continue;
                }

                await tx.shipmentMilestone.create({
                    data: {
                        ShipmentNo: shipmentNo,
                        CompanyMasterSid,
                        BranchMasterSid,
                        CreatedBy,
                        Status: 'A',
                        MilestoneMasterSid: item.MilestoneMasterSid,
                        MilestoneName: item.MilestoneName,
                        MilestoneDate: item.MilestoneDate,
                        AutoCaptured: 'N',
                        Remarks: item.Remarks ?? null,
                        HouseJobSid: HouseJobSid,
                        BookingHeaderSid: BookingHeaderSid ?? null,
                    },
                });
            }
        });

        return this.getMilestones({ HouseJobSid, CompanyMasterSid, BranchMasterSid });
    }
}
