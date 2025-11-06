import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { OperationCommonService } from '../operation-common/operation-common.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { statusWhereClause } from 'src/common/helper';
import * as moment from 'moment-timezone';

export class CreateServiceJobDto {
    FreightPPCC: string;
    FreightTerms: string;

    // HouseJob fields
    BookingNo: string;
    CustomerMasterSid: number;
    CustomerName: string;
    CustomerAddress: string;
    CustomerBranchSid: number;

    // Related entities
    houseJobCargo: any;
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
    CustomerBranchSid: number;
    CustomerName: string;
    CustomerAddress: string;
    FreightPPCC: string;
    POL: string;
    POD: string;
    status: string;
    houseJobCargo: any;
    costRevenueCharges: any[];
    updatedBy: string;
}

@Injectable()
export class ServiceJobService {
    constructor(
        private readonly _db: DatabaseService,
        private readonly commonService: OperationCommonService,
        private readonly menuService: MenuService,
    ) { }

    /**
     * Creates a new Service Job, which includes a MasterJob and a HouseJob.
     */
    async createServiceJob(payload: CreateServiceJobDto) {
        const { houseJobCargo, costRevenueCharges, ...mainPayload } = payload;
        
        return this._db.$transaction(async (prisma) => {
            // 1. Create the MasterJob
            const masterJobMenuId = await this.menuService.getMenuSidByName("Service Job");
            const dateString = moment().format('YYYYMMDD');
            const masterCount = await prisma.masterJob.count({
                    where: { MasterJobNumber: { contains: dateString } }
            })
            const MasterJobNumber = `MASTER-${dateString}-${(masterCount + 1).toString().padStart(3, '0')}`;
            const masterJob = await prisma.masterJob.create({
                data: {
                    MasterJobDate: new Date(),
                    MasterJobNumber: MasterJobNumber,
                    MBLNo : MasterJobNumber,
                    MBLDate : new Date(),
                    FreightPPCC: mainPayload.FreightPPCC || "Prepaid",
                    CompanyMasterSid: mainPayload.CompanyMasterSid,
                    BranchMasterSid: mainPayload.BranchMasterSid,
                    DepartmentMasterSid: mainPayload.DepartmentMasterSid,
                    MenuMasterSid: masterJobMenuId,
                    POO: "",
                    POL: mainPayload.POL,
                    POD: mainPayload.POD,
                    FPD: "",
                    Status: mainPayload.status || 'A',
                    CreatedBy: mainPayload.createdBy,
                },
            });

            if (!masterJob) {
                throw new BadRequestException('Failed to create the master job component.');
            }

            // 2. Get Menu SID for 'Service Job'
            const serviceJobMenuId = await this.menuService.getMenuSidByName("Service Job");

            // 3. Create the HouseJob
            const count = await prisma.houseJob.count({
                where: { 
                    ShipmentNo: { contains: dateString },
                    IsServiceJob: 'Y'
                }
            });
            const houseCount = await prisma.houseJob.count({
                where: { 
                    HBLNo: { contains: dateString },
                }
            });
            const serviceJobRefNo = `SRVJ-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
            const generatedHBLNo = `HOUSE-${dateString}-${(houseCount + 1).toString().padStart(3, '0')}`;
            
            const houseJob = await prisma.houseJob.create({
                data: {
                    MasterJobSid: masterJob.MasterJobSid,
                    MBLNo : masterJob.MasterJobNumber,
                    MBLDate : masterJob.MBLDate,
                    MenuMasterSid: serviceJobMenuId,
                    CompanyMasterSid: mainPayload.CompanyMasterSid,
                    BranchMasterSid: mainPayload.BranchMasterSid,
                    DepartmentMasterSid: mainPayload.DepartmentMasterSid,
                    ShipmentNo: serviceJobRefNo,
                    CustomerMasterSid: mainPayload.CustomerMasterSid,
                    CustomerBranchSid: mainPayload.CustomerBranchSid || null,
                    CustomerName: mainPayload.CustomerName,
                    CustomerAddress: mainPayload.CustomerAddress,
                    HBLNo: generatedHBLNo,
                    POL: mainPayload.POL,
                    POD: mainPayload.POD,
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
                            MenuMasterSid: serviceJobMenuId,
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

            return {
                ...houseJob,
                masterJob,
                Cargo: createdCargo,
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
                },
            });

            if (!serviceJob) {
                throw new NotFoundException(`Service job with ID ${houseJobSid} not found.`);
            }

            const menuId = await this.menuService.getMenuSidByName("Service Job");

            const costRevenuePayload = {
                TransactionSid: serviceJob.HouseJobSid,
                MenuMasterSid: menuId || serviceJob.MenuMasterSid!,
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
        const { houseJobCargo, costRevenueCharges, ...mainPayload } = payload;

        return this._db.$transaction(async (prisma) => {
            // 1. Fetch existing HouseJob
            const existingHouseJob = await prisma.houseJob.findUnique({
                where: { HouseJobSid: houseJobSid },
            });

            if (!existingHouseJob) {
                throw new NotFoundException(`Service job with ID ${houseJobSid} not found.`);
            }

            // 2. Update the HouseJob
            const updatedHouseJob = await prisma.houseJob.update({
                where: { HouseJobSid: houseJobSid },
                data: {
                    CustomerMasterSid: mainPayload.CustomerMasterSid,
                    CustomerBranchSid: mainPayload.CustomerBranchSid || null,
                    CustomerName: mainPayload.CustomerName,
                    CustomerAddress: mainPayload.CustomerAddress,
                    POL: mainPayload.POL,
                    POD: mainPayload.POD,
                    FreightTerms: mainPayload.FreightPPCC || "Prepaid",
                    status: mainPayload.status || 'A',
                    updatedBy: payload.updatedBy,
                },
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
                const menuId = await this.menuService.getMenuSidByName("Service Job");
                
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
}