import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import * as moment from 'moment-timezone';
import { Prisma } from '@prisma/client';
import { create } from 'domain';
import { stat } from 'fs';
import { parseDateFromString } from 'src/common/helper';
@Injectable()
export class MasterJobService {
    constructor(private _db: DatabaseService,private logger: Logger,) { }

    async createNewMasterJob(payload: any) {
        try {

            return await this._db.$transaction(async (prisma) => {
                const dateString = moment().format('YYYYMMDD');
                const count = await prisma.masterJob.count({
                    where: { MasterJobNumber: { contains: dateString } }
                })
                const MasterJobNumber = `MJ-${dateString}-${(count + 1).toString().padStart(3, '0')}`;

                const headerPayload = {
                    MasterJobNumber: MasterJobNumber,
                    MasterJobDate: new Date(),
                    CreatedBy: payload.CreatedBy,
                    Status: "A",
                    MenuMasterSid: payload.MenuMasterSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    DepartmentMasterSid: payload.DepartmentMasterSid,
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

console.log(headerPayload)
                const createdMasterJob = await prisma.masterJob.create({
                    data: headerPayload
                })
console.log(createdMasterJob)
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
                    CarrierMasterSid: payload.CarrierMasterSid,
                    CarrierName: payload.CarrierName,
                    Status: "A"
                }

                const createdVoyage = await prisma.masterJobVoyage.create({
                    data: voyagePayload
                })

                const allConnections = payload.connections || payload.masterJobConnection || [];                let createdConnections: any;
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

                const createdOther = await prisma.masterJobOthers.create({
                    data: otherPayload
                })

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
                return {
                    createdMasterJob,
                    createdVoyage,
                    createdConnections,
                    createdContainers,
                    createdCostRevenueCharges,
                    createdOther,
                    createdActivities,
                };
            });
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
                        MasterJobSid: masterJobDetails?.MasterJobSid,
                        Status: 'A'
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
                return {
                    ...masterJobDetails,
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
            return await this._db.$transaction(async (prisma) => {
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
                        MasterJobSid : payload.MasterJobSid,
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
            // update - Use the existing MasterJobSid from the container, not from payload
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
                    updatedMasterJob,
                    finalVoyage,
                    finalConnections,
                    finalMasterJobContainers,
                    finalCharges,
                    finalOthers,
                    finalContainerActivities
                }
            });
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
}
