import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class HouseJobService {
    constructor(
        private _db: DatabaseService
    ) { }

    async getHouseJobById(HouseJobSid: number) {
        try {
            const ourHouseJob = await this._db.houseJob.findUnique({
                where: {
                    HouseJobSid: HouseJobSid
                },
                include: {
                    Cargo: true,
                    Connections: true,
                    Others: true,
                    Products: true
                }
            })
            return ourHouseJob;
        } catch (error) {
            throw error;
        }
    }

    async updateHouseJobById(HouseJobSid: number, payload: any) {
        try {
            const updatedHouseJob = await this._db.$transaction(async (prisma) => {
                const updatedHouseJob = await prisma.houseJob.update({
                    where: {
                        HouseJobSid: HouseJobSid
                    },
                    data: {
                        MasterJobSid: payload.MasterJobSid || null,
                        UpdatedBy: payload.updatedBy || '',
                        Status: payload.Status || 'A',
                        MenuMasterSid: payload.MenuMasterSid || null,
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        BranchMasterSid: payload.BranchMasterSid || null,
                        QuotationHeaderSid: payload.QuotationHeaderSid || null,
                        DepartmentMasterSid: payload.DepartmentMasterSid || null,
                        ShipmentNo: payload.ShipmentNo || '',
                        BookingHeaderSid: payload.BookingHeaderSid || '',
                        BookingNo: payload.BookingNo || '',
                        HBLNo: payload.HBLNo || '',
                        CustomerMasterSid: payload.CustomerMasterSid || '',
                        CustomerName: payload.CustomerName || '',
                        CustomerAddress: payload.CustomerAddress || '',
                        CustomerBranchSid: payload.CustomerBranchSid || null,
                        SalesmanSid: payload.SalesmanSid || null,
                        IncoTerms: payload.IncoTerms || '',
                        FreightPPCC: payload.FreightPPCC || '',
                        DestinationAgent: payload.DestinationAgent || '',
                        DestinationAgentAddress: payload.DestinationAgentAddress || '',
                        AgentName: payload.AgentName || '',
                        AgentAddress: payload.AgentAddress || '',
                        ShipperName: payload.ShipperName || '',
                        ShipperAddress: payload.ShipperAddress || '',
                        ConsigneeName: payload.ConsigneeName || '',
                        ConsigneeAddress: payload.ConsigneeAddress || '',
                        ShipmentType: payload.ShipmentType || '',
                        NominatedBy: payload.NominatedBy || '',
                        VoyageMasterSid: payload.VoyageMasterSid || null,
                        VesselName: payload.VesselName || '',
                        VoyageNo: payload.VoyageNo || '',
                        CarrierSid: payload.CarrierSid || null,
                        POO: payload.POO || '',
                        POL: payload.POL || '',
                        POD: payload.POD || '',
                        FPD: payload.FPD || '',
                        TsPortSid: payload.TsPortSid || null,
                        POLTerminal: payload.POLTerminal || '',
                        PODTerminal: payload.PODTerminal || '',
                        ETD: payload.ETD ? new Date(payload.ETD) : null,
                        ETA: payload.ETA ? new Date(payload.ETA) : null,
                        Coload: payload.Coload || '',
                        CoLoader: payload.CoLoader || '',
                        BLLocation: payload.BLLocation || '',
                        ClearanceRequire: payload.ClearanceRequire || '',
                        MovementType: payload.MovementType || '',
                        DoValidity: payload.DoValidity ? new Date(payload.DoValidity) : null,
                        IsServiceJob: payload.IsServiceJob || '',
                    }
                })
                return {
                    ...updatedHouseJob
                }
            })

            let finalHouseJobCargo;
            const houseJobCargoPayload = payload.houseJobCargo || [];
            if (houseJobCargoPayload.length > 0) {
                for (const cargo of houseJobCargoPayload) {
                    let createdCargo;
                    let updatedCargo;
                    if (cargo.HouseJobCargoSid) {
                        updatedCargo = await this._db.houseJobCargo.update({
                            where: {
                                HouseJobCargoSid: cargo.HouseJobCargoSid
                            },
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
                                UpdatedBy: payload.UpdatedBy || '',
                                Status: String(cargo.Status).charAt(0) || 'A',
                                CompanyMasterSid: payload.CompanyMasterSid || null,
                                BranchMasterSid: payload.BranchMasterSid || null,
                                CargoType: cargo.CargoType || '',
                                ContainerType: cargo.ContainerType || '',
                                NoOfContainer: Number(cargo.NoOfContainer) || 0,
                                GrossWeight: Number(cargo.GrossWeight) || 0,
                                NetWeight: Number(cargo.NetWeight) || 0,
                                Volume: Number(cargo.Volume) || 0,
                                ChargeableWeight: Number(cargo.ChargeableWeight) || 0,
                                PackageType: cargo.PackageType || 0,
                                NoOfPackage: Number(cargo.NoOfPackage) || 0,
                                FreightAmount: cargo.FreightAmount || 0,
                                WeightUnit: cargo.WeightUnit || 0,
                                ShipmentTerms: cargo.ShipmentTerms || 0
                            }
                        })
                        finalHouseJobCargo.push(updatedCargo);
                    } else {
                        

                    }
                    finalHouseJobCargo.push(updatedCargo || createdCargo);
                }
            }

            let finalCargo;
            const cargo = payload.houseJobCargo;
            if (houseJobCargoPayload.HouseJobCargoSid) {
                finalCargo = await this._db.houseJobCargo.update({
                    where: {
                        HouseJobCargoSid: cargo.HouseJobCargoSid
                    },
                    data: {
                        HouseJobSid: updatedHouseJob.HouseJobSid,
                        UpdatedBy: payload.UpdatedBy || '',
                        Status: String(cargo.Status).charAt(0) || 'A',
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        BranchMasterSid: payload.BranchMasterSid || null,
                        CargoType: cargo.CargoType || '',
                        ContainerType: cargo.ContainerType || '',
                        NoOfContainer: Number(cargo.NoOfContainer) || 0,
                        GrossWeight: Number(cargo.GrossWeight) || 0,
                        NetWeight: Number(cargo.NetWeight) || 0,
                        Volume: Number(cargo.Volume) || 0,
                        ChargeableWeight: Number(cargo.ChargeableWeight) || 0,
                        PackageType: cargo.PackageType || 0,
                        NoOfPackage: Number(cargo.NoOfPackage) || 0,
                        FreightAmount: cargo.FreightAmount || 0,
                        WeightUnit: cargo.WeightUnit || 0,
                        ShipmentTerms: cargo.ShipmentTerms || 0
                    }
                })
            } else {
                finalCargo = await this._db.houseJobCargo.create({
                    data: {
                        HouseJobSid: updatedHouseJob.HouseJobSid,
                        CreatedBy: payload.createdBy || '',
                        UpdatedBy: payload.updatedBy || '',
                        Status: String(cargo.Status).charAt(0) || 'A',
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        BranchMasterSid: payload.BranchMasterSid || null,
                        CargoType: cargo.CargoType || '',
                        ContainerType: cargo.ContainerType || '',
                        NoOfContainer: Number(cargo.NoOfContainer) || 0,
                        GrossWeight: Number(cargo.GrossWeight) || 0,
                        NetWeight: Number(cargo.NetWeight) || 0,
                        Volume: Number(cargo.Volume) || 0,
                        ChargeableWeight: Number(cargo.ChargeableWeight) || 0,
                        PackageType: cargo.PackageType || '',
                        NoOfPackage: Number(cargo.NoOfPackage) || 0,
                        FreightAmount: cargo.FreightAmount || 0,
                        WeightUnit: cargo.WeightUnit || '',
                        ShipmentTerms: cargo.ShipmentTerms || ''
                    }
                })
            }

            let finalHouseJobProduct;
            const houseJobProductPayload = payload.houseJobProduct || [];
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
                                ExternlQty: Number(product.ExternlQty) || 0,
                                GrossWeight: Number(product.GrossWeight) || 0,
                                NetWeight: Number(product.NetWeight) || 0,
                                Volume: Number(product.Volume) || 0,
                                UpdatedBy: payload.updatedBy,
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
                                ExternlQty: Number(product.ExternlQty) || 0,
                                GrossWeight: Number(product.GrossWeight),
                                NetWeight: Number(product.NetWeight),
                                Volume: Number(product.Volume),
                                CreatedBy: payload.createdBy,
                            }
                        })
                    }
                    finalHouseJobProduct.push(updatedProduct || createdProduct);
                }
            }

            let finalHouseConnections;
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
                                ATA: connection.ATA ? new Date(connection.ATA) : null,
                                ATD: connection.ATD ? new Date(connection.ATD) : null,
                                Remarks: connection.Remarks,
                                Status: String(connection.status).charAt(0) || 'A',
                                UpdatedBy: payload.updatedBy,
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
                                ATA: connection.ATA ? new Date(connection.ATA) : null,
                                ATD: connection.ATD ? new Date(connection.ATD) : null,
                                Remarks: connection.Remarks,
                                Status: String(connection.status).charAt(0) || 'A',
                                CreatedBy: payload.createdBy,
                            }
                        })
                    }
                    finalHouseConnections.push(updatedConnection || createdConnection);
                }
            }

            let finalHouseJobOthers;
            const houseJobOthersPayload = payload.houseJobOthers || [];
            if (houseJobOthersPayload.length > 0) {
                for (const other of houseJobOthersPayload) {
                    let createdOther;
                    let updatedOther;
                    if (other.HouseJobOthersSid) {
                        updatedOther = await this._db.houseJobOthers.update({
                            where: {
                                HouseJobOthersSid: other.HouseJobOthersSid
                            },
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
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
                                DeliveryDate: other.DeliveryDate ? new Date(other.DeliveryDate) : null,
                                DeliveryAddress: other.DeliveryAddress,
                                CargoCurrency: other.CargoCurrency,
                                CargoValue: other.CargoValue,
                                DeliveryMode: other.DeliveryMode,
                                ExternalRemarks: other.ExternalRemarks,
                                GeneralNote: other.GeneralNote,
                                SwitchBL: other.SwitchBL,
                                TransporterName: other.TransporterName,
                                UpdatedBy: payload.updatedBy,
                                Coload: other.Coload,
                                CoLoader: other.CoLoader,
                                NominatedBy: other.NominatedBy,
                            }
                        })
                    } else {
                        createdOther = await this._db.houseJobOthers.create({
                            data: {
                                HouseJobSid: updatedHouseJob.HouseJobSid,
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
                                DeliveryDate: other.DeliveryDate ? new Date(other.DeliveryDate) : null,
                                DeliveryAddress: other.DeliveryAddress,
                                CargoCurrency: other.CargoCurrency,
                                CargoValue: other.CargoValue,
                                DeliveryMode: other.DeliveryMode,
                                ExternalRemarks: other.ExternalRemarks,
                                GeneralNote: other.GeneralNote,
                                SwitchBL: other.SwitchBL,
                                TransporterName: other.TransporterName,
                                CreatedBy: payload.createdBy,
                                Coload: other.Coload,
                                CoLoader: other.CoLoader,
                                NominatedBy: other.NominatedBy,
                            }
                        })
                    }
                    finalHouseJobOthers.push(updatedOther || createdOther);
                }
            }

            return updatedHouseJob;
        }
        catch (error) {
            throw error;
        }
    }
}
