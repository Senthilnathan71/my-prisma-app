import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';
import { Prisma, PrismaClient } from '@prisma/client';
import { create } from 'domain';
import { stat } from 'fs';
import { parseDateFromString, toNumber } from 'src/common/helper';
import { LoadingPlanService } from '../loading-plan/loading-plan.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import { OperationCommonService } from '../operation-common/operation-common.service';
import { catchError, of } from 'rxjs';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';

interface searchMasterJob {
    search: string,
    page: number,
    pageSize: number,
    activeCompanyId: number,
    activeBranchId: number,
    departmentType: string
}

@Injectable()
export class MasterJobService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
        private menuMasterService: MenuService,
        private commonService: OperationCommonService,
        private numberSeriesService: NumberSeriesService,
    ) { }

    async createNewMasterJob(payload: any) {
        try {

            if (!payload.DepartmentMasterSid) {
                throw new Error("DepartmentMasterSid is required");
            }

            const department = await this._db.departmentMaster.findUnique({
                where: { DepartmentMasterSid: payload.DepartmentMasterSid },
                select: {
                    departmentType: true,
                    ExportImport: true
                }
            });

            if (!department) {
                throw new BadRequestException("Department not found");
            }

            const menuId = await this.menuMasterService.getMenuSidByName(department.departmentType?.toUpperCase() === 'AIR' ? "Master Air Waybill" : "Master Job");

            let generatedMasterJobNumber = await this.numberSeriesService.generateNextNumber(
                payload.CompanyMasterSid,
                payload.BranchMasterSid,
                menuId,
                payload.DepartmentMasterSid
            );

            if (!generatedMasterJobNumber) {
                const dateString = moment().format('YYYYMMDD');
                const count = await this._db.masterJob.count({
                    where: { MasterJobNumber: { contains: dateString } }
                });
                generatedMasterJobNumber = `MASTER-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
            }

            let assignedMBLNo = payload.MBLNo || "";
            const newMasterJob = await this._db.$transaction(async (prisma) => {
                let departmentType = department.departmentType;
                let departmentExportImport = department?.ExportImport ?? null;
                if (departmentType === 'Air') {
                    if (departmentExportImport === 'Export') {
                        if (payload.MBLNo && String(payload.MBLNo).trim() !== '') {
                            assignedMBLNo = String(payload.MBLNo).trim();
                        } else {

                            // Find the first available MAWB with StockStatus = 'Free'
                            const availableMawb = await prisma.mawbStock.findFirst({
                                where: {
                                    StockStatus: 'Free',
                                    status: 'A',
                                    CompanyMasterSid: payload.CompanyMasterSid,
                                    BranchMasterSid: payload.BranchMasterSid
                                },
                                orderBy: { MawbStockSid: 'asc' }
                            });

                            if (!availableMawb) {
                                // If no free MAWB available, use the provided MBLNo or empty string
                                assignedMBLNo = generatedMasterJobNumber || "";
                            } else {
                                // Assign the MasterBillNumber to MBLNo
                                assignedMBLNo = availableMawb.MasterBillNumber;

                                // Update the MAWB stock status to 'Blocked'
                                await prisma.mawbStock.update({
                                    where: { MawbStockSid: availableMawb.MawbStockSid },
                                    data: {
                                        StockStatus: 'Blocked',
                                        updatedBy: payload.createdBy,
                                        updatedOn: new Date()
                                    }
                                });
                            }
                        }
                    } else {
                        assignedMBLNo = payload.MBLNo || "";
                    }
                } else {
                    if (departmentExportImport === 'Export') {
                        assignedMBLNo = generatedMasterJobNumber || "";
                    } else {
                        const mblValue = String(payload.MBLNo ?? '').trim();

                        if (!mblValue || mblValue.toLowerCase() === 'null' || mblValue.toLowerCase() === 'undefined') {
                            assignedMBLNo = generatedMasterJobNumber || "";
                        } else {
                            assignedMBLNo = mblValue;
                        }
                    }
                }


                const headerPayload = {
                    MasterJobNumber: generatedMasterJobNumber,
                    MasterJobDate: payload.MasterJobDate ? new Date(payload.MasterJobDate) : new Date(),
                    CreatedBy: payload.createdBy,
                    Status: "A",
                    MenuMasterSid: menuId || payload.MenuMasterSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    DepartmentMasterSid: payload.DepartmentMasterSid,
                    FreightPPCC: payload.FreightPPCC || 'Prepaid',
                    DestinationAgent: payload.DestinationAgent,
                    DestinationAgentName: payload.DestinationAgentName,
                    DestinationAgentAddress: payload.DestinationAgentAddress?.substring(0, 20) || '',
                    MBLNo: assignedMBLNo,
                    MBLDate: payload.MasterJobDate ? new Date(payload.MasterJobDate) : new Date(),
                    BLReleaseType: payload.BLReleaseType,
                    NoofOriginal: Number(payload.NoofOriginal) || 3,
                    OriginAgent: Number(payload.OriginAgent),
                    POO: payload.POO || '',
                    POL: payload.POL,
                    POD: payload.POD,
                    FPD: payload.FPD || '',
                    POLTerminal: payload.POLTerminal?.substring(0, 20) || '',
                    PODTerminal: payload.PODTerminal?.substring(0, 20) || '',
                    MovementType: payload.MovementType,
                    ShipmentTerms: payload.ShipmentTerms,
                    PkgType: Number(payload.PkgType),
                    NoOfPkg: Number(payload.NoOfPkg),
                    WeightIn: payload.WeightIn,
                    GrossWeight: Number(payload.GrossWeight),
                    NetWeight: Number(payload.NetWeight),
                    ChargeableWeight: Number(payload.ChargeableWeight),
                    Volume: Number(payload.Volume),
                    Haz: payload.Haz,
                    JobStatus: payload.JobStatus,
                    DGBookingDate: payload.DGBookingDate ? new Date(payload.DGBookingDate) : null,
                    DGApprovedDate: payload.DGApprovedDate ? new Date(payload.DGApprovedDate) : null,
                    SiCutoffDate: payload.SiCutoffDate ? new Date(payload.SiCutoffDate) : null,
                    PortCutoffDate: payload.PortCutoffDate ? new Date(payload.PortCutoffDate) : null,
                    CommodityDescription: payload.CommodityDescription || '',
                    MarksandNumber: payload.MarksandNumber || '',
                }

                const createdMasterJob = await prisma.masterJob.create({
                    data: headerPayload
                })

                const voyagePayload = {
                    MasterJobSid: createdMasterJob.MasterJobSid,
                    VoyageMasterSid: payload.VoyageMasterSid,
                    VesselName: payload.VesselName,
                    VoyageNo: payload.VoyageNo,
                    ETD: payload.ETD ? new Date(payload.ETD) : null,
                    ETA: payload.ETA ? new Date(payload.ETA) : null,
                    ATA: payload.ATA ? new Date(payload.ATA) : null,
                    ATD: payload.ATD ? new Date(payload.ATD) : null,
                    DestinationATA: payload.DestinationATA ? new Date(payload.DestinationATA) : null,
                    CarrierSid: payload.CarrierSid || null,
                    CarrierName: payload.CarrierName || '',
                    Status: "A"
                }

                const createdVoyage = await prisma.masterJobVoyage.create({
                    data: voyagePayload
                })

                const allConnections = payload.connections || payload.masterJobConnection || [];
                let createdConnections: any;
                if (allConnections.length > 0) {
                    const connectionPayload = allConnections.map(connection => ({
                        MasterJobSid: createdMasterJob?.MasterJobSid,
                        Mode: connection.Mode,
                        POL: connection.POL,
                        POD: connection.POD,
                        VesselName: connection.VesselName,
                        VoyageNo: connection.VoyageNo,
                        ETD: connection.ETD ? new Date(connection.ETD) : null,
                        ETA: connection.ETA ? new Date(connection.ETA) : null,
                        ATD: connection.ATD ? new Date(connection.ATD) : null,
                        ATA: connection.ATA ? new Date(connection.ATA) : null,
                        Remarks: connection.Remarks,
                        Status: String(connection.status).charAt(0) || 'A',
                        CreatedBy: payload.createdBy,
                        CreatedOn: new Date(),
                        UpdatedOn: null,
                        UpdatedBy: null
                    }));

                    createdConnections = await prisma.masterJobConnection.createMany({
                        data: connectionPayload
                    });
                }

                const otherFormValue = payload.others;
                let createdOther;
                if (otherFormValue) {
                    const otherPayload = {
                        MasterJobSid: createdMasterJob?.MasterJobSid,
                        CreatedBy: payload.createdBy,
                        Status: "A",
                        Yard: otherFormValue?.Yard ? Number(otherFormValue?.Yard) : null,
                        YardAddress: otherFormValue?.YardAddress,
                        Transporter: otherFormValue?.Transporter,
                        HandlingInformation: otherFormValue?.HandlingInformation,
                        InternalNote: otherFormValue?.InternalNote,
                        CFS: otherFormValue?.CFS ? Number(otherFormValue?.CFS) : null,
                        CFSAddress: otherFormValue?.CFSAddress,
                        StuffingStartDate: otherFormValue?.StuffingStartDate ? new Date(otherFormValue?.StuffingStartDate) : null,
                        StuffingEndDate: otherFormValue?.StuffingEndDate ? new Date(otherFormValue?.StuffingEndDate) : null,
                        CurrencyCode: otherFormValue?.CurrencyCode,
                        SellExchangeRate: otherFormValue?.SellExchangeRate ? Number(otherFormValue?.SellExchangeRate) : null,
                        AgentExchangeRate: otherFormValue?.AgentExchangeRate ? Number(otherFormValue?.AgentExchangeRate) : null,
                        Coload: otherFormValue?.Coload,
                        CoLoader: otherFormValue?.CoLoader,
                        ExportDoNo: otherFormValue?.ExportDoNo,
                        CarrierRef: otherFormValue?.CarrierRef,
                        AgentRef: otherFormValue?.AgentRef,
                        ExportDoDate: otherFormValue?.ExportDoDate ? new Date(otherFormValue?.ExportDoDate) : null,
                        SOBDate: otherFormValue?.SOBDate ? new Date(otherFormValue?.SOBDate) : null,
                    }

                    createdOther = await prisma.masterJobOthers.create({
                        data: otherPayload
                    })
                }

                let createdContainers: any;
                const allContainers = payload?.masterJobContainers || [];
                if (allContainers.length > 0) {
                    const containerPayload = allContainers.map(item => ({
                        MasterJobSid: createdMasterJob.MasterJobSid,
                        CreatedBy: payload.createdBy,
                        Status: "A",
                        ContainerType: Number(item.ContainerType),
                        ContainerNumber: item.ContainerNumber,
                        LineSeal: item.LineSeal,
                        CustomsSeal: item.CustomsSeal,
                        HsCode: item.HsCode,
                        CommodityDescription: item.CommodityDescription,
                        PkgType: item.PkgType ? Number(item.PkgType) : null,
                        NoOfPkg: item.NoOfPkg ? Number(item.NoOfPkg) : null,
                        GrossWeight: item.GrossWeight ? Number(item.GrossWeight) : null,
                        NetWeight: item.NetWeight ? Number(item.NetWeight) : null,
                        ChargeableWeight: item.ChargeableWeight ? Number(item.ChargeableWeight) : null,
                        Volume: item.Volume ? Number(item.Volume) : null,
                        IsSoc: item.IsSoc
                    }))

                    createdContainers = await prisma.masterJobContainer.createMany({
                        data: containerPayload
                    })
                }

                let createdCostRevenueCharges: any;
                let itemIndex = 1;
                const allCostRevenueCharges = payload?.costRevenueCharges || [];
                if (allCostRevenueCharges.length > 0) {
                    const costRevenueChargesPayload = allCostRevenueCharges.map(item => ({
                        TransactionSid: createdMasterJob.MasterJobSid,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        ShipmentNo: createdMasterJob.MasterJobNumber,
                        MasterJobNo: createdMasterJob.MasterJobNumber,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,

                        SerialNumber: itemIndex++,
                        ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                        ChargeDescription: item.ChargeDescription,

                        ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                        RevenueChargeUomSid: item.RevenueChargeUomSid ? Number(item.RevenueChargeUomSid) : null,
                        CostChargeUomSid: item.CostChargeUomSid ? Number(item.CostChargeUomSid) : null,
                        RevenueNumberOfUnit: item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null,
                        CostNumberOfUnit: item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null,

                        // Revenue Section
                        RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? item.RevenueCurrencyMasterSid : null,
                        RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                        RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                        RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                        RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                        RevenueDrCr: item.RevenueDrCr,
                        RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                        RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                        RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                        RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                        RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                        // Cost Section
                        CostCurrencyMasterSid: item.CostCurrencyMasterSid ? item.CostCurrencyMasterSid : null,
                        CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                        CostRate: item.CostRate ? Number(item.CostRate) : null,
                        CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                        CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                        CostDrCr: item.CostDrCr,
                        CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                        CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                        CostPrepaidCollect: item.CostPrepaidCollect,
                        CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                        CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                        createdBy: payload.createdBy,
                        status: "A",
                        Remarks: item.Remarks
                    }))
                    createdCostRevenueCharges = await prisma.costRevenueCharges.createMany({
                        data: costRevenueChargesPayload
                    })
                }

                let createdActivities: any;
                const allActivities = payload?.containerActivities || [];
                if (allActivities.length > 0) {
                    const activityPayload = allActivities.map(item => ({
                        JobMasterSid: createdMasterJob.MasterJobSid,
                        ContainerNumber: item.ContainerNumber,
                        ContainerType: Number(item.ContainerType),
                        ActivityCode: item.ActivityCode,
                        ActivityName: item.ActivityName,
                        ActivityDate: item.ActivityDate ? new Date(item.ActivityDate) : new Date(),
                        ActivityFrom: item.ActivityFrom,
                        ActivityTo: item.ActivityTo,
                        Remarks: item.Remarks,
                        CreatedBy: payload.createdBy,
                        Status: "A"
                    }))
                    createdActivities = await prisma.containerActivity.createMany({
                        data: activityPayload
                    })
                }
                // create House job Custos
                let finalHouseJobCustoms: any[] = [];
                const houseJobCustomsPayload = payload.houseJobCustoms || [];
                if (houseJobCustomsPayload.length > 0) {
                    for (const customs of houseJobCustomsPayload) {
                        const createdCustoms = await prisma.houseJobCustoms.create({
                            data: {
                                MasterJobSid: createdMasterJob.MasterJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                LineCode: customs.LineCode,
                                VoyageAgentCode: customs.VoyageAgentCode,
                                RotationNumber: customs.RotationNumber,
                                ManifestSequence: customs.ManifestSequence,
                                CargoCode: customs.CargoCode,
                                StorageRequest: customs.StorageRequest,
                                PackageTypeCode: customs.PackageTypeCode,
                                FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                                NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                                SLACIndicator: customs.SLACIndicator,
                                ImporterCode: customs.ImporterCode,
                                SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                                UsedOrNew: customs.UsedOrNew,
                                UNHSCode: customs.UNHSCode,
                                UNNumber: customs.UNNumber,
                                FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                                TemperatureUnit: customs.TemperatureUnit,
                                HazStorageRequest: customs.HazStorageRequest,
                                RefrigerationRequired: customs.RefrigerationRequired,
                                MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                                MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                                RefTemperatureUnit: customs.RefTemperatureUnit,
                                CreatedBy: payload.createdBy,
                                Status: "A"
                            }
                        });
                        finalHouseJobCustoms.push(createdCustoms);
                    }
                }


                // SHIPMENT PART

                const allShipments = payload.shipmentList || [];
                const transhipmentRecords = allShipments.filter(
                    (s) => String(s.JobType || '').toLowerCase() === 'transhipment'
                );

                if (transhipmentRecords.length > 0) {
                    for (const trans of transhipmentRecords) {

                        const booking = await prisma.bookingHeader.findUnique({
                            where: { BookingHeaderSid: trans.BookingHeaderSid },
                            select: {
                                BookingHeaderSid: true,
                                GeneralNote: true,
                                POL: true,
                                POD: true,
                            }
                        });

                        if (!booking) continue;

                        const polPortCode = booking.POL || '';
                        const podPortCode = booking.POD || '';

                        const newMBLNo = createdMasterJob.MBLNo;

                        await prisma.bookingHeader.update({
                            where: { BookingHeaderSid: booking.BookingHeaderSid },
                            data: {
                                GeneralNote: `${booking.GeneralNote || ''} ${newMBLNo} - ${polPortCode} / ${podPortCode}`.trim(),
                            }
                        });
                    }
                }

                const recordToCreateShipment = allShipments.filter(shipment =>
                    !shipment.HouseJobSid || String(shipment.JobType || '').toLowerCase() === 'transhipment'
                );

                const recordToUpdateShipment = allShipments.filter(shipment => shipment.HouseJobSid && String(shipment.JobType || '').toLowerCase() !== 'transhipment');
                // const recordToUpdateShipment = allShipments.filter(shipment => shipment.HBLNo && shipment.JobType !== 'Transhipment');
                // const recordToCreateTranshipment = allShipments.filter(shipment => shipment.HBLNo && shipment.JobType === 'Transhipment');

                if (recordToCreateShipment.length > 0) {
                    let bookingNeedHouseCreateIds = recordToCreateShipment.map(shipment => shipment.BookingHeaderSid);
                    const allBookings = await prisma.bookingHeader.findMany({
                        where: { BookingHeaderSid: { in: bookingNeedHouseCreateIds } },
                        include: {
                            bookingCargo: { where: { status: 'A' } },
                            bookingProduct: { where: { status: 'A' } },
                            bookingOthers: { where: { status: 'A' } },
                            bookingConnection: { where: { status: 'A' } },
                            bookingRates: { where: { Status: 'A' } }
                        },
                    });





                    const allCreatedHouseJobs: any[] = [];
                    for (const booking of allBookings) {
                        const { bookingCargo, bookingProduct, bookingOthers, bookingConnection, bookingRates, ...bookingHeader } = booking;

                        const department = await prisma.departmentMaster.findUnique({
                            where: { DepartmentMasterSid: payload.DepartmentMasterSid },
                            select: {
                                departmentType: true,
                                ExportImport: true
                            }
                        });
                        const departmentExportImport = department?.ExportImport ?? null;

                        const houseJobMenuId = await this.menuMasterService.getMenuSidByName(department?.departmentType.toUpperCase() === 'AIR' ? 'House Air Waybill' : 'House Job');


                        let HBLNo = "";

                        if (String(bookingHeader.JobType || '').toLowerCase() === 'transhipment') {
                            // allow same HBLNo from booking
                            HBLNo = String(bookingHeader.HBLNo || '').trim();
                        } else {
                            if (departmentExportImport === 'Export') {
                                HBLNo = await this.numberSeriesService.generateNextNumber(
                                    payload.CompanyMasterSid,
                                    payload.BranchMasterSid,
                                    houseJobMenuId,
                                    bookingHeader.DepartmentMasterSid
                                )
                            } else {
                                HBLNo = "";
                            }
                        }
                        // Step 1: Create main house job
                        const houseJob = await prisma.houseJob.create({
                            data: {
                                MasterJobSid: createdMasterJob.MasterJobSid,
                                HBLDate: new Date(),
                                BookingHeaderSid: bookingHeader.BookingHeaderSid || null,
                                ColoadedBy: bookingHeader.NominatedBy,
                                BookingNo: bookingHeader.BookingNo || '',
                                BookingDateTime: bookingHeader.BookingDateTime,
                                CompanyMasterSid: bookingHeader.CompanyMasterSid,
                                BranchMasterSid: bookingHeader.BranchMasterSid!,
                                CustomerMasterSid: bookingHeader.CustomerMasterSid,
                                JobType: bookingHeader.JobType,
                                CustomerName: bookingHeader.CustomerName || '',
                                CustomerAddress: bookingHeader.CustomerAddress || '',
                                SalesmanSid: bookingHeader.SalesmanSid || null,
                                CargoExpectedon: bookingHeader.CargoExpectedon || null,
                                FreightTerms: bookingHeader.FreightTerms || '',
                                POO: bookingHeader.POO || '',
                                POL: bookingHeader.POL || '',
                                POD: bookingHeader.POD || '',
                                FPD: bookingHeader.FPD || '',
                                TsPortSid: bookingHeader.TsPortSid || null,
                                POLTerminal: bookingHeader.POLTerminal || '',
                                VoyageMasterSid: bookingHeader.VoyageMasterSid || null,
                                VesselName: bookingHeader.VesselName || '',
                                VoyageNo: bookingHeader.VoyageNo || '',
                                ETD: bookingHeader.ETD ? new Date(bookingHeader.ETD) : null,
                                ETA: bookingHeader.ETA ? new Date(bookingHeader.ETA) : null,
                                IncoTerms: bookingHeader.IncoTerms || '',
                                BLLocation: bookingHeader.BLLocation || null,
                                ShipperName: bookingHeader.ShipperName || '',
                                ShipperAddress: bookingHeader.ShipperAddress || '',
                                ConsigneeName: bookingHeader.ConsigneeName || '',
                                ConsigneeAddress: bookingHeader.ConsigneeAddress || '',
                                ClearanceRequire: bookingHeader.ClearanceRequire || '',
                                ShipmentType: bookingHeader.ShipmentType || '',
                                DestinationAgent: bookingHeader.DestinationAgent,
                                AgentName: bookingHeader.AgentName || '',
                                AgentAddress: bookingHeader.AgentAddress || '',
                                Notify: bookingHeader.Notify || '',
                                NotifyAddress: bookingHeader.NotifyAddress || '',
                                HouseNo: bookingHeader.HouseNo || '',
                                QuotationHeaderSid: bookingHeader.QuotationHeaderSid || null,
                                EnquiryHeaderSid: bookingHeader.EnquiryHeaderSid || null,
                                MovementType: bookingHeader.MovementType || '',
                                DoValid: bookingHeader.DoValid ? new Date(bookingHeader.DoValid) : null,
                                IsServiceJob: bookingHeader.IsServiceJob || '',
                                createdBy: payload.createdBy || '',
                                status: bookingHeader.status || '',
                                BookingStatus: bookingHeader.BookingStatus || '',
                                DepartmentMasterSid: bookingHeader.DepartmentMasterSid,
                                CustomerBranchSid: bookingHeader.CustomerBranchSid || null,
                                AuthorizerRemarks: bookingHeader.AuthorizerRemarks || '',
                                authorizerStatus: bookingHeader.authorizerStatus,
                                MenuMasterSid: houseJobMenuId || payload.MenuMasterSid,
                                CarrierSid: bookingHeader.CarrierSid || null,
                                CarrierName: bookingHeader.CarrierName || '',
                                Coload: bookingHeader.Coload || '',
                                GeneralNote: bookingHeader.GeneralNote || '',
                                HBLNo: HBLNo,
                                InternalNote: bookingHeader.InternalNote || '',
                                MBLDate: bookingHeader.MBLDate || null,
                                MBLNo: bookingHeader.MBLNo || '',
                                NominatedBy: bookingHeader.NominatedBy || '',
                                Nominated: bookingHeader.Nominated || '',
                                PODTerminal: bookingHeader.PODTerminal || '',
                                ShipmentNo: bookingHeader.ShipmentNo || '',
                                OriginAgent: bookingHeader.OriginAgent || ''
                            },
                        }).catch(err => {
                            console.error('HouseJobCargo createMany error:', err);
                        });

                        if (!houseJob) continue;

                        if (bookingCargo?.length) {
                            await prisma.houseJobCargo.createMany({
                                data: bookingCargo.map((cargo) => ({
                                    HouseJobSid: houseJob.HouseJobSid,
                                    CompanyMasterSid: houseJob.CompanyMasterSid,
                                    BranchMasterSid: houseJob.BranchMasterSid!,
                                    NoOfPackage: cargo.NoOfPackage || 0,
                                    FreightAmount: cargo.FreightAmount,
                                    CargoType: cargo.CargoType,
                                    WeightUnitSid: cargo.WeightUnitSid || null,
                                    GrossWeight: cargo.GrossWeight || 0,
                                    NetWeight: cargo.NetWeight || 0,
                                    Volume: cargo.Volume || 0,
                                    ChargeableWeight: cargo.ChargeableWeight || 0,
                                    MarksAndNumber: '',
                                    CommodityDescription: '',
                                    ContainerType: cargo.ContainerType,
                                    PackageType: cargo.PackageType || null,
                                    Qty: cargo.Qty || 0,
                                    ShipmentTerms: cargo.ShipmentTerms || '',
                                    createdBy: payload.createdBy || '',
                                    status: 'A',
                                    FreightTerms: cargo.FreightTerms || '',
                                    MovementType: cargo.MovementType || '',
                                    ModeOfTransport: cargo.ModeOfTransport || '',
                                    NoofContainers: cargo.NoofContainers || 0,
                                    StuffingAt: cargo.StuffingAt || '',
                                })
                                ),
                            }).catch(err => {
                                console.error('HouseJobCargo createMany error:', err);
                            });
                        }

                        if (bookingProduct?.length) {
                            await prisma.houseJobProduct.createMany({
                                data: bookingProduct.map((product) => ({
                                    HouseJobSid: houseJob.HouseJobSid,
                                    ProductName: product.ProductName || '',
                                    ProductDescription: product.ProductDescription || '',
                                    ShippingBillNo: product.ShippingBillNo || '',
                                    ShippingBillDate: product.ShippingBillDate || null,
                                    ExternaPkg: product.ExternaPkg || '',
                                    ExternlQty: String(product.ExternlQty) || '',
                                    GrossWeight: Number(product.GrossWeight) || 0,
                                    NetWeight: Number(product.NetWeight) || 0,
                                    Volume: Number(product.Volume) || 0,
                                    Volumetric: Number(product.Volumetric) || 0,
                                    CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                                    CFS: product.CFS || '',
                                    Height: product.Height || 0,
                                    ImcoClass: product.ImcoClass || '',
                                    IsHaz: product.IsHaz || 'N',
                                    Length: product.Length || 0,
                                    PkgGroup: product.PkgGroup || '',
                                    UnNo: product.UnNo || '',
                                    Width: product.Width || 0,
                                    UomMasterSid: product.UomMasterSid || null,
                                    MarksAndNumber: '',
                                    createdBy: payload.createdBy || '',
                                }))
                            }).catch(err => {
                                console.error('HouseJobProduct createMany error:', err);
                            });
                        }

                        if (bookingConnection?.length) {
                            await prisma.houseJobConnection.createMany({
                                data: bookingConnection.map((connection) => ({
                                    HouseJobSid: houseJob.HouseJobSid,
                                    Mode: connection.Mode,
                                    POL: connection.POL,
                                    POD: connection.POD,
                                    VesselName: connection.VesselName,
                                    VoyageNo: connection.VoyageNo,
                                    ETD: connection.ETD ? new Date(connection.ETD) : null,
                                    ETA: connection.ETA ? new Date(connection.ETA) : null,
                                    Remarks: connection.Remarks || '',
                                    status: 'A',
                                    createdBy: payload.createdBy || '',
                                }))
                            }).catch(err => {
                                console.error('HouseJobConnection createMany error:', err);
                            });
                        }

                        if (bookingOthers?.[0]) {
                            const other = bookingOthers[0];
                            const departmentId = bookingHeader.DepartmentMasterSid;
                            let defaultClause: any[] = [];
                            if (departmentId) {
                                const blclause = await prisma.bLClauseMaster.findMany({
                                    where: {
                                        DepartmentMasterSid: departmentId,
                                        DefaultClause: 'Y',
                                        status: 'A'
                                    },
                                    select: {
                                        ClauseDescription: true,
                                    }
                                });
                                if (blclause && blclause.length > 0) {
                                    defaultClause = blclause.map(clause => clause.ClauseDescription);
                                }
                            }
                            await prisma.houseJobOthers.create({
                                data: {
                                    HouseJobSid: houseJob.HouseJobSid,
                                    CustomerRefNo: other.CustomerRefNo,
                                    OperationUser: other.OperationUser,
                                    CarrierBookingRef: other.CarrierBookingRef || '',
                                    CarrierBookingDate: other.CarrierBookingDate ? new Date(other.CarrierBookingDate) : null,
                                    DocumentationUser: other.DocumentationUser,
                                    CustomerServiceuser: other.CustomerServiceuser,
                                    NotifyParty: other.NotifyParty,
                                    NotifyPartyAddress: other.NotifyPartyAddress,
                                    CHAName: other.CHAName,
                                    PickupMode: other.PickupMode,
                                    YardCFS: other.YardCFS,
                                    BlClause: defaultClause,
                                    LocalTransport: other.LocalTransport,
                                    OverseasTransport: other.OverseasTransport,
                                    OverseasClearance: other.OverseasClearance,
                                    PickupPlace: other.PickupPlace,
                                    PickupDate: other.PickupDate ? new Date(other.PickupDate) : null,
                                    PickupAddress: other.PickupAddress,
                                    DeliveryPlace: other.DeliveryPlace,
                                    DeliveryDate: other.DeliveryDate,
                                    DeliveryAddress: other.DeliveryAddress,
                                    CargoCurrency: other.CargoCurrency,
                                    CargoValue: other.CargoValue,
                                    DeliveryMode: other.DeliveryMode,
                                    ExternalRemarks: other.ExternalRemarks,
                                    SwitchBL: other.SwitchBL,
                                    TransporterName: other.TransporterName,
                                    createdBy: payload.createdBy || '',
                                    status: 'A',
                                    Forwarder: other.Forwarder || '',
                                    ForwarderAddress: other.ForwarderAddress || '',
                                    HBLNo: other.HBLNo || '',
                                    BacktoBack: other.BacktoBack || '',
                                    Depo: other.Depo || '',
                                    ROValidity: other.ROValidity || '',
                                    ReleaseType: other.ReleaseType || '',
                                    AgentAddress: other.AgentAddress || '',
                                    SwitchBLAgent: other.SwitchBLAgent || '',
                                    SwitchBLConsignee: other.SwitchBLConsignee || '',
                                    SwitchBLShipper: other.SwitchBLShipper || '',
                                    SwitchLocation: other.SwitchLocation || '',
                                    Coloader: other.Coloader || '',
                                    Notify2: other.Notify2 || '',
                                    NotifyAddress2: other.NotifyAddress2 || ''
                                }
                            }).catch(err => {
                                console.error('HouseJobOthers create error:', err);
                            });
                        }


                        const allRates = bookingRates || [];
                        const allRevenueVouchers = allRates.filter(rate => rate.RevenueVoucherHeaderSid !== null).map(rate => rate.RevenueVoucherHeaderSid);
                        const allCostVouchers = allRates.filter(rate => rate.CostVoucherHeaderSid !== null).map(rate => rate.CostVoucherHeaderSid);
                        let houseChargeIndex = 1;
                        if (allRates.length > 0) {
                            await prisma.costRevenueCharges.createMany({
                                data: allRates.map(rate => ({
                                    TransactionSid: houseJob.HouseJobSid,
                                    MenuMasterSid: houseJobMenuId || payload.MenuMasterSid,
                                    ShipmentNo: houseJob.ShipmentNo,
                                    MasterJobNo: createdMasterJob.MasterJobNumber,
                                    CompanyMasterSid: houseJob.CompanyMasterSid,
                                    BranchMasterSid: houseJob.BranchMasterSid!,
                                    createdBy: payload.createdBy || '',
                                    status: "A",
                                    Remarks: rate.Remarks || '',

                                    SerialNumber: houseChargeIndex++,
                                    ChargeMasterSid: rate.ChargeMasterSid,
                                    ChargeDescription: rate.ChargeDescription,
                                    ChargeUomSid: rate.ChargeUomSid,
                                    RevenueChargeUomSid: rate.RevenueChargeUomSid!,
                                    CostChargeUomSid: rate.CostChargeUomSid!,
                                    RevenueNumberOfUnit: rate.RevenueNumberOfUnit,
                                    CostNumberOfUnit: rate.CostNumberOfUnit,

                                    // Revenue Section
                                    RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid,
                                    RevenueExchangeRate: rate.RevenueExchangeRate,
                                    RevenueRate: rate.RevenueRate,
                                    RevenueAmount: rate.RevenueAmount,
                                    RevenueLocalAmount: rate.RevenueLocalAmount,
                                    RevenueDrCr: rate.RevenueDrCr,
                                    RevenueCustomerMasterSid: rate.CustomerMasterSid,
                                    RevenueCustomerBranchSid: rate.CustomerBranchSid,
                                    RevenuePrepaidCollect: rate.RevenuePrepaidCollect,
                                    RevenueVoucherHeaderSid: rate.RevenueVoucherHeaderSid,
                                    RevenueVoucherTypeMasterSid: rate.RevenueVoucherTypeMasterSid,

                                    // Cost Section
                                    CostCurrencyMasterSid: rate.CostCurrencyMasterSid,
                                    CostExchangeRate: rate.CostExchangeRate,
                                    CostRate: rate.CostRate,
                                    CostAmount: rate.CostAmount,
                                    CostLocalAmount: rate.CostLocalAmount,
                                    CostDrCr: rate.CostDrCr,
                                    CostAgentMasterSid: rate.AgentMasterSid,
                                    CostAgentBranchSid: rate.AgentBranchSid,
                                    CostPrepaidCollect: rate.CostPrepaidCollect,
                                    CostVoucherHeaderSid: rate.CostVoucherHeaderSid,
                                    CostVoucherTypeMasterSid: rate.CostVoucherTypeMasterSid,

                                    BookingRateSid: rate.BookingRatesSid,
                                }))
                            }).catch(err => {
                                console.error('HouseJobRates createMany error:', err);
                            });
                        }

                        /** Updating Vouchers with MasterJobSid && HouseJobSid */
                        if (allRevenueVouchers.length > 0) {
                            for (const revenueVoucher of allRevenueVouchers) {
                                await prisma.voucherHeader.update({
                                    where: {
                                        VoucherHeaderSid: revenueVoucher!
                                    },
                                    data: {
                                        MasterJobSid: createdMasterJob.MasterJobSid,
                                        HouseJobSid: houseJob.HouseJobSid,
                                        MasterNumber: createdMasterJob.MBLNo,
                                        HouseNumber: houseJob.HBLNo,
                                        UpdatedBy : payload.createdBy,
                                        UpdatedOn : new Date()
                                    }
                                }).catch(err => {
                                    console.error('Revenue VoucherHeader update error:', err);
                                });
                            }
                        }
                        if (allCostVouchers.length > 0) {
                            for (const costVoucher of allCostVouchers) {
                                await prisma.voucherHeader.update({
                                    where: {
                                        VoucherHeaderSid: costVoucher!
                                    },
                                    data: {
                                        MasterJobSid: createdMasterJob.MasterJobSid,
                                        HouseJobSid: houseJob.HouseJobSid,
                                        MasterNumber: createdMasterJob.MBLNo,
                                        HouseNumber: houseJob.HBLNo,
                                        UpdatedBy : payload.createdBy,
                                        UpdatedOn : new Date()
                                    }
                                }).catch(err => {
                                    console.error('Cost VoucherHeader update error:', err);
                                });
                            }
                        }


                        await prisma.bookingHeader.update({
                            where: { BookingHeaderSid: bookingHeader.BookingHeaderSid },
                            data: {
                                HouseJobSid: houseJob.HouseJobSid,
                                HouseNo: String(houseJob.HBLNo).substring(0, 20),
                                MasterNoSid: createdMasterJob.MasterJobSid,
                                MBLNo: createdMasterJob.MBLNo,
                                MBLDate: createdMasterJob.MBLDate,
                                HBLNo: houseJob?.HBLNo,
                                BookingStatus: 'Stuffed',

                                // If Sailing schedule changed during Loading Plan
                                VoyageMasterSid: createdVoyage.VoyageMasterSid,
                                VesselName: createdVoyage.VesselName,
                                VoyageNo: createdVoyage.VoyageNo,
                                ETA: createdVoyage.ETA,
                                ETD: createdVoyage.ETD,
                                updatedBy: payload.createdBy,
                                updatedOn: new Date(),
                            },
                        }).catch(err => {
                            console.error('bookingHeader update error:', err);
                        });

                        allCreatedHouseJobs.push(houseJob);
                    }
                }

                if (recordToUpdateShipment.length > 0) {
                    let houseJobNeedUpdateIds = recordToUpdateShipment.map(shipment => shipment.HouseJobSid);
                    for (const houseId of houseJobNeedUpdateIds) {
                        const ourHouse = await prisma.houseJob.findUnique({
                            where: {
                                HouseJobSid : houseId
                            }
                        })
                        if (!ourHouse) continue;
                        
                        await prisma.houseJob.update({
                            where: { HouseJobSid: ourHouse.HouseJobSid },
                            data: {
                                MasterJobSid: createdMasterJob.MasterJobSid,
                                MBLNo: createdMasterJob.MBLNo,
                                MBLDate: createdMasterJob.MBLDate,
                                updatedBy : payload.createdBy,
                                updatedOn : new Date(),
                                HouseStatus : 'Job Generated',
                            }
                        }).catch(err => {
                            console.error('houseJob update error:', err);
                        });

                        await prisma.bookingHeader.update({
                            where: { BookingHeaderSid: ourHouse.BookingHeaderSid! },
                            data: {
                                MasterNoSid: createdMasterJob.MasterJobSid,
                                MBLNo: createdMasterJob.MBLNo,
                                MBLDate: createdMasterJob.MBLDate,
                                updatedBy : payload.createdBy,
                                updatedOn : new Date(),
                                BookingStatus: 'Job Generated',
                            }
                        }).catch(error =>
                            console.error('Error updating booking header', error
                        ));
                    }
                }

                await prisma.houseJob.updateMany({
                    where: {
                        MasterJobSid: createdMasterJob.MasterJobSid
                    },
                    data: {
                        VoyageMasterSid: voyagePayload.VoyageMasterSid,
                        VoyageNo: voyagePayload.VoyageNo,
                        VesselName: voyagePayload.VesselName,
                        ETA: voyagePayload.ETA ? new Date(voyagePayload.ETA) : null,
                        ETD: voyagePayload.ETD ? new Date(voyagePayload.ETD) : null,
                        updatedBy: payload.createdBy,
                        updatedOn: new Date(),
                    }
                })


                //             if (recordToCreateTranshipment.length > 0) {
                //                 console.log('recordToCreateTranshipment', recordToCreateTranshipment);
                //     for (const transhipmentRecord of recordToCreateTranshipment) {
                //         const booking = await this._db.bookingHeader.findUnique({
                //             where: { BookingHeaderSid: transhipmentRecord.BookingHeaderSid },
                //             include: {
                //                 bookingCargo: { where: { status: 'A' } },
                //                 bookingProduct: { where: { status: 'A' } },
                //                 bookingOthers: { where: { status: 'A' } },
                //                 bookingConnection: { where: { status: 'A' } },
                //                 bookingRates: { where: { Status: 'A' } }
                //             }
                //         });

                //         if (!booking) continue;

                //         const { bookingCargo, bookingProduct, bookingOthers, bookingConnection, bookingRates, ...bookingHeader } = booking;

                //         // Generate NEW MBLNo for Master Job
                //         const mblDateString = moment().format('YYYYMMDD');
                //         const mblCount = await this._db.masterJob.count({
                //             where: { MBLNo: { contains: mblDateString } }
                //         });
                //         const newMBLNo = `MBL-${mblDateString}-${(mblCount + 1).toString().padStart(3, '0')}`;

                //         // Generate NEW HBLNo for House Job
                //         const hblDateString = moment().format('YYYYMMDD');
                //         const hblCount = await this._db.houseJob.count({
                //             where: { HBLNo: { contains: hblDateString } }
                //         });
                //         const newHBLNo = `HBL-${hblDateString}-${(hblCount + 1).toString().padStart(3, '0')}`;

                //         // Get department info for menu
                //         const department = await this._db.departmentMaster.findUnique({
                //             where: { DepartmentMasterSid: payload.DepartmentMasterSid },
                //             select: { departmentType: true }
                //         });

                //         const houseJobMenuId = await this.menuMasterService.getMenuSidByName(
                //             department?.departmentType?.toUpperCase() === 'AIR' ? 'House Air Waybill' : 'House Job'
                //         );

                //         // Get POL and POD port codes from booking
                //         const polPortCode = bookingHeader.POL || '';
                //         const podPortCode = bookingHeader.POD || '';

                //         // Create House Job for Transhipment
                //         const houseJob = await this._db.houseJob.create({
                //             data: {
                //                 MasterJobSid: newMasterJob.MasterJobSid,
                //                 HBLDate: new Date(),
                //                 BookingHeaderSid: bookingHeader.BookingHeaderSid || null,
                //                 ColoadedBy: bookingHeader.NominatedBy,
                //                 BookingNo: bookingHeader.BookingNo || '',
                //                 BookingDateTime: bookingHeader.BookingDateTime,
                //                 CompanyMasterSid: bookingHeader.CompanyMasterSid,
                //                 BranchMasterSid: bookingHeader.BranchMasterSid!,
                //                 CustomerMasterSid: bookingHeader.CustomerMasterSid,
                //                 JobType: 'Import', // Change to Import for transhipment
                //                 CustomerName: bookingHeader.CustomerName || '',
                //                 CustomerAddress: bookingHeader.CustomerAddress || '',
                //                 SalesmanSid: bookingHeader.SalesmanSid || null,
                //                 CargoExpectedon: bookingHeader.CargoExpectedon || null,
                //                 FreightTerms: bookingHeader.FreightTerms || '',
                //                 POO: bookingHeader.POO || '',
                //                 POL: bookingHeader.POL || '', // Copy from booking
                //                 POD: bookingHeader.POD || '', // Copy from booking
                //                 FPD: bookingHeader.FPD || '',
                //                 TsPortSid: bookingHeader.TsPortSid || null,
                //                 POLTerminal: bookingHeader.POLTerminal || '',
                //                 VoyageMasterSid: bookingHeader.VoyageMasterSid || null,
                //                 VesselName: bookingHeader.VesselName || '',
                //                 VoyageNo: bookingHeader.VoyageNo || '',
                //                 ETD: bookingHeader.ETD ? new Date(bookingHeader.ETD) : null,
                //                 ETA: bookingHeader.ETA ? new Date(bookingHeader.ETA) : null,
                //                 IncoTerms: bookingHeader.IncoTerms || '',
                //                 BLLocation: bookingHeader.BLLocation || null,
                //                 ShipperName: bookingHeader.ShipperName || '',
                //                 ShipperAddress: bookingHeader.ShipperAddress || '',
                //                 ConsigneeName: bookingHeader.ConsigneeName || '',
                //                 ConsigneeAddress: bookingHeader.ConsigneeAddress || '',
                //                 ClearanceRequire: bookingHeader.ClearanceRequire || '',
                //                 ShipmentType: bookingHeader.ShipmentType || '',
                //                 DestinationAgent: bookingHeader.DestinationAgent,
                //                 AgentName: bookingHeader.AgentName || '',
                //                 AgentAddress: bookingHeader.AgentAddress || '',
                //                 Notify: bookingHeader.Notify || '',
                //                 NotifyAddress: bookingHeader.NotifyAddress || '',
                //                 HouseNo: bookingHeader.HouseNo || '',
                //                 QuotationHeaderSid: bookingHeader.QuotationHeaderSid || null,
                //                 EnquiryHeaderSid: bookingHeader.EnquiryHeaderSid || null,
                //                 MovementType: bookingHeader.MovementType || '',
                //                 DoValid: bookingHeader.DoValid ? new Date(bookingHeader.DoValid) : null,
                //                 IsServiceJob: bookingHeader.IsServiceJob || '',
                //                 createdBy: payload.CreatedBy || '',
                //                 status: bookingHeader.status || '',
                //                 BookingStatus: bookingHeader.BookingStatus || '',
                //                 DepartmentMasterSid: bookingHeader.DepartmentMasterSid,
                //                 CustomerBranchSid: bookingHeader.CustomerBranchSid || null,
                //                 AuthorizerRemarks: bookingHeader.AuthorizerRemarks || '',
                //                 authorizerStatus: bookingHeader.authorizerStatus,
                //                 MenuMasterSid: houseJobMenuId || payload.MenuMasterSid,
                //                 CarrierSid: bookingHeader.CarrierSid || null,
                //                 CarrierName: bookingHeader.CarrierName || '',
                //                 Coload: bookingHeader.Coload || '',
                //                 GeneralNote: bookingHeader.GeneralNote || '',
                //                 HBLNo: newHBLNo, // NEW HBLNo
                //                 InternalNote: bookingHeader.InternalNote || '',
                //                 MBLDate: new Date(), // Use current date
                //                 MBLNo: newMBLNo, // NEW MBLNo from master job
                //                 NominatedBy: bookingHeader.NominatedBy || '',
                //                 Nominated: bookingHeader.Nominated || '',
                //                 PODTerminal: bookingHeader.PODTerminal || '',
                //                 ShipmentNo: bookingHeader.ShipmentNo || '',
                //                 OriginAgent: bookingHeader.OriginAgent || ''
                //             }
                //         }).catch(err => {
                //             console.error('Transhipment HouseJob create error:', err);
                //             return null;
                //         });

                //         if (!houseJob) continue;

                //         // Create related records (cargo, products, connections, others, rates) similar to regular house job creation
                //         // ... (copy the existing house job creation logic for related records)

                //         // Update BookingHeader with notes
                //         await this._db.bookingHeader.update({
                //             where: { BookingHeaderSid: bookingHeader.BookingHeaderSid },
                //             data: {
                //                 MasterNoSid: newMasterJob.MasterJobSid,
                //                 // Store generated numbers in notes with POL/POD format
                //                 GeneralNote: bookingHeader.GeneralNote +" "+`${newMBLNo} - ${polPortCode} / ${podPortCode}`,
                //                 InternalNote: bookingHeader.InternalNote +" "+`${newHBLNo} - ${polPortCode} / ${podPortCode}`,
                //                 // Do NOT update MBLNo, HBLNo, or MBLDate for transhipment
                //                 BookingStatus: 'Stuffed',   

                //                 // Update voyage information from master job
                //                 VoyageMasterSid: newMasterJob.VoyageMasterSid,
                //                 VesselName: newMasterJob.VesselName,
                //                 VoyageNo: newMasterJob.VoyageNo,
                //                 ETA: newMasterJob.ETA,
                //                 ETD: newMasterJob.ETD,
                //             }
                //         }).catch(err => {
                //             console.error('Transhipment bookingHeader update error:', err);
                //         });
                //     }
                // }
                return {
                    ...createdMasterJob,
                    ...createdVoyage,
                    ...finalHouseJobCustoms,
                    ...createdCostRevenueCharges,
                    ...allConnections,
                    ...createdActivities,

                }
            },
                {
                    timeout: 120000,
                }
            )
            return {
                newMasterJob,
            };
        } catch (error) {
            throw error;
        }
    }

    async getAllMasterJobs(payload: any) {
        try {
            const allMasterJobs = await this._db.masterJob.findMany({
                where: {
                    Status: "A",
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                }
            })
            return allMasterJobs;
        } catch (error) {
            throw error;
        }
    }

    async getMasterJobById(payload:{MasterJobSid:number,screenName:string}){
    try {
        return this._db.$transaction(async (prisma) => {
            const { MasterJobSid , screenName} = payload;
            const masterJobDetails = await prisma.masterJob.findUnique({
                where: {
                    MasterJobSid: MasterJobSid
                },
                include: {
                    voyages: { where: { Status: 'A' } },
                    masterJobConnection: { where: { Status: 'A' } },
                    containers: { 
                        where: { Status: 'A' },
                        include : {
                            houseJobProduct : {
                                where : {status : 'A'},
                                select : {
                                    MasterJobContainerSid : true,
                                    ExternlQty : true,
                                    GrossWeight : true,
                                    NetWeight : true,
                                    Volume : true
                                }
                            }},
                        },
                    others: { where: { Status: 'A' } },
                    houseJobCustoms: { where: { Status: 'A' } },
                    houseJob: {
                        where: {
                            status: 'A',
                        },
                        select: {
                            HBLNo: true,
                            ShipperName: true,
                            ShipperAddress: true,
                            ConsigneeName: true,
                            ConsigneeAddress: true,
                            Notify: true,
                            NotifyAddress: true,
                            HouseStatus: true,
                            CustomerName: true,
                            CustomerAddress: true,
                            FreightTerms: true,
                            bookingRates: true,
                            Cargo: true,
                            Products: true,
                            Others: true,
                            JobType:true,
                            HouseJobSid: true,
                            MenuMasterSid: true,
                            CompanyMasterSid: true,
                            BranchMasterSid: true,
                        },
                    }
                }
            })

            const menuId = await this.menuMasterService.getMenuSidByName(screenName === 'Master Air Waybill' ? "House Air Waybill" : "House Job");

            if(!masterJobDetails){
                throw new BadRequestException('Master Job not found.');
            }const houseJobWithCharges = await Promise.all(
                masterJobDetails.houseJob.map(async (houseJob) => {
                    const costRevenuePayload = {
                        TransactionSid: houseJob.HouseJobSid,
                        MenuMasterSid: menuId || houseJob.MenuMasterSid!,
                        CompanyMasterSid: houseJob.CompanyMasterSid,
                        BranchMasterSid: houseJob.BranchMasterSid!,
                    };

                    const costRevenueCharges = await prisma.costRevenueCharges.findMany({
                        where: {
                            TransactionSid: costRevenuePayload.TransactionSid,
                            MenuMasterSid: costRevenuePayload.MenuMasterSid,
                            CompanyMasterSid: costRevenuePayload.CompanyMasterSid,
                            BranchMasterSid: costRevenuePayload.BranchMasterSid,
                            status: "A"
                        },
                        include: {
                            revenueVoucherHeader: {
                                select: {
                                    VoucherNumber: true,
                                    VoucherHeaderSid: true
                                }
                            },
                            revenueVoucherTypeMaster: {
                                select: {
                                    DocumentTypeCode: true,
                                    VoucherTypeMasterSid: true
                                }
                            },
                        },
                        orderBy: {
                            SerialNumber: 'asc'
                        }
                    });

                    return {
                        ...houseJob,
                        costRevenueCharges
                    };
                })
            );
            
            const allShipments = await prisma.houseJob.findMany({
                where: {
                    MasterJobSid: MasterJobSid,
                    status: 'A'
                },
                orderBy: {
                    HouseJobSid: 'asc'
                },
                include: {
                    Cargo: {
                        where: { status: 'A' }
                    }
                }
            })
           
            
            // Calculate totals from all house job cargo
            let totalNoOfPkg = 0;
            let totalGrossWeight = 0;
            let totalNetWeight = 0;
            let totalChargeableWeight = 0;
            let totalVolume = 0;
            
            // For WeightIn, use the master job's value or find from first house job
            let weightIn = masterJobDetails?.WeightIn || 'Kg(s)';
            
            allShipments.forEach(houseJob => {
                houseJob.Cargo?.forEach(cargo => {
                    totalNoOfPkg += Number(cargo.NoOfPackage) || 0;
                    totalGrossWeight += Number(cargo.GrossWeight) || 0;
                    totalNetWeight += Number(cargo.NetWeight) || 0;
                    totalChargeableWeight += Number(cargo.ChargeableWeight) || 0;
                    totalVolume += Number(cargo.Volume) || 0;
                    
                    // Get WeightIn from first cargo entry if not set
                    if (!weightIn && cargo.WeightUnitSid) {
                        weightIn = this.getWeightInFromUnitSid(cargo.WeightUnitSid);
                    }
                });
            });
            
            // Format the totals
            const aggregatedTotals = {
                NoOfPkg: totalNoOfPkg,
                GrossWeight: parseFloat(totalGrossWeight.toFixed(3)),
                NetWeight: parseFloat(totalNetWeight.toFixed(3)),
                ChargeableWeight: parseFloat(totalChargeableWeight.toFixed(3)),
                Volume: parseFloat(totalVolume.toFixed(3)),
                WeightIn: weightIn
            };
            
            const allCostRevenueCharges = await prisma.costRevenueCharges.findMany({
                where: {
                    TransactionSid: MasterJobSid,
                    MenuMasterSid: masterJobDetails?.MenuMasterSid!,
                    CompanyMasterSid: masterJobDetails?.CompanyMasterSid,
                    BranchMasterSid: masterJobDetails?.BranchMasterSid,
                    MasterJobNo: masterJobDetails?.MasterJobNumber,
                    status: "A"
                },
                include: {
                    revenueVoucherHeader: {
                        select: {
                            VoucherNumber: true,
                            VoucherHeaderSid: true
                        }
                    },
                    revenueVoucherTypeMaster: {
                        select: {
                            DocumentTypeCode: true,
                            VoucherTypeMasterSid: true
                        }
                    },
                    costVoucherHeader: {
                        select: {
                            VoucherNumber: true,
                            VoucherHeaderSid: true
                        }
                    },
                    costVoucherTypeMaster: {
                        select: {
                            DocumentTypeCode: true,
                            VoucherTypeMasterSid: true
                        }
                    },
                    revenueCustomerMaster: {
                        select: {
                            CustomerMasterSid: true,
                            CustomerName: true
                        }
                    },
                    costCustomerMaster: {
                        select: {
                            CustomerMasterSid: true,
                            CustomerName: true
                        }
                    },
                    chargeMaster: {
                        select: {
                            chargeCode: true,
                            chargeName: true,
                            chargeGroup: {
                                select: { GroupName: true }
                            }
                        }
                    }
                },
                orderBy: {
                    SerialNumber: 'asc'
                }
            })
            
            const allActivities = await prisma.containerActivity.findMany({
                where: {
                    JobMasterSid: masterJobDetails?.MasterJobSid,
                    Status: "A"
                }
            })
            
            const VoyageMasterSid = masterJobDetails?.voyages[0]?.VoyageMasterSid;
            let CutOffDate;
            if (VoyageMasterSid) {
                let voyage = await prisma.voyageMasterHeader.findUnique({
                    where: {
                        VoyageMasterHeaderSid: VoyageMasterSid,
                    },
                    include: {
                        voyageMasterDetail: {
                            where: {
                                status: 'A'
                            },
                            select: {
                                POLSid: true,
                                PortCutoff: true,
                                portMasterPOL: {
                                    select: {
                                        PortCode: true
                                    }
                                }
                            },
                        }
                    }
                })

                CutOffDate = (voyage?.voyageMasterDetail || []).find(vd => vd.portMasterPOL?.PortCode === masterJobDetails?.POL)?.PortCutoff;
            }
            const {containers,...rest} = masterJobDetails;
            const enrichedContainers = containers.map(container => {

                if(!container.houseJobProduct) return container;
                const totalNoOfPkg = (container?.houseJobProduct || []).reduce((acc, product) => {
                    return acc + toNumber(product.ExternlQty) || 0;
                }, 0);
                const totalGrossWeight = (container?.houseJobProduct || []).reduce((acc, product) => {
                    return acc + toNumber(product.GrossWeight) || 0;
                }, 0);
                const totalNetWeight = (container?.houseJobProduct || []).reduce((acc, product) => {
                    return acc + toNumber(product.NetWeight) || 0;
                }, 0);
                const totalVolume = (container?.houseJobProduct || []).reduce((acc, product) => {
                    return acc + toNumber(product.Volume) || 0;
                }, 0);



                return {
                    ...container,
                    NoOfPkg : totalNoOfPkg,
                    GrossWeight : totalGrossWeight,
                    NetWeight : totalNetWeight,
                    Volume : totalVolume,

                }
            });
            
            return {
                ...masterJobDetails,
                containers : enrichedContainers || [],
                aggregatedTotals, // Add aggregated totals
                CutOffDate,
                allShipments,
                houseJob: houseJobWithCharges,
                costRevenueCharges: allCostRevenueCharges,
                containerActivities: allActivities,
                houseJobCustoms: masterJobDetails.houseJobCustoms || []
            }
        });
    } catch (error) {
        throw error;
    }
}

// Helper method to get WeightIn from WeightUnitSid
private getWeightInFromUnitSid(weightUnitSid: number): string {
    const weightUnits = {
        1: 'Kg(s)',
        2: 'LB(s)',
        3: 'Tonne(s)'
    };
    return weightUnits[weightUnitSid] || 'Kg(s)';
}

    // Give me the function to update master job
    async updateMasterJob(payload: any) {
        try {
            const updatedMasterJob = await this._db.$transaction(async (prisma) => {
                const allHouseJobs = await prisma.houseJob.findMany({
                    where: {
                        MasterJobSid: payload.MasterJobSid,
                        status: 'A'
                    },
                    include: {
                        Cargo: {
                            where: { status: 'A' }
                        }
                    }
                });

                // Calculate totals from all house job cargo
                let totalNoOfPkg = 0;
                let totalGrossWeight = 0;
                let totalNetWeight = 0;
                let totalChargeableWeight = 0;
                let totalVolume = 0;

                allHouseJobs.forEach(houseJob => {
                    houseJob.Cargo?.forEach(cargo => {
                        totalNoOfPkg += Number(cargo.NoOfPackage) || 0;
                        totalGrossWeight += Number(cargo.GrossWeight) || 0;
                        totalNetWeight += Number(cargo.NetWeight) || 0;
                        totalChargeableWeight += Number(cargo.ChargeableWeight) || 0;
                        totalVolume += Number(cargo.Volume) || 0;
                    });
                });

                const masterJobMenuId = await this.menuMasterService.getMenuSidByName(payload.screenName || "Master Job");

                const headerPayload : Prisma.MasterJobUpdateInput = {
                    FreightPPCC: payload.FreightPPCC,
                    DestinationAgent: payload.DestinationAgent,
                    DestinationAgentName: payload.DestinationAgentName,
                    DestinationAgentAddress: payload.DestinationAgentAddress?.substring(0, 20) || '',
                    MBLNo: payload.MBLNo,
                    MBLDate: payload.MBLDate ? new Date(payload.MBLDate) : null,
                    BLReleaseType: payload.BLReleaseType,
                    NoofOriginal: Number(payload.NoofOriginal),
                    OriginAgent: Number(payload.OriginAgent),
                    POO: payload.POO,
                    POL: payload.POL,
                    POD: payload.POD,
                    FPD: payload.FPD,
                    POLTerminal: payload.POLTerminal?.substring(0, 20) || '',
                    PODTerminal: payload.PODTerminal?.substring(0, 20) || '',
                    MovementType: payload.MovementType,
                    ShipmentTerms: payload.ShipmentTerms,
                    PkgType: Number(payload.PkgType),
                    NoOfPkg: totalNoOfPkg,
                    WeightIn: payload.WeightIn || 'Kg(s)',
                    GrossWeight: parseFloat(totalGrossWeight.toFixed(3)),
                    NetWeight: parseFloat(totalNetWeight.toFixed(3)),
                    ChargeableWeight: parseFloat(totalChargeableWeight.toFixed(3)),
                    Volume: parseFloat(totalVolume.toFixed(3)),
                    Haz: payload.Haz,
                    Status: payload.Status,
                    JobStatus: payload.JobStatus,
                    DGBookingDate: payload.DGBookingDate ? new Date(payload.DGBookingDate) : null,
                    DGApprovedDate: payload.DGApprovedDate ? new Date(payload.DGApprovedDate) : null,
                    SiCutoffDate: payload.SiCutoffDate ? new Date(payload.SiCutoffDate) : null,
                    PortCutoffDate: payload.PortCutoffDate ? new Date(payload.PortCutoffDate) : null,
                    CommodityDescription: payload.CommodityDescription || '',
                    MarksandNumber: payload.MarksandNumber || '',
                    UpdatedBy : payload.updatedBy,
                    UpdatedOn : new Date(),
                }
                const updatedMasterJob = await prisma.masterJob.update({
                    where: {
                        MasterJobSid: payload.MasterJobSid
                    },
                    data: headerPayload
                })


                let finalVoyage: any;
                const MasterJobVoyageSid = payload?.MasterJobVoyageSid;
                if (MasterJobVoyageSid) {
                    // update
                    const voyagePayload : Prisma.MasterJobVoyageUncheckedUpdateInput= {
                        VoyageMasterSid: payload.VoyageMasterSid,
                        VesselName: payload.VesselName,
                        VoyageNo: payload.VoyageNo,
                        ETD: payload.ETD ? new Date(payload.ETD) : null,
                        ETA: payload.ETA ? new Date(payload.ETA) : null,
                        ATA: payload.ATA ? new Date(payload.ATA) : null,
                        ATD: payload.ATD ? new Date(payload.ATD) : null,
                        DestinationATA: payload.DestinationATA ? new Date(payload.DestinationATA) : null,
                        CarrierName: payload.CarrierName,
                    }
                    finalVoyage = await prisma.masterJobVoyage.update({
                        where: {
                            MasterJobVoyageSid: MasterJobVoyageSid
                        },
                        data: voyagePayload
                    })
                } else {
                    // create
                    const voyagePayload = {
                        MasterJobSid: payload.MasterJobSid,
                        VoyageMasterSid: payload.VoyageMasterSid,
                        VesselName: payload.VesselName,
                        VoyageNo: payload.VoyageNo,
                        ETD: payload.ETD ? new Date(payload.ETD) : null,
                        ETA: payload.ETA ? new Date(payload.ETA) : null,
                        ATA: payload.ATA ? new Date(payload.ATA) : null,
                        ATD: payload.ATD ? new Date(payload.ATD) : null,
                        DestinationATA: payload.DestinationATA ? new Date(payload.DestinationATA) : null,
                        CarrierName: payload.CarrierName,
                        Status: "A"
                    }
                    finalVoyage = await prisma.masterJobVoyage.create({
                        data: voyagePayload
                    })
                }

                const finalConnections: any[] = [];
                const allConnections = payload.masterJobConnection || [];
                for (const connection of allConnections) {
                    let connectionResult;

                    if (connection.MasterJobConnectionSid) {
                        // update existing connection
                        const connectionPayload = {
                            Mode: connection.Mode,
                            POL: connection.POL,
                            POD: connection.POD,
                            VesselName: connection.VesselName,
                            VoyageNo: connection.VoyageNo,
                            ETD: connection.ETD ? new Date(connection.ETD) : null,
                            ETA: connection.ETA ? new Date(connection.ETA) : null,
                            ATD: connection.ATD ? new Date(connection.ATD) : null,
                            ATA: connection.ATA ? new Date(connection.ATA) : null,
                            Remarks: connection.Remarks,
                            UpdatedBy: payload.UpdatedBy || payload.CreatedBy,
                            UpdatedOn: new Date(),
                        };

                        connectionResult = await prisma.masterJobConnection.update({
                            where: {
                                MasterJobConnectionSid: connection.MasterJobConnectionSid
                            },
                            data: connectionPayload
                        });
                    } else {
                        // create new connection
                        const connectionPayload = {
                            MasterJobSid: payload.MasterJobSid,
                            Mode: connection.Mode,
                            POL: connection.POL,
                            POD: connection.POD,
                            VesselName: connection.VesselName,
                            VoyageNo: connection.VoyageNo,
                            ETD: connection.ETD ? new Date(connection.ETD) : null,
                            ETA: connection.ETA ? new Date(connection.ETA) : null,
                            ATD: connection.ATD ? new Date(connection.ATD) : null,
                            ATA: connection.ATA ? new Date(connection.ATA) : null,
                            Remarks: connection.Remarks,
                            Status: String(connection.status).charAt(0) || 'A',
                            CreatedBy: payload.CreatedBy,
                            CreatedOn: new Date(),
                        };

                        connectionResult = await prisma.masterJobConnection.create({
                            data: connectionPayload
                        });
                    }
                    finalConnections.push(connectionResult);
                }

                let finalOthers: any;
                const MasterJobOthersSid = payload?.others?.MasterJobOthersSid;
                const otherFormValue = payload.others;
                if (MasterJobOthersSid) {
                    const otherPayload = {
                        Yard: otherFormValue?.Yard ? Number(otherFormValue?.Yard) : null,
                        YardAddress: otherFormValue?.YardAddress,
                        Transporter: otherFormValue?.Transporter,
                        HandlingInformation: otherFormValue?.HandlingInformation,
                        InternalNote: otherFormValue?.InternalNote,
                        CFS: otherFormValue?.CFS ? Number(otherFormValue?.CFS) : null,
                        CFSAddress: otherFormValue?.CFSAddress,
                        StuffingStartDate: otherFormValue?.StuffingStartDate ? new Date(otherFormValue?.StuffingStartDate) : null,
                        StuffingEndDate: otherFormValue?.StuffingEndDate ? new Date(otherFormValue?.StuffingEndDate) : null,
                        CurrencyCode: otherFormValue?.CurrencyCode,
                        SellExchangeRate: otherFormValue?.SellExchangeRate ? Number(otherFormValue?.SellExchangeRate) : null,
                        AgentExchangeRate: otherFormValue?.AgentExchangeRate ? Number(otherFormValue?.AgentExchangeRate) : null,
                        Coload: otherFormValue?.Coload,
                        CoLoader: otherFormValue?.CoLoader,
                        ExportDoNo: otherFormValue?.ExportDoNo,
                        CarrierRef: otherFormValue?.CarrierRef,
                        AgentRef: otherFormValue?.AgentRef,
                        ExportDoDate: otherFormValue?.ExportDoDate ? new Date(otherFormValue?.ExportDoDate) : null,
                        SOBDate: otherFormValue?.SOBDate ? new Date(otherFormValue?.SOBDate) : null,
                    }
                    finalOthers = await prisma.masterJobOthers.update({
                        where: {
                            MasterJobOthersSid: MasterJobOthersSid
                        },
                        data: otherPayload
                    })
                }
                else {
                    const otherPayload = {
                        MasterJobSid: updatedMasterJob?.MasterJobSid,
                        CreatedBy: payload.CreatedBy,
                        Status: "A",
                        Yard: otherFormValue?.Yard ? Number(otherFormValue?.Yard) : null,
                        YardAddress: otherFormValue?.YardAddress,
                        Transporter: otherFormValue?.Transporter,
                        HandlingInformation: otherFormValue?.HandlingInformation,
                        InternalNote: otherFormValue?.InternalNote,
                        CFS: otherFormValue?.CFS ? Number(otherFormValue?.CFS) : null,
                        CFSAddress: otherFormValue?.CFSAddress,
                        StuffingStartDate: otherFormValue?.StuffingStartDate ? new Date(otherFormValue?.StuffingStartDate) : null,
                        StuffingEndDate: otherFormValue?.StuffingEndDate ? new Date(otherFormValue?.StuffingEndDate) : null,
                        CurrencyCode: otherFormValue?.CurrencyCode,
                        SellExchangeRate: otherFormValue?.SellExchangeRate ? Number(otherFormValue?.SellExchangeRate) : null,
                        AgentExchangeRate: otherFormValue?.AgentExchangeRate ? Number(otherFormValue?.AgentExchangeRate) : null,
                        Coload: otherFormValue?.Coload,
                        CoLoader: otherFormValue?.CoLoader,
                        ExportDoNo: otherFormValue?.ExportDoNo,
                        CarrierRef: otherFormValue?.CarrierRef,
                        AgentRef: otherFormValue?.AgentRef,
                        ExportDoDate: otherFormValue?.ExportDoDate ? new Date(otherFormValue?.ExportDoDate) : null,
                        SOBDate: otherFormValue?.SOBDate ? new Date(otherFormValue?.SOBDate) : null,
                    }
                    finalOthers = await prisma.masterJobOthers.create({
                        data: otherPayload
                    })
                }

                const finalMasterJobContainers: any[] = [];
                const allContainers = payload?.masterJobContainers || [];
                if (allContainers.length > 0) {
                    for (const item of allContainers) {
                        let createdContainer;
                        let updatedContainer;
                        if (item.MasterJobContainerSid) {
                            const containerPayload = {
                                ContainerType: Number(item.ContainerType),
                                ContainerNumber: item.ContainerNumber,
                                LineSeal: item.LineSeal,
                                CustomsSeal: item.CustomsSeal,
                                HsCode: item.HsCode,
                                CommodityDescription: item.CommodityDescription,
                                PkgType: item.PkgType ? Number(item.PkgType) : null,
                                NoOfPkg: item.NoOfPkg ? Number(item.NoOfPkg) : null,
                                GrossWeight: item.GrossWeight ? Number(item.GrossWeight) : null,
                                NetWeight: item.NetWeight ? Number(item.NetWeight) : null,
                                ChargeableWeight: item.ChargeableWeight ? Number(item.ChargeableWeight) : null,
                                Volume: item.Volume ? Number(item.Volume) : null,
                                IsSoc: item.IsSoc
                            }
                            updatedContainer = await prisma.masterJobContainer.update({
                                where: {
                                    MasterJobContainerSid: item.MasterJobContainerSid
                                },
                                data: containerPayload
                            })
                        } else {
                            // create - For new containers, use payload.MasterJobSid
                            const containerPayload = {
                                MasterJobSid: payload.MasterJobSid, // This is correct for new containers
                                CreatedBy: payload.CreatedBy,
                                Status: "A",
                                ContainerType: Number(item.ContainerType),
                                ContainerNumber: item.ContainerNumber,
                                LineSeal: item.LineSeal,
                                CustomsSeal: item.CustomsSeal,
                                HsCode: item.HsCode,
                                CommodityDescription: item.CommodityDescription,
                                PkgType: item.PkgType ? Number(item.PkgType) : null,
                                NoOfPkg: item.NoOfPkg ? Number(item.NoOfPkg) : null,
                                GrossWeight: item.GrossWeight ? Number(item.GrossWeight) : null,
                                NetWeight: item.NetWeight ? Number(item.NetWeight) : null,
                                ChargeableWeight: item.ChargeableWeight ? Number(item.ChargeableWeight) : null,
                                Volume: item.Volume ? Number(item.Volume) : null,
                                IsSoc: item.IsSoc
                            }
                            createdContainer = await prisma.masterJobContainer.create({
                                data: containerPayload
                            })
                        }
                        finalMasterJobContainers.push(createdContainer || updatedContainer);
                    }
                }

                const finalCharges: any[] = [];
                const allCostRevenueCharges = payload?.costRevenueCharges || [];
                let itemIndex = 1;
                for (const item of allCostRevenueCharges) {
                    let createdCharge;
                    let updatedCharge;
                    if (item.RateSid) {
                        // update
                        const costRevenueChargesPayload = {
                            TransactionSid: updatedMasterJob.MasterJobSid || item.RateSid,
                            MenuMasterSid: masterJobMenuId || updatedMasterJob.MenuMasterSid!,
                            ShipmentNo: updatedMasterJob.MasterJobNumber,
                            MasterJobNo: updatedMasterJob.MasterJobNumber,
                            updatedBy: payload.UpdatedBy || '',
                            status: String(item.status).charAt(0) || 'A',
                            Remarks: item.Remarks || '',

                            SerialNumber: itemIndex++,
                            ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                            ChargeDescription: item.ChargeDescription,
                            ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                            RevenueChargeUomSid:
                                (item.RevenueChargeUomSid ? Number(item.RevenueChargeUomSid) : null) ||
                                (item.ChargeUomSid ? Number(item.ChargeUomSid) : null)!,
                            CostChargeUomSid:
                                (item.CostChargeUomSid! ? Number(item.CostChargeUomSid) : null) ||
                                (item.ChargeUomSid ? Number(item.ChargeUomSid) : null)!,
                            RevenueNumberOfUnit:
                                (item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null) ||
                                (item.NoOfUnit ? Number(item.NoOfUnit) : null)!,
                            CostNumberOfUnit:
                                (item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null) ||
                                (item.NoOfUnit ? Number(item.NoOfUnit) : null)!,

                            // Revenue Section
                            RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? Number(item.RevenueCurrencyMasterSid) : null,
                            RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                            RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                            RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                            RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                            RevenueDrCr: item.RevenueDrCr,
                            RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                            RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                            RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                            RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                            RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                            // Cost Section
                            CostCurrencyMasterSid: item.CostCurrencyMasterSid ? Number(item.CostCurrencyMasterSid) : null,
                            CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                            CostRate: item.CostRate ? Number(item.CostRate) : null,
                            CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                            CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                            CostDrCr: item.CostDrCr,
                            CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                            CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                            CostPrepaidCollect: item.CostPrepaidCollect,
                            CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                            CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                        }
                        updatedCharge = await prisma.costRevenueCharges.update({
                            where: {
                                CostRevenueChargesSid: item.RateSid
                            },
                            data: costRevenueChargesPayload
                        })
                    } else {
                        // create
                        const costRevenueChargesPayload = {
                            TransactionSid: updatedMasterJob.MasterJobSid,
                            MenuMasterSid: masterJobMenuId || updatedMasterJob.MenuMasterSid!,
                            ShipmentNo: updatedMasterJob.MasterJobNumber,
                            MasterJobNo: updatedMasterJob.MasterJobNumber,
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,

                            SerialNumber: itemIndex++,
                            ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                            ChargeDescription: item.ChargeDescription,

                            ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                            RevenueChargeUomSid: Number(item.RevenueChargeUomSid),
                            CostChargeUomSid: Number(item.CostChargeUomSid),
                            RevenueNumberOfUnit: item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null,
                            CostNumberOfUnit: item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null,

                            // Revenue Section
                            RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? item.RevenueCurrencyMasterSid : null,
                            RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                            RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                            RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                            RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                            RevenueDrCr: item.RevenueDrCr,
                            RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                            RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                            RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                            RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                            RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                            // Cost Section
                            CostCurrencyMasterSid: item.CostCurrencyMasterSid ? item.CostCurrencyMasterSid : null,
                            CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                            CostRate: item.CostRate ? Number(item.CostRate) : null,
                            CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                            CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                            CostDrCr: item.CostDrCr,
                            CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                            CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                            CostPrepaidCollect: item.CostPrepaidCollect,
                            CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                            CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                            createdBy: payload.CreatedBy,
                            status: "A",
                            Remarks: item.Remarks
                        }

                        createdCharge = await prisma.costRevenueCharges.create({
                            data: costRevenueChargesPayload
                        })
                    }
                    finalCharges.push(createdCharge || updatedCharge);
                }
                const finalcontainerActivities: any[] = [];
                const finalContainerActivities: any[] = [];
                const payloadActivities = payload?.containerActivities || [];

                for (const act of payloadActivities) {
                    let activityResult;

                    if (act.ContainerActivitySid) {
                        // update existing activity
                        const activityPayload = {
                            ContainerNumber: act.ContainerNumber,
                            ContainerType: Number(act.ContainerType),
                            ActivityCode: act.ActivityCode,
                            ActivityName: act.ActivityName,
                            ActivityDate: act.ActivityDate ? new Date(act.ActivityDate) : new Date(),
                            ActivityFrom: act.ActivityFrom,
                            ActivityTo: act.ActivityTo,
                            Remarks: act.Remarks,
                            UpdatedBy: payload.UpdatedBy || payload.CreatedBy,
                            UpdatedOn: new Date(),
                        };

                        activityResult = await prisma.containerActivity.update({
                            where: {
                                ContainerActivitySid: act.ContainerActivitySid
                            },
                            data: activityPayload,
                        });
                    } else {
                        // create new activity
                        const activityPayload = {
                            JobMasterSid: payload.MasterJobSid,
                            ContainerNumber: act.ContainerNumber,
                            ContainerType: Number(act.ContainerType),
                            ActivityCode: act.ActivityCode,
                            ActivityName: act.ActivityName,
                            ActivityDate: act.ActivityDate ? new Date(act.ActivityDate) : new Date(),
                            ActivityFrom: act.ActivityFrom,
                            ActivityTo: act.ActivityTo,
                            Remarks: act.Remarks,
                            CreatedBy: payload.CreatedBy,
                            Status: "A",
                        };

                        activityResult = await prisma.containerActivity.create({
                            data: activityPayload
                        });
                    }
                    finalContainerActivities.push(activityResult);
                }
                const finalHouseJobCustoms: any[] = [];
                const houseJobCustomsPayload = payload.houseJobCustoms || [];

                if (houseJobCustomsPayload.length > 0) {
                    for (const customs of houseJobCustomsPayload) {
                        let customResult;

                        if (customs.HouseJobCustomsSid) {
                            // Update existing customs record
                            const updateData: any = {
                                HouseJobCustomsSid: customs.HouseJobCustomsSid,
                                MasterJobSid: payload.MasterJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                LineCode: customs.LineCode,
                                VoyageAgentCode: customs.VoyageAgentCode,
                                RotationNumber: customs.RotationNumber,
                                ManifestSequence: customs.ManifestSequence,
                                CargoCode: customs.CargoCode,
                                StorageRequest: customs.StorageRequest,
                                PackageTypeCode: customs.PackageTypeCode,
                                FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                                NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                                SLACIndicator: customs.SLACIndicator,
                                ImporterCode: customs.ImporterCode,
                                SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                                UsedOrNew: customs.UsedOrNew,
                                UNHSCode: customs.UNHSCode,
                                UNNumber: customs.UNNumber,
                                FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                                TemperatureUnit: customs.TemperatureUnit,
                                HazStorageRequest: customs.HazStorageRequest,
                                RefrigerationRequired: customs.RefrigerationRequired,
                                MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                                MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                                RefTemperatureUnit: customs.RefTemperatureUnit,
                                UpdatedBy: payload.updatedBy || payload.CreatedBy,
                                UpdatedOn: new Date(),
                            };

                            // Remove null values for update
                            Object.keys(updateData).forEach(key => {
                                if (updateData[key] === null || updateData[key] === undefined) {
                                    delete updateData[key];
                                }
                            });

                            customResult = await prisma.houseJobCustoms.update({
                                where: {
                                    HouseJobCustomsSid: customs.HouseJobCustomsSid
                                },
                                data: updateData
                            });
                        } else {
                            // Create new customs record
                            const createData = {

                                MasterJobSid: payload.MasterJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                LineCode: customs.LineCode,
                                VoyageAgentCode: customs.VoyageAgentCode,
                                RotationNumber: customs.RotationNumber,
                                ManifestSequence: customs.ManifestSequence,
                                CargoCode: customs.CargoCode,
                                StorageRequest: customs.StorageRequest,
                                PackageTypeCode: customs.PackageTypeCode,
                                FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                                NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                                SLACIndicator: customs.SLACIndicator,
                                ImporterCode: customs.ImporterCode,
                                SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                                UsedOrNew: customs.UsedOrNew,
                                UNHSCode: customs.UNHSCode,
                                UNNumber: customs.UNNumber,
                                FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                                TemperatureUnit: customs.TemperatureUnit,
                                HazStorageRequest: customs.HazStorageRequest,
                                RefrigerationRequired: customs.RefrigerationRequired,
                                MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                                MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                                RefTemperatureUnit: customs.RefTemperatureUnit,
                                CreatedBy: payload.updatedBy || payload.CreatedBy,
                                Status: "A"
                            };

                            customResult = await prisma.houseJobCustoms.create({
                                data: createData
                            });
                        }
                        finalHouseJobCustoms.push(customResult);
                    }
                }


                return {
                    ...updatedMasterJob,
                    calculatedTotals: {
                        NoOfPkg: totalNoOfPkg,
                        GrossWeight: totalGrossWeight,
                        NetWeight: totalNetWeight,
                        ChargeableWeight: totalChargeableWeight,
                        Volume: totalVolume,
                    },
                    containerActivities: finalContainerActivities,
                    allCostRevenueCharges: finalCharges,
                    allActivities: finalContainerActivities,
                    finalOthers: finalOthers,
                    allContainers: finalMasterJobContainers,
                    allConnections: finalConnections,
                    MasterJobVoyageSid: finalVoyage,
                    houseJobCustoms: finalHouseJobCustoms,





                }
            });
            // SHIPMENT PART

            const allShipments = payload.shipmentList || [];
            const recordToCreateShipment = allShipments.filter(shipment => !shipment.HBLNo);
            const recordToUpdateShipment = allShipments.filter(shipment => shipment.HBLNo);


            if (recordToCreateShipment.length > 0) {
                let bookingNeedHouseCreateIds = recordToCreateShipment.map(shipment => shipment.BookingHeaderSid);
                const allBookings = await this._db.bookingHeader.findMany({
                    where: { BookingHeaderSid: { in: bookingNeedHouseCreateIds } },
                    include: {
                        bookingCargo: true,
                        bookingProduct: true,
                        bookingOthers: true,
                        bookingConnection: true,
                        bookingRates: true,
                    },
                });

                const dateString = moment().format('YYYYMMDD');
                let hblBaseCount = await this._db.houseJob.count({
                    where: { HBLNo: { contains: dateString } },
                });
                let hblSerial = hblBaseCount;

                const allCreatedHouseJobs: any[] = [];
                for (const booking of allBookings) {
                    const { bookingCargo, bookingProduct, bookingOthers, bookingConnection, bookingRates, ...bookingHeader } = booking;


                    const department = await this._db.departmentMaster.findUnique({
                        where: { DepartmentMasterSid: payload.DepartmentMasterSid },
                        select: {
                            departmentType: true,
                            ExportImport: true
                        }
                    });
                    const departmentExportImport = department?.ExportImport ?? null;
                    hblSerial += 1;
                    let HBLNo;
                    if (departmentExportImport === 'Export') {
                        HBLNo = `HOUSE-${dateString}-${hblSerial.toString().padStart(3, '0')}`;
                    } else {
                        HBLNo = "";
                    }

                    const houseJobMenuId = await this.menuMasterService.getMenuSidByName(payload.screenName === 'Master Job' ? 'House Job' : 'House Air Waybill');


                    // Step 1: Create main house job
                    let houseJob = await this._db.houseJob.create({
                        data: {
                            MasterJobSid: updatedMasterJob.MasterJobSid,

                            BookingHeaderSid: bookingHeader.BookingHeaderSid || null,
                            ColoadedBy: bookingHeader.NominatedBy,
                            BookingNo: bookingHeader.BookingNo || '',
                            BookingDateTime: bookingHeader.BookingDateTime,
                            CompanyMasterSid: bookingHeader.CompanyMasterSid,
                            BranchMasterSid: bookingHeader.BranchMasterSid!,
                            CustomerMasterSid: bookingHeader.CustomerMasterSid,
                            CustomerName: bookingHeader.CustomerName || '',
                            CustomerAddress: bookingHeader.CustomerAddress || '',
                            SalesmanSid: bookingHeader.SalesmanSid || null,
                            CargoExpectedon: bookingHeader.CargoExpectedon || null,
                            FreightTerms: bookingHeader.FreightTerms || '',
                            POO: bookingHeader.POO || '',
                            POL: bookingHeader.POL || '',
                            POD: bookingHeader.POD || '',
                            FPD: bookingHeader.FPD || '',
                            TsPortSid: bookingHeader.TsPortSid || null,
                            POLTerminal: bookingHeader.POLTerminal || '',
                            VoyageMasterSid: bookingHeader.VoyageMasterSid || null,
                            VesselName: bookingHeader.VesselName || '',
                            VoyageNo: bookingHeader.VoyageNo || '',
                            ETD: bookingHeader.ETD ? new Date(bookingHeader.ETD) : null,
                            ETA: bookingHeader.ETA ? new Date(bookingHeader.ETA) : null,
                            IncoTerms: bookingHeader.IncoTerms || '',
                            BLLocation: bookingHeader.BLLocation || null,
                            ShipperName: bookingHeader.ShipperName || '',
                            ShipperAddress: bookingHeader.ShipperAddress || '',
                            ConsigneeName: bookingHeader.ConsigneeName || '',
                            ConsigneeAddress: bookingHeader.ConsigneeAddress || '',
                            ClearanceRequire: bookingHeader.ClearanceRequire || '',
                            ShipmentType: bookingHeader.ShipmentType || '',
                            DestinationAgent: bookingHeader.DestinationAgent,
                            AgentName: bookingHeader.AgentName || '',
                            AgentAddress: bookingHeader.AgentAddress || '',
                            HouseNo: bookingHeader.HouseNo || '',
                            QuotationHeaderSid: bookingHeader.QuotationHeaderSid || null,
                            EnquiryHeaderSid: bookingHeader.EnquiryHeaderSid || null,
                            MovementType: bookingHeader.MovementType || '',
                            DoValid: bookingHeader.DoValid ? new Date(bookingHeader.DoValid) : null,
                            IsServiceJob: bookingHeader.IsServiceJob || '',
                            createdBy: payload.CreatedBy || '',
                            status: bookingHeader.status || '',
                            BookingStatus: bookingHeader.BookingStatus || '',
                            DepartmentMasterSid: bookingHeader.DepartmentMasterSid,
                            CustomerBranchSid: bookingHeader.CustomerBranchSid || null,
                            AuthorizerRemarks: bookingHeader.AuthorizerRemarks || '',
                            authorizerStatus: bookingHeader.authorizerStatus,
                            MenuMasterSid: houseJobMenuId || payload.MenuMasterSid,
                            CarrierSid: bookingHeader.CarrierSid || null,
                            CarrierName: bookingHeader.CarrierName || '',
                            Coload: bookingHeader.Coload || '',
                            GeneralNote: bookingHeader.GeneralNote || '',
                            HBLNo: HBLNo,
                            InternalNote: bookingHeader.InternalNote || '',
                            MBLDate: bookingHeader.MBLDate || null,
                            MBLNo: bookingHeader.MBLNo || '',
                            NominatedBy: bookingHeader.NominatedBy || '',
                            Nominated: bookingHeader.Nominated || '',
                            PODTerminal: bookingHeader.PODTerminal || '',
                            ShipmentNo: bookingHeader.ShipmentNo || '',
                            OriginAgent: bookingHeader.OriginAgent || '',
                        },
                    }).catch(err => {
                        console.error('HouseJobCargo createMany error:', err);
                    });

                    if (!houseJob) continue;

                    if (bookingCargo?.length) {
                        await this._db.houseJobCargo.createMany({
                            data: bookingCargo.map((cargo) => ({
                                HouseJobSid: houseJob.HouseJobSid,
                                CompanyMasterSid: houseJob.CompanyMasterSid,
                                BranchMasterSid: houseJob.BranchMasterSid!,
                                NoOfPackage: cargo.NoOfPackage || 0,
                                FreightAmount: cargo.FreightAmount,
                                CargoType: cargo.CargoType,
                                WeightUnitSid: cargo.WeightUnitSid || null,
                                GrossWeight: cargo.GrossWeight || 0,
                                NetWeight: cargo.NetWeight || 0,
                                Volume: cargo.Volume || 0,
                                ChargeableWeight: cargo.ChargeableWeight || 0,
                                MarksAndNumber: '',
                                CommodityDescription: '',
                                ContainerType: cargo.ContainerType,
                                PackageType: cargo.PackageType || null,
                                Qty: cargo.Qty || 0,
                                ShipmentTerms: cargo.ShipmentTerms || '',
                                createdBy: payload.CreatedBy || '',
                                updatedBy: cargo.updatedBy || null,
                                status: 'A',
                                FreightTerms: cargo.FreightTerms || '',
                                MovementType: cargo.MovementType || '',
                                ModeOfTransport: cargo.ModeOfTransport || '',
                                NoofContainers: cargo.NoofContainers || 0,
                                StuffingAt: cargo.StuffingAt || '',
                            })
                            ),
                        }).catch(err => {
                            console.error('HouseJobCargo createMany error:', err);
                        });
                    }

                    if (bookingProduct?.length) {
                        await this._db.houseJobProduct.createMany({
                            data: bookingProduct.map((product) => ({
                                HouseJobSid: houseJob.HouseJobSid,
                                ProductName: product.ProductName || '',
                                ProductDescription: product.ProductDescription || '',
                                ShippingBillNo: product.ShippingBillNo || '',
                                ShippingBillDate: product.ShippingBillDate || null,
                                ExternaPkg: product.ExternaPkg || '',
                                ExternlQty: String(product.ExternlQty) || '',
                                GrossWeight: Number(product.GrossWeight) || 0,
                                NetWeight: Number(product.NetWeight) || 0,
                                Volume: Number(product.Volume) || 0,
                                CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                                CFS: product.CFS || '',
                                Height: product.Height || 0,
                                ImcoClass: product.ImcoClass || '',
                                IsHaz: product.IsHaz || 'N',
                                Length: product.Length || 0,
                                PkgGroup: product.PkgGroup || '',
                                UnNo: product.UnNo || '',
                                Width: product.Width || 0,
                                UomMasterSid: product.UomMasterSid || null,
                                MarksAndNumber: '',
                                createdBy: payload.CreatedBy || '',
                            }))
                        }).catch(err => {
                            console.error('HouseJobProduct createMany error:', err);
                        });
                    }

                    if (bookingConnection?.length) {
                        await this._db.houseJobConnection.createMany({
                            data: bookingConnection.map((connection) => ({
                                HouseJobSid: houseJob.HouseJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: connection.ETD ? new Date(connection.ETD) : null,
                                ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks || '',
                                status: 'A',
                                createdBy: payload.CreatedBy || '',
                                updatedBy: connection.updatedBy || null,
                            }))
                        }).catch(err => {
                            console.error('HouseJobConnection createMany error:', err);
                        });
                    }

                    if (bookingOthers?.[0]) {
                        const other = bookingOthers[0];
                        await this._db.houseJobOthers.create({
                            data: {
                                HouseJobSid: houseJob.HouseJobSid,
                                CustomerRefNo: other.CustomerRefNo,
                                OperationUser: other.OperationUser,
                                CarrierBookingRef: other.CarrierBookingRef || '',
                                CarrierBookingDate: other.CarrierBookingDate ? new Date(other.CarrierBookingDate) : null,
                                DocumentationUser: other.DocumentationUser,
                                CustomerServiceuser: other.CustomerServiceuser,
                                NotifyParty: other.NotifyParty,
                                NotifyPartyAddress: other.NotifyPartyAddress,
                                CHAName: other.CHAName,
                                PickupMode: other.PickupMode,
                                YardCFS: other.YardCFS,
                                LocalTransport: other.LocalTransport,
                                OverseasTransport: other.OverseasTransport,
                                OverseasClearance: other.OverseasClearance,
                                PickupPlace: other.PickupPlace,
                                PickupDate: other.PickupDate ? new Date(other.PickupDate) : null,
                                PickupAddress: other.PickupAddress,
                                DeliveryPlace: other.DeliveryPlace,
                                DeliveryDate: other.DeliveryDate,
                                DeliveryAddress: other.DeliveryAddress,
                                CargoCurrency: other.CargoCurrency,
                                CargoValue: other.CargoValue,
                                DeliveryMode: other.DeliveryMode,
                                ExternalRemarks: other.ExternalRemarks,
                                SwitchBL: other.SwitchBL,
                                TransporterName: other.TransporterName,
                                createdBy: payload.CreatedBy || '',
                                status: 'A',
                                Forwarder: other.Forwarder || '',
                                ForwarderAddress: other.ForwarderAddress || '',
                                HBLNo: other.HBLNo || '',
                                BacktoBack: other.BacktoBack || '',
                                Depo: other.Depo || '',
                                ROValidity: other.ROValidity || '',
                                ReleaseType: other.ReleaseType || '',
                                AgentAddress: other.AgentAddress || '',
                                SwitchBLAgent: other.SwitchBLAgent || '',
                                SwitchBLConsignee: other.SwitchBLConsignee || '',
                                SwitchBLShipper: other.SwitchBLShipper || '',
                                SwitchLocation: other.SwitchLocation || '',
                                Coloader: other.Coloader || '',
                                Notify2: other.Notify2 || '',
                                NotifyAddress2: other.NotifyAddress2 || ''
                            }
                        }).catch(err => {
                            console.error('HouseJobOthers create error:', err);
                        });
                    }


                    const allRates = bookingRates || [];
                    const allRevenueVouchers = allRates.filter(rate => rate.RevenueVoucherHeaderSid !== null).map(rate => rate.RevenueVoucherHeaderSid);
                    const allCostVouchers = allRates.filter(rate => rate.CostVoucherHeaderSid !== null).map(rate => rate.CostVoucherHeaderSid);
                    let houseChargeIndex = 1;
                    if (allRates.length > 0) {
                        await this._db.costRevenueCharges.createMany({
                            data: allRates.map(rate => ({
                                TransactionSid: houseJob.HouseJobSid,
                                MenuMasterSid: houseJobMenuId || houseJob.MenuMasterSid!,
                                ShipmentNo: houseJob.ShipmentNo,
                                MasterJobNo: updatedMasterJob.MasterJobNumber,
                                CompanyMasterSid: houseJob.CompanyMasterSid,
                                BranchMasterSid: houseJob.BranchMasterSid!,
                                createdBy: payload.CreatedBy || '',
                                status: "A",
                                Remarks: rate.Remarks || '',

                                SerialNumber: houseChargeIndex++,
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeDescription: rate.ChargeDescription,
                                ChargeUomSid: rate.ChargeUomSid,
                                RevenueChargeUomSid: rate.RevenueChargeUomSid!,
                                CostChargeUomSid: rate.CostChargeUomSid!,
                                RevenueNumberOfUnit: rate.RevenueNumberOfUnit,
                                CostNumberOfUnit: rate.CostNumberOfUnit,

                                // Revenue Section
                                RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid,
                                RevenueExchangeRate: rate.RevenueExchangeRate,
                                RevenueRate: rate.RevenueRate,
                                RevenueAmount: rate.RevenueAmount,
                                RevenueLocalAmount: rate.RevenueLocalAmount,
                                RevenueDrCr: rate.RevenueDrCr,
                                RevenueCustomerMasterSid: rate.CustomerMasterSid,
                                RevenueCustomerBranchSid: rate.CustomerBranchSid,
                                RevenuePrepaidCollect: rate.RevenuePrepaidCollect,
                                RevenueVoucherHeaderSid: rate.RevenueVoucherHeaderSid,
                                RevenueVoucherTypeMasterSid: rate.RevenueVoucherTypeMasterSid,

                                // Cost Section
                                CostCurrencyMasterSid: rate.CostCurrencyMasterSid,
                                CostExchangeRate: rate.CostExchangeRate,
                                CostRate: rate.CostRate,
                                CostAmount: rate.CostAmount,
                                CostLocalAmount: rate.CostLocalAmount,
                                CostDrCr: rate.CostDrCr,
                                CostAgentMasterSid: rate.AgentMasterSid,
                                CostAgentBranchSid: rate.AgentBranchSid,
                                CostPrepaidCollect: rate.CostPrepaidCollect,
                                CostVoucherHeaderSid: rate.CostVoucherHeaderSid,
                                CostVoucherTypeMasterSid: rate.CostVoucherTypeMasterSid,

                                BookingRateSid: rate.BookingRatesSid,
                            }))
                        }).catch(err => {
                            console.error('HouseJobRates createMany error:', err);
                        });
                    }

                    if (allRevenueVouchers.length > 0) {
                        for (const revenueVoucher of allRevenueVouchers) {
                            await this._db.voucherHeader.update({
                                where: {
                                    VoucherHeaderSid: revenueVoucher!
                                },
                                data: {
                                    MasterJobSid: updatedMasterJob.MasterJobSid,
                                    HouseJobSid: houseJob.HouseJobSid,
                                    MasterNumber: updatedMasterJob.MBLNo,
                                    HouseNumber: houseJob.HBLNo,
                                }
                            }).catch(err => {
                                console.error('Revenue VoucherHeader update error:', err);
                            });
                        }
                    }
                    if (allCostVouchers.length > 0) {
                        for (const costVoucher of allCostVouchers) {
                            await this._db.voucherHeader.update({
                                where: {
                                    VoucherHeaderSid: costVoucher!
                                },
                                data: {
                                    MasterJobSid: updatedMasterJob.MasterJobSid,
                                    HouseJobSid: houseJob.HouseJobSid,
                                    MasterNumber: updatedMasterJob.MBLNo,
                                    HouseNumber: houseJob.HBLNo,
                                }
                            }).catch(err => {
                                console.error('Cost VoucherHeader update error:', err);
                            });
                        }
                    }

                    await this._db.bookingHeader.update({
                        where: { BookingHeaderSid: bookingHeader.BookingHeaderSid },
                        data: {
                            HBLNo,
                            MasterNoSid: updatedMasterJob.MasterJobSid,
                            MBLNo: updatedMasterJob.MBLNo,
                            MBLDate: updatedMasterJob.MBLDate,
                            BookingStatus: 'Stuffed',
                        },
                    }).catch(err => {
                        console.error('bookingHeader update error:', err);
                    });

                    allCreatedHouseJobs.push(houseJob);
                }
            }

            if (recordToUpdateShipment.length > 0) {
                let houseJobNeedUpdateIds = recordToUpdateShipment.map(shipment => shipment.HBLNo);
                for (const houseNo of houseJobNeedUpdateIds) {
                    const ourHouse = await this._db.houseJob.findFirst({
                        where: {
                            HBLNo: houseNo
                        }
                    })
                    if (!ourHouse) continue;
                    const updatedHouseJob = await this._db.houseJob.update({
                        where: { HouseJobSid: ourHouse.HouseJobSid },
                        data: {
                            MasterJobSid: updatedMasterJob.MasterJobSid,
                        }
                    }).catch(err => {
                        console.error('houseJob update error:', err);
                    });

                    const updatedBooking = await this._db.bookingHeader.update({
                        where: { BookingHeaderSid: ourHouse.BookingHeaderSid! },
                        data: {
                            MasterNoSid: updatedMasterJob.MasterJobSid,
                            MBLNo: updatedMasterJob.MBLNo,
                            MBLDate: updatedMasterJob.MBLDate,
                            BookingStatus: 'Stuffed',
                        }
                    }).catch(error =>
                        console.error('Error updating booking header', error
                        ));

                }
            }

            await this._db.houseJob.updateMany({
                where: {
                    MasterJobSid: updatedMasterJob.MasterJobSid,
                    status: 'A'
                },
                data: {
                    VoyageMasterSid: payload.VoyageMasterSid,
                    VoyageNo: payload.VoyageNo,
                    VesselName: payload.VesselName,
                    ETA: payload.ETA ? new Date(payload.ETA) : null,
                    ETD: payload.ETD ? new Date(payload.ETD) : null,
                }
            })

            return {
                updatedMasterJob
            }
        } catch (error) {
            throw error;
        }
    }

    async deleteMasterJob(MasterJobSid: number) {
        try {
            // Do the soft delete in transaction give full code
            return await this._db.$transaction(async (prisma) => {
                const deletedMasterJob = await prisma.masterJob.update({
                    where: {
                        MasterJobSid: MasterJobSid
                    },
                    data: {
                        Status: "D"
                    }
                })
                const deletedVoyages = await prisma.masterJobVoyage.updateMany({
                    where: {
                        MasterJobSid: MasterJobSid,
                        Status: "A"
                    },
                    data: {
                        Status: "D"
                    }
                })
                const deletedConnections = await prisma.masterJobConnection.updateMany({
                    where: {
                        MasterJobSid: MasterJobSid,
                        Status: "A"
                    },
                    data: {
                        Status: "D"
                    }
                })
                const deletedContainers = await prisma.masterJobContainer.updateMany({
                    where: {
                        MasterJobSid: MasterJobSid,
                        Status: 'A'
                    },
                    data: {
                        Status: "D"
                    }
                })
                const deletedOthers = await prisma.masterJobOthers.updateMany({
                    where: {
                        MasterJobSid: MasterJobSid,
                        Status: 'A'
                    },
                    data: {
                        Status: "D"
                    }
                })
                const deletedCostRevenueCharges = await prisma.costRevenueCharges.updateMany({
                    where: {
                        TransactionSid: MasterJobSid,
                        ...(deletedMasterJob.MenuMasterSid && { MenuMasterSid: deletedMasterJob.MenuMasterSid }),
                        CompanyMasterSid: deletedMasterJob.CompanyMasterSid,
                        BranchMasterSid: deletedMasterJob.BranchMasterSid,
                        MasterJobNo: deletedMasterJob.MasterJobNumber,
                        status: "A"
                    },
                    data: {
                        status: "D"
                    }
                })
                const deletedActivities = await prisma.containerActivity.updateMany({
                    where: {
                        JobMasterSid: MasterJobSid
                    },
                    data: {
                        Status: "D"
                    }
                })
                return {
                    deletedMasterJob,
                    deletedVoyages,
                    deletedContainers,
                    deletedOthers,
                    deletedCostRevenueCharges,
                    deletedActivities
                }
            });
        } catch (error) {
            throw error;
        }
    }


    async searchMasterJobList(params: searchMasterJob) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId, departmentType } = params;
        const skip = (page - 1) * pageSize;

        const parsedDate = parseDateFromString(search);
        const isValidDate = parsedDate && !isNaN(parsedDate.getTime());
        const isNumeric = !isNaN(Number(search)) && search.trim() !== '';

        const where: Prisma.vMasterJobIndexPageWhereInput = {
            Status: 'A',
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            ...(search
                ? {
                    OR: [
                        { departmentName: { contains: search, mode: 'insensitive' } },
                        { MasterJobNumber: { contains: search, mode: 'insensitive' } },
                        { MBLNo: { contains: search, mode: 'insensitive' } },
                        { POL: { contains: search, mode: 'insensitive' } },
                        { POD: { contains: search, mode: 'insensitive' } },
                        { FDC: { contains: search, mode: 'insensitive' } },
                        
                        ...(isNumeric ? [
                            { NoOfHouses: { equals: Number(search) } },
                            { NoOfContainers: { equals: Number(search) } },
                        ] : []),

                        ...(isValidDate ? [
                            { MasterJobDate: { equals: parsedDate } },
                            { MBLDate: { equals: parsedDate } },
                        ] : []),
                    ],
                }
                : {}),
            ...(departmentType === "Air" ?
                { departmentType: departmentType } :
                { departmentType: { not: { equals: 'Air' } } }
            )
        };
        const [items, totalCount] = await this._db.$transaction([
            this._db.vMasterJobIndexPage.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { MasterJobSid: 'desc' },
            }),
            this._db.vMasterJobIndexPage.count({ where }),
        ]);
        return {
            items,
            totalCount,
        };
    }

    softDeleteMasterJobConnection(MasterJobConnectionSid: any) {
        try {
            return this._db.masterJobConnection.updateMany({
                where: {
                    MasterJobConnectionSid: MasterJobConnectionSid,
                    Status: "A"
                },
                data: {
                    Status: "D"
                }
            })
        } catch (error) {
            throw error;
        }
    }

    softDeleteMasterJobContainer(MasterJobContainerSid: any) {
        try {
            return this._db.masterJobContainer.updateMany({
                where: {
                    MasterJobContainerSid: MasterJobContainerSid,
                    Status: "A"
                },
                data: {
                    Status: "D"
                }
            })
        } catch (error) {
            throw error;
        }
    }

    async softDeleteContainerActivity(ContainerActivitySid: any) {
        try {
            return this._db.containerActivity.updateMany({
                where: {
                    ContainerActivitySid: ContainerActivitySid,
                    Status: "A"
                },
                data: {
                    Status: "D"
                }
            })
        } catch (error) {
            throw error;
        }
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

        async detachBookingFromMasterJob(HouseJobSid: number) {
        try {
            const result = await this._db.$transaction(async (tx) => {
                const detachedHouse = await tx.houseJob.update({
                    where: {
                        HouseJobSid: HouseJobSid
                    },
                    data: {
                        MasterJobSid: null,
                        HouseStatus : 'Stuffed'
                    },
                    include : {
                        bookingHeader : {
                            include : {
                                departmentMaster : true
                            }
                        }
                    }
                })
 
                let detachedBooking;
                let ourBooking = detachedHouse?.bookingHeader;
                if (ourBooking) {
                    const dept = ourBooking?.departmentMaster;
                    const isLCLExport = dept.FCLLCL === 'LCL' && dept.departmentType === "Sea" && dept.ExportImport === "Export";
                    detachedBooking = await tx.bookingHeader.update({
                        where: {
                            BookingHeaderSid: ourBooking.BookingHeaderSid
                        },
                        data: {
                            MasterNoSid: null,
                            MBLNo: null,
                            MBLDate: null,
                            BookingStatus: isLCLExport ? 'Cargo Received' : 'Booked',
                        }
                    })
                }
               
 
               
                return {
                    detachedBooking,
                    detachedHouse
                }
            })
           
        } catch (error) {
            throw error;
        }
    }
 


    async createHouseJobWithBooking(allBookingIds: number[]) {
        try {
            const allBooking = await this._db.bookingHeader.findMany({
                where: {
                    BookingHeaderSid: { in: allBookingIds }
                },
                include: {
                    bookingCargo: { where: { status: 'A' } },
                    bookingProduct: { where: { status: 'A' } },
                    bookingOthers: { where: { status: 'A' } },
                    bookingConnection: { where: { status: 'A' } },
                    bookingRates: { where: { Status: 'A' } }
                },
            });

            const dateString = moment().format('YYYYMMDD');
            let hblBaseCount = await this._db.houseJob.count({
                where: { HBLNo: { contains: dateString } },
            });
            let hblSerial = hblBaseCount;

            const allCreatedHouseJobs: any[] = [];

            for (const booking of allBooking) {
                const { bookingCargo, bookingProduct, bookingOthers, bookingConnection, bookingRates, ...bookingHeader } = booking;
                hblSerial += 1;
                const HBLNo = `HOUSE-${dateString}-${hblSerial.toString().padStart(3, '0')}`;

                const houseJobMenu = await this._db.menuConfig.findFirst({
                    where: {
                        ModelName: 'HouseJob'
                    }
                })
                if (!houseJobMenu) throw new Error('HouseJob Menu not found');

                // Step 1: Create main house job
                const houseJob = await this._db.houseJob.create({
                    data: {
                        MasterJobSid: null,
                        BookingHeaderSid: bookingHeader.BookingHeaderSid || null,
                        ColoadedBy: bookingHeader.NominatedBy,
                        BookingNo: bookingHeader.BookingNo || '',
                        BookingDateTime: bookingHeader.BookingDateTime,
                        CompanyMasterSid: bookingHeader.CompanyMasterSid,
                        BranchMasterSid: bookingHeader.BranchMasterSid!,
                        CustomerMasterSid: bookingHeader.CustomerMasterSid,
                        CustomerName: bookingHeader.CustomerName || '',
                        CustomerAddress: bookingHeader.CustomerAddress || '',
                        SalesmanSid: bookingHeader.SalesmanSid || null,
                        CargoExpectedon: bookingHeader.CargoExpectedon || null,
                        FreightTerms: bookingHeader.FreightTerms || '',
                        POO: bookingHeader.POO || '',
                        POL: bookingHeader.POL || '',
                        POD: bookingHeader.POD || '',
                        FPD: bookingHeader.FPD || '',
                        TsPortSid: bookingHeader.TsPortSid || null,
                        POLTerminal: bookingHeader.POLTerminal || '',
                        VoyageMasterSid: bookingHeader.VoyageMasterSid || null,
                        VesselName: bookingHeader.VesselName || '',
                        VoyageNo: bookingHeader.VoyageNo || '',
                        ETD: bookingHeader.ETD ? new Date(bookingHeader.ETD) : null,
                        ETA: bookingHeader.ETA ? new Date(bookingHeader.ETA) : null,
                        IncoTerms: bookingHeader.IncoTerms || '',
                        BLLocation: bookingHeader.BLLocation || null,
                        ShipperName: bookingHeader.ShipperName || '',
                        ShipperAddress: bookingHeader.ShipperAddress || '',
                        ConsigneeName: bookingHeader.ConsigneeName || '',
                        ConsigneeAddress: bookingHeader.ConsigneeAddress || '',
                        ClearanceRequire: bookingHeader.ClearanceRequire || '',
                        ShipmentType: bookingHeader.ShipmentType || '',
                        DestinationAgent: bookingHeader.DestinationAgent,
                        AgentName: bookingHeader.AgentName || '',
                        AgentAddress: bookingHeader.AgentAddress || '',
                        HouseNo: bookingHeader.HouseNo || '',
                        QuotationHeaderSid: bookingHeader.QuotationHeaderSid || null,
                        EnquiryHeaderSid: bookingHeader.EnquiryHeaderSid || null,
                        MovementType: bookingHeader.MovementType || '',
                        DoValid: bookingHeader.DoValid ? new Date(bookingHeader.DoValid) : null,
                        IsServiceJob: bookingHeader.IsServiceJob || '',
                        createdBy: bookingHeader.createdBy || '',
                        status: bookingHeader.status || '',
                        BookingStatus: bookingHeader.BookingStatus || '',
                        DepartmentMasterSid: bookingHeader.DepartmentMasterSid,
                        CustomerBranchSid: bookingHeader.CustomerBranchSid || null,
                        AuthorizerRemarks: bookingHeader.AuthorizerRemarks || '',
                        authorizerStatus: bookingHeader.authorizerStatus,
                        MenuMasterSid: houseJobMenu.MenuMasterSid,
                        CarrierSid: bookingHeader.CarrierSid || null,
                        CarrierName: bookingHeader.CarrierName || '',
                        Coload: bookingHeader.Coload || '',
                        GeneralNote: bookingHeader.GeneralNote || '',
                        HBLNo: HBLNo,
                        InternalNote: bookingHeader.InternalNote || '',
                        MBLDate: bookingHeader.MBLDate || null,
                        MBLNo: bookingHeader.MBLNo || '',
                        Nominated: bookingHeader.Nominated || '',
                        NominatedBy: bookingHeader.NominatedBy || '',
                        PODTerminal: bookingHeader.PODTerminal || '',
                        ShipmentNo: bookingHeader.ShipmentNo || '',
                        OriginAgent: bookingHeader.OriginAgent || ''
                    }
                }).catch(err => {
                    console.error('HouseJobCargo createMany error:', err);
                });

                if (!houseJob) continue;

                if (bookingCargo?.length) {
                    await this._db.houseJobCargo.createMany({
                        data: bookingCargo.map((cargo) => ({
                            HouseJobSid: houseJob.HouseJobSid,
                            CompanyMasterSid: houseJob.CompanyMasterSid,
                            BranchMasterSid: houseJob.BranchMasterSid!,
                            NoOfPackage: cargo.NoOfPackage || 0,
                            FreightAmount: cargo.FreightAmount,
                            CargoType: cargo.CargoType,
                            WeightUnitSid: cargo.WeightUnitSid || null,
                            GrossWeight: cargo.GrossWeight || 0,
                            NetWeight: cargo.NetWeight || 0,
                            Volume: cargo.Volume || 0,
                            ChargeableWeight: cargo.ChargeableWeight || 0,
                            MarksAndNumber: '',
                            CommodityDescription: '',
                            ContainerType: cargo.ContainerType,
                            PackageType: cargo.PackageType || null,
                            Qty: cargo.Qty || 0,
                            ShipmentTerms: cargo.ShipmentTerms || '',
                            createdBy: cargo.createdBy,
                            updatedBy: cargo.updatedBy || null,
                            status: 'A',
                            FreightTerms: cargo.FreightTerms || '',
                            MovementType: cargo.MovementType || '',
                            ModeOfTransport: cargo.ModeOfTransport || '',
                            NoofContainers: cargo.NoofContainers || 0,
                            StuffingAt: cargo.StuffingAt || '',
                        })
                        ),
                    }).catch(err => {
                        console.error('HouseJobCargo createMany error:', err);
                    });
                }

                if (bookingProduct?.length) {
                    await this._db.houseJobProduct.createMany({
                        data: bookingProduct.map((product) => ({
                            HouseJobSid: houseJob.HouseJobSid,
                            ProductName: product.ProductName || '',
                            ProductDescription: product.ProductDescription || '',
                            ShippingBillNo: product.ShippingBillNo || '',
                            ShippingBillDate: product.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
                            ExternaPkg: product.ExternaPkg || '',
                            ExternlQty: String(product.ExternlQty) || '',
                            GrossWeight: Number(product.GrossWeight) || 0,
                            NetWeight: Number(product.NetWeight) || 0,
                            Volume: Number(product.Volume) || 0,
                            CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                            CFS: product.CFS || '',
                            Height: product.Height || 0,
                            ImcoClass: product.ImcoClass || '',
                            IsHaz: product.IsHaz || 'N',
                            Length: product.Length || 0,
                            PkgGroup: product.PkgGroup || '',
                            UnNo: product.UnNo || '',
                            Width: product.Width || 0,
                            UomMasterSid: product.UomMasterSid || null,
                            MarksAndNumber: '',
                            createdBy: product.createdBy,
                        }))
                    }).catch(err => {
                        console.error('HouseJobProduct createMany error:', err);
                    });
                }

                if (bookingConnection?.length) {
                    await this._db.houseJobConnection.createMany({
                        data: bookingConnection.map((connection) => ({
                            HouseJobSid: houseJob.HouseJobSid,
                            Mode: connection.Mode,
                            POL: connection.POL,
                            POD: connection.POD,
                            VesselName: connection.VesselName,
                            VoyageNo: connection.VoyageNo,
                            ETD: connection.ETD ? new Date(connection.ETD) : null,
                            ETA: connection.ETA ? new Date(connection.ETA) : null,
                            Remarks: connection.Remarks || '',
                            status: 'A',
                            createdBy: connection.createdBy,
                            updatedBy: connection.updatedBy || null,
                        }))
                    }).catch(err => {
                        console.error('HouseJobConnection createMany error:', err);
                    });
                }

                if (bookingOthers?.[0]) {
                    const other = bookingOthers[0];
                    await this._db.houseJobOthers.create({
                        data: {
                            HouseJobSid: houseJob.HouseJobSid,
                            CustomerRefNo: other.CustomerRefNo,
                            OperationUser: other.OperationUser,
                            CarrierBookingRef: other.CarrierBookingRef || '',
                            CarrierBookingDate: other.CarrierBookingDate ? new Date(other.CarrierBookingDate) : null,
                            DocumentationUser: other.DocumentationUser,
                            CustomerServiceuser: other.CustomerServiceuser,
                            NotifyParty: other.NotifyParty,
                            NotifyPartyAddress: other.NotifyPartyAddress,
                            CHAName: other.CHAName,
                            PickupMode: other.PickupMode,
                            YardCFS: other.YardCFS,
                            LocalTransport: other.LocalTransport,
                            OverseasTransport: other.OverseasTransport,
                            OverseasClearance: other.OverseasClearance,
                            PickupPlace: other.PickupPlace,
                            PickupDate: other.PickupDate ? new Date(other.PickupDate) : null,
                            PickupAddress: other.PickupAddress,
                            DeliveryPlace: other.DeliveryPlace,
                            DeliveryDate: other.DeliveryDate,
                            DeliveryAddress: other.DeliveryAddress,
                            CargoCurrency: other.CargoCurrency,
                            CargoValue: other.CargoValue,
                            DeliveryMode: other.DeliveryMode,
                            ExternalRemarks: other.ExternalRemarks,
                            SwitchBL: other.SwitchBL,
                            TransporterName: other.TransporterName,
                            createdBy: other.createdBy || '',
                            status: 'A',
                            Forwarder: other.Forwarder || '',
                            ForwarderAddress: other.ForwarderAddress || '',
                            HBLNo: other.HBLNo || '',
                            BacktoBack: other.BacktoBack || '',
                            Depo: other.Depo || '',
                            ROValidity: other.ROValidity || '',
                            ReleaseType: other.ReleaseType || '',
                            AgentAddress: other.AgentAddress || '',
                            SwitchBLAgent: other.SwitchBLAgent || '',
                            SwitchBLConsignee: other.SwitchBLConsignee || '',
                            SwitchBLShipper: other.SwitchBLShipper || '',
                            SwitchLocation: other.SwitchLocation || '',
                            Coloader: other.Coloader || '',
                            Notify2: other.Notify2 || '',
                            NotifyAddress2: other.NotifyAddress2 || ''
                        }
                    }).catch(err => {
                        console.error('HouseJobOthers create error:', err);
                    });
                }


                const allRates = bookingRates || [];
                if (allRates.length > 0) {
                    await this._db.costRevenueCharges.createMany({
                        data: allRates.map(rate => ({
                            TransactionSid: houseJob.HouseJobSid,
                            MenuMasterSid: houseJobMenu.MenuMasterSid,
                            ShipmentNo: houseJob.ShipmentNo,
                            CompanyMasterSid: houseJob.CompanyMasterSid,
                            BranchMasterSid: houseJob.BranchMasterSid!,
                            createdBy: rate.CreatedBy,
                            status: "A",
                            Remarks: rate.Remarks,
                            SerialNumber: rate.SerialNumber,
                            ChargeMasterSid: rate.ChargeMasterSid,
                            ChargeDescription: rate.ChargeDescription,
                            ChargeUomSid: rate.ChargeUomSid,
                            CostPrepaidCollect: rate.CostPrepaidCollect,
                            CostCurrencyMasterSid: rate.CostCurrencyMasterSid,
                            CostExchangeRate: rate.CostExchangeRate,
                            CostRate: rate.CostRate,
                            CostNumberOfUnit: rate.CostNumberOfUnit,
                            CostDrCr: rate.CostDrCr,
                            CostAmount: rate.CostAmount,
                            CostLocalAmount: rate.CostLocalAmount,
                            CostAgentMasterSid: rate.AgentMasterSid,
                            CostAgentBranchSid: rate.AgentBranchSid,
                            RevenuePrepaidCollect: rate.RevenuePrepaidCollect,
                            RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid,
                            RevenueExchangeRate: rate.RevenueExchangeRate,
                            RevenueRate: rate.RevenueRate,
                            RevenueNumberOfUnit: rate.RevenueNumberOfUnit,
                            RevenueDrCr: rate.RevenueDrCr,
                            RevenueAmount: rate.RevenueAmount,
                            RevenueLocalAmount: rate.RevenueLocalAmount,
                            RevenueCustomerMasterSid: rate.CustomerMasterSid,
                            RevenueCustomerBranchSid: rate.CustomerBranchSid,
                            VoucherHeaderSid: rate.CostVoucherHeaderSid,
                            VoucherTypeSid: rate.CostVoucherTypeMasterSid,
                            RevenueChargeUomSid: rate.RevenueChargeUomSid!,
                            CostChargeUomSid: rate.CostChargeUomSid!,
                        }))
                    }).catch(err => {
                        console.error('HouseJobRates createMany error:', err);
                    });
                }


                await this._db.bookingHeader.update({
                    where: { BookingHeaderSid: bookingHeader.BookingHeaderSid },
                    data: {
                        HouseNo: houseJob.HBLNo
                    },
                }).catch(err => {
                    console.error('bookingHeader update error:', err);
                });

                allCreatedHouseJobs.push({
                    HouseJobSid: houseJob.HouseJobSid,
                    BookingHeaderSid: houseJob.BookingHeaderSid,
                    BookingNo: houseJob.BookingNo,
                    BookingDateTime: houseJob.BookingDateTime,
                    CustomerName: houseJob.CustomerName,
                    CustomerAddress: houseJob.CustomerAddress,
                    ShipperName: houseJob.ShipperName,
                    ShipperAddress: houseJob.ShipperAddress,
                    ConsigneeName: houseJob.ConsigneeName,
                    ConsigneeAddress: houseJob.ConsigneeAddress,
                    DestinationAgent: houseJob.DestinationAgent,
                    MBLDate: houseJob.MBLDate,
                    MasterJobSid: houseJob.MasterJobSid,
                    POL: houseJob.POL,
                    POD: houseJob.POD,
                    FreightTerms: houseJob.FreightTerms,
                });
           if (houseJob.MasterJobSid) {
                await this.updateMasterJobTotals(houseJob.MasterJobSid);
            }
              
            }
            return allCreatedHouseJobs
        } catch (error) {
            throw error;
        }
    }
private async updateMasterJobTotals(masterJobSid: number): Promise<void> {
  try {
    // Get all containers for this master job
    const allContainers = await this._db.masterJobContainer.findMany({
      where: {
        MasterJobSid: masterJobSid,
        Status: 'A'
      }
    });
    
    // Calculate totals from containers
    let totalGrossWeight = 0;
    let totalNetWeight = 0;
    let totalVolume = 0;
    
    allContainers.forEach(container => {
      totalGrossWeight += Number(container.GrossWeight) || 0;
      totalNetWeight += Number(container.NetWeight) || 0;
      totalVolume += Number(container.Volume) || 0;
    });
    
    // Update master job with container totals
    await this._db.masterJob.update({
      where: { MasterJobSid: masterJobSid },
      data: {
        GrossWeight: parseFloat(totalGrossWeight.toFixed(3)),
        NetWeight: parseFloat(totalNetWeight.toFixed(3)),
        Volume: parseFloat(totalVolume.toFixed(3)),
      }
    });
  } catch (error) {
    console.error('Error updating master job totals:', error);
    throw error;
  }
}
    /**
     * Process bulk upload from Excel file
     */
    async processBulkUpload(
        masterJobData: any,
        houseJobsData: any[],
        companyMasterSid: number,
        branchMasterSid: number,
        createdBy: string,
        containers?: any[],
        voyages?: any[],
        connections?: any[],
        others?: any
    ) {
        try {
            // Perform lookups before transaction
            // 1. Lookup Department by name
            if (masterJobData.Department) {
                const department = await this.lookupDepartmentByName(masterJobData.Department, companyMasterSid);
                if (department) {
                    masterJobData.DepartmentMasterSid = department.DepartmentMasterSid;
                }
            }

            // 2. Lookup Destination Agent by name
            if (masterJobData.DestinationAgentName) {
                const destinationAgent = await this.lookupCustomerByName(masterJobData.DestinationAgentName, companyMasterSid);
                if (destinationAgent) {
                    masterJobData.DestinationAgent = destinationAgent.CustomerMasterSid;
                }
            }

            // 3. Lookup customers/shippers/agents for each house job
            for (const houseJob of houseJobsData) {
                // Lookup Customer
                if (houseJob.CustomerName) {
                    const customer = await this.lookupCustomerByName(houseJob.CustomerName, companyMasterSid);
                    if (customer) {
                        houseJob.CustomerMasterSid = customer.CustomerMasterSid;
                    }
                }

                // Lookup Shipper (in customer table)
                if (houseJob.ShipperName) {
                    const shipper = await this.lookupCustomerByName(houseJob.ShipperName, companyMasterSid);
                    if (shipper) {
                        houseJob.ShipperSid = shipper.CustomerMasterSid;
                    }
                }

                // Lookup Consignee (in customer table)
                if (houseJob.ConsigneeName) {
                    const consignee = await this.lookupCustomerByName(houseJob.ConsigneeName, companyMasterSid);
                    if (consignee) {
                        houseJob.ConsigneeSid = consignee.CustomerMasterSid;
                    }
                }

                // Lookup Agent
                if (houseJob.AgentName) {
                    const agent = await this.lookupCustomerByName(houseJob.AgentName, companyMasterSid);
                    if (agent) {
                        houseJob.DestinationAgent = agent.CustomerMasterSid;
                    }
                }
            }

            // Check for duplicate MBL Number
            if (masterJobData.MBLNo) {
                const isDuplicate = await this.checkDuplicateMBLNumber(
                    masterJobData.MBLNo,
                    companyMasterSid
                );

                if (isDuplicate) {
                    return {
                        status: false,
                        message: `MBL Number '${masterJobData.MBLNo}' already exists. Please use a unique MBL Number.`,
                        data: null
                    };
                }
            }

            const result = await this._db.$transaction(async (prisma) => {
                // Helper function to parse date strings to Date objects
                const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
};

                // Generate Master Job Number
                const dateString = moment().format('YYYYMMDD');
                const count = await prisma.masterJob.count({
                    where: { MasterJobNumber: { contains: dateString } }
                });
                const masterJobNumber = `MASTER-${dateString}-${(count + 1).toString().padStart(3, '0')}`;

                // Helper function to parse numeric values
                const parseNumeric = (value: any): number | undefined => {
                    if (value === null || value === undefined || value === '') return undefined;
                    const num = Number(value);
                    return isNaN(num) ? undefined : num;
                };

                const parseInteger = (value: any): number | undefined => {
                    if (value === null || value === undefined || value === '') return undefined;
                    const num = parseInt(value, 10);
                    return isNaN(num) ? undefined : num;
                };

                // Create Master Job
                const masterJobPayload = {
                    MasterJobNumber: masterJobNumber,
                    MasterJobDate: parseDate(masterJobData.MasterJobDate) || new Date(),
                    CreatedBy: createdBy,
                    Status: 'A',
                    CompanyMasterSid: companyMasterSid,
                    BranchMasterSid: branchMasterSid,
                    DepartmentMasterSid: masterJobData.DepartmentMasterSid,
                    FreightPPCC: masterJobData.FreightPPCC || 'Prepaid',
                    DestinationAgent: masterJobData.DestinationAgent,
                    DestinationAgentName: masterJobData.DestinationAgentName,
                    DestinationAgentAddress: masterJobData.DestinationAgentAddress?.substring(0, 300) || '',
                    MBLNo: masterJobData.MBLNo || masterJobNumber,
                    MBLDate: parseDate(masterJobData.MBLDate) || new Date(),
                    BLReleaseType: masterJobData.BLReleaseType,
                    NoofOriginal: masterJobData.NoofOriginal || 3,
                    OriginAgent: masterJobData.OriginAgent,
                    POO: masterJobData.POO || '',
                    POL: masterJobData.POL,
                    POD: masterJobData.POD,
                    FPD: masterJobData.FPD || '',
                    POLTerminal: masterJobData.POLTerminal?.substring(0, 100) || '',
                    PODTerminal: masterJobData.PODTerminal?.substring(0, 100) || '',
                    MovementType: masterJobData.MovementType,
                    ShipmentTerms: masterJobData.ShipmentTerms,
                    PkgType: parseInteger(masterJobData.PkgType),
                    NoOfPkg: parseInteger(masterJobData.NoOfPkg),
                    WeightIn: masterJobData.WeightIn,
                    GrossWeight: parseNumeric(masterJobData.GrossWeight),
                    NetWeight: parseNumeric(masterJobData.NetWeight),
                    ChargeableWeight: parseNumeric(masterJobData.ChargeableWeight),
                    Volume: parseNumeric(masterJobData.Volume),
                    Haz: masterJobData.Haz,
                    JobStatus: masterJobData.JobStatus,
                    DGBookingDate: parseDate(masterJobData.DGBookingDate),
                    DGApprovedDate: parseDate(masterJobData.DGApprovedDate),
                    SiCutoffDate: parseDate(masterJobData.SiCutoffDate),
                    PortCutoffDate: parseDate(masterJobData.PortCutoffDate),
                    CommodityDescription: masterJobData.CommodityDescription|| '',
                    MarksandNumber: masterJobData.MarksandNumber|| '',
                    MenuMasterSid: masterJobData.MenuMasterSid,
                    TsPortSid: masterJobData.TsPortSid,
                };

                const createdMasterJob = await prisma.masterJob.create({
                    data: masterJobPayload
                });

                // Create Master Job Voyages
                if (voyages && voyages.length > 0) {
                    for (const voyage of voyages) {
                        await prisma.masterJobVoyage.create({
                            data: {
                                MasterJobSid: createdMasterJob.MasterJobSid,
                                VoyageMasterSid: voyage.VoyageMasterSid,
                                VesselName: voyage.VesselName,
                                VoyageNo: voyage.VoyageNo,
                                ETD: parseDate(voyage.ETD),
                                ETA: parseDate(voyage.ETA),
                                ATA: parseDate(voyage.ATA),
                                ATD: parseDate(voyage.ATD),
                                DestinationATA: parseDate(voyage.DestinationATA),
                                CarrierSid: voyage.CarrierSid,
                                CarrierName: voyage.CarrierName,
                                Status: 'A'
                            }
                        });
                    }
                }

                // Create Master Job Containers
                if (containers && containers.length > 0) {
                    for (const container of containers) {
                        await prisma.masterJobContainer.create({
                            data: {
                                MasterJobSid: createdMasterJob.MasterJobSid,
                                ContainerType: container.ContainerType,
                                ContainerNumber: container.ContainerNumber,
                                LineSeal: container.LineSeal,
                                CustomsSeal: container.CustomsSeal,
                                HsCode: container.HsCode,
                                CommodityDescription: container.CommodityDescription,
                                PkgType: container.PkgType,
                                NoOfPkg: container.NoOfPkg,
                                GrossWeight: container.GrossWeight,
                                NetWeight: container.NetWeight,
                                ChargeableWeight: container.ChargeableWeight,
                                Volume: container.Volume,
                                IsSoc: container.IsSoc,
                                CreatedBy: createdBy,
                                Status: 'A'
                            }
                        });
                    }
                }

                // Create Master Job Connections
                if (connections && connections.length > 0) {
                    for (const connection of connections) {
                        await prisma.masterJobConnection.create({
                            data: {
                                MasterJobSid: createdMasterJob.MasterJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: parseDate(connection.ETD),
                                ETA: parseDate(connection.ETA),
                                ATD: parseDate(connection.ATD),
                                ATA: parseDate(connection.ATA),
                                Remarks: connection.Remarks,
                                Status: 'A',
                                CreatedBy: createdBy,
                                CreatedOn: new Date()
                            }
                        });
                    }
                }

                // Create Master Job Others
                if (others) {
                    await prisma.masterJobOthers.create({
                        data: {
                            MasterJobSid: createdMasterJob.MasterJobSid,
                            CreatedBy: createdBy,
                            Status: 'A',
                            Yard: others.Yard,
                            YardAddress: others.YardAddress,
                            Transporter: others.Transporter,
                            HandlingInformation: others.HandlingInformation,
                            InternalNote: others.InternalNote,
                            CFS: others.CFS,
                            CFSAddress: others.CFSAddress,
                            CarrierRef: others.CarrierRef,
                            AgentRef: others.AgentRef,
                            StuffingStartDate: parseDate(others.StuffingStartDate),
                            StuffingEndDate: parseDate(others.StuffingEndDate),
                            CurrencyCode: others.CurrencyCode,
                            SellExchangeRate: others.SellExchangeRate,
                            AgentExchangeRate: others.AgentExchangeRate,
                            Coload: others.Coload,
                            CoLoader: others.CoLoader,
                            ExportDoNo: others.ExportDoNo
                        }
                    });
                }

                // Lookup HouseJob Menu
                const houseJobMenu = await prisma.menuConfig.findFirst({
                    where: {
                        ModelName: 'HouseJob'
                    }
                });
                if (!houseJobMenu) {
                    throw new Error('HouseJob Menu not found in menu configuration');
                }

                // Create House Jobs
                const createdHouseJobs: Array<{ HouseJobSid: number; BookingNo: string; HBLNo: string | null }> = [];

                for (let i = 0; i < houseJobsData.length; i++) {
                    const houseJobData = houseJobsData[i];

                    // Generate House Job/Booking Number
                    const houseJobCount = await prisma.houseJob.count({
                        where: { BookingNo: { contains: dateString } }
                    });
                    const bookingNo = `HJ-${dateString}-${(houseJobCount + i + 1).toString().padStart(3, '0')}`;

                    // Create House Job
                    const houseJobPayload = {
                        MasterJobSid: createdMasterJob.MasterJobSid,
                        CompanyMasterSid: companyMasterSid,
                        BranchMasterSid: branchMasterSid,
                        DepartmentMasterSid: masterJobData.DepartmentMasterSid,
                        ShipmentNo: houseJobData.ShipmentNo,
                        BookingNo: bookingNo,
                        HBLNo: houseJobData.HBLNo || bookingNo,
                        CustomerMasterSid: houseJobData.CustomerMasterSid,
                        CustomerName: houseJobData.CustomerName,
                        CustomerAddress: houseJobData.CustomerAddress,
                        IncoTerms: houseJobData.IncoTerms,
                        DestinationAgent: houseJobData.DestinationAgent,
                        AgentName: houseJobData.AgentName,
                        AgentAddress: houseJobData.AgentAddress,
                        ShipperName: houseJobData.ShipperName,
                        ShipperAddress: houseJobData.ShipperAddress,
                        ConsigneeName: houseJobData.ConsigneeName,
                        ConsigneeAddress: houseJobData.ConsigneeAddress,
                        ShipmentType: houseJobData.ShipmentType,
                        NominatedBy: houseJobData.NominatedBy,
                        POL: houseJobData.POL,
                        POD: houseJobData.POD,
                        FPD: houseJobData.FPD,
                        POO: houseJobData.POO,
                        ETD: parseDate(houseJobData.ETD),
                        ETA: parseDate(houseJobData.ETA),
                        MovementType: houseJobData.MovementType,
                        Notify: houseJobData.Notify,
                        NotifyAddress: houseJobData.NotifyAddress,
                        createdBy: createdBy,
                        status: 'A',
                        createdOn: new Date(),
                        MenuMasterSid: houseJobMenu.MenuMasterSid,
                        CustomerBranchSid: houseJobData.CustomerBranchSid
                    };

                    const createdHouseJob = await prisma.houseJob.create({
                        data: houseJobPayload
                    });

                    // Create House Job Cargo
                    if (houseJobData.cargo && houseJobData.cargo.length > 0) {
                        for (const cargo of houseJobData.cargo) {
                            await prisma.houseJobCargo.create({
                                data: {
                                    HouseJobSid: createdHouseJob.HouseJobSid,
                                    CompanyMasterSid: companyMasterSid,
                                    BranchMasterSid: branchMasterSid,
                                    CargoType: cargo.CargoType,
                                    ContainerType: cargo.ContainerType,
                                    GrossWeight: cargo.GrossWeight,
                                    NetWeight: cargo.NetWeight,
                                    Volume: cargo.Volume,
                                    ChargeableWeight: cargo.ChargeableWeight,
                                    PackageType: cargo.PackageType,
                                    NoOfPackage: cargo.NoOfPackage,
                                    FreightAmount: cargo.FreightAmount,
                                    ShipmentTerms: cargo.ShipmentTerms,
                                    FreightTerms: cargo.FreightTerms,
                                    ModeOfTransport: cargo.ModeOfTransport,
                                    MovementType: cargo.MovementType,
                                    NoofContainers: cargo.NoofContainers,
                                    Qty: cargo.Qty,
                                    StuffingAt: cargo.StuffingAt,
                                    CommodityDescription: cargo.CommodityDescription,
                                    MarksAndNumber: cargo.MarksAndNumber,
                                    createdBy: createdBy,
                                    status: 'A'
                                }
                            });
                        }
                    }

                    // Create House Job Products
                    if (houseJobData.products && houseJobData.products.length > 0) {
                        for (const product of houseJobData.products) {
                            await prisma.houseJobProduct.create({
                                data: {
                                    HouseJobSid: createdHouseJob.HouseJobSid,
                                    ProductName: product.ProductName,
                                    ProductDescription: product.ProductDescription,
                                    ShippingBillNo: product.ShippingBillNo,
                                    ShippingBillDate: product.ShippingBillDate,
                                    ExternaPkg: product.ExternaPkg,
                                    ExternlQty: product.ExternlQty,
                                    InternalPkg: product.InternalPkg,
                                    InternalQty: product.InternalQty,
                                    GrossWeight: product.GrossWeight,
                                    NetWeight: product.NetWeight,
                                    Volume: product.Volume,
                                    Height: product.Height,
                                    ImcoClass: product.ImcoClass,
                                    IsHaz: product.IsHaz,
                                    Length: product.Length,
                                    PkgGroup: product.PkgGroup,
                                    UnNo: product.UnNo,
                                    Width: product.Width,
                                    MarksAndNumber: product.MarksAndNumber,
                                    ContainerNo: product.ContainerNo,
                                    createdBy: createdBy,
                                    status: 'A'
                                }
                            });
                        }
                    }

                    // Create House Job Connections
                    if (houseJobData.connections && houseJobData.connections.length > 0) {
                        for (const connection of houseJobData.connections) {
                            await prisma.houseJobConnection.create({
                                data: {
                                    HouseJobSid: createdHouseJob.HouseJobSid,
                                    Mode: connection.Mode,
                                    POL: connection.POL,
                                    POD: connection.POD,
                                    VesselName: connection.VesselName,
                                    VoyageNo: connection.VoyageNo,
                                    ETD: connection.ETD,
                                    ETA: connection.ETA,
                                    Remarks: connection.Remarks,
                                    createdBy: createdBy,
                                    status: 'A'
                                }
                            });
                        }
                    }

                    // Create House Job Others
                    if (houseJobData.others) {
                        await prisma.houseJobOthers.create({
                            data: {
                                HouseJobSid: createdHouseJob.HouseJobSid,
                                CustomerRefNo: houseJobData.others.CustomerRefNo,
                                OperationUser: houseJobData.others.OperationUser,
                                DocumentationUser: houseJobData.others.DocumentationUser,
                                CustomerServiceuser: houseJobData.others.CustomerServiceuser,
                                NotifyParty: houseJobData.others.NotifyParty,
                                NotifyPartyAddress: houseJobData.others.NotifyPartyAddress,
                                CHAName: houseJobData.others.CHAName,
                                PickupMode: houseJobData.others.PickupMode,
                                YardCFS: houseJobData.others.YardCFS,
                                LocalTransport: houseJobData.others.LocalTransport,
                                OverseasTransport: houseJobData.others.OverseasTransport,
                                OverseasClearance: houseJobData.others.OverseasClearance,
                                PickupPlace: houseJobData.others.PickupPlace,
                                PickupDate: houseJobData.others.PickupDate,
                                PickupAddress: houseJobData.others.PickupAddress,
                                DeliveryPlace: houseJobData.others.DeliveryPlace,
                                DeliveryDate: houseJobData.others.DeliveryDate,
                                DeliveryAddress: houseJobData.others.DeliveryAddress,
                                CargoCurrency: houseJobData.others.CargoCurrency,
                                CargoValue: houseJobData.others.CargoValue,
                                DeliveryMode: houseJobData.others.DeliveryMode,
                                ExternalRemarks: houseJobData.others.ExternalRemarks,
                                SwitchBL: houseJobData.others.SwitchBL,
                                TransporterName: houseJobData.others.TransporterName,
                                Forwarder: houseJobData.others.Forwarder,
                                ForwarderAddress: houseJobData.others.ForwarderAddress,
                                Coloader: houseJobData.others.Coloader,
                                createdBy: createdBy,
                                status: 'A'
                            }
                        });
                    }

                    createdHouseJobs.push({
                        HouseJobSid: createdHouseJob.HouseJobSid,
                        BookingNo: createdHouseJob.BookingNo,
                        HBLNo: createdHouseJob.HBLNo
                    });
                }

                return {
                    masterJobSid: createdMasterJob.MasterJobSid,
                    masterJobNumber: createdMasterJob.MasterJobNumber,
                    houseJobs: createdHouseJobs
                };
            });

            return result;
        } catch (error) {
            this.logger.error(`Error processing bulk upload: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Validate bulk upload data
     */
    async validateBulkUploadData(
        masterJobData: any,
        houseJobsData: any[],
        companyMasterSid?: number,
        containers?: any[],
        voyages?: any[],
        connections?: any[],
        others?: any
    ) {
        const errors: any[] = [];

        // Validate Master Job required fields
        // 1. Validate Department
        if (!masterJobData.Department) {
            errors.push({
                field: 'Department',
                message: 'Department is required',
                sheet: 'Master Job',
                row: 2
            });
        } else if (companyMasterSid) {
            const department = await this.lookupDepartmentByName(masterJobData.Department, companyMasterSid);
            if (!department) {
                errors.push({
                    field: 'Department',
                    message: `Department '${masterJobData.Department}' not found in master data`,
                    sheet: 'Master Job',
                    row: 2
                });
            }
        }

        // 2. Validate Port Codes
        if (!masterJobData.POL) {
            errors.push({
                field: 'POL (Port Code)',
                message: 'Port of Loading is required',
                sheet: 'Master Job',
                row: 2
            });
        } else {
            const port = await this.lookupPortByCode(masterJobData.POL);
            if (!port) {
                errors.push({
                    field: 'POL (Port Code)',
                    message: `Port code '${masterJobData.POL}' not found in master data`,
                    sheet: 'Master Job',
                    row: 2
                });
            }
        }

        if (!masterJobData.POD) {
            errors.push({
                field: 'POD (Port Code)',
                message: 'Port of Discharge is required',
                sheet: 'Master Job',
                row: 2
            });
        } else {
            const port = await this.lookupPortByCode(masterJobData.POD);
            if (!port) {
                errors.push({
                    field: 'POD (Port Code)',
                    message: `Port code '${masterJobData.POD}' not found in master data`,
                    sheet: 'Master Job',
                    row: 2
                });
            }
        }

        // Validate POO and FPD if provided
        if (masterJobData.POO) {
            const port = await this.lookupPortByCode(masterJobData.POO);
            if (!port) {
                errors.push({
                    field: 'POO (Port Code)',
                    message: `Port code '${masterJobData.POO}' not found in master data`,
                    sheet: 'Master Job',
                    row: 2
                });
            }
        }

        if (masterJobData.FPD) {
            const port = await this.lookupPortByCode(masterJobData.FPD);
            if (!port) {
                errors.push({
                    field: 'FPD (Port Code)',
                    message: `Port code '${masterJobData.FPD}' not found in master data`,
                    sheet: 'Master Job',
                    row: 2
                });
            }
        }

        // 3. Validate Destination Agent if provided
        if (masterJobData.DestinationAgentName && companyMasterSid) {
            const agent = await this.lookupCustomerByName(masterJobData.DestinationAgentName, companyMasterSid);
            // if (!agent) {
            //     errors.push({
            //         field: 'Destination Agent Name',
            //         message: `Destination agent '${masterJobData.DestinationAgentName}' not found in customer master`,
            //         sheet: 'Master Job',
            //         row: 2
            //     });
            // }
        }

        // Validate House Jobs
        if (!houseJobsData || houseJobsData.length === 0) {
            errors.push({
                field: 'HouseJobs',
                message: 'At least one House Job is required',
                sheet: 'House Jobs'
            });
        } else {
            for (let i = 0; i < houseJobsData.length; i++) {
                const houseJob = houseJobsData[i];
                const rowNum = i + 2;

                // Validate Customer Name
                // if (!houseJob.CustomerName) {
                //     errors.push({
                //         field: 'Customer Name',
                //         message: 'Customer Name is required',
                //         sheet: 'House Jobs',
                //         row: rowNum
                //     });
                // } else if (companyMasterSid) {
                //     const customer = await this.lookupCustomerByName(houseJob.CustomerName, companyMasterSid);
                //     if (!customer) {
                //         errors.push({
                //             field: 'Customer Name',
                //             message: `Customer '${houseJob.CustomerName}' not found in customer master`,
                //             sheet: 'House Jobs',
                //             row: rowNum
                //         });
                //     }
                // }

                // Validate Shipper Name if provided
                // if (houseJob.ShipperName && companyMasterSid) {
                //     const shipper = await this.lookupCustomerByName(houseJob.ShipperName, companyMasterSid);
                //     if (!shipper) {
                //         errors.push({
                //             field: 'Shipper Name',
                //             message: `Shipper '${houseJob.ShipperName}' not found in customer master`,
                //             sheet: 'House Jobs',
                //             row: rowNum
                //         });
                //     }
                // }

                // Validate Consignee Name if provided
                // if (houseJob.ConsigneeName && companyMasterSid) {
                //     const consignee = await this.lookupCustomerByName(houseJob.ConsigneeName, companyMasterSid);
                //     if (!consignee) {
                //         errors.push({
                //             field: 'Consignee Name',
                //             message: `Consignee '${houseJob.ConsigneeName}' not found in customer master`,
                //             sheet: 'House Jobs',
                //             row: rowNum
                //         });
                //     }
                // }

                // Validate Agent Name if provided
                // if (houseJob.AgentName && companyMasterSid) {
                //     const agent = await this.lookupCustomerByName(houseJob.AgentName, companyMasterSid);
                //     if (!agent) {
                //         errors.push({
                //             field: 'Agent Name',
                //             message: `Agent '${houseJob.AgentName}' not found in customer master`,
                //             sheet: 'House Jobs',
                //             row: rowNum
                //         });
                //     }
                // }

                // Validate Port Codes
                // if (!houseJob.POL) {
                //     errors.push({
                //         field: 'POL (Port Code)',
                //         message: 'Port of Loading is required',
                //         sheet: 'House Jobs',
                //         row: rowNum
                //     });
                // } else {
                //     const port = await this.lookupPortByCode(houseJob.POL);
                //     if (!port) {
                //         errors.push({
                //             field: 'POL (Port Code)',
                //             message: `Port code '${houseJob.POL}' not found in master data`,
                //             sheet: 'House Jobs',
                //             row: rowNum
                //         });
                //     }
                // }

                // if (!houseJob.POD) {
                //     errors.push({
                //         field: 'POD (Port Code)',
                //         message: 'Port of Discharge is required',
                //         sheet: 'House Jobs',
                //         row: rowNum
                //     });
                // } else {
                //     const port = await this.lookupPortByCode(houseJob.POD);
                //     if (!port) {
                //         errors.push({
                //             field: 'POD (Port Code)',
                //             message: `Port code '${houseJob.POD}' not found in master data`,
                //             sheet: 'House Jobs',
                //             row: rowNum
                //         });
                //     }
                // }

                // Validate POO and FPD if provided
                // if (houseJob.POO) {
                //     const port = await this.lookupPortByCode(houseJob.POO);
                //     if (!port) {
                //         errors.push({
                //             field: 'POO (Port Code)',
                //             message: `Port code '${houseJob.POO}' not found in master data`,
                //             sheet: 'House Jobs',
                //             row: rowNum
                //         });
                //     }
                // }

                // if (houseJob.FPD) {
                //     const port = await this.lookupPortByCode(houseJob.FPD);
                //     if (!port) {
                //         errors.push({
                //             field: 'FPD (Port Code)',
                //             message: `Port code '${houseJob.FPD}' not found in master data`,
                //             sheet: 'House Jobs',
                //             row: rowNum
                //         });
                //     }
                // }
            }
        }

        return errors;
    }

    /**
     * Lookup Department by name (case-insensitive)
     */
    async lookupDepartmentByName(departmentName: string, companyMasterSid: number): Promise<any> {
        if (!departmentName) {
            return null;
        }

        const department = await this._db.departmentMaster.findFirst({
            where: {
                departmentName: {
                    equals: departmentName.trim(),
                    mode: 'insensitive'
                },
                CompanyMasterSid: companyMasterSid,
                Status: 'A'
            }
        });

        return department;
    }

    /**
     * Lookup Port by port code
     */
    async lookupPortByCode(portCode: string): Promise<any> {
        if (!portCode) {
            return null;
        }

        const port = await this._db.portMaster.findFirst({
            where: {
                PortCode: {
                    equals: portCode.trim(),
                    mode: 'insensitive'
                },
                status: 'A'
            }
        });

        return port;
    }

    /**
     * Lookup Customer by name (case-insensitive)
     */
    async lookupCustomerByName(customerName: string, companyMasterSid: number): Promise<any> {
        if (!customerName) {
            return null;
        }

        const customer = await this._db.customerMaster.findFirst({
            where: {
                CustomerName: {
                    equals: customerName.trim(),
                    mode: 'insensitive'
                },
                CompanyMasterSid: companyMasterSid,
                status: 'A'
            }
        });

        return customer;
    }

    /**
     * Check if MBL Number already exists for the company
     */
    async checkDuplicateMBLNumber(mblNo: string, companyMasterSid: number): Promise<boolean> {
        if (!mblNo) {
            return false;
        }

        const existing = await this._db.masterJob.findFirst({
            where: {
                MBLNo: {
                    equals: mblNo.trim(),
                    mode: 'insensitive'
                },
                CompanyMasterSid: companyMasterSid,
                Status: 'A'  // Only check active records
            }
        });

        return !!existing;
    }

    /**
     * Get report data for a specific report type
     * Used by the generic report system
     */
    async getReportData(masterJobSid: number, reportType: string): Promise<any> {
        const masterJob = await this._db.masterJob.findUnique({
            where: { MasterJobSid: masterJobSid },
            include: {
                CompanyMaster: true,
                BranchMaster: true,
                containers: {
                    where: { Status: 'A' },
                    include: {
                        UOMMaster: true,
                    },
                },
                houseJob: {
                    where: { status: 'A' },
                    include: {
                        Cargo: true,
                    },
                },
                voyages: {
                    include: {
                        voyageMasterHeader: true,
                    },
                },
                others: true,
            },
        });

        if (!masterJob) {
            throw new NotFoundException(`Master Job with ID ${masterJobSid} not found`);
        }

        // Get the first voyage for vessel/ETD/ETA details
        const primaryVoyage = masterJob.voyages && masterJob.voyages.length > 0 ? masterJob.voyages[0] : null;

        // Fetch container type data for all containers
        const containerTypeIds = [...new Set(masterJob.containers?.map(c => c.ContainerType!).filter(Boolean) || [])];
        const containerTypes = containerTypeIds.length > 0
            ? await this._db.containerTypeMaster.findMany({
                where: { ContainerTypeMasterSid: { in: containerTypeIds } }
            })
            : [];
        const containerTypeMap = new Map(containerTypes.map(ct => [ct.ContainerTypeMasterSid, ct]));

        // Format data based on report type
        const baseData = {
            company: {
                name: masterJob.CompanyMaster?.companyName || '',
                branchName: masterJob.BranchMaster?.branchName || '',
                address: masterJob.BranchMaster?.addressLine1 || masterJob.CompanyMaster?.addressLine1 || '',
                addressLine2: masterJob.BranchMaster?.addressLine2 || masterJob.CompanyMaster?.addressLine2 || '',
                city: '', // City is in CityMaster relation, not directly in CompanyMaster
                state: '', // State is in StateMaster relation, not directly in CompanyMaster
                postalCode: masterJob.BranchMaster?.postalCode || masterJob.CompanyMaster?.postal_code || '',
                country: '', // Country is in CountryMaster relation, not directly in CompanyMaster
                logoUrl: masterJob.BranchMaster?.companyLogo || masterJob.BranchMaster?.reportLogo || masterJob.CompanyMaster?.companyLogo || masterJob.CompanyMaster?.reportLogo || '',
                phone: masterJob.BranchMaster?.phoneNumber || masterJob.CompanyMaster?.phoneNumber || '',
                email: masterJob.BranchMaster?.email || masterJob.CompanyMaster?.email || '',
                website: masterJob.BranchMaster?.webSite || masterJob.CompanyMaster?.webSite || '',
                gst: masterJob.BranchMaster?.taxRegistrationNo || '',
                pan: masterJob.CompanyMaster?.Pan || '',
            },
            masterJob: {
                jobNumber: masterJob.MasterJobNumber || '',
                jobDate: masterJob.MasterJobDate,
                mblNumber: masterJob.MBLNo || '',
                mblDate: masterJob.MBLDate,
                destinationAgent: masterJob.DestinationAgent,
                destinationAgentName: masterJob.DestinationAgentName || '',
                destinationAgentAddress: masterJob.DestinationAgentAddress || '',
                customerName: '', // MasterJob has no customer relation - this is stored elsewhere
                shipperName: '', // MasterJob has no shipper relation - stored as string if needed
                consigneeName: '', // MasterJob has no consignee relation - stored as string if needed
                vesselName: primaryVoyage?.VesselName || '',
                voyageNumber: primaryVoyage?.VoyageNo || '',
                pol: masterJob.POL || '',
                pod: masterJob.POD || '',
                poo: masterJob.POO || '',
                finalDestination: masterJob.FPD || '',
                etd: primaryVoyage?.ETD || primaryVoyage?.voyageMasterHeader?.ETD,
                eta: primaryVoyage?.ETA || primaryVoyage?.voyageMasterHeader?.ETA,
                siCutoffDate: masterJob.SiCutoffDate || null,
                portCutoffDate: masterJob.PortCutoffDate || null,
                jobStatus: masterJob.JobStatus ,
                commodity: masterJob.CommodityDescription || '',
                serviceType: masterJob.MovementType || 'FCL',
                totalPackages: masterJob.NoOfPkg || 0,
                grossWeight: masterJob.GrossWeight || 0,
                netWeight: masterJob.NetWeight || 0,
                volume: masterJob.Volume || 0,
                remarks: '',
                freightTerms: masterJob.FreightPPCC || '',
            },
            containers: (masterJob.containers || []).map((c: any) => {
                const containerTypeMaster = containerTypeMap.get(c.ContainerType);
                return {
                    containerNumber: c.ContainerNumber || '',
                    containerType: containerTypeMaster?.ContainerSize || containerTypeMaster?.ContainerName || '',
                    sealNumber: c.LineSeal || c.CustomsSeal || '',
                    weight: c.GrossWeight || 0,
                    cbm: c.Volume || 0,
                    packages: c.NoOfPkg || 0,
                    status: c.Status === 'A' ? 'Loaded' : 'Empty',
                    commodityDescription: c.CommodityDescription || '',
                };
            }),
            houseJobs: (masterJob.houseJob || []).map((h: any) => {
                // Sum up cargo details from HouseJobCargo
                const totalPackages = h.Cargo?.reduce((sum: number, cargo: any) => sum + (cargo.NoOfPackage || 0), 0) || 0;
                const totalWeight = h.Cargo?.reduce((sum: number, cargo: any) => sum + parseFloat(cargo.GrossWeight || 0), 0) || 0;
                const totalVolume = h.Cargo?.reduce((sum: number, cargo: any) => sum + parseFloat(cargo.Volume || 0), 0) || 0;

                return {
                    hblNumber: h.HBLNo || '',
                    consigneeName: h.ConsigneeName || '',
                    commodity: h.Cargo && h.Cargo.length > 0 ? h.Cargo[0].CommodityDescription || '' : '',
                    packages: totalPackages,
                    weight: totalWeight,
                    cbm: totalVolume,
                };
            }),
            printInfo: {
                printedBy: 'System User', // TODO: Get from auth context
                printedOn: new Date(),
            },
        };

        return baseData;
    }


    async getMasterJobByDepartmentid(payload: any) {
        try {
            const { DepartmentMasterSid, CompanyMasterSid, BranchMasterSid } = payload;
            const masterJob = await this._db.masterJob.findMany({
                where: {
                    MasterJobNumber: { not: null },
                    DepartmentMasterSid: DepartmentMasterSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    Status: 'A'
                },
                select: {
                    MasterJobSid: true,
                    MasterJobNumber: true,
                }
            })
            return masterJob;
        } catch (error) {
            throw error;
        }
    }


    async createBookingFromMasterJob(payload: any) {
    // CASE 1: MULTIPLE HOUSES
    if (payload.houses && Array.isArray(payload.houses)) {
        const { houses, createdBy } = payload;
        const results: any[] = [];

        for (const house of houses) {
            try {
                // ✅ Check duplicate
                const existingBooking = await this._db.bookingHeader.findFirst({
                    where: {
                        TranshipmentHouseSid: house.HouseJobSid,
                        deletedAt: null
                    }
                });

                if (existingBooking) {
                    results.push({
                        success: false,
                        houseJobSid: house.HouseJobSid,
                        message: `Booking already exists`,
                        bookingNo: existingBooking.BookingNo
                    });
                    continue; // ✅ Skip creation
                }

                const result = await this._db.$transaction(async (tx) => {
                    return await this.createSingleBooking(tx, house, createdBy);
                });
                results.push({ success: true, ...result });
            } catch (error) {
                console.error('Error creating booking for house:', error);
                results.push({
                    success: false,
                    houseJobSid: house.HouseJobSid,
                    error: error.message
                });
            }
        }

        // ✅ Return standardized response
        return results;
    }

    // CASE 2: SINGLE HOUSEJOB SID
    return await this._db.$transaction(async (tx) => {
        const { houseJobSid, createdBy } = payload;

        const houseJob = await tx.houseJob.findFirst({
            where: { HouseJobSid: houseJobSid, deletedAt: null },
            include: {
                Cargo: true,
                Products: true,
                Others: true,
                Connections: true,
            }
        });

        if (!houseJob) {
            throw new BadRequestException("House Job not found");
        }

        if (houseJob.JobType !== 'Transhipment') {
            throw new BadRequestException("Only Transhipment job can create booking");
        }

        const result = await this.createSingleBooking(tx, houseJob, createdBy);
        return { success: true, ...result };
    });
}

private async createSingleBooking(tx : PrismaClient | Prisma.TransactionClient, houseJob, createdBy: string) {
    // IMPORTANT: For Transhipment bookings, map:
    // houseJob.POD (Import House POD) → booking.POL
    // houseJob.FPD (Import House FDC) → booking.POD
    tx = tx || this._db;
    const dateString = moment().format('YYYYMMDD');
    const count = await this._db.bookingHeader.count({
        where: { BookingNo: { contains: dateString } }
    });
    
    const BookingNo = `booking-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
    let destinationAgentAddress = '';
    if (houseJob.DestinationAgent) {
    const agent = await tx.customerMaster.findUnique({
        where: {
            CustomerMasterSid: houseJob.DestinationAgent
        },
        select: {
            CustomerAddress1: true
        }
    });
    destinationAgentAddress = agent?.CustomerAddress1 || '';
}
    
    const bookingHeader = await tx.bookingHeader.create({
        data: {
            BookingNo: BookingNo,
            BookingDateTime: moment().toDate(),
            TranshipmentHouseSid: houseJob.HouseJobSid,
            CompanyMasterSid: houseJob.CompanyMasterSid,
            BranchMasterSid: houseJob.BranchMasterSid,
            CustomerMasterSid: houseJob.CustomerMasterSid,
            CustomerName: houseJob.CustomerName,
            CustomerAddress: houseJob.CustomerAddress,
            SalesmanSid: houseJob.SalesmanSid,
            CargoExpectedon: houseJob.CargoExpectedon,
            FreightTerms: houseJob.FreightTerms,
            
            // ✅ CRITICAL FIX: Transhipment POL/POD mapping
            POO: houseJob.POO,
            POL: houseJob.POD,  // Import House POD becomes Booking POL
            POD: houseJob.FPD,  // Import House FPD becomes Booking POD
            FPD: houseJob.FPD,
            
            TsPortSid: houseJob.TsPortSid,
            // POLTerminal: houseJob.POLTerminal,
            VoyageMasterSid: houseJob.VoyageMasterSid,
            // VesselName: houseJob.VesselName,
            // VoyageNo: houseJob.VoyageNo,
            // ETD: houseJob.ETD,
            // ETA: houseJob.ETA,
            IncoTerms: houseJob.IncoTerms,
            BLLocation: houseJob.BLLocation,
            ShipperName: houseJob.ShipperName,
            ShipperAddress: houseJob.ShipperAddress,
            ConsigneeName: houseJob.ConsigneeName,
            ConsigneeAddress: houseJob.ConsigneeAddress,
            ClearanceRequire: houseJob.ClearanceRequire,
            ShipmentType: houseJob.ShipmentType,
            DestinationAgent: houseJob.DestinationAgent,
            AgentName: houseJob.AgentName,
            AgentAddress: destinationAgentAddress,
            HouseNo: houseJob.HouseNo,
            MasterNoSid: houseJob.MasterNoSid,
            
            QuotationHeaderSid: houseJob.QuotationHeaderSid,
            EnquiryHeaderSid: houseJob.EnquiryHeaderSid,
            MovementType: houseJob.MovementType,
            DoValid: houseJob.DoValid,
            IsServiceJob: houseJob.IsServiceJob,
            DepartmentMasterSid: houseJob.DepartmentMasterSid,
            CustomerBranchSid: houseJob.CustomerBranchSid,
            MenuMasterSid: houseJob.MenuMasterSid,
            CarrierName: houseJob.CarrierName,
            Coload: houseJob.Coload,
            GeneralNote: houseJob.GeneralNote,
            HBLNo: houseJob.HBLNo,
            InternalNote: houseJob.InternalNote,
            MBLDate: houseJob.MBLDate,
            MBLNo: houseJob.MBLNo,
            Nominated: houseJob.Nominated,
            NominatedBy: houseJob.NominatedBy,
            Notify: houseJob.Notify,
            NotifyAddress: houseJob.NotifyAddress,
            // PODTerminal: houseJob.PODTerminal,
            ShipmentNo: houseJob.ShipmentNo,
            OriginAgent: houseJob.OriginAgent,
            BookingStatus: 'Booked',
            CarrierSid: houseJob.CarrierSid,
            JobType: houseJob.JobType,
            createdBy,
            status: "A"
        }
    });

    const bookingHeaderSid = bookingHeader.BookingHeaderSid;

    // ----------------------------------------
    // 2. Insert Cargo
    // ----------------------------------------
    const bookingCargo: any[] = [];
    if (houseJob.Cargo?.length) {
        for (const c of houseJob.Cargo) {
            const {
                HouseJobCargoSid,
                HouseJobSid,
                CommodityDescription,
                MarksAndNumber,
                LandedMarksandNumber,
                ...cargoData
            } = c;

            const createdCargo = await tx.bookingCargo.create({
                data: {
                    ...cargoData,
                    BookingHeaderSid: bookingHeaderSid,
                    createdBy
                }
            });
            bookingCargo.push(createdCargo);
        }
    }

    // ----------------------------------------
    // 3. Insert Products
    // ----------------------------------------
    const bookingProducts: any[] = [];
    if (houseJob.Products?.length) {
        for (const p of houseJob.Products) {
            const createdProduct = await tx.bookingProduct.create({
                data: {
                    BookingHeaderSid: bookingHeaderSid,
                    ProductName: p.ProductName,
                    ProductDescription: p.ProductDescription,
                    ShippingBillNo: p.ShippingBillNo || null,
                    ShippingBillDate: p.ShippingBillDate,
                    ExternaPkg: p.ExternaPkg,
                    ExternlQty: p.ExternlQty,
                    InternalPkg: p.InternalPkg,
                    InternalQty: p.InternalQty,
                    GrossWeight: p.GrossWeight,
                    NetWeight: p.NetWeight,
                    Volume: p.Volume,
                    Height: p.Height,
                    ImcoClass: p.ImcoClass,
                    IsHaz: p.IsHaz,
                    Length: p.Length,
                    PkgGroup: p.PkgGroup,
                    UnNo: p.UnNo,
                    Width: p.Width,
                    UomMasterSid: p.UomMasterSid,
                    ActualGrWeight: p.ActualGrWeight,
                    ActualQty: p.ActualQty,
                    ActualVolume: p.ActualVolume,
                    CFS: p.CFS,
                    CargoRecDate: p.CargoRecDate,
                    RecdPack: p.RecdPack,
                    Volumetric: p.Volumetric,
                    createdBy
                }
            });
            bookingProducts.push(createdProduct);
        }
    }

    // ----------------------------------------
    // 4. Insert Others
    // ----------------------------------------
    const bookingOthers: any[] = [];
    if (houseJob.Others?.length) {
        for (const o of houseJob.Others) {
            const {
                HouseJobOthersSid,
                HouseJobSid,
                DONo,
                DODate,
                InternalNote,
                ExternalNote,
                BlClause,
                ...othersData
            } = o;

            const createdOthers = await tx.bookingOthers.create({
                data: {
                    CustomerRefNo: othersData.CustomerRefNo,
                    OperationUser: othersData.OperationUser,
                    DocumentationUser: othersData.DocumentationUser,
                    HBLNo: houseJob.HBLNo || '',
                    Forwarder: othersData.Forwarder || '',
                    ForwarderAddress: othersData.ForwarderAddress || '',
                    CustomerServiceuser: othersData.CustomerServiceuser,
                    NotifyParty: othersData.NotifyParty,
                    NotifyPartyAddress: othersData.NotifyPartyAddress,
                    Notify2: othersData.Notify2,
                    NotifyAddress2: othersData.NotifyAddress2,
                    CHAName: othersData.CHAName,
                    PickupMode: othersData.PickupMode,
                    ReleaseType: othersData.ReleaseType,
                    YardCFS: othersData.YardCFS,
                    LocalTransport: othersData.LocalTransport,
                    OverseasTransport: othersData.OverseasTransport,
                    OverseasClearance: othersData.OverseasClearance,
                    PickupPlace: othersData.PickupPlace,
                    PickupDate: othersData.PickupDate,
                    PickupAddress: othersData.PickupAddress,
                    DeliveryPlace: othersData.DeliveryPlace,
                    DeliveryDate: othersData.DeliveryDate,
                    DeliveryAddress: othersData.DeliveryAddress,
                    CargoCurrency: othersData.CargoCurrency,
                    CargoValue: othersData.CargoValue,
                    CarrierBookingRef: othersData.CarrierBookingRef || '',
                    CarrierBookingDate: othersData.CarrierBookingDate ? new Date(othersData.CarrierBookingDate) : null,
                    BookingHeaderSid: bookingHeaderSid,
                    SwitchBL: othersData.SwitchBL || '',
                    SwitchBLAgent: othersData.SwitchBLAgent || '',
                    AgentAddress: othersData.AgentAddress || '',
                    SwitchBLShipper: othersData.SwitchBLShipper || '',
                    SwitchBLConsignee: othersData.SwitchBLConsignee || '',
                    SwitchLocation: othersData.SwitchLocation || '',
                    createdBy
                }
            });
            bookingOthers.push(createdOthers);
        }
    }

      //---------------------
    //5. connection
    //-----------------------
   const bookingConnections: any[] = [];
    
// Get all connections from house job
const houseConnections = await tx.houseJobConnection.findMany({
    where: {
        HouseJobSid: houseJob.HouseJobSid,
        status: 'A'
    }
});

// If no connections exist in house job, create one from the house job's main values
if (houseConnections.length === 0 && (houseJob.POL || houseJob.POD || houseJob.VesselName || houseJob.VoyageNo)) {
    // Create a connection from the house job's main voyage information
    const createdConnection = await tx.bookingConnection.create({
        data: {
            BookingHeaderSid: bookingHeader.BookingHeaderSid,
            Mode: 'Sea', // Default mode - adjust as needed
            VesselName: houseJob.VesselName || '',
            VoyageNo: houseJob.VoyageNo || '',
            POL: houseJob.POL || '',
            POD: houseJob.POD || '',
            ETD: houseJob.ETD ? new Date(houseJob.ETD) : null,
            ETA: houseJob.ETA ? new Date(houseJob.ETA) : null,
            Remarks: 'Created from Master Job House',
            status: 'A',
            createdBy: createdBy,
            createdOn: new Date(),
            updatedBy: null,
            updatedOn: null
        }
    });
    bookingConnections.push(createdConnection);
} else {
    // Copy all existing connections from house job
    for (const connection of houseConnections) {
        const createdConnection = await tx.bookingConnection.create({
            data: {
                BookingHeaderSid: bookingHeader.BookingHeaderSid,
                Mode: connection.Mode || '',
                VesselName: connection.VesselName || '',
                VoyageNo: connection.VoyageNo || '',
                POL: connection.POL || '',
                POD: connection.POD || '',
                ETD: connection.ETD ? new Date(connection.ETD) : null,
                ETA: connection.ETA ? new Date(connection.ETA) : null,
                Remarks: connection.Remarks || '',
                status: 'A',
                createdBy: createdBy,
                createdOn: new Date(),
                updatedBy: null,
                updatedOn: null
            }
        });
        bookingConnections.push(createdConnection);
    }
}
    

    // Update house job with booking reference
    await tx.houseJob.update({
        where: {
            HouseJobSid: houseJob.HouseJobSid
        },
        data: {
            TranshipmentBookingSid: bookingHeader.BookingHeaderSid
        }
    });

    return {
        bookingHeader,
        bookingCargo,
        bookingProducts,
        bookingOthers,
        bookingConnections,
        message: "Booking created successfully from Master Job"
    };
}
async getMasterJobARAPData(MasterJobSid: number): Promise<any> {
  try {
    // Use Prisma view instead of raw query
    const arapData = await this._db.vMasterARAP.findMany({
      where: {
        MasterJobSid: MasterJobSid
      },
      orderBy: {
        VoucherDate: 'desc'
      }
    });
 
    return arapData;
  } catch (error) {
    this.logger.error(`Error fetching AR/AP data: ${error.message}`);
    throw error;
  }
}

    async getAllHouseJobById(MasterJobSid: number) {
        try {
            return this._db.$transaction(async (prisma) => {

                const masterJobDetails = await prisma.masterJob.findUnique({
                    where: {
                        MasterJobSid: MasterJobSid,
                    },
                    include: {
                        houseJob:{
                            select:{
                                Products:true,
                                Others:true,
                                ShipperName:true,
                                ShipperAddress:true,
                                ConsigneeName:true,
                                ConsigneeAddress:true,
                                HBLNo:true,
                                DestinationAgent:true,
                                Notify:true,
                                NotifyAddress:true,
                                POO:true,
                                POL:true,
                                POD:true,
                                FPD:true,
                                VesselName:true,
                                VoyageNo:true,
                                Cargo:true,
                                masterJob:{
                                    select:{
                                        others:true,
                                        containers:true
                                    }
                                }
                            }
                        }
                    },
                });

                return masterJobDetails;
            });
        } catch (error) {
            throw error;
        }
    }
/**
 * Validate container data from Excel upload
 */
async validateContainerData(
    containers: any[],
    companyMasterSid: number,
    branchMasterSid: number
): Promise<any[]> {
    const errors: any[] = [];
    
    if (!containers || containers.length === 0) {
        errors.push({
            field: 'Containers',
            message: 'No container data provided',
            row: 1
        });
        return errors;
    }

    // Get container types for validation
    const containerTypes = await this._db.containerTypeMaster.findMany({
        where: { status: 'A' }
    });

    // Get package types for validation
    const packageTypes = await this._db.uOMMaster.findMany({
        where: { UOMType: 'P', status: 'A' }
    });

    // Validate each container
    for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        const rowNumber = i + 2; // Excel rows start from 2 (header is row 1)

        // Skip read-only/predefined rows (empty container number)
        if (!container.ContainerNumber || container.ContainerNumber.trim() === '') {
            continue;
        }

        // Validate required fields
        if (!container.ContainerNumber) {
            errors.push({
                field: 'Container Number',
                message: 'Container Number is required',
                row: rowNumber,
                containerNumber: container.ContainerNumber || 'N/A'
            });
        }

        if (!container.ContainerType) {
            errors.push({
                field: 'Container Type',
                message: 'Container Type is required',
                row: rowNumber,
                containerNumber: container.ContainerNumber || 'N/A'
            });
        } else {
            // Validate container type exists
            const containerTypeExists = containerTypes.some(
                ct => ct.ContainerTypeMasterSid === Number(container.ContainerType)
            );
            if (!containerTypeExists) {
                errors.push({
                    field: 'Container Type',
                    message: `Invalid Container Type ID: ${container.ContainerType}`,
                    row: rowNumber,
                    containerNumber: container.ContainerNumber || 'N/A'
                });
            }
        }

        // Validate package type if provided
        if (container.PkgType) {
            const packageTypeExists = packageTypes.some(
                pt => pt.UOMMasterSid === Number(container.PkgType)
            );
            if (!packageTypeExists) {
                errors.push({
                    field: 'Package Type',
                    message: `Invalid Package Type ID: ${container.PkgType}`,
                    row: rowNumber,
                    containerNumber: container.ContainerNumber || 'N/A'
                });
            }
        }

        // Validate container number format
        if (container.ContainerNumber) {
            // Check if container number is valid format (4 letters + 6 digits + 1 check digit)
            const containerRegex = /^[A-Z]{4}\d{6}\d$/;
            if (!containerRegex.test(container.ContainerNumber.toUpperCase())) {
                errors.push({
                    field: 'Container Number',
                    message: 'Invalid container number format. Must be 11 characters (4 letters + 7 digits)',
                    row: rowNumber,
                    containerNumber: container.ContainerNumber
                });
            }
        }

        // Validate weights (Gross should be >= Net)
        const grossWeight = Number(container.GrossWeight) || 0;
        const netWeight = Number(container.NetWeight) || 0;
        
        if (grossWeight < netWeight) {
            errors.push({
                field: 'Gross Weight',
                message: 'Gross weight cannot be less than net weight',
                row: rowNumber,
                containerNumber: container.ContainerNumber || 'N/A'
            });
        }

        // Validate numeric fields
        const numericFields = ['NoOfPkg', 'GrossWeight', 'NetWeight', 'ChargeableWeight', 'Volume'];
        numericFields.forEach(field => {
            if (container[field] && isNaN(Number(container[field]))) {
                errors.push({
                    field: field,
                    message: `${field} must be a number`,
                    row: rowNumber,
                    containerNumber: container.ContainerNumber || 'N/A'
                });
            }
        });

        // Validate length constraints
        if (container.LineSeal && container.LineSeal.length > 10) {
            errors.push({
                field: 'Line Seal',
                message: 'Line Seal cannot exceed 10 characters',
                row: rowNumber,
                containerNumber: container.ContainerNumber || 'N/A'
            });
        }

        if (container.CustomsSeal && container.CustomsSeal.length > 10) {
            errors.push({
                field: 'Customs Seal',
                message: 'Customs Seal cannot exceed 10 characters',
                row: rowNumber,
                containerNumber: container.ContainerNumber || 'N/A'
            });
        }

        if (container.CommodityDescription && container.CommodityDescription.length > 500) {
            errors.push({
                field: 'Commodity Description',
                message: 'Commodity Description cannot exceed 500 characters',
                row: rowNumber,
                containerNumber: container.ContainerNumber || 'N/A'
            });
        }
    }

    return errors;
}
async validateProductData(
    products: any[],
    companyMasterSid: number,
    branchMasterSid: number,
    masterJobSid: number
): Promise<any[]> {
    const errors: any[] = [];
    
    if (!products || products.length === 0) {
        errors.push({
            field: 'Products',
            message: 'No product data provided',
            row: 1
        });
        return errors;
    }

    // Get house jobs for the master job to validate HBL numbers
    const houseJobs = await this._db.houseJob.findMany({
        where: { 
            MasterJobSid: masterJobSid,
            CompanyMasterSid: companyMasterSid,
            BranchMasterSid: branchMasterSid,
            status: 'A'
        },
        select: {
            HouseJobSid: true,
            HBLNo: true
        }
    });
   
    // Get product names for validation
    const productList = await this._db.productMaster.findMany({
        where: { status: 'A' }
    });

    // Get package types for validation
    const packageTypes = await this._db.uOMMaster.findMany({
        where: { UOMType: 'P', status: 'A' }
    });

    // Get IMCO classes for validation
    const imcoClasses = await this._db.imcoMaster.findMany({
        where: { status: 'A' }
    });

    // Get master job containers for validation
    const masterJobContainers = await this._db.masterJobContainer.findMany({
        where: { 
            MasterJobSid: masterJobSid,
            Status: 'A'
        },
        select: {
            MasterJobContainerSid: true,
            ContainerNumber: true
        }
    });

    // Validate each product
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const rowNumber = i + 2; // Excel rows start from 2 (header is row 1)

        // Skip empty rows
        if (!product.HBLNo || product.HBLNo.trim() === '') {
            continue;
        }

        // Validate HBL Number exists for this master job
        const validHBL = houseJobs.find(hj => hj.HBLNo === product.HBLNo);
        if (!validHBL) {
            errors.push({
                field: 'HBL Number',
                message: `HBL Number "${product.HBLNo}" not found for this master job`,
                row: rowNumber,
                hblNo: product.HBLNo || 'N/A'
            });
        }

        // Validate Product Name if provided
        if (product.ProductName) {
            const productExists = productList.some(
                p => p.ProductName === product.ProductName
            );
            if (!productExists) {
                errors.push({
                    field: 'Product Name',
                    message: `Product Name "${product.ProductName}" not found in system`,
                    row: rowNumber,
                    hblNo: product.HBLNo || 'N/A'
                });
            }
        }

        // Validate Package Type if provided
        if (product.ExternalPkg) {
            const packageTypeExists = packageTypes.some(
                pt => pt.UOMName === product.ExternalPkg
            );
            if (!packageTypeExists) {
                errors.push({
                    field: 'Package Type',
                    message: `Package Type "${product.ExternalPkg}" not found`,
                    row: rowNumber,
                    hblNo: product.HBLNo || 'N/A'
                });
            }
        }

        // Validate Container if provided
        if (product.MasterJobContainerSid) {
            const containerExists = masterJobContainers.some(
                c => c.MasterJobContainerSid === Number(product.MasterJobContainerSid)
            );
            if (!containerExists) {
                errors.push({
                    field: 'Container',
                    message: `Container ID "${product.MasterJobContainerSid}" not found for this master job`,
                    row: rowNumber,
                    hblNo: product.HBLNo || 'N/A'
                });
            }
        }

        // Validate IMCO Class if provided and IsHaz is Yes
        if (product.IsHaz && product.IsHaz.toString().toUpperCase() === 'Y' && product.ImcoClass) {
            const imcoClassExists = imcoClasses.some(
                imco => imco.ImcoName === product.ImcoClass
            );
            if (!imcoClassExists) {
                errors.push({
                    field: 'IMCO Class',
                    message: `IMCO Class "${product.ImcoClass}" not found`,
                    row: rowNumber,
                    hblNo: product.HBLNo || 'N/A'
                });
            }
        }

        // Validate numeric fields
        const numericFields = ['ExternalQty', 'Length', 'Width', 'Height', 'Volumetric', 
                              'Volume', 'GrossWeight', 'NetWeight', 'ReceivedQty', 
                              'DamageQty', 'DeliveredQty'];
        numericFields.forEach(field => {
            if (product[field] && isNaN(Number(product[field]))) {
                errors.push({
                    field: field,
                    message: `${field} must be a number`,
                    row: rowNumber,
                    hblNo: product.HBLNo || 'N/A'
                });
            }
        });

        // Validate Gross Weight >= Net Weight
        const grossWeight = Number(product.GrossWeight) || 0;
        const netWeight = Number(product.NetWeight) || 0;
        
        if (grossWeight < netWeight) {
            errors.push({
                field: 'Gross Weight',
                message: 'Gross weight cannot be less than net weight',
                row: rowNumber,
                hblNo: product.HBLNo || 'N/A'
            });
        }

        // Validate dates
        const dateFields = ['ShippingBillDate', 'CargoRecDate', 'DeliveryDate'];
        dateFields.forEach(field => {
            if (product[field]) {
                const date = new Date(product[field]);
                if (isNaN(date.getTime())) {
                    errors.push({
                        field: field,
                        message: `${field} must be a valid date`,
                        row: rowNumber,
                        hblNo: product.HBLNo || 'N/A'
                    });
                }
            }
        });

        // Validate boolean field
        if (product.IsHaz && !['Y', 'N', 'Yes', 'No', 'YES', 'NO'].includes(product.IsHaz.toString().toUpperCase())) {
            errors.push({
                field: 'Is Haz',
                message: 'Is Haz must be Y or N',
                row: rowNumber,
                hblNo: product.HBLNo || 'N/A'
            });
        }

        // Validate length constraints
        const textFields = [
            { field: 'HSCode', maxLength: 20 },
            { field: 'ShippingBillNo', maxLength: 50 },
            { field: 'DamageRemarks', maxLength: 500 },
            { field: 'UnNo', maxLength: 20 },
            { field: 'PkgGroup', maxLength: 50 }
        ];

        textFields.forEach(({ field, maxLength }) => {
            if (product[field] && product[field].length > maxLength) {
                errors.push({
                    field: field,
                    message: `${field} cannot exceed ${maxLength} characters`,
                    row: rowNumber,
                    hblNo: product.HBLNo || 'N/A'
                });
            }
        });
    }

    return errors;
}
/**
 * Process uploaded product data
 */
async processProductUpload(
    products: any[],
    companyMasterSid: number,
    branchMasterSid: number,
    masterJobSid: number,
    createdBy: string
): Promise<any> {
    try {
        // Get house jobs mapping
        const houseJobs = await this._db.houseJob.findMany({
            where: { 
                MasterJobSid: masterJobSid,
                CompanyMasterSid: companyMasterSid,
                BranchMasterSid: branchMasterSid,
                
            },
            select: {
                HouseJobSid: true,
                HBLNo: true
            }
        });

        // Get product mapping - Use productMaster table, not HouseJobProduct
        const productList = await this._db.productMaster.findMany({
            where: { status: 'A' },
            select: {
                ProductMasterSId: true, // This is the correct field
                ProductName: true
            }
        });

        // Get package type mapping
        const packageTypes = await this._db.uOMMaster.findMany({
            where: { UOMType: 'P', status: 'A' },
            select: {
                UOMMasterSid: true,
                UOMName: true
            }
        });

        // Get IMCO class mapping
        const imcoClasses = await this._db.imcoMaster.findMany({
            where: { status: 'A' },
            select: {
                ImcoMasterSid: true,
                ImcoName: true
            }
        });

        // Get UOM mapping
        const uomList = await this._db.uOMMaster.findMany({
            where: { status: 'A' },
            select: {
                UOMMasterSid: true,
                UOMName: true
            }
        });

        const results = await this._db.$transaction(async (prisma) => {
            const createdProducts: any[] = [];
            
            for (const product of products) {
                // Skip empty rows
                 console.log('Processing product with HBLNo:', product.HBLNo);
                if (!product.HBLNo || product.HBLNo.trim() === '') {
                    continue;
                }
                   
                // Find HouseJobSid from HBLNo
                const houseJob = houseJobs.find(hj => hj.HBLNo === product.HBLNo);
                console.log('House job found:', houseJob);
                if (!houseJob) {
                      console.log('Available HBL numbers:', houseJobs.map(hj => hj.HBLNo));
        console.error(`House job not found for HBLNo: ${product.HBLNo}`);
                    continue; // Skip if HBL not found
                }
                 console.log('Found HouseJobSid:', houseJob.HouseJobSid, 'for HBLNo:', product.HBLNo);
                // Find ProductName - just store the name string, not ID
                const productName = product.ProductName || '';

                // Find Package Type - store as string in ExternaPkg field
                let externalPkg = null;
                if (product.ExternalPkg) {
                    const packageType = packageTypes.find(pt => pt.UOMName === product.ExternalPkg);
                    externalPkg = packageType ? product.ExternalPkg : null;
                }

                // Find UOM ID for UomMasterSid field
               let uomMasterSid: number | null = null; // Add type annotation
if (product.UomMasterSid) {
    const uom = uomList.find(u => u.UOMName === product.UomMasterSid);
    uomMasterSid = uom ? uom.UOMMasterSid : null;
}

                // Find IMCO Class ID if provided
                let imcoClass = '';
                if (product.ImcoClass) {
                    const imcoClassObj = imcoClasses.find(imco => imco.ImcoName === product.ImcoClass);
                    imcoClass = imcoClassObj ? product.ImcoClass : '';
                }

                // Prepare product data according to Prisma model
                const productData = {
                    HouseJobSid: houseJob.HouseJobSid,
                    ProductName: productName,
                    ShippingBillNo: product.ShippingBillNo || '',
                    // ShippingBillDate: product.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
                    ExternaPkg: externalPkg,
                    ExternlQty: product.ExternalQty ? String(product.ExternalQty) : null,
                    GrossWeight: new Prisma.Decimal(Number(product.GrossWeight) || 0),
                    NetWeight: product.NetWeight ? new Prisma.Decimal(Number(product.NetWeight)) : null,
                    Volume: product.Volume ? new Prisma.Decimal(Number(product.Volume)) : null,
                    Volumetric: product.Volumetric ? new Prisma.Decimal(Number(product.Volumetric)) : null,
                    IsHaz: product.IsHaz && product.IsHaz.toString().toUpperCase() === 'Y' ? 'Y' : 'N',
                    ImcoClass: imcoClass,
                    UnNo: product.UnNo || '',
                    PkgGroup: product.PkgGroup || '',
                    Length: product.Length ? new Prisma.Decimal(Number(product.Length)) : null,
                    Width: product.Width ? new Prisma.Decimal(Number(product.Width)) : null,
                    Height: product.Height ? new Prisma.Decimal(Number(product.Height)) : null,
                    HSCode: product.HSCode || '',
                    UomMasterSid: uomMasterSid,
                    // CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                    ReceivedQty: product.ReceivedQty ? new Prisma.Decimal(Number(product.ReceivedQty)) : null,
                    DamageQty: product.DamageQty ? new Prisma.Decimal(Number(product.DamageQty)) : null,
                    DamageRemarks: product.DamageRemarks || '',
                    MasterJobContainerSid: product.MasterJobContainerSid ? Number(product.MasterJobContainerSid) : null,
                    ContainerNo: product.ContainerNo || '',
                    // DeliveryDate: product.DeliveryDate ? new Date(product.DeliveryDate) : null,
                    DeliveredQty: product.DeliveredQty ? new Prisma.Decimal(Number(product.DeliveredQty)) : null,
                    createdBy: createdBy,
                    status: 'A' as const
                };

                // Create product record
                console.log('Product data to save:', JSON.stringify(productData, null, 2));
                const createdProduct = await prisma.houseJobProduct.create({
                    data: productData
                });
console.log('Created product:', createdProduct);
                createdProducts.push(createdProduct);
            }
            console.log('Created products:', createdProducts);
            catchError(error => {
                console.error('Error creating product:', error);
                return of(error);
                throw error;
            })

            return createdProducts;
        });

        return {
            success: true,
            message: `Successfully created ${results.length} products`,
            data: results
        };
    } catch (error) {
        this.logger.error(`Error processing product upload: ${error.message}`, error.stack);
        throw error;
    }
}
}
