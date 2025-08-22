import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import * as moment from 'moment-timezone';
import { GlobalConfigService } from 'src/common/config/master-config.service';

@Injectable()
export class BookingService {

    constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService, private logger: Logger) { }

    async createBooking(payload: any) {

        try {
            return await this._db.$transaction(async (prisma) => {
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

                const newBooking = await prisma.bookingHeader.create({
                    data: {
                        // Section - 1 
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
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
                        HBLNo: payload.HBLNo,
                        MBLNo: payload.MBLNo,
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
                        Nominated: payload.Nominated,
                        IncoTerms: payload.IncoTerms,
                        InternalNote: payload.InternalNote,
                        GeneralNote: payload.GeneralNote,
                        NominatedBy: payload.NominatedBy,
                        ShipmentNo: payload.ShipmentNo
                    }
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
                    FreightTerms: cargoPayload.FreightTerms,
                    StuffingAt: cargoPayload.StuffingAt,
                    createdBy: payload.createdBy,
                    status: 'A'
                }

                let createdCargos = await prisma.bookingCargo.create({
                    data: cargoData
                })


                /**
                    |--------------------------------------------------
                    |  Step 3 : Create Booking Product
                    |--------------------------------------------------
                */

                const allProducts: any[] = (payload.bookingProducts || []).map(product => {
                    const productData = {
                        BookingHeaderSid: newBooking.BookingHeaderSid,
                        ProductName: product.ProductName,
                        ShippingBillNo: product.ShippingBillNo,
                        ShippingBillDate: product.ShippingBillDate,
                        ExternaPkg: product.ExternaPkg,
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
                        createdBy: payload.createdBy,
                        status: 'A'
                    }
                    return productData;
                }) || [];

                let createdProducts;
                if (allProducts.length > 0) {
                    createdProducts = await prisma.bookingProduct.createMany({
                        data: allProducts
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
                    CustomerRefNo: otherPayload.CustomerRefNo,
                    YardCFS: otherPayload.YardCFS,
                    HBLNo: otherPayload.HBLNo,
                    Forwarder: otherPayload.Forwarder,
                    ForwarderAddress: otherPayload.ForwarderAddress,
                    NotifyParty: otherPayload.NotifyParty,
                    NotifyPartyAddress: otherPayload.NotifyPartyAddress,
                    PickupPlace: otherPayload.PickupPlace,
                    DeliveryPlace: otherPayload.DeliveryPlace,
                    DeliveryDate: otherPayload.DeliveryDate,
                    CHAName: otherPayload.CHAName,
                    PickupAddress: otherPayload.PickupAddress,
                    DeliveryAddress: otherPayload.DeliveryAddress,
                    CargoCurrency: otherPayload.CargoCurrency,
                    CargoValue: otherPayload.CargoValue,
                    SwitchBL: otherPayload.SwitchBL,
                    createdBy: payload.createdBy,
                    status: 'A',
                    ReleaseType: otherPayload.ReleaseType,
                    BacktoBack: otherPayload.BacktoBack,
                    Depo: otherPayload.Depo,
                    ROValidity: otherPayload.ROValidity
                }

                let createdOthers = await prisma.bookingOthers.create({
                    data: otherData
                })


                /**
                    |--------------------------------------------------
                    |   Step 5 : Create Booking Connections
                    |--------------------------------------------------
                */

                const allConnections: any[] = (payload.bookingConnections || []).map(connection => {
                    const connectionData = {
                        BookingHeaderSid: newBooking.BookingHeaderSid,
                        Mode : connection.Mode,
                        VesselName: connection.VesselName,
                        VoyageNo: connection.VoyageNo,
                        POL: connection.POL,
                        POD: connection.POD,
                        ETD: connection.ETD,
                        ETA: connection.ETA,
                        createdBy: payload.createdBy,
                        status: 'A'
                    }
                    return connectionData;
                }) || [];

                let createdConnections;
                if (allConnections.length > 0) {
                    createdConnections = await prisma.bookingConnection.createMany({
                        data: allConnections
                    })
                }

                /**
                    |--------------------------------------------------
                    |   Step 6 : Create Booking Rates
                    |--------------------------------------------------
                */

                const allRates: any[] = (payload.bookingRates || []).map(rate => {
                    const rateData = {
                        CompanyMasterSid: newBooking.CompanyMasterSid,
                        BranchMasterSid: newBooking.BranchMasterSid,
                        BookingHeaderSid: newBooking.BookingHeaderSid,
                        SerialNumber: Number(rate.SerialNumber),
                        ChargeMasterSid: rate.ChargeMasterSid,
                        ChargeDescription: rate.ChargeDescription,
                        PrepaidCollect: rate.PrepaidCollect,
                        ChargeUomSid: rate.ChargeUomSid,
                        NumberOfUnit: Number(rate.NumberOfUnit),
                        DrCr: rate.DrCr,
                        CurrencyMasterSid: rate.CurrencyMasterSid,
                        ExchangeRate: Number(rate.ExchangeRate),
                        Rate: Number(rate.Rate),
                        Amount: Number(rate.Amount),
                        LocalAmount: Number(rate.LocalAmount),
                        CustomerMasterSid: rate.CustomerMasterSid,
                        CustomerBranchSid: rate.CustomerBranchSid,
                        VoucherHeaderSid: rate.VoucherHeaderSid,
                        VoucherTypeSid: rate.VoucherTypeSid,
                        CreatedBy: payload.createdBy,
                        Status: 'A'
                    }
                    return rateData;
                })

                let createdRates;
                if (allRates.length > 0) {
                    createdRates = await prisma.bookingRates.createMany({
                        data: allRates
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
                        MilestoneName: milestone.MilestoneName,
                        MilestoneDate: milestone.MilestoneDate,
                        AutoCaptured: milestone.AutoCaptured
                    }
                    return milestoneData;
                })

                let createdMilestones;
                if (allMilestones.length > 0) {
                    createdMilestones = await prisma.shipmentMilestone.createMany({
                        data: allMilestones
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
            })
        } catch (error) {
            console.error('Transaction failed', error);
            throw error;
        }
    }

    async getAllBooking() {
        try {
            const allBooking = await this._db.bookingHeader.findMany({
                where: {
                    deletedAt: null
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
                    bookingCargo: { where: { deletedAt: null } },
                    bookingProduct: { where: { deletedAt: null } },
                    bookingOthers: { where: { deletedAt: null } },
                    bookingConnection: { where: { deletedAt: null } },
                    bookingRates : { where : { deletedAt : null }}
                }
            })
            if (!ourBooking) {
                throw new BadRequestException('Error fetching booking record.');
            }
            return ourBooking;
        } catch (error) {
            throw error;
        }
    }

    async updateBookingById(BookingHeaderSid: number, payload: any) {
        try {
            return await this._db.$transaction(async (prisma) => {
                /**
                    |--------------------------------------------------
                    |   Step 1 : Update Booking Header
                    |--------------------------------------------------
                */
                const updatedBooking = await prisma.bookingHeader.update({
                    where: {
                        BookingHeaderSid: BookingHeaderSid
                    },
                    data: {
                        CustomerName: payload.CustomerName,
                        CustomerAddress: payload.CustomerAddress,
                        CustomerBranchSid: payload.CustomerBranchSid,
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
                        HBLNo: payload.HBLNo,
                        MBLNo: payload.MBLNo,
                        MBLDate: payload.MBLDate,
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
                        Nominated: payload.Nominated,
                        IncoTerms: payload.IncoTerms,
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
                                ExternaPkg: product.ExternaPkg,
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
                                ExternaPkg: product.ExternaPkg,
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
                            CustomerRefNo: otherPayload.CustomerRefNo,
                            YardCFS: otherPayload.YardCFS,
                            HBLNo: otherPayload.HBLNo,
                            Forwarder: otherPayload.Forwarder,
                            ForwarderAddress: otherPayload.ForwarderAddress,
                            NotifyParty: otherPayload.NotifyParty,
                            NotifyPartyAddress: otherPayload.NotifyPartyAddress,
                            PickupPlace: otherPayload.PickupPlace,
                            DeliveryPlace: otherPayload.DeliveryPlace,
                            DeliveryDate: otherPayload.DeliveryDate,
                            CHAName: otherPayload.CHAName,
                            PickupAddress: otherPayload.PickupAddress,
                            DeliveryAddress: otherPayload.DeliveryAddress,
                            CargoCurrency: otherPayload.CargoCurrency,
                            CargoValue: otherPayload.CargoValue,
                            SwitchBL: otherPayload.SwitchBL,
                            createdBy: payload.updatedBy,
                            status: "A",
                            ReleaseType: otherPayload.ReleaseType,
                            BacktoBack: otherPayload.BacktoBack,
                            Depo: otherPayload.Depo,
                            ROValidity: otherPayload.ROValidity
                        }
                    })

                } else {
                    finalBookingOther = await prisma.bookingOthers.update({
                        where: { BookingOthersSid: otherPayload.BookingOthersSid },
                        data: {
                            BookingHeaderSid: updatedBooking.BookingHeaderSid,
                            CustomerRefNo: otherPayload.CustomerRefNo,
                            YardCFS: otherPayload.YardCFS,
                            HBLNo: otherPayload.HBLNo,
                            Forwarder: otherPayload.Forwarder,
                            ForwarderAddress: otherPayload.ForwarderAddress,
                            NotifyParty: otherPayload.NotifyParty,
                            NotifyPartyAddress: otherPayload.NotifyPartyAddress,
                            PickupPlace: otherPayload.PickupPlace,
                            DeliveryPlace: otherPayload.DeliveryPlace,
                            DeliveryDate: otherPayload.DeliveryDate,
                            CHAName: otherPayload.CHAName,
                            PickupAddress: otherPayload.PickupAddress,
                            DeliveryAddress: otherPayload.DeliveryAddress,
                            CargoCurrency: otherPayload.CargoCurrency,
                            CargoValue: otherPayload.CargoValue,
                            SwitchBL: otherPayload.SwitchBL,
                            updatedBy: payload.updatedBy,
                            status: otherPayload.status,
                            ReleaseType: otherPayload.ReleaseType,
                            BacktoBack: otherPayload.BacktoBack,
                            Depo: otherPayload.Depo,
                            ROValidity: otherPayload.ROValidity
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

                    if (!connection.BookingConnectionSid) {
                        createdConnection = await prisma.bookingConnection.create({
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                Mode : connection.Mode,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                POL: connection.POL,
                                POD: connection.POD,
                                ETD: connection.ETD,
                                ETA: connection.ETA,
                                createdBy: payload.updatedBy,
                                status: 'A'
                            }
                        })

                    } else {
                        updatedConnection = await prisma.bookingConnection.update({
                            where: { BookingConnectionSid: connection.BookingConnectionSid },
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                Mode : connection.Mode,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                POL: connection.POL,
                                POD: connection.POD,
                                ETD: connection.ETD,
                                ETA: connection.ETA,
                                updatedBy: payload.updatedBy,
                                status: connection.status
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
                        createdBookingRate = await prisma.bookingRates.create({
                            data: {
                                CompanyMasterSid: payload.CompanyMasterSid,
                                BranchMasterSid: payload.BranchMasterSid,
                                BookingHeaderSid: payload.BookingHeaderSid,
                                SerialNumber: Number(rate.SerialNumber),
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeDescription: rate.ChargeDescription,
                                PrepaidCollect: rate.PrepaidCollect,
                                ChargeUomSid: rate.ChargeUomSid,
                                NumberOfUnit: Number(rate.NumberOfUnit),
                                DrCr: rate.DrCr,
                                CurrencyMasterSid: rate.CurrencyMasterSid,
                                ExchangeRate: Number(rate.ExchangeRate),
                                Rate: Number(rate.Rate),
                                Amount: Number(rate.Amount),
                                LocalAmount: Number(rate.LocalAmount),
                                CustomerMasterSid: rate.CustomerMasterSid,
                                CustomerBranchSid: rate.CustomerBranchSid,
                                VoucherHeaderSid: rate.VoucherHeaderSid,
                                VoucherTypeSid: rate.VoucherTypeSid,
                                CreatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        })
                    } else {
                        updatedBookingRate = await prisma.bookingRates.update({
                            where: { BookingRatesSid: rate.BookingRatesSid },
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                SerialNumber: Number(rate.SerialNumber),
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeDescription: rate.ChargeDescription,
                                PrepaidCollect: rate.PrepaidCollect,
                                ChargeUomSid: rate.ChargeUomSid,
                                NumberOfUnit: Number(rate.NumberOfUnit),
                                DrCr: rate.DrCr,
                                CurrencyMasterSid: rate.CurrencyMasterSid,
                                ExchangeRate: Number(rate.ExchangeRate),
                                Rate: Number(rate.Rate),
                                Amount: Number(rate.Amount),
                                LocalAmount: Number(rate.LocalAmount),
                                CustomerMasterSid: rate.CustomerMasterSid,
                                CustomerBranchSid: rate.CustomerBranchSid,
                                VoucherHeaderSid: rate.VoucherHeaderSid,
                                VoucherTypeSid: rate.VoucherTypeSid,
                                UpdatedBy: payload.updatedBy,
                                Status: payload.Status
                            }
                        })
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
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured
                            }
                        })
                    } else {
                        updatedMilestones = await prisma.shipmentMilestone.update({
                            where: { ShipmentMilestoneSid: milestone.ShipmentMilestoneSid },
                            data: {
                                ShipmentNo: updatedBooking.ShipmentNo,
                                UpdatedBy: payload.updatedBy,
                                Status: payload.status,
                                MilestoneMasterSid: milestone.MilestoneMasterSid,
                                MilestoneName: milestone.MilestoneName,
                                MilestoneDate: milestone.MilestoneDate,
                                AutoCaptured: milestone.AutoCaptured
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
                    finalBookingRates,
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
            if (existing.deletedAt) {
                throw new BadRequestException('Provided Booking id is already deleted');
            }
            const result = await this._db.$transaction(async (prisma) => {
                const deletedBooking = await prisma.bookingHeader.update({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { deletedAt: new Date() }
                })

                const deletedCargos = await prisma.bookingCargo.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { deletedAt: new Date() }
                })
                const deletedProducts = await prisma.bookingProduct.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { deletedAt: new Date() }
                })
                const deletedOthers = await prisma.bookingOthers.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { deletedAt: new Date() }
                })
                const deletedConnections = await prisma.bookingConnection.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { deletedAt: new Date() }
                })
                const deletedRates = await prisma.bookingRates.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { deletedAt: new Date() }
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

    async searchBooking(params: SearchVesselDto) {
        const { search = '', page = 1, pageSize = 15 } = params;
        const skip = (page - 1) * pageSize;

        let salesmanIds: number[] = [];
        let shipmentNosByMilestone: string[] = [];

        if (search) {
            /**
             *  Taking all UserSId associated with search
             */

            const users = await this._db.userMaster.findMany({
                where: { userName: { contains: search, mode: 'insensitive' }, deletedAt: null },
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
                where: { MilestoneName: { contains: search, mode: 'insensitive' } , deletedAt : null },
                select: { ShipmentNo: true, ShipmentMilestoneSid: true },
                orderBy: [{ ShipmentNo: 'asc' }, { ShipmentMilestoneSid: 'desc' }],
            });
            shipmentNosByMilestone = [...new Map(milestones.map(m => [m.ShipmentNo, m])).keys()];
        }

        const where: Prisma.BookingHeaderWhereInput = {
            deletedAt: null,
            status: 'A',
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
                data: { deletedAt: new Date() }
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
                data: { deletedAt: new Date() }
            })
            return deletedBookingConnection;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteBookingRates(BookingRateSid: number) {
        try {
            const deletedBookingConnection = await this._db.bookingRates.update({
                where: { BookingRatesSid: BookingRateSid },
                data: { deletedAt : new Date() }
            })
            return deletedBookingConnection;
        } catch (error) {
            throw error;
        }
    }



    async getCustomerRelatedLookups(payload: any) {
        try {
            const [customers, salesmans, shippers, consignees, agents, carriers, forwarder, notify] = await this._db.$transaction([
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, deletedAt: null },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerSalesTeam.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, deletedAt: null },
                    select: { Salesman: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['shipper'], equals: 'isTrue' }, deletedAt: null },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['consignee'], equals: 'isTrue' }, deletedAt: null },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['agent'], equals: 'isTrue' }, deletedAt: null },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true, countryMaster: { select: { countryName: true } } }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['carrier'], equals: 'isTrue' }, deletedAt: null },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['forwarder'], equals: 'isTrue' }, deletedAt: null },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                }),
                this._db.customerMaster.findMany({
                    where: { CompanyMasterSid: payload.CompanyMasterSid, CustomerType: { path: ['notify'], equals: 'isTrue' }, deletedAt: null },
                    select: { CustomerMasterSid: true, CustomerName: true, CustomerAddress1: true }
                })
            ]);
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

            return { customers, salesmans: processedSalesmans, shippers, consignees, agents: processedAgents, carriers, forwarder, notify };
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
                notify: []
            };
        }
    }

    async getAllHeaderLookups(payload: any) {
        try {
            const [departments, vessels, ports, incos] = await this._db.$transaction([
                this._db.departmentMaster.findMany({
                    where: { deletedAt: null, CompanyMasterSid: payload.CompanyMasterSid },
                    select: {
                        DepartmentMasterSid: true,
                        departmentName: true,
                        departmentType: true,
                        FCLLCL: true,
                        ExportImport: true,
                    }
                }),
                this._db.vesselMaster.findMany({
                    where: { deletedAt: null },
                    select: {
                        VesselMasterSid: true,
                        VesselName: true
                    },
                }),
                this._db.portMaster.findMany({
                    where: { deletedAt: null },
                    select: {
                        PortMasterSid: true,
                        PortName: true,
                        PortCode: true,
                        PortType: true
                    },
                }),
                this._db.incoMaster.findMany({
                    where: { deletedAt: null },
                    select: {
                        IncoMasterSid: true,
                        IncoName: true,
                    },
                }),

            ]);
            return { departments, vessels, ports, incos }
        } catch (error) {
            console.error('Error fetching Header Lookups:', error);
            return {
                departments: [],
                vessels: [],
                ports: [],
                incos: []
            };
        }
    }

    async getAllContainerTypes() {
        try {
            const allContainerTypes = await this._db.containerTypeMaster.findMany({
                where: {
                    deletedAt: null
                },
                select: {
                    ContainerTypeMasterSid: true,
                    ContainerName: true,
                    ContainerCode: true
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
                    deletedAt: null
                },
                select: {
                    CurrencyMasterSid: true,
                    currencyName: true,
                    currencyCode: true
                }
            })
            return allContainerTypes;
        } catch (error) {
            throw error;
        }
    }

    async getAllProductLookups(payload: any) {
        try {
            const [products, packageTypes ,imcos,uoms] = await this._db.$transaction([
                this._db.productMaster.findMany({
                    where: { deletedAt: null, CompanyMasterSid: payload.CompanyMasterSid },
                    select: {
                        ProductMasterSId : true,
                        ProductName : true,
                        IMOClass : true,
                        ProductType : true,
                        UNNo : true,
                        PackingGroup : true
                    }
                }),
                this._db.packageTypeMaster.findMany({
                    where: { deletedAt: null, CompanyMasterSid: payload.CompanyMasterSid },
                    select: {
                        PackageTypeMasterSid: true,
                        PackageName: true
                    },
                }),
                this._db.imcoMaster.findMany({
                    where: { deletedAt: null },
                    select: {
                        ImcoMasterSid: true,
                        ImcoName: true
                    },
                }),
                this._db.uOMMaster.findMany({
                    where: { deletedAt: null },
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

    async getAllMilestones(payload:any){
        try {
            const allMilestones = await this._db.milestoneMaster.findMany({
                where : {
                    deletedAt : null,
                    CompanyMasterSid : payload.CompanyMasterSid,
                    BranchMasterSid : payload.BranchMasterSid
                },
                select : {
                    MilestoneMasterSid : true,
                    MilestoneName : true,
                    AutoCapture : true,
                    DepartmentMasterSid : true,
                    Remarks : true
                }
            })
            return allMilestones;
        } catch (error) {
            throw error;
        }
    }

    async getShipmentMilestoneByShipmentNo(payload: any){
        try {
            const allShipmentMilestone = await this._db.shipmentMilestone.findMany({
                where : {
                    ShipmentNo : payload.ShipmentNo,
                    CompanyMasterSid : payload.CompanyMasterSid,
                    BranchMasterSid : payload.BranchMasterSid,
                    deletedAt : null
                },
                orderBy : {
                    ShipmentMilestoneSid : 'asc'
                }
            })
            return allShipmentMilestone;
        } catch (error) {
            throw error;
        }
    }

    async getAllRateLookups(payload: any){
        try {
            const [charges,uoms,docTypes ] = await this._db.$transaction([
                this._db.chargeMaster.findMany({
                    where: { deletedAt: null, CompanyMasterSid: payload.CompanyMasterSid },
                    select: {
                        ChargeMasterSid : true,
                        chargeName : true,
                        chargeCode : true,
                        CurrencyMasterSid : true,
                        UOM : true,
                        chargeTaxMaster : {
                            take : 1,
                            select : {
                                description : true
                            }
                        },
                    }
                }),
                this._db.uOMMaster.findMany({
                    where: { deletedAt: null },
                    select: {
                        UOMMasterSid : true,
                        UOMName : true,
                        UOMCode : true
                    },
                }),
                this._db.documentTypeMaster.findMany({
                    where: { deletedAt: null },
                    select: {
                        DocumentTypeMasterSid: true,
                        DocumentTypeName: true
                    },
                })

            ]);
            return { charges,uoms,docTypes }
        } catch (error) {
            console.error('Error fetching Rate Lookups:', error);
            return {
                charges: [],
                uoms: [],
                docTypes: []
            };
        }
    }
}

