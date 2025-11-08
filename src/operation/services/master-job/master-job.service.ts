import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';
import { Prisma } from '@prisma/client';
import { create } from 'domain';
import { stat } from 'fs';
import { parseDateFromString } from 'src/common/helper';
import { LoadingPlanService } from '../loading-plan/loading-plan.service';
import { MenuService } from 'src/masters/services/menu/menu.service';

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
        private menuMasterService : MenuService,
    ) { }

    async createNewMasterJob(payload: any) {
        try {

            const newMasterJob = await this._db.$transaction(async (prisma) => {
                const dateString = moment().format('YYYYMMDD');
                const count = await prisma.masterJob.count({
                    where: { MasterJobNumber: { contains: dateString } }
                })

                const masterJobMenuId = await this.menuMasterService.getMenuSidByName('Master Job');

                const MasterJobNumber = `MASTER-${dateString}-${(count + 1).toString().padStart(3, '0')}`;

                const headerPayload = {
                    MasterJobNumber: MasterJobNumber,
                    MasterJobDate: payload.MasterJobDate ? new Date(payload.MasterJobDate) : new Date(),
                    CreatedBy: payload.CreatedBy,
                    Status: "A",
                    MenuMasterSid: masterJobMenuId || payload.MenuMasterSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    DepartmentMasterSid: payload.DepartmentMasterSid,
                    FreightPPCC: payload.FreightPPCC || 'Prepaid',
                    DestinationAgent: payload.DestinationAgent,
                    DestinationAgentName: payload.DestinationAgentName,
                    DestinationAgentAddress: payload.DestinationAgentAddress?.substring(0, 20) || '',
                    MBLNo: payload.MBLNo || "",
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
                    DGBookingDate: payload.DGBookingDate ? new Date(payload.DGBookingDate) : null,
                    DGApprovedDate: payload.DGApprovedDate ? new Date(payload.DGApprovedDate) : null,
                    CommodityDescription: payload.CommodityDescription?.substring(0, 20) || '',
                    MarksandNumber: payload.MarksandNumber?.substring(0, 20) || '',
                   
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
                        CreatedBy: payload.CreatedBy,
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
                        MenuMasterSid:  masterJobMenuId || payload.MenuMasterSid,
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
                        RevenueNumberOfUnit : item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null,
                        CostNumberOfUnit : item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null,

                        // Revenue Section
                        RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? item.RevenueCurrencyMasterSid : null,
                        RevenueExchangeRate : item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                        RevenueRate : item.RevenueRate ? Number(item.RevenueRate) : null,
                        RevenueAmount : item.RevenueAmount ? Number(item.RevenueAmount) : null,
                        RevenueLocalAmount : item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                        RevenueDrCr : item.RevenueDrCr,
                        RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                        RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                        RevenuePrepaidCollect : item.RevenuePrepaidCollect,
                        RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                        RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                        // Cost Section
                        CostCurrencyMasterSid: item.CostCurrencyMasterSid ? item.CostCurrencyMasterSid : null,
                        CostExchangeRate : item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                        CostRate : item.CostRate ? Number(item.CostRate) : null,
                        CostAmount : item.CostAmount ? Number(item.CostAmount) : null,
                        CostLocalAmount : item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                        CostDrCr : item.CostDrCr,
                        CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                        CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                        CostPrepaidCollect : item.CostPrepaidCollect,
                        CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                        CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,
                        
                        createdBy: payload.CreatedBy,
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
                        CreatedBy: payload.CreatedBy,
                        Status: "A"
                    }))
                    createdActivities = await prisma.containerActivity.createMany({
                        data: activityPayload
                    })
                }

                return {
                    ...createdMasterJob,
                    ...createdVoyage
                }
            })

            // SHIPMENT PART

            const allShipments = payload.shipmentList || [];
            const recordToCreateShipment = allShipments.filter(shipment => !shipment.HBLNo);
            const recordToUpdateShipment = allShipments.filter(shipment => shipment.HBLNo);


            if (recordToCreateShipment.length > 0) {
                let bookingNeedHouseCreateIds = recordToCreateShipment.map(shipment => shipment.BookingHeaderSid);
                const allBookings = await this._db.bookingHeader.findMany({
                    where: { BookingHeaderSid: { in: bookingNeedHouseCreateIds } },
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
                for (const booking of allBookings) {
                    const { bookingCargo, bookingProduct, bookingOthers, bookingConnection, bookingRates, ...bookingHeader } = booking;

                    hblSerial += 1;
                    const HBLNo = `HOUSE-${dateString}-${hblSerial.toString().padStart(3, '0')}`;

                    const houseJobMenuId = await this.menuMasterService.getMenuSidByName('House Job');


                    // Step 1: Create main house job
                    const houseJob = await this._db.houseJob.create({
                        data: {
                            MasterJobSid: newMasterJob.MasterJobSid,

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
                            MenuMasterSid: houseJobMenuId ||  payload.MenuMasterSid,
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
                                createdBy:  payload.CreatedBy || '',
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
                                createdBy:  payload.CreatedBy || '',
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
                                createdBy:  payload.CreatedBy || '',
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
                                MenuMasterSid: houseJobMenuId ||  payload.MenuMasterSid,
                                ShipmentNo: houseJob.ShipmentNo,
                                MasterJobNo: newMasterJob.MasterJobNumber,
                                CompanyMasterSid: houseJob.CompanyMasterSid,
                                BranchMasterSid: houseJob.BranchMasterSid!,
                                createdBy:  payload.CreatedBy || '',
                                status: "A",
                                Remarks: rate.Remarks || '',

                                SerialNumber: houseChargeIndex++,
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeDescription: rate.ChargeDescription,
                                ChargeUomSid: rate.ChargeUomSid,
                                RevenueChargeUomSid: rate.RevenueChargeUomSid!,
                                CostChargeUomSid: rate.CostChargeUomSid!,
                                RevenueNumberOfUnit : rate.RevenueNumberOfUnit,
                                CostNumberOfUnit : rate.CostNumberOfUnit,

                                // Revenue Section
                                RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid,
                                RevenueExchangeRate : rate.RevenueExchangeRate,
                                RevenueRate : rate.RevenueRate,
                                RevenueAmount : rate.RevenueAmount,
                                RevenueLocalAmount : rate.RevenueLocalAmount,
                                RevenueDrCr : rate.RevenueDrCr,
                                RevenueCustomerMasterSid: rate.CustomerMasterSid,
                                RevenueCustomerBranchSid: rate.CustomerBranchSid,
                                RevenuePrepaidCollect : rate.RevenuePrepaidCollect,
                                RevenueVoucherHeaderSid: rate.RevenueVoucherHeaderSid,
                                RevenueVoucherTypeMasterSid: rate.RevenueVoucherTypeMasterSid,

                                // Cost Section
                                CostCurrencyMasterSid: rate.CostCurrencyMasterSid,
                                CostExchangeRate : rate.CostExchangeRate,
                                CostRate : rate.CostRate,
                                CostAmount : rate.CostAmount,
                                CostLocalAmount : rate.CostLocalAmount,
                                CostDrCr : rate.CostDrCr,
                                CostAgentMasterSid: rate.AgentMasterSid,
                                CostAgentBranchSid: rate.AgentBranchSid,
                                CostPrepaidCollect : rate.CostPrepaidCollect,
                                CostVoucherHeaderSid: rate.CostVoucherHeaderSid,
                                CostVoucherTypeMasterSid: rate.CostVoucherTypeMasterSid,
                                
                                BookingRateSid : rate.BookingRatesSid,
                            }))
                        }).catch(err => {
                            console.error('HouseJobRates createMany error:', err);
                        });
                    }

                    /** Updating Vouchers with MasterJobSid && HouseJobSid */
                    if(allRevenueVouchers.length > 0) {
                        for (const revenueVoucher of allRevenueVouchers) {
                            await this._db.voucherHeader.update({
                                where: {
                                    VoucherHeaderSid: revenueVoucher!
                                },
                                data: {
                                    MasterJobSid: newMasterJob.MasterJobSid,
                                    HouseJobSid: houseJob.HouseJobSid,
                                    MasterNumber : newMasterJob.MBLNo,
                                    HouseNumber : houseJob.HBLNo,
                                }
                            }).catch(err => {
                                console.error('Revenue VoucherHeader update error:', err);
                            });
                        }
                    }
                    if(allCostVouchers.length > 0) {
                        for (const costVoucher of allCostVouchers) {
                            await this._db.voucherHeader.update({
                                where: {
                                    VoucherHeaderSid: costVoucher!
                                },
                                data: {
                                    MasterJobSid: newMasterJob.MasterJobSid,
                                    HouseJobSid: houseJob.HouseJobSid,
                                    MasterNumber : newMasterJob.MBLNo,
                                    HouseNumber : houseJob.HBLNo,
                                }
                            }).catch(err => {
                                console.error('Cost VoucherHeader update error:', err);
                            });
                        }
                    }


                    await this._db.bookingHeader.update({
                        where: { BookingHeaderSid: bookingHeader.BookingHeaderSid },
                        data: {
                            HouseNo: houseJob.HBLNo,
                            MasterNoSid: newMasterJob.MasterJobSid,
                            MBLNo: newMasterJob.MBLNo,
                            MBLDate: newMasterJob.MBLDate,
                            HBLNo : houseJob?.HBLNo,
                            BookingStatus: 'Stuffed',
                            
                            // If Sailing schedule changed during Loading Plan
                            VoyageMasterSid :newMasterJob.VoyageMasterSid,
                            VesselName : newMasterJob.VesselName,
                            VoyageNo : newMasterJob.VoyageNo,
                            ETA : newMasterJob.ETA,
                            ETD : newMasterJob.ETD,
                        },
                    }).catch(err => {
                        console.error('bookingHeader update error:', err);
                    });

                    allCreatedHouseJobs.push(houseJob);
                }
            }

            if (recordToUpdateShipment.length > 0) {
                let houseJobNeedUpdateIds = recordToUpdateShipment.map(shipment => shipment.HBLNo);
                for (const hblNo of houseJobNeedUpdateIds) {
                    const ourHouse = await this._db.houseJob.findFirst({
                        where: {
                            HBLNo: hblNo
                        }
                    })
                    if (!ourHouse) continue;
                    const updatedHouseJob = await this._db.houseJob.update({
                        where: { HouseJobSid: ourHouse.HouseJobSid },
                        data: {
                            MasterJobSid: newMasterJob.MasterJobSid,
                        }
                    }).catch(err => {
                        console.error('houseJob update error:', err);
                    });

                    const updatedBooking = await this._db.bookingHeader.update({
                        where : { BookingHeaderSid: ourHouse.BookingHeaderSid! },
                        data : {
                            MasterNoSid : newMasterJob.MasterJobSid,
                            MBLNo : newMasterJob.MBLNo,
                            MBLDate : newMasterJob.MBLDate,
                            BookingStatus : 'Stuffed',
                        }
                    }).catch(error => 
                        console.error('Error updating booking header', error
                    ));
                }
            }

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

    async getMasterJobById(MasterJobSid: any) {
        try {
            return this._db.$transaction(async (prisma) => {
                const masterJobDetails = await prisma.masterJob.findUnique({
                    where: {
                        MasterJobSid: MasterJobSid
                    },
                    include: {
                        voyages: { where: { Status: 'A' } },
                        masterJobConnection: { where: { Status: 'A' } },
                        containers: { where: { Status: 'A' } },
                        others: { where: { Status: 'A' } },
                    }
                })
                const allShipments = await prisma.houseJob.findMany({
                    where: {
                        MasterJobSid: MasterJobSid,
                        status: 'A'
                    },
                    orderBy: {
                        HouseJobSid: 'asc'
                    }
                })
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
                                DocumentTypeName: true,
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
                                DocumentTypeName: true,
                                VoucherTypeMasterSid: true
                            }
                        }
                    },
                    orderBy : {
                        SerialNumber : 'asc'
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
                return {
                    ...masterJobDetails,
                    CutOffDate,
                    allShipments,
                    costRevenueCharges: allCostRevenueCharges,
                    containerActivities: allActivities
                }
            });

        } catch (error) {
            throw error;
        }
    }

    // Give me the function to update master job
    async updateMasterJob(payload: any) {
        try {
            const updatedMasterJob = await this._db.$transaction(async (prisma) => {
                
                const masterJobMenuId = await this.menuMasterService.getMenuSidByName('Master Job');

                const headerPayload = {
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
                    NoOfPkg: Number(payload.NoOfPkg),
                    WeightIn: payload.WeightIn,
                    GrossWeight: Number(payload.GrossWeight),
                    NetWeight: Number(payload.NetWeight),
                    ChargeableWeight: Number(payload.ChargeableWeight),
                    Volume: Number(payload.Volume),
                    Haz: payload.Haz,
                    Status: payload.Status,
                    DGBookingDate: payload.DGBookingDate ? new Date(payload.DGBookingDate) : null,
                    DGApprovedDate: payload.DGApprovedDate ? new Date(payload.DGApprovedDate) : null,
                    CommodityDescription: payload.CommodityDescription?.substring(0, 20) || '',
                    MarksandNumber: payload.MarksandNumber?.substring(0, 20) || '',
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
                    const voyagePayload = {
                        VoyageMasterSid: payload.VoyageMasterSid,
                        VesselName: payload.VesselName,
                        VoyageNo: payload.VoyageNo,
                        ETD: payload.ETD ? new Date(payload.ETD) : null,
                        ETA: payload.ETA ? new Date(payload.ETA) : null,
                        ATA: payload.ATA ? new Date(payload.ATA) : null,
                        ATD: payload.ATD ? new Date(payload.ATD) : null,
                        DestinationATA: payload.DestinationATA ? new Date(payload.DestinationATA) : null,
                        CarrierMasterSid: payload.CarrierMasterSid,
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
                        CarrierMasterSid: payload.CarrierMasterSid,
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

                    if (connection.TransactionSid) {
                        // update existing connection
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
                            UpdatedBy: payload.UpdatedBy || payload.CreatedBy,
                            UpdatedOn: new Date(),
                        };

                        connectionResult = await prisma.masterJobConnection.update({
                            where: {
                                MasterJobConnectionSid: connection.TransactionSid
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
                            TransactionSid : updatedMasterJob.MasterJobSid ||  item.RateSid,
                            MenuMasterSid: masterJobMenuId || updatedMasterJob.MenuMasterSid!,
                            ShipmentNo : updatedMasterJob.MasterJobNumber,
                            MasterJobNo : updatedMasterJob.MasterJobNumber,
                            updatedBy : payload.UpdatedBy || '',
                            status : String(item.status).charAt(0) || 'A',
                            Remarks : item.Remarks || '',

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
                            RevenueNumberOfUnit : 
                            (item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null) || 
                            (item.NoOfUnit ? Number(item.NoOfUnit) : null)!,
                            CostNumberOfUnit : 
                            (item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null) ||
                            (item.NoOfUnit ? Number(item.NoOfUnit) : null)!,

                            // Revenue Section
                            RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? Number(item.RevenueCurrencyMasterSid) : null,
                            RevenueExchangeRate : item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                            RevenueRate : item.RevenueRate ? Number(item.RevenueRate) : null,
                            RevenueAmount : item.RevenueAmount ? Number(item.RevenueAmount) : null,
                            RevenueLocalAmount : item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                            RevenueDrCr : item.RevenueDrCr,
                            RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                            RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                            RevenuePrepaidCollect : item.RevenuePrepaidCollect,
                            RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                            RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                            // Cost Section
                            CostCurrencyMasterSid: item.CostCurrencyMasterSid ? Number(item.CostCurrencyMasterSid) : null,
                            CostExchangeRate : item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                            CostRate : item.CostRate ? Number(item.CostRate) : null,
                            CostAmount : item.CostAmount ? Number(item.CostAmount) : null,
                            CostLocalAmount : item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                            CostDrCr : item.CostDrCr,
                            CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                            CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                            CostPrepaidCollect : item.CostPrepaidCollect,
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

                return {
                    ...updatedMasterJob,
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

                    hblSerial += 1;
                    const HBLNo = `HOUSE-${dateString}-${hblSerial.toString().padStart(3, '0')}`;

                    const houseJobMenuId = await this.menuMasterService.getMenuSidByName('House Job');
                    

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
                            MenuMasterSid: houseJobMenuId ||  payload.MenuMasterSid,
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
                                createdBy:  payload.CreatedBy || '',
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
                                createdBy:  payload.CreatedBy || '',
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
                                createdBy:  payload.CreatedBy || '',
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
                                createdBy:  payload.CreatedBy || '',
                                status: "A",
                                Remarks: rate.Remarks || '',

                                SerialNumber: houseChargeIndex++,
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeDescription: rate.ChargeDescription,
                                ChargeUomSid: rate.ChargeUomSid,
                                RevenueChargeUomSid: rate.RevenueChargeUomSid!,
                                CostChargeUomSid: rate.CostChargeUomSid!,
                                RevenueNumberOfUnit : rate.RevenueNumberOfUnit,
                                CostNumberOfUnit : rate.CostNumberOfUnit,

                                // Revenue Section
                                RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid,
                                RevenueExchangeRate : rate.RevenueExchangeRate,
                                RevenueRate : rate.RevenueRate,
                                RevenueAmount : rate.RevenueAmount,
                                RevenueLocalAmount : rate.RevenueLocalAmount,
                                RevenueDrCr : rate.RevenueDrCr,
                                RevenueCustomerMasterSid: rate.CustomerMasterSid,
                                RevenueCustomerBranchSid: rate.CustomerBranchSid,
                                RevenuePrepaidCollect : rate.RevenuePrepaidCollect,
                                RevenueVoucherHeaderSid: rate.RevenueVoucherHeaderSid,
                                RevenueVoucherTypeMasterSid: rate.RevenueVoucherTypeMasterSid,

                                // Cost Section
                                CostCurrencyMasterSid: rate.CostCurrencyMasterSid,
                                CostExchangeRate : rate.CostExchangeRate,
                                CostRate : rate.CostRate,
                                CostAmount : rate.CostAmount,
                                CostLocalAmount : rate.CostLocalAmount,
                                CostDrCr : rate.CostDrCr,
                                CostAgentMasterSid: rate.AgentMasterSid,
                                CostAgentBranchSid: rate.AgentBranchSid,
                                CostPrepaidCollect : rate.CostPrepaidCollect,
                                CostVoucherHeaderSid: rate.CostVoucherHeaderSid,
                                CostVoucherTypeMasterSid: rate.CostVoucherTypeMasterSid,
                                
                                BookingRateSid : rate.BookingRatesSid,
                            }))
                        }).catch(err => {
                            console.error('HouseJobRates createMany error:', err);
                        });
                    }

                    if(allRevenueVouchers.length > 0) {
                        for (const revenueVoucher of allRevenueVouchers) {
                            await this._db.voucherHeader.update({
                                where: {
                                    VoucherHeaderSid: revenueVoucher!
                                },
                                data: {
                                    MasterJobSid: updatedMasterJob.MasterJobSid,
                                    HouseJobSid: houseJob.HouseJobSid,
                                    MasterNumber : updatedMasterJob.MBLNo,
                                    HouseNumber : houseJob.HBLNo,
                                }
                            }).catch(err => {
                                console.error('Revenue VoucherHeader update error:', err);
                            });
                        }
                    }
                    if(allCostVouchers.length > 0) {
                        for (const costVoucher of allCostVouchers) {
                            await this._db.voucherHeader.update({
                                where: {
                                    VoucherHeaderSid: costVoucher!
                                },
                                data: {
                                    MasterJobSid: updatedMasterJob.MasterJobSid,
                                    HouseJobSid: houseJob.HouseJobSid,
                                    MasterNumber : updatedMasterJob.MBLNo,
                                    HouseNumber : houseJob.HBLNo,
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
                        where : { BookingHeaderSid: ourHouse.BookingHeaderSid! },
                        data : {
                            MasterNoSid : updatedMasterJob.MasterJobSid,
                            MBLNo : updatedMasterJob.MBLNo,
                            MBLDate : updatedMasterJob.MBLDate,
                            BookingStatus : 'Stuffed',
                        }
                    }).catch(error => 
                        console.error('Error updating booking header', error
                    ));

                }
            }

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
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId , departmentType } = params;
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
                { departmentType : {not : {equals : 'Air'}} }
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
            const detachedHouse = await this._db.houseJob.update({
                where: {
                    HouseJobSid: HouseJobSid
                },
                data: {
                    MasterJobSid: null
                }
            })
            const ourBooking = await this._db.bookingHeader.findFirst({
                where: {
                    BookingHeaderSid: detachedHouse.BookingHeaderSid!
                }
            })

            let detachedBooking;
            if (ourBooking) {
                detachedBooking = await this._db.bookingHeader.update({
                    where: {
                        BookingHeaderSid: ourBooking.BookingHeaderSid
                    },
                    data: {
                        MasterNoSid: null,
                        MBLNo: null,
                        MBLDate: null,
                        BookingStatus: 'Cargo Received',
                    }
                })
            }
            return {
                detachedBooking,
                detachedHouse
            }
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
                    HouseJobSid : houseJob.HouseJobSid,
                    BookingHeaderSid : houseJob.BookingHeaderSid,
                    BookingNo : houseJob.BookingNo,
                    BookingDateTime : houseJob.BookingDateTime,
                    CustomerName : houseJob.CustomerName,
                    CustomerAddress : houseJob.CustomerAddress,
                    ShipperName : houseJob.ShipperName,
                    ShipperAddress : houseJob.ShipperAddress,
                    ConsigneeName : houseJob.ConsigneeName,
                    ConsigneeAddress : houseJob.ConsigneeAddress,
                    DestinationAgent : houseJob.DestinationAgent,
                    MBLDate : houseJob.MBLDate,
                    MasterJobSid : houseJob.MasterJobSid,
                    POL : houseJob.POL,
                    POD : houseJob.POD,
                    FreightTerms : houseJob.FreightTerms,
                });
            }
            return allCreatedHouseJobs
        } catch (error) {
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
                const parseDate = (value: any): Date | undefined => {
                    if (!value) return undefined;
                    if (value instanceof Date) return value;
                    const date = new Date(value);
                    return isNaN(date.getTime()) ? undefined : date;
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
                    DGBookingDate: parseDate(masterJobData.DGBookingDate),
                    DGApprovedDate: parseDate(masterJobData.DGApprovedDate),
                    CommodityDescription: masterJobData.CommodityDescription?.substring(0, 3000) || '',
                    MarksandNumber: masterJobData.MarksandNumber?.substring(0, 500) || '',
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
            if (!agent) {
                errors.push({
                    field: 'Destination Agent Name',
                    message: `Destination agent '${masterJobData.DestinationAgentName}' not found in customer master`,
                    sheet: 'Master Job',
                    row: 2
                });
            }
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
                if (!houseJob.CustomerName) {
                    errors.push({
                        field: 'Customer Name',
                        message: 'Customer Name is required',
                        sheet: 'House Jobs',
                        row: rowNum
                    });
                } else if (companyMasterSid) {
                    const customer = await this.lookupCustomerByName(houseJob.CustomerName, companyMasterSid);
                    if (!customer) {
                        errors.push({
                            field: 'Customer Name',
                            message: `Customer '${houseJob.CustomerName}' not found in customer master`,
                            sheet: 'House Jobs',
                            row: rowNum
                        });
                    }
                }

                // Validate Shipper Name if provided
                if (houseJob.ShipperName && companyMasterSid) {
                    const shipper = await this.lookupCustomerByName(houseJob.ShipperName, companyMasterSid);
                    if (!shipper) {
                        errors.push({
                            field: 'Shipper Name',
                            message: `Shipper '${houseJob.ShipperName}' not found in customer master`,
                            sheet: 'House Jobs',
                            row: rowNum
                        });
                    }
                }

                // Validate Consignee Name if provided
                if (houseJob.ConsigneeName && companyMasterSid) {
                    const consignee = await this.lookupCustomerByName(houseJob.ConsigneeName, companyMasterSid);
                    if (!consignee) {
                        errors.push({
                            field: 'Consignee Name',
                            message: `Consignee '${houseJob.ConsigneeName}' not found in customer master`,
                            sheet: 'House Jobs',
                            row: rowNum
                        });
                    }
                }

                // Validate Agent Name if provided
                if (houseJob.AgentName && companyMasterSid) {
                    const agent = await this.lookupCustomerByName(houseJob.AgentName, companyMasterSid);
                    if (!agent) {
                        errors.push({
                            field: 'Agent Name',
                            message: `Agent '${houseJob.AgentName}' not found in customer master`,
                            sheet: 'House Jobs',
                            row: rowNum
                        });
                    }
                }

                // Validate Port Codes
                if (!houseJob.POL) {
                    errors.push({
                        field: 'POL (Port Code)',
                        message: 'Port of Loading is required',
                        sheet: 'House Jobs',
                        row: rowNum
                    });
                } else {
                    const port = await this.lookupPortByCode(houseJob.POL);
                    if (!port) {
                        errors.push({
                            field: 'POL (Port Code)',
                            message: `Port code '${houseJob.POL}' not found in master data`,
                            sheet: 'House Jobs',
                            row: rowNum
                        });
                    }
                }

                if (!houseJob.POD) {
                    errors.push({
                        field: 'POD (Port Code)',
                        message: 'Port of Discharge is required',
                        sheet: 'House Jobs',
                        row: rowNum
                    });
                } else {
                    const port = await this.lookupPortByCode(houseJob.POD);
                    if (!port) {
                        errors.push({
                            field: 'POD (Port Code)',
                            message: `Port code '${houseJob.POD}' not found in master data`,
                            sheet: 'House Jobs',
                            row: rowNum
                        });
                    }
                }

                // Validate POO and FPD if provided
                if (houseJob.POO) {
                    const port = await this.lookupPortByCode(houseJob.POO);
                    if (!port) {
                        errors.push({
                            field: 'POO (Port Code)',
                            message: `Port code '${houseJob.POO}' not found in master data`,
                            sheet: 'House Jobs',
                            row: rowNum
                        });
                    }
                }

                if (houseJob.FPD) {
                    const port = await this.lookupPortByCode(houseJob.FPD);
                    if (!port) {
                        errors.push({
                            field: 'FPD (Port Code)',
                            message: `Port code '${houseJob.FPD}' not found in master data`,
                            sheet: 'House Jobs',
                            row: rowNum
                        });
                    }
                }
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

}
