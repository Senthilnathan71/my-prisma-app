import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/settings/services/menu/menu.service';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';
import { OperationCommonService } from '../operation-common/operation-common.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { statusWhereClause } from 'src/common/helper';
import * as moment from 'moment-timezone';
import { DuplicateCheckDTO } from 'src/operation/DTO/service-job.dto';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

export class CreateServiceJobDto {
    FreightPPCC: string;
    FreightTerms: string;
    MBLNo?: string;
    MBLDate?: Date;
    HBLNo?: string;
    HBLDate?: Date;
    ShipmentNo?: string;
    JobType?: string;

    // HouseJob fields
    BookingNo: string;
    CustomerMasterSid: number;
    CustomerName: string;
    CustomerAddress: string;
    ShipperName: string;
    ShipperAddress: string;
    ConsigneeName: string;    
    ConsigneeAddress: string;
    CustomerBranchSid: number;

    // Related entities
    houseJobCargo: any;
    houseJobOthers: any;
    costRevenueCharges: any[];
    milestones?: any[];

    // Common fields
    DepartmentMasterSid: number;
    CompanyMasterSid: number;
    BranchMasterSid: number;
    POL: string;
    POD: string;
    status: string;
    createdBy: string;
    updatedBy: string;
}

// DTO for UpdateServiceJob payload
export class UpdateServiceJobDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
    DepartmentMasterSid: number;
    CustomerMasterSid: number;
    MBLNo?: string;
    MBLDate?: Date;
    JobType?: string;
    HBLNo?: string;
    HBLDate?: Date;
    ShipmentNo?: string;
    CustomerBranchSid: number;
    CustomerName: string;
    CustomerAddress: string;
    ShipperName: string;
    ShipperAddress: string;
    ConsigneeName: string;
    ConsigneeAddress: string;
    FreightPPCC: string;
    POL: string;
    POD: string;
    status: string;
    houseJobCargo: any;
    houseJobOthers: any;
    costRevenueCharges: any[];
    milestones?: any[];
    updatedBy: string;
}

@Injectable()
export class ServiceJobService {
    private readonly logger = new Logger(ServiceJobService.name);

    constructor(
        private readonly _db: DatabaseService,
        private readonly commonService: OperationCommonService,
        private readonly menuService: MenuService,
        private readonly numberSeriesService: NumberSeriesService,
    ) { }

