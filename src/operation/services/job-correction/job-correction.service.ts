import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/settings/services/menu/menu.service';

/**
 * Job Correction
 * -------------------------------------------------------------------------
 * Corrects a small, fixed set of shipment fields on an existing Master Job
 * and cascades them down the chain:
 *
 *      MasterJob ── (MasterJobVoyage / MasterJobContainer children)
 *         │  MasterJobSid
 *         ▼
 *      HouseJob (POL/POD/Vessel/Voy/ETD/ETA inline, container on HouseJobProduct)
 *         │  BookingHeaderSid (1:1)
 *         ▼
 *      BookingHeader (POL/POD/Vessel/Voy/ETD/ETA inline)
 *
 * Only these fields are touched: Job Date, POL, POD, Vessel/Voyage, ETD, ETA,
 * Container No. Nothing else on the job/house/booking is modified.
 */
@Injectable()
export class JobCorrectionService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
        private menuMasterService: MenuService,
    ) { }

    /**
     * Search master jobs for correction by Job No or MBL/MAWB No.
     * Covers BOTH sea (Master Job menu, MBL) and air (Master Air Waybill menu, MAWB)
     * because those job types live under different menus. Scoped by company/branch.
     */
    async searchJobs(payload: any) {
        if (!payload?.CompanyMasterSid) {
            throw new BadRequestException('Company Master Sid is required');
        }
        if (!payload?.BranchMasterSid) {
            throw new BadRequestException('Branch Master Sid is required');
        }
        const search = String(payload.search ?? '').trim();
        if (!search) {
            throw new BadRequestException('Enter Job No or MBL / MAWB No to search');
        }

        // Resolve every master-job-style menu by name (non-fatal if one is missing),
        // so the search covers Sea (Master Job), Air (Master Air Waybill),
        // Service Job and Agent Master Air Waybill jobs — all stored in masterJob.
        const menuNames = [
            'Master Job',
            'Master Air Waybill',
            'Service Job',
            'Agent Master Air Waybill',
            'AgentMaster Air Waybill', // alternate spelling used in some setups
        ];
        const resolved = await Promise.all(
            menuNames.map((name) => this.menuMasterService.getMenuSidByName(name).catch(() => null)),
        );
        const menuSids = [...new Set(resolved.filter((v): v is number => typeof v === 'number'))];

        const jobs = await this._db.masterJob.findMany({
            where: {
                CompanyMasterSid: Number(payload.CompanyMasterSid),
                BranchMasterSid: Number(payload.BranchMasterSid),
                Status: { in: ['A', 'S'] },
                ...(menuSids.length ? { MenuMasterSid: { in: menuSids } } : {}),
                OR: [
                    { MasterJobNumber: { contains: search, mode: 'insensitive' } },
                    { MBLNo: { contains: search, mode: 'insensitive' } },
                ],
            },
            select: {
                MasterJobSid: true,
                MasterJobNumber: true,
                MBLNo: true,
                MBLDate: true,
                POL: true,
                POD: true,
                DepartmentMasterSid: true,
                MenuMasterSid: true,
            },
            take: 50,
            orderBy: { MasterJobDate: 'desc' },
        });

        // Attach department type so the UI can label MBL vs MAWB (air vs sea).
        const deptSids = [...new Set(jobs.map((j) => j.DepartmentMasterSid).filter((v) => v != null))];
        const depts = deptSids.length
            ? await this._db.departmentMaster.findMany({
                where: { DepartmentMasterSid: { in: deptSids as number[] } },
                select: { DepartmentMasterSid: true, departmentName: true, departmentType: true },
            })
            : [];
        const deptMap = new Map(depts.map((d) => [d.DepartmentMasterSid, d]));

        return jobs.map((j) => {
            const dept = deptMap.get(j.DepartmentMasterSid);
            const isAir = String(dept?.departmentType ?? '').trim().toUpperCase() === 'AIR';
            return {
                ...j,
                departmentName: dept?.departmentName ?? '',
                departmentType: dept?.departmentType ?? '',
                isAir,
            };
        });
    }

    async correctJob(payload: any) {
        if (!payload?.MasterJobSid) {
            throw new BadRequestException('Master Job Sid is required');
        }
        if (!payload?.CompanyMasterSid) {
            throw new BadRequestException('Company Master Sid is required');
        }
        if (!payload?.BranchMasterSid) {
            throw new BadRequestException('Branch Master Sid is required');
        }

        const masterJobSid = Number(payload.MasterJobSid);

        // Resolve the screen's MenuMasterSid the same way other screens do.
        // Non-fatal: the correction is scoped by company/branch/MasterJobSid, so a
        // missing menu row must not block the update.
        let menuMasterSid: number | null = null;
        try {
            menuMasterSid = await this.menuMasterService.getMenuSidByName(
                payload.screenName || 'Job Correction',
            );
        } catch {
            menuMasterSid = null;
        }
        this.logger.log(
            `Job Correction for MasterJobSid ${masterJobSid} (Menu ${menuMasterSid}) : ${JSON.stringify(payload)}`,
        );

        return this._db.$transaction(async (prisma) => {
            // Master job must exist and belong to the caller's company/branch.
            const masterJob = await prisma.masterJob.findFirst({
                where: {
                    MasterJobSid: masterJobSid,
                    CompanyMasterSid: Number(payload.CompanyMasterSid),
                    BranchMasterSid: Number(payload.BranchMasterSid),
                },
                select: { MasterJobSid: true },
            });
            if (!masterJob) {
                throw new BadRequestException('Master Job not found for this company / branch');
            }

            const now = new Date();
            const updatedBy = payload.updatedBy || payload.createdBy || null;

            // ---- Provided-field detection -----------------------------------
            // The screen loads current values and posts back everything, but we
            // only write a column when the key is actually present so a missing
            // key never blanks existing data.
            const has = (key: string) => payload[key] !== undefined && payload[key] !== null;
            const asDate = (v: any) => (v ? new Date(v) : null);

            // ---- 1) Master Job header (Job Date / POL / POD) ----------------
            const masterData: any = { UpdatedBy: updatedBy, UpdatedOn: now };
            if (has('MasterJobDate')) masterData.MasterJobDate = asDate(payload.MasterJobDate);
            if (has('POL')) masterData.POL = payload.POL;
            if (has('POD')) masterData.POD = payload.POD;

            const updatedMasterJob = await prisma.masterJob.update({
                where: { MasterJobSid: masterJobSid },
                data: masterData,
            });

            // ---- 2) Master Job Voyage (Vessel / Voyage / ETD / ETA) ---------
            // Vessel/Voy/ETD/ETA live on the MasterJobVoyage child, not on the
            // master header. Update the existing voyage row for this master.
            const voyageData: any = {};
            if (has('VoyageMasterSid')) voyageData.VoyageMasterSid = Number(payload.VoyageMasterSid);
            if (has('VesselName')) voyageData.VesselName = payload.VesselName;
            if (has('VoyageNo')) voyageData.VoyageNo = payload.VoyageNo;
            if (has('ETD')) voyageData.ETD = asDate(payload.ETD);
            if (has('ETA')) voyageData.ETA = asDate(payload.ETA);

            if (Object.keys(voyageData).length > 0) {
                voyageData.UpdatedBy = updatedBy;
                voyageData.UpdatedOn = now;
                if (payload.MasterJobVoyageSid) {
                    await prisma.masterJobVoyage.update({
                        where: { MasterJobVoyageSid: Number(payload.MasterJobVoyageSid) },
                        data: voyageData,
                    });
                } else {
                    // Fall back to the master's voyage row(s) if no sid was posted.
                    await prisma.masterJobVoyage.updateMany({
                        where: { MasterJobSid: masterJobSid },
                        data: voyageData,
                    });
                }
            }

            // ---- 3) Container numbers ---------------------------------------
            // Container No. has a real table only at master level
            // (MasterJobContainer). House-level numbers are denormalised onto
            // HouseJobProduct.ContainerNo and linked back via MasterJobContainerSid,
            // so we cascade precisely by that link. Bookings have no container.
            const containers: any[] = Array.isArray(payload.containers) ? payload.containers : [];
            for (const container of containers) {
                if (!container?.MasterJobContainerSid) continue;
                const containerSid = Number(container.MasterJobContainerSid);
                const newContainerNo = String(container.ContainerNumber ?? '').trim();
                if (!newContainerNo) continue;

                await prisma.masterJobContainer.update({
                    where: { MasterJobContainerSid: containerSid },
                    data: { ContainerNumber: newContainerNo, UpdatedBy: updatedBy, UpdatedOn: now },
                });

                // Cascade the corrected number onto the house product lines that
                // reference this master container.
                await prisma.houseJobProduct.updateMany({
                    where: { MasterJobContainerSid: containerSid, status: 'A' },
                    data: { ContainerNo: newContainerNo, updatedBy: updatedBy },
                });
            }

            // ---- 4) Cascade shipment fields to House Jobs -------------------
            // POL/POD/Vessel/Voy/ETD/ETA are stored inline on the house job.
            const shipmentData: any = {};
            if (has('POL')) shipmentData.POL = payload.POL;
            if (has('POD')) shipmentData.POD = payload.POD;
            if (has('VoyageMasterSid')) shipmentData.VoyageMasterSid = Number(payload.VoyageMasterSid);
            if (has('VesselName')) shipmentData.VesselName = payload.VesselName;
            if (has('VoyageNo')) shipmentData.VoyageNo = payload.VoyageNo;
            if (has('ETD')) shipmentData.ETD = asDate(payload.ETD);
            if (has('ETA')) shipmentData.ETA = asDate(payload.ETA);

            let houseJobsUpdated = 0;
            let bookingsUpdated = 0;

            if (Object.keys(shipmentData).length > 0) {
                const houseData = { ...shipmentData, updatedBy: updatedBy, updatedOn: now };
                const houseResult = await prisma.houseJob.updateMany({
                    where: { MasterJobSid: masterJobSid, status: 'A' },
                    data: houseData,
                });
                houseJobsUpdated = houseResult.count;

                // ---- 5) Cascade to the Booking connected under each house job -
                const houseJobs = await prisma.houseJob.findMany({
                    where: {
                        MasterJobSid: masterJobSid,
                        status: 'A',
                        BookingHeaderSid: { not: null },
                    },
                    select: { BookingHeaderSid: true },
                });

                const bookingData = { ...shipmentData, updatedBy: updatedBy, updatedOn: now };
                await Promise.all(
                    houseJobs.map((hj) =>
                        prisma.bookingHeader
                            .update({
                                where: { BookingHeaderSid: hj.BookingHeaderSid! },
                                data: bookingData,
                            })
                            .then(() => {
                                bookingsUpdated += 1;
                            })
                            .catch((err) =>
                                this.logger.warn(
                                    `Job Correction: booking ${hj.BookingHeaderSid} update failed - ${err}`,
                                ),
                            ),
                    ),
                );
            }

            return {
                MasterJobSid: updatedMasterJob.MasterJobSid,
                houseJobsUpdated,
                bookingsUpdated,
                containersUpdated: containers.length,
            };
        });
    }
}
