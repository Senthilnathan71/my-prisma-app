import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OperationCommonService } from '../operation-common/operation-common.service';

@Injectable()
export class HouseJobService {
    constructor(
        private _db: DatabaseService,
        private commonService: OperationCommonService
    ) { }

    async getHouseJobById(HouseJobSid: number) {
        try {
            const ourHouseJob = await this._db.houseJob.findUnique({
                where: {
                    HouseJobSid: HouseJobSid
                },
                include: {
                    Cargo: {
                        where : {status : 'A'}
                    },
                    Connections: {
                        where : {status : 'A'}
                    },
                    Others: {
                        where : {status : 'A'}
                    },
                    Products: {
                        where : {status : 'A'}
                    }
                }
            })
            if(!ourHouseJob){
                throw new BadRequestException('Error fetching house job record.');
            }
            const costRevenuePayload = {
                CompanyMasterSid : ourHouseJob.CompanyMasterSid,
                BranchMasterSid : ourHouseJob.BranchMasterSid!,
                ShipmentNo : ourHouseJob.ShipmentNo!,
                MenuMasterSid : ourHouseJob.MenuMasterSid!,
                TransactionSid : ourHouseJob.HouseJobSid
            }

            const costRevenueCharges = await this.commonService.getAllCostRevenueCharges(costRevenuePayload);

            return {
                ...ourHouseJob,
                costRevenueCharges,

            }
        } catch (error) {
            throw error;
        }
    }
    async updateHouseJobById(HouseJobSid: number, payload: any) {
        try {
            const updatedHouseJob = await this._db.$transaction(async (prisma) => {
                return await prisma.houseJob.update({
                    where: {
                        HouseJobSid: HouseJobSid
                    },
                    data: {
                        MasterJobSid: payload.MasterJobSid || null,
                        BookingHeaderSid : payload.BookingHeaderSid || null,
                        ColoadedBy : payload.ColoadedBy || '',
                        BookingNo : payload.BookingNo || '',
                        BookingDateTime : payload.BookingDateTime || null,
                        CompanyMasterSid : payload.CompanyMasterSid || null,
                        BranchMasterSid : payload.BranchMasterSid || null,
                        CustomerMasterSid : payload.CustomerMasterSid || null,
                        CustomerName : payload.CustomerName || '',
                        CustomerAddress : payload.CustomerAddress || '',
                        SalesmanSid : payload.SalesmanSid || null,
                        CargoExpectedon : payload.CargoExpectedon || null,
                        FreightTerms : payload.FreightTerms || '',
                        POO : payload.POO || '',
                        POL : payload.POL || '',
                        POD : payload.POD || '',
                        FPD : payload.FPD || '',
                        TsPortSid : payload.TsPortSid || null,
                        POLTerminal : payload.POLTerminal || '',
                        VoyageMasterSid : payload.VoyageMasterSid || null,
                        VesselName : payload.VesselName || '',
                        VoyageNo : payload.VoyageNo || '',
                        ETD : payload.ETD ? new Date(payload.ETD) : null,
                        ETA : payload.ETA ? new Date(payload.ETA) : null,
                        IncoTerms : payload.IncoTerms || '',
                        BLLocation : payload.BLLocation || null,
                        ShipperName : payload.ShipperName || '',
                        ShipperAddress : payload.ShipperAddress || '',
                        ConsigneeName : payload.ConsigneeName || '',
                        ConsigneeAddress : payload.ConsigneeAddress || '',
                        ClearanceRequire : payload.ClearanceRequire || '',
                        ShipmentType : payload.ShipmentType || '',
                        DestinationAgent : payload.DestinationAgent,
                        AgentName : payload.AgentName || '',
                        AgentAddress : payload.AgentAddress || '',
                        HouseNo : payload.HouseNo || '',
                        QuotationHeaderSid : payload.QuotationHeaderSid || null,
                        EnquiryHeaderSid : payload.EnquiryHeaderSid || null,
                        MovementType : payload.MovementType || '',
                        DoValid : payload.DoValid || null,
                        IsServiceJob : payload.IsServiceJob || '',
                        createdBy : payload.createdBy || '',
                        updatedBy : payload.updatedBy || '',
                        status : payload.status || '',
                        BookingStatus : payload.BookingStatus || '',
                        DepartmentMasterSid : payload.DepartmentMasterSid,
                        CustomerBranchSid : payload.CustomerBranchSid || null,
                        AuthorizerRemarks : payload.AuthorizerRemarks || '',
                        authorizerStatus : payload.authorizerStatus,
                        MenuMasterSid : payload.MenuMasterSid,
                        CarrierSid : payload.CarrierSid || null,
                        CarrierName : payload.CarrierName || '',
                        Coload : payload.Coload || '',
                        GeneralNote : payload.GeneralNote || '',
                        HBLNo : payload.HBLNo || '',
                        InternalNote : payload.InternalNote || '',
                        MBLDate : payload.MBLDate || null,
                        MBLNo : payload.MBLNo || '',
                        Nominated : payload.Nominated || '',
                        NominatedBy : payload.NominatedBy || '',
                        Notify : payload.Notify || '',
                        NotifyAddress : payload.NotifyAddress || '',
                        PODTerminal : payload.PODTerminal || '',
                        ShipmentNo : payload.ShipmentNo || '',
                        OriginAgent : payload.OriginAgent || ''
                    }
                })
            })

            let finalHouseJobCargo;
            const cargoPayload = payload.houseJobCargo || [];
            const HouseJobCargoSid = cargoPayload.HouseJobCargoSid;
            if (HouseJobCargoSid) {
                finalHouseJobCargo = await this._db.houseJobCargo.update({
                    where: {
                        HouseJobCargoSid: HouseJobCargoSid
                    },
                    data: {
                        HouseJobSid,
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        BranchMasterSid: payload.BranchMasterSid || null,
                        NoOfPackage: Number(cargoPayload.NoOfPackage) || 0,
                        FreightAmount: String(cargoPayload.FreightAmount) || "0",
                        CargoType: cargoPayload.CargoType,
                        WeightUnitSid: cargoPayload.WeightUnit || 0,
                        GrossWeight: Number(cargoPayload.GrossWeight) || 0,
                        NetWeight: Number(cargoPayload.NetWeight) || 0,
                        Volume: Number(cargoPayload.Volume) || 0,
                        ChargeableWeight: Number(cargoPayload.ChargeableWeight) || 0,
                        PackageType: cargoPayload.PackageType || 0,
                        Qty: Number(cargoPayload.Qty) || 0,
                        ShipmentTerms: cargoPayload.ShipmentTerms || '',
                        createdBy: payload.createdBy,
                        updatedBy: payload.updatedBy || null,
                        status: 'A',
                        FreightTerms: cargoPayload.FreightTerms || '',
                        MovementType: cargoPayload.MovementType || '',
                        ModeOfTransport: cargoPayload.ModeOfTransport || '',
                        NoofContainers: Number(cargoPayload.NoofContainers) || 0,
                        StuffingAt: cargoPayload.StuffingAt || ''
                    }
                })
            } else {
                finalHouseJobCargo = await this._db.houseJobCargo.create({
                    data: {
                        HouseJobSid,
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        BranchMasterSid: payload.BranchMasterSid || null,
                        NoOfPackage: Number(cargoPayload.NoOfPackage) || 0,
                        FreightAmount: String(cargoPayload.FreightAmount) || "0",
                        CargoType: cargoPayload.CargoType,
                        WeightUnitSid: cargoPayload.WeightUnit || 0,
                        GrossWeight: Number(cargoPayload.GrossWeight) || 0,
                        NetWeight: Number(cargoPayload.NetWeight) || 0,
                        Volume: Number(cargoPayload.Volume) || 0,
                        ChargeableWeight: Number(cargoPayload.ChargeableWeight) || 0,
                        PackageType: cargoPayload.PackageType || 0,
                        Qty: Number(cargoPayload.Qty) || 0,
                        ShipmentTerms: cargoPayload.ShipmentTerms || '',
                        createdBy: payload.createdBy,
                        updatedBy: payload.updatedBy || null,
                        status: 'A',
                        FreightTerms: cargoPayload.FreightTerms || '',
                        MovementType: cargoPayload.MovementType || '',
                        ModeOfTransport: cargoPayload.ModeOfTransport || '',
                        NoofContainers: Number(cargoPayload.NoofContainers) || 0,
                        StuffingAt: cargoPayload.StuffingAt || ''
                    }
                    
                })
            }

            let finalHouseJobProduct : any[] = [];
            const houseJobProductPayload:any = payload.houseJobProduct || [];
            if (houseJobProductPayload.length > 0) {
                for (const product of houseJobProductPayload) {
                    let createdProduct;
                    let updatedProduct;
                    if (product.HouseJobProductSid) {
                        updatedProduct = await this._db.houseJobProduct.update({
                            where: {
                                HouseJobProductSid: product.HouseJobProductSid
                            },
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                ProductName: product.ProductName || '',
                                ProductDescription: product.ProductDescription || '',
                                ShippingBillNo: product.ShippingBillNo || '',
                                ShippingBillDate: product.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
                                ExternaPkg: product.ExternaPkg,
                                ExternlQty: String(product.ExternlQty) || null,
                                GrossWeight: Number(product.GrossWeight) || 0,
                                ActualGrWeight: Number(product.GrossWeight) || 0,
                                NetWeight: Number(product.NetWeight) || 0,
                                Volume: Number(product.Volume) || 0,
                                ActualVolume: Number(product.Volume) || 0,
                                RecdPack: product.RecdPack || '',
                                CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                                CFS: product.CFS || '',
                                updatedBy: payload.updatedBy,
                                status: product.status ? String(product.status).charAt(0) : 'A',
                                Height: product.Height || 0,
                                ImcoClass: product.ImcoClass || '',
                                IsHaz: product.IsHaz || 'N',
                                Length: product.Length || 0,
                                PkgGroup: product.PkgGroup || '',
                                UnNo: product.UnNo || '',
                                Width: product.Width || 0,
                                UomMasterSid: product.UomMasterSid || null,
                                ContainerNo : product.ContainerNo,
                                MarksAndNumber : product.MarksAndNumber
                            }
                        })
                    } else {
                        createdProduct = await this._db.houseJobProduct.create({
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                ProductName: product.ProductName || '',
                                ProductDescription: product.ProductDescription || '',
                                ShippingBillNo: product.ShippingBillNo || '',
                                ShippingBillDate: product.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
                                ExternaPkg: product.ExternaPkg,
                                ExternlQty: String(product.ExternlQty) || null,
                                GrossWeight: Number(product.GrossWeight) || 0,
                                ActualGrWeight: Number(product.GrossWeight) || 0,
                                NetWeight: Number(product.NetWeight) || 0,
                                Volume: Number(product.Volume) || 0,
                                ActualVolume: Number(product.Volume) || 0,
                                RecdPack: product.RecdPack || '',
                                CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                                CFS: product.CFS || '',
                                createdBy: payload.createdBy,
                                status: product.status ? String(product.status).charAt(0) : 'A',
                                Height: product.Height || 0,
                                ImcoClass: product.ImcoClass || '',
                                IsHaz: product.IsHaz || 'N',
                                Length: product.Length || 0,
                                PkgGroup: product.PkgGroup || '',
                                UnNo: product.UnNo || '',
                                Width: product.Width || 0,
                                UomMasterSid: product.UomMasterSid || null,
                                ContainerNo : product.ContainerNo,
                                MarksAndNumber : product.MarksAndNumber
                            }
                        })
                    }
                    finalHouseJobProduct.push(updatedProduct || createdProduct);
                }
            }
            console.log(finalHouseJobProduct);

