import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';
import { Prisma } from '@prisma/client';
import { create } from 'domain';
import { stat } from 'fs';
import { parseDateFromString } from 'src/common/helper';
import { LoadingPlanService } from '../loading-plan/loading-plan.service';
@Injectable()
export class MasterJobService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
        private loadingPlanService: LoadingPlanService,
    ) { }

    async createNewMasterJob(payload: any) {
        try {

            const newMasterJob = await this._db.$transaction(async (prisma) => {
                const dateString = moment().format('YYYYMMDD');
                const count = await prisma.masterJob.count({
                    where: { MasterJobNumber: { contains: dateString } }
                })
                const MasterJobNumber = `MASTER-${dateString}-${(count + 1).toString().padStart(3, '0')}`;

                const headerPayload = {
                    MasterJobNumber: MasterJobNumber,
                    MasterJobDate: payload.MasterJobDate ? new Date(payload.MasterJobDate) : new Date(),
                    CreatedBy: payload.CreatedBy,
                    Status: "A",
                    MenuMasterSid: payload.MenuMasterSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    DepartmentMasterSid: payload.DepartmentMasterSid,
                    FreightPPCC: payload.FreightPPCC || 'Prepaid',
                    DestinationAgent: payload.DestinationAgent,
                    DestinationAgentName: payload.DestinationAgentName,
                    DestinationAgentAddress: payload.DestinationAgentAddress?.substring(0, 20) || '',
                    MBLNo: MasterJobNumber,
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
                const allCostRevenueCharges = payload?.costRevenueCharges || [];
                if (allCostRevenueCharges.length > 0) {
                    const costRevenueChargesPayload = allCostRevenueCharges.map(item => ({
                        TransactionSid: createdMasterJob.MasterJobSid,
                        MenuMasterSid: payload.MenuMasterSid,
                        ShipmentNo: createdMasterJob.MasterJobNumber,
                        MasterJobNo: createdMasterJob.MasterJobNumber,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        SerialNumber: item.SerialNumber ? Number(item.SerialNumber) : null,
                        ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                        ChargeDescription: item.ChargeDescription,
                        ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                        Cost: item.PrepaidCollect,
                        // CostRevenue: item.CostRevenue,
                        CostCurrencyMasterSid: item.CurrencyMasterSid ? Number(item.CurrencyMasterSid) : null,
                        ExchangeRate: item.ExchangeRate ? Number(item.ExchangeRate) : null,
                        Rate: item.Rate ? Number(item.Rate) : null,
                        NumberOfUnit: item.NumberOfUnit ? Number(item.NumberOfUnit) : null,
                        DrCr: item.DrCr,
                        Amount: item.Amount ? Number(item.Amount) : null,
                        LocalAmount: item.LocalAmount ? Number(item.LocalAmount) : null,
                        CustomerMasterSid: item.CustomerMasterSid ? Number(item.CustomerMasterSid) : null,
                        CustomerBranchSid: item.CustomerBranchSid ? Number(item.CustomerBranchSid) : null,
                        VoucherHeaderSid: null,
                        VoucherTypeSid: null,
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

                return createdMasterJob;
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
                        bookingCargo: { where : {status : 'A'} },
                        bookingProduct: { where : { status : 'A' } },
                        bookingOthers: { where : { status : 'A' } },
                        bookingConnection: { where : { status : 'A' } },
                        bookingRates: { where : { Status : 'A' } }
                    },
                });

                const dateString = moment().format('YYYYMMDD');
                let hblBaseCount = await this._db.houseJob.count({
                    where: { BookingNo: { contains: dateString } },
                });
                let hblSerial = hblBaseCount;

                const allCreatedHouseJobs: any[] = [];
                for (const booking of allBookings) {
                    const { bookingCargo, bookingProduct, bookingOthers, bookingConnection, bookingRates, ...bookingHeader } = booking;

                    hblSerial += 1;
                    const HBLNo = `HOUSE-${dateString}-${hblSerial.toString().padStart(3, '0')}`;

                    // Step 1: Create main house job
                    const houseJob = await this._db.houseJob.create({
                        data: {
                            MasterJobSid: newMasterJob.MasterJobSid,
                            createdBy : bookingHeader.createdBy || '',
                            status : bookingHeader.status || '',
                            MenuMasterSid: bookingHeader.MenuMasterSid || null,
                            CompanyMasterSid: bookingHeader.CompanyMasterSid,
                            BranchMasterSid: bookingHeader.BranchMasterSid!,
                            QuotationHeaderSid: bookingHeader.QuotationHeaderSid || null,
                            DepartmentMasterSid: bookingHeader.DepartmentMasterSid,
                            ShipmentNo: bookingHeader.ShipmentNo || '',
                            BookingHeaderSid: bookingHeader.BookingHeaderSid || null,
                            BookingNo: bookingHeader.BookingNo || '',
                            HBLNo,
                            CustomerMasterSid: bookingHeader.CustomerMasterSid!,
                            CustomerName: bookingHeader.CustomerName || '',
                            CustomerAddress: bookingHeader.CustomerAddress || '',
                            CustomerBranchSid: bookingHeader.CustomerBranchSid || null,
                            SalesmanSid: bookingHeader.SalesmanSid || null,
                            IncoTerms: bookingHeader.IncoTerms || '',
                            FreightTerms: bookingHeader.FreightTerms || '',
                            DestinationAgent: bookingHeader.DestinationAgent,
                            AgentName: bookingHeader.AgentName || '',
                            AgentAddress: bookingHeader.AgentAddress || '',
                            ShipperName: bookingHeader.ShipperName || '',
                            ShipperAddress: bookingHeader.ShipperAddress || '',
                            ConsigneeName: bookingHeader.ConsigneeName || '',
                            ConsigneeAddress: bookingHeader.ConsigneeAddress || '',
                            ShipmentType: bookingHeader.ShipmentType || '',
                            NominatedBy: bookingHeader.NominatedBy || '',
                            VoyageMasterSid: bookingHeader.VoyageMasterSid || null,
                            VesselName: bookingHeader.VesselName || '',
                            VoyageNo: bookingHeader.VoyageNo || '',
                            CarrierSid: bookingHeader.CarrierSid || null,
                            POO: bookingHeader.POO || '',
                            POL: bookingHeader.POL || '',
                            POD: bookingHeader.POD || '',
                            FPD: bookingHeader.FPD || '',
                            TsPortSid: bookingHeader.TsPortSid || null,
                            POLTerminal: bookingHeader.POLTerminal || '',
                            PODTerminal: bookingHeader.PODTerminal || '',
                            ETD: bookingHeader.ETD ? new Date(bookingHeader.ETD) : null,
                            ETA: bookingHeader.ETA ? new Date(bookingHeader.ETA) : null,
                            Coload: bookingHeader.Coload || '',
                            ColoadedBy: bookingOthers[0].Coloader || '',
                            BLLocation: bookingHeader.BLLocation || null,
                            ClearanceRequire: bookingHeader.ClearanceRequire || '',
                            MovementType: bookingHeader.MovementType || '',
                            DoValid: bookingHeader.DoValid ? new Date(bookingHeader.DoValid) : null,
                            IsServiceJob: bookingHeader.IsServiceJob || '',
                        },
                    }).catch(err => {
                        console.error('HouseJobCargo createMany error:', err);
                    });

                    if (!houseJob) continue;

                    if (bookingCargo?.length) {
                        await this._db.houseJobCargo.createMany({
                            data: bookingCargo.map((cargo) => ({
                                HouseJobSid: houseJob.HouseJobSid,
                                createdBy: cargo.createdBy,
                                updatedBy: cargo.updatedBy || null,
                                status: 'A',
                                CompanyMasterSid: cargo.CompanyMasterSid,
                                BranchMasterSid: cargo.BranchMasterSid!,
                                CargoType: cargo.CargoType,
                                ContainerType: cargo.ContainerType,
                                NoofContainers : Number(cargo.NoofContainers) || 0,
                                GrossWeight: cargo.GrossWeight || 0,
                                NetWeight: cargo.NetWeight || 0,
                                Volume: cargo.Volume || 0,
                                ChargeableWeight: cargo.ChargeableWeight || 0,
                                PackageType: cargo.PackageType || null,
                                NoOfPackage: cargo.NoOfPackage || 0,
                                FreightAmount: cargo.FreightAmount || '',
                                WeightUnitSid: cargo.WeightUnitSid || null,
                                ShipmentTerms: cargo.ShipmentTerms || '',
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
                                // ETD: connection.ETD ? new Date(connection.ETD) : null,
                                // ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks || '',
                                status : 'A',
                                createdBy: connection.createdBy,
                                updatedBy: connection.updatedBy || null,
                            })),
                            skipDuplicates: true,
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
                                DeliveryDate:  other.DeliveryDate,
                                DeliveryAddress: other.DeliveryAddress,
                                CargoCurrency: other.CargoCurrency,
                                CargoValue: other.CargoValue,
                                DeliveryMode: other.DeliveryMode,
                                ExternalRemarks: other.ExternalRemarks,
                                // GeneralNote: other.GeneralNote,
                                SwitchBL: other.SwitchBL,
                                TransporterName: other.TransporterName,
                                createdBy: payload.createdBy,
                                Coloader: other.Coloader,
                                // CoLoader: other.CoLoader,
                                // NominatedBy: other.NominatedBy,
                            }
                        }).catch(err => {
                            console.error('HouseJobOthers create error:', err);
                        });
                    }

                    await this._db.bookingHeader.update({
                        where: { BookingHeaderSid: bookingHeader.BookingHeaderSid },
                        data: {
                            HouseNo: houseJob.HBLNo,
                            MasterNoSid: newMasterJob.MasterJobSid,
                            MBLNo: newMasterJob.MBLNo,
                            MBLDate: newMasterJob.MBLDate,
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
                for (const hblNo of houseJobNeedUpdateIds) {
                    const ourBooking = await this._db.houseJob.findFirst({
                        where: {
                            HBLNo: hblNo
                        }
                    })
                    if (!ourBooking) continue;
                    const updatedHouseJob = await this._db.houseJob.update({
                        where: { HouseJobSid: ourBooking.HouseJobSid },
                        data: {
                            MasterJobSid: newMasterJob.MasterJobSid,
                        }
                    }).catch(err => {
                        console.error('houseJob update error:', err);
                    });
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
                for (const item of allCostRevenueCharges) {
                    let createdCharge;
                    let updatedCharge;
                    if (item.CostRevenueChargesSid) {
                        // update
                        const costRevenueChargesPayload = {
                            SerialNumber: item.SerialNumber ? Number(item.SerialNumber) : null,
                            ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                            ChargeDescription: item.ChargeDescription,
                            ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                            PrepaidCollect: item.PrepaidCollect,
                            CostRevenue: item.CostRevenue,
                            CurrencyMasterSid: item.CurrencyMasterSid ? Number(item.CurrencyMasterSid) : null,
                            ExchangeRate: item.ExchangeRate ? Number(item.ExchangeRate) : null,
                            Rate: item.Rate ? Number(item.Rate) : null,
                            NumberOfUnit: item.NumberOfUnit ? Number(item.NumberOfUnit) : null,
                            DrCr: item.DrCr,
                            Amount: item.Amount ? Number(item.Amount) : null,
                            LocalAmount: item.LocalAmount ? Number(item.LocalAmount) : null,
                            CustomerMasterSid: item.CustomerMasterSid ? Number(item.CustomerMasterSid) : null,
                            CustomerBranchSid: item.CustomerBranchSid ? Number(item.CustomerBranchSid) : null,
                            Remarks: item.Remarks
                        }
                        updatedCharge = await prisma.costRevenueCharges.update({
                            where: {
                                CostRevenueChargesSid: item.CostRevenueChargesSid
                            },
                            data: costRevenueChargesPayload
                        })
                    } else {
                        // create
                        const costRevenueChargesPayload = {
                            TransactionSid: payload.MasterJobSid,
                            MenuMasterSid: payload.MenuMasterSid,
                            ShipmentNo: updatedMasterJob.MasterJobNumber,
                            MasterJobNo: updatedMasterJob.MasterJobNumber,
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            SerialNumber: item.SerialNumber ? Number(item.SerialNumber) : null,
                            ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                            ChargeDescription: item.ChargeDescription,
                            ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                            PrepaidCollect: item.PrepaidCollect,
                            CostRevenue: item.CostRevenue,
                            CurrencyMasterSid: item.CurrencyMasterSid ? Number(item.CurrencyMasterSid) : null,
                            ExchangeRate: item.ExchangeRate ? Number(item.ExchangeRate) : null,
                            Rate: item.Rate ? Number(item.Rate) : null,
                            NumberOfUnit: item.NumberOfUnit ? Number(item.NumberOfUnit) : null,
                            DrCr: item.DrCr,
                            Amount: item.Amount ? Number(item.Amount) : null,
                            LocalAmount: item.LocalAmount ? Number(item.LocalAmount) : null,
                            CustomerMasterSid: item.CustomerMasterSid ? Number(item.CustomerMasterSid) : null,
                            CustomerBranchSid: item.CustomerBranchSid ? Number(item.CustomerBranchSid) : null,
                            VoucherHeaderSid: item.VoucherHeaderSid ? Number(item.VoucherHeaderSid) : null,
                            VoucherTypeSid: item.VoucherTypeSid ? Number(item.VoucherTypeSid) : null,
                            createdBy: payload.CreatedBy,
                            status: "A",
                            Remarks: item.Remarks
                        }
                        // createdCharge = await prisma.costRevenueCharges.create({
                        //     data: costRevenueChargesPayload
                        // })
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
                    where: { BookingNo: { contains: dateString } },
                });
                let hblSerial = hblBaseCount;

                const allCreatedHouseJobs: any[] = [];
                for (const booking of allBookings) {
                    const { bookingCargo, bookingProduct, bookingOthers, bookingConnection, bookingRates, ...bookingHeader } = booking;

                    hblSerial += 1;
                    const HBLNo = `HOUSE-${dateString}-${hblSerial.toString().padStart(3, '0')}`;

                    // Step 1: Create main house job
                    // let houseJob = await this._db.houseJob.create({
                    //     data: {
                    //         MasterJobSid: updatedMasterJob.MasterJobSid,
                    //         CreatedBy: bookingHeader.createdBy,
                    //         UpdatedBy: bookingHeader.updatedBy,
                    //         MenuMasterSid: bookingHeader.MenuMasterSid,
                    //         CompanyMasterSid: bookingHeader.CompanyMasterSid,
                    //         BranchMasterSid: bookingHeader.BranchMasterSid!,
                    //         QuotationHeaderSid: bookingHeader.QuotationHeaderSid || null,
                    //         DepartmentMasterSid: bookingHeader.DepartmentMasterSid,
                    //         ShipmentNo: bookingHeader.ShipmentNo || '',
                    //         BookingHeaderSid: bookingHeader.BookingHeaderSid || null,
                    //         BookingNo: bookingHeader.BookingNo || '',
                    //         HBLNo,
                    //         CustomerMasterSid: bookingHeader.CustomerMasterSid || null,
                    //         CustomerName: bookingHeader.CustomerName || '',
                    //         CustomerAddress: bookingHeader.CustomerAddress || '',
                    //         CustomerBranchSid: bookingHeader.CustomerBranchSid || null,
                    //         SalesmanSid: bookingHeader.SalesmanSid || null,
                    //         IncoTerms: bookingHeader.IncoTerms || '',
                    //         FreightPPCC: bookingHeader.FreightTerms || '',
                    //         DestinationAgent: bookingHeader.DestinationAgent,
                    //         AgentName: bookingHeader.AgentName || '',
                    //         AgentAddress: bookingHeader.AgentAddress || '',
                    //         ShipperName: bookingHeader.ShipperName || '',
                    //         ShipperAddress: bookingHeader.ShipperAddress || '',
                    //         ConsigneeName: bookingHeader.ConsigneeName || '',
                    //         ConsigneeAddress: bookingHeader.ConsigneeAddress || '',
                    //         ShipmentType: bookingHeader.ShipmentType || '',
                    //         NominatedBy: bookingHeader.NominatedBy || '',
                    //         VoyageMasterSid: bookingHeader.VoyageMasterSid || null,
                    //         VesselName: bookingHeader.VesselName || '',
                    //         VoyageNo: bookingHeader.VoyageNo || '',
                    //         CarrierSid: bookingHeader.CarrierSid || null,
                    //         POO: bookingHeader.POO || '',
                    //         POL: bookingHeader.POL || '',
                    //         POD: bookingHeader.POD || '',
                    //         FPD: bookingHeader.FPD || '',
                    //         TsPortSid: bookingHeader.TsPortSid || null,
                    //         POLTerminal: bookingHeader.POLTerminal || '',
                    //         PODTerminal: bookingHeader.PODTerminal || '',
                    //         ETD: bookingHeader.ETD ? new Date(bookingHeader.ETD) : null,
                    //         ETA: bookingHeader.ETA ? new Date(bookingHeader.ETA) : null,
                    //         Coload: bookingHeader.Coload || '',
                    //         CoLoader: bookingOthers[0].Coloader || '',
                    //         BLLocation: bookingHeader.BLLocation || null,
                    //         ClearanceRequire: bookingHeader.ClearanceRequire || '',
                    //         MovementType: bookingHeader.MovementType || '',
                    //         DoValidity: bookingHeader.DoValid ? new Date(bookingHeader.DoValid) : null,
                    //         IsServiceJob: bookingHeader.IsServiceJob || '',
                    //     },
                    // }).catch(err => {
                    //     console.error('HouseJobCargo createMany error:', err);
                    // });

                    // if (!houseJob) continue;

                    // if (bookingCargo?.length) {
                    //     await this._db.houseJobCargo.createMany({
                    //         data: bookingCargo.map((cargo) => ({
                    //             HouseJobSid: houseJob.HouseJobSid,
                    //             CreatedBy: cargo.createdBy,
                    //             UpdatedBy: cargo.updatedBy || null,
                    //             Status: 'A',
                    //             CompanyMasterSid: cargo.CompanyMasterSid,
                    //             BranchMasterSid: cargo.BranchMasterSid!,
                    //             CargoType: cargo.CargoType,
                    //             ContainerType: cargo.ContainerType,
                    //             GrossWeight: cargo.GrossWeight || 0,
                    //             NetWeight: cargo.NetWeight || 0,
                    //             Volume: cargo.Volume || 0,
                    //             ChargeableWeight: cargo.ChargeableWeight || 0,
                    //             PackageType: cargo.PackageType || null,
                    //             NoOfPackage: cargo.NoOfPackage || 0,
                    //             FreightAmount: cargo.FreightAmount || 0,
                    //             WeightUnit: cargo.WeightUnitSid || null,
                    //             ShipmentTerms: cargo.ShipmentTerms || '',
                    //         }))
                    //     }).catch(err => {
                    //         console.error('HouseJobCargo createMany error:', err);
                    //     });
                    // }

                    // if (bookingProduct?.length) {
                    //     await this._db.houseJobProduct.createMany({
                    //         data: bookingProduct.map((product) => ({
                    //             HouseJobSid: houseJob.HouseJobSid,
                    //             ProductName: product.ProductName || '',
                    //             ProductDescription: product.ProductDescription || '',
                    //             ShippingBillNo: product.ShippingBillNo || '',
                    //             ShippingBillDate: product.ShippingBillDate || '',
                    //             ExternaPkg: product.ExternaPkg || '',
                    //             ExternlQty: product.ExternlQty || '',
                    //             GrossWeight: product.GrossWeight || 0,
                    //             NetWeight: product.NetWeight || 0,
                    //             Volume: product.Volume || 0,
                    //             CreatedBy: product.createdBy,
                    //             UpdatedBy: product.updatedBy || null,
                    //         }))
                    //     }).catch(err => {
                    //         console.error('HouseJobProduct createMany error:', err);
                    //     });
                    // }

                    // if (bookingConnection?.length) {
                    //     await this._db.houseJobConnection.createMany({
                    //         data: bookingConnection.map((connection) => ({
                    //             HouseJobSid: houseJob.HouseJobSid,
                    //             Mode: connection.Mode,
                    //             POL: connection.POL,
                    //             POD: connection.POD,
                    //             VesselName: connection.VesselName,
                    //             VoyageNo: connection.VoyageNo,
                    //             ETD: connection.ETD ? new Date(connection.ETD) : null,
                    //             ETA: connection.ETA ? new Date(connection.ETA) : null,
                    //             Remarks: connection.Remarks || '',
                    //             CreatedBy: connection.createdBy,
                    //             UpdatedBy: connection.updatedBy || null,
                    //         }))
                    //     }).catch(err => {
                    //         console.error('HouseJobConnection createMany error:', err);
                    //     });
                    // }

                    // if (bookingOthers?.[0]) {
                    //     await this._db.houseJobOthers.create({
                    //         data: {
                    //             HouseJobSid: houseJob.HouseJobSid,
                    //             CustomerRefNo: bookingOthers[0].CustomerRefNo || '',
                    //             OperationUser: bookingOthers[0].OperationUser || '',
                    //             DocumentationUser: bookingOthers[0].DocumentationUser || '',
                    //             CustomerServiceuser: bookingOthers[0].CustomerServiceuser || '',
                    //             NotifyParty: bookingOthers[0].NotifyParty || '',
                    //             NotifyPartyAddress: bookingOthers[0].NotifyPartyAddress || '',
                    //             CHAName: bookingOthers[0].CHAName || '',
                    //             PickupMode: bookingOthers[0].PickupMode || '',
                    //             YardCFS: bookingOthers[0].YardCFS || '',
                    //             LocalTransport: bookingOthers[0].LocalTransport || '',
                    //             OverseasTransport: bookingOthers[0].OverseasTransport || '',
                    //             OverseasClearance: bookingOthers[0].OverseasClearance || '',
                    //             PickupPlace: bookingOthers[0].PickupPlace || '',
                    //             PickupDate: bookingOthers[0].PickupDate || null,
                    //             PickupAddress: bookingOthers[0].PickupAddress || '',
                    //             DeliveryPlace: bookingOthers[0].DeliveryPlace || '',
                    //             DeliveryDate: bookingOthers[0].DeliveryDate || null,
                    //             DeliveryAddress: bookingOthers[0].DeliveryAddress || '',
                    //             CargoCurrency: bookingOthers[0].CargoCurrency || '',
                    //             CargoValue: bookingOthers[0].CargoValue || 0,
                    //             DeliveryMode: bookingOthers[0].DeliveryMode || '',
                    //             ExternalRemarks: bookingOthers[0].ExternalRemarks || '',
                    //             GeneralNote: bookingHeader.GeneralNote || '',
                    //             SwitchBL: bookingOthers[0].SwitchBL || '',
                    //             TransporterName: bookingOthers[0].TransporterName || '',
                    //             CreatedBy: bookingOthers[0].createdBy,
                    //             UpdatedBy: bookingOthers[0].updatedBy || null,
                    //             Coload: bookingHeader.Coload || '',
                    //             CoLoader: bookingOthers[0].Coloader || '',
                    //             NominatedBy: bookingHeader.NominatedBy || '',
                    //         },
                    //     }).catch(err => {
                    //         console.error('HouseJobOthers create error:', err);
                    //     });
                    // }
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

                    // allCreatedHouseJobs.push(houseJob);
                }
            }

            if (recordToUpdateShipment.length > 0) {
                let houseJobNeedUpdateIds = recordToUpdateShipment.map(shipment => shipment.HBLNo);
                for (const houseNo of houseJobNeedUpdateIds) {
                    const ourBooking = await this._db.houseJob.findFirst({
                        where: {
                            HBLNo: houseNo
                        }
                    })
                    if (!ourBooking) continue;
                    const updatedHouseJob = await this._db.houseJob.update({
                        where: { HouseJobSid: ourBooking.HouseJobSid },
                        data: {
                            MasterJobSid: updatedMasterJob.MasterJobSid,
                        }
                    }).catch(err => {
                        console.error('houseJob update error:', err);
                    });
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
                        MenuMasterSid: deletedMasterJob.MenuMasterSid!,
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


    async searchMasterJobList(params: any) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
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
                    BookingNo: detachedHouse.BookingNo
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
}
