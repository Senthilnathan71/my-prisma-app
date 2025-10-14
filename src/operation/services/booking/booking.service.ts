import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import * as moment from 'moment-timezone';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { OperationCommonService, RateDTO } from '../operation-common/operation-common.service';
import { CurrencyExchangeService } from 'src/masters/services/currency-exchange/currency-exchange.service';
import { statusWhereClause } from 'src/common/helper';

interface CostRevenueDTO {
    MenuMasterSid?: number,
    CompanyMasterSid?: number,
    BranchMasterSid?: number,
    TransactionSid?: number,
    ShipmentNo?: string
}

interface ShipmentMilestoneDTO {
    CompanyMasterSid?: number,
    BranchMasterSid?: number,
    ShipmentNo?: string
}

interface TariffBookingPayload {
  EffectiveDate: Date | string;        // required – tariff effective from
  ExpiredDate: Date | string;          // required – tariff valid until
  DepartmentMasterSid: number;         // required – department
  POLSid: number;                      // required – Port of Loading
  PODSid: number;                      // required – Port of Discharge
  CompanyMasterSid: number;            // required – company

  // ------- Optional filters --------
  PORSid?: number;                     // Port of Origin
  FPODSid?: number;                    // Final Port of Discharge
  Carrier?: number;                    // Carrier customer id
  AgentSid?: number;                    // Agent id
  IncoTerms?: string;                  // e.g., "FOB", "CIF"
  CargoType?: string;                  // e.g., "FCL", "LCL"
}


@Injectable()
export class BookingService {

    constructor(
        private _db: DatabaseService,
        private globalConfigService: GlobalConfigService,
        private logger: Logger,
        private commonService: OperationCommonService,
        private currencyExchangeService: CurrencyExchangeService
    ) { }