            let finalHouseConnections : any[] = [];
            const houseConnectionPayload = payload.houseConnections || [];
            if (houseConnectionPayload.length > 0) {
                for (const connection of houseConnectionPayload) {
                    let createdConnection;
                    let updatedConnection;
                    if (connection.HouseJobConnectionSid) {
                        updatedConnection = await this._db.houseJobConnection.update({
                            where: {
                                HouseJobConnectionSid: connection.HouseJobConnectionSid
                            },
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: connection.ETD ? new Date(connection.ETD) : null,
                                ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks,
                                updatedBy: payload.updatedBy,
                                status: String(connection.status).charAt(0) || 'A',
                            }
                        })
                    }
                    else {
                        createdConnection = await this._db.houseJobConnection.create({
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: connection.ETD ? new Date(connection.ETD) : null,
                                ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks,
                                status: String(connection.status).charAt(0) || 'A',
                                createdBy: payload.createdBy,
                            }
                        })
                    }
                    finalHouseConnections.push(updatedConnection || createdConnection);
                }
            }

            let finalHouseJobOthers;
            const otherPayload = payload.houseJobOthers || [];
            const HouseJobOthersSid = otherPayload.HouseJobOthersSid;
            if (HouseJobOthersSid) {
                finalHouseJobOthers = await this._db.houseJobOthers.update({
                    where: {
                        HouseJobOthersSid: HouseJobOthersSid
                    },
                    data: {
                        HouseJobSid: updatedHouseJob.HouseJobSid,
                        CustomerRefNo: otherPayload.CustomerRefNo || '',
                        CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                        CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                        DocumentationUser: otherPayload.DocumentationUser || '',
                        CustomerServiceuser: otherPayload.CustomerServiceuser || '',
                        NotifyParty: otherPayload.NotifyParty || '',
                        NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                        CHAName: otherPayload.CHAName || '',
                        PickupMode: otherPayload.PickupMode || '',
                        YardCFS: otherPayload.YardCFS || '',
                        LocalTransport: otherPayload.LocalTransport || '',
                        OverseasTransport: otherPayload.OverseasTransport || '',
                        OverseasClearance: otherPayload.OverseasClearance || '',
                        PickupPlace: otherPayload.PickupPlace || '',
                        PickupDate: otherPayload.PickupDate ? new Date(otherPayload.PickupDate) : null,
                        PickupAddress: otherPayload.PickupAddress || '',
                        DeliveryPlace: otherPayload.DeliveryPlace || '',
                        DeliveryDate: otherPayload.DeliveryDate,
                        DeliveryAddress: otherPayload.DeliveryAddress || '',
                        CargoCurrency: otherPayload.CargoCurrency || '',
                        CargoValue: Number(otherPayload.CargoValue) || 0,
                        DeliveryMode: otherPayload.DeliveryMode || '',
                        ExternalRemarks: otherPayload.ExternalRemarks || '',
                        SwitchBL: otherPayload.SwitchBL || '',
                        TransporterName: otherPayload.TransporterName || '',
                        createdBy: payload.createdBy,
                        updatedBy: payload.updatedBy || null,
                        status: 'A',
                        Forwarder: otherPayload.Forwarder || '',
                        ForwarderAddress: otherPayload.ForwarderAddress || '',
                        HBLNo: otherPayload.HBLNo || '',
                        BacktoBack: otherPayload.BacktoBack || '',
                        Depo: otherPayload.Depo || '',
                        ROValidity: otherPayload.ROValidity || '',
                        ReleaseType: otherPayload.ReleaseType || '',
                        AgentAddress: otherPayload.AgentAddress || '',
                        SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                        SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                        SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                        SwitchLocation: otherPayload.SwitchLocation || '',
                        Coloader: otherPayload.Coloader || '',
                        Notify2: otherPayload.Notify2 || '',
                        NotifyAddress2: otherPayload.NotifyAddress2 || ''
                        
                    }
                })
            } else {
                finalHouseJobOthers = await this._db.houseJobOthers.create({
                    data: {
                        HouseJobSid: updatedHouseJob.HouseJobSid,
                        CustomerRefNo: otherPayload.CustomerRefNo,
                        CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                        CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                        DocumentationUser: otherPayload.DocumentationUser || '',
                        CustomerServiceuser: otherPayload.CustomerServiceuser || '',
                        NotifyParty: otherPayload.NotifyParty || '',
                        NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                        CHAName: otherPayload.CHAName || '',
                        PickupMode: otherPayload.PickupMode || '',
                        YardCFS: otherPayload.YardCFS || '',
                        LocalTransport: otherPayload.LocalTransport || '',
                        OverseasTransport: otherPayload.OverseasTransport || '',
                        OverseasClearance: otherPayload.OverseasClearance || '',
                        PickupPlace: otherPayload.PickupPlace || '',
                        PickupDate: otherPayload.PickupDate ? new Date(otherPayload.PickupDate) : null,
                        PickupAddress: otherPayload.PickupAddress || '',
                        DeliveryPlace: otherPayload.DeliveryPlace || '',
                        DeliveryDate: otherPayload.DeliveryDate,
                        DeliveryAddress: otherPayload.DeliveryAddress || '',
                        CargoCurrency: otherPayload.CargoCurrency || '',
                        CargoValue: Number(otherPayload.CargoValue) || 0,
                        DeliveryMode: otherPayload.DeliveryMode || '',
                        ExternalRemarks: otherPayload.ExternalRemarks || '',
                        SwitchBL: otherPayload.SwitchBL || '',
                        TransporterName: otherPayload.TransporterName || '',
                        createdBy: payload.createdBy,
                        updatedBy: payload.updatedBy || null,
                        status: 'A',
                        Forwarder: otherPayload.Forwarder || '',
                        ForwarderAddress: otherPayload.ForwarderAddress || '',
                        HBLNo: otherPayload.HBLNo || '',
                        BacktoBack: otherPayload.BacktoBack || '',
                        Depo: otherPayload.Depo || '',
                        ROValidity: otherPayload.ROValidity || '',
                        ReleaseType: otherPayload.ReleaseType || '',
                        AgentAddress: otherPayload.AgentAddress || '',
                        SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                        SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                        SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                        SwitchLocation: otherPayload.SwitchLocation || '',
                        Coloader: otherPayload.Coloader || '',
                        Notify2: otherPayload.Notify2 || '',
                        NotifyAddress2: otherPayload.NotifyAddress2 || ''
                    }
                    
                })
            }

            return updatedHouseJob;
        }
        catch (error) {
            throw error;
        }
    }


    async getHouseJobByBookingNo(BookingNumber: string) {
            try {
                const ourBooking = await this._db.houseJob.findFirst({
                    where: {
                        BookingNo: BookingNumber
                    },
                    include: {
                        Cargo: { where: { status: 'A' } },
                        Products: { where: { status: 'A' } },
                        Others: { where: { status: 'A' } },
                        Connections: { where: { status: 'A' } }
                    }
                })
    
                if (!ourBooking) {
                    throw new BadRequestException('Error fetching booking record.');
                }

                let voyageDetails;
                if (ourBooking.VoyageMasterSid) {
                    const data = await this._db.voyageMasterHeader.findUnique({
                        where: {
                            VoyageMasterHeaderSid: ourBooking.VoyageMasterSid
                        },
                        include: {
                            voyageMasterDetail: {
                                where: {
                                    status: 'A'
                                },
                                select: {
                                    ETA: true,
                                    ETD: true,
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
                    const POL = data?.voyageMasterDetail.find(vd => vd.portMasterPOL?.PortCode === ourBooking.POL);
                    const POD = data?.voyageMasterDetail.find(vd => vd.portMasterPOL?.PortCode === ourBooking.POD);
                    voyageDetails = {
                        POLETA: POL?.ETA,
                        POLETD: POL?.ETD,
                        PODETA: POD?.ETA,
                        PODETD: POD?.ETD,
                        POLCutOffDate: POL?.PortCutoff,
                        PODCutOffDate: POD?.PortCutoff
                    }
                }
    
                return {
                    ...ourBooking,
                    voyageDetails
                }
            } catch (error) {
                throw error;
            }
        }

    async getMasterJobContainersByMasterJobSid(MasterJobSid: number) {
        try {
            const ourMasterJobContainers = await this._db.masterJobContainer.findMany({
                where : {
                    MasterJobSid : MasterJobSid,
                    Status : 'A'
                }
            })
            return ourMasterJobContainers;
        } catch (error) {
            throw error;
        }
    }

}
