import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import * as moment from 'moment-timezone';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { OperationCommonService, RateDTO } from '../operation-common/operation-common.service';
import { saveShipmentMilestones, getShipmentMilestones } from '../shipment-milestone/shipment-milestone.helper';
import { CurrencyExchangeService } from 'src/masters/services/currency-exchange/currency-exchange.service';
import { statusWhereClause } from 'src/common/helper';
import { NumberSeriesService } from 'src/settings/services/number-series/number-series.service';
import { DuplicateCheckDTO } from 'src/operation/DTO/booking.dto';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { MenuUserConfigService } from 'src/settings/services/menu-user-config/menu-user-config.service';

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
    BranchMasterSid: number;             // required – branch

    // ------- Optional filters --------
    PORSid?: number;                     // Port of Origin
    FPODSid?: number;                    // Final Port of Discharge
    Carrier?: number;                    // Carrier customer id
    AgentSid?: number;                    // Agent id
    IncoTerms?: string;                  // e.g., "FOB", "CIF"
    CargoType?: string;                  // e.g., "FCL", "LCL"
    ContainerType?: number;
}


@Injectable()
export class BookingService {

    constructor(
        private _db: DatabaseService,
        private globalConfigService: GlobalConfigService,
        private logger: Logger,
        private commonService: OperationCommonService,
        private currencyExchangeService: CurrencyExchangeService,
        private numberSeriesService: NumberSeriesService,
        private menuUserConfigService: MenuUserConfigService
    ) { }

    private getCargoPayloadList(payload: any): any[] {
        if (Array.isArray(payload?.bookingCargo)) {
            return payload.bookingCargo;
        }

        if (payload?.bookingCargo) {
            return [payload.bookingCargo];
        }

        return [];
    }

    private getCargoProducts(cargo: any, fallbackProducts: any[] = []): any[] {
        if (Array.isArray(cargo?.bookingProducts)) {
            return cargo.bookingProducts;
        }

        if (Array.isArray(cargo?.bookingProduct)) {
            return cargo.bookingProduct;
        }

        if (Array.isArray(cargo?.products)) {
            return cargo.products;
        }

        return fallbackProducts;
    }

    private buildBookingCargoData(cargoPayload: any, bookingHeader: any, createdBy: string) {
        return {
            CompanyMasterSid: bookingHeader.CompanyMasterSid,
            BranchMasterSid: bookingHeader.BranchMasterSid,
            BookingHeaderSid: bookingHeader.BookingHeaderSid,
            CargoType: cargoPayload?.CargoType || 'General',
            ContainerType: cargoPayload?.ContainerType ?? null,
            NoofContainers: Number(cargoPayload?.NoofContainers ?? cargoPayload?.Qty ?? 0) || 0,
            GrossWeight: Number(cargoPayload?.GrossWeight) || 0,
            NetWeight: Number(cargoPayload?.NetWeight) || 0,
            Volume: Number(cargoPayload?.Volume) || 0,
            Volumetric: Number(cargoPayload?.Volumetric) || 0,
            ChargeableWeight: Number(cargoPayload?.ChargeableWeight) || 0,
            NoOfPackage: Number(cargoPayload?.NoOfPackage ?? cargoPayload?.PackageQty ?? 0) || 0,
            ShipmentTerms: cargoPayload?.ShipmentTerms ?? null,
            MovementType: cargoPayload?.MovementType ?? null,
            ModeOfTransport: cargoPayload?.ModeOfTransport ?? null,
            FreightTerms: cargoPayload?.FreightTerms ?? null,
            StuffingAt: cargoPayload?.StuffingAt ?? null,
            createdBy,
            status: 'A'
        };
    }

    private buildBookingProductData(product: any, bookingHeaderSid: number, createdBy: string) {
        return {
            BookingHeaderSid: bookingHeaderSid,
            ProductName: product?.ProductName || '',
            ShippingBillNo: product?.ShippingBillNo || '',
            ShippingBillDate: product?.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
            CargoRecDate: product?.CargoRecDate ? new Date(product.CargoRecDate) : null,
            ExternaPkg: String(product?.ExternaPkg ?? product?.ExternalPkg ?? '') || '',
            ExternlQty: product?.ExternlQty ?? product?.ExternalQty ?? '',
            GrossWeight: Number(product?.GrossWeight) || 0,
            NetWeight: Number(product?.NetWeight) || 0,
            Volume: Number(product?.Volume) || 0,
            IsHaz: product?.IsHaz || 'N',
            ImcoClass: product?.ImcoClass === null || product?.ImcoClass === undefined || product?.ImcoClass === '' ? null : String(product.ImcoClass),
            UnNo: String(product?.UnNo ?? '') || '',
            PkgGroup: product?.PkgGroup || '',
            Length: product?.Length,
            Width: product?.Width,
            Height: product?.Height,
            Volumetric: Number(product?.Volumetric) || 0,
            UomMasterSid: product?.UomMasterSid || null,
            createdBy,
            status: 'A',
            ...(product?.CargoRecDate ? { RecdPack: product?.ExternlQty ?? product?.ExternalQty ?? '' } : {})
        };
    }

    private buildBookingCargoUpdateData(cargoPayload: any, updatedBy: string) {
        return {
            CargoType: cargoPayload?.CargoType || 'General',
            ContainerType: cargoPayload?.ContainerType ?? null,
            NoofContainers: Number(cargoPayload?.NoofContainers ?? cargoPayload?.Qty ?? 0) || 0,
            GrossWeight: Number(cargoPayload?.GrossWeight) || 0,
            NetWeight: Number(cargoPayload?.NetWeight) || 0,
            Volume: Number(cargoPayload?.Volume) || 0,
            Volumetric: Number(cargoPayload?.Volumetric) || 0,
            ChargeableWeight: Number(cargoPayload?.ChargeableWeight) || 0,
            NoOfPackage: Number(cargoPayload?.NoOfPackage ?? cargoPayload?.PackageQty ?? 0) || 0,
            ShipmentTerms: cargoPayload?.ShipmentTerms ?? null,
            MovementType: cargoPayload?.MovementType ?? null,
            ModeOfTransport: cargoPayload?.ModeOfTransport ?? null,
            FreightTerms: cargoPayload?.FreightTerms ?? null,
            StuffingAt: cargoPayload?.StuffingAt ?? null,
            updatedBy,
            updatedOn: new Date(),
            status: cargoPayload?.status || 'A'
        };
    }

    private buildBookingProductUpdateData(product: any, bookingHeaderSid: number, updatedBy: string) {
        return {
            BookingHeaderSid: bookingHeaderSid,
            ProductName: product?.ProductName || '',
            ShippingBillNo: product?.ShippingBillNo || '',
            ShippingBillDate: product?.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
            CargoRecDate: product?.CargoRecDate ? new Date(product.CargoRecDate) : null,
            ExternaPkg: String(product?.ExternaPkg ?? product?.ExternalPkg ?? '') || '',
            ExternlQty: product?.ExternlQty ?? product?.ExternalQty ?? '',
            GrossWeight: Number(product?.GrossWeight) || 0,
            NetWeight: Number(product?.NetWeight) || 0,
            Volume: Number(product?.Volume) || 0,
            IsHaz: product?.IsHaz || 'N',
            ImcoClass: product?.ImcoClass === null || product?.ImcoClass === undefined || product?.ImcoClass === '' ? null : String(product.ImcoClass),
            UnNo: String(product?.UnNo ?? '') || '',
            PkgGroup: product?.PkgGroup || '',
            Length: product?.Length,
            Width: product?.Width,
            Height: product?.Height,
            Volumetric: Number(product?.Volumetric) || 0,
            UomMasterSid: product?.UomMasterSid || null,
            updatedBy,
            updatedOn: new Date(),
            status: product?.status || 'A',
            ...(product?.CargoRecDate ? { RecdPack: product?.ExternlQty ?? product?.ExternalQty ?? '' } : {})
        };
    }

    async checkDuplicateBooking(payload: DuplicateCheckDTO) {
        try {
            const whereClause: Prisma.BookingHeaderWhereInput = {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                DepartmentMasterSid: payload.DepartmentMasterSid,
                BookingDateTime: payload.BookingDateTime,
                CustomerMasterSid: payload.CustomerMasterSid,
                POL: payload.POL,
                POD: payload.POD,
                status: 'A'
            }

            if (payload.isEditMode) {
                whereClause.BookingHeaderSid = { not: payload.BookingHeaderSid }
            }

            const existingRecord = await this._db.bookingHeader.findFirst({
                where: whereClause
            })

            if (existingRecord) {
                return true;
            }
            return false;

        } catch (error) {
            throw error;
        }
    }

