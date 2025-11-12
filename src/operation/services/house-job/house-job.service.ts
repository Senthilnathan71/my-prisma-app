import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OperationCommonService } from '../operation-common/operation-common.service';
import { MenuService } from 'src/masters/services/menu/menu.service';

@Injectable()
export class HouseJobService {
    constructor(
        private _db: DatabaseService,
        private commonService: OperationCommonService,
        private menuService : MenuService
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

            const menuId = await this.menuService.getMenuSidByName("House Job");

            const costRevenuePayload = {
                TransactionSid : ourHouseJob.HouseJobSid,
                MenuMasterSid : menuId || ourHouseJob.MenuMasterSid!,
                CompanyMasterSid : ourHouseJob.CompanyMasterSid,
                BranchMasterSid : ourHouseJob.BranchMasterSid!,
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

    async getHouseJobByMasterJobSid(payload:any) {
        try {
            const {MasterJobSid,CompanyMasterSid,BranchMasterSid} = payload;
            const ourHouseJob = await this._db.houseJob.findMany({
                where: {
                    MasterJobSid: MasterJobSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    status: 'A'
                },
                select :{
                    HouseJobSid : true,
                    HBLNo : true
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
                
                const menuId = await this.menuService.getMenuSidByName("House Job");

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
                        MenuMasterSid : menuId || payload.MenuMasterSid,
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

            // Only run cargo logic if we actually have a cargo payload
            const cargoPayload = payload.houseJobCargo;

            // Check if cargo payload exists and has at least one meaningful field
            if (cargoPayload && Object.keys(cargoPayload).length > 0) {
                const HouseJobCargoSid = cargoPayload.HouseJobCargoSid;

                if (HouseJobCargoSid) {
                    // Update existing cargo
                    finalHouseJobCargo = await this._db.houseJobCargo.update({
                        where: { HouseJobCargoSid },
                        data: {
                            HouseJobSid,
                            CompanyMasterSid: payload.CompanyMasterSid ?? null,
                            BranchMasterSid: payload.BranchMasterSid ?? null,
                            NoOfPackage: Number(cargoPayload.NoOfPackage) || 0,
                            FreightAmount: String(cargoPayload.FreightAmount ?? '0'),
                            CargoType: cargoPayload.CargoType ?? '',
                            WeightUnitSid: cargoPayload.WeightUnit || 0,
                            GrossWeight: Number(cargoPayload.GrossWeight) || 0,
                            NetWeight: Number(cargoPayload.NetWeight) || 0,
                            Volume: Number(cargoPayload.Volume) || 0,
                            ChargeableWeight: Number(cargoPayload.ChargeableWeight) || 0,
                            PackageType: cargoPayload.PackageType || 0,
                            Qty: Number(cargoPayload.Qty) || 0,
                            ShipmentTerms: cargoPayload.ShipmentTerms || '',
                            createdBy: payload.createdBy,          // required
                            updatedBy: payload.updatedBy ?? null,
                            status: 'A',
                            FreightTerms: cargoPayload.FreightTerms || '',
                            MovementType: cargoPayload.MovementType || '',
                            ModeOfTransport: cargoPayload.ModeOfTransport || '',
                            NoofContainers: Number(cargoPayload.NoofContainers) || 0,
                            StuffingAt: cargoPayload.StuffingAt || '',
                        },
                    });
                } else {
                    // Create only if explicitly required
                    finalHouseJobCargo = await this._db.houseJobCargo.create({
                        data: {
                            HouseJobSid,
                            CompanyMasterSid: payload.CompanyMasterSid ?? null,
                            BranchMasterSid: payload.BranchMasterSid ?? null,
                            NoOfPackage: Number(cargoPayload.NoOfPackage) || 0,
                            FreightAmount: String(cargoPayload.FreightAmount ?? '0'),
                            CargoType: cargoPayload.CargoType ?? '',
                            WeightUnitSid: cargoPayload.WeightUnit || 0,
                            GrossWeight: Number(cargoPayload.GrossWeight) || 0,
                            NetWeight: Number(cargoPayload.NetWeight) || 0,
                            Volume: Number(cargoPayload.Volume) || 0,
                            ChargeableWeight: Number(cargoPayload.ChargeableWeight) || 0,
                            PackageType: cargoPayload.PackageType || 0,
                            Qty: Number(cargoPayload.Qty) || 0,
                            ShipmentTerms: cargoPayload.ShipmentTerms || '',
                            createdBy: payload.createdBy,          // required
                            updatedBy: payload.updatedBy ?? null,
                            status: 'A',
                            FreightTerms: cargoPayload.FreightTerms || '',
                            MovementType: cargoPayload.MovementType || '',
                            ModeOfTransport: cargoPayload.ModeOfTransport || '',
                            NoofContainers: Number(cargoPayload.NoofContainers) || 0,
                            StuffingAt: cargoPayload.StuffingAt || '',
                        },
                    });
                }
            } else {
                // 👉 No cargo needed for this request
                finalHouseJobCargo = null;
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
                                HouseJobSid: HouseJobSid,
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
                                Volumetric: Number(product.Volumetric) || 0,
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
                                HouseJobSid: HouseJobSid,
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
                                Volumetric: Number(product.Volumetric) || 0,
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
                                HouseJobSid: HouseJobSid,
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
                                HouseJobSid: HouseJobSid,
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
                        HouseJobSid: Number(HouseJobSid),
                        CustomerRefNo: otherPayload.CustomerRefNo || '',
                        OperationUser : otherPayload.OperationUser || '',
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
                        DeliveryDate: otherPayload.DeliveryDate || "",
                        DeliveryAddress: otherPayload.DeliveryAddress || '',
                        CargoCurrency: otherPayload.CargoCurrency || '',
                        CargoValue: Number(otherPayload.CargoValue) || 0,
                        DeliveryMode: otherPayload.DeliveryMode || '',
                        ExternalRemarks: otherPayload.ExternalRemarks || '',
                        SwitchBL: otherPayload.SwitchBL || '',
                        TransporterName: otherPayload.TransporterName || '',
                        AgentAddress: otherPayload.AgentAddress || '',
                        BacktoBack: otherPayload.BackToBack || '',
                        CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                        CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                        Coloader: otherPayload.Coloader || '',
                        Forwarder: otherPayload.Forwarder || '',
                        ForwarderAddress: otherPayload.ForwarderAddress || '',
                        HBLNo: otherPayload.HBLNo || '',
                        Notify2: otherPayload.Notify2 || '',
                        NotifyAddress2: otherPayload.NotifyAddress2 || '',
                        ROValidity: otherPayload.ROValidity || '',
                        ReleaseType: otherPayload.ReleaseType || '',
                        SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                        SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                        SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                        SwitchLocation: otherPayload.SwitchLocation || '',
                        status: 'A',
                        updatedBy: payload.updatedBy || null,
                    }
                })
            } else {
                finalHouseJobOthers = await this._db.houseJobOthers.create({
                    data: {
                        HouseJobSid: Number(HouseJobSid),
                        CustomerRefNo: otherPayload.CustomerRefNo || '',
                        OperationUser : otherPayload.OperationUser || '',
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
                        DeliveryDate: otherPayload.DeliveryDate || "",
                        DeliveryAddress: otherPayload.DeliveryAddress || '',
                        CargoCurrency: otherPayload.CargoCurrency || '',
                        CargoValue: Number(otherPayload.CargoValue) || 0,
                        DeliveryMode: otherPayload.DeliveryMode || '',
                        ExternalRemarks: otherPayload.ExternalRemarks || '',
                        SwitchBL: otherPayload.SwitchBL || '',
                        TransporterName: otherPayload.TransporterName || '',
                        AgentAddress: otherPayload.AgentAddress || '',
                        BacktoBack: otherPayload.BackToBack || '',
                        CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                        CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                        Coloader: otherPayload.Coloader || '',
                        Forwarder: otherPayload.Forwarder || '',
                        ForwarderAddress: otherPayload.ForwarderAddress || '',
                        HBLNo: otherPayload.HBLNo || '',
                        Notify2: otherPayload.Notify2 || '',
                        NotifyAddress2: otherPayload.NotifyAddress2 || '',
                        ROValidity: otherPayload.ROValidity || '',
                        ReleaseType: otherPayload.ReleaseType || '',
                        SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                        SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                        SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                        SwitchLocation: otherPayload.SwitchLocation || '',
                        status: 'A',
                        createdBy: payload.updatedBy || null,
                    }
                    
                })
            }
            const finalCharges: any[] = [];
                const allCostRevenueCharges = payload?.bookingRates || [];
                let houseMenuId;
                if(allCostRevenueCharges.length > 0){
                    houseMenuId = await this.menuService.getMenuSidByName("House Job");
                }

                let itemIndex = 1;
                for (const item of allCostRevenueCharges) {
                    let createdCharge;
                    let updatedCharge;
                    if (item.RateSid) {
                        // update
                        const costRevenueChargesPayload = {
                            TransactionSid : updatedHouseJob.HouseJobSid ||  item.RateSid,
                            MenuMasterSid : houseMenuId || payload.MenuMasterSid ,
                            ShipmentNo : updatedHouseJob.ShipmentNo,
                            MasterJobNo : updatedHouseJob.MBLNo,
                            updatedBy : payload.updatedBy || payload.createdBy || '',
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
                        updatedCharge = await this._db.costRevenueCharges.update({
                            where: {
                                CostRevenueChargesSid: item.RateSid
                            },
                            data: costRevenueChargesPayload
                        })
                    } else {
                        // create
                        const costRevenueChargesPayload = {
                            TransactionSid: updatedHouseJob.HouseJobSid,
                            MenuMasterSid : houseMenuId || payload.MenuMasterSid,
                            ShipmentNo: updatedHouseJob.ShipmentNo,
                            MasterJobNo: updatedHouseJob.MBLNo,
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

                            createdBy: payload.updatedBy,
                            status: "A",
                            Remarks: item.Remarks
                        }

                        createdCharge = await this._db.costRevenueCharges.create({
                            data: costRevenueChargesPayload
                        })
                    }
                    finalCharges.push(createdCharge || updatedCharge);
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
                        ShipmentNo: BookingNumber
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