    /**
     * Creates a new Service Job, which includes a MasterJob and a HouseJob.
     */
    async createServiceJob(payload: CreateServiceJobDto) {
        const { houseJobCargo, houseJobOthers, costRevenueCharges, milestones, ...mainPayload } = payload;

        // --- Pre-transaction: lookups and number generation ---

        // 1. Look up department
        const department = await this._db.departmentMaster.findUnique({
            where: { DepartmentMasterSid: mainPayload.DepartmentMasterSid },
            select: { departmentType: true }
        });

        if (!department) {
            throw new BadRequestException('Department not found.');
        }

        const documentDate = payload.MBLDate ? new Date(payload.MBLDate) : undefined;

        // 2. Generate Master Job number via NumberSeriesService
        const masterJobMenuId = await this.menuService.getMenuSidByName(
            department.departmentType?.toUpperCase() === 'AIR' ? "Master Air Waybill" : "Master Job"
        );
        const serviceJobMenuId = await this.menuService.getMenuSidByName("Service Job");

        let generatedMasterJobNumber: string | null = null;
        try {
            generatedMasterJobNumber = await this.numberSeriesService.generateNextNumber(
                mainPayload.CompanyMasterSid,
                mainPayload.BranchMasterSid,
                masterJobMenuId,
                mainPayload.DepartmentMasterSid,
                documentDate,
            );
        } catch (err) {
            this.logger.error(`[ServiceJob] MasterJob number generation failed: ${err.message}`);
        }

        // Fallback to legacy if config-based generation failed
        if (!generatedMasterJobNumber) {
            const dateString = moment().format('YYYYMMDD');
            const masterCount = await this._db.masterJob.count({
                where: { MasterJobNumber: { contains: dateString } }
            });
            generatedMasterJobNumber = `MASTER-${dateString}-${(masterCount + 1).toString().padStart(3, '0')}`;
        }

        // Payload MBLNo overrides generated number
        const finalMBLNo =
            payload.MBLNo && payload.MBLNo.trim() !== ''
                ? payload.MBLNo
                : generatedMasterJobNumber;

        // 3. Generate House Job HBL number via NumberSeriesService
        const houseJobMenuId = await this.menuService.getMenuSidByName(
            department.departmentType?.toUpperCase() === 'AIR' ? "House Air Waybill" : "House Job"
        );

        let generatedHBLNo: string | null = null;
        try {
            generatedHBLNo = await this.numberSeriesService.generateNextNumber(
                mainPayload.CompanyMasterSid,
                mainPayload.BranchMasterSid,
                houseJobMenuId,
                mainPayload.DepartmentMasterSid,
                documentDate,
            );
        } catch (err) {
            this.logger.error(`[ServiceJob] HBL number generation failed: ${err.message}`);
        }

        // Fallback to legacy if config-based generation failed
        if (!generatedHBLNo) {
            const dateString = moment().format('YYYYMMDD');
            const houseCount = await this._db.houseJob.count({
                where: { HBLNo: { contains: dateString } }
            });
            generatedHBLNo = `HOUSE-${dateString}-${(houseCount + 1).toString().padStart(3, '0')}`;
        }

        // Payload HBLNo overrides generated number
        const finalHBLNo =
            payload.HBLNo && payload.HBLNo.trim() !== ''
                ? payload.HBLNo
                : generatedHBLNo;

        // 4. Service Job ShipmentNo — open text from payload or legacy fallback
        let serviceJobRefNo: string;
        if (payload.ShipmentNo && payload.ShipmentNo.trim() !== '') {
            serviceJobRefNo = payload.ShipmentNo.trim();
        } else {
             const refDate = payload.MBLDate ? moment(payload.MBLDate) : moment();
            const dateString = refDate.format('YYYYMMDD');
            const count = await this._db.houseJob.count({
                where: {
                    ShipmentNo: { contains: dateString },
                    IsServiceJob: 'Y'
                }
            });
            serviceJobRefNo = `SRVJ-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
        }

        // --- Transaction: create all records ---

        return this._db.$transaction(async (prisma) => {
            // Create the MasterJob
            const masterJob = await prisma.masterJob.create({
                data: {
                    MasterJobDate: payload.MBLDate ? new Date(payload.MBLDate) : new Date(),
                    MasterJobNumber: finalMBLNo,
                    MBLNo: finalMBLNo,
                    MBLDate: payload.MBLDate ? new Date(payload.MBLDate) : new Date(),
                    FreightPPCC: mainPayload.FreightPPCC || "Prepaid",
                    CompanyMasterSid: mainPayload.CompanyMasterSid,
                    BranchMasterSid: mainPayload.BranchMasterSid,
                    DepartmentMasterSid: mainPayload.DepartmentMasterSid,
                    MenuMasterSid: serviceJobMenuId,
                    POO: "",
                    POL: mainPayload.POL || "",
                    POD: mainPayload.POD || "",
                    FPD: "",
                    Status: mainPayload.status || 'A',
                    CreatedBy: mainPayload.createdBy,
                },
            });

            if (!masterJob) {
                throw new BadRequestException('Failed to create the master job component.');
            }

            // Create the HouseJob
            const houseJob = await prisma.houseJob.create({
                data: {
                    MasterJobSid: masterJob.MasterJobSid,
                    MBLNo: masterJob.MasterJobNumber,
                    MBLDate: masterJob.MBLDate,
                    MenuMasterSid: houseJobMenuId,
                    CompanyMasterSid: mainPayload.CompanyMasterSid,
                    BranchMasterSid: mainPayload.BranchMasterSid,
                    DepartmentMasterSid: mainPayload.DepartmentMasterSid,
                    ShipmentNo: serviceJobRefNo,
                    CustomerMasterSid: mainPayload.CustomerMasterSid,
                    CustomerBranchSid: mainPayload.CustomerBranchSid || null,
                    CustomerName: mainPayload.CustomerName,
                    CustomerAddress: mainPayload.CustomerAddress,
                    ShipperName: mainPayload.ShipperName,
                    ShipperAddress: mainPayload.ShipperAddress,
                    ConsigneeName: mainPayload.ConsigneeName,
                    ConsigneeAddress: mainPayload.ConsigneeAddress,
                    JobType: mainPayload.JobType || null,
                    HBLDate: mainPayload.HBLDate || null,
                    HBLNo: finalHBLNo,
                    POL: mainPayload.POL || "",
                    POD: mainPayload.POD || "",
                    FreightTerms: mainPayload.FreightTerms || mainPayload.FreightPPCC || "Prepaid",
                    BookingNo: "",
                    IsServiceJob: 'Y',
                    status: mainPayload.status || 'A',
                    createdBy: mainPayload.createdBy,
                },
            });

            // 4. Create HouseJobCargo
            let createdCargo;
            if (houseJobCargo && Object.keys(houseJobCargo).length > 0) {
                createdCargo = await prisma.houseJobCargo.create({
                    data: {
                        HouseJobSid: houseJob.HouseJobSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        CargoType: houseJobCargo.CargoType || 'General',
                        GrossWeight: Number(houseJobCargo.GrossWeight) || 0,
                        NetWeight: Number(houseJobCargo.NetWeight) || 0,
                        Volume: Number(houseJobCargo.Volume) || 0,
                        ChargeableWeight: Number(houseJobCargo.ChargeableWeight) || 0,
                        ContainerType: houseJobCargo.ContainerType || null,
                        PackageType: houseJobCargo.PackageType || null,
                        NoOfPackage: Number(houseJobCargo.NoOfPackage) || 0,
                        FreightAmount: houseJobCargo.FreightAmount || "0",
                        ShipmentTerms: houseJobCargo.ShipmentTerms || "",
                        FreightTerms: houseJobCargo.FreightTerms || "",
                        ModeOfTransport: houseJobCargo.ModeOfTransport || "",
                        MovementType: houseJobCargo.MovementType || "",
                        NoofContainers: Number(houseJobCargo.NoofContainers) || 0,
                        Qty: Number(houseJobCargo.Qty) || 0,
                        StuffingAt: houseJobCargo.StuffingAt || 'Dock',
                        WeightUnitSid: houseJobCargo.WeightUnitSid || null,
                        CommodityDescription : houseJobCargo.CommodityDescription || null,
                        MarksAndNumber : houseJobCargo.MarksAndNumber || null,
                        createdBy: payload.createdBy,
                        status: 'A',
                    },
                });
            }

            // 5. Create CostRevenueCharges
            let chargeIndex = 1;
            const createdCharges: any[] = [];
            if (costRevenueCharges && costRevenueCharges.length > 0) {
                for (const charge of costRevenueCharges) {
                    const newCharge = await prisma.costRevenueCharges.create({
                        data: {
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            TransactionSid: houseJob.HouseJobSid,
                            MenuMasterSid: houseJobMenuId,
                            ShipmentNo: houseJob.ShipmentNo,
                            MasterJobNo: houseJob.MBLNo || "",
                            createdBy: payload.updatedBy || '',
                            status: charge.status === 'Active' ? 'A' : (charge.status === 'Suspended' ? 'S' : String(charge.status).charAt(0)) || 'A',
                            Remarks: charge.Remarks || '',
                            SerialNumber: chargeIndex++,
                            ChargeMasterSid: charge.ChargeMasterSid ? Number(charge.ChargeMasterSid) : null,
                            ChargeDescription: charge.ChargeDescription,
                            ChargeUomSid: charge.ChargeUomSid ? Number(charge.ChargeUomSid) : null,
                            RevenueChargeUomSid: Number(charge.RevenueChargeUomSid) || Number(charge.ChargeUomSid),
                            CostChargeUomSid: Number(charge.CostChargeUomSid) || Number(charge.ChargeUomSid),
                            RevenueNumberOfUnit: charge.RevenueNumberOfUnit ? Number(charge.RevenueNumberOfUnit) : (charge.NoOfUnit ? Number(charge.NoOfUnit) : null),
                            CostNumberOfUnit: charge.CostNumberOfUnit ? Number(charge.CostNumberOfUnit) : (charge.NoOfUnit ? Number(charge.NoOfUnit) : null),

                            // Revenue Section
                            RevenueCurrencyMasterSid: charge.RevenueCurrencyMasterSid ? Number(charge.RevenueCurrencyMasterSid) : null,
                            RevenueExchangeRate: charge.RevenueExchangeRate ? Number(charge.RevenueExchangeRate) : null,
                            RevenueRate: charge.RevenueRate ? Number(charge.RevenueRate) : null,
                            RevenueAmount: charge.RevenueAmount ? Number(charge.RevenueAmount) : null,
                            RevenueLocalAmount: charge.RevenueLocalAmount ? Number(charge.RevenueLocalAmount) : null,
                            RevenueDrCr: charge.RevenueDrCr || 'C',
                            RevenueCustomerMasterSid: charge.RevenueCustomerMasterSid ? Number(charge.RevenueCustomerMasterSid) : null,
                            RevenueCustomerBranchSid: charge.RevenueCustomerBranchSid ? Number(charge.RevenueCustomerBranchSid) : null,
                            RevenuePrepaidCollect: charge.RevenuePrepaidCollect,
                            RevenueVoucherHeaderSid: charge.RevenueVoucherHeaderSid ? Number(charge.RevenueVoucherHeaderSid) : null,
                            RevenueVoucherTypeMasterSid: charge.RevenueVoucherTypeSid ? Number(charge.RevenueVoucherTypeSid) : null,

                            // Cost Section
                            CostCurrencyMasterSid: charge.CostCurrencyMasterSid ? Number(charge.CostCurrencyMasterSid) : null,
                            CostExchangeRate: charge.CostExchangeRate ? Number(charge.CostExchangeRate) : null,
                            CostRate: charge.CostRate ? Number(charge.CostRate) : null,
                            CostAmount: charge.CostAmount ? Number(charge.CostAmount) : null,
                            CostLocalAmount: charge.CostLocalAmount ? Number(charge.CostLocalAmount) : null,
                            CostDrCr: charge.CostDrCr || 'D',
                            CostAgentMasterSid: charge.CostAgentMasterSid ? Number(charge.CostAgentMasterSid) : null,
                            CostAgentBranchSid: charge.CostAgentBranchSid ? Number(charge.CostAgentBranchSid) : null,
                            CostPrepaidCollect: charge.CostPrepaidCollect,
                            CostVoucherHeaderSid: charge.CostVoucherHeaderSid ? Number(charge.CostVoucherHeaderSid) : null,
                            PaymentRequestSid: charge.PaymentRequestSid ? Number(charge.PaymentRequestSid) : null,
                            CostVoucherTypeMasterSid: charge.CostVoucherTypeSid ? Number(charge.CostVoucherTypeSid) : null,
                            TariffDetailSid: charge.TariffDetailSid ? Number(charge.TariffDetailSid) : null,
                        }
                    });
                    createdCharges.push(newCharge);
                }
            }

            let createdOthers;

            if (houseJobOthers && Object.keys(houseJobOthers).length > 0) {
                createdOthers = await prisma.houseJobOthers.create({
                    data: {
                        HouseJobSid: houseJob.HouseJobSid,

                        CustomerRefNo: houseJobOthers.CustomerRefNo || "",
                        OperationUser: houseJobOthers.OperationUser || null,
                        DocumentationUser: houseJobOthers.DocumentationUser || null,
                        CustomerServiceuser: houseJobOthers.CustomerServiceuser || null,

                        NotifyParty: houseJobOthers.NotifyParty || "",
                        NotifyPartyAddress: houseJobOthers.NotifyPartyAddress || "",

                        CHAName: houseJobOthers.CHAName || "",
                        PickupMode: houseJobOthers.PickupMode || null,

                        YardCFS: houseJobOthers.YardCFS || "",
                        LocalTransport: houseJobOthers.LocalTransport || null,

                        PickupPlace: houseJobOthers.PickupPlace || "",
                        PickupDate: houseJobOthers.PickupDate ? new Date(houseJobOthers.PickupDate) : null,
                        PickupAddress: houseJobOthers.PickupAddress || "",

                        DeliveryPlace: houseJobOthers.DeliveryPlace || "",
                        DeliveryDate: houseJobOthers.DeliveryDate || "",
                        DeliveryAddress: houseJobOthers.DeliveryAddress || "",

                        CargoCurrency: houseJobOthers.CargoCurrency || "USD",
                        CargoValue: new Prisma.Decimal(houseJobOthers.CargoValue || 0),

                        // ✅ THIS WAS MISSING
                        ExternalNote: houseJobOthers.ExternalNote || null,
                        InternalNote: houseJobOthers.InternalNote || null,
     
                        BlClause: houseJobOthers.BlClause || [],

                        createdBy: payload.createdBy,
                        status: 'A',
                    }
                });
            }

            const createdMilestones: any[] = [];
            const milestonePayload = milestones || [];
            if (milestonePayload.length > 0) {
                for (const milestone of milestonePayload) {
                    const createdMilestone = await prisma.shipmentMilestone.create({
                        data: {
                            HouseJobSid: houseJob.HouseJobSid,
                            ShipmentNo: houseJob.ShipmentNo!,
                            CompanyMasterSid: houseJob.CompanyMasterSid,
                            BranchMasterSid: houseJob.BranchMasterSid!,
                            CreatedBy: payload.createdBy,
                            Status: 'A',
                            MilestoneMasterSid: milestone.MilestoneMasterSid,
                            Remarks: milestone.Remarks,
                            MilestoneName: milestone.MilestoneName,
                            MilestoneDate: milestone.MilestoneDate,
                            AutoCaptured: milestone.AutoCaptured,
                        }
                    });
                    createdMilestones.push(createdMilestone);
                }
            }


            return {
                ...houseJob,
                masterJob,
                Cargo: createdCargo,
                Others: createdOthers,
                costRevenueCharges: createdCharges,
                shipmentMilestones: createdMilestones,
            };
        });
    }

    /**
     * Fetches a single Service Job by HouseJobSid
     */
    async fetchServiceJobById(houseJobSid: number) {
        try {
            const serviceJob = await this._db.houseJob.findUnique({
                where: {
                    HouseJobSid: houseJobSid,
                    IsServiceJob: 'Y',
                },
                include: {
                    Cargo: { where: { status: 'A' } },
                    Others: {
                        where: { status: 'A' },
                        select: {
                            HouseJobOthersSid: true,
                            HouseJobSid: true,
                            ExternalNote: true,
                            InternalNote: true
                        }
                    },
                    masterJob: {
                        select: {
                            MasterJobNumber: true
                        }
                    }
                }
            });

            if (!serviceJob) {
                throw new NotFoundException(`Service job with ID ${houseJobSid} not found.`);
            }

            const costRevenuePayload = {
                TransactionSid: serviceJob.HouseJobSid,
                MenuMasterSid: serviceJob.MenuMasterSid!,
                CompanyMasterSid: serviceJob.CompanyMasterSid,
                BranchMasterSid: serviceJob.BranchMasterSid!,
            };

            const costRevenueCharges = await this.commonService.getAllCostRevenueCharges(costRevenuePayload);

            return {
                ...serviceJob,
                costRevenueCharges,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Updates an existing Service Job
     */
    async updateServiceJob(houseJobSid: number, payload: UpdateServiceJobDto) {
        const { houseJobCargo, houseJobOthers, costRevenueCharges, milestones, ...mainPayload } = payload;

        return this._db.$transaction(async (prisma) => {
            // 1. Fetch existing HouseJob
            const department = await prisma.departmentMaster.findUnique({
                where: { DepartmentMasterSid: mainPayload.DepartmentMasterSid },
                select: {
                    departmentType: true
                }
            });

            if (!department) {
                throw new BadRequestException('Department not found.');
            }

            const existingHouseJob = await prisma.houseJob.findUnique({
                where: { HouseJobSid: houseJobSid },
            });

            if (!existingHouseJob) {
                throw new NotFoundException(`Service job with ID ${houseJobSid} not found.`);
            }
            // ✅ Update MBLNo only if sent
            if (payload.MBLNo && payload.MBLNo.trim() !== '') {

                // Update MasterJob
                await prisma.masterJob.update({
                    where: {
                        MasterJobSid: existingHouseJob.MasterJobSid!,
                    },
                    data: {
                        MasterJobNumber: payload.MBLNo,
                        MBLNo: payload.MBLNo,
                        UpdatedBy: payload.updatedBy, // ✅ FIXED
                        UpdatedOn: new Date(),
                    },
                });

                // Keep HouseJob in sync
                await prisma.houseJob.update({
                    where: { HouseJobSid: houseJobSid },
                    data: {
                        MBLNo: payload.MBLNo,
                    },
                });
            }


            const houseJobUpdateData: any = {
                CustomerMasterSid: mainPayload.CustomerMasterSid,
                CustomerBranchSid: mainPayload.CustomerBranchSid || null,
                CustomerName: mainPayload.CustomerName,
                CustomerAddress: mainPayload.CustomerAddress,
                ShipperName: mainPayload.ShipperName,
                ShipperAddress: mainPayload.ShipperAddress,
                ConsigneeName: mainPayload.ConsigneeName,                
                ConsigneeAddress: mainPayload.ConsigneeAddress,
                POL: mainPayload.POL || "",
                POD: mainPayload.POD || "",
                FreightTerms: mainPayload.FreightPPCC || "Prepaid",
                status: mainPayload.status || 'A',
                updatedBy: payload.updatedBy,
                updatedOn: new Date(),
            };

            if (payload.HBLNo && payload.HBLNo.trim() !== '') {
                houseJobUpdateData.HBLNo = payload.HBLNo;
            }

            if (payload.ShipmentNo && payload.ShipmentNo.trim() !== '') {
                houseJobUpdateData.ShipmentNo = mainPayload.ShipmentNo;
            }

            const updatedHouseJob = await prisma.houseJob.update({
                where: { HouseJobSid: houseJobSid },
                data: houseJobUpdateData,
            });


            // 3. Update or Create HouseJobCargo
            if (houseJobCargo && Object.keys(houseJobCargo).length > 0) {
                const cargoData = {
                    HouseJobSid: houseJobSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    CargoType: houseJobCargo.CargoType || 'General',
                    GrossWeight: Number(houseJobCargo.GrossWeight) || 0,
                    NetWeight: Number(houseJobCargo.NetWeight) || 0,
                    Volume: Number(houseJobCargo.Volume) || 0,
                    ChargeableWeight: Number(houseJobCargo.ChargeableWeight) || 0,
                    ContainerType: houseJobCargo.ContainerType || null,
                    PackageType: houseJobCargo.PackageType || null,
                    NoOfPackage: Number(houseJobCargo.NoOfPackage) || 0,
                    FreightAmount: houseJobCargo.FreightAmount || "0",
                    ShipmentTerms: houseJobCargo.ShipmentTerms || "",
                    FreightTerms: houseJobCargo.FreightTerms || "",
                    ModeOfTransport: houseJobCargo.ModeOfTransport || "",
                    MovementType: houseJobCargo.MovementType || "",
                    NoofContainers: Number(houseJobCargo.NoofContainers) || 0,
                    Qty: Number(houseJobCargo.Qty) || 0,
                    StuffingAt: houseJobCargo.StuffingAt || 'Dock',
                    WeightUnitSid: houseJobCargo.WeightUnitSid || null,
                    CommodityDescription : houseJobCargo.CommodityDescription || null,
                    MarksAndNumber : houseJobCargo.MarksAndNumber || null,
                    updatedBy: payload.updatedBy,
                    status: 'A',
                    updatedOn: new Date(),
                };

                await prisma.houseJobCargo.upsert({
                    where: { HouseJobCargoSid: houseJobCargo.HouseJobCargoSid || -1 },
                    update: cargoData,
                    create: { ...cargoData, createdBy: payload.updatedBy },
                });
            }

            // 4. Update or Create CostRevenueCharges
            let chargeIndex = 1;
            if (costRevenueCharges && costRevenueCharges.length > 0) {
                const menuId = await this.menuService.getMenuSidByName(department?.departmentType?.toUpperCase() === 'AIR' ? "House Air Waybill" : "House Job");

                for (const charge of costRevenueCharges) {
                    const chargePayload = {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        TransactionSid: updatedHouseJob.HouseJobSid,
                        MenuMasterSid: menuId,
                        ShipmentNo: updatedHouseJob.ShipmentNo,
                        MasterJobNo: updatedHouseJob.MBLNo || "",
                        updatedBy: payload.updatedBy,
                        updatedOn: new Date(),
                        status: charge.status === 'Active' ? 'A' : (charge.status === 'Suspended' ? 'S' : String(charge.status).charAt(0)) || 'A',
                        Remarks: charge.Remarks || '',
                        SerialNumber: chargeIndex++,
                        ChargeMasterSid: charge.ChargeMasterSid ? Number(charge.ChargeMasterSid) : null,
                        ChargeDescription: charge.ChargeDescription,
                        ChargeUomSid: Number(charge.ChargeUomSid),
                        RevenueChargeUomSid: Number(charge.RevenueChargeUomSid) || Number(charge.ChargeUomSid),
                        CostChargeUomSid: Number(charge.CostChargeUomSid) || Number(charge.ChargeUomSid),
                        RevenueNumberOfUnit: charge.RevenueNumberOfUnit ? Number(charge.RevenueNumberOfUnit) : (charge.NoOfUnit ? Number(charge.NoOfUnit) : null),
                        CostNumberOfUnit: charge.CostNumberOfUnit ? Number(charge.CostNumberOfUnit) : (charge.NoOfUnit ? Number(charge.NoOfUnit) : null),

                        // Revenue Section
                        RevenueCurrencyMasterSid: charge.RevenueCurrencyMasterSid ? Number(charge.RevenueCurrencyMasterSid) : null,
                        RevenueExchangeRate: charge.RevenueExchangeRate ? Number(charge.RevenueExchangeRate) : null,
                        RevenueRate: charge.RevenueRate ? Number(charge.RevenueRate) : null,
                        RevenueAmount: charge.RevenueAmount ? Number(charge.RevenueAmount) : null,
                        RevenueLocalAmount: charge.RevenueLocalAmount ? Number(charge.RevenueLocalAmount) : null,
                        RevenueDrCr: charge.RevenueDrCr || 'C',
                        RevenueCustomerMasterSid: charge.RevenueCustomerMasterSid ? Number(charge.RevenueCustomerMasterSid) : null,
                        RevenueCustomerBranchSid: charge.RevenueCustomerBranchSid ? Number(charge.RevenueCustomerBranchSid) : null,
                        RevenuePrepaidCollect: charge.RevenuePrepaidCollect,
                        RevenueVoucherHeaderSid: charge.RevenueVoucherHeaderSid ? Number(charge.RevenueVoucherHeaderSid) : null,
                        RevenueVoucherTypeMasterSid: charge.RevenueVoucherTypeSid ? Number(charge.RevenueVoucherTypeSid) : null,

                        // Cost Section
                        CostCurrencyMasterSid: charge.CostCurrencyMasterSid ? Number(charge.CostCurrencyMasterSid) : null,
                        CostExchangeRate: charge.CostExchangeRate ? Number(charge.CostExchangeRate) : null,
                        CostRate: charge.CostRate ? Number(charge.CostRate) : null,
                        CostAmount: charge.CostAmount ? Number(charge.CostAmount) : null,
                        CostLocalAmount: charge.CostLocalAmount ? Number(charge.CostLocalAmount) : null,
                        CostDrCr: charge.CostDrCr || 'D',
                        CostAgentMasterSid: charge.CostAgentMasterSid ? Number(charge.CostAgentMasterSid) : null,
                        CostAgentBranchSid: charge.CostAgentBranchSid ? Number(charge.CostAgentBranchSid) : null,
                        CostPrepaidCollect: charge.CostPrepaidCollect,
                        CostVoucherHeaderSid: charge.CostVoucherHeaderSid ? Number(charge.CostVoucherHeaderSid) : null,
                        PaymentRequestSid: charge.PaymentRequestSid ? Number(charge.PaymentRequestSid) : null,
                        CostVoucherTypeMasterSid: charge.CostVoucherTypeSid ? Number(charge.CostVoucherTypeSid) : null,
                        TariffDetailSid: charge.TariffDetailSid ? Number(charge.TariffDetailSid) : null,
                    };

                    await prisma.costRevenueCharges.upsert({
                        where: { CostRevenueChargesSid: charge.RateSid || -1 },
                        update: chargePayload,
                        create: { ...chargePayload, createdBy: payload.updatedBy },
                    });
                }
            }

            if (houseJobOthers && Object.keys(houseJobOthers).length > 0) {

                const othersPayload = {
                    CustomerRefNo: houseJobOthers.CustomerRefNo || "",
                    NotifyParty: houseJobOthers.NotifyParty || "",
                    NotifyPartyAddress: houseJobOthers.NotifyPartyAddress || "",
                    CHAName: houseJobOthers.CHAName || "",
                    YardCFS: houseJobOthers.YardCFS || "",
                    PickupPlace: houseJobOthers.PickupPlace || "",
                    PickupAddress: houseJobOthers.PickupAddress || "",
                    DeliveryPlace: houseJobOthers.DeliveryPlace || "",
                    DeliveryDate: houseJobOthers.DeliveryDate || "",
                    DeliveryAddress: houseJobOthers.DeliveryAddress || "",

                    CargoCurrency: houseJobOthers.CargoCurrency || "USD",
                    CargoValue: new Prisma.Decimal(houseJobOthers.CargoValue || 0),

                    ExternalNote: houseJobOthers.ExternalNote || null,
                    InternalNote: houseJobOthers.InternalNote || null,

                    BlClause: houseJobOthers.BlClause || [],

                    updatedBy: payload.updatedBy,
                    updatedOn: new Date(),
                    status: 'A',
                };

                const existingOthers = await prisma.houseJobOthers.findFirst({
                    where: {
                        HouseJobSid: houseJobSid,
                        status: 'A'
                    }
                });

                if (existingOthers) {
                    await prisma.houseJobOthers.update({
                        where: {
                            HouseJobOthersSid: existingOthers.HouseJobOthersSid
                        },
                        data: othersPayload
                    });
                } else {
                    await prisma.houseJobOthers.create({
                        data: {
                            HouseJobSid: houseJobSid,
                            ...othersPayload,
                            createdBy: payload.updatedBy
                        }
                    });
                }
            }

            const milestonePayload = milestones || [];
            if (milestonePayload.length > 0) {
                for (const milestone of milestonePayload) {
                    if (milestone.ShipmentMilestoneSid) {
                        await prisma.shipmentMilestone.update({
                            where: {
                                ShipmentMilestoneSid: milestone.ShipmentMilestoneSid
                            },
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                ShipmentNo: updatedHouseJob.ShipmentNo!,
                                UpdatedBy: milestone.UpdatedBy || payload.updatedBy,
                                Status: String(milestone.Status || 'A').charAt(0),
                                MilestoneMasterSid: milestone.MilestoneMasterSid,
                                Remarks: milestone.Remarks,
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured,
                            }
                        });
                    } else {
                        await prisma.shipmentMilestone.create({
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                ShipmentNo: updatedHouseJob.ShipmentNo!,
                                CompanyMasterSid: milestone.CompanyMasterSid || updatedHouseJob.CompanyMasterSid,
                                BranchMasterSid: milestone.BranchMasterSid || updatedHouseJob.BranchMasterSid!,
                                CreatedBy: milestone.UpdatedBy || payload.updatedBy,
                                Status: 'A',
                                MilestoneMasterSid: milestone.MilestoneMasterSid,
                                Remarks: milestone.Remarks,
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured,
                            }
                        });
                    }
                }
            }


            return this.fetchServiceJobById(houseJobSid);
        });
    }

    /**
     * Searches for Service Jobs
     */
    async searchServiceJob(searchParams: filterDto) {
        const {
            search = '',
            page = 1,
            pageSize = 15,
            activeCompanyId,
            activeBranchId,
            dateFrom,
            DateFrom,
            dateTo,
            DateTo,
            dateField,
            DateField,
            CustomerMasterSid,
            customerMasterSid,
            DepartmentMasterSid,
            departmentMasterSid,
            POL,
            pol,
            POD,
            pod,
        } = searchParams as any;
        const skip = (page - 1) * pageSize;
        const resolvedDateFrom = dateFrom ?? DateFrom;
        const resolvedDateTo = dateTo ?? DateTo;
        const rawDateField = (dateField ?? DateField ?? '').toString();
        const allowedDateFields = ['MBLDate', 'HBLDate'];
        const selectedDateField = allowedDateFields.includes(rawDateField) ? rawDateField : 'MBLDate';

        const parsedDateFrom = resolvedDateFrom ? new Date(resolvedDateFrom) : null;
        const parsedDateTo = resolvedDateTo ? new Date(resolvedDateTo) : null;
        const normalizedDateFrom = parsedDateFrom && !Number.isNaN(parsedDateFrom.getTime()) ? parsedDateFrom : null;
        const normalizedDateTo = parsedDateTo && !Number.isNaN(parsedDateTo.getTime()) ? parsedDateTo : null;
        const normalizedCustomerSid = Number(CustomerMasterSid ?? customerMasterSid ?? 0) || null;
        const normalizedDepartmentSid = Number(DepartmentMasterSid ?? departmentMasterSid ?? 0) || null;
        const normalizedPOL = (POL ?? pol ?? '').toString().trim();
        const normalizedPOD = (POD ?? pod ?? '').toString().trim();

        const where: Prisma.HouseJobWhereInput = {
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            IsServiceJob: 'Y',
            status: statusWhereClause,
            ...(normalizedCustomerSid && { CustomerMasterSid: normalizedCustomerSid }),
            ...(normalizedDepartmentSid && { DepartmentMasterSid: normalizedDepartmentSid }),
            ...(normalizedPOL && { POL: normalizedPOL }),
            ...(normalizedPOD && { POD: normalizedPOD }),
            ...((normalizedDateFrom || normalizedDateTo) && {
                [selectedDateField]: {
                    ...(normalizedDateFrom && { gte: normalizedDateFrom }),
                    ...(normalizedDateTo && { lte: normalizedDateTo }),
                }
            }),
            ...(search && {
                OR: [
                    { HBLNo: { contains: search, mode: 'insensitive' } },
                    { ShipmentNo: { contains: search, mode: 'insensitive' } },
                    { CustomerName: { contains: search, mode: 'insensitive' } },
                    { ShipperName: { contains: search, mode: 'insensitive' } },
                    { ConsigneeName: { contains: search, mode: 'insensitive' } },
                    { departmentMaster: { departmentName: { contains: search, mode: 'insensitive' } } },
                    { POL: { contains: search, mode: 'insensitive' } },
                    { POD: { contains: search, mode: 'insensitive' } },
                ]
            })
        };

        try {
            const [serviceJobs, total] = await this._db.$transaction([
                this._db.houseJob.findMany({
                    where,
                    skip,
                    take: pageSize,
                    select: {
                        HouseJobSid: true,
                        CustomerName: true,
                        ShipperName: true,
                        ConsigneeName: true,
                        departmentMaster: {
                            select: { departmentName: true },
                        },
                        HBLNo: true,
                        MBLNo: true,
                        MBLDate: true,
                        ShipmentNo: true,
                        POL: true,
                        POD: true,
                        status: true,
                        masterJob: {   
                            select: {
                                MasterJobNumber: true,
                            }
                        }
                    },
                    orderBy: {
                        MBLDate: 'desc',
                    },
                }),
                this._db.houseJob.count({ where }),
            ]);

            return {
                items: serviceJobs,
                totalCount: total
            };
        } catch (error) {
            throw error;
        }
    }

    async getAuditLogs(tableName: string, recordId?: string) {
        try {
            let conditions: any[] = [];

            // SERVICE JOB (HouseJob) LOG
            if (tableName === 'HouseJob' && recordId) {
                const houseJobSid = Number(recordId);

                const houseJob = await this._db.houseJob.findUnique({
                    where: { HouseJobSid: houseJobSid },
                    select: {
                        HouseJobSid: true,
                        MasterJobSid: true,
                        IsServiceJob: true,
                    },
                });

                if (!houseJob || houseJob.IsServiceJob !== 'Y') {
                    throw new NotFoundException(`Service job with ID ${houseJobSid} not found.`);
                }

                const [cargo, others, charges] = await Promise.all([
                    this._db.houseJobCargo.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobCargoSid: true }
                    }),
                    this._db.houseJobOthers.findMany({
                        where: { HouseJobSid: houseJobSid },
                        select: { HouseJobOthersSid: true }
                    }),
                    this._db.costRevenueCharges.findMany({
                        where: { TransactionSid: houseJobSid },
                        select: { CostRevenueChargesSid: true }
                    })
                ]);

                conditions = [
                    {
                        tableName: 'HouseJob',
                        recordId: recordId
                    },
                    ...(houseJob.MasterJobSid
                        ? [{
                            tableName: 'MasterJob',
                            recordId: houseJob.MasterJobSid.toString()
                        }]
                        : []),
                    ...(cargo.length
                        ? [{
                            tableName: 'HouseJobCargo',
                            recordId: { in: cargo.map(x => x.HouseJobCargoSid.toString()) }
                        }]
                        : []),
                    ...(others.length
                        ? [{
                            tableName: 'HouseJobOthers',
                            recordId: { in: others.map(x => x.HouseJobOthersSid.toString()) }
                        }]
                        : []),
                    ...(charges.length
                        ? [{
                            tableName: 'CostRevenueCharges',
                            recordId: { in: charges.map(x => x.CostRevenueChargesSid.toString()) }
                        }]
                        : []),
                ];
            } else {
                conditions = [{
                    tableName,
                    ...(recordId && { recordId })
                }];
            }

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            return logs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    async checkDuplicateServiceJob(payload: DuplicateCheckDTO) {
        const existingRecord = await this._db.houseJob.findFirst({
            where: {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                DepartmentMasterSid: payload.DepartmentMasterSid,
                IsServiceJob: 'Y',
                status: 'A',
                OR: [
                    {
                        HBLNo: payload.HBLNo,
                    },
                    {
                        MBLNo: payload.MBLNo,
                    }
                ]
            },
            select: { HouseJobSid: true }
        });

        return !!existingRecord;
    }

    async generateServiceJobTemplate(CompanyMasterSid: number, BranchMasterSid: number): Promise<Buffer> {
        await this.validateServiceJobExcelContext(CompanyMasterSid, BranchMasterSid);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'DOFI';
        workbook.created = new Date();

        const [departments, customers, ports, containerTypes, charges, uoms, currencies, revenueCustomers, costCustomers, company] = await Promise.all([
            this._db.departmentMaster.findMany({
                where: { CompanyMasterSid, Status: 'A' },
                select: { DepartmentMasterSid: true, departmentName: true, departmentCode: true, departmentType: true, ExportImport: true, FCLLCL: true },
                orderBy: { departmentName: 'asc' }
            }),
            this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid,
                    status: 'A',
                    CustomerType: {
                        path: ['customer'],
                        equals: 'isTrue'
                    },
                    CustomerBranch: { some: { status: 'A' } }
                },
                select: {
                    CustomerMasterSid: true,
                    CustomerName: true,
                    CustomerShortCode: true,
                    CustomerBranch: {
                        where: { status: 'A', CompanyMasterSid },
                        select: { CustomerBranchSid: true, BranchName: true, Branch_Code: true, Address: true }
                    }
                },
                orderBy: { CustomerName: 'asc' }
            }),
            this._db.portMaster.findMany({
                where: { status: 'A' },
                select: { PortCode: true, PortName: true, PortType: true },
                orderBy: { PortCode: 'asc' }
            }),
            this._db.containerTypeMaster.findMany({
                where: { status: 'A' },
                select: { ContainerTypeMasterSid: true, ContainerName: true, ContainerCode: true },
                orderBy: { ContainerName: 'asc' }
            }),
            this._db.chargeMaster.findMany({
                where: { CompanyMasterSid, Status: 'A' },
                select: { ChargeMasterSid: true, chargeCode: true, chargeName: true, UOM: true, CurrencyMasterSid: true, UnitQty: true },
                orderBy: { chargeCode: 'asc' }
            }),
            this._db.uOMMaster.findMany({
                where: { status: 'A' },
                select: { UOMMasterSid: true, UOMCode: true, UOMName: true },
                orderBy: { UOMCode: 'asc' }
            }),
            this._db.currencyMaster.findMany({
                select: { CurrencyMasterSid: true, currencyCode: true, currencyName: true },
                orderBy: { currencyCode: 'asc' }
            }),
            this.getServiceJobMappedParties(CompanyMasterSid, 'DrCOAMasterSid'),
            this.getServiceJobMappedParties(CompanyMasterSid, 'CrCOAMasterSid'),
            this._db.companyMaster.findUnique({
                where: { CompanyMasterSid },
                include: {
                    currencyMaster: true
                }
            }),
        ]);
        const companyCurrencyCode = company?.currencyMaster?.currencyCode || '';
        const chargeReferenceRows = await this.buildServiceJobChargeReferenceRows(charges, uoms, currencies, {
            CompanyMasterSid,
            BranchMasterSid,
            companyCurrencyCode,
        });

        const uploadSheet = workbook.addWorksheet('ServiceJob_Upload', {
            views: [{ state: 'frozen', ySplit: 4 }]
        });
        const refSheet = workbook.addWorksheet('Reference_Values');
        refSheet.state = 'hidden';
        const customerAddressSheet = workbook.addWorksheet('Customer_Address_Values');
        customerAddressSheet.state = 'hidden';

        const baseHeaders = [
            'Department ', 'Job Date  (DD-MM-YYYY)', 'Customer Name*', 'Customer Address*', 'Job No.',
            'HBLNo (HouseJobNo)', 'ShipmentNo (Reference)', 'JobType ', 'ShipperName', 'ShipperAddress',
            'ConsigneeName', 'ConsigneeAddress', 'POL (PortCode)', 'POD (PortCode)', 'CargoType ',
            'GrossWeight', 'NetWeight', 'Volume_CBM', 'ChargeableWeight', 'NoOfPackage', 'NoofContainers',
            'ContainerTypeName', 'ShipmentTerms', 'MovementType', 'ModeOfTransport ', 'StuffingAt ',
            'External Note', 'Internal Note', 'Good Decription', 'Marks and Number '
        ];
        const chargeHeaders = [
            'ChargeCode*',
            'ChargeDescription ', 'UOM', 'NoOfUnit', 'Rev_Currency', 'Rev_ExchangeRate', 'Rev_Rate',
            'Rev_Amount', 'Rev_LocalAmount', 'Rev_DrCr (C=Credit)', 'Rev_CustomerCode',
            'Rev_PrepaidCollect', 'Cost_Currency', 'Cost_ExchangeRate', 'Cost_Rate', 'Cost_Amount',
            'Cost_LocalAmount', 'Cost_DrCr (D=Debit)', 'Cost_AgentCode', 'Cost_PrepaidCollect'
        ];
        const chargeBlockCount = 6;
        const headers = [
            ...baseHeaders,
            ...Array.from({ length: chargeBlockCount }).flatMap(() => chargeHeaders)
        ];

        uploadSheet.getRow(1).values = ['SERVICE JOB BULK UPLOAD TEMPLATE'];
        uploadSheet.getRow(2).values = [];
        uploadSheet.getRow(3).values = [];
        uploadSheet.getCell('A3').value = 'SERVICE JOB';
        uploadSheet.getCell('O3').value = 'CARGO DETAILS';
        uploadSheet.getCell('AE3').value = 'RATE / CHARGES DETAILS';
        uploadSheet.getRow(4).values = headers;
        uploadSheet.getRow(5).values = [
            departments[0]?.departmentName || 'Air Export',
            new Date(),
            customers[0]?.CustomerName || 'Dofi Infosys',
            customers[0]?.CustomerBranch?.[0]?.Address || 'Dubai',
            'DW/JA/FE/05/26/00173',
            'DW/JA/FE/05/26/00372',
            '',
            'Import',
            customers[0]?.CustomerName || '',
            customers[0]?.CustomerBranch?.[0]?.Address || '',
            '',
            '',
            this.formatServiceJobPort(ports[0]) || '',
            this.formatServiceJobPort(ports[1]) || '',
            'General',
            0, 0, 0, 0, 0, 0,
            containerTypes[0]?.ContainerName || '',
            'FCL/FCL',
            'CY-CFS',
            'Rail',
            'Dock',
            'NA',
            'NA',
            'NA',
            'NA',
            ...[
                charges[0]?.chargeCode || 'DOC',
                charges[0]?.chargeName || 'Documentation Fee',
                uoms.find(u => u.UOMMasterSid === charges[0]?.UOM)?.UOMCode || uoms[0]?.UOMCode || 'BL',
                1,
                currencies.find(c => c.CurrencyMasterSid === charges[0]?.CurrencyMasterSid)?.currencyCode || currencies[0]?.currencyCode || 'INR',
                1,
                2500,
                2500,
                2500,
                'C',
                revenueCustomers[0]?.CustomerName || customers[0]?.CustomerName || 'CUST001',
                'Prepaid',
                currencies.find(c => c.CurrencyMasterSid === charges[0]?.CurrencyMasterSid)?.currencyCode || currencies[0]?.currencyCode || 'INR',
                1,
                1500,
                1500,
                1500,
                'D',
                costCustomers[0]?.CustomerName || 'AGENT001',
                'Prepaid'
            ],
            ...Array.from({ length: chargeBlockCount - 1 }).flatMap(() => Array(chargeHeaders.length).fill(''))
        ];
        uploadSheet.getRow(6).values = ['NOTES: 1) One row per charge line. Repeat MasterJobNo+HouseJob fields on each charge row for the same job. 2) MasterJobNo is used as the linking key - same MasterJobNo = same MasterJob. 3) Leave HBLNo/ShipmentNo blank to auto-generate. 4) Red headers are MANDATORY - all others are optional.'];

        const baseWidths = [22, 22, 18, 18, 18, 20, 20, 22, 22, 22, 22, 22, 15, 15, 24, 14, 14, 14, 16, 14, 15, 18, 18, 18, 22, 18, 18, 18, 18, 18];
        const chargeWidths = [22, 14, 12, 12, 14, 16, 12, 14, 16, 14, 18, 18, 14, 16, 12, 14, 16, 14, 18, 18];
        const widths = [
            ...baseWidths,
            ...Array.from({ length: chargeBlockCount }).flatMap(() => chargeWidths)
        ];
        widths.forEach((width, index) => uploadSheet.getColumn(index + 1).width = width);
        for (let block = 1; block < chargeBlockCount; block++) {
            const startCol = 31 + (block * chargeHeaders.length);
            const endCol = startCol + chargeHeaders.length - 1;
            for (let col = startCol; col <= endCol; col++) {
                uploadSheet.getColumn(col).outlineLevel = 1;
                uploadSheet.getColumn(col).hidden = false;
            }
            uploadSheet.getCell(3, startCol).value = `ADD CHARGE ${block + 1}`;
        }

        this.styleServiceJobUploadSheet(uploadSheet);

        const refColumns: { title: string; values: string[] }[] = [
            { title: 'CargoType', values: ['General', 'Haz', 'Refer', 'Tanker', 'OOG'] },
            { title: 'JobType', values: ['Import', 'Export', 'Transhipment'] },
            { title: 'ShipmentTerms', values: ['FCL/FCL', 'FCL/LCL', 'LCL/FCL', 'LCL/LCL', 'LTL', 'FTL', 'FTL HH'] },
            { title: 'MovementType', values: ['CY-CFS', 'CFS-FO', 'CFS-CY', 'CFS-CFS', 'FO-FI', 'Door-Door', 'CY-Door', 'CY-FO'] },
            { title: 'ModeOfTransport', values: ['Rail', 'Road', 'Flight', 'Vessel'] },
            { title: 'StuffingAt', values: ['Dock', 'Factory'] },
            { title: 'Department', values: departments.map(x => x.departmentName).filter(Boolean) },
            { title: 'Customer', values: customers.map(x => x.CustomerName).filter(Boolean) },
            { title: 'Port', values: ports.map(x => this.formatServiceJobPort(x)).filter(Boolean) },
            { title: 'ContainerType', values: containerTypes.map(x => x.ContainerName || x.ContainerCode).filter(Boolean) },
            { title: 'ChargeCode', values: chargeReferenceRows.map(x => String(x.chargeCode || '')) },
            { title: 'ChargeDescription', values: chargeReferenceRows.map(x => String(x.chargeName || '')) },
            { title: 'ChargeUOM', values: chargeReferenceRows.map(x => String(x.uomCode || '')) },
            { title: 'ChargeCurrency', values: chargeReferenceRows.map(x => String(x.currencyCode || '')) },
            { title: 'ChargeUnitQty', values: chargeReferenceRows.map(x => String(x.unitQty || '')) },
            { title: 'ChargeRevExchangeRate', values: chargeReferenceRows.map(x => String(x.revenueExchangeRate ?? '')) },
            { title: 'ChargeCostExchangeRate', values: chargeReferenceRows.map(x => String(x.costExchangeRate ?? '')) },
            { title: 'UOM', values: uoms.map(x => x.UOMCode).filter(Boolean) },
            { title: 'Currency', values: currencies.map(x => x.currencyCode).filter(Boolean) },
            { title: 'DrCr', values: ['C', 'D'] },
            { title: 'PrepaidCollect', values: ['Prepaid', 'Collect'] },
            { title: 'RevenueCustomer', values: revenueCustomers.map(x => x.CustomerName).filter(Boolean) },
            { title: 'CostAgent', values: costCustomers.map(x => x.CustomerName).filter(Boolean) },
        ];
        this.populateReferenceSheet(refSheet, refColumns);
        const customerAddressRowCount = this.populateServiceJobCustomerAddressSheet(customerAddressSheet, customers);
        this.addServiceJobValidations(uploadSheet, refColumns);
        this.addServiceJobCustomerAddressValidation(uploadSheet, customerAddressRowCount);
        this.addServiceJobChargeFormulas(uploadSheet, refColumns);
        this.applyServiceJobUploadMerges(uploadSheet);

        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer as ArrayBuffer);
    }

    async parseServiceJobExcel(
        buffer: Buffer,
        CompanyMasterSid: number,
        BranchMasterSid: number
    ): Promise<{ validRows: any[]; invalidRows: any[]; summary: { total: number; valid: number; invalid: number } }> {
        await this.validateServiceJobExcelContext(CompanyMasterSid, BranchMasterSid);

        let workbook: XLSX.WorkBook;
        try {
            workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        } catch (error) {
            throw new BadRequestException('Malformed Excel file. Please download a fresh template and try again.');
        }

        const sheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'servicejob_upload');
        if (!sheetName) {
            throw new BadRequestException('Invalid template. Sheet "ServiceJob_Upload" is required.');
        }

        const sheetRows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
            defval: null,
            raw: false,
        });
        const rows = sheetRows
            .slice(6)
            .map((row, index) => ({ row, rowNum: index + 7 }))
            .filter(({ row }) => this.isServiceJobExcelDataRow(row));

        const [
            departments, customers, ports, containerTypes, charges, uoms, currencies, revenueCustomers, costCustomers, existingHouseJobs, existingMasterJobs
        ] = await Promise.all([
            this._db.departmentMaster.findMany({ where: { CompanyMasterSid, Status: 'A' } }),
            this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid,
                    status: 'A',
                    CustomerType: {
                        path: ['customer'],
                        equals: 'isTrue'
                    },
                    CustomerBranch: { some: { status: 'A' } }
                },
                include: { CustomerBranch: { where: { status: 'A', CompanyMasterSid } } }
            }),
            this._db.portMaster.findMany({ where: { status: 'A' } }),
            this._db.containerTypeMaster.findMany({ where: { status: 'A' } }),
            this._db.chargeMaster.findMany({ where: { CompanyMasterSid, Status: 'A' } }),
            this._db.uOMMaster.findMany({ where: { status: 'A' } }),
            this._db.currencyMaster.findMany(),
            this.getServiceJobMappedParties(CompanyMasterSid, 'DrCOAMasterSid'),
            this.getServiceJobMappedParties(CompanyMasterSid, 'CrCOAMasterSid'),
            this._db.houseJob.findMany({
                where: { CompanyMasterSid, BranchMasterSid, IsServiceJob: 'Y', status: { not: 'D' } },
                select: { HBLNo: true, MBLNo: true, ShipmentNo: true }
            }),
            this._db.masterJob.findMany({
                where: { CompanyMasterSid, BranchMasterSid, Status: { not: 'D' } },
                select: { MasterJobNumber: true }
            }),
        ]);

        const departmentMap = this.toLookupMap(departments, ['departmentName', 'departmentCode']);
        const portsForLookup = ports.map(port => ({
            ...port,
            PortDisplay: this.formatServiceJobPort(port)
        }));
        const portMap = this.toLookupMap(portsForLookup, ['PortCode', 'PortDisplay']);
        const containerMap = this.toLookupMap(containerTypes, ['ContainerName', 'ContainerCode']);
        const chargeMap = this.toLookupMap(charges, ['chargeCode', 'chargeName']);
        const uomMap = this.toLookupMap(uoms, ['UOMCode', 'UOMName']);
        const currencyMap = this.toLookupMap(currencies, ['currencyCode']);
        const customerMap = this.toLookupMap(customers, ['CustomerName']);
        const revenueCustomerMap = this.toLookupMap(revenueCustomers, ['CustomerName']);
        const costCustomerMap = this.toLookupMap(costCustomers, ['CustomerName']);

        const existingHbl = new Set(existingHouseJobs.map(x => this.lookupKey(x.HBLNo)).filter(Boolean));
        const existingJobNo = new Set([
            ...existingHouseJobs.map(x => this.lookupKey(x.MBLNo)),
            ...existingMasterJobs.map(x => this.lookupKey(x.MasterJobNumber))
        ].filter(Boolean));
        const existingShipmentNo = new Set(existingHouseJobs.map(x => this.lookupKey(x.ShipmentNo)).filter(Boolean));
        const fileHbl = new Set<string>();
        const fileJobNo = new Set<string>();
        const fileShipmentNo = new Set<string>();

        const validRows: any[] = [];
        const invalidRows: any[] = [];

        for (const { row, rowNum } of rows) {
            const errors: string[] = [];
            const text = (idx: number) => this.cleanExcelText(row[idx]);
            const num = (idx: number, label: string, required = false) => {
                const value = text(idx);
                if (!value) {
                    if (required) errors.push(`${label} is required`);
                    return null;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    errors.push(`${label} must be a valid non-negative number`);
                    return null;
                }
                return parsed;
            };

            const departmentName = text(0);
            const department = departmentMap.get(this.lookupKey(departmentName));
            if (!departmentName) errors.push('Department is required');
            else if (!department) errors.push(`Department "${departmentName}" not found`);

            const jobDate = this.parseServiceJobExcelDate(row[1]);
            if (row[1] && !jobDate) errors.push('Job Date is invalid. Use DD-MM-YYYY');

            const customerCode = text(2);
            const customer = customerMap.get(this.lookupKey(customerCode));
            if (!customerCode) errors.push('Customer Name is required');
            else if (!customer) errors.push(`Customer Name "${customerCode}" not found`);

            const customerAddress = text(3);
            let customerBranch: any = null;
            if (!customerAddress) {
                errors.push('Customer Address is required');
            } else if (customer) {
                customerBranch = this.matchCustomerBranch(customer.CustomerBranch || [], customerAddress);
                if (!customerBranch) errors.push(`Customer Address "${customerAddress}" not found for customer "${customerCode}"`);
            }

            const jobNo = text(4);
            const hblNo = text(5);
            const shipmentNo = text(6);
            this.validateDuplicateValue('Job No.', jobNo, fileJobNo, existingJobNo, errors);
            this.validateDuplicateValue('HBLNo', hblNo, fileHbl, existingHbl, errors);
            this.validateDuplicateValue('ShipmentNo', shipmentNo, fileShipmentNo, existingShipmentNo, errors);

            const jobType = text(7);
            if (jobType && !['import', 'export', 'transhipment'].includes(jobType.toLowerCase())) {
                errors.push(`JobType "${jobType}" is invalid`);
            }

            const polInput = text(12);
            const podInput = text(13);
            const polPort = polInput ? portMap.get(this.lookupKey(polInput)) : null;
            const podPort = podInput ? portMap.get(this.lookupKey(podInput)) : null;
            if (polInput && !polPort) errors.push(`POL "${polInput}" not found`);
            if (podInput && !podPort) errors.push(`POD "${podInput}" not found`);
            if (polPort && podPort && this.lookupKey(polPort.PortCode) === this.lookupKey(podPort.PortCode)) errors.push('POL and POD cannot be same');
            const pol = polPort?.PortCode || polInput;
            const pod = podPort?.PortCode || podInput;

            const cargoType = text(14) || 'General';
            if (!['general', 'haz', 'refer', 'tanker', 'oog'].includes(cargoType.toLowerCase())) {
                errors.push(`CargoType "${cargoType}" is invalid`);
            }
            const grossWeight = num(15, 'GrossWeight') ?? 0;
            const netWeight = num(16, 'NetWeight') ?? 0;
            if (grossWeight && netWeight && grossWeight <= netWeight) errors.push('Gross Weight should be greater than Net Weight');
            const volume = num(17, 'Volume_CBM') ?? 0;
            const chargeableWeight = num(18, 'ChargeableWeight') ?? 0;
            const noOfPackage = num(19, 'NoOfPackage') ?? 0;
            const noofContainers = num(20, 'NoofContainers') ?? 0;

            const containerTypeName = text(21);
            const containerType = containerTypeName ? containerMap.get(this.lookupKey(containerTypeName)) : null;
            if (containerTypeName && !containerType) errors.push(`ContainerTypeName "${containerTypeName}" not found`);

            const shipmentTerms = text(22);
            if (shipmentTerms && !['fcl/fcl', 'fcl/lcl', 'lcl/fcl', 'lcl/lcl', 'ltl', 'ftl', 'ftl hh'].includes(shipmentTerms.toLowerCase())) {
                errors.push(`ShipmentTerms "${shipmentTerms}" is invalid`);
            }
            const movementType = text(23);
            if (movementType && !['cy-cfs', 'cfs-fo', 'cfs-cy', 'cfs-cfs', 'fo-fi', 'door-door', 'cy-door', 'cy-fo'].includes(movementType.toLowerCase())) {
                errors.push(`MovementType "${movementType}" is invalid`);
            }
            const modeOfTransport = text(24);
            if (modeOfTransport && !['rail', 'road', 'flight', 'vessel'].includes(modeOfTransport.toLowerCase())) {
                errors.push(`ModeOfTransport "${modeOfTransport}" is invalid`);
            }
            const stuffingAt = text(25) || 'Dock';
            if (stuffingAt && !['dock', 'factory'].includes(stuffingAt.toLowerCase())) {
                errors.push(`StuffingAt "${stuffingAt}" is invalid`);
            }

            const externalNote = text(26);
            const internalNote = text(27);
            const commodityDescription = text(28);
            const marksAndNumber = text(29);

            const chargeRecords: any[] = [];
            for (let block = 0; block < 6; block++) {
                const offset = 30 + (block * 20);
                const blockLabel = block === 0 ? '' : `Charge ${block + 1}: `;
                const chargeCode = text(offset);
                const chargeDescriptionInput = text(offset + 1);
                const hasAnyChargeData = Array.from({ length: 20 }).some((_, i) => !!text(offset + i));
                if (!hasAnyChargeData) continue;

                const charge = chargeCode ? chargeMap.get(this.lookupKey(chargeCode)) : (chargeDescriptionInput ? chargeMap.get(this.lookupKey(chargeDescriptionInput)) : null);
                if (!chargeCode) errors.push(`${blockLabel}ChargeCode is required`);
                else if (!charge) errors.push(`${blockLabel}ChargeCode "${chargeCode}" not found`);
                if (charge && departmentName && Array.isArray(charge.DepartmentMasterSid) && charge.DepartmentMasterSid.length && !charge.DepartmentMasterSid.includes(departmentName)) {
                    errors.push(`${blockLabel}ChargeCode "${chargeCode}" is not mapped with Department "${departmentName}"`);
                }

                const chargeDescription = chargeDescriptionInput || charge?.chargeName || '';
                if (!chargeDescription) errors.push(`${blockLabel}ChargeDescription is required`);

                const uomCode = text(offset + 2);
                const resolvedUom = uomCode ? uomMap.get(this.lookupKey(uomCode)) : (charge?.UOM ? uoms.find(x => x.UOMMasterSid === charge.UOM) : null);
                if (!uomCode && !resolvedUom) errors.push(`${blockLabel}UOM is required`);
                else if (uomCode && !resolvedUom) errors.push(`${blockLabel}UOM "${uomCode}" not found`);

                const autoNoOfUnit = this.resolveServiceJobChargeQuantity(charge?.UnitQty, {
                    grossWeight,
                    volume,
                    chargeableWeight,
                    noofContainers,
                });
                const noOfUnit = num(offset + 3, `${blockLabel}NoOfUnit`) ?? autoNoOfUnit;
                if (noOfUnit !== null && noOfUnit <= 0) errors.push(`${blockLabel}NoOfUnit must be greater than zero`);

                const chargeCurrency = charge?.CurrencyMasterSid ? currencies.find(x => x.CurrencyMasterSid === charge.CurrencyMasterSid) : null;
                const revCurrencyCode = text(offset + 4) || chargeCurrency?.currencyCode || '';
                const revCurrency = revCurrencyCode ? currencyMap.get(this.lookupKey(revCurrencyCode)) : null;
                if (revCurrencyCode && !revCurrency) errors.push(`${blockLabel}Rev_Currency "${revCurrencyCode}" not found`);
                const revExchangeRate = num(offset + 5, `${blockLabel}Rev_ExchangeRate`) ?? (revCurrency ? 1 : null);
                const revRate = num(offset + 6, `${blockLabel}Rev_Rate`);
                const revAmountInput = num(offset + 7, `${blockLabel}Rev_Amount`);
                const revAmount = revAmountInput ?? (revRate !== null ? Number(noOfUnit || 0) * Number(revRate) : null);
                const revLocalAmount = num(offset + 8, `${blockLabel}Rev_LocalAmount`) ?? (revAmount !== null && revExchangeRate !== null ? Number(revAmount) * Number(revExchangeRate) : null);
                const revDrCr = text(offset + 9) || 'C';
                if (revDrCr && !['C', 'D'].includes(revDrCr.toUpperCase())) errors.push(`${blockLabel}Rev_DrCr "${revDrCr}" is invalid`);
                const revCustomerCode = text(offset + 10) || customerCode;
                const revCustomer = revCustomerCode ? revenueCustomerMap.get(this.lookupKey(revCustomerCode)) : null;
                const revCustomerBranch = revCustomer ? this.firstCustomerBranch(revCustomer) : null;
                if (revCustomerCode && !revCustomer) errors.push(`${blockLabel}Rev_CustomerCode "${revCustomerCode}" not found in mapped debtor list`);
                const revPPCC = text(offset + 11) || 'Prepaid';
                if (revPPCC && !['prepaid', 'collect'].includes(revPPCC.toLowerCase())) errors.push(`${blockLabel}Rev_PrepaidCollect "${revPPCC}" is invalid`);

                const costCurrencyCode = text(offset + 12) || chargeCurrency?.currencyCode || '';
                const costCurrency = costCurrencyCode ? currencyMap.get(this.lookupKey(costCurrencyCode)) : null;
                if (costCurrencyCode && !costCurrency) errors.push(`${blockLabel}Cost_Currency "${costCurrencyCode}" not found`);
                const costExchangeRate = num(offset + 13, `${blockLabel}Cost_ExchangeRate`) ?? (costCurrency ? 1 : null);
                const costRate = num(offset + 14, `${blockLabel}Cost_Rate`);
                const costAmountInput = num(offset + 15, `${blockLabel}Cost_Amount`);
                const costAmount = costAmountInput ?? (costRate !== null ? Number(noOfUnit || 0) * Number(costRate) : null);
                const costLocalAmount = num(offset + 16, `${blockLabel}Cost_LocalAmount`) ?? (costAmount !== null && costExchangeRate !== null ? Number(costAmount) * Number(costExchangeRate) : null);
                const costDrCr = text(offset + 17) || 'D';
                if (costDrCr && !['C', 'D'].includes(costDrCr.toUpperCase())) errors.push(`${blockLabel}Cost_DrCr "${costDrCr}" is invalid`);
                const costAgentCode = text(offset + 18);
                const costAgent = costAgentCode ? costCustomerMap.get(this.lookupKey(costAgentCode)) : null;
                const costAgentBranch = costAgent ? this.firstCustomerBranch(costAgent) : null;
                if (costAgentCode && !costAgent) errors.push(`${blockLabel}Cost_AgentCode "${costAgentCode}" not found in mapped creditor list`);
                const costPPCC = text(offset + 19) || 'Prepaid';
                if (costPPCC && !['prepaid', 'collect'].includes(costPPCC.toLowerCase())) errors.push(`${blockLabel}Cost_PrepaidCollect "${costPPCC}" is invalid`);

                const hasRevenue = !!(revCurrency || revExchangeRate || revRate || revAmount || revLocalAmount || revCustomer);
                const hasCost = !!(costCurrency || costExchangeRate || costRate || costAmount || costLocalAmount || costAgent);
                if (!Number(revLocalAmount || 0) && !Number(costLocalAmount || 0)) {
                    errors.push(`${blockLabel}Please fill at least one side: Revenue or Cost local amount`);
                }
                if (hasRevenue && (!revCurrency || !revExchangeRate || !revCustomerBranch)) {
                    errors.push(`${blockLabel}Revenue Currency, Exchange Rate and Billing Party are required when Revenue side is filled`);
                }
                if (hasCost && (!costCurrency || !costExchangeRate)) {
                    errors.push(`${blockLabel}Cost Currency and Exchange Rate are required when Cost side is filled`);
                }

                chargeRecords.push({
                    ChargeMasterSid: charge?.ChargeMasterSid ?? null,
                    ChargeDescription: chargeDescription || charge?.chargeName || '',
                    ChargeUomSid: resolvedUom?.UOMMasterSid ?? null,
                    RevenueChargeUomSid: resolvedUom?.UOMMasterSid ?? null,
                    CostChargeUomSid: resolvedUom?.UOMMasterSid ?? null,
                    NoOfUnit: noOfUnit,
                    RevenueNumberOfUnit: noOfUnit,
                    CostNumberOfUnit: noOfUnit,
                    RevenueCurrencyMasterSid: revCurrency?.CurrencyMasterSid ?? null,
                    RevenueExchangeRate: revExchangeRate,
                    RevenueRate: revRate,
                    RevenueAmount: revAmount,
                    RevenueLocalAmount: revLocalAmount,
                    RevenueDrCr: revDrCr.toUpperCase(),
                    RevenueCustomerMasterSid: revCustomer?.CustomerMasterSid ?? null,
                    RevenueCustomerBranchSid: revCustomerBranch?.CustomerBranchSid ?? null,
                    RevenuePrepaidCollect: revPPCC,
                    CostCurrencyMasterSid: costCurrency?.CurrencyMasterSid ?? null,
                    CostExchangeRate: costExchangeRate,
                    CostRate: costRate,
                    CostAmount: costAmount,
                    CostLocalAmount: costLocalAmount,
                    CostDrCr: costDrCr.toUpperCase(),
                    CostAgentMasterSid: costAgent?.CustomerMasterSid ?? null,
                    CostAgentBranchSid: costAgentBranch?.CustomerBranchSid ?? null,
                    CostPrepaidCollect: costPPCC,
                    status: 'Active',
                    Remarks: ''
                });
            }
            const rowResult = {
                rowNum,
                department: departmentName,
                jobDate: jobDate ? jobDate.toISOString() : null,
                customerCode,
                customerAddress,
                jobNo,
                hblNo,
                shipmentNo,
                jobType,
                shipperName: text(8),
                shipperAddress: text(9),
                consigneeName: text(10),
                consigneeAddress: text(11),
                pol,
                pod,
                cargoType,
                grossWeight,
                netWeight,
                volume,
                chargeableWeight,
                noOfPackage,
                noofContainers,
                containerTypeName,
                shipmentTerms,
                movementType,
                modeOfTransport,
                stuffingAt,
                externalNote,
                internalNote,
                commodityDescription,
                marksAndNumber,
                chargeDescription: chargeRecords[0]?.ChargeDescription || '',
                chargeCode: text(30),
                uom: text(32),
                noOfUnit: chargeRecords[0]?.NoOfUnit ?? null,
                DepartmentMasterSid: department?.DepartmentMasterSid ?? null,
                CustomerMasterSid: customer?.CustomerMasterSid ?? null,
                CustomerBranchSid: customerBranch?.CustomerBranchSid ?? null,
                CustomerName: customer?.CustomerName ?? customerCode,
                CustomerAddress: customerAddress,
                ContainerType: containerType?.ContainerTypeMasterSid ?? null,
                chargeRecord: chargeRecords[0] || null,
                chargeRecords
            };

            if (errors.length) invalidRows.push({ ...rowResult, errors });
            else validRows.push(rowResult);
        }

        return {
            validRows,
            invalidRows,
            summary: {
                total: validRows.length + invalidRows.length,
                valid: validRows.length,
                invalid: invalidRows.length,
            }
        };
    }

    async saveServiceJobExcel(
        validRows: any[],
        CompanyMasterSid: number,
        BranchMasterSid: number,
        createdBy: string
    ): Promise<{ created: number; skipped: number; errors: any[] }> {
        await this.validateServiceJobExcelContext(CompanyMasterSid, BranchMasterSid);

        let created = 0;
        let skipped = 0;
        const errors: any[] = [];

        for (const row of validRows) {
            const duplicateChecks = [
                ...(row.hblNo ? [{ HBLNo: { equals: row.hblNo, mode: 'insensitive' as const } }] : []),
                ...(row.jobNo ? [{ MBLNo: { equals: row.jobNo, mode: 'insensitive' as const } }] : []),
                ...(row.shipmentNo ? [{ ShipmentNo: { equals: row.shipmentNo, mode: 'insensitive' as const } }] : []),
            ];
            const duplicate = duplicateChecks.length
                ? await this._db.houseJob.findFirst({
                    where: {
                        CompanyMasterSid,
                        BranchMasterSid,
                        IsServiceJob: 'Y',
                        status: { not: 'D' },
                        OR: duplicateChecks
                    }
                })
                : null;

            if (duplicate) {
                skipped++;
                errors.push({ row: row.rowNum, message: 'Duplicate found at save time - skipped' });
                continue;
            }

            try {
                await this.createServiceJob({
                    CompanyMasterSid,
                    BranchMasterSid,
                    DepartmentMasterSid: Number(row.DepartmentMasterSid),
                    BookingNo: '',
                    CustomerMasterSid: Number(row.CustomerMasterSid),
                    CustomerBranchSid: Number(row.CustomerBranchSid) || 0,
                    CustomerName: row.CustomerName,
                    CustomerAddress: row.CustomerAddress,
                    ShipperName: row.shipperName || '',
                    ShipperAddress: row.shipperAddress || '',
                    ConsigneeName: row.consigneeName || '',
                    ConsigneeAddress: row.consigneeAddress || '',
                    MBLNo: row.jobNo || '',
                    MBLDate: row.jobDate ? new Date(row.jobDate) : new Date(),
                    HBLNo: row.hblNo || '',
                    HBLDate: row.jobDate ? new Date(row.jobDate) : undefined,
                    ShipmentNo: row.shipmentNo || '',
                    JobType: row.jobType || null,
                    FreightPPCC: row.chargeRecords?.[0]?.RevenuePrepaidCollect || row.chargeRecords?.[0]?.CostPrepaidCollect || row.chargeRecord?.RevenuePrepaidCollect || row.chargeRecord?.CostPrepaidCollect || 'Prepaid',
                    FreightTerms: row.chargeRecords?.[0]?.RevenuePrepaidCollect || row.chargeRecords?.[0]?.CostPrepaidCollect || row.chargeRecord?.RevenuePrepaidCollect || row.chargeRecord?.CostPrepaidCollect || 'Prepaid',
                    POL: row.pol || '',
                    POD: row.pod || '',
                    status: 'A',
                    houseJobCargo: {
                        CargoType: row.cargoType || 'General',
                        GrossWeight: Number(row.grossWeight) || 0,
                        NetWeight: Number(row.netWeight) || 0,
                        Volume: Number(row.volume) || 0,
                        ChargeableWeight: Number(row.chargeableWeight) || 0,
                        ContainerType: row.ContainerType || null,
                        NoOfPackage: Number(row.noOfPackage) || 0,
                        FreightAmount: '0',
                        ShipmentTerms: row.shipmentTerms || '',
                        FreightTerms: row.chargeRecords?.[0]?.RevenuePrepaidCollect || row.chargeRecords?.[0]?.CostPrepaidCollect || row.chargeRecord?.RevenuePrepaidCollect || row.chargeRecord?.CostPrepaidCollect || '',
                        ModeOfTransport: row.modeOfTransport || '',
                        MovementType: row.movementType || '',
                        NoofContainers: Number(row.noofContainers) || 0,
                        Qty: 0,
                        StuffingAt: row.stuffingAt || 'Dock',
                        CommodityDescription: row.commodityDescription || '',
                        MarksAndNumber: row.marksAndNumber || '',
                    },
                    houseJobOthers: {
                        ExternalNote: row.externalNote || '',
                        InternalNote: row.internalNote || '',
                    },
                    costRevenueCharges: Array.isArray(row.chargeRecords) && row.chargeRecords.length
                        ? row.chargeRecords.filter(charge => charge?.ChargeMasterSid)
                        : (row.chargeRecord?.ChargeMasterSid ? [row.chargeRecord] : []),
                    milestones: [],
                    createdBy,
                    updatedBy: createdBy,
                });
                created++;
            } catch (error) {
                skipped++;
                errors.push({ row: row.rowNum, message: error.message || 'DB insert failed' });
            }
        }

        return { created, skipped, errors };
    }

    private async validateServiceJobExcelContext(CompanyMasterSid: number, BranchMasterSid: number): Promise<void> {
        const companyId = Number(CompanyMasterSid);
        const branchId = Number(BranchMasterSid);

        if (!companyId) {
            throw new BadRequestException('CompanyMasterSid is required');
        }

        if (!branchId) {
            throw new BadRequestException('BranchMasterSid is required');
        }

        const branch = await this._db.branchMaster.findFirst({
            where: {
                BranchMasterSid: branchId,
                CompanyMasterSid: companyId,
                status: { not: 'D' },
            },
            select: { BranchMasterSid: true }
        });

        if (!branch) {
            throw new BadRequestException('Invalid company/branch selection for Service Job Excel');
        }
    }

    private async getServiceJobMappedParties(
        CompanyMasterSid: number,
        coaField: 'DrCOAMasterSid' | 'CrCOAMasterSid'
    ): Promise<any[]> {
        const mappedLedgers = await this._db.subledgerMaster.findMany({
            where: {
                Status: 'A',
                SubledgerType: 'Customer',
                [coaField]: { not: null },
                SubledgerMappingSid: { not: null },
                CompanyMasterSid
            } as any,
            select: { SubledgerMappingSid: true }
        });

        const customerIds = Array.from(new Set(
            mappedLedgers
                .map(x => Number(x.SubledgerMappingSid))
                .filter(x => Number.isFinite(x) && x > 0)
        ));

        if (!customerIds.length) return [];

        return this._db.customerMaster.findMany({
            where: {
                CustomerMasterSid: { in: customerIds },
                CompanyMasterSid,
                status: 'A'
            },
            include: {
                CustomerBranch: {
                    where: { status: 'A', CompanyMasterSid }
                }
            },
            orderBy: { CustomerName: 'asc' }
        });
    }

    private formatServiceJobPort(port: any): string {
        const code = String(port?.PortCode || '').trim();
        const name = String(port?.PortName || '').trim();
        if (!code) return '';
        return name ? `${code}-${name}` : code;
    }

    private async buildServiceJobChargeReferenceRows(
        charges: any[],
        uoms: any[],
        currencies: any[],
        context: { CompanyMasterSid: number; BranchMasterSid: number; companyCurrencyCode: string }
    ): Promise<any[]> {
        const uomBySid = new Map(uoms.map(uom => [Number(uom.UOMMasterSid), uom]));
        const currencyBySid = new Map(currencies.map(currency => [Number(currency.CurrencyMasterSid), currency]));

        return Promise.all((charges || []).map(async charge => {
            const currency = charge.CurrencyMasterSid ? currencyBySid.get(Number(charge.CurrencyMasterSid)) : null;
            const currencyCode = currency?.currencyCode || '';
            const revenueExchangeRate = await this.getServiceJobExcelExchangeRate({
                ...context,
                fromCurrencyCode: currencyCode,
                segment: 'revenue',
            });
            const costExchangeRate = await this.getServiceJobExcelExchangeRate({
                ...context,
                fromCurrencyCode: currencyCode,
                segment: 'cost',
            });

            return {
                chargeCode: charge.chargeCode || '',
                chargeName: charge.chargeName || '',
                uomCode: charge.UOM ? (uomBySid.get(Number(charge.UOM))?.UOMCode || '') : '',
                currencyCode,
                unitQty: charge.UnitQty || '',
                revenueExchangeRate,
                costExchangeRate,
            };
        }));
    }

    private async getServiceJobExcelExchangeRate(payload: {
        CompanyMasterSid: number;
        BranchMasterSid: number;
        companyCurrencyCode: string;
        fromCurrencyCode: string;
        segment: 'revenue' | 'cost';
    }): Promise<number | string> {
        const fromCurrencyCode = String(payload.fromCurrencyCode || '').trim();
        const toCurrencyCode = String(payload.companyCurrencyCode || '').trim();
        if (!fromCurrencyCode || !toCurrencyCode) return '';
        if (fromCurrencyCode.toLowerCase() === toCurrencyCode.toLowerCase()) return 1;

        const exchangeRate = await this._db.currencyExchange.findFirst({
            where: {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                FromCurrency: fromCurrencyCode,
                ToCurrency: toCurrencyCode,
                status: 'A',
                EffectiveFrom: { lte: new Date() }
            },
            orderBy: [
                { EffectiveFrom: 'desc' },
                { CurrencyExchangeSid: 'desc' }
            ]
        });

        const rate = payload.segment === 'cost' ? exchangeRate?.BuyRate : exchangeRate?.SellRate;
        return rate != null ? Number(rate) : '';
    }

    private styleServiceJobUploadSheet(sheet: ExcelJS.Worksheet): void {
        const titleFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1F4E78' } };
        const serviceSectionFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFED7D00' } };
        const cargoSectionFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF00A6C8' } };
        const rateSectionFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF9C4A00' } };
        const mandatoryFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFC00000' } };
        const optionalFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF808080' } };
        const mandatoryHeaders = new Set([1, 3, 4, 31]);

        sheet.getRow(1).height = 24;
        sheet.getRow(2).height = 20;
        sheet.getRow(3).height = 22;
        sheet.getRow(4).height = 42;
        sheet.getRow(6).height = 38;

        [1, 2].forEach(rowNo => {
            const row = sheet.getRow(rowNo);
            row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: rowNo === 1 ? 14 : 10 };
            row.fill = titleFill;
            row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        const styleSectionRange = (startCol: number, endCol: number, fill: ExcelJS.Fill) => {
            for (let col = startCol; col <= endCol; col++) {
                const cell = sheet.getCell(3, col);
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = fill;
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = this.excelThinBorder();
            }
        };
        styleSectionRange(1, 14, serviceSectionFill);
        styleSectionRange(15, 30, cargoSectionFill);
        styleSectionRange(31, sheet.columnCount || 50, rateSectionFill);

        sheet.getRow(4).eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.fill = mandatoryHeaders.has(colNumber) || String(cell.value || '').includes('*') ? mandatoryFill : optionalFill;
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = this.excelThinBorder();
        });

        sheet.getRow(5).eachCell({ includeEmpty: true }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.border = this.excelThinBorder();
        });

        sheet.getRow(6).eachCell({ includeEmpty: true }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
            cell.font = { italic: true, color: { argb: 'FF7F6000' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        });
    }

    private applyServiceJobUploadMerges(sheet: ExcelJS.Worksheet): void {
        sheet.mergeCells('A1:AX1');
        sheet.mergeCells('A3:N3');
        sheet.mergeCells('O3:AD3');
        sheet.mergeCells('AE3:AX3');
        sheet.mergeCells('A6:AX6');

        sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        sheet.getCell('A3').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        sheet.getCell('O3').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        sheet.getCell('AE3').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        sheet.getCell('A6').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }

    private populateReferenceSheet(sheet: ExcelJS.Worksheet, refColumns: { title: string; values: string[] }[]): void {
        sheet.mergeCells('A1:F1');
        sheet.getCell('A1').value = '';
        sheet.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
        sheet.getCell('A1').alignment = { horizontal: 'center' };

        refColumns.forEach((column, index) => {
            const excelCol = index + 1;
            sheet.getCell(3, excelCol).value = column.title;
            sheet.getCell(3, excelCol).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getCell(3, excelCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00A6C8' } };
            sheet.getColumn(excelCol).width = Math.max(18, column.title.length + 4);
            column.values.forEach((value, valueIndex) => {
                sheet.getCell(valueIndex + 4, excelCol).value = value;
            });
        });
    }

    private populateServiceJobCustomerAddressSheet(sheet: ExcelJS.Worksheet, customers: any[]): number {
        sheet.getRow(1).values = ['CustomerName', 'CustomerAddress'];
        sheet.getRow(1).font = { bold: true };
        sheet.getColumn(1).width = 35;
        sheet.getColumn(2).width = 60;

        let rowIndex = 2;
        for (const customer of customers || []) {
            const addresses = (customer.CustomerBranch || [])
                .map(branch => String(branch.Address || '').trim())
                .filter(Boolean);
            for (const address of addresses) {
                sheet.getCell(rowIndex, 1).value = customer.CustomerName || '';
                sheet.getCell(rowIndex, 2).value = address;
                rowIndex++;
            }
        }
        return rowIndex - 1;
    }

    private addServiceJobValidations(sheet: ExcelJS.Worksheet, refColumns: { title: string; values: string[] }[]): void {
        const refIndex = new Map(refColumns.map((column, index) => [column.title, index + 1]));
        const colLetter = (col: number) => sheet.workbook.getWorksheet('Reference_Values')!.getColumn(col).letter;
        const addListValidation = (uploadCol: string, refTitle: string) => {
            const refCol = refIndex.get(refTitle);
            const valuesCount = refColumns.find(c => c.title === refTitle)?.values.length || 0;
            if (!refCol || valuesCount === 0) return;
            const formula = `Reference_Values!$${colLetter(refCol)}$4:$${colLetter(refCol)}$${valuesCount + 3}`;
            for (let row = 7; row <= 1000; row++) {
                sheet.getCell(`${uploadCol}${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [formula],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Invalid value',
                    error: 'Select a value from the dropdown list.'
                };
            }
        };