    async createBooking(payload: any) {
        let newBooking;
        try {
            // Get MenuMasterSid for Booking (look up by code or use provided value)
            this.logger.log(`[NumberSeries] Starting - payload.MenuMasterSid: ${payload.MenuMasterSid}, payload.NumberSeriesMenuMasterSid: ${payload.NumberSeriesMenuMasterSid}`);
            this.logger.log(`[NumberSeries] CompanyMasterSid: ${payload.CompanyMasterSid}, BranchMasterSid: ${payload.BranchMasterSid}, DepartmentMasterSid: ${payload.DepartmentMasterSid}`);

            // let numberSeriesMenuId = payload.NumberSeriesMenuMasterSid || payload.MenuMasterSid;
            // if (!numberSeriesMenuId) {
            let numberSeriesMenuId;
            const bookingMenu = await this._db.menuMaster.findFirst({
                where: {
                    OR: [
                        { MenuCode: 'BKN' }
                        // { MenuName: { contains: 'booking', mode: 'insensitive' } }
                    ],
                    status: { in: ['A', 'S'] }
                }
            });
            numberSeriesMenuId = bookingMenu?.MenuMasterSid;
            // ================= RESOLVE JOB DATE FIRST =================
            let resolvedJobDate: Date = payload.BookingDateTime
                ? new Date(payload.BookingDateTime)
                : new Date();

            if (payload?.shipmentList?.length) {
                const bookingIds = payload.shipmentList
                    .map(s => s.BookingHeaderSid)
                    .filter(Boolean);

                if (bookingIds.length > 0) {
                    const firstBooking = await this._db.bookingHeader.findFirst({
                        where: { BookingHeaderSid: { in: bookingIds } },
                        select: { BookingDateTime: true }
                    });

                    if (firstBooking?.BookingDateTime) {
                        resolvedJobDate = new Date(firstBooking.BookingDateTime);
                    }
                }
            }
            this.logger.log(`[NumberSeries] Menu lookup result: ${JSON.stringify(bookingMenu)}`);
            // }
            this.logger.log(`[NumberSeries] Final numberSeriesMenuId: ${numberSeriesMenuId}`);


            // Generate booking number using NumberSeriesService
            let BookingNo: string | null = null;
            if (numberSeriesMenuId && payload.CompanyMasterSid && payload.BranchMasterSid) {
                this.logger.log(`[NumberSeries] Calling generateNextNumber with MenuMasterSid: ${numberSeriesMenuId}`);
                // Resolve POL/POD port Sids for number series counter key
                const [polPortBkn, podPortBkn] = await Promise.all([
                    payload.POL ? this._db.portMaster.findFirst({ where: { PortCode: payload.POL }, select: { PortMasterSid: true } }) : null,
                    payload.POD ? this._db.portMaster.findFirst({ where: { PortCode: payload.POD }, select: { PortMasterSid: true } }) : null,
                ]);
                try {
                    BookingNo = await this.numberSeriesService.generateNextNumber(
                        payload.CompanyMasterSid,
                        payload.BranchMasterSid,
                        numberSeriesMenuId,
                        payload.DepartmentMasterSid ?? undefined,
                        resolvedJobDate,
                        polPortBkn?.PortMasterSid,
                        podPortBkn?.PortMasterSid,
                    );
                    this.logger.log(`[NumberSeries] Generated BookingNo: ${BookingNo}, Length: ${BookingNo?.length}`);
                } catch (err) {
                    this.logger.error(`[NumberSeries] Error generating number: ${err.message}`);
                }
            } else {
                this.logger.warn(`[NumberSeries] Skipping generation - Missing: menuId=${numberSeriesMenuId}, company=${payload.CompanyMasterSid}, branch=${payload.BranchMasterSid}`);
            }

            // Fallback to legacy format if NumberSeriesService didn't generate
            if (!BookingNo) {
                this.logger.log(`[NumberSeries] Using legacy fallback format`);
                const dateString = moment().format('YYYYMMDD');
                const count = await this._db.bookingHeader.count({
                    where: { BookingNo: { contains: dateString } }
                });
                BookingNo = `booking-${dateString}-${(count + 1).toString().padStart(3, '0')}`;
            }

            // Truncate if too long (BookingNo column is VarChar(50))
            if (BookingNo && BookingNo.length > 50) {
                this.logger.warn(`BookingNo truncated from ${BookingNo.length} chars: ${BookingNo}`);
                BookingNo = BookingNo.substring(0, 50);
            } // Log the data object being inserted to find the too-long column
            const bookingData = {
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                MenuMasterSid: payload.MenuMasterSid,
                BookingNo: BookingNo,
                JobType: payload.JobType,
                VoyageNo: payload.VoyageNo,
                MovementType: payload.MovementType,
                ShipmentType: payload.ShipmentType,
                IncoTerms: payload.IncoTerms,
                CustomerName: payload.CustomerName,
                ShipperName: payload.ShipperName,
                ConsigneeName: payload.ConsigneeName,
            };
            this.logger.log(`[BookingData] Insert payload: ${JSON.stringify(bookingData)}`);
            this.logger.log(`[BookingData] Field lengths - JobType: ${payload.JobType?.length}, VoyageNo:
${payload.VoyageNo?.length}, MovementType: ${payload.MovementType?.length}, ShipmentType:
${payload.ShipmentType?.length}, IncoTerms: ${payload.IncoTerms?.length}`);
 const resourcePerson =
        (await this.menuUserConfigService.getConfiguredUser(
          payload.CompanyMasterSid,
          payload.BranchMasterSid,
          payload.MenuMasterSid,
        ));
            const bookingHeader = await this._db.$transaction(async (prisma) => {
                /**
                    |--------------------------------------------------
                    |   Step 2 : Create Booking Header
                    |--------------------------------------------------
                */

                const createBookingHeader = await prisma.bookingHeader.create({
                    data: {
                        // Section - 1 
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        MenuMasterSid: payload.MenuMasterSid,
                        BookingNo: BookingNo,
                        BookingDateTime: payload.BookingDateTime,
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        CustomerMasterSid: payload.CustomerMasterSid,
                        CustomerBranchSid: payload.CustomerBranchSid,
                        CustomerName: payload.CustomerName,
                        CustomerAddress: payload.CustomerAddress,
                        SalesmanSid: payload.SalesmanSid,
                        ShipperName: payload.ShipperName,
                        ShipperAddress: payload.ShipperAddress,
                        ConsigneeName: payload.ConsigneeName,
                        JobType: payload.JobType,
                        ConsigneeAddress: payload.ConsigneeAddress,
                        DestinationAgent: payload.DestinationAgent,
                        Notify: payload.Notify,
                        NotifyAddress: payload.NotifyAddress,
                        AgentName: payload.AgentName,
                        AgentAddress: payload.AgentAddress,
                        CarrierName: payload.CarrierName,
                        CarrierSid: payload.CarrierSid,
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
                        PortCutoffDate: payload.PortCutoffDate,
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
                        BookingStatus: payload.BookingStatus || 'Booked'
                    }
                })

                return { ...createBookingHeader }
            })
            const croPayload = payload.bookingCro ?? {};
            const croData = {
                CompanyMasterSid: bookingHeader.CompanyMasterSid,
                BranchMasterSid: bookingHeader.BranchMasterSid!,
                BookingHeaderSid: bookingHeader.BookingHeaderSid,
                OnHireRef: croPayload.OnHireRef,
                ReleaseOrderDate: croPayload.ReleaseOrderDate,
                ValidityDate: croPayload.ValidityDate,
                ContainerReleaseDate: croPayload.ContainerReleaseDate,
                EmptySurveyDate: croPayload.EmptySurveyDate,
                Transporter: croPayload.Transporter,
                EmptyYard: croPayload.EmptyYard,
                NoteToYard: croPayload.NoteToYard,
                NoteToShipper: croPayload.NoteToShipper,
                CreatedBy: payload.createdBy,

            }
            let createdCro = await this._db.bookingCro.create({
                data: croData
            }).catch(err => {
                throw new InternalServerErrorException('Something went wrong while creating booking CRO', err)
            })
            /**
                |--------------------------------------------------
                |  Step 2 : Create Booking Cargos
                |--------------------------------------------------
            */
            const cargoPayloads = this.getCargoPayloadList(payload);
            const createdCargos: any[] = [];
            for (const cargoPayload of cargoPayloads) {
                const cargoData = this.buildBookingCargoData(cargoPayload, bookingHeader, payload.createdBy);
                const createdCargo = await this._db.bookingCargo.create({
                    data: cargoData
                }).catch(err => {
                    throw new InternalServerErrorException('Something went wrong while creating booking cargo', err)
                });
                createdCargos.push(createdCargo);
            }


            /**
                |--------------------------------------------------
                |  Step 3 : Create Booking Product
                |--------------------------------------------------
            */

            const createdProducts: any[] = [];
            if (cargoPayloads.length > 0) {
                for (let i = 0; i < cargoPayloads.length; i++) {
                    const cargoPayload = cargoPayloads[i];
                    const cargoRecord = createdCargos[i];
                    const cargoProducts = this.getCargoProducts(cargoPayload, []);

                    for (const product of cargoProducts) {
                        const createdProduct = await this._db.bookingProduct.create({
                            data: {
                                ...this.buildBookingProductData(product, bookingHeader.BookingHeaderSid, payload.createdBy),
                                BookingCargoSid: cargoRecord?.BookingCargoSid || null
                            }
                        }).catch(err => {
                            throw new InternalServerErrorException('Something went wrong while creating bookingProduct', err)
                        });
                        createdProducts.push(createdProduct);
                    }
                }
            } else {
                const flatProducts: any[] = payload.bookingProducts || [];

                for (const product of flatProducts) {
                    const createdProduct = await this._db.bookingProduct.create({
                        data: this.buildBookingProductData(product, bookingHeader.BookingHeaderSid, payload.createdBy)
                    }).catch(err => {
                        throw new InternalServerErrorException('Something went wrong while creating bookingProduct', err)
                    });
                    createdProducts.push(createdProduct);
                }
            }

            /**
                |--------------------------------------------------
                |   Step 4 : Create Booking Others
                |--------------------------------------------------
            */

            const otherPayload = payload.bookingOther ?? {};

            const otherData = {
                BookingHeaderSid: bookingHeader.BookingHeaderSid,
                CustomerRefNo: otherPayload.CustomerRefNo || '',
                YardCFS: otherPayload.YardCFS || '',
                HBLNo: otherPayload.HBLNo || '',
                Forwarder: otherPayload.Forwarder || '',
                ForwarderAddress: otherPayload.ForwarderAddress || '',
                NotifyParty: otherPayload.NotifyParty || '',
                NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                OriginAgent: otherPayload.OriginAgent || '',
                OriginAgentAddress: otherPayload.OriginAgentAddress || '',
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
                ResourcePerson: resourcePerson,
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
                    BookingHeaderSid: bookingHeader.BookingHeaderSid,
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
                (rate, index) => {
                    return {
                        BookingHeaderSid: bookingHeader.BookingHeaderSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        CreatedBy: payload.createdBy,

                        SerialNumber: (index + 1) || null,
                        ChargeMasterSid: rate.ChargeMasterSid,
                        ChargeDescription: rate.ChargeDescription,

                        ChargeUomSid: rate.ChargeUomSid || null,
                        RevenueChargeUomSid: rate.RevenueChargeUomSid || null,
                        CostChargeUomSid: rate.CostChargeUomSid || null,

                        NoOfUnit: Number(rate.NoOfUnit) || null,
                        RevenueNumberOfUnit: Number(rate.RevenueNumberOfUnit) || null, // This field has Decimal(4,3) - not used for main quantity
                        CostNumberOfUnit: Number(rate.CostNumberOfUnit) || null, // This field has Decimal(4,3) - not used for main quantity


                        // Revenue Section
                        RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid || null,
                        RevenueExchangeRate: rate.RevenueExchangeRate ? Number(rate.RevenueExchangeRate) : null,
                        RevenueRate: rate.RevenueRate ? Number(rate.RevenueRate) : null,
                        RevenueAmount: Number(rate.RevenueAmount || 0),
                        RevenueLocalAmount: Number(rate.RevenueLocalAmount || 0),
                        RevenueDrCr: rate.RevenueDrCr || 'C',
                        CustomerMasterSid: rate.RevenueCustomerMasterSid,
                        CustomerBranchSid: rate.RevenueCustomerBranchSid,
                        RevenuePrepaidCollect: rate.RevenuePrepaidCollect || 'Prepaid',

                        // Cost Section
                        CostCurrencyMasterSid: rate.CostCurrencyMasterSid || null,
                        CostExchangeRate: rate.CostExchangeRate ? Number(rate.CostExchangeRate) : null,
                        CostRate: rate.CostRate ? Number(rate.CostRate) : null,
                        CostAmount: Number(rate.CostAmount || 0),
                        CostLocalAmount: Number(rate.CostLocalAmount || 0),
                        CostDrCr: rate.CostDrCr || 'D',
                        AgentMasterSid: rate.CostAgentMasterSid || null,
                        AgentBranchSid: rate.CostAgentBranchSid || null,
                        CostPrepaidCollect: rate.CostPrepaidCollect || 'Prepaid',


                        // PrepaidCollect: rate.PrepaidCollect || null,
                        QuoteChargeSid: rate.QuoteChargeSid || null,
                        TariffDetailSid: rate.TariffDetailSid || null,
                        Remarks: rate.Remarks || null,
                        Status: 'A'
                    }
                }
            )

            let createdRates;
            if (allRates.length > 0) {
                createdRates = await this._db.bookingRates.createMany({
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

            const createdMilestones = await saveShipmentMilestones(this._db, payload.milestones, {
                ShipmentNo: bookingHeader.ShipmentNo,
                CompanyMasterSid: bookingHeader.CompanyMasterSid,
                BranchMasterSid: bookingHeader.BranchMasterSid,
                BookingHeaderSid: bookingHeader.BookingHeaderSid,
                actorEmail: payload.createdBy,
            }).catch(err => {
                throw new InternalServerErrorException('Something went wrong while creating shipmentMilestone', err)
            });

            if (bookingHeader.QuotationHeaderSid) {
                try {
                    const quoteRouteSid = payload.QuoteRouteSid;

                    // 1. ALWAYS update the specific QuoteRoute with BookingHeaderSid
                    if (quoteRouteSid) {


                        await this._db.quoteRoute.update({
                            where: {
                                QuoteRouteSid: quoteRouteSid,
                                QuoteHeaderSid: bookingHeader.QuotationHeaderSid // Extra safety check
                            },
                            data: {
                                BookingHeaderSid: bookingHeader.BookingHeaderSid,
                                updatedOn: new Date(),
                                updatedBy: payload.createdBy || bookingHeader.createdBy
                            }
                        });

                    }

                    // 2. Update QuoteHeader.BookingHeaderSid ONLY if it's null (first booking)
                    const quoteHeader = await this._db.quoteHeader.findUnique({
                        where: { QuoteHeaderSid: bookingHeader.QuotationHeaderSid },
                        select: { BookingHeaderSid: true }
                    });

                    if (!quoteHeader?.BookingHeaderSid) {


                        await this._db.quoteHeader.update({
                            where: { QuoteHeaderSid: bookingHeader.QuotationHeaderSid },
                            data: {
                                BookingHeaderSid: bookingHeader.BookingHeaderSid,
                                updatedOn: new Date(),
                                updatedBy: payload.createdBy || bookingHeader.createdBy
                            }
                        });
                    }

                } catch (error) {
                    this.logger.error(`[Booking] Failed to update Quote/Route with BookingHeaderSid: ${error.message}`);

                }
            }

            return {
                bookingHeader,
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

    async findBookingById(BookingHeaderSid: number,CompanyMasterSid: number,BranchMasterSid: number) {
        try {
            const ourBooking = await this._db.bookingHeader.findUnique({
                where: {
                    BookingHeaderSid: BookingHeaderSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                },
                include: {
                    departmentMaster: { select: { departmentName: true } },
                    quotationHeader: { select: { QuoteNumber: true } },
                    bookingCargo: { where: { status: 'A' } },
                    bookingProduct: { where: { status: 'A' } },
                    bookingOthers: { where: { status: 'A' } },
                    bookingCro: true,
                    bookingConnection: { where: { status: 'A' } },
                    houseJob: {
                        where: {
                            status: 'A'
                        },
                        select: {
                            HouseJobSid: true,
                            HBLNo: true,
                        }
                    }
                }
            })
            if (!ourBooking) {
      throw new UnauthorizedException('Access denied.');
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
            const cargosWithProducts = ourBooking.bookingCargo.map(cargo => {
                return {
                    ...cargo,
                    products: ourBooking.bookingProduct.filter(
                        p => p.BookingCargoSid === cargo.BookingCargoSid
                    )
                };
            });

            return {
                ...ourBooking,
                bookingCargo: cargosWithProducts,
                bookingRates: respectiveCostRevenueCharges,
                voyageDetails
            }
        } catch (error) {
            throw error;
        }
    }

    async updateBookingById(BookingHeaderSid: number, payload: any) {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                /**
                    |--------------------------------------------------
                    |   Step 1 : Update Booking Header
                    |--------------------------------------------------
                */
                const updatedBooking: any = await prisma.bookingHeader.update({
                    where: {
                        BookingHeaderSid: BookingHeaderSid
                    },
                    data: {
                        BookingDateTime: payload.BookingDateTime,
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
                        JobType: payload.JobType,
                        NotifyAddress: payload.NotifyAddress,
                        AgentName: payload.AgentName,
                        AgentAddress: payload.AgentAddress,
                        CarrierName: payload.CarrierName,
                        CarrierSid: payload.CarrierSid,
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
                        PortCutoffDate: payload.PortCutoffDate,
                        MovementType: payload.MovementType,
                        DoValid: payload.DoValid,
                        Coload: payload.Coload,
                        ShipmentType: payload.ShipmentType,
                        IncoTerms: payload.IncoTerms,
                        FreightTerms: payload.FreightTerms,
                        InternalNote: payload.InternalNote,
                        GeneralNote: payload.GeneralNote,
                        NominatedBy: payload.NominatedBy,
                        BookingStatus: payload.BookingStatus || 'Booked'
                    }
                })

                /**
                    |--------------------------------------------------
                    |   Step 2 : Update Booking Cargo
                    |--------------------------------------------------
                */

                const cargoPayloads = this.getCargoPayloadList(payload);
                const finalBookingCargos: any[] = [];
                const finalBookingProducts: any[] = [];

                if (cargoPayloads.length > 0) {
                    const existingCargos = await prisma.bookingCargo.findMany({
                        where: { BookingHeaderSid: updatedBooking.BookingHeaderSid }
                    });
                    const existingProducts = await prisma.bookingProduct.findMany({
                        where: { BookingHeaderSid: updatedBooking.BookingHeaderSid }
                    });

                    const existingCargoSidSet = new Set(existingCargos.map((cargo) => cargo.BookingCargoSid));
                    const existingProductSidSet = new Set(existingProducts.map((product) => product.BookingProductSid));
                    const touchedCargoSidSet = new Set<number>();
                    const touchedProductSidSet = new Set<number>();

                    for (const cargoPayload of cargoPayloads) {
                        const cargoSid = cargoPayload?.BookingCargoSid ? Number(cargoPayload.BookingCargoSid) : null;
                        let savedCargo;

                        if (cargoSid && existingCargoSidSet.has(cargoSid)) {
                            savedCargo = await prisma.bookingCargo.update({
                                where: { BookingCargoSid: cargoSid },
                                data: {
                                    ...this.buildBookingCargoUpdateData(cargoPayload, payload.updatedBy),
                                    BookingHeaderSid: updatedBooking.BookingHeaderSid
                                }
                            });
                        } else {
                            savedCargo = await prisma.bookingCargo.create({
                                data: this.buildBookingCargoData(cargoPayload, updatedBooking, payload.updatedBy)
                            });
                        }

                        touchedCargoSidSet.add(savedCargo.BookingCargoSid);
                        finalBookingCargos.push(savedCargo);

                        const cargoProducts = this.getCargoProducts(cargoPayload, []);
                        for (const product of cargoProducts) {
                            const productSid = product?.BookingProductSid ? Number(product.BookingProductSid) : null;
                            let savedProduct;

                            if (productSid && existingProductSidSet.has(productSid)) {
                                savedProduct = await prisma.bookingProduct.update({
                                    where: { BookingProductSid: productSid },
                                    data: {
                                        ...this.buildBookingProductUpdateData(product, updatedBooking.BookingHeaderSid, payload.updatedBy),
                                        BookingCargoSid: savedCargo.BookingCargoSid
                                    }
                                });
                            } else {
                                savedProduct = await prisma.bookingProduct.create({
                                    data: {
                                        ...this.buildBookingProductData(product, updatedBooking.BookingHeaderSid, payload.updatedBy),
                                        BookingCargoSid: savedCargo.BookingCargoSid
                                    }
                                });
                            }

                            touchedProductSidSet.add(savedProduct.BookingProductSid);
                            finalBookingProducts.push(savedProduct);
                        }
                    }

                    const cargoIdsToDelete = existingCargos
                        .filter((cargo) => !touchedCargoSidSet.has(cargo.BookingCargoSid))
                        .map((cargo) => cargo.BookingCargoSid);

                    if (cargoIdsToDelete.length > 0) {
                        await prisma.bookingProduct.deleteMany({
                            where: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                BookingCargoSid: { in: cargoIdsToDelete }
                            }
                        });
                        await prisma.bookingCargo.deleteMany({
                            where: {
                                BookingCargoSid: { in: cargoIdsToDelete }
                            }
                        });
                    }

                    const productIdsToDelete = existingProducts
                        .filter((product) => !touchedProductSidSet.has(product.BookingProductSid))
                        .map((product) => product.BookingProductSid)
                        .filter((productSid) => !Number.isNaN(productSid));

                    if (productIdsToDelete.length > 0) {
                        await prisma.bookingProduct.deleteMany({
                            where: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                BookingProductSid: { in: productIdsToDelete }
                            }
                        });
                    }
                } else {
                    const existingProducts = await prisma.bookingProduct.findMany({
                        where: { BookingHeaderSid: updatedBooking.BookingHeaderSid }
                    });
                    const touchedProductSidSet = new Set<number>();

                    const productsToCreate = payload.bookingProducts || [];
                    for (const product of productsToCreate) {
                        const productSid = product?.BookingProductSid ? Number(product.BookingProductSid) : null;
                        let savedProduct;

                        if (productSid) {
                            const existingProduct = existingProducts.find((item) => item.BookingProductSid === productSid);
                            if (existingProduct) {
                                savedProduct = await prisma.bookingProduct.update({
                                    where: { BookingProductSid: productSid },
                                    data: this.buildBookingProductUpdateData(product, updatedBooking.BookingHeaderSid, payload.updatedBy)
                                });
                            } else {
                                savedProduct = await prisma.bookingProduct.create({
                                    data: this.buildBookingProductData(product, updatedBooking.BookingHeaderSid, payload.updatedBy)
                                });
                            }
                        } else {
                            savedProduct = await prisma.bookingProduct.create({
                                data: this.buildBookingProductData(product, updatedBooking.BookingHeaderSid, payload.updatedBy)
                            });
                        }

                        touchedProductSidSet.add(savedProduct.BookingProductSid);
                        finalBookingProducts.push(savedProduct);
                    }

                    const productIdsToDelete = existingProducts
                        .filter((product) => !touchedProductSidSet.has(product.BookingProductSid))
                        .map((product) => product.BookingProductSid)
                        .filter((productSid) => !Number.isNaN(productSid));

                    if (productIdsToDelete.length > 0) {
                        await prisma.bookingProduct.deleteMany({
                            where: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                BookingProductSid: { in: productIdsToDelete }
                            }
                        });
                    }
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
                            OriginAgent: otherPayload.OriginAgent || '',
                            OriginAgentAddress: otherPayload.OriginAgentAddress || '',
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
                            OriginAgent: otherPayload.OriginAgent || '',
                            OriginAgentAddress: otherPayload.OriginAgentAddress || '',
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
 * |--------------------------------------------------
 * |   Step 4.5 : Update Booking CRO
 * |--------------------------------------------------
 */
                let finalBookingCro;
                const croPayload = payload.bookingCro ?? {};

                if (!croPayload?.BookingCroSid) {
                    finalBookingCro = await prisma.bookingCro.create({
                        data: {
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            BookingHeaderSid: updatedBooking.BookingHeaderSid,
                            CreatedBy: payload.updatedBy,
                            OnHireRef: croPayload.OnHireRef || null,
                            ReleaseOrderDate: croPayload.ReleaseOrderDate || null,
                            ValidityDate: croPayload.ValidityDate || null,
                            ContainerReleaseDate: croPayload.ContainerReleaseDate || null,
                            EmptySurveyDate: croPayload.EmptySurveyDate || null,
                            Transporter: croPayload.Transporter || null,
                            EmptyYard: croPayload.EmptyYard || null,
                            NoteToYard: croPayload.NoteToYard || null,
                            NoteToShipper: croPayload.NoteToShipper || null
                        }
                    })
                } else {
                    finalBookingCro = await prisma.bookingCro.update({
                        where: { BookingCroSid: croPayload.BookingCroSid },
                        data: {
                            OnHireRef: croPayload.OnHireRef || null,
                            ReleaseOrderDate: croPayload.ReleaseOrderDate || null,
                            ValidityDate: croPayload.ValidityDate || null,
                            ContainerReleaseDate: croPayload.ContainerReleaseDate || null,
                            EmptySurveyDate: croPayload.EmptySurveyDate || null,
                            Transporter: croPayload.Transporter || null,
                            EmptyYard: croPayload.EmptyYard || null,
                            NoteToYard: croPayload.NoteToYard || null,
                            NoteToShipper: croPayload.NoteToShipper || null,
                            UpdatedBy: payload.updatedBy,
                            UpdatedOn: new Date()
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
                            where: { BookingConnectionSid: connection.BookingConnectionSid },
                            data: {
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
                let itemIndex = 1;
                for (const rate of payload.bookingRates) {
                    let createdBookingRate;
                    let updatedBookingRate;
                    if (!rate.RateSid) {
                        // CREATE
                        createdBookingRate = await prisma.bookingRates.create({
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                BranchMasterSid: payload.BranchMasterSid,
                                CreatedBy: payload.updatedBy,

                                SerialNumber: itemIndex++ || null,
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeDescription: rate.ChargeDescription,

                                ChargeUomSid: rate.ChargeUomSid || null,
                                RevenueChargeUomSid: rate.RevenueChargeUomSid || null,
                                CostChargeUomSid: rate.CostChargeUomSid || null,

                                NoOfUnit: Number(rate.NoOfUnit) || null,
                                RevenueNumberOfUnit: Number(rate.RevenueNumberOfUnit) || Number(rate.NoOfUnit) || null, // This field has Decimal(4,3) - not used for main quantity
                                CostNumberOfUnit: Number(rate.CostNumberOfUnit) || Number(rate.NoOfUnit) || null, // This field has Decimal(4,3) - not used for main quantity


                                // Revenue Section
                                RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid || null,
                                RevenueExchangeRate: rate.RevenueExchangeRate ? Number(rate.RevenueExchangeRate) : null,
                                RevenueRate: rate.RevenueRate ? Number(rate.RevenueRate) : null,
                                RevenueAmount: Number(rate.RevenueAmount || 0),
                                RevenueLocalAmount: Number(rate.RevenueLocalAmount || 0),
                                RevenueDrCr: rate.RevenueDrCr || 'C',
                                CustomerMasterSid: rate.RevenueCustomerMasterSid,
                                CustomerBranchSid: rate.RevenueCustomerBranchSid,
                                RevenuePrepaidCollect: rate.RevenuePrepaidCollect || 'Prepaid',

                                // Cost Section
                                CostCurrencyMasterSid: rate.CostCurrencyMasterSid || null,
                                CostExchangeRate: rate.CostExchangeRate ? Number(rate.CostExchangeRate) : null,
                                CostRate: rate.CostRate ? Number(rate.CostRate) : null,
                                CostAmount: Number(rate.CostAmount || 0),
                                CostLocalAmount: Number(rate.CostLocalAmount || 0),
                                CostDrCr: rate.CostDrCr || 'D',
                                AgentMasterSid: rate.CostAgentMasterSid || null,
                                AgentBranchSid: rate.CostAgentBranchSid || null,
                                CostPrepaidCollect: rate.CostPrepaidCollect || 'Prepaid',


                                // PrepaidCollect: rate.PrepaidCollect || null,
                                QuoteChargeSid: rate.QuoteChargeSid || null,
                                TariffDetailSid: rate.TariffDetailSid || null,
                                Remarks: rate.Remarks || null,
                                Status: 'A'
                            }
                        });
                    } else {
                        // UPDATE
                        updatedBookingRate = await prisma.bookingRates.update({
                            where: { BookingRatesSid: rate.RateSid },
                            data: {
                                BookingHeaderSid: updatedBooking.BookingHeaderSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                BranchMasterSid: payload.BranchMasterSid,
                                UpdatedBy: payload.updatedBy,
                                UpdatedOn: new Date(),

                                SerialNumber: itemIndex++ || null,
                                ChargeMasterSid: rate.ChargeMasterSid,
                                ChargeDescription: rate.ChargeDescription,

                                ChargeUomSid: rate.ChargeUomSid || null,
                                RevenueChargeUomSid: rate.RevenueChargeUomSid || null,
                                CostChargeUomSid: rate.CostChargeUomSid || null,

                                NoOfUnit: Number(rate.NoOfUnit) || null,
                                RevenueNumberOfUnit: Number(rate.RevenueNumberOfUnit) || null, // This field has Decimal(4,3) - not used for main quantity
                                CostNumberOfUnit: Number(rate.CostNumberOfUnit) || null, // This field has Decimal(4,3) - not used for main quantity


                                // Revenue Section
                                RevenueCurrencyMasterSid: rate.RevenueCurrencyMasterSid || null,
                                RevenueExchangeRate: rate.RevenueExchangeRate ? Number(rate.RevenueExchangeRate) : null,
                                RevenueRate: rate.RevenueRate ? Number(rate.RevenueRate) : null,
                                RevenueAmount: Number(rate.RevenueAmount || 0),
                                RevenueLocalAmount: Number(rate.RevenueLocalAmount || 0),
                                RevenueDrCr: rate.RevenueDrCr || 'C',
                                CustomerMasterSid: rate.RevenueCustomerMasterSid,
                                CustomerBranchSid: rate.RevenueCustomerBranchSid,
                                RevenuePrepaidCollect: rate.RevenuePrepaidCollect || 'Prepaid',
                                RevenueVoucherHeaderSid: rate.RevenueVoucherHeaderSid || null,
                                RevenueVoucherTypeMasterSid: rate.RevenueVoucherTypeSid || null,

                                // Cost Section
                                CostCurrencyMasterSid: rate.CostCurrencyMasterSid || null,
                                CostExchangeRate: rate.CostExchangeRate ? Number(rate.CostExchangeRate) : null,
                                CostRate: rate.CostRate ? Number(rate.CostRate) : null,
                                CostAmount: Number(rate.CostAmount || 0),
                                CostLocalAmount: Number(rate.CostLocalAmount || 0),
                                CostDrCr: rate.CostDrCr || 'D',
                                AgentMasterSid: rate.CostAgentMasterSid || null,
                                AgentBranchSid: rate.CostAgentBranchSid || null,
                                CostPrepaidCollect: rate.CostPrepaidCollect || 'Prepaid',
                                CostVoucherHeaderSid: rate.CostVoucherHeaderSid || null,
                                PaymentRequestSid: rate.PaymentRequestSid || null,
                                CostVoucherTypeMasterSid: rate.CostVoucherTypeSid || null,


                                // PrepaidCollect: rate.PrepaidCollect || null,
                                QuoteChargeSid: rate.QuoteChargeSid || null,
                                TariffDetailSid: rate.TariffDetailSid || null,
                                Remarks: rate.Remarks || null,
                                Status: 'A'
                            }
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

                const finalBookingMilestones = !updatedBooking.ShipmentNo
                    ? []
                    : await saveShipmentMilestones(prisma, payload.milestones, {
                        ShipmentNo: updatedBooking.ShipmentNo,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        BookingHeaderSid: updatedBooking.BookingHeaderSid,
                        actorEmail: payload.updatedBy,
                    });

                return {
                    updatedBooking,
                    finalBookingCargos,
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

    async deleteBooking(BookingHeaderSid: number, updatedBy: string) {
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
                    data: { status: 'D', updatedBy: updatedBy, updatedOn: new Date() }
                })

                const deletedCargos = await prisma.bookingCargo.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D', updatedBy: updatedBy, updatedOn: new Date() }
                })
                const deletedProducts = await prisma.bookingProduct.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D', updatedBy: updatedBy, updatedOn: new Date() }
                })
                const deletedOthers = await prisma.bookingOthers.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D', updatedBy: updatedBy, updatedOn: new Date() }
                })
                const deletedCro = await prisma.bookingCro.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: {
                        UpdatedBy: updatedBy,
                        UpdatedOn: new Date()

                    }
                })

                const deletedConnections = await prisma.bookingConnection.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { status: 'D', updatedBy: updatedBy, updatedOn: new Date() }
                })
                const deletedRates = await prisma.bookingRates.updateMany({
                    where: { BookingHeaderSid: BookingHeaderSid },
                    data: { Status: 'D', UpdatedBy: updatedBy, UpdatedOn: new Date() }
                })

                return {
                    deletedBooking,
                    deletedCargos,
                    deletedProducts,
                    deletedOthers,
                    deletedCro,
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
        const dateFromRaw = (params as any).dateFrom ?? (params as any).DateFrom;
        const dateToRaw = (params as any).dateTo ?? (params as any).DateTo;
        const dateFieldRaw = (params as any).dateField ?? (params as any).DateField ?? 'BookingDateTime';
        const allowedDateFields = new Set(['BookingDateTime', 'MBLDate', 'ETD', 'ETA', 'HBLDate']);
        const dateField = allowedDateFields.has(dateFieldRaw) ? dateFieldRaw : 'BookingDateTime';
        const customerMasterSid = (params as any).CustomerMasterSid ?? (params as any).customerMasterSid ?? null;
        const departmentMasterSid = (params as any).DepartmentMasterSid ?? (params as any).departmentMasterSid ?? null;
        const pol = (params as any).POL ?? (params as any).pol ?? null;
        const pod = (params as any).POD ?? (params as any).pod ?? null;
        const dateRange: Prisma.DateTimeFilter = {};
        if (dateFromRaw) {
            const parsedFrom = new Date(dateFromRaw);
            if (!Number.isNaN(parsedFrom.getTime())) {
                dateRange.gte = parsedFrom;
            }
        }
        if (dateToRaw) {
            const parsedTo = new Date(dateToRaw);
            if (!Number.isNaN(parsedTo.getTime())) {
                dateRange.lte = parsedTo;
            }
        }

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


            const ports = await this._db.portMaster.findMany({
                where: {
                    PortCode: { contains: search, mode: 'insensitive' },
                    PortName: { contains: search, mode: 'insensitive' },
                    status: 'A'
                },
                select: {
                    PortCode: true,
                }
            });

            const portWithSearchOnlyIds = ports.map(p => p.PortCode);
        }

        const where: Prisma.BookingHeaderWhereInput = {
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
            status: statusWhereClause,
            ...(customerMasterSid ? { CustomerMasterSid: Number(customerMasterSid) } : {}),
            ...(departmentMasterSid ? { DepartmentMasterSid: Number(departmentMasterSid) } : {}),
            ...(pol ? { POL: String(pol) } : {}),
            ...(pod ? { POD: String(pod) } : {}),
            ...(Object.keys(dateRange).length ? { [dateField]: dateRange } : {}),
            ...(search && {
                OR: [

                    { BookingNo: { contains: search, mode: 'insensitive' } },
                    { departmentMaster: { departmentName: { contains: search, mode: 'insensitive' } } },
                    { CustomerName: { contains: search, mode: 'insensitive' } },
                    { POL: { contains: search, mode: 'insensitive' } },
                    { POD: { contains: search, mode: 'insensitive' } },
                    { FPD: { contains: search, mode: 'insensitive' } },
                    { VesselName: { contains: search, mode: 'insensitive' } },
                    { VoyageNo: { contains: search, mode: 'insensitive' } },
                    { houseJob: { masterJob: { MasterJobNumber: { contains: search, mode: 'insensitive' } } } },
                    ...(salesmanIds.length ? [{ SalesmanSid: { in: salesmanIds } }] : []),
                    { BookingStatus: { contains: search, mode: 'insensitive' } },
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
                orderBy: [
                    { BookingDateTime: 'desc' },
                    { BookingHeaderSid: 'desc' }
                ],
                include: {
                    departmentMaster: {
                        select: {
                            DepartmentMasterSid: true,
                            departmentName: true,
                            departmentType: true
                        }
                    },
                    houseJob: {
                        include: {
                            masterJob: {
                                select: {
                                    MasterJobSid: true,
                                    MasterJobNumber: true
                                }
                            }
                        },
                        where: {
                            status: 'A'
                        }
                    }
                }
            }),
            this._db.bookingHeader.count({ where }),
        ]);

        /**
            * Taking DepartmentName using globalConfig Service 
         */
        items = await Promise.all(
            items.map(async (item) => {
                const [salesman] = await Promise.all([

                    item.SalesmanSid !== null ?
                        this.globalConfigService.getMasterData('user_master', item.SalesmanSid) :
                        { UserMasterSid: null, userName: '' },
                ])
                return {
                    ...item,
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

    async softDeleteBookingProduct(BookingProductSid: number, updatedBy: string) {
        try {
            const deletedBookingProducts = await this._db.bookingProduct.update({
                where: { BookingProductSid },
                data: { status: 'D', updatedBy: updatedBy, updatedOn: new Date() }
            })
            return deletedBookingProducts;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteBookingConnection(BookingConnectionSid: number, updatedBy: string) {
        try {
            const deletedBookingConnection = await this._db.bookingConnection.update({
                where: { BookingConnectionSid: BookingConnectionSid },
                data: { status: 'D', updatedBy: updatedBy, updatedOn: new Date() }
            })
            return deletedBookingConnection;
        } catch (error) {
            throw error;
        }
    }

    async softDeleteBookingRates(BookingRateSid: number, updatedBy: string) {
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
                data: { Status: 'D', UpdatedBy: updatedBy, UpdatedOn: new Date() }
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
                            CustomerAddress2: true,
                            PanType: true,
                            countryMaster: {
                                select: {
                                    CountryMasterSid: true,
                                    countryName: true,
                                    countryCode: true
                                }
                            }
                        }
                    },
                    customerBranch: {
                        select: {
                            CustomerBranchSid: true,
                            Address: true,
                            StateMasterSid: true,
                            CityMasterSid: true,
                            Zip_PostBox: true,
                            GSTNo: true,
                            Registered: true,
                            CustomerGstType: true,
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
                        select: { StateMasterSid: true, stateName: true, IsUnionTerritory: true }
                    });
                    const city = await this._db.cityMaster.findUnique({
                        where: { CityMasterSid: rate.customerBranch.CityMasterSid },
                        select: { cityName: true }
                    });
                    enrichments.customerBranch = {
                        ...rate.customerBranch,
                        stateMaster: state,
                        cityMaster: city
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
                                where: {
                                    Status: 'A'
                                },
                                select: {
                                    ChargeTaxMasterSid: true,
                                    hssacMaster: {
                                        select: {
                                            HSSACMasterSid: true,
                                            HSSACCode: true,
                                            TaxRate: true,
                                            TaxType: true,
                                            TaxGroupSid: true,
                                        }
                                    }
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
                            CustomerAddress2: true,
                            PanType: true,
                            CountryMasterSid: true,
                            countryMaster: {
                                select: {
                                    countryName: true,
                                    countryCode: true
                                }
                            }
                        },


                    });
                    enrichments.AgentMaster = agent;
                }
                if (rate.AgentBranchSid) {
                    const agentBranch = await this._db.customerBranch.findUnique({
                        where: { CustomerBranchSid: rate.AgentBranchSid },
                        select: {
                            CustomerBranchSid: true,
                            Address: true,
                            StateMasterSid: true,
                            CityMasterSid: true,
                            Zip_PostBox: true,
                            GSTNo: true,
                            Registered: true,
                            CustomerGstType: true,
                            stateMaster: {
                                select: {
                                    StateMasterSid: true,
                                    stateName: true,
                                    IsUnionTerritory: true,
                                }
                            }
                        }
                    });
                    enrichments.AgentBranch = agentBranch;
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
                        PanType: true,
                        countryMaster: {
                            where: {
                                status: 'A'
                            },
                            select: {
                                CountryMasterSid: true,
                                countryName: true,
                                countryCode: true
                            }
                        },
                        CustomerBranch: {
                            where: {
                                status: 'A'
                            },
                            select: {
                                CustomerBranchSid: true,
                                BranchName: true,
                                Address: true,
                                Email: true,
                                GSTNo: true,
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
                    Email: branch.Email,
                    GSTNo: branch.GSTNo,
                    PanType: customer.PanType,
                    CountryMasterSid: customer.countryMaster,

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

            return { customers: formattedCustomerList, salesmans: processedSalesmans, shippers, consignees, agents: processedAgents, carriers, forwarder, notify, yards: yard, cfs };
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
                yard: [],
                cFS: [],
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
                    where: { status: 'A' },
                    select: {
                        ProductMasterSId: true,
                        ProductName: true,
                        ProductCode: true,
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
                        UOMCode: true
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

    async getAllMilestones(payload: any) {
        try {
            const allMilestones = await this._db.milestoneMaster.findMany({
                where: {
                    status: 'A',
                    // MilestoneMaster is company-level (not differentiated by branch)
                    CompanyMasterSid: payload.CompanyMasterSid
                },
                select: {
                    MilestoneMasterSid: true,
                    MilestoneName: true,
                    MilestoneCode: true,
                    AutoCapture: true,
                    SortBy: true,
                    IsCustomerSpecific: true,
                    DepartmentMasterSid: true,
                    Remarks: true
                }
            })

            // Department-wise filtering of the milestone dropdown. A milestone master stores its
            // allowed department(s) on DepartmentMasterSid (the master entry saves department NAMES
            // via a multi-select). When the caller supplies the current job's department, only
            // milestones configured for that department are returned. With no department supplied
            // the full company/branch list is returned (backward compatible). Filtering is done in
            // the service (not a Prisma where) so it is independent of the DepartmentMasterSid
            // column shape — array, JSON string, CSV, or a single value are all handled.
            const filterTokens = this.buildDepartmentFilterTokens(payload);
            const filtered = filterTokens.length
                ? allMilestones.filter((milestone) =>
                    this.extractDepartmentTokens(milestone.DepartmentMasterSid).some((dept) =>
                        filterTokens.includes(dept)
                    )
                )
                : allMilestones;

            // Order the dropdown by the configured SortBy. SortBy is stored as text, so sort
            // NUMERICALLY (else "10" would sort before "5"); unset values go last.
            return filtered.sort((a, b) => {
                const sa = Number(a.SortBy);
                const sb = Number(b.SortBy);
                const na = Number.isFinite(sa) ? sa : Number.MAX_SAFE_INTEGER;
                const nb = Number.isFinite(sb) ? sb : Number.MAX_SAFE_INTEGER;
                return na - nb;
            });
        } catch (error) {
            throw error;
        }
    }

    /** Department tokens the caller wants to filter by (name and/or SID), lowercased. */
    private buildDepartmentFilterTokens(payload: any): string[] {
        const tokens: string[] = [];
        const push = (value: any) => {
            if (value === null || value === undefined) return;
            const normalized = String(value).trim().toLowerCase();
            if (normalized) tokens.push(normalized);
        };
        const collect = (value: any) => {
            if (Array.isArray(value)) value.forEach(push);
            else push(value);
        };
        collect(payload?.DepartmentName);
        collect(payload?.DepartmentMasterSid);
        return [...new Set(tokens)];
    }

    /** Normalize a milestone's DepartmentMasterSid (array / JSON string / CSV / single value) into lowercase tokens. */
    private extractDepartmentTokens(raw: any): string[] {
        if (raw === null || raw === undefined) return [];
        let list: any[] = [];
        if (Array.isArray(raw)) {
            list = raw;
        } else if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (trimmed.startsWith('[')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    list = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                    list = trimmed.split(',');
                }
            } else {
                list = trimmed.split(',');
            }
        } else {
            list = [raw];
        }
        return list.map((value) => String(value).trim().toLowerCase()).filter((value) => value !== '');
    }

    async getShipmentMilestoneByShipmentNo(payload: any) {
        try {
            // Common fetch: keyed by HouseJobSid / BookingHeaderSid / ShipmentNo (OR),
            // scoped by Company + Branch + Status='A' + deletedAt=NULL, ordered by master SortBy.
            // Booking screen passes BookingHeaderSid; House/Service screens pass HouseJobSid.
            // ShipmentNo remains a fallback for legacy rows and callers that only send it.
            return await getShipmentMilestones(this._db, {
                HouseJobSid: payload.HouseJobSid,
                BookingHeaderSid: payload.BookingHeaderSid,
                ShipmentNo: payload.ShipmentNo,
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
            });
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
                    where: { Status: 'A' },
                    select: {
                        VoucherHeaderSid: true,
                        VoucherNumber: true
                    }
                })

            ]);
            return { charges, uoms, docTypes, Vouchers }
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





    async getTariffByBookingDetails(payload: TariffBookingPayload) {
        try {
            // ---------- 1️⃣  First Priority Search: Dynamic WHERE clause with all optional filters ----------
            const whereWithOptionalFilters: any = {
                EffectiveDate: { lte: new Date(payload.EffectiveDate) },
                ExpiredOn: { gte: new Date(payload.ExpiredDate) },
                status: 'A',
                tariffHeader: {
                    DepartmentMasterSid: payload.DepartmentMasterSid,
                    POLSid: payload.POLSid,
                    PODSid: payload.PODSid,
                    CompanyMasterSid: payload.CompanyMasterSid,
                    status: 'A'
                },
            };

            // Track if we have optional filters
            let hasOptionalFilters = false;

            // optional filters – add only if provided in payload
            if (payload.PORSid) {
                whereWithOptionalFilters.tariffHeader.POOSid = payload.PORSid;
                hasOptionalFilters = true;
            } else {
                whereWithOptionalFilters.tariffHeader.POOSid = null;
                hasOptionalFilters = true;
            }

            if (payload.FPODSid) {
                whereWithOptionalFilters.tariffHeader.FDCSid = payload.FPODSid;
                hasOptionalFilters = true;
            } else {
                whereWithOptionalFilters.tariffHeader.FDCSid = null;
                hasOptionalFilters = true;
            }

            if (payload.Carrier) {
                whereWithOptionalFilters.tariffHeader.Carrier = payload.Carrier;
                hasOptionalFilters = true;
            } else {
                whereWithOptionalFilters.tariffHeader.Carrier = null;
                hasOptionalFilters = true;
            }
            if (payload.AgentSid) {
                whereWithOptionalFilters.tariffHeader.AgentSid = payload.AgentSid;
                hasOptionalFilters = true;
            } else {
                whereWithOptionalFilters.tariffHeader.AgentSid = null;
                hasOptionalFilters = true;
            }

            if (payload.IncoTerms) {
                whereWithOptionalFilters.tariffHeader.IncoTerms = payload.IncoTerms;
                hasOptionalFilters = true;
            } else {
                whereWithOptionalFilters.tariffHeader.IncoTerms = null;
                hasOptionalFilters = true;
            }

            if (payload.CargoType) {
                whereWithOptionalFilters.CargoType = payload.CargoType;
                hasOptionalFilters = true;
            }

            if (payload.ContainerType) {
                whereWithOptionalFilters.OR = [
                    { ContainerType: payload.ContainerType },
                    { ContainerType: null }
                ]
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
                    status: 'A',
                    CargoType: payload.CargoType,
                    EffectiveDate: { lte: new Date(payload.EffectiveDate) },
                    ExpiredOn: { gte: new Date(payload.ExpiredDate) },
                    tariffHeader: {
                        status: 'A',
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        POLSid: payload.POLSid,
                        PODSid: payload.PODSid,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        POOSid: null,
                        FDCSid: null,
                        Carrier: null,
                        AgentSid: null,
                        IncoTerms: null,
                    }
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
                            : (await this.currencyExchangeService.getExchangeRate({
                                CompanyMasterSid: payload.CompanyMasterSid || detail.CompanyMasterSid!,
                                BranchMasterSid: payload.BranchMasterSid,
                                fromCurrencyCode: costFromCurrency.currencyCode,
                                toCurrencyCode: toCurrency.currencyCode,
                                EffectiveFrom: new Date(payload.EffectiveDate),
                                segment: 'cost'
                            }) || 1))
                        : null;

                    const revenueExchangeRate = toCurrency
                        ? (revenueFromCurrency.currencyCode === toCurrency.currencyCode
                            ? 1
                            : (await this.currencyExchangeService.getExchangeRate({
                                CompanyMasterSid: payload.CompanyMasterSid || detail.CompanyMasterSid!,
                                BranchMasterSid: payload.BranchMasterSid,
                                fromCurrencyCode: costFromCurrency.currencyCode,
                                toCurrencyCode: toCurrency.currencyCode,
                                EffectiveFrom: new Date(payload.EffectiveDate),
                                segment: 'revenue'
                            }) || 1))
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

    async getBookingARAPData(BookingHeaderSid: number) {
        try {
            const arapData = await this._db.voucherHeader.findMany({
                where: {
                    BookingHeaderSid: BookingHeaderSid,
                    Status: 'A'
                },
                select: {
                    CompanyMasterSid: true,
                    BookingHeaderSid: true,
                    VoucherHeaderSid: true,
                    VoucherNumber: true,
                    VoucherDate: true,
                    HouseNumber: true,
                    MasterNumber: true,
                    CurrencyCode: true,
                    Amount: true,
                    LocalAmount: true,
                    PostStatus: true,
                    voucherTypeMaster: {
                        select: {
                            DocumentTypeCode: true
                        }
                    }
                },
                orderBy: {
                    VoucherDate: 'desc'
                }
            });

            return arapData.map((item: any) => ({
                CompanyMasterSid: item.CompanyMasterSid,
                BookingHeaderSid: item.BookingHeaderSid,
                VoucherHeaderSid: item.VoucherHeaderSid,
                VoucherNumber: item.VoucherNumber,
                VoucherDate: item.VoucherDate,
                HBLNo: item.HouseNumber || '-',
                MBLNo: item.MasterNumber || '-',
                DocumentTypeCode: item.voucherTypeMaster?.DocumentTypeCode || '',
                CurrencyCode: item.CurrencyCode,
                Amount: Number(item.Amount) || 0,
                LocalAmount: Number(item.LocalAmount) || 0,
                PostStatus: item.PostStatus || 'U'
            }));
        } catch (error) {
            this.logger.error(`Error fetching AR/AP data: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch AR/AP data');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // generateBookingTemplate
    // ─────────────────────────────────────────────────────────────────────────────
    async generateBookingTemplate(companyMasterSid: number): Promise<Buffer> {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();

        // ── Fetch lookup data ─────────────────────────────────────────────────────
        const [
            departments, ports, carriers, agents, customers,
            containerTypes, packageTypes, incoTerms, currencies, imcos, uoms, salesPersons,
        ] = await Promise.all([
            this._db.departmentMaster.findMany({
                where: { CompanyMasterSid: companyMasterSid, Status: 'A' },
                select: {
                    DepartmentMasterSid: true,
                    departmentName: true,
                    departmentType: true,
                    ExportImport: true,
                    FCLLCL: true,
                },
            }),
            this._db.portMaster.findMany({
                where: { status: 'A' },
                select: { PortMasterSid: true, PortCode: true, PortName: true },
                orderBy: { PortCode: 'asc' },
            }),
            this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    status: 'A',
                    CustomerType: { path: ['carrier'], equals: 'isTrue' },
                    CustomerBranch: { some: {} },
                },
                select: { CustomerMasterSid: true, CustomerName: true },
                orderBy: { CustomerName: 'asc' },
            }),
            this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    status: 'A',
                    CustomerType: { path: ['agent'], equals: 'isTrue' },
                    CustomerBranch: { some: {} },
                },
                select: { CustomerMasterSid: true, CustomerName: true },
                orderBy: { CustomerName: 'asc' },
            }),
            this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    status: 'A',
                    CustomerType: { path: ['customer'], equals: 'isTrue' },
                    CustomerBranch: { some: {} },
                },
                select: { CustomerMasterSid: true, CustomerName: true },
                orderBy: { CustomerName: 'asc' },
            }),
            this._db.containerTypeMaster.findMany({
                where: { status: 'A' },
                select: { ContainerTypeMasterSid: true, ContainerName: true },
            }),
            this._db.uOMMaster.findMany({
                where: { UOMType: 'P', status: 'A' },
                select: { UOMMasterSid: true, UOMName: true },
            }),
            this._db.incoMaster.findMany({
                where: { Status: 'A' },
                select: { IncoMasterSid: true, IncoCode: true },
                orderBy: { IncoCode: 'asc' },
            }),
            this._db.currencyMaster.findMany({
                select: { CurrencyMasterSid: true, currencyCode: true },
            }),
            this._db.imcoMaster.findMany({
                where: { status: 'A' },
                select: { ImcoMasterSid: true, ImcoName: true },
            }),
            this._db.uOMMaster.findMany({
                where: { status: 'A' },
                select: { UOMMasterSid: true, UOMName: true },
            }),
            this._db.userMaster.findMany({
                where: {
                    userCompanyMaster: {
                        some: {
                            CompanyMasterSid: companyMasterSid,
                            GiveAccess: 'Y',
                            status: 'A',
                        },
                    },
                    isSalesperson: '1',
                    status: 'A',
                },
                select: { UserMasterSid: true, userName: true },
                orderBy: { userName: 'asc' },
            }),
        ]);

        const portOptions = ports.map((p: any) => `${p.PortCode} - ${p.PortName}`);

        // ── Helpers ───────────────────────────────────────────────────────────────
        const styleHeaderRow = (row: any, mandatoryCount: number) => {
            row.height = 22;
            row.eachCell((cell: any, colNo: number) => {
                const isMandatory = colNo <= mandatoryCount;
                cell.font = {
                    bold: true,
                    color: { argb: isMandatory ? 'FFCC0000' : 'FF6B6B00' },
                    size: 10,
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isMandatory ? 'FFFFE5E5' : 'FFFFFBE6' },
                };
                cell.border = {
                    bottom: { style: 'medium', color: { argb: 'FFAAAAAA' } },
                    top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
                    left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
                    right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
                };
                cell.alignment = { vertical: 'middle', wrapText: false };
            });
        };

        const markMandatoryCols = (sheet: any, colNumbers: number[]) => {
            colNumbers.forEach(colNo => {
                const cell = sheet.getRow(1).getCell(colNo);
                cell.font = { bold: true, color: { argb: 'FFCC0000' }, size: 10 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5E5' } };
                cell.border = {
                    bottom: { style: 'medium', color: { argb: 'FFAAAAAA' } },
                    top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
                    left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
                    right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
                };
                cell.alignment = { vertical: 'middle', wrapText: false };
            });
        };

        const styleExampleRow = (sheet: any, rowNum: number) => {
            sheet.getRow(rowNum).eachCell((cell: any) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2FB' } };
                cell.font = { italic: true, color: { argb: 'FF555577' }, size: 9 };
            });
        };

        const applyDV = (
            sheet: any,
            col: string,
            formulae: string,
            startRow: number,
            endRow = 5000,
        ) => {
            for (let r = startRow; r <= endRow; r++) {
                sheet.getCell(`${col}${r}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [formulae],
                    showErrorMessage: true,
                    errorTitle: 'Invalid value',
                    error: 'Select from the dropdown list',
                };
            }
        };

        const applyDateDV = (sheet: any, col: string, startRow: number, endRow = 5000) => {
            for (let r = startRow; r <= endRow; r++) {
                sheet.getCell(`${col}${r}`).dataValidation = {
                    type: 'date',
                    operator: 'between',
                    allowBlank: true,
                    formulae: [new Date(2000, 0, 1), new Date(2099, 11, 31)],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Date',
                    error: 'Use YYYY-MM-DD format',
                };
            }
        };

        const addRefSheet = (name: string, values: string[]) => {
            const ws = workbook.addWorksheet(name);
            values.forEach((v: string) => ws.addRow([v]));
            ws.state = 'veryHidden';
            return ws;
        };

        const dvRef = (sheet: string, count: number) =>
            count > 0 ? `'${sheet}'!$A$1:$A$${count}` : `'${sheet}'!$A$1`;

        // ── Reference sheets ──────────────────────────────────────────────────────
        addRefSheet('_Departments', departments.map((d: any) => d.departmentName));
        addRefSheet('_Ports', portOptions);
        addRefSheet('_Carriers', carriers.map((c: any) => c.CustomerName));
        addRefSheet('_Agents', agents.map((a: any) => a.CustomerName));
        addRefSheet('_Customers', customers.map((c: any) => c.CustomerName));
        addRefSheet('_ContainerTypes', containerTypes.map((c: any) => c.ContainerName));
        addRefSheet('_PackageTypes', packageTypes.map((p: any) => p.UOMName));
        addRefSheet('_IncoTerms', incoTerms.map((i: any) => i.IncoCode));
        addRefSheet('_Currencies', currencies.map((c: any) => c.currencyCode));
        addRefSheet('_IMCO', imcos.map((i: any) => i.ImcoName));
        addRefSheet('_SalesPersons', salesPersons.map((s: any) => s.userName));
        addRefSheet('_FreightTerms', ['Prepaid', 'Collect']);
        addRefSheet('_CargoType', ['General', 'Haz', 'Reefer', 'Tanker', 'OOG']);
        addRefSheet('_YesNo', ['Y', 'N']);
        addRefSheet('_BookingStatus', ['Booked', 'Cargo Received', 'Stuffed']);
        addRefSheet('_MovementType', ['CY-CFS', 'CFS-FO', 'CFS-CY', 'CFS-CFS', 'FO-FI', 'Door-Door', 'CY-Door', 'CY-FO']);
        addRefSheet('_ShipmentTerms', ['FCL/FCL', 'FCL/LCL', 'LCL/FCL', 'LCL/LCL', 'LTL', 'FTL', 'FTL HH']);
        addRefSheet('_UOM', ['M', 'CM', 'Inch']);
        addRefSheet('_ReleaseType', ['Original', 'Sea Way BL', 'Express', 'Draft']);
        addRefSheet('_ModeOfTransport', ['Sea', 'Air', 'Road', 'Rail', 'Courier']);

        const deptCount = departments.length;
        const portCount = portOptions.length;
        const carrierCount = carriers.length;
        const agentCount = agents.length;
        const customerCount = customers.length;
        const ctCount = containerTypes.length;
        const pkgCount = packageTypes.length;
        const incoCount = incoTerms.length;
        const currCount = currencies.length;
        const imcoCount = imcos.length;
        const spCount = salesPersons.length;

        // ══════════════════════════════════════════════════════
        // SHEET 1 — Booking (header)
        // ══════════════════════════════════════════════════════
        const bkSheet = workbook.addWorksheet('Booking');

        const bkHeaders = [
            'TempBookingRef',               // A - mandatory
            'BookingDate (YYYY-MM-DD)',     // B - mandatory
            'DepartmentName',               // C - mandatory
            'CustomerName',                 // D - mandatory
            'CustomerAddress',              // E - mandatory
            'ShipperName',                  // F
            'ShipperAddress',               // G
            'ConsigneeName',                // H
            'ConsigneeAddress',             // I
            'NotifyName',                   // J
            'NotifyAddress',                // K
            'DestinationAgent',             // L
            'AgentAddress',                 // M
            'CarrierName',                  // N
            'SalesPerson',                  // O
            'IncoTerms',                    // P - mandatory
            'POO (PortCode)',               // Q
            'POL (PortCode)',               // R - mandatory
            'POD (PortCode)',               // S - mandatory
            'FPOD (PortCode)',              // T
            'VesselName',                   // U
            'VoyageNo',                     // V
            'ETD (YYYY-MM-DD)',             // W
            'ETA (YYYY-MM-DD)',             // X
            'Coload (Y/N)',                 // Y
        ];

        bkSheet.addRow(bkHeaders);
        styleHeaderRow(bkSheet.getRow(1), 5);
        markMandatoryCols(bkSheet, [16, 18, 19]);

        bkSheet.addRow([
            'BKN-001',
            '2024-01-15',
            departments[0]?.departmentName || 'FCL Export',
            customers[0]?.CustomerName || 'ABC Exports Ltd',
            'Customer Address Line 1',
            'Shipper Co.',
            '456 Shipper St, Mumbai',
            'Consignee Co.',
            '789 Consignee Ave, LA',
            'Same as Consignee',
            '789 Consignee Ave, LA',
            agents[0]?.CustomerName || 'US Agent LLC',
            'Agent Address Line 1',
            carriers[0]?.CustomerName || 'MSC',
            salesPersons[0]?.userName || '',
            incoTerms[0]?.IncoCode || 'CIF',
            '',
            'INNSA - Nhava Sheva',
            'USLAX - Los Angeles',
            '',
            'MSC ANNA',
            'V001E',
            '2024-01-20',
            '2024-02-10',
            'N',
        ]);
        styleExampleRow(bkSheet, 2);

        [16, 18, 22, 24, 28, 24, 28, 24, 28, 22, 24, 24, 28, 22, 20, 14, 18, 20, 20, 18, 22, 14, 18, 18, 12]
            .forEach((w: number, i: number) => { bkSheet.getColumn(i + 1).width = w; });

        const bkStart = 3;
        applyDateDV(bkSheet, 'B', bkStart);
        applyDV(bkSheet, 'C', dvRef('_Departments', deptCount), bkStart);
        applyDV(bkSheet, 'D', dvRef('_Customers', customerCount), bkStart);
        applyDV(bkSheet, 'L', dvRef('_Agents', agentCount), bkStart);
        applyDV(bkSheet, 'N', dvRef('_Carriers', carrierCount), bkStart);
        applyDV(bkSheet, 'O', dvRef('_SalesPersons', spCount), bkStart);
        applyDV(bkSheet, 'P', dvRef('_IncoTerms', incoCount), bkStart);
        applyDV(bkSheet, 'Q', dvRef('_Ports', portCount), bkStart);
        applyDV(bkSheet, 'R', dvRef('_Ports', portCount), bkStart);
        applyDV(bkSheet, 'S', dvRef('_Ports', portCount), bkStart);
        applyDV(bkSheet, 'T', dvRef('_Ports', portCount), bkStart);
        applyDV(bkSheet, 'Y', dvRef('_YesNo', 2), bkStart);
        applyDateDV(bkSheet, 'W', bkStart);
        applyDateDV(bkSheet, 'X', bkStart);

        // ══════════════════════════════════════════════════════
        // SHEET 2 — BookingCargo
        // ══════════════════════════════════════════════════════
        // Column layout (8 columns A–H):
        // A  TempBookingRef (Link)   - mandatory
        // B  CargoType               - mandatory
        // C  ContainerType           (FCL only; leave blank for LCL/Air)
        // D  NoofContainers          (Sea only — FCL & LCL; leave blank for Air)
        // E  MovementType
        // F  ModeOfTransport
        // G  StuffingAt
        // H  ShipmentTerms
        //
        // NOTE: GrossWeight, NetWeight, Volume, Volumetric, ChargeableWeight, and
        //       NoOfPackage are NOT entered by the user — computed server-side from
        //       the linked product rows (NoOfPackage = sum of product NoofPackage).
        const cgSheet = workbook.addWorksheet('BookingCargo');

        const cgHeaders = [
            'TempBookingRef (Link)',    // A - mandatory
            'CargoType',               // B - mandatory
            'ContainerType',           // C (FCL only — leave blank for LCL/Air)
            'NoofContainers',          // D (Sea only — FCL & LCL; leave blank for Air)
            'MovementType',            // E
            'ModeOfTransport',         // F
            'StuffingAt',              // G
            'ShipmentTerms',           // H
        ];

        cgSheet.addRow(cgHeaders);
        styleHeaderRow(cgSheet.getRow(1), 2);

        cgSheet.addRow([
            'BKN-001',
            'General',
            containerTypes[0]?.ContainerName || '20FT',
            1,
            'CY-CFS',
            'Sea',
            'Dock',
            'FCL/FCL',
        ]);
        styleExampleRow(cgSheet, 2);

        [18, 14, 18, 14, 18, 18, 14, 16]
            .forEach((w: number, i: number) => { cgSheet.getColumn(i + 1).width = w; });

        const cgStart = 3;
        applyDV(cgSheet, 'B', dvRef('_CargoType', 5), cgStart);
        applyDV(cgSheet, 'C', dvRef('_ContainerTypes', ctCount), cgStart);
        applyDV(cgSheet, 'E', dvRef('_MovementType', 8), cgStart);
        applyDV(cgSheet, 'F', dvRef('_ModeOfTransport', 5), cgStart);
        applyDV(cgSheet, 'G', `"Dock,Factory"`, cgStart);
        applyDV(cgSheet, 'H', dvRef('_ShipmentTerms', 7), cgStart);

        // ══════════════════════════════════════════════════════
        // SHEET 3 — BookingProduct
        // ══════════════════════════════════════════════════════
        // Column layout (20 columns A–T):
        // A  TempBookingRef (Link)           - mandatory
        // B  CargoIndex (1,2,3...)           - mandatory
        // C  Commodity                       - mandatory
        // D  ShippingBillNo
        // E  ShippingBillDate (YYYY-MM-DD)
        // F  ExternalPkg                     - mandatory
        // G  NoofPackage (No of Pkg)         - mandatory
        // H  UOM (M / CM / Inch)
        // I  Length
        // J  Width
        // K  Height
        // L  Volumetric (auto-calc)
        // M  CBM / Volume (auto-calc)
        // N  GrossWeight                     - mandatory
        // O  NetWeight
        // P  CargoRecDate (YYYY-MM-DD)
        // Q  IsHaz (Y/N)
        // R  ImcoClass
        // S  UnNo
        // T  PkgGroup
        const prSheet = workbook.addWorksheet('BookingProduct');

        const prHeaders = [
            'TempBookingRef (Link)',         // A - mandatory
            'CargoIndex (1,2,3...)',         // B - mandatory
            'Commodity',                    // C - mandatory
            'ShippingBillNo',               // D
            'ShippingBillDate (YYYY-MM-DD)',// E
            'ExternalPkg',                  // F - mandatory
            'NoofPackage (No of Pkg)',       // G - mandatory
            'UOM',                          // H (M / CM / Inch)
            'Length',                       // I
            'Width',                        // J
            'Height',                       // K
            'Volumetric (auto-calc)',        // L
            'CBM / Volume (auto-calc)',      // M
            'GrossWeight',                  // N - mandatory
            'NetWeight',                    // O
            'CargoRecDate (YYYY-MM-DD)',    // P
            'IsHaz (Y/N)',                  // Q
            'ImcoClass',                    // R
            'UnNo',                         // S
            'PkgGroup',                     // T
        ];

        prSheet.addRow(prHeaders);
        // A–C mandatory (cols 1–3), F–G mandatory (cols 6–7), N mandatory (col 14)
        styleHeaderRow(prSheet.getRow(1), 3);          // A–C red
        markMandatoryCols(prSheet, [6, 7, 14]);        // F, G, N also red

        // Mark Volumetric (col 12) and CBM (col 13) as auto-calculated gold
        [12, 13].forEach(colNo => {
            const cell = prSheet.getRow(1).getCell(colNo);
            cell.font = { bold: true, color: { argb: 'FF6B4E00' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9E0' } };
            cell.border = {
                bottom: { style: 'medium', color: { argb: 'FFAAAAAA' } },
                top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
                left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
                right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
            };
            cell.alignment = { vertical: 'middle', wrapText: false };
        });

        prSheet.addRow([
            'BKN-001', 1,                          // A TempBookingRef, B CargoIndex
            'Electronic Components',               // C Commodity
            'SB-001', '',                          // D ShippingBillNo, E ShippingBillDate
            'CTN', 10,                             // F ExternalPkg, G NoofPackage
            'CM', 60, 40, 30, '', '',              // H UOM, I-K dims, L-M auto
            500, 480,                              // N GrossWeight, O NetWeight
            '', 'N', '', '', '',                   // P CargoRecDate, Q-T haz fields
        ]);
        styleExampleRow(prSheet, 2);

        [18, 14, 28, 16, 22, 16, 16, 10, 10, 10, 10, 18, 18, 14, 12, 22, 12, 18, 14, 14]
            .forEach((w: number, i: number) => { prSheet.getColumn(i + 1).width = w; });

        const prStart = 3;
        applyDV(prSheet, 'F', dvRef('_PackageTypes', pkgCount), prStart);  // ExternalPkg
        applyDV(prSheet, 'H', `"M,CM,Inch"`, prStart);                     // UOM
        applyDateDV(prSheet, 'E', prStart);                                  // ShippingBillDate
        applyDateDV(prSheet, 'P', prStart);                                  // CargoRecDate
        applyDV(prSheet, 'Q', dvRef('_YesNo', 2), prStart);                // IsHaz
        applyDV(prSheet, 'R', dvRef('_IMCO', imcoCount), prStart);         // ImcoClass

        // ── Auto-calculated formulas for Volumetric (L) and CBM / Volume (M) ─────
        //
        // These match the frontend VolumetricAndCbmCalculationService exactly:
        //
        //  CBM (M):
        //    UOM=M    → qty * L * W * H
        //    UOM=CM   → qty * L * W * H / 1,000,000
        //    UOM=Inch → qty * (L*0.0254) * (W*0.0254) * (H*0.0254)
        //
        //  Volumetric (L) — uses SAME cm³ intermediate:
        //    convert all to cm first:
        //      M    → dim * 100
        //      Inch → dim * 2.54
        //      CM   → dim (no change)
        //    then: qty * cmL * cmW * cmH / divisor
        //      LCL divisor = 5000   (lclVolumetricDivisor)
        //      AIR divisor = 6000   (airVolumetricDivisor)
        //    Because the template cannot know the shipment type per row, we use the
        //    LCL divisor (5000) as the default.  The server re-calculates with the
        //    correct divisor on import.
        //
        // Col references for row r:
        //   G = NoofPackage (qty)
        //   H = UOM
        //   I = Length
        //   J = Width
        //   K = Height
        for (let r = prStart; r <= 5000; r++) {
            // ── CBM formula (col M) ──────────────────────────────────────────────────
            prSheet.getCell(`M${r}`).value = {
                formula:
                    `=IF(AND(I${r}>0,J${r}>0,K${r}>0,G${r}>0),` +
                    `ROUND(IF(H${r}="M",   G${r}*I${r}*J${r}*K${r},` +
                    `IF(H${r}="Inch",G${r}*(I${r}*0.0254)*(J${r}*0.0254)*(K${r}*0.0254),` +
                    `G${r}*I${r}*J${r}*K${r}/1000000)),3),"")`
            };

            // ── Volumetric formula (col L) — LCL divisor 5000 ───────────────────────
            // cmL/cmW/cmH: M→*100, Inch→*2.54, CM→unchanged
            prSheet.getCell(`L${r}`).value = {
                formula:
                    `=IF(AND(I${r}>0,J${r}>0,K${r}>0,G${r}>0),` +
                    `ROUND(` +
                    `G${r}*` +
                    `IF(H${r}="M",I${r}*100,IF(H${r}="Inch",I${r}*2.54,I${r}))*` +
                    `IF(H${r}="M",J${r}*100,IF(H${r}="Inch",J${r}*2.54,J${r}))*` +
                    `IF(H${r}="M",K${r}*100,IF(H${r}="Inch",K${r}*2.54,K${r}))/5000` +
                    `,3),"")`
            };

            ['L', 'M'].forEach(col => {
                const cell = prSheet.getCell(`${col}${r}`);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
                cell.font = { color: { argb: 'FF6B4E00' }, size: 9 };
                cell.numFmt = '0.000';
            });
        }

        // ══════════════════════════════════════════════════════
        // SHEET 4 — BookingOthers
        // ══════════════════════════════════════════════════════
        const otSheet = workbook.addWorksheet('BookingOthers');

        const otHeaders = [
            'TempBookingRef (Link)',             // A - mandatory
            'CustomerRefNo',                    // B
            'YardCFS',                          // C
            'ReleaseType',                      // D
            'Forwarder',                        // E
            'ForwarderAddress',                 // F
            'Notify2',                          // G
            'NotifyAddress2',                   // H
            'Coloader',                         // I
            'PickupPlace',                      // J
            'PickupAddress',                    // K
            'DeliveryPlace',                    // L
            'DeliveryDate (YYYY-MM-DD)',        // M
            'DeliveryAddress',                  // N
            'CargoCurrency',                   // O
            'CargoValue',                       // P
            'CarrierBookingRef',                // Q
            'CarrierBookingDate (YYYY-MM-DD)', // R
            'SwitchBL (Y/N)',                  // S
            'BacktoBack (Y/N)',                // T
            'CHAName',                          // U
            'ExternalRemarks',                  // V
        ];

        otSheet.addRow(otHeaders);
        styleHeaderRow(otSheet.getRow(1), 1);

        otSheet.addRow([
            'BKN-001',
            'CREF-001', '', 'Original',
            '', '', '', '', '', '', '', '', '', '',
            'USD', '', '', '', 'N', 'N', '', '',
        ]);
        styleExampleRow(otSheet, 2);

        [18, 18, 22, 14, 24, 28, 22, 24, 24, 22, 22, 22, 22, 22, 14, 14, 22, 22, 12, 12, 22, 28]
            .forEach((w: number, i: number) => { otSheet.getColumn(i + 1).width = w; });

        const otStart = 3;
        applyDV(otSheet, 'D', dvRef('_ReleaseType', 4), otStart);
        applyDV(otSheet, 'E', dvRef('_Agents', agentCount), otStart);
        applyDV(otSheet, 'O', dvRef('_Currencies', currCount), otStart);
        applyDV(otSheet, 'S', dvRef('_YesNo', 2), otStart);
        applyDV(otSheet, 'T', dvRef('_YesNo', 2), otStart);
        applyDateDV(otSheet, 'M', otStart);
        applyDateDV(otSheet, 'R', otStart);

        // ══════════════════════════════════════════════════════
        // INSTRUCTIONS SHEET
        // ══════════════════════════════════════════════════════
        const inst = workbook.addWorksheet('Instructions');
        const instRows = [
            ['Booking Bulk Upload Template — Instructions'],
            [],
            ['SHEET OVERVIEW'],
            ['  Booking         — One row per booking. TempBookingRef (col A) is your own short unique ID (e.g. BKN-001).'],
            ['                    Columns: TempBookingRef, BookingDate, DepartmentName, CustomerName, CustomerAddress,'],
            ['                    ShipperName, ShipperAddress, ConsigneeName, ConsigneeAddress, NotifyName, NotifyAddress,'],
            ['                    DestinationAgent, AgentAddress, CarrierName, SalesPerson, IncoTerms,'],
            ['                    POO, POL, POD, FPOD, VesselName, VoyageNo, ETD, ETA, Coload.'],
            ['  BookingCargo    — Cargo rows. Col A (TempBookingRef) must match a value in Booking col A.'],
            ['                    Columns: TempBookingRef, CargoType, ContainerType, NoofContainers,'],
            ['                    MovementType, ModeOfTransport, StuffingAt, ShipmentTerms.'],
            ['                    GrossWeight/NetWeight/Volume/Volumetric/ChargeableWeight/NoOfPackage are'],
            ['                    computed automatically from the linked product rows — do not enter them here.'],
            ['                    NoOfPackage = sum of NoofPackage across all linked BookingProduct rows.'],
            ['  BookingProduct  — Product rows. Col A (TempBookingRef) + Col B (CargoIndex) link to the parent cargo row.'],
            ['                    Columns (in order): TempBookingRef, CargoIndex, Commodity, ShippingBillNo,'],
            ['                    ShippingBillDate, ExternalPkg, NoofPackage, UOM, Length, Width, Height,'],
            ['                    Volumetric (auto), CBM/Volume (auto), GrossWeight, NetWeight, CargoRecDate,'],
            ['                    IsHaz, ImcoClass, UnNo, PkgGroup.'],
            ['  BookingOthers   — One row per booking. Col A (TempBookingRef) must match Booking col A.'],
            [],
            ['TEMPBOOKINGREF — THE LINK KEY'],
            ['  • TempBookingRef is a file-scoped reference you create (e.g. BKN-001, BKN-002).'],
            ['  • It must be unique within the Booking sheet.'],
            ['  • Use the SAME TempBookingRef in BookingCargo, BookingProduct, and BookingOthers col A to link rows.'],
            ['  • The real BookingNo is auto-generated by the system on import. TempBookingRef is discarded after save.'],
            [],
            ['HOW TO USE'],
            ['  1. Fill the Booking sheet. Give each row a unique TempBookingRef (col A) and a BookingDate (col B).'],
            ['  2. In BookingCargo, set col A = TempBookingRef of the parent booking row.'],
            ['  3. In BookingProduct, set col A = TempBookingRef and col B = CargoIndex (1, 2, 3...) of the cargo row.'],
            ['  4. In BookingOthers, set col A = TempBookingRef of the parent booking row (one row per booking).'],
            ['  5. Example rows (row 2) are for reference and will be ignored during import.'],
            ['  6. Dropdowns are provided for validated fields — do not type values outside the list.'],
            ['  7. Red column header = mandatory. Yellow = optional. Gold = auto-calculated (Volumetric / CBM).'],
            ['  8. Date columns accept YYYY-MM-DD format only.'],
            [],
            ['PRODUCT COLUMN ORDER (BookingProduct sheet)'],
            ['  A  TempBookingRef (Link)      — mandatory'],
            ['  B  CargoIndex (1,2,3...)      — mandatory; links product to its cargo row'],
            ['  C  Commodity                  — mandatory'],
            ['  D  ShippingBillNo'],
            ['  E  ShippingBillDate'],
            ['  F  ExternalPkg                — mandatory; select from dropdown'],
            ['  G  NoofPackage (No of Pkg)    — mandatory; number of packages for this product line'],
            ['  H  UOM                        — M / CM / Inch (default CM)'],
            ['  I  Length'],
            ['  J  Width'],
            ['  K  Height'],
            ['  L  Volumetric                 — auto-calculated (LCL divisor 5000; re-calculated server-side)'],
            ['  M  CBM / Volume               — auto-calculated'],
            ['  N  GrossWeight                — mandatory'],
            ['  O  NetWeight'],
            ['  P  CargoRecDate'],
            ['  Q  IsHaz (Y/N)'],
            ['  R  ImcoClass'],
            ['  S  UnNo'],
            ['  T  PkgGroup'],
            [],
            ['CARGO AGGREGATION RULES'],
            ['  • NoOfPackage on a cargo row = SUM of NoofPackage across all linked BookingProduct rows.'],
            ['  • GrossWeight, NetWeight, Volume (CBM), Volumetric = SUM of respective product fields.'],
            ['  • ChargeableWeight = MAX(GrossWeight, Volumetric) for the cargo.'],
            ['  • These fields are NOT entered in BookingCargo — they are computed on import.'],
            [],
            ['CBM / VOLUMETRIC CALCULATION RULES'],
            ['  CBM  (col M):'],
            ['    UOM = M    → Qty × L × W × H'],
            ['    UOM = CM   → Qty × L × W × H ÷ 1,000,000'],
            ['    UOM = Inch → Qty × (L×0.0254) × (W×0.0254) × (H×0.0254)'],
            ['  Volumetric (col L) — intermediate in cm³, then divide by divisor:'],
            ['    Convert dims to cm: M→×100, Inch→×2.54, CM unchanged'],
            ['    Volumetric = Qty × cmL × cmW × cmH ÷ divisor'],
            ['    Divisor: LCL = 5000 | AIR = 6000 (server re-calculates with correct divisor on import).'],
            [],
            ['DEPARTMENT & JOBTYPE RULES'],
            ['  • The JobType (Export/Import) is automatically derived from the selected DepartmentName.'],
            [],
            ['CARGO FIELD RULES'],
            ['  • ContainerType: required for FCL departments only. Leave blank for LCL and Air.'],
            ['  • NoofContainers: required for Sea departments (FCL and LCL). Leave blank for Air.'],
            [],
            ['INCOTERMS & FREIGHT TERMS'],
            ['  • FreightTerms is auto-patched from the selected IncoTerms OceanFreight value on import.'],
            [],
            ['VALIDATION RULES'],
            ['  • TempBookingRef must be unique within the Booking sheet.'],
            ['  • TempBookingRef in child sheets must match an existing row in the Booking sheet.'],
            ['  • POL and POD cannot be the same port.'],
            ['  • CustomerName, Department, IncoTerms, and port codes must match existing master data.'],
            ['  • SalesPerson must match an active salesperson for this company.'],
            ['  • IsHaz = Y requires ImcoClass to be filled.'],
            ['  • GrossWeight must be >= NetWeight.'],
        ];
        instRows.forEach((r: any) => inst.addRow(r));
        inst.getRow(1).font = { bold: true, size: 13 };
        inst.getColumn(1).width = 110;

        workbook.views = [{ activeTab: 0 }];

        const buf = await workbook.xlsx.writeBuffer();
        return Buffer.from(buf);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // parseBookingExcel
    // ─────────────────────────────────────────────────────────────────────────────
    async parseBookingExcel(
        buffer: Buffer,
        companyMasterSid: number,
        branchMasterSid: number,
    ): Promise<{
        validRows: any[];
        invalidRows: any[];
        warnings: string[];
        summary: { total: number; valid: number; invalid: number };
    }> {
        const XLSX = require('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

        // ── Sheet readers ─────────────────────────────────────────────────────────
        const getRows = (exactName: string, skipRows: number): any[][] => {
            const name = wb.SheetNames.find((n: string) =>
                n.toLowerCase() === exactName.toLowerCase(),
            );
            if (!name) return [];
            const all: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
                header: 1,
                defval: null,
                raw: false,
            });
            all.splice(0, skipRows);
            return all.filter((r: any[]) => r.some((cell: any) => cell !== null && cell !== ''));
        };

        const bkRows = getRows('Booking', 2);
        const cgRows = getRows('BookingCargo', 2);
        const prRows = getRows('BookingProduct', 2);
        const otRows = getRows('BookingOthers', 2);

        // ── Fetch lookup data ─────────────────────────────────────────────────────
        const [
            departments, ports, carriers, agents, customers,
            containerTypes, packageTypes, incoTerms, currencies, imcos, salesPersons,
        ] = await Promise.all([
            this._db.departmentMaster.findMany({
                where: { CompanyMasterSid: companyMasterSid, Status: 'A' },
                select: {
                    DepartmentMasterSid: true,
                    departmentName: true,
                    departmentType: true,
                    ExportImport: true,
                    FCLLCL: true,
                },
            }),
            this._db.portMaster.findMany({
                where: { status: 'A' },
                select: { PortMasterSid: true, PortCode: true, PortName: true },
            }),
            this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    status: 'A',
                    CustomerType: { path: ['carrier'], equals: 'isTrue' },
                    CustomerBranch: { some: {} },
                },
                select: { CustomerMasterSid: true, CustomerName: true },
            }),
            this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    status: 'A',
                    CustomerType: { path: ['agent'], equals: 'isTrue' },
                    CustomerBranch: { some: {} },
                },
                select: { CustomerMasterSid: true, CustomerName: true },
            }),
            this._db.customerMaster.findMany({
                where: {
                    CompanyMasterSid: companyMasterSid,
                    status: 'A',
                    CustomerType: { path: ['customer'], equals: 'isTrue' },
                    CustomerBranch: { some: {} },
                },
                select: { CustomerMasterSid: true, CustomerName: true },
            }),
            this._db.containerTypeMaster.findMany({
                where: { status: 'A' },
                select: { ContainerTypeMasterSid: true, ContainerName: true },
            }),
            this._db.uOMMaster.findMany({
                where: { UOMType: 'P', status: 'A' },
                select: { UOMMasterSid: true, UOMName: true },
            }),
            this._db.incoMaster.findMany({
                where: { Status: 'A' },
                select: { IncoMasterSid: true, IncoCode: true, OceanFreight: true },
            }),
            this._db.currencyMaster.findMany({
                select: { CurrencyMasterSid: true, currencyCode: true },
            }),
            this._db.imcoMaster.findMany({
                where: { status: 'A' },
                select: { ImcoMasterSid: true, ImcoName: true },
            }),
            this._db.userMaster.findMany({
                where: {
                    userCompanyMaster: {
                        some: {
                            CompanyMasterSid: companyMasterSid,
                            GiveAccess: 'Y',
                            status: 'A',
                        },
                    },
                    isSalesperson: '1',
                    status: 'A',
                },
                select: { UserMasterSid: true, userName: true },
            }),
        ]);

        // ── Lookup maps ───────────────────────────────────────────────────────────
        const deptMap = new Map(departments.map((d: any) => [d.departmentName.trim().toLowerCase(), d]));
        const portByCode = new Map(ports.map((p: any) => [p.PortCode.trim().toLowerCase(), p]));
        const portByLabel = new Map(
            ports.map((p: any) => [
                `${p.PortCode.trim().toLowerCase()} - ${p.PortName.trim().toLowerCase()}`,
                p,
            ]),
        );
        const carrierMap = new Map(carriers.map((c: any) => [c.CustomerName.trim().toLowerCase(), c.CustomerMasterSid]));
        const agentMap = new Map(agents.map((a: any) => [a.CustomerName.trim().toLowerCase(), a.CustomerMasterSid]));
        const customerMap = new Map(customers.map((c: any) => [c.CustomerName.trim().toLowerCase(), c]));
        const ctMap = new Map(containerTypes.map((c: any) => [c.ContainerName.trim().toLowerCase(), c.ContainerTypeMasterSid]));
        const pkgMap = new Map(packageTypes.map((p: any) => [p.UOMName.trim().toLowerCase(), p.UOMName]));
        const incoMap = new Map(
            incoTerms.map((i: any) => [
                i.IncoCode.trim().toLowerCase(),
                { sid: i.IncoMasterSid, freightTerms: i.OceanFreight ?? '' },
            ]),
        );
        const imcoMap = new Map(imcos.map((i: any) => [i.ImcoName.trim().toLowerCase(), i.ImcoName]));
        const salesPersonMap = new Map(salesPersons.map((s: any) => [s.userName.trim().toLowerCase(), s.UserMasterSid]));

        // ── Utility helpers ───────────────────────────────────────────────────────
        const resolvePort = (val: any): any | null => {
            if (!val) return null;
            const raw = String(val).trim().toLowerCase();
            return portByLabel.get(raw) || portByCode.get(raw.split(' ')[0]) || null;
        };

        const formatLocalDate = (date: Date): string | null => {
            if (!date || isNaN(date.getTime())) return null;
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const parseDate = (val: any): string | null => {
            if (!val) return null;
            // Already a Date object (cellDates: true)
            if (val instanceof Date) return formatLocalDate(val);
            const s = String(val).trim();
            // Already YYYY-MM-DD text
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
            // Excel serial number stored as plain string e.g. "46171"
            if (/^\d+$/.test(s)) {
                const excelEpoch = new Date(1899, 11, 30);
                const d = new Date(excelEpoch.getTime() + parseInt(s) * 86400000);
                return formatLocalDate(d);
            }
            // Fallback: try native Date parse (handles "5/29/2026", "29-May-2026", etc.)
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : formatLocalDate(d);
        };

        const str = (v: any) => (v === null || v === undefined ? '' : String(v).trim());
        const num = (v: any) =>
            v === null || v === undefined || v === '' ? null : parseFloat(String(v));

        // ── Dimension / volumetric helpers ────────────────────────────────────────
        const uomStringToSid = (uomRaw: string): number => {
            const u = uomRaw.trim().toUpperCase();
            if (u === 'M') return 1;
            if (u === 'INCH') return 3;
            return 2;
        };

        const toCBM = (qty: number, l: number, w: number, h: number, uomSid: number): number => {
            switch (uomSid) {
                case 1: return qty * l * w * h;
                case 3: return qty * (l * 0.0254) * (w * 0.0254) * (h * 0.0254);
                default: return qty * l * w * h / 1_000_000;
            }
        };

        const toVolumetric = (
            qty: number, l: number, w: number, h: number,
            uomSid: number,
            shipmentType: 'LCL' | 'AIR' = 'LCL',
        ): number => {
            let cmL: number, cmW: number, cmH: number;
            switch (uomSid) {
                case 1: cmL = l * 100; cmW = w * 100; cmH = h * 100; break;
                case 3: cmL = l * 2.54; cmW = w * 2.54; cmH = h * 2.54; break;
                default: cmL = l; cmW = w; cmH = h;
            }
            const divisor = shipmentType === 'AIR' ? 6000 : 5000;
            return (qty * cmL * cmW * cmH) / divisor;
        };

        // ── Group child rows by TempBookingRef ────────────────────────────────────
        const groupByTempRef = (rows: any[][], colIdx = 0) => {
            const map = new Map<string, any[][]>();
            rows.forEach((r: any[]) => {
                const key = str(r[colIdx]).toLowerCase();
                if (!key) return;
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(r);
            });
            return map;
        };

        const cargoByRef = groupByTempRef(cgRows, 0);
        const productByRef = groupByTempRef(prRows, 0);
        const othersByRef = groupByTempRef(otRows, 0);

        const warnings: string[] = [];
        const seenTempRefs = new Set<string>();
        const validRows: any[] = [];
        const invalidRows: any[] = [];

        // ── Process each booking row ──────────────────────────────────────────────
        for (let i = 0; i < bkRows.length; i++) {
            const row = bkRows[i];
            const rowNum = i + 3;
            const errs: string[] = [];

            const tempBookingRef = str(row[0]);
            const bookingDate = parseDate(row[1]);
            const deptName = str(row[2]);
            const customerName = str(row[3]);
            const customerAddr = str(row[4]);
            const shipperName = str(row[5]);
            const shipperAddr = str(row[6]);
            const consigneeName = str(row[7]);
            const consigneeAddr = str(row[8]);
            const notify = str(row[9]);
            const notifyAddress = str(row[10]);
            const destAgentName = str(row[11]);
            const agentAddress = str(row[12]);
            const carrierName = str(row[13]);
            const salesPersonName = str(row[14]);
            const incoTermsVal = str(row[15]);
            const pooRaw = str(row[16]);
            const polRaw = str(row[17]);
            const podRaw = str(row[18]);
            const fpdRaw = str(row[19]);
            const vesselName = str(row[20]);
            const voyageNo = str(row[21]);
            const etd = parseDate(row[22]);
            const eta = parseDate(row[23]);
            const coload = str(row[24]).toUpperCase() === 'Y' ? 'Y' : 'N';

            if (!tempBookingRef) {
                errs.push('TempBookingRef (col A) is required — provide a unique label e.g. BKN-001');
            } else if (seenTempRefs.has(tempBookingRef.toLowerCase())) {
                errs.push(`Duplicate TempBookingRef "${tempBookingRef}" — each booking row must have a unique value`);
            } else {
                seenTempRefs.add(tempBookingRef.toLowerCase());
            }

            if (!bookingDate) errs.push('BookingDate is required (YYYY-MM-DD)');
            if (!deptName) errs.push('DepartmentName is required');
            if (!customerName) errs.push('CustomerName is required');
            if (!customerAddr) errs.push('CustomerAddress is required');
            if (!polRaw) errs.push('POL is required');
            if (!podRaw) errs.push('POD is required');
            if (!incoTermsVal) errs.push('IncoTerms is required');

            const dept = deptName ? deptMap.get(deptName.toLowerCase()) : null;
            if (deptName && !dept) errs.push(`Department "${deptName}" not found`);

            const customerObj = customerName ? customerMap.get(customerName.toLowerCase()) : null;
            if (customerName && !customerObj) errs.push(`Customer "${customerName}" not found`);

            const polPort = resolvePort(polRaw);
            const podPort = resolvePort(podRaw);
            const pooPort = resolvePort(pooRaw);
            const fpdPort = resolvePort(fpdRaw);

            if (polRaw && !polPort) errs.push(`POL port "${polRaw}" not found`);
            if (podRaw && !podPort) errs.push(`POD port "${podRaw}" not found`);

            if (polPort && podPort && polPort.PortCode === podPort.PortCode) {
                errs.push('POL and POD cannot be the same port');
            }

            const incoEntry = incoTermsVal ? incoMap.get(incoTermsVal.toLowerCase()) : null;
            if (incoTermsVal && !incoEntry) errs.push(`IncoTerms "${incoTermsVal}" not found`);

            const carrierId = carrierName ? carrierMap.get(carrierName.toLowerCase()) : null;
            if (carrierName && !carrierId) errs.push(`CarrierName "${carrierName}" not found`);

            const destAgentId = destAgentName ? agentMap.get(destAgentName.toLowerCase()) : null;
            if (destAgentName && !destAgentId) errs.push(`DestinationAgent "${destAgentName}" not found`);

            const salesPersonId = salesPersonName ? salesPersonMap.get(salesPersonName.toLowerCase()) : null;
            if (salesPersonName && !salesPersonId) errs.push(`SalesPerson "${salesPersonName}" not found`);

            const isFCL = dept && String(dept.FCLLCL || '').toUpperCase() === 'FCL';
            const isAir = dept && String(dept.departmentType || '').toUpperCase() === 'AIR';
            const isLCLOrAir = dept && (
                String(dept.FCLLCL || '').toUpperCase() === 'LCL' ||
                String(dept.departmentType || '').toUpperCase() === 'AIR'
            );
            const shipmentTypeForCalc: 'LCL' | 'AIR' =
                dept && String(dept.departmentType || '').toUpperCase() === 'AIR' ? 'AIR' : 'LCL';

            const jobType = dept?.ExportImport ?? '';
            const linkKey = tempBookingRef.toLowerCase();

            const cargoRowsRaw = cargoByRef.get(linkKey) || [];
            const productRowsRaw = productByRef.get(linkKey) || [];

            // ── Parse BookingCargo rows ───────────────────────────────────────────
            const cargoList: any[] = [];
            const cargoErrs: any[] = [];

            for (let ci = 0; ci < cargoRowsRaw.length; ci++) {
                const cRow = cargoRowsRaw[ci];
                const cErrs: string[] = [];

                const cargoType = str(cRow[1]) || 'General';
                const containerName = str(cRow[2]);
                const noofContainers = num(cRow[3]);
                const cMovementType = str(cRow[4]);
                const modeOfTransport = str(cRow[5]);
                const stuffingAt = str(cRow[6]) || 'Dock';
                const shipmentTerms = str(cRow[7]);

                const resolvedCtId = containerName ? ctMap.get(containerName.toLowerCase()) : null;
                if (isFCL) {
                    if (!containerName) {
                        cErrs.push(`Cargo ${ci + 1}: ContainerType is required for FCL`);
                    } else if (!resolvedCtId) {
                        cErrs.push(`Cargo ${ci + 1}: ContainerType "${containerName}" not found`);
                    }
                    if (!noofContainers || noofContainers <= 0) {
                        cErrs.push(`Cargo ${ci + 1}: NoofContainers must be > 0 for FCL`);
                    }
                } else if (isAir) {
                    // Air — ContainerType and NoofContainers not applicable
                } else {
                    if (noofContainers !== null && noofContainers !== undefined && noofContainers < 0) {
                        cErrs.push(`Cargo ${ci + 1}: NoofContainers cannot be negative`);
                    }
                }

                if (cErrs.length) {
                    cargoErrs.push({ cargoIndex: ci + 1, errors: cErrs });
                } else {
                    cargoList.push({
                        CargoType: cargoType,
                        ContainerType: (isFCL ? resolvedCtId : null) || null,
                        ContainerName: isFCL ? containerName : '',
                        NoofContainers: isAir ? 0 : (noofContainers || 0),
                        MovementType: cMovementType || null,
                        ModeOfTransport: modeOfTransport || null,
                        StuffingAt: stuffingAt,
                        ShipmentTerms: shipmentTerms || null,
                        GrossWeight: 0,
                        NetWeight: 0,
                        Volume: 0,
                        Volumetric: 0,
                        ChargeableWeight: 0,
                        NoOfPackage: 0,
                        _cargoIndex: ci + 1,
                        bookingProducts: [],
                    });
                }
            }

            // ── Parse BookingProduct rows ─────────────────────────────────────────
            const productErrs: any[] = [];

            for (const pRow of productRowsRaw) {
                const pErrs: string[] = [];

                const cargoIndexRaw = Math.max(1, Math.round(Number(pRow[1]) || 1));
                const commodity = str(pRow[2]);
                const shippingBillNo = str(pRow[3]);
                const shippingBillDate = parseDate(pRow[4]);
                const extPkgName = str(pRow[5]);
                const noofPackage = str(pRow[6]);
                const uomRaw = str(pRow[7]) || 'CM';
                const length = num(pRow[8]) || 0;
                const width = num(pRow[9]) || 0;
                const height = num(pRow[10]) || 0;
                const spreadVolumetric = num(pRow[11]) || 0;
                const spreadCBM = num(pRow[12]) || 0;
                const grossWeight = num(pRow[13]) || 0;
                const netWeight = num(pRow[14]) || 0;
                const cargoRecDate = parseDate(pRow[15]);
                const isHazRaw = str(pRow[16]).toUpperCase();
                const isHaz = isHazRaw === 'Y';
                const imcoRaw = str(pRow[17]);
                const unNo = str(pRow[18]);
                const pkgGroup = str(pRow[19]);

                if (!commodity) pErrs.push(`Product (CargoIndex ${cargoIndexRaw}): Commodity is required`);
                if (!noofPackage) pErrs.push(`Product (CargoIndex ${cargoIndexRaw}): NoofPackage is required`);
                if (!grossWeight) pErrs.push(`Product (CargoIndex ${cargoIndexRaw}): GrossWeight is required`);
                if (!extPkgName) pErrs.push(`Product (CargoIndex ${cargoIndexRaw}): ExternalPkg is required`);

                const extPkgCode = extPkgName ? pkgMap.get(extPkgName.toLowerCase()) : null;
                if (extPkgName && !extPkgCode) {
                    pErrs.push(`Product (CargoIndex ${cargoIndexRaw}): ExternalPkg "${extPkgName}" not found`);
                }

                if (grossWeight && netWeight && grossWeight < netWeight) {
                    pErrs.push(`Product (CargoIndex ${cargoIndexRaw}): GrossWeight cannot be less than NetWeight`);
                }

                if (isHaz && !imcoRaw) {
                    pErrs.push(`Product (CargoIndex ${cargoIndexRaw}): ImcoClass is required when IsHaz = Y`);
                }

                const resolvedImco = imcoRaw ? imcoMap.get(imcoRaw.toLowerCase()) : null;
                if (imcoRaw && !resolvedImco) {
                    pErrs.push(`Product (CargoIndex ${cargoIndexRaw}): ImcoClass "${imcoRaw}" not found`);
                }

                const uomSid = uomStringToSid(uomRaw);
                const qty = Number(noofPackage) || 0;

                // ── AFTER (fixed) ──
                const hasDimensions = length > 0 && width > 0 && height > 0 && qty > 0;

                const cbm = hasDimensions
                    ? parseFloat(toCBM(qty, length, width, height, uomSid).toFixed(3))
                    : spreadCBM;

                const volumetricCalc = hasDimensions
                    ? parseFloat(toVolumetric(qty, length, width, height, uomSid, shipmentTypeForCalc).toFixed(3))
                    : shipmentTypeForCalc === 'AIR' && spreadVolumetric > 0
                        // Excel used LCL divisor (5000); re-scale to AIR divisor (6000)
                        ? parseFloat((spreadVolumetric * 5000 / 6000).toFixed(3))
                        : spreadVolumetric;

                if (
                    isLCLOrAir &&
                    !cbm &&
                    !(length > 0 && width > 0 && height > 0 && qty > 0)
                ) {
                    pErrs.push(
                        `Product (CargoIndex ${cargoIndexRaw}): CBM/Volume is required for LCL/AIR (enter dimensions or a pre-calculated value)`,
                    );
                }

                if (pErrs.length) {
                    productErrs.push({ cargoIndex: cargoIndexRaw, errors: pErrs });
                } else {
                    const targetCargo = cargoList.find((c: any) => c._cargoIndex === cargoIndexRaw);
                    const productData = {
                        ProductName: commodity,
                        ExternaPkg: extPkgCode || null,
                        ExternlQty: String(qty),
                        GrossWeight: grossWeight,
                        NetWeight: netWeight,
                        Volume: cbm,
                        Volumetric: volumetricCalc,
                        Length: length,
                        Width: width,
                        Height: height,
                        UomRaw: uomRaw,
                        UomSid: uomSid,
                        ShippingBillNo: shippingBillNo,
                        ShippingBillDate: shippingBillDate,
                        CargoRecDate: cargoRecDate,
                        IsHaz: isHaz ? 'Y' : 'N',
                        ImcoClass: resolvedImco || null,
                        UnNo: unNo,
                        PkgGroup: pkgGroup,
                    };
                    if (targetCargo) {
                        targetCargo.bookingProducts.push(productData);
                    } else {
                        if (cargoList.length === 0) {
                            cargoList.push({
                                CargoType: 'General', ContainerType: null, NoofContainers: 0,
                                GrossWeight: 0, NetWeight: 0, Volume: 0, Volumetric: 0,
                                ChargeableWeight: 0, NoOfPackage: 0, ShipmentTerms: null,
                                MovementType: null, ModeOfTransport: null,
                                StuffingAt: 'Dock',
                                _cargoIndex: 1, bookingProducts: [],
                            });
                        }
                        cargoList[0].bookingProducts.push(productData);
                    }
                }
            }

            // ── Aggregate product totals into each cargo row ──────────────────────
            cargoList.forEach((cargo: any) => {
                if (cargo.bookingProducts.length > 0) {
                    const prods = cargo.bookingProducts;
                    const totalGW = parseFloat(prods.reduce((s: number, p: any) => s + (Number(p.GrossWeight) || 0), 0).toFixed(3));
                    const totalNW = parseFloat(prods.reduce((s: number, p: any) => s + (Number(p.NetWeight) || 0), 0).toFixed(3));
                    const totalVol = parseFloat(prods.reduce((s: number, p: any) => s + (Number(p.Volume) || 0), 0).toFixed(3));
                    const totalVom = parseFloat(prods.reduce((s: number, p: any) => s + (Number(p.Volumetric) || 0), 0).toFixed(3));
                    const totalPkg = prods.reduce((s: number, p: any) => s + (Number(p.ExternlQty) || 0), 0);

                    cargo.GrossWeight = totalGW;
                    cargo.NetWeight = totalNW;
                    cargo.Volume = totalVol;
                    cargo.Volumetric = totalVom;
                    cargo.NoOfPackage = totalPkg;
                    cargo.ChargeableWeight = parseFloat(Math.max(totalGW, totalVom).toFixed(3));
                }
            });

            // ── Parse BookingOthers row ───────────────────────────────────────────
            const othersRow = (othersByRef.get(linkKey) || [])[0];
            const otherData = othersRow
                ? {
                    CustomerRefNo: str(othersRow[1]),
                    YardCFS: str(othersRow[2]),
                    ReleaseType: str(othersRow[3]) || null,
                    Forwarder: str(othersRow[4]) || null,
                    ForwarderAddress: str(othersRow[5]),
                    Notify2: str(othersRow[6]) || null,
                    NotifyAddress2: str(othersRow[7]),
                    Coloader: str(othersRow[8]) || null,
                    PickupPlace: str(othersRow[9]),
                    PickupAddress: str(othersRow[10]),
                    DeliveryPlace: str(othersRow[11]),
                    DeliveryDate: parseDate(othersRow[12]),
                    DeliveryAddress: str(othersRow[13]),
                    CargoCurrency: str(othersRow[14]) || null,
                    CargoValue: num(othersRow[15]) || 0,
                    CarrierBookingRef: str(othersRow[16]),
                    CarrierBookingDate: parseDate(othersRow[17]),
                    SwitchBL: str(othersRow[18]).toUpperCase() === 'Y' ? 'Y' : 'N',
                    BacktoBack: str(othersRow[19]).toUpperCase() === 'Y' ? 'Y' : 'N',
                    CHAName: str(othersRow[20]),
                    ExternalRemarks: str(othersRow[21]),
                }
                : null;

            // ── Consolidate all errors ────────────────────────────────────────────
            const allErrors = [
                ...errs,
                ...cargoErrs.flatMap((e: any) =>
                    e.errors.map((m: string) => `Cargo ${e.cargoIndex}: ${m}`),
                ),
                ...productErrs.flatMap((e: any) => e.errors.map((m: string) => m)),
            ];

            const rowResult = {
                rowNum,
                tempBookingRef,
                DepartmentMasterSid: dept?.DepartmentMasterSid,
                DepartmentName: deptName,
                ExportImport: jobType,
                JobType: jobType,
                FCLLCL: dept?.FCLLCL ?? '',
                DepartmentType: dept?.departmentType ?? '',
                BookingDate: bookingDate,
                CustomerMasterSid: customerObj?.CustomerMasterSid || null,
                CustomerName: customerName,
                CustomerAddress: customerAddr,
                ShipperName: shipperName,
                ShipperAddress: shipperAddr,
                ConsigneeName: consigneeName,
                ConsigneeAddress: consigneeAddr,
                Notify: notify,
                NotifyAddress: notifyAddress,
                CarrierName: carrierName,
                CarrierSid: carrierId || null,
                VesselName: vesselName,
                VoyageNo: voyageNo,
                ETD: etd,
                ETA: eta,
                POO: pooPort?.PortCode || null,
                POL: polPort?.PortCode || null,
                POD: podPort?.PortCode || null,
                FPD: fpdPort?.PortCode || null,
                IncoTerms: incoTermsVal,
                FreightTerms: incoEntry?.freightTerms || null,
                MovementType: null,
                DestinationAgent: destAgentId || null,
                DestinationAgentName: destAgentName,
                AgentAddress: agentAddress,
                SalesPersonSid: salesPersonId || null,
                SalesPersonName: salesPersonName,
                InternalNote: '',
                GeneralNote: '',
                BookingStatus: 'Booked',
                NominatedBy: 'Self',
                Coload: coload,
                bookingCargo: cargoList,
                bookingOther: otherData,
            };

            if (allErrors.length) {
                invalidRows.push({ ...rowResult, errors: allErrors });
            } else {
                validRows.push(rowResult);
            }
        }

        // ── Orphan detection ──────────────────────────────────────────────────────
        for (const [key] of cargoByRef) {
            if (!seenTempRefs.has(key)) {
                warnings.push(
                    `BookingCargo has TempBookingRef "${key}" with no matching row in the Booking sheet — these cargo rows were ignored`,
                );
            }
        }
        for (const [key] of productByRef) {
            if (!seenTempRefs.has(key)) {
                warnings.push(
                    `BookingProduct has TempBookingRef "${key}" with no matching row in the Booking sheet — these product rows were ignored`,
                );
            }
        }
        for (const [key] of othersByRef) {
            if (!seenTempRefs.has(key)) {
                warnings.push(
                    `BookingOthers has TempBookingRef "${key}" with no matching row in the Booking sheet — this others row was ignored`,
                );
            }
        }

        return {
            validRows,
            invalidRows,
            warnings,
            summary: {
                total: validRows.length + invalidRows.length,
                valid: validRows.length,
                invalid: invalidRows.length,
            },
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // saveBookingExcel
    // ─────────────────────────────────────────────────────────────────────────────
    async saveBookingExcel(
        validRows: any[],
        companyMasterSid: number,
        branchMasterSid: number,
        menuMasterSid: number,
        createdBy: string,
    ): Promise<{ created: number; skipped: number; errors: any[] }> {
        let created = 0, skipped = 0;
        const errors: any[] = [];

        for (const row of validRows) {
            try {
                const bookingMenu = await this._db.menuMaster.findFirst({
                    where: { MenuCode: 'BKN', status: { in: ['A', 'S'] } },
                });
                const resolvedMenuId = menuMasterSid || bookingMenu?.MenuMasterSid;

                if (!resolvedMenuId) {
                    errors.push({ ref: row.tempBookingRef, message: 'Booking menu (BKN) not found — skipped' });
                    skipped++;
                    continue;
                }

                const bookingDate = row.BookingDate ? new Date(row.BookingDate) : new Date();

                const [polPort, podPort] = await Promise.all([
                    row.POL
                        ? this._db.portMaster.findFirst({
                            where: { PortCode: row.POL },
                            select: { PortMasterSid: true },
                        })
                        : null,
                    row.POD
                        ? this._db.portMaster.findFirst({
                            where: { PortCode: row.POD },
                            select: { PortMasterSid: true },
                        })
                        : null,
                ]);

                let BookingNo = await this.numberSeriesService.generateNextNumber(
                    companyMasterSid,
                    branchMasterSid,
                    resolvedMenuId,
                    row.DepartmentMasterSid ?? undefined,
                    bookingDate,
                    polPort?.PortMasterSid,
                    podPort?.PortMasterSid,
                );

                if (!BookingNo) {
                    const { format } = require('date-fns');
                    const ds = format(bookingDate, 'yyyyMMdd');
                    const cnt = await this._db.bookingHeader.count({
                        where: { BookingNo: { contains: ds } },
                    });
                    BookingNo = `booking-${ds}-${String(cnt + 1).padStart(3, '0')}`;
                }

                if (BookingNo && BookingNo.length > 50) {
                    BookingNo = BookingNo.substring(0, 50);
                }

                await this._db.$transaction(async (prisma: any) => {
                    // ── 1. BookingHeader ───────────────────────────────────────────────
                    const bookingHeader = await prisma.bookingHeader.create({
                        data: {
                            BookingNo,
                            ShipmentNo: BookingNo,
                            BookingDateTime: bookingDate,
                            CompanyMasterSid: companyMasterSid,
                            BranchMasterSid: branchMasterSid,
                            MenuMasterSid: resolvedMenuId,
                            DepartmentMasterSid: row.DepartmentMasterSid,
                            CustomerMasterSid: row.CustomerMasterSid || null,
                            CustomerName: row.CustomerName || '',
                            CustomerAddress: row.CustomerAddress || '',
                            ShipperName: row.ShipperName || '',
                            ShipperAddress: row.ShipperAddress || '',
                            ConsigneeName: row.ConsigneeName || '',
                            ConsigneeAddress: row.ConsigneeAddress || '',
                            Notify: row.Notify || '',
                            NotifyAddress: row.NotifyAddress || '',
                            CarrierName: row.CarrierName || null,
                            CarrierSid: row.CarrierSid || null,
                            VesselName: row.VesselName || null,
                            VoyageNo: row.VoyageNo || null,
                            ETD: row.ETD ? new Date(row.ETD) : null,
                            ETA: row.ETA ? new Date(row.ETA) : null,
                            POO: row.POO || null,
                            POL: row.POL || '',
                            POD: row.POD || '',
                            FPD: row.FPD || null,
                            IncoTerms: row.IncoTerms || '',
                            FreightTerms: row.FreightTerms || '',  // auto-patched from OceanFreight
                            MovementType: row.MovementType || null,
                            DestinationAgent: row.DestinationAgent || null,
                            AgentAddress: row.AgentAddress || '',
                            SalesmanSid: row.SalesPersonSid || null,
                            InternalNote: row.InternalNote || '',
                            GeneralNote: row.GeneralNote || '',
                            BookingStatus: row.BookingStatus || 'Booked',
                            NominatedBy: row.NominatedBy || 'Self',
                            Coload: row.Coload || 'N',
                            // JobType is the ExportImport value from the department master
                            JobType: row.JobType || row.ExportImport || '',
                            status: 'A',
                            createdBy,
                        },
                    });

                    // ── 2. BookingCargo + BookingProducts ──────────────────────────────
                    for (const cargo of row.bookingCargo || []) {
                        const createdCargo = await prisma.bookingCargo.create({
                            data: {
                                BookingHeaderSid: bookingHeader.BookingHeaderSid,
                                CompanyMasterSid: companyMasterSid,
                                BranchMasterSid: branchMasterSid,
                                CargoType: cargo.CargoType || 'General',
                                ContainerType: cargo.ContainerType || null,
                                NoofContainers: Number(cargo.NoofContainers) || 0,
                                // Weight/volume aggregated from products
                                GrossWeight: Number(cargo.GrossWeight) || 0,
                                NetWeight: Number(cargo.NetWeight) || 0,
                                Volume: Number(cargo.Volume) || 0,
                                Volumetric: Number(cargo.Volumetric) || 0,
                                // ChargeableWeight = MAX(GrossWeight, Volumetric)
                                ChargeableWeight: Number(cargo.ChargeableWeight) || 0,
                                NoOfPackage: Number(cargo.NoOfPackage) || 0,
                                ShipmentTerms: cargo.ShipmentTerms || null,
                                MovementType: cargo.MovementType || null,
                                ModeOfTransport: cargo.ModeOfTransport || null,
                                FreightTerms: cargo.FreightTerms || null,
                                StuffingAt: cargo.StuffingAt || 'Dock',
                                status: 'A',
                                createdBy,
                            },
                        });

                        for (const product of cargo.bookingProducts || []) {
                            await prisma.bookingProduct.create({
                                data: {
                                    BookingHeaderSid: bookingHeader.BookingHeaderSid,
                                    BookingCargoSid: createdCargo.BookingCargoSid,
                                    ProductName: product.ProductName || '',
                                    ExternaPkg: product.ExternaPkg || null,
                                    ExternlQty: String(product.ExternlQty || ''),
                                    GrossWeight: Number(product.GrossWeight) || 0,
                                    NetWeight: Number(product.NetWeight) || 0,
                                    Volume: Number(product.Volume) || 0,
                                    Volumetric: Number(product.Volumetric) || 0,
                                    Length: product.Length || null,
                                    Width: product.Width || null,
                                    Height: product.Height || null,
                                    IsHaz: product.IsHaz || 'N',
                                    ImcoClass: product.ImcoClass || null,
                                    UnNo: String(product.UnNo ?? ''),
                                    PkgGroup: product.PkgGroup || '',
                                    ShippingBillNo: product.ShippingBillNo || '',
                                    ShippingBillDate: product.ShippingBillDate
                                        ? new Date(product.ShippingBillDate)
                                        : null,
                                    CargoRecDate: product.CargoRecDate
                                        ? new Date(product.CargoRecDate)
                                        : null,
                                    status: 'A',
                                    createdBy,
                                },
                            });
                        }
                    }

                    // ── 3. BookingOthers ───────────────────────────────────────────────
                    const ot = row.bookingOther;
                    await prisma.bookingOthers.create({
                        data: {
                            BookingHeaderSid: bookingHeader.BookingHeaderSid,
                            CustomerRefNo: ot?.CustomerRefNo || '',
                            YardCFS: ot?.YardCFS || '',
                            ReleaseType: ot?.ReleaseType || null,
                            Forwarder: ot?.Forwarder || null,
                            ForwarderAddress: ot?.ForwarderAddress || '',
                            Notify2: ot?.Notify2 || null,
                            NotifyAddress2: ot?.NotifyAddress2 || '',
                            Coloader: ot?.Coloader || null,
                            PickupPlace: ot?.PickupPlace || '',
                            PickupAddress: ot?.PickupAddress || '',
                            DeliveryPlace: ot?.DeliveryPlace || '',
                            DeliveryDate: ot?.DeliveryDate || '',
                            DeliveryAddress: ot?.DeliveryAddress || '',
                            CargoCurrency: ot?.CargoCurrency || '',
                            CargoValue: Number(ot?.CargoValue) || 0,
                            CarrierBookingRef: ot?.CarrierBookingRef || '',
                            CarrierBookingDate: ot?.CarrierBookingDate
                                ? new Date(ot.CarrierBookingDate)
                                : null,
                            SwitchBL: ot?.SwitchBL || 'N',
                            BacktoBack: ot?.BacktoBack || 'N',
                            CHAName: ot?.CHAName || '',
                            ExternalRemarks: ot?.ExternalRemarks || '',
                            NotifyParty: ot?.NotifyParty || '',
                            NotifyPartyAddress: '',
                            OriginAgent: ot?.OriginAgent || '',
                            OriginAgentAddress: '',
                            HBLNo: '',
                            SwitchBLAgent: null,
                            AgentAddress: '',
                            SwitchBLShipper: null,
                            SwitchBLConsignee: null,
                            SwitchLocation: '',
                            Depo: '',
                            ROValidity: null,
                            LocalTransport: null,
                            OverseasTransport: null,
                            OverseasClearance: null,
                            PickupMode: null,
                            DeliveryMode: null,
                            status: 'A',
                            createdBy,
                        },
                    });
                }, { timeout: 60000 });

                created++;
            } catch (err: any) {
                errors.push({
                    ref: row.tempBookingRef || `row:${row.rowNum}`,
                    message: err.message || 'DB error during save',
                });
                skipped++;
            }
        }

        return { created, skipped, errors };
    }
}
