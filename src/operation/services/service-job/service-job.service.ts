import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';
import { OperationCommonService } from '../operation-common/operation-common.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { statusWhereClause } from 'src/common/helper';
import * as moment from 'moment-timezone';
import { DuplicateCheckDTO } from 'src/operation/controllers/service-job/service-job.controller';

export class CreateServiceJobDto {
    FreightPPCC: string;
    FreightTerms: string;
    MBLNo?: string;
    MBLDate?: Date;
    HBLNo?: string;
    ShipmentNo?: string;

    // HouseJob fields
    BookingNo: string;
    CustomerMasterSid: number;
    CustomerName: string;
    CustomerAddress: string;
    CustomerBranchSid: number;

    // Related entities
    houseJobCargo: any;
    houseJobOthers: any; 
    costRevenueCharges: any[];

    // Common fields
    DepartmentMasterSid: number;
    CompanyMasterSid: number;
    BranchMasterSid: number;
    POL: string;
    POD: string;
    status: string;
    createdBy: string;
    updatedBy : string;
}

// DTO for UpdateServiceJob payload
export class UpdateServiceJobDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
    DepartmentMasterSid: number;
    CustomerMasterSid: number;
    MBLNo?: string;
    MBLDate?: Date;
    HBLNo?: string;
    CustomerBranchSid: number;
    CustomerName: string;
    CustomerAddress: string;
    FreightPPCC: string;
    POL: string;
    POD: string;
    status: string;
    houseJobCargo: any;
     houseJobOthers: any; 
    costRevenueCharges: any[];
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
        const { houseJobCargo, houseJobOthers, costRevenueCharges, ...mainPayload } = payload;

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
            const dateString = moment().format('YYYYMMDD');
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
                    MBLNo : masterJob.MasterJobNumber,
                    MBLDate : masterJob.MBLDate,
                    MenuMasterSid: houseJobMenuId,
                    CompanyMasterSid: mainPayload.CompanyMasterSid,
                    BranchMasterSid: mainPayload.BranchMasterSid,
                    DepartmentMasterSid: mainPayload.DepartmentMasterSid,
                    ShipmentNo: serviceJobRefNo,
                    CustomerMasterSid: mainPayload.CustomerMasterSid,
                    CustomerBranchSid: mainPayload.CustomerBranchSid || null,
                    CustomerName: mainPayload.CustomerName,
                    CustomerAddress: mainPayload.CustomerAddress,
                    HBLNo: finalHBLNo,
                    POL: mainPayload.POL ||"",
                    POD: mainPayload.POD ||"",
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
                            CostVoucherTypeMasterSid: charge.CostVoucherTypeSid ? Number(charge.CostVoucherTypeSid) : null,
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


            return {
                ...houseJob,
                masterJob,
                Cargo: createdCargo,
                Others: createdOthers,
                costRevenueCharges: createdCharges,
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
                    masterJob : {
                        select : {
                            MasterJobNumber : true
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
        const { houseJobCargo,houseJobOthers, costRevenueCharges, ...mainPayload } = payload;

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
                POL: mainPayload.POL || "",
                POD: mainPayload.POD || "",
                FreightTerms: mainPayload.FreightPPCC || "Prepaid",
                status: mainPayload.status || 'A',
                updatedBy: payload.updatedBy,
            };

            if (payload.HBLNo && payload.HBLNo.trim() !== '') {
                houseJobUpdateData.HBLNo = payload.HBLNo;
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
                    updatedBy: payload.updatedBy,
                    status: 'A',
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
                        status: charge.status === 'Active' ? 'A' : (charge.status === 'Suspended' ? 'S' : String(charge.status).charAt(0)) || 'A',
                        Remarks: charge.Remarks || '',
                        SerialNumber: chargeIndex++,
                        ChargeMasterSid: charge.ChargeMasterSid ? Number(charge.ChargeMasterSid) : null,
                        ChargeDescription: charge.ChargeDescription,
                        ChargeUomSid: Number(charge.ChargeUomSid),
                        RevenueChargeUomSid: Number(charge.RevenueChargeUomSid) ||  Number(charge.ChargeUomSid),
                        CostChargeUomSid: Number(charge.CostChargeUomSid) ||  Number(charge.ChargeUomSid) ,
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
                        CostVoucherTypeMasterSid: charge.CostVoucherTypeSid ? Number(charge.CostVoucherTypeSid) : null,
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


            return this.fetchServiceJobById(houseJobSid);
        });
    }

    /**
     * Searches for Service Jobs
     */
    async searchServiceJob(searchParams: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = searchParams;
        const skip = (page - 1) * pageSize;

        const where: Prisma.HouseJobWhereInput = {
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            IsServiceJob: 'Y',
            status: statusWhereClause,
            ...(search && {
                OR: [
                    { HBLNo: { contains: search, mode: 'insensitive' } },
                    { ShipmentNo: { contains: search, mode: 'insensitive' } },
                    { CustomerName: { contains: search, mode: 'insensitive' } },
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
                        departmentMaster: {
                            select: { departmentName: true },
                        },
                        HBLNo: true,
                        MBLNo: true,       
                        MBLDate: true,
                        ShipmentNo: true,
                        POL: true,
                        POD: true,
                        status: true
                    },
                    orderBy: {
                        HouseJobSid: 'desc',
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


}