        addListValidation('A', 'Department');
        addListValidation('C', 'Customer');
        addListValidation('H', 'JobType');
        addListValidation('M', 'Port');
        addListValidation('N', 'Port');
        addListValidation('O', 'CargoType');
        addListValidation('V', 'ContainerType');
        addListValidation('W', 'ShipmentTerms');
        addListValidation('X', 'MovementType');
        addListValidation('Y', 'ModeOfTransport');
        addListValidation('Z', 'StuffingAt');
        for (let block = 0; block < 6; block++) {
            const startCol = 31 + (block * 20);
            const col = (offset: number) => sheet.getColumn(startCol + offset).letter;
            addListValidation(col(0), 'ChargeCode');
            addListValidation(col(1), 'ChargeDescription');
            addListValidation(col(2), 'UOM');
            addListValidation(col(4), 'Currency');
            addListValidation(col(9), 'DrCr');
            addListValidation(col(10), 'RevenueCustomer');
            addListValidation(col(11), 'PrepaidCollect');
            addListValidation(col(12), 'Currency');
            addListValidation(col(17), 'DrCr');
            addListValidation(col(18), 'CostAgent');
            addListValidation(col(19), 'PrepaidCollect');
        }
    }

    private addServiceJobCustomerAddressValidation(sheet: ExcelJS.Worksheet, customerAddressRowCount: number): void {
        if (customerAddressRowCount < 2) return;

        const customerRange = `Customer_Address_Values!$A$2:$A$${customerAddressRowCount}`;
        const addressRange = `Customer_Address_Values!$B$2:$B$${customerAddressRowCount}`;
        for (let row = 7; row <= 1000; row++) {
            sheet.getCell(`D${row}`).value = {
                formula: `IF($C${row}="","",IFERROR(INDEX(${addressRange},MATCH($C${row},${customerRange},0)),""))`,
                result: ''
            };
            sheet.getCell(`D${row}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`OFFSET(Customer_Address_Values!$B$2,MATCH($C${row},${customerRange},0)-1,0,COUNTIF(${customerRange},$C${row}),1)`],
                showErrorMessage: true,
                errorStyle: 'error',
                errorTitle: 'Invalid customer address',
                error: 'Select an address mapped to the selected customer.'
            };
        }
    }

    private addServiceJobChargeFormulas(sheet: ExcelJS.Worksheet, refColumns: { title: string; values: string[] }[]): void {
        const refSheet = sheet.workbook.getWorksheet('Reference_Values');
        if (!refSheet) return;

        const refIndex = new Map(refColumns.map((column, index) => [column.title, index + 1]));
        const colLetter = (title: string) => {
            const col = refIndex.get(title);
            return col ? refSheet.getColumn(col).letter : '';
        };
        const range = (title: string) => {
            const letter = colLetter(title);
            const valuesCount = refColumns.find(c => c.title === title)?.values.length || 0;
            return letter && valuesCount ? `Reference_Values!$${letter}$4:$${letter}$${valuesCount + 3}` : '';
        };

        const codeRange = range('ChargeCode');
        if (!codeRange) return;

        const lookupFormula = (row: number, title: string) => {
            const targetRange = range(title);
            return targetRange ? `IF($AE${row}="","",IFERROR(INDEX(${targetRange},MATCH($AE${row},${codeRange},0)),""))` : '""';
        };

        for (let block = 0; block < 6; block++) {
            const startCol = 31 + (block * 20);
            const col = (offset: number) => sheet.getColumn(startCol + offset).letter;
            for (let row = 7; row <= 1000; row++) {
                const chargeCodeCell = `$${col(0)}${row}`;
                sheet.getCell(`${col(1)}${row}`).value = { formula: lookupFormula(row, 'ChargeDescription').replace(/\$AE/g, `$${col(0)}`), result: '' };
                sheet.getCell(`${col(2)}${row}`).value = { formula: lookupFormula(row, 'ChargeUOM').replace(/\$AE/g, `$${col(0)}`), result: '' };
                sheet.getCell(`${col(4)}${row}`).value = { formula: lookupFormula(row, 'ChargeCurrency').replace(/\$AE/g, `$${col(0)}`), result: '' };
                sheet.getCell(`${col(5)}${row}`).value = { formula: lookupFormula(row, 'ChargeRevExchangeRate').replace(/\$AE/g, `$${col(0)}`), result: '' };
                sheet.getCell(`${col(12)}${row}`).value = { formula: lookupFormula(row, 'ChargeCurrency').replace(/\$AE/g, `$${col(0)}`), result: '' };
                sheet.getCell(`${col(13)}${row}`).value = { formula: lookupFormula(row, 'ChargeCostExchangeRate').replace(/\$AE/g, `$${col(0)}`), result: '' };

                const unitQtyRange = range('ChargeUnitQty');
                const unitLookup = unitQtyRange ? `INDEX(${unitQtyRange},MATCH(${chargeCodeCell},${codeRange},0))` : '""';
                sheet.getCell(`${col(3)}${row}`).value = {
                    formula: `IF(${chargeCodeCell}="","",IFERROR(SWITCH(${unitLookup},"Per 20ft Cont",IF($U${row}>0,$U${row},1),"Per 40ft Cont",IF($U${row}>0,$U${row},1),"Per 45ft Cont",IF($U${row}>0,$U${row},1),"Per Cont",IF($U${row}>0,$U${row},1),"20ft",IF($U${row}>0,$U${row},1),"40ft",IF($U${row}>0,$U${row},1),"Per CBM",IF($R${row}>0,$R${row},1),"CBM",IF($R${row}>0,$R${row},1),"Per GrossWeight",IF($P${row}>0,$P${row},1),"GrossWeight",IF($P${row}>0,$P${row},1),"ChargeableWeight",IF($S${row}>0,$S${row},1),1),1))`,
                    result: ''
                };
                sheet.getCell(`${col(7)}${row}`).value = { formula: `IF(OR($${col(3)}${row}="",$${col(6)}${row}=""),"",ROUND($${col(3)}${row}*$${col(6)}${row},2))`, result: '' };
                sheet.getCell(`${col(8)}${row}`).value = { formula: `IF(OR($${col(7)}${row}="",$${col(5)}${row}=""),"",ROUND($${col(7)}${row}*$${col(5)}${row},2))`, result: '' };
                sheet.getCell(`${col(15)}${row}`).value = { formula: `IF(OR($${col(3)}${row}="",$${col(14)}${row}=""),"",ROUND($${col(3)}${row}*$${col(14)}${row},2))`, result: '' };
                sheet.getCell(`${col(16)}${row}`).value = { formula: `IF(OR($${col(15)}${row}="",$${col(13)}${row}=""),"",ROUND($${col(15)}${row}*$${col(13)}${row},2))`, result: '' };
            }
        }
    }

    private excelThinBorder(): Partial<ExcelJS.Borders> {
        return {
            top: { style: 'thin', color: { argb: 'FFD9E2F3' } },
            left: { style: 'thin', color: { argb: 'FFD9E2F3' } },
            bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } },
            right: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        };
    }

    private isServiceJobExcelDataRow(row: any[]): boolean {
        if (!row?.length) return false;
        const chargeIndexes = Array.from({ length: 6 }).flatMap((_, block) => {
            const offset = 30 + (block * 20);
            return [offset, offset + 6, offset + 14, offset + 18];
        });
        const meaningfulIndexes = [0, 2, 3, 4, 5, 6, ...chargeIndexes];
        if (!meaningfulIndexes.some(index => row[index] !== null && row[index] !== undefined && String(row[index]).trim() !== '')) return false;
        const firstCell = String(row[0] ?? '').trim().toLowerCase();
        if (firstCell.startsWith('notes:') || firstCell.startsWith('📌')) return false;
        return true;
    }

    private cleanExcelText(value: any): string {
        if (value === null || value === undefined) return '';
        if (value instanceof Date) return moment(value).format('DD-MM-YYYY');
        const text = String(value).replace(/[\u0000-\u001F\u007F]/g, '').trim();
        if (/^[=+\-@]/.test(text)) {
            return text.replace(/^[=+\-@]+/, '').trim();
        }
        return text;
    }

    private parseServiceJobExcelDate(value: any): Date | null {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

        const raw = String(value).trim();
        const formats = ['DD-MM-YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'M/D/YY', 'M/D/YYYY'];
        for (const format of formats) {
            const parsed = moment(raw, format, true);
            if (parsed.isValid()) return parsed.toDate();
        }

        const parsedDate = new Date(raw);
        return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    private resolveServiceJobChargeQuantity(
        unitQty: any,
        cargo: { grossWeight: number; volume: number; chargeableWeight: number; noofContainers: number }
    ): number {
        const normalized = String(unitQty || '').trim();
        switch (normalized) {
            case 'Per 20ft Cont':
            case 'Per 40ft Cont':
            case 'Per 45ft Cont':
            case 'Per Cont':
            case '20ft':
            case '40ft':
                return Number(cargo.noofContainers) || 1;
            case 'Per CBM':
            case 'CBM':
                return Number(cargo.volume) || 1;
            case 'Per GrossWeight':
            case 'GrossWeight':
                return Number(cargo.grossWeight) || 1;
            case 'ChargeableWeight':
                return Number(cargo.chargeableWeight) || 1;
            case 'Per BL':
            case 'BL':
            case 'Per Shipment':
            case 'Shipment':
            default:
                return 1;
        }
    }

    private lookupKey(value: any): string {
        return String(value ?? '').trim().toLowerCase();
    }

    private toLookupMap<T extends Record<string, any>>(items: T[], fields: string[]): Map<string, T> {
        const map = new Map<string, T>();
        for (const item of items || []) {
            for (const field of fields) {
                const key = this.lookupKey(item[field]);
                if (key && !map.has(key)) map.set(key, item);
            }
        }
        return map;
    }

    private matchCustomerBranch(branches: any[], address: string): any {
        const key = this.lookupKey(address);
        return (branches || []).find(branch =>
            this.lookupKey(branch.Address) === key ||
            this.lookupKey(branch.BranchName) === key ||
            this.lookupKey(branch.Branch_Code) === key ||
            this.lookupKey(branch.Address).includes(key) ||
            key.includes(this.lookupKey(branch.Address))
        ) || null;
    }

    private firstCustomerBranch(customer: any): any {
        return customer?.CustomerBranch?.[0] || null;
    }

    private validateDuplicateValue(
        label: string,
        value: string,
        fileSet: Set<string>,
        existingSet: Set<string>,
        errors: string[]
    ): void {
        const key = this.lookupKey(value);
        if (!key) return;
        if (fileSet.has(key)) errors.push(`Duplicate ${label} "${value}" inside uploaded Excel`);
        if (existingSet.has(key)) errors.push(`${label} "${value}" already exists`);
        fileSet.add(key);
    }

}