    async createBooking(payload: any) {
        let newBooking;
        try {
            const bookingHeader = await this._db.$transaction(async (prisma) => {
                /**
                    |--------------------------------------------------
                    |   Step 1 : Create and Format necessary items
                    |--------------------------------------------------
                */
                const dateString = moment().format('YYYYMMDD');
                const count = await prisma.bookingHeader.count({
                    where: { BookingNo: { contains: dateString } }
                })
                const BookingNo = `booking-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
                /**
                    |--------------------------------------------------
                    |   Step 2 : Create Booking Header
                    |--------------------------------------------------
                */

                newBooking = await prisma.bookingHeader.create({
                    data: {
                        // Section - 1 
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        MenuMasterSid: payload.MenuMasterSid,
                        BookingNo: BookingNo,
                        BookingDateTime: new Date(),
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        CustomerMasterSid: payload.CustomerMasterSid,
                        CustomerBranchSid: payload.CustomerBranchSid,
                        CustomerName: payload.CustomerName,
                        CustomerAddress: payload.CustomerAddress,
                        SalesmanSid: payload.SalesmanSid,
                        ShipperName: payload.ShipperName,
                        ShipperAddress: payload.ShipperAddress,
                        ConsigneeName: payload.ConsigneeName,
                        ConsigneeAddress: payload.ConsigneeAddress,
                        DestinationAgent: payload.DestinationAgent,
                        Notify: payload.Notify,
                        NotifyAddress: payload.NotifyAddress,
                        AgentName: payload.AgentName,
                        AgentAddress: payload.AgentAddress,
                        CarrierName: payload.CarrierName,
                        QuotationHeaderSid: payload.QuotationHeaderSid,
                        HBLNo: payload.HBLNo || null,
                        MBLNo: payload.MBLNo || null,
                        MBLDate: payload.MBLDate || null,
                        createdBy: payload.createdBy,
                        status: 'A',

                        // Section - 2
                        VesselName: payload.VesselName,
                        VoyageMasterSid: payload.VoyageMasterSid,
                        VoyageNo: payload.VoyageNo,
                        ETA: payload.ETA,
                        ETD: payload.ETD,
                        POO: payload.POO,
                        POL: payload.POL,
                        POLTerminal: payload.POLTerminal,
                        POD: payload.POD,
                        PODTerminal: payload.PODTerminal,
                        FPD: payload.FPD,
                        MovementType: payload.MovementType,
                        DoValid: payload.DoValid,
                        Coload: payload.Coload,
                        ShipmentType: payload.ShipmentType,
                        IncoTerms: payload.IncoTerms,
                        FreightTerms: payload.FreightTerms,
                        InternalNote: payload.InternalNote,
                        GeneralNote: payload.GeneralNote,
                        NominatedBy: payload.NominatedBy,
                        ShipmentNo: BookingNo,
                        BookingStatus: 'Booked'
                    }
                })
            })
            /**
                |--------------------------------------------------
                |  Step 2 : Create Booking Cargos
                |--------------------------------------------------
            */
            const cargoPayload = payload.bookingCargo ?? {};
            const cargoData = {
                CompanyMasterSid: newBooking.CompanyMasterSid,
                BranchMasterSid: newBooking.BranchMasterSid,
                BookingHeaderSid: newBooking.BookingHeaderSid,
                CargoType: cargoPayload.CargoType,
                ContainerType: cargoPayload.ContainerType,
                NoofContainers: Number(cargoPayload.NoofContainers),
                GrossWeight: Number(cargoPayload.GrossWeight),
                NetWeight: Number(cargoPayload.NetWeight),
                Volume: Number(cargoPayload.Volume),
                ChargeableWeight: Number(cargoPayload.ChargeableWeight),
                NoOfPackage: Number(cargoPayload.NoOfPackage),
                ShipmentTerms: cargoPayload.ShipmentTerms,
                MovementType: cargoPayload.MovementType,
                ModeOfTransport: cargoPayload.ModeOfTransport,
                FreightTerms: cargoPayload.FreightTerms,
                StuffingAt: cargoPayload.StuffingAt,
                createdBy: payload.createdBy,
                status: 'A'
            }

            let createdCargos = await this._db.bookingCargo.create({
                data: cargoData
            }).catch(err => {
                throw new InternalServerErrorException('Something went wrong while creating booking cargo', err)
            })


            /**
                |--------------------------------------------------
                |  Step 3 : Create Booking Product
                |--------------------------------------------------
            */

            const allProducts: any[] = (payload.bookingProducts || []).map(product => {
                const productData = {
                    BookingHeaderSid: newBooking.BookingHeaderSid,
                    ProductName: product.ProductName || '',
                    ShippingBillNo: product.ShippingBillNo || '',
                    ShippingBillDate: product.ShippingBillDate || '',
                    CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                    ExternaPkg: String(product.ExternaPkg) || '',
                    ExternlQty: product.ExternlQty || '',
                    GrossWeight: Number(product.GrossWeight) || 0,
                    NetWeight: Number(product.NetWeight) || 0,
                    Volume: Number(product.Volume) || 0,
                    IsHaz: product.IsHaz || 'N',
                    ImcoClass: product.ImcoClass || '',
                    UnNo: product.UnNo || '',
                    PkgGroup: product.PkgGroup || '',
                    Length: product.Length,
                    Width: product.Width,
                    Height: product.Height,
                    UomMasterSid: product.UomMasterSid || null,
                    createdBy: payload.createdBy,
                    status: 'A',
                }
                return productData;
            }) || [];

            let createdProducts;
            if (allProducts.length > 0) {
                createdProducts = await this._db.bookingProduct.createMany({
                    data: allProducts
                }).catch(err => {
                    throw new InternalServerErrorException('Something went wrong while creating bookingProduct', err)
                })
            }

            /**
                |--------------------------------------------------
                |   Step 4 : Create Booking Others
                |--------------------------------------------------
            */

            const otherPayload = payload.bookingOther ?? {};

            const otherData = {
                BookingHeaderSid: newBooking.BookingHeaderSid,
                CustomerRefNo: otherPayload.CustomerRefNo || '',
                YardCFS: otherPayload.YardCFS || '',
                HBLNo: otherPayload.HBLNo || '',
                Forwarder: otherPayload.Forwarder || '',
                ForwarderAddress: otherPayload.ForwarderAddress || '',
                NotifyParty: otherPayload.NotifyParty || '',
                NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                Notify2: otherPayload?.Notify2 || '',
                NotifyAddress2: otherPayload?.NotifyAddress2 || '',
                Coloader: otherPayload?.Coloader || '',
                PickupPlace: otherPayload.PickupPlace || '',
                DeliveryPlace: otherPayload.DeliveryPlace || '',
                DeliveryDate: otherPayload.DeliveryDate || '',
                CHAName: otherPayload.CHAName || '',
                PickupAddress: otherPayload.PickupAddress || '',
                DeliveryAddress: otherPayload.DeliveryAddress || '',
                CargoCurrency: otherPayload.CargoCurrency || '',
                CargoValue: parseFloat(otherPayload.CargoValue) || 0,
                SwitchBL: otherPayload.SwitchBL || '',
                createdBy: payload.createdBy || '',
                status: 'A',
                ReleaseType: otherPayload.ReleaseType || '',
                BacktoBack: otherPayload.BacktoBack || '',
                Depo: otherPayload.Depo || '',
                ROValidity: otherPayload.ROValidity || '',
                SwitchBLAgent: otherPayload?.SwitchBLAgent || '',
                AgentAddress: otherPayload?.AgentAddress || '',
                SwitchBLShipper: otherPayload?.SwitchBLShipper || '',
                SwitchBLConsignee: otherPayload?.SwitchBLConsignee || '',
                SwitchLocation: otherPayload?.SwitchLocation || '',
                CarrierBookingRef: otherPayload?.CarrierBookingRef || '',
                CarrierBookingDate: otherPayload?.CarrierBookingDate || null,
            }

            let createdOthers = await this._db.bookingOthers.create({
                data: otherData
            }).catch(err => {
                throw new InternalServerErrorException('Something went wrong while creating bookingOthers', err)
            })


            /**
                |--------------------------------------------------
                |   Step 5 : Create Booking Connections
                |--------------------------------------------------
            */

            const allConnections: any[] = (payload.bookingConnections || []).map(connection => {
                const connectionData = {
                    BookingHeaderSid: newBooking.BookingHeaderSid,
                    Mode: connection.Mode,
                    VesselName: connection.VesselName,
                    VoyageNo: connection.VoyageNo,
                    POL: connection.POL,
                    POD: connection.POD,
                    ETD: connection.ETD ? new Date(connection.ETD) : null,
                    ETA: connection.ETA ? new Date(connection.ETA) : null,
                    createdBy: payload.createdBy,
                    status: String(connection.status).charAt(0) || 'A'
                }
                return connectionData;
            }) || [];

            let createdConnections;
            if (allConnections.length > 0) {
                createdConnections = await this._db.bookingConnection.createMany({
                    data: allConnections
                }).catch(err => {
                    throw new InternalServerErrorException('Something went wrong while creating bookingConnection', err)
                })
            }

            /**
                |--------------------------------------------------
                |   Step 6 : Create Booking Rates
                |--------------------------------------------------
            */
            let allRates: any[] = (payload.bookingRates || []).map(
                rate => {
                    return {
                        BookingHeaderSid: newBooking.BookingHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        SerialNumber: Number(rate.SerialNumber),
                        MenuMasterSid: payload.MenuMasterSid,
                        // Charge Master
                        ChargeMasterSid: rate.ChargeMasterSid,
                        ChargeDescription: rate.ChargeDescription,
                        // COST side
                        CostPrepaidCollect: rate.PrepaidCollect || "Prepaid",
                        CostCurrencyMasterSid: rate.CurrencyMasterSid,
                        CostExchangeRate: Number(rate.ExchangeRate),
                        CostRate: Number(rate.Rate),
                        CostNumberOfUnit: Number(rate.NumberOfUnit),
                        CostDrCr: rate.DrCr,
                        CostAmount: Number(rate.Amount),
                        CostLocalAmount: Number(rate.LocalAmount),
                        CostChargeUomSid: rate.ChargeUomSid,
                        // REVENUE side (optional — map if you capture revenue separately, else keep nulls)
                        RevenuePrepaidCollect: rate.RevenuePrepaidCollect || null,
                        RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid || null,
                        RevenueExchangeRate: rate.RevenueExchangeRate ? Number(rate.RevenueExchangeRate) : null,
                        RevenueRate: rate.RevenueRate ? Number(rate.RevenueRate) : null,
                        RevenueNumberOfUnit: rate.RevenueNumberOfUnit ? Number(rate.RevenueNumberOfUnit) : null,
                        RevenueDrCr: rate.RevenueDrCr || null,
                        RevenueAmount: rate.RevenueAmount ? Number(rate.RevenueAmount) : 0,
                        RevenueLocalAmount: rate.RevenueLocalAmount ? Number(rate.RevenueLocalAmount) : 0,
                        RevenueChargeUomSid: rate.RevenueChargeUomSid || null,
                        // Parties
                        CustomerMasterSid: rate.CustomerMasterSid,
                        CustomerBranchSid: newBooking.CustomerBranchSid,
                        AgentMasterSid: rate.AgentMasterSid || null,
                        AgentBranchSid: rate.AgentBranchSid || null,
                        // Vouchers
                        VoucherHeaderSid: rate.VoucherHeaderSid ? Number(rate.VoucherHeaderSid) : null,
                        VoucherTypeMasterSid: rate.VoucherTypeSid || null,
                        // Other fields
                        Remarks: rate.Remarks || null,
                        Status: "A",
                        CreatedBy: payload.createdBy,
                    };
                }
            )

            let createdRates;
            if (allRates.length > 0) {
                createdRates = await this._db.costRevenueCharges.createMany({
                    data: allRates
                }).catch(err => {
                    throw new InternalServerErrorException('Something went wrong while creating costRevenueCharges', err)
                })
            }

            /**
                |--------------------------------------------------
                |   Step 7 : Create Milestones
                |--------------------------------------------------
            */

            const allMilestones: any[] = (payload.milestones || []).map((milestone) => {
                const milestoneData = {
                    ShipmentNo: newBooking.ShipmentNo,
                    CompanyMasterSid: newBooking.CompanyMasterSid,
                    BranchMasterSid: newBooking.BranchMasterSid,
                    CreatedBy: payload.createdBy,
                    Status: 'A',
                    MilestoneMasterSid: milestone.MilestoneMasterSid,
                    Remarks: milestone.Remarks,
                    MilestoneName: milestone.MilestoneName,
                    MilestoneDate: milestone.MilestoneDate,
                    AutoCaptured: milestone.AutoCaptured ? 'Y' : 'N'
                }
                return milestoneData;
            })

            let createdMilestones;
            if (allMilestones.length > 0) {
                createdMilestones = await this._db.shipmentMilestone.createMany({
                    data: allMilestones
                }).catch(err => {
                    throw new InternalServerErrorException('Something went wrong while creating shipmentMilestone', err)
                })
            }

            return {
                newBooking,
                createdCargos,
                createdProducts,
                createdOthers,
                createdConnections,
                createdRates,
                createdMilestones
            }

        } catch (error) {
            console.error('Transaction failed', error, error.stack);
            throw error;
        }
    }

    async getAllBooking() {
        try {
            const allBooking = await this._db.bookingHeader.findMany({
                where: {
                    status: 'A'
                }
            })
            return allBooking;
        } catch (error) {
            throw error;
        }
    }

    async findBookingById(BookingHeaderSid: number) {
        try {
            const ourBooking = await this._db.bookingHeader.findUnique({
                where: {
                    BookingHeaderSid: BookingHeaderSid
                },
                include: {
                    departmentMaster: { select: { departmentName: true } },
                    quotationHeader: { select: { QuoteNumber: true } },
                    bookingCargo: { where: { status: 'A' } },
                    bookingProduct: { where: { status: 'A' } },
                    bookingOthers: { where: { status: 'A' } },
                    bookingConnection: { where: { status: 'A' } }
                }
            })
            if (!ourBooking) {
                throw new BadRequestException('Error fetching booking record.');
            }
            const costRevenuePayload: RateDTO = {
                CompanyMasterSid: ourBooking.CompanyMasterSid,
                BranchMasterSid: ourBooking.BranchMasterSid!,
                BookingHeaderSid: ourBooking.BookingHeaderSid
            }
            const respectiveCostRevenueCharges = await this.commonService.getAllRateCharges(costRevenuePayload);

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
                bookingRates: respectiveCostRevenueCharges,
                voyageDetails
            }
        } catch (error) {
            throw error;
        }
    }

    async updateBookingById(BookingHeaderSid: number, payload: any) {
        try {
            const result =  await this._db.$transaction(async (prisma) => {
                /**
                    |--------------------------------------------------
                    |   Step 1 : Update Booking Header
                    |--------------------------------------------------
                */
                const updatedBooking:any = await prisma.bookingHeader.update({
                    where: {
                        BookingHeaderSid: BookingHeaderSid
                    },
                    data: {
                        CustomerName: payload.CustomerName,
                        CustomerAddress: payload.CustomerAddress,
                        CustomerBranchSid: payload.CustomerBranchSid,
                        MenuMasterSid: payload.MenuMasterSid,
                        SalesmanSid: payload.SalesmanSid,
                        ShipperName: payload.ShipperName,
                        ShipperAddress: payload.ShipperAddress,
                        ConsigneeName: payload.ConsigneeName,
                        ConsigneeAddress: payload.ConsigneeAddress,
                        DestinationAgent: payload.DestinationAgent,
                        Notify: payload.Notify,
                        NotifyAddress: payload.NotifyAddress,
                        AgentName: payload.AgentName,
                        AgentAddress: payload.AgentAddress,
                        CarrierName: payload.CarrierName,
                        HBLNo: payload.HBLNo || null,
                        MBLNo: payload.MBLNo || null,
                        MBLDate: payload.MBLDate || null,
                        updatedBy: payload.updatedBy,
                        status: payload.status,
                        VesselName: payload.VesselName,
                        VoyageMasterSid: payload.VoyageMasterSid,
                        VoyageNo: payload.VoyageNo,
                        ETA: payload.ETA,
                        ETD: payload.ETD,
                        POO: payload.POO,
                        POL: payload.POL,
                        POLTerminal: payload.POLTerminal,
                        POD: payload.POD,
                        PODTerminal: payload.PODTerminal,
                        FPD: payload.FPD,
                        MovementType: payload.MovementType,
                        DoValid: payload.DoValid,
                        Coload: payload.Coload,
                        ShipmentType: payload.ShipmentType,
                        IncoTerms: payload.IncoTerms,
                        FreightTerms: payload.FreightTerms,
                        InternalNote: payload.InternalNote,
                        GeneralNote: payload.GeneralNote,
                        NominatedBy: payload.NominatedBy
                    }
                })

                /**
                    |--------------------------------------------------
                    |   Step 2 : Update Booking Cargo
                    |--------------------------------------------------
                */

                let finalBookingCargo;
                const cargoPayload = payload.bookingCargo;
                if (!cargoPayload?.BookingCargoSid) {
                    finalBookingCargo = await prisma.bookingCargo.create({
                        data: {
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            BookingHeaderSid: updatedBooking.BookingHeaderSid,
                            CargoType: cargoPayload.CargoType,
                            ContainerType: cargoPayload.ContainerType,
                            NoofContainers: Number(cargoPayload.NoofContainers),
                            GrossWeight: Number(cargoPayload.GrossWeight),
                            NetWeight: Number(cargoPayload.NetWeight),
                            Volume: Number(cargoPayload.Volume),
                            ChargeableWeight: Number(cargoPayload.ChargeableWeight),
                            NoOfPackage: Number(cargoPayload.NoOfPackage),
                            ShipmentTerms: cargoPayload.ShipmentTerms,
                            MovementType: cargoPayload.MovementType,
                            FreightTerms: cargoPayload.FreightTerms,
                            ModeOfTransport: cargoPayload.ModeOfTransport,
                            StuffingAt: cargoPayload.StuffingAt,
                            createdBy: payload.updatedBy,
                            status: 'A'
                        }
                    })

                } else {
                    finalBookingCargo = await prisma.bookingCargo.update({
                        where: { BookingCargoSid: cargoPayload.BookingCargoSid },
                        data: {
                            CargoType: cargoPayload.CargoType,
                            ContainerType: cargoPayload.ContainerType,
                            NoofContainers: Number(cargoPayload.NoofContainers),
                            GrossWeight: Number(cargoPayload.GrossWeight),
                            NetWeight: Number(cargoPayload.NetWeight),
                            Volume: Number(cargoPayload.Volume),
                            ChargeableWeight: Number(cargoPayload.ChargeableWeight),
                            NoOfPackage: Number(cargoPayload.NoOfPackage),
                            ShipmentTerms: cargoPayload.ShipmentTerms,
                            MovementType: cargoPayload.MovementType,
                            FreightTerms: cargoPayload.FreightTerms,
                            ModeOfTransport: cargoPayload.ModeOfTransport,
                            StuffingAt: cargoPayload.StuffingAt,
                            updatedBy: payload.updatedBy,
                            status: payload.status
                        }
                    })
                }

                /**
                    |--------------------------------------------------
                    |   Step 3 : Update Booking Product
                    |--------------------------------------------------
                */
                const finalBookingProducts: any[] = [];
                for (const product of payload.bookingProducts) {
                    let updatedProduct;
                    let createdProduct;

                    if (product.BookingProductSid) {
                        updatedProduct = await prisma.bookingProduct.update({
                            where: { BookingProductSid: product.BookingProductSid },
                            data: {
                                ProductName: product.ProductName,
                                ShippingBillNo: product.ShippingBillNo,
                                ShippingBillDate: product.ShippingBillDate,
                                CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                                ExternaPkg: String(product.ExternaPkg),
                                ExternlQty: product.ExternlQty,
                                GrossWeight: Number(product.GrossWeight),
                                NetWeight: Number(product.NetWeight),
                                Volume: Number(product.Volume),
                                IsHaz: product.IsHaz,
                                ImcoClass: product.ImcoClass,
                                UnNo: product.UnNo,
                                PkgGroup: product.PkgGroup,
                                Length: product.Length,
                                Width: product.Width,
                                Height: product.Height,
                                UomMasterSid: product.UomMasterSid,
                                updatedBy: payload.updatedBy,
                                status: product.status
                            }
                        })
                    } else {
                        createdProduct = await prisma.bookingProduct.create({
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                ProductName: product.ProductName,
                                ShippingBillNo: product.ShippingBillNo,
                                ShippingBillDate: product.ShippingBillDate,
                                CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                                ExternaPkg: String(product.ExternaPkg),
                                ExternlQty: product.ExternlQty,
                                GrossWeight: Number(product.GrossWeight),
                                NetWeight: Number(product.NetWeight),
                                Volume: Number(product.Volume),
                                IsHaz: product.IsHaz,
                                ImcoClass: product.ImcoClass,
                                UnNo: product.UnNo,
                                PkgGroup: product.PkgGroup,
                                Length: product.Length,
                                Width: product.Width,
                                Height: product.Height,
                                UomMasterSid: product.UomMasterSid,
                                createdBy: payload.updatedBy,
                                status: 'A'
                            }
                        })
                    }
                    let data = updatedProduct || createdProduct;
                    finalBookingProducts.push(data);
                }

                /**
                    |--------------------------------------------------
                    |   Step 4 : Update Booking Others
                    |--------------------------------------------------
                */
                let finalBookingOther;
                const otherPayload = payload.bookingOther;
                if (!otherPayload?.BookingOthersSid) {
                    finalBookingOther = await prisma.bookingOthers.create({
                        data: {
                            BookingHeaderSid: updatedBooking.BookingHeaderSid,
                            CustomerRefNo: otherPayload.CustomerRefNo || '',
                            YardCFS: otherPayload.YardCFS || '',
                            HBLNo: otherPayload.HBLNo || '',
                            Forwarder: otherPayload.Forwarder || '',
                            ForwarderAddress: otherPayload.ForwarderAddress || '',
                            NotifyParty: otherPayload.NotifyParty || '',
                            NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                            Notify2: otherPayload?.Notify2 || '',
                            NotifyAddress2: otherPayload?.NotifyAddress2 || '',
                            Coloader: otherPayload?.Coloader || '',
                            PickupPlace: otherPayload.PickupPlace || '',
                            DeliveryPlace: otherPayload.DeliveryPlace || '',
                            DeliveryDate: otherPayload.DeliveryDate || '',
                            CHAName: otherPayload.CHAName || '',
                            PickupAddress: otherPayload.PickupAddress || '',
                            DeliveryAddress: otherPayload.DeliveryAddress || '',
                            CargoCurrency: otherPayload.CargoCurrency || '',
                            CargoValue: otherPayload.CargoValue || 0,
                            SwitchBL: otherPayload.SwitchBL || '',
                            createdBy: payload.updatedBy,
                            status: "A",
                            ReleaseType: otherPayload.ReleaseType || '',
                            BacktoBack: otherPayload.BacktoBack || '',
                            Depo: otherPayload.Depo || '',
                            ROValidity: otherPayload.ROValidity || '',
                            SwitchBLAgent: otherPayload?.SwitchBLAgent || '',
                            AgentAddress: otherPayload?.AgentAddress || '',
                            SwitchBLShipper: otherPayload?.SwitchBLShipper || '',
                            SwitchBLConsignee: otherPayload?.SwitchBLConsignee || '',
                            SwitchLocation: otherPayload?.SwitchLocation || '',
                            CarrierBookingRef: otherPayload?.CarrierBookingRef || '',
                            CarrierBookingDate: otherPayload?.CarrierBookingDate || null,
                        }
                    })

                } else {
                    finalBookingOther = await prisma.bookingOthers.update({
                        where: { BookingOthersSid: otherPayload.BookingOthersSid },
                        data: {
                            BookingHeaderSid: updatedBooking.BookingHeaderSid,
                            CustomerRefNo: otherPayload.CustomerRefNo || '',
                            YardCFS: otherPayload.YardCFS || '',
                            HBLNo: otherPayload.HBLNo || '',
                            Forwarder: otherPayload.Forwarder || '',
                            ForwarderAddress: otherPayload.ForwarderAddress || '',
                            NotifyParty: otherPayload.NotifyParty || '',
                            NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                            Notify2: otherPayload?.Notify2 || '',
                            NotifyAddress2: otherPayload?.NotifyAddress2 || '',
                            Coloader: otherPayload?.Coloader || '',
                            PickupPlace: otherPayload.PickupPlace || '',
                            DeliveryPlace: otherPayload.DeliveryPlace || '',
                            DeliveryDate: otherPayload.DeliveryDate || '',
                            CHAName: otherPayload.CHAName || '',
                            PickupAddress: otherPayload.PickupAddress || '',
                            DeliveryAddress: otherPayload.DeliveryAddress || '',
                            CargoCurrency: otherPayload.CargoCurrency || '',
                            CargoValue: otherPayload.CargoValue || 0,
                            SwitchBL: otherPayload.SwitchBL || '',
                            updatedBy: payload.updatedBy,
                            status: otherPayload.status,
                            ReleaseType: otherPayload.ReleaseType || '',
                            BacktoBack: otherPayload.BacktoBack || '',
                            Depo: otherPayload.Depo || '',
                            ROValidity: otherPayload.ROValidity || '',
                            SwitchBLAgent: otherPayload?.SwitchBLAgent || '',
                            AgentAddress: otherPayload?.AgentAddress || '',
                            SwitchBLShipper: otherPayload?.SwitchBLShipper || '',
                            SwitchBLConsignee: otherPayload?.SwitchBLConsignee || '',
                            SwitchLocation: otherPayload?.SwitchLocation || '',
                            CarrierBookingRef: otherPayload?.CarrierBookingRef || '',
                            CarrierBookingDate: otherPayload?.CarrierBookingDate || null,
                        }
                    })
                }


                /**
                    |--------------------------------------------------
                    |   Step 5 : Update Booking Connections
                    |--------------------------------------------------
                */
                const finalBookingConnections: any[] = [];
                for (const connection of payload.bookingConnections) {
                    let updatedConnection;
                    let createdConnection;

                    if (!connection.TransactionSid) {
                        createdConnection = await prisma.bookingConnection.create({
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                Mode: connection.Mode,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                POL: connection.POL,
                                POD: connection.POD,
                                ETD: connection.ETD,
                                ETA: connection.ETA,
                                createdBy: payload.updatedBy,
                                status: String(connection.status).charAt(0) || 'A'
                            }
                        })

                    } else {
                        updatedConnection = await prisma.bookingConnection.update({
                            where: { BookingConnectionSid: connection.TransactionSid },
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                Mode: connection.Mode,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                POL: connection.POL,
                                POD: connection.POD,
                                ETD: connection.ETD,
                                ETA: connection.ETA,
                                updatedBy: payload.updatedBy,
                                status: String(connection.status).charAt(0) || 'A'
                            }
                        })
                    }
                    let data = updatedConnection || createdConnection;
                    finalBookingConnections.push(data);
                }

                /**
                    |--------------------------------------------------
                    |   Step 6 : Update Booking Rates
                    |--------------------------------------------------
                */

                const finalBookingRates: any[] = [];
                for (const rate of payload.bookingRates) {
                    let createdBookingRate;
                    let updatedBookingRate;
                    if (!rate.BookingRatesSid) {
                        // CREATE
                        createdBookingRate = await prisma.bookingRates.create({
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                BranchMasterSid: payload.BranchMasterSid,
                                SerialNumber: Number(rate.SerialNumber),
                                ChargeUomSid: rate.ChargeUomSid,

                                // Charges
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeDescription: rate.ChargeDescription,
                                CostChargeUomSid: rate.CostChargeUomSid || rate.ChargeUomSid || null,
                                NoOfUnit : Number(rate.NumberOfUnit),

                                RevenueChargeUomSid: rate.RevenueChargeUomSid || null,
                                // Cost Side
                                CostPrepaidCollect: rate.CostPrepaidCollect || "Prepaid",
                                CostCurrencyMasterSid: rate.CostCurrencyMasterSid || rate.CurrencyMasterSid,
                                CostExchangeRate: Number(rate.CostExchangeRate || rate.ExchangeRate || 0),
                                CostRate: Number(rate.CostRate || rate.Rate || 0),
                                CostNumberOfUnit: Number(rate.CostNumberOfUnit || rate.NumberOfUnit || 0),
                                CostDrCr: rate.CostDrCr || rate.DrCr,
                                CostAmount: Number(rate.CostAmount || rate.Amount || 0),
                                CostLocalAmount: Number(rate.CostLocalAmount || rate.LocalAmount || 0),

                                // Revenue Side
                                RevenuePrepaidCollect: rate.RevenuePrepaidCollect || null,
                                RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid || rate.CurrencyMasterSid || null,
                                RevenueExchangeRate: rate.RevenueExchangeRate ? Number(rate.RevenueExchangeRate) : null,
                                RevenueRate: rate.RevenueRate ? Number(rate.RevenueRate) : null,
                                RevenueNumberOfUnit: rate.RevenueNumberOfUnit ? Number(rate.RevenueNumberOfUnit) : null,
                                RevenueDrCr: rate.RevenueDrCr || null,
                                RevenueAmount: rate.RevenueAmount ? Number(rate.RevenueAmount) : 0,
                                RevenueLocalAmount: rate.RevenueLocalAmount ? Number(rate.RevenueLocalAmount) : 0,

                                // Parties
                                CustomerMasterSid: rate.CustomerMasterSid,
                                AgentMasterSid: rate.AgentSid,
                                AgentBranchSid: rate.AgentBranchSid,
                                CustomerBranchSid: updatedBooking.CustomerBranchSid,

                                // Vouchers
                                CostVoucherHeaderSid: rate.CostVoucherHeaderSid ? Number(rate.CostVoucherHeaderSid) : null,
                                CostVoucherTypeMasterSid: rate.CostVoucherTypeSid || null,
                                RevenueVoucherHeaderSid: rate.RevenueVoucherHeaderSid ? Number(rate.RevenueVoucherHeaderSid) : null,
                                RevenueVoucherTypeMasterSid: rate.RevenueVoucherTypeSid || null,

                                // Metadata
                                Status: "A",
                                CreatedBy: rate.CreatedBy,
                            },
                        });
                    } else {
                        // UPDATE
                        updatedBookingRate = await prisma.bookingRates.update({
                            where: { BookingRatesSid: rate.BookingRatesSid },
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                BranchMasterSid: payload.BranchMasterSid,
                                SerialNumber: Number(rate.SerialNumber),

                                // Charges
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeUomSid: rate.ChargeUomSid, // REQUIRED by model
                                ChargeDescription: rate.ChargeDescription,
                                NoOfUnit : Number(rate.NumberOfUnit),
                                CostChargeUomSid: rate.CostChargeUomSid || rate.ChargeUomSid || null,
                                RevenueChargeUomSid: rate.RevenueChargeUomSid || null,

                                // Cost Side
                                CostPrepaidCollect: rate.CostPrepaidCollect || "Prepaid",
                                CostCurrencyMasterSid: rate.CostCurrencyMasterSid || rate.CurrencyMasterSid,
                                CostExchangeRate: Number(rate.CostExchangeRate || rate.ExchangeRate || 0),
                                CostRate: Number(rate.CostRate || rate.Rate || 0),
                                CostNumberOfUnit: Number(rate.CostNumberOfUnit || rate.NumberOfUnit || 0),
                                CostDrCr: rate.CostDrCr || rate.DrCr,
                                CostAmount: Number(rate.CostAmount || rate.Amount || 0),
                                CostLocalAmount: Number(rate.CostLocalAmount || rate.LocalAmount || 0),

                                // Revenue Side (optional update if exists)
                                RevenuePrepaidCollect: rate.RevenuePrepaidCollect || null,
                                RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid || null,
                                RevenueExchangeRate: rate.RevenueExchangeRate ? Number(rate.RevenueExchangeRate) : null,
                                RevenueRate: rate.RevenueRate ? Number(rate.RevenueRate) : null,
                                RevenueNumberOfUnit: rate.RevenueNumberOfUnit ? Number(rate.RevenueNumberOfUnit) : null,
                                RevenueDrCr: rate.RevenueDrCr || null,
                                RevenueAmount: rate.RevenueAmount ? Number(rate.RevenueAmount) : 0,
                                RevenueLocalAmount: rate.RevenueLocalAmount ? Number(rate.RevenueLocalAmount) : 0,

                                // Parties
                                CustomerMasterSid: rate.CustomerMasterSid,
                                AgentMasterSid: rate.AgentSid,
                                AgentBranchSid: rate.AgentBranchSid,
                                CustomerBranchSid: updatedBooking.CustomerBranchSid,

                                // Vouchers
                                CostVoucherHeaderSid: rate.CostVoucherHeaderSid ? Number(rate.CostVoucherHeaderSid) : null,
                                CostVoucherTypeMasterSid: rate.CostVoucherTypeSid || null,
                                RevenueVoucherHeaderSid: rate.RevenueVoucherHeaderSid ? Number(rate.RevenueVoucherHeaderSid) : null,
                                RevenueVoucherTypeMasterSid: rate.RevenueVoucherTypeSid || null,
                                // Metadata
                                Status: String(rate.status || "A").charAt(0),
                                CreatedBy: rate.CreatedBy,
                                UpdatedBy: payload.updatedBy,
                            },
                        });
                    }

                    const data = createdBookingRate || updatedBookingRate;
                    finalBookingRates.push(data)
                }

                /**
                    |--------------------------------------------------
                    |   Step 7 : Update Booking Milestone
                    |--------------------------------------------------
                */

                const finalBookingMilestones: any[] = [];
                for (const milestone of payload.milestones) {
                    let createdMilestones;
                    let updatedMilestones;
                    if (!updatedBooking.ShipmentNo) continue;
                    if (!milestone.ShipmentMilestoneSid) {
                        createdMilestones = await prisma.shipmentMilestone.create({
                            data: {
                                ShipmentNo: updatedBooking.ShipmentNo,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                BranchMasterSid: payload.BranchMasterSid,
                                CreatedBy: payload.updatedBy,
                                Status: 'A',
                                MilestoneMasterSid: milestone.MilestoneMasterSid,
                                Remarks: milestone.Remarks,
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured ? 'Y' : 'N'
                            }
                        })
                    } else {
                        updatedMilestones = await prisma.shipmentMilestone.update({
                            where: { ShipmentMilestoneSid: milestone.ShipmentMilestoneSid },
                            data: {
                                ShipmentNo: updatedBooking.ShipmentNo,
                                UpdatedBy: payload.updatedBy,
                                Status: milestone.Status === "Active" ? 'A' : 'S',
                                MilestoneMasterSid: milestone.MilestoneMasterSid,
                                Remarks: milestone.Remarks,
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured ? 'Y' : 'N'
                            }
                        })
                    }
                    const data = createdMilestones || updatedMilestones;
                    finalBookingMilestones.push(data);
                }

                return {
                    updatedBooking,
                    finalBookingCargo,
                    finalBookingProducts,
                    finalBookingOther,
                    finalBookingConnections,
                    // finalBookingRates,
                    finalBookingMilestones
                }
            })
        } catch (error) {
            console.error('Transaction failed', error)
            throw error;
        }
    }

    async deleteBooking(BookingHeaderSid: number) {
        try {
            const existing = await this._db.bookingHeader.findUnique({
                where: {
                    BookingHeaderSid: BookingHeaderSid
                }
            })

            if (!existing) {
                throw new BadRequestException('Booking with provided id not exists');
            }
            if (existing.status === 'D') {
                throw new BadRequestException('Provided Booking id is already deleted');
            }
            const result = await this._db.$transaction(async (prisma) => {
                const deletedBooking = await prisma.bookingHeader.update({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D' }
                })

                const deletedCargos = await prisma.bookingCargo.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D' }
                })
                const deletedProducts = await prisma.bookingProduct.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D' }
                })
                const deletedOthers = await prisma.bookingOthers.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D' }
                })
                const deletedConnections = await prisma.bookingConnection.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D' }
                })
                const deletedRates = await prisma.bookingRates.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { Status: 'D' }
                })

                return {
                    deletedBooking,
                    deletedCargos,
                    deletedProducts,
                    deletedOthers,
                    deletedConnections,
                    deletedRates
                }
            })
            return result;
        } catch (error) {
            throw error;
        }
    }

    async searchBooking(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        let salesmanIds: number[] = [];
        let shipmentNosByMilestone: string[] = [];

        if (search) {
            /**
             *  Taking all UserSId associated with search
             */

            const users = await this._db.userMaster.findMany({
                where: { userName: { contains: search, mode: 'insensitive' }, status: 'A' },
                select: { UserMasterSid: true },
            });
            salesmanIds = users.map(u => u.UserMasterSid);

            /**
            |--------------------------------------------------
                |   1.Taking allMilestoneSid , ShipmentNo associated with search 
                |   2.Sorting based on ShipmentMilestoneSid(pk) to get latest one
                |--------------------------------------------------
            */

            const milestones = await this._db.shipmentMilestone.findMany({
                where: { MilestoneName: { contains: search, mode: 'insensitive' }, Status: 'A', CompanyMasterSid: activeCompanyId, BranchMasterSid: activeBranchId },
                select: { ShipmentNo: true, ShipmentMilestoneSid: true },
                orderBy: [{ ShipmentNo: 'asc' }, { ShipmentMilestoneSid: 'desc' }],
            });
            shipmentNosByMilestone = [...new Map(milestones.map(m => [m.ShipmentNo, m])).keys()];
        }

        const where: Prisma.BookingHeaderWhereInput = {
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            status: statusWhereClause,
            ...(search && {
                OR: [
                    { BookingNo: { contains: search, mode: 'insensitive' } },
                    { departmentMaster: { departmentName: { contains: search, mode: 'insensitive' } } },
                    { POL: { contains: search, mode: 'insensitive' } },
                    { POD: { contains: search, mode: 'insensitive' } },
                    { FPD: { contains: search, mode: 'insensitive' } },
                    { VesselName: { contains: search, mode: 'insensitive' } },
                    { VoyageNo: { contains: search, mode: 'insensitive' } },
                    ...(salesmanIds.length ? [{ SalesmanSid: { in: salesmanIds } }] : []),
                    ...(shipmentNosByMilestone.length ? [{ ShipmentNo: { in: shipmentNosByMilestone } }] : []),
                ],
            }),
        };

        let items;
        let totalCount;
        [items, totalCount] = await this._db.$transaction([
            this._db.bookingHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { BookingHeaderSid: 'desc' }
            }),
            this._db.bookingHeader.count({ where }),
        ]);

        /**
            * Taking DepartmentName using globalConfig Service 
         */
        items = await Promise.all(
            items.map(async (item) => {
                const [departmentMaster, salesman] = await Promise.all([
                    item.DepartmentMasterSid !== null ?
                        this.globalConfigService.getMasterData('department_master', item.DepartmentMasterSid) :
                        { DepartmentMasterSid: null, departmentName: '' },

                    item.SalesmanSid !== null ?
                        this.globalConfigService.getMasterData('user_master', item.SalesmanSid) :
                        { UserMasterSid: null, userName: '' }
                ])
                return {
                    ...item,
                    departmentMaster,
                    salesman
                }
            })
        )

        const shipmentNos = [...new Set(items.map(i => i.ShipmentNo).filter(Boolean))] as string[];
        const milestones = shipmentNos.length
            ? await this._db.shipmentMilestone.findMany({
                where: { ShipmentNo: { in: shipmentNos } },
                select: { ShipmentNo: true, ShipmentMilestoneSid: true, MilestoneName: true },
                orderBy: { ShipmentMilestoneSid: 'desc' },
            })
            : [];

        const milestoneMap = new Map(milestones.map(m => [m.ShipmentNo, m]));



        const formattedItems = items.map(item => ({
            ...item,
            Milestone: item.ShipmentNo && milestoneMap.get(item.ShipmentNo) || null,
        }));

        return { items: formattedItems, totalCount };
    }

    async softDeleteBookingProduct(BookingProductSid: number) {
        try {
            const deletedBookingProducts = await this._db.bookingProduct.update({
                where: { BookingProductSid },
                data: { status: 'D' }
            })
            return deletedBookingProducts;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteBookingConnection(BookingConnectionSid: number) {
        try {
            const deletedBookingConnection = await this._db.bookingConnection.update({
                where: { BookingConnectionSid: BookingConnectionSid },
                data: { status: 'D' }
            })
            return deletedBookingConnection;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteBookingRates(BookingRateSid: number) {
        try {
            // Check if voucher exists before allowing delete
            const existingRate = await this._db.bookingRates.findUnique({
                where: { BookingRatesSid: BookingRateSid },
                select: {
                    CostVoucherHeaderSid: true,
                    RevenueVoucherHeaderSid: true
                }
            });

            if (!existingRate) {
                throw new NotFoundException('Booking rate not found');
            }

            if (existingRate.CostVoucherHeaderSid || existingRate.RevenueVoucherHeaderSid) {
                throw new BadRequestException('Cannot delete rate. Voucher already generated for this rate.');
            }

            const deletedBookingConnection = await this._db.bookingRates.update({
                where: { BookingRatesSid: BookingRateSid },
                data: { Status: 'D' }
            })
            return deletedBookingConnection;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create a new booking rate manually
     */
    async createBookingRate(payload: any) {
        try {
            // Validate that BookingHeader exists
            if (!payload.BookingHeaderSid) {
                throw new BadRequestException('BookingHeaderSid is required');
            }

            const bookingRate = await this._db.bookingRates.create({
                data: {
                    BookingHeaderSid: payload.BookingHeaderSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    CreatedBy: payload.CreatedBy,

                    SerialNumber: payload.SerialNumber || null,
                    ChargeMasterSid: payload.ChargeMasterSid,
                    ChargeDescription: payload.ChargeDescription,
                    ChargeUomSid: payload.ChargeUomSid || null,
                    NoOfUnit: payload.NoOfUnit || null,
                    QuoteChargeSid: payload.QuoteChargeSid || null,
                    TariffDetailSid: payload.TariffDetailSid || null,

                    // Cost Section
                    CostPrepaidCollect: payload.CostPrepaidCollect || 'Prepaid',
                    CostCurrencyMasterSid: payload.CostCurrencyMasterSid || null,
                    CostExchangeRate: payload.CostExchangeRate ? Number(payload.CostExchangeRate) : null,
                    CostRate: payload.CostRate ? Number(payload.CostRate) : null,
                    CostNumberOfUnit: null, // This field has Decimal(4,3) - not used for main quantity
                    CostDrCr: payload.CostDrCr || 'D',
                    CostAmount: Number(payload.CostAmount || 0),
                    CostLocalAmount: Number(payload.CostLocalAmount || 0),
                    CostChargeUomSid: payload.CostChargeUomSid || null,

                    // Revenue Section
                    RevenuePrepaidCollect: payload.RevenuePrepaidCollect || 'Prepaid',
                    RevenueCurrencyMasterSid: payload.RevenueCurrencyMasterSid || null,
                    RevenueExchangeRate: payload.RevenueExchangeRate ? Number(payload.RevenueExchangeRate) : null,
                    RevenueRate: payload.RevenueRate ? Number(payload.RevenueRate) : null,
                    RevenueNumberOfUnit: null, // This field has Decimal(4,3) - not used for main quantity
                    RevenueDrCr: payload.RevenueDrCr || 'C',
                    RevenueAmount: Number(payload.RevenueAmount || 0),
                    RevenueLocalAmount: Number(payload.RevenueLocalAmount || 0),
                    PrepaidCollect: payload.PrepaidCollect || null,
                    AgentMasterSid: payload.AgentMasterSid || null,
                    AgentBranchSid: payload.AgentBranchSid || null,
                    CustomerMasterSid: payload.CustomerMasterSid,
                    CustomerBranchSid: payload.CustomerBranchSid,
                    RevenueChargeUomSid: payload.RevenueChargeUomSid || null,

                    Remarks: payload.Remarks || null,
                    Status: 'A'
                }
            });

            return bookingRate;
        } catch (error) {
            this.logger.error(`Error creating booking rate: ${error.message}`);
            throw new InternalServerErrorException('Failed to create booking rate');
        }
    }

    /**
     * Update an existing booking rate
     */
    async updateBookingRate(BookingRatesSid: number, payload: any) {
        try {
            // Check if rate exists and if voucher is generated
            const existingRate = await this._db.bookingRates.findUnique({
                where: { BookingRatesSid },
                select: {
                    CostVoucherHeaderSid: true,
                    RevenueVoucherHeaderSid: true
                }
            });

            if (!existingRate) {
                throw new NotFoundException('Booking rate not found');
            }

            if (existingRate.CostVoucherHeaderSid || existingRate.RevenueVoucherHeaderSid) {
                throw new BadRequestException('Cannot update rate. Voucher already generated for this rate.');
            }

            const updateData: any = {
                UpdatedBy: payload.UpdatedBy,
                UpdatedOn: new Date()
            };

            // Only update fields that are provided
            if (payload.SerialNumber !== undefined) updateData.SerialNumber = payload.SerialNumber;
            if (payload.ChargeMasterSid !== undefined) updateData.ChargeMasterSid = payload.ChargeMasterSid;
            if (payload.ChargeDescription !== undefined) updateData.ChargeDescription = payload.ChargeDescription;
            if (payload.ChargeUomSid !== undefined) updateData.ChargeUomSid = payload.ChargeUomSid;
            if (payload.NoOfUnit !== undefined) updateData.NoOfUnit = payload.NoOfUnit;

            // Cost Section
            if (payload.CostPrepaidCollect !== undefined) updateData.CostPrepaidCollect = payload.CostPrepaidCollect;
            if (payload.CostCurrencyMasterSid !== undefined) updateData.CostCurrencyMasterSid = payload.CostCurrencyMasterSid;
            if (payload.CostExchangeRate !== undefined) updateData.CostExchangeRate = Number(payload.CostExchangeRate);
            if (payload.CostRate !== undefined) updateData.CostRate = Number(payload.CostRate);
            if (payload.CostNumberOfUnit !== undefined) updateData.CostNumberOfUnit = Number(payload.CostNumberOfUnit);
            if (payload.CostDrCr !== undefined) updateData.CostDrCr = payload.CostDrCr;
            if (payload.CostAmount !== undefined) updateData.CostAmount = Number(payload.CostAmount);
            if (payload.CostLocalAmount !== undefined) updateData.CostLocalAmount = Number(payload.CostLocalAmount);
            if (payload.CostChargeUomSid !== undefined) updateData.CostChargeUomSid = payload.CostChargeUomSid;

            // Revenue Section
            if (payload.RevenuePrepaidCollect !== undefined) updateData.RevenuePrepaidCollect = payload.RevenuePrepaidCollect;
            if (payload.RevenueCurrencyMasterSid !== undefined) updateData.RevenueCurrencyMasterSid = payload.RevenueCurrencyMasterSid;
            if (payload.RevenueExchangeRate !== undefined) updateData.RevenueExchangeRate = Number(payload.RevenueExchangeRate);
            if (payload.RevenueRate !== undefined) updateData.RevenueRate = Number(payload.RevenueRate);
            if (payload.RevenueNumberOfUnit !== undefined) updateData.RevenueNumberOfUnit = Number(payload.RevenueNumberOfUnit);
            if (payload.RevenueDrCr !== undefined) updateData.RevenueDrCr = payload.RevenueDrCr;
            if (payload.RevenueAmount !== undefined) updateData.RevenueAmount = Number(payload.RevenueAmount);
            if (payload.RevenueLocalAmount !== undefined) updateData.RevenueLocalAmount = Number(payload.RevenueLocalAmount);
            if (payload.PrepaidCollect !== undefined) updateData.PrepaidCollect = payload.PrepaidCollect;
            if (payload.AgentMasterSid !== undefined) updateData.AgentMasterSid = payload.AgentMasterSid;
            if (payload.AgentBranchSid !== undefined) updateData.AgentBranchSid = payload.AgentBranchSid;
            if (payload.CustomerMasterSid !== undefined) updateData.CustomerMasterSid = payload.CustomerMasterSid;
            if (payload.CustomerBranchSid !== undefined) updateData.CustomerBranchSid = payload.CustomerBranchSid;
            if (payload.RevenueChargeUomSid !== undefined) updateData.RevenueChargeUomSid = payload.RevenueChargeUomSid;
            if (payload.Remarks !== undefined) updateData.Remarks = payload.Remarks;

            const updatedRate = await this._db.bookingRates.update({
                where: { BookingRatesSid },
                data: updateData
            });

            return updatedRate;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            this.logger.error(`Error updating booking rate: ${error.message}`);
            throw new InternalServerErrorException('Failed to update booking rate');
        }
    }

    /**
     * Get all rates for a booking
     */
    async getBookingRatesByBookingId(BookingHeaderSid: number) {
        try {
            const rates = await this._db.bookingRates.findMany({
                where: {
                    BookingHeaderSid,
                    Status: 'A'
                },
                include: {
                    companyMaster: {
                        select: { companyName: true }
                    },
                    BranchMaster: {
                        select: { branchName: true }
                    },
                    costVoucherHeader: {
                        select: {
                            VoucherHeaderSid: true,
                            VoucherNumber: true,
                            VoucherDate: true
                        }
                    },
                    revenueVoucherHeader: {
                        select: {
                            VoucherHeaderSid: true,
                            VoucherNumber: true,
                            VoucherDate: true
                        }
                    },
                    costVoucherTypeMaster: {
                        select: { VoucherTypeMasterSid: true, DocumentTypeName: true }
                    },
                    revenueVoucherTypeMaster: {
                        select: { VoucherTypeMasterSid: true, DocumentTypeName: true }
                    }
                },
                orderBy: {
                    SerialNumber: 'asc'
                }
            });

            return rates;
        } catch (error) {
            this.logger.error(`Error fetching booking rates: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch booking rates');
        }
    }

    async getBookingRatesWithDetails(BookingHeaderSid: number) {
        try {
            const rates = await this._db.bookingRates.findMany({
                where: {
                    BookingHeaderSid,
                    Status: 'A'
                },
                include: {
                    companyMaster: {
                        select: {
                            CompanyMasterSid: true,
                            companyName: true,
                            CountryMasterSid: true
                        }
                    },
                    BranchMaster: {
                        select: {
                            BranchMasterSid: true,
                            branchName: true,
                            StateMasterSid: true
                        }
                    },
                    customerMasterBP: {
                        select: {
                            CustomerMasterSid: true,
                            CustomerName: true,
                            CustomerAddress1: true,
                            CustomerAddress2: true
                        }
                    },
                    customerBranch: {
                        select: {
                            CustomerBranchSid: true,
                            Address: true,
                            StateMasterSid: true
                        }
                    },
                    costVoucherHeader: {
                        select: {
                            VoucherHeaderSid: true,
                            VoucherNumber: true,
                            VoucherDate: true,
                            VoucherTypeMasterSid: true
                        }
                    },
                    revenueVoucherHeader: {
                        select: {
                            VoucherHeaderSid: true,
                            VoucherNumber: true,
                            VoucherDate: true,
                            VoucherTypeMasterSid: true
                        }
                    },
                    costVoucherTypeMaster: {
                        select: {
                            VoucherTypeMasterSid: true,
                            DocumentTypeName: true
                        }
                    },
                    revenueVoucherTypeMaster: {
                        select: {
                            VoucherTypeMasterSid: true,
                            DocumentTypeName: true
                        }
                    }
                },
                orderBy: {
                    SerialNumber: 'asc'
                }
            });

            // Enrich with state names, charge details, and currency details
            const enrichedRates = await Promise.all(rates.map(async (rate) => {
                const enrichments: any = {};

                // Add state name
                if (rate.customerBranch?.StateMasterSid) {
                    const state = await this._db.stateMaster.findUnique({
                        where: { StateMasterSid: rate.customerBranch.StateMasterSid },
                        select: { stateName: true }
                    });
                    enrichments.customerBranch = {
                        ...rate.customerBranch,
                        StateName: state?.stateName || ''
                    };
                }

                // Add charge master details with tax master
                if (rate.ChargeMasterSid) {
                    const charge = await this._db.chargeMaster.findUnique({
                        where: { ChargeMasterSid: rate.ChargeMasterSid },
                        select: {
                            ChargeMasterSid: true,
                            chargeCode: true,
                            chargeName: true,
                            HSNSAC: true,
                            chargeTaxMaster: {
                                select: {
                                    ChargeTaxMasterSid: true,
                                    HSNCode: true,
                                    description: true,
                                    TaxGroup: true,
                                    TaxRate: true
                                }
                            }
                        }
                    });
                    enrichments.ChargeMaster = charge;
                }

                // Add revenue currency details
                if (rate.RevenueCurrencyMasterSid) {
                    const currency = await this._db.currencyMaster.findUnique({
                        where: { CurrencyMasterSid: rate.RevenueCurrencyMasterSid },
                        select: {
                            CurrencyMasterSid: true, currencyCode: true, currencyName: true,
                            countryMaster: {
                                select: {
                                    CountryMasterSid: true,
                                    countryName: true,
                                    countryCode: true
                                }
                            },
                        }
                    });
                    enrichments.RevenueCurrencyMaster = currency;
                }

                // Add cost currency details
                if (rate.CostCurrencyMasterSid) {
                    const currency = await this._db.currencyMaster.findUnique({
                        where: { CurrencyMasterSid: rate.CostCurrencyMasterSid },
                        select: { CurrencyMasterSid: true, currencyCode: true, currencyName: true,
                            countryMaster: {
                                select: {
                                    CountryMasterSid: true,
                                    countryName: true,
                                    countryCode: true
                                }
                            },
                         }
                    });
                    enrichments.CostCurrencyMaster = currency;
                }

                // Add agent/billing party details
                if (rate.AgentMasterSid) {
                    const agent = await this._db.customerMaster.findUnique({
                        where: { CustomerMasterSid: rate.AgentMasterSid },
                        select: {
                            CustomerMasterSid: true,
                            CustomerName: true,
                            CustomerAddress1: true,
                            CustomerAddress2: true
                        }
                    });
                    enrichments.AgentMaster = agent;
                }

                // Add revenue voucher type details
                if (rate.RevenueVoucherTypeMasterSid) {
                    const voucherType = await this._db.voucherTypeMaster.findUnique({
                        where: { VoucherTypeMasterSid: rate.RevenueVoucherTypeMasterSid },
                        select: {
                            VoucherTypeMasterSid: true,
                            DocumentTypeName: true,
                            DocumentTypeCode: true
                        }
                    });
                    enrichments.RevenueVoucherType = voucherType;
                }

                // Add cost voucher type details
                if (rate.CostVoucherTypeMasterSid) {
                    const voucherType = await this._db.voucherTypeMaster.findUnique({
                        where: { VoucherTypeMasterSid: rate.CostVoucherTypeMasterSid },
                        select: {
                            VoucherTypeMasterSid: true,
                            DocumentTypeName: true,
                            DocumentTypeCode: true
                        }
                    });
                    enrichments.CostVoucherType = voucherType;
                }

                // Add revenue voucher header details (for voucher number)
                if (rate.RevenueVoucherHeaderSid) {
                    const voucherHeader = await this._db.voucherHeader.findUnique({
                        where: { VoucherHeaderSid: rate.RevenueVoucherHeaderSid },
                        select: {
                            VoucherHeaderSid: true,
                            VoucherNumber: true
                        }
                    });
                    enrichments.RevenueVoucherHeader = voucherHeader;
                }

                // Add cost voucher header details (for voucher number)
                if (rate.CostVoucherHeaderSid) {
                    const voucherHeader = await this._db.voucherHeader.findUnique({
                        where: { VoucherHeaderSid: rate.CostVoucherHeaderSid },
                        select: {
                            VoucherHeaderSid: true,
                            VoucherNumber: true
                        }
                    });
                    enrichments.CostVoucherHeader = voucherHeader;
                }

                return {
                    ...rate,
                    ...enrichments
                };
            }));

            return enrichedRates;
        } catch (error) {
            this.logger.error(`Error fetching booking rates with details: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch booking rates with details');
        }
    }



    async getCustomerRelatedLookups(payload: any) {
        try {
            const [customers, salesmans, shippers, consignees, agents, carriers, forwarder, notify, yard, cfs] = await this._db.$transaction([
                this._db.customerMaster.findMany({
                    // where: {
                    //     CompanyMasterSid: payload.CompanyMasterSid,
                    //     status: "A",
                    //     CustomerBranch: { some: {} }
                    // },
                     where: {
                    CompanyMasterSid: payload.CompanyMasterSid,
                    status: 'A',
                    CustomerBranch: { some: {} },
                    AND: [
                        { CustomerType: { path: ['customer'], equals: 'isTrue' } },
                        { CustomerType: { path: ['carrier'], equals: 'isFalse' } }
                    ]
                },
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true,
                        CustomerBranch: {
                            where: {
                                status: 'A'
                            },
                            select: {
                                CustomerBranchSid: true,
                                BranchName: true,
                                Address: true,
                                Email: true,
                            }
                        }
                    }
                }),
                this._db.customerSalesTeam.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, status: 'A' },
                    select: { Salesman: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['shipper'], equals: 'isTrue' }, status: 'A' },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['consignee'], equals: 'isTrue' }, status: 'A' },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['agent'], equals: 'isTrue' }, status: 'A' },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true, countryMaster: { select: { countryName: true } } }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['carrier'], equals: 'isTrue' }, status: 'A' },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['forwarder'], equals: 'isTrue' }, status: 'A' },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['notify'], equals: 'isTrue' }, status: 'A' },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['yard'], equals: 'isTrue' }, status: 'A' },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['cFS'], equals: 'isTrue' }, status: 'A' },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                })
            ]);
            const formattedCustomerList = customers.flatMap(customer => {
                const cusBranches = customer.CustomerBranch.map(branch => ({
                    CustomerMasterSid: customer.CustomerMasterSid,
                    CustomerBranchSid: branch.CustomerBranchSid,
                    CustomerName: customer.CustomerName,
                    BranchName: branch.BranchName,
                    Address: branch.Address,
                    Email: branch.Email
                }))
                return cusBranches;
            })
            const processedAgents = agents.map((agent) => {
                const agentCountry = agent.countryMaster?.countryName
                return {
                    ...agent,
                    agentCountry
                }
            })
            const processedSalesmans = await Promise.all(
                salesmans.map(async (item) => {
                    const salesman = item.Salesman !== null
                        ? await this.globalConfigService.getMasterData('user_master', item.Salesman)
                        : { userName: '', UserMasterSid: null };
                    return {
                        ...item,
                        ...salesman,
                    };
                })
            );

            return { customers : formattedCustomerList, salesmans: processedSalesmans, shippers, consignees, agents: processedAgents, carriers, forwarder, notify ,yards:yard,cfs};
        } catch (error) {
            console.error('Error fetching Customer Related Lookups:', error);
            return {
                customers: [],
                salesmans: [],
                shippers: [],
                consignees: [],
                agents: [],
                carriers: [],
                forwarder: [],
                notify: [],
                yard:[],
                cFS:[],
            };
        }
    }


    async getAllContainerTypes() {
        try {
            const allContainerTypes = await this._db.containerTypeMaster.findMany({
                where: {
                    status: 'A'
                },
                select: {
                    ContainerTypeMasterSid: true,
                    ContainerName: true,
                    ContainerCode: true,
                    ContainerSize: true
                }
            })
            return allContainerTypes;
        } catch (error) {
            throw error;
        }
    }

    async getAllCurrencies() {
        try {
            const allContainerTypes = await this._db.currencyMaster.findMany({
                where: {
                    status: 'A'
                },
                select: {
                    CurrencyMasterSid: true,
                    currencyName: true,
                    currencyCode: true,
                    countryMaster: {
                                select: {
                                    CountryMasterSid: true,
                                    countryName: true,
                                    countryCode: true
                                }
                            },
                }
            })
            return allContainerTypes;
        } catch (error) {
            throw error;
        }
    }

    async getAllProductLookups(payload: any) {
        try {
            const [products, packageTypes, imcos, uoms] = await this._db.$transaction([
                this._db.productMaster.findMany({
                    where: { status: 'A', CompanyMasterSid: payload.CompanyMasterSid },
                    select: {
                        ProductMasterSId: true,
                        ProductName: true,
                        IMOClass: true,
                        ProductType: true,
                        UNNo: true,
                        PackingGroup: true
                    }
                }),
                this._db.uOMMaster.findMany({
                    where: { status: 'A', UOMType: 'P' },
                    select: {
                        UOMMasterSid: true,
                        UOMName: true,
                        UOMCode: true
                    },
                }),
                this._db.imcoMaster.findMany({
                    where: { status: 'A' },
                    select: {
                        ImcoMasterSid: true,
                        ImcoName: true
                    },
                }),
                this._db.uOMMaster.findMany({
                    where: { status: 'A' },
                    select: {
                        UOMMasterSid: true,
                        UOMName: true,
                    },
                }),

            ]);
            return { products, packageTypes, imcos, uoms }
        } catch (error) {
            console.error('Error fetching Product Lookups:', error);
            return {
                products: [],
                packageTypes: [],
                imcos: [],
                uoms: []
            };
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

    async getAllMilestones(payload: any) {
        try {
            const allMilestones = await this._db.milestoneMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid
                },
                select: {
                    MilestoneMasterSid: true,
                    MilestoneName: true,
                    AutoCapture: true,
                    DepartmentMasterSid: true,
                    Remarks: true
                }
            })
            return allMilestones;
        } catch (error) {
            throw error;
        }
    }

    async getShipmentMilestoneByShipmentNo(payload: any) {
        try {
            const allShipmentMilestone = await this._db.shipmentMilestone.findMany({
                where: {
                    ShipmentNo: payload.ShipmentNo,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    BranchMasterSid: payload.BranchMasterSid,
                    Status: 'A'
                },
                orderBy: {
                    ShipmentMilestoneSid: 'asc'
                }
            })
            return allShipmentMilestone;
        } catch (error) {
            throw error;
        }
    }

    async getAllRateLookups(payload: any) {
        try {
            const [charges, uoms, docTypes, Vouchers] = await this._db.$transaction([
                this._db.chargeMaster.findMany({
                    where: { Status: 'A', CompanyMasterSid: payload.CompanyMasterSid },
                    select: {
                        ChargeMasterSid: true,
                        chargeName: true,
                        chargeCode: true,
                        CurrencyMasterSid: true,
                        UOM: true,
                        chargeTaxMaster: {
                            take: 1,
                            select: {
                                description: true
                            }
                        },
                    }
                }),
                this._db.uOMMaster.findMany({
                    where: { status: 'A' },
                    select: {
                        UOMMasterSid: true,
                        UOMName: true,
                        UOMCode: true
                    },
                }),
                this._db.voucherTypeMaster.findMany({
                    where: { status: 'A' },
                    select: {
                        VoucherTypeMasterSid: true,
                        DocumentTypeName: true
                    },
                }),
                this._db.voucherHeader.findMany({
                    where:{Status:'A'},
                    select:{
                        VoucherHeaderSid:true,
                        VoucherNumber:true
                    }
                })

            ]);
            return { charges, uoms, docTypes, Vouchers}
        } catch (error) {
            console.error('Error fetching Rate Lookups:', error);
            return {
                charges: [],
                uoms: [],
                docTypes: []
            };
        }
    }

    // async getTariffByBookingDetails(payload) {
    //     try {
    //         const allTariffDetails = await this._db.tariffDetail.findMany({
    //             where: {
    //                 EffectiveDate: { lte: new Date(payload.EffectiveDate) },
    //                 ExpiredOn: { gte: new Date(payload.ExpiredDate) },
    //                 tariffHeader: {
    //                     DepartmentMasterSid: payload.DepartmentMasterSid,
    //                     POLSid: payload.POLSid,
    //                     PODSid: payload.PODSid,

    //                     ...(payload.CompanyMasterSid && { CompanyMasterSid: payload.CompanyMasterSid }),
    //                     ...(payload.PORSid && { POOSid: payload.PORSid }),
    //                     ...(payload.FPODSid && { FDCSid: payload.FPODSid }),
    //                 },
    //                 ...(payload.CargoType && { CargoType: payload.CargoType }),
    //             },
    //         });

    //         const enrichedDetails = await Promise.all(
    //             allTariffDetails.map(async (detail) => {
    //                 const company = payload.CompanyMasterSid
    //                     ? await this._db.companyMaster.findUnique({
    //                         where: { CompanyMasterSid: payload.CompanyMasterSid },
    //                     })
    //                     : null;

    //                 const toCurrencyId = company?.CurrencyMasterSid!;
    //                 const toCurrency = toCurrencyId
    //                     ? await this.globalConfigService.getMasterData('currency_master', toCurrencyId)
    //                     : null;

    //                 const costFromCurrency = await this.globalConfigService.getMasterData(
    //                     'currency_master',
    //                     detail.BuyCurrency
    //                 );
    //                 const revenueFromCurrency = await this.globalConfigService.getMasterData(
    //                     'currency_master',
    //                     detail.SaleCurrency
    //                 );

    //                 const costExchangeRate = 
    //                 toCurrency ? 
    //                 costFromCurrency === toCurrency ? 
    //                 1 : await this.currencyExchangeService.getExchangeRate({
    //                         fromCurrencyCode: costFromCurrency.currencyCode,
    //                         toCurrencyCode: toCurrency.currencyCode,
    //                     })
    //                 : null;

    //                 const revenueExchangeRate =
    //                     toCurrency ?
    //                         revenueFromCurrency === toCurrency ?
    //                             1 : await this.currencyExchangeService.getExchangeRate({
    //                                 fromCurrencyCode: revenueFromCurrency.currencyCode,
    //                                 toCurrencyCode: toCurrency.currencyCode,
    //                             })
    //                         : null;

    //                 return {
    //                     ...detail,
    //                     costExchangeRate,
    //                     revenueExchangeRate,
    //                 };
    //             })
    //         );

    //         return enrichedDetails;
    //     } catch (error) {
    //         throw error;
    //     }
    // }



    

async getTariffByBookingDetails(payload:TariffBookingPayload) {
  try {
    // ---------- 1️⃣  First Priority Search: Dynamic WHERE clause with all optional filters ----------
    const whereWithOptionalFilters: any = {
      EffectiveDate: { lte: new Date(payload.EffectiveDate) },
      ExpiredOn:     { gte: new Date(payload.ExpiredDate) },
      tariffHeader: {
        DepartmentMasterSid: payload.DepartmentMasterSid,
        POLSid: payload.POLSid,
        PODSid: payload.PODSid,
        CompanyMasterSid: payload.CompanyMasterSid,
      },
    };

    // Track if we have optional filters
    let hasOptionalFilters = false;

    // optional filters – add only if provided in payload
    if (payload.PORSid) {
      whereWithOptionalFilters.tariffHeader.POOSid = payload.PORSid;
      hasOptionalFilters = true;
    }
    if (payload.FPODSid) {
      whereWithOptionalFilters.tariffHeader.FDCSid = payload.FPODSid;
      hasOptionalFilters = true;
    }
    if (payload.Carrier) {
      whereWithOptionalFilters.tariffHeader.Carrier = payload.Carrier;
      hasOptionalFilters = true;
    }
    if (payload.AgentSid) {
      whereWithOptionalFilters.tariffHeader.AgentSid = payload.AgentSid;
      hasOptionalFilters = true;
    }
    if (payload.IncoTerms) {
      whereWithOptionalFilters.tariffHeader.IncoTerms = payload.IncoTerms;
      hasOptionalFilters = true;
    }
    if (payload.CargoType) {
      whereWithOptionalFilters.CargoType = payload.CargoType;
      hasOptionalFilters = true;
    }

    const includeClause = {
      tariffHeader: true,               // to see Dept/POL/POD etc.
      currencyMasterBuy: true,          // buy currency details
      currencyMasterSale: true,         // sale currency details
      companyMaster: true,              // company if linked
      UOMMaster: true                   // unit of measure
    };

    // ---------- 2️⃣  Fetch tariff details with all filters ----------
    let allTariffDetails = await this._db.tariffDetail.findMany({
      where: whereWithOptionalFilters,
      include: includeClause
    });

    let isStandardRate = false;

    // ---------- 3️⃣  Fallback to Standard Rate if no results and optional filters were used ----------
    if (allTariffDetails.length === 0 && hasOptionalFilters) {
      this.logger.log('No tariff found with optional filters, falling back to standard rate search');

      // Build standard rate query (only mandatory fields)
      const whereStandardRate: any = {
        EffectiveDate: { lte: new Date(payload.EffectiveDate) },
        ExpiredOn:     { gte: new Date(payload.ExpiredDate) },
        tariffHeader: {
          DepartmentMasterSid: payload.DepartmentMasterSid,
          POLSid: payload.POLSid,
          PODSid: payload.PODSid,
          CompanyMasterSid: payload.CompanyMasterSid,
        },
      };

      allTariffDetails = await this._db.tariffDetail.findMany({
        where: whereStandardRate,
        include: includeClause
      });

      if (allTariffDetails.length > 0) {
        isStandardRate = true;
        this.logger.log(`Found ${allTariffDetails.length} standard rates`);
      }
    }

    // ---------- 4️⃣  If still no results, return empty array ----------
    if (allTariffDetails.length === 0) {
      this.logger.log('No tariff details found for the given criteria');
      return [];
    }

    // ---------- 5️⃣  Enrich each tariff detail ----------
    const enrichedDetails = await Promise.all(
      allTariffDetails.map(async (detail) => {
        const company = payload.CompanyMasterSid
          ? await this._db.companyMaster.findUnique({
              where: { CompanyMasterSid: payload.CompanyMasterSid },
            })
          : null;

        const toCurrencyId = company?.CurrencyMasterSid;
        const toCurrency = toCurrencyId
          ? await this.globalConfigService.getMasterData('currency_master', toCurrencyId)
          : null;

        const costFromCurrency = detail.currencyMasterBuy;
        const revenueFromCurrency = detail.currencyMasterSale;

        const costExchangeRate = toCurrency
          ? (costFromCurrency.currencyCode === toCurrency.currencyCode
              ? 1
              : await this.currencyExchangeService.getExchangeRate({
                  fromCurrencyCode: costFromCurrency.currencyCode,
                  toCurrencyCode:   toCurrency.currencyCode,
                  segment : 'cost'
                }))
          : null;

        const revenueExchangeRate = toCurrency
          ? (revenueFromCurrency.currencyCode === toCurrency.currencyCode
              ? 1
              : await this.currencyExchangeService.getExchangeRate({
                  fromCurrencyCode: revenueFromCurrency.currencyCode,
                  toCurrencyCode:   toCurrency.currencyCode,
                  segment : 'revenue'
                }))
          : null;

        return {
          ...detail,
          costExchangeRate,
          revenueExchangeRate,
          isStandardRate, // Flag to indicate if this is a standard rate
        };
      })
    );

    // ---------- 6️⃣  Return enriched array ----------
    return enrichedDetails;
  } catch (error) {
    throw error;
  }
}


  


}

