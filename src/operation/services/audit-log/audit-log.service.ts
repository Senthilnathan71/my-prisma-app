import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { table } from 'node:console';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class AuditLogService {
    constructor(
        private readonly _db: DatabaseService,
        private readonly logger: Logger
    ) { }

    async getAuditLogs(tableName: string, recordId?: string, screenName?: string) {
        try {
            if (!tableName) {
                throw new BadRequestException('Table name is required');
            }
            if (!screenName) {
                throw new BadRequestException('Screen name is required');
            }
            switch (screenName) {
                case 'Booking':
                    return this.getBookingLogs(recordId);
                case 'AgentMasterAirWaybill':
                    return this.getAgentMasterAirWaybillLogs(recordId);
                case 'CreditNote':
                    return this.getCreditNoteLogs(recordId);
                case 'VendorCreditNote':
                    return this.getVendorCreditNoteLogs(recordId);
                case 'ReverseVoucher':
                    return this.getReverseVoucherLogs(recordId);
                case 'CreditRequest':
                    return this.getCreditRequestLogs(recordId);
                case 'HouseAirwaybill':
                    return this.getAgentMasterAirWaybillLogs(recordId);
                case 'HouseJob':
                    return this.getAgentMasterAirWaybillLogs(recordId);
                case 'Invoice':
                    return this.getInvoiceLogs(recordId);
                case 'VendorInvoice':
                    return this.getVendorInvoiceLogs(recordId);
                case 'MasterJob':
                    return this.getMasterJobLogs(recordId);
                case 'MasterAirwayBill':
                    return this.getMasterJobLogs(recordId);
                case 'ServiceJob':
                    return this.getAgentMasterAirWaybillLogs(recordId);
                case 'Receipt':
                    return this.getReceiptLogs(recordId);
                case 'Payment':
                    return this.getPaymentLogs(recordId);
                case 'JournalVoucher':
                    return this.getJVLogs(recordId);
                case 'Quotation':
                    return this.getQuoteLogs(recordId);
                case 'Enquiry':
                    return this.getEnquiryLogs(recordId);
                case 'VoucherMatching':
                    return this.getVoucherMatchingLogs(recordId);
                case 'DocType':
                    return this.getdoctypeLogs(recordId);
                case 'NumberSeriesConfig':
                    return this.getnumberseriesLogs(recordId);
                case 'PaymentRequest':
                    return this.getPaymentRequestLogs(recordId);
                case 'ChartOfAccounts':
                    return this.getChartOfAccountsLogs(recordId);
                case 'CurrencyExchange':
                    return this.getCurrencyExchangeLogs(recordId);
                case 'SubledgerMapping':
                    return this.getSubledgerMappingLogs(recordId);
                case 'SupplierTdsMapping':
                    return this.getSupplierTdsMappingLogs(recordId);
                case 'Lead':
                    return this.getLeadLogs(recordId);
                case 'Meeting':
                    return this.getMeetingLogs(recordId);
                case 'Company':
                    return this.getCompanyLogs(recordId);
                case 'CostCenter':
                    return this.getCostCenterLogs(recordId);
                case 'ProfitCenter':
                    return this.getProfitCenterLogs(recordId);
                case 'TDSSet':
                    return this.getTDSSetLogs(recordId);
                case 'Year':
                    return this.getYearLogs(recordId);
                case 'BLClause':
                    return this.getBlClauseLogs(recordId);
                case 'Charge':
                    return this.getChargeLogs(recordId);
                case 'ChargeGroup':
                    return this.getChargeGroupLogs(recordId);
                case 'ContainerType':
                    return this.getContainerTypeLogs(recordId);
                case 'Currency':
                    return this.getCurrencyLogs(recordId);
                case 'Department':
                    return this.getDepartmentLogs(recordId);
                case 'Division':
                    return this.getDivisionLogs(recordId);
                case 'HawbStock':
                    return this.getHawbStockLogs(recordId);
                case 'hs-sac':
                    return this.getHSSACLogs(recordId);
                case 'MawbStock':
                    return this.getMawbStockLogs(recordId);
                case 'Milestone':
                    return this.getMileStoneLogs(recordId);
                case 'Network':
                    return this.getNetworkLogs(recordId);
                case 'Organization':
                    return this.getOrganizationLogs(recordId);
                case 'PackageType':
                    return this.getPackageTypeLogs(recordId);
                case 'TaxGroup':
                    return this.getTaxGroupLogs(recordId);
                case 'PortMaster':
                    return this.getPortMasterLogs(recordId);
                case 'Product':
                    return this.getProductLogs(recordId);
                case 'Voyage':
                    return this.getVoyageLogs(recordId);
                case 'Sector':
                    return this.getSectorLogs(recordId);
                case 'UOM':
                    return this.getUOMLogs(recordId);
                case 'Unit':
                    return this.getUnitLogs(recordId);
                case 'Tariff':
                    return this.getTariffLogs(recordId);
                case 'Tax':
                    return this.getTaxLogs(recordId);
                case 'Zone':
                    return this.getZoneLogs(recordId);
                case 'Vessel':
                    return this.getVesselLogs(recordId);
                case 'StdCharge':
                    return this.getStdChargeLogs(recordId);
                case 'Terms':
                    return this.getTermsLogs(recordId);
                case 'Print': 
                    return this.getPrintLogs(recordId);
                case 'Country':
                    return this.getCountryLogs(recordId);
                case 'State' :
                    return this.getStateLogs(recordId);
                case 'Inco':
                    return this.getIncoLogs(recordId);
                case 'Imco':
                    return this.getImcoLogs(recordId);
                case 'City':
                    return this.getCityLogs(recordId);
                case 'User':
                    return this.getUserLogs(recordId);
                case 'ReportMaster':
                    return this.getReportMasterLogs(recordId);
            }
        } catch (error) {
            this.logger.warn(`getAuditLog Error: ${error.message}`);
            throw error;
        }
    }

    private replaceAndRename(
        obj: Record<string, any>,
        oldKey: string,
        newKey: string,
        valueMap: Map<string, string>
    ) {
        if (!(oldKey in obj)) return;

        const rawValue = obj[oldKey];
        const mappedValue =
            rawValue === null || rawValue === undefined || rawValue === ''
                ? null
                : valueMap.get(String(rawValue)) || String(rawValue);

        if (oldKey === newKey) {
            obj[oldKey] = mappedValue;
            return;
        }

        obj[newKey] = mappedValue;
        delete obj[oldKey];
    }

    private removeIgnoredFields(obj: Record<string, any>, ignoredFields: string[]) {
        for (const field of ignoredFields) {
            delete obj[field];
        }
    }

    private replaceValueFromMap(
        obj: Record<string, any>,
        key: string,
        map: Record<string, string>
    ) {
        if (!(key in obj)) return;

        const val = obj[key];

        if (val === null || val === undefined) return;

        const mapped = map[val];

        if (mapped) {
            obj[key] = mapped;
        }
    }

    private replaceArrayIdsWithNames(
        obj: Record<string, any>,
        key: string,
        map: Map<string, string>
    ) {
        if (!(key in obj)) return;

        const val = obj[key];
        if (!Array.isArray(val)) return;

        obj[key] = val.map(id => map.get(String(id)) ?? String(id));
    }


    private getBookingRowLabel(
        log: any,
        rowLabelMaps: {
            cargoMap: Map<string, string>;
            productMap: Map<string, string>;
            ratesMap: Map<string, string>;
            connectionMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');

        switch (log.tableName) {
            case 'BookingProduct':
                return (
                    rowLabelMaps.productMap.get(recordId) ||
                    `Product [${newVal.ProductName || oldVal.ProductName || recordId}]`
                );

            case 'BookingRates':
                return (
                    rowLabelMaps.ratesMap.get(recordId) ||
                    `Rates [${newVal.SerialNumber || oldVal.SerialNumber || recordId
                    } - ${newVal.Charge || oldVal.Charge || ''
                    }]`
                );

            case 'BookingConnection':
                return (
                    rowLabelMaps.connectionMap.get(recordId) ||
                    `Connection [${newVal.VesselName || oldVal.VesselName || recordId}]`
                );

            case 'BookingCargo':
                return (
                    rowLabelMaps.cargoMap.get(recordId) ||
                    `Cargo [${newVal.CargoType || oldVal.CargoType || recordId}]`
                );
            default:
                return null;
        }
    }

    private getBookingLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            BookingHeader: 'Shipment',
            BookingCargo: 'Cargo',
            BookingProduct: 'Product',
            BookingConnection: 'Connection',
            BookingOthers: 'Others',
            BookingRates: 'Rates',
            BookingCro: 'CRO'
        };

        return sectionMap[tableName] || tableName;
    }

    private async getBookingLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let cargoRows: any[] = [];
            let productRows: any[] = [];
            let ratesRows: any[] = [];
            let connectionRows: any[] = [];

            const bookingHeaderSid = Number(recordId);

            const [
                fetchedcargo,
                fetchedProducts,
                fetchedConnections,
                others,
                fetchedRates,
                cro
            ] = await Promise.all([
                this._db.bookingCargo.findMany({
                    where: { BookingHeaderSid: bookingHeaderSid },
                    select: {
                        BookingCargoSid: true,
                        CargoType: true
                    }
                }),
                this._db.bookingProduct.findMany({
                    where: { BookingHeaderSid: bookingHeaderSid },
                    select: {
                        BookingProductSid: true,
                        BookingCargoSid: true,
                        ProductName: true,
                        ShippingBillNo: true
                    },
                }),
                this._db.bookingConnection.findMany({
                    where: { BookingHeaderSid: bookingHeaderSid },
                    select: {
                        BookingConnectionSid: true,
                        VesselName: true
                    }
                }),
                this._db.bookingOthers.findMany({
                    where: { BookingHeaderSid: bookingHeaderSid },
                    select: { BookingOthersSid: true }
                }),
                this._db.bookingRates.findMany({
                    where: { BookingHeaderSid: bookingHeaderSid },
                    select: {
                        BookingRatesSid: true,
                        SerialNumber: true,
                        ChargeMasterSid: true,
                    }
                }),
                this._db.bookingCro.findMany({
                    where: { BookingHeaderSid: bookingHeaderSid },
                    select: { BookingCroSid: true }
                }),
            ]);

            productRows = fetchedProducts;
            connectionRows = fetchedConnections;
            ratesRows = fetchedRates;
            cargoRows = fetchedcargo;

            conditions = [
                {
                    tableName: 'BookingHeader',
                    recordId: recordId
                },
                ...(cargoRows.length
                    ? [{
                        tableName: 'BookingCargo',
                        recordId: { in: cargoRows.map(x => String(x.BookingCargoSid)) }
                    }]
                    : []),
                ...(productRows.length
                    ? [{
                        tableName: 'BookingProduct',
                        recordId: { in: productRows.map(x => String(x.BookingProductSid)) }
                    }]
                    : []),
                ...(connectionRows.length
                    ? [{
                        tableName: 'BookingConnection',
                        recordId: { in: connectionRows.map(x => String(x.BookingConnectionSid)) }
                    }]
                    : []),
                {
                    tableName: 'BookingOthers',
                    recordId: { in: others.map(x => String(x.BookingOthersSid)) }
                },
                ...(ratesRows.length
                    ? [{
                        tableName: 'BookingRates',
                        recordId: { in: ratesRows.map(x => String(x.BookingRatesSid)) }
                    }]
                    : []),
                {
                    tableName: 'BookingCro',
                    recordId: { in: cro.map(x => String(x.BookingCroSid)) }
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [departments, users, customers, charges, uoms, currencies, voucher, vouchertype] = await Promise.all([
                this._db.departmentMaster.findMany({
                    select: {
                        DepartmentMasterSid: true,
                        departmentName: true
                    }
                }),
                this._db.userMaster.findMany({
                    select: {
                        UserMasterSid: true,
                        userName: true
                    }
                }),
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                }),
                this._db.chargeMaster.findMany({
                    select: {
                        ChargeMasterSid: true,
                        chargeCode: true,
                    }
                }),
                this._db.uOMMaster.findMany({
                    select: {
                        UOMMasterSid: true,
                        UOMCode: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
                this._db.voucherHeader.findMany({
                    select: {
                        VoucherHeaderSid: true,
                        VoucherNumber: true
                    }
                }),
                this._db.voucherTypeMaster.findMany({
                    select: {
                        VoucherTypeMasterSid: true,
                        DocumentTypeName: true
                    }
                })
            ]);

            const departmentMap = new Map<string, string>(
                departments.map(d => [String(d.DepartmentMasterSid), d.departmentName])
            );

            const salesmanMap = new Map<string, string>(
                users.map(u => [String(u.UserMasterSid), u.userName])
            );

            const customerMap = new Map<string, string>(
                customers.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            );

            const chargeMap = new Map<string, string>(
                charges.map(c => [String(c.ChargeMasterSid), c.chargeCode])
            );

            const uomMap = new Map<string, string>(
                uoms.map(c => [String(c.UOMMasterSid), c.UOMCode])
            );

            const currencyMap = new Map<string, string>(
                currencies.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const voucherMap = new Map<string, string>(
                voucher.map(c => [String(c.VoucherHeaderSid), c.VoucherNumber])
            );

            const voucherTypeMap = new Map<string, string>(
                vouchertype.map(c => [String(c.VoucherTypeMasterSid), c.DocumentTypeName])
            );

            const cargoMap = new Map<string, string>(
                cargoRows.map((c) => [
                    String(c.BookingCargoSid),
                    `Cargo [${c.CargoType?.toString().trim() || c.BookingCargoSid}]`
                ])
            )

            const productMap = new Map<string, string>(
                productRows.map((p) => {
                    const cargoLabel =
                        cargoMap.get(String(p.BookingCargoSid)) || `[${p.BookingCargoSid}]`;
                    const productLabel =
                        p.ProductName?.toString().trim() || `[${p.BookingProductSid}]`;
                    return [
                        String(p.BookingProductSid),
                        `Product [${cargoLabel} - ${productLabel}]`
                    ];
                })
            );

            const connectionMap = new Map<string, string>(
                connectionRows.map((c) => [
                    String(c.BookingConnectionSid),
                    `Connection [${c.VesselName?.toString().trim() || c.BookingConnectionSid}]`
                ])
            );

            const ratesMap = new Map<string, string>(
                ratesRows.map((r) => {

                    const serial = r.SerialNumber?.toString().trim() || r.BookingRatesSid;

                    const charge =
                        chargeMap.get(String(r.ChargeMasterSid)) ||
                        r.ChargeMasterSid ||
                        '';

                    const label =
                        charge
                            ? `Rates [${serial} - ${charge}]`
                            : `Rates [${serial}]`;

                    return [
                        String(r.BookingRatesSid),
                        label
                    ];
                })
            );

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const uom = {
                1: 'Meter',
                2: 'Centimeter',
                3: 'Inch'
            };

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'BookingConnectionSid',
                'CarrierSid', 'CompanyMasterSid', 'CustomerBranchSid',
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy', 'MasterNoSid', 'HouseJobSid',
                'VoyageMasterSid', 'BookingHeaderSid', 'BranchMasterSid', 'BookingCroSid', 'AgentBranchSid'
            ];

            const rowLabelMaps = {
                productMap,
                connectionMap,
                ratesMap,
                cargoMap,
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'DepartmentMasterSid', 'Department', departmentMap);
                this.replaceAndRename(newVal, 'DepartmentMasterSid', 'Department', departmentMap);

                this.replaceAndRename(oldVal, 'SalesmanSid', 'Salesman', salesmanMap);
                this.replaceAndRename(newVal, 'SalesmanSid', 'Salesman', salesmanMap);

                this.replaceAndRename(oldVal, 'DestinationAgent', 'DestinationAgent', customerMap);
                this.replaceAndRename(newVal, 'DestinationAgent', 'DestinationAgent', customerMap);

                this.replaceAndRename(oldVal, 'CustomerMasterSid', 'BillingParty', customerMap);
                this.replaceAndRename(newVal, 'CustomerMasterSid', 'BillingParty', customerMap);

                this.replaceAndRename(oldVal, 'AgentMasterSid', 'Party', customerMap);
                this.replaceAndRename(newVal, 'AgentMasterSid', 'Party', customerMap);

                this.replaceAndRename(oldVal, 'ChargeMasterSid', 'Charge', chargeMap);
                this.replaceAndRename(newVal, 'ChargeMasterSid', 'Charge', chargeMap);

                this.replaceAndRename(oldVal, 'ChargeUomSid', 'ChargeUom', uomMap);
                this.replaceAndRename(newVal, 'ChargeUomSid', 'ChargeUom', uomMap);

                this.replaceAndRename(oldVal, 'RevenueChargeUomSid', 'RevenueChargeUom', uomMap);
                this.replaceAndRename(newVal, 'RevenueChargeUomSid', 'RevenueChargeUom', uomMap);

                this.replaceAndRename(oldVal, 'CostChargeUomSid', 'CostChargeUom', uomMap);
                this.replaceAndRename(newVal, 'CostChargeUomSid', 'CostChargeUom', uomMap);

                this.replaceAndRename(oldVal, 'RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap);
                this.replaceAndRename(newVal, 'RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap);

                this.replaceAndRename(oldVal, 'CostCurrencyMasterSid', 'CostCurrency', currencyMap);
                this.replaceAndRename(newVal, 'CostCurrencyMasterSid', 'CostCurrency', currencyMap);

                this.replaceAndRename(oldVal, 'RevenueVoucherHeaderSid', 'VoucherNo', voucherMap);
                this.replaceAndRename(newVal, 'RevenueVoucherHeaderSid', 'VoucherNo', voucherMap);

                this.replaceAndRename(oldVal, 'RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap);
                this.replaceAndRename(newVal, 'RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap);

                this.replaceAndRename(oldVal, 'CostVoucherHeaderSid', 'VoucherNo', voucherMap);
                this.replaceAndRename(newVal, 'CostVoucherHeaderSid', 'VoucherNo', voucherMap);

                this.replaceAndRename(oldVal, 'CostVoucherTypeMasterSid', 'Type', voucherTypeMap);
                this.replaceAndRename(newVal, 'CostVoucherTypeMasterSid', 'Type', voucherTypeMap);

                this.replaceValueFromMap(oldVal, 'Coload', yesNoMap);
                this.replaceValueFromMap(newVal, 'Coload', yesNoMap);

                this.replaceValueFromMap(oldVal, 'IsHaz', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsHaz', yesNoMap);

                this.replaceValueFromMap(oldVal, 'ShipmentType', yesNoMap);
                this.replaceValueFromMap(newVal, 'ShipmentType', yesNoMap);

                this.replaceValueFromMap(oldVal, 'UomMasterSid', uom);
                this.replaceValueFromMap(newVal, 'UomMasterSid', uom);

                this.replaceValueFromMap(oldVal, 'SwitchBL', yesNoMap);
                this.replaceValueFromMap(newVal, 'SwitchBL', yesNoMap);

                this.replaceValueFromMap(oldVal, 'BacktoBack', yesNoMap);
                this.replaceValueFromMap(newVal, 'BacktoBack', yesNoMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getBookingLabel(log.tableName),
                    rowLabel: this.getBookingRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });

            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getAgentMasterAirWaybillRowLabel(
        log: any,
        rowLabelMaps: {
            cargoMap: Map<string, string>;
            productMap: Map<string, string>;
            connectionMap: Map<string, string>;
            rateMap: Map<string, string>;
            boeMap: Map<string, string>;
            vehicleMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'HouseJobProduct':
                return (
                    rowLabelMaps.productMap.get(recordId) ||
                    `Product [${newVal.ProductName || oldVal.ProductName || recordId}]`
                );
            case 'HouseJobConnection':
                return (
                    rowLabelMaps.connectionMap.get(recordId) ||
                    `Connection [${newVal.VesselName || oldVal.VesselName || recordId}]`
                );
            case 'HouseJobBOE':
                return (
                    rowLabelMaps.boeMap.get(recordId) ||
                    `BOE [${newVal.DeclarationNo || oldVal.DeclarationNo || recordId}]`
                );
            case 'CostRevenueCharges':
                return (
                    rowLabelMaps.rateMap.get(recordId) ||
                    `Rate [${newVal.SerialNumber || oldVal.SerialNumber || recordId} - ${newVal.Charge || oldVal.Charge || ''}]`
                );
            case 'HouseJobVehicle':
                return (
                    rowLabelMaps.vehicleMap.get(recordId) ||
                    `Vehicle [${newVal.ChassisNo || oldVal.ChassisNo || recordId}]`
                );
            case 'HouseJobCargo':
                return (
                    rowLabelMaps.cargoMap.get(recordId) ||
                    `Cargo [${newVal.CargoType || oldVal.CargoType || recordId}]`
                );
            default:
                return null;
        }
    }

    private getAgentMasterAirWaybillLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            HouseJob: 'Shipment',
            HouseJobCargo: 'Cargo',
            HouseJobProduct: 'Product',
            HouseJobConnection: 'Connection',
            HouseJobOthers: 'Others',
            CostRevenueCharges: 'Rates',
            HouseJobBOE: 'BOE',
            HouseJobCustoms: 'Customs',
            HouseJobVehicle: 'Vehicle',
        };

        return sectionMap[tableName] || tableName;
    }

    private async getAgentMasterAirWaybillLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let cargoRows: any[] = [];
            let productRows: any[] = [];
            let connectionRows: any[] = [];
            let ratesRows: any[] = [];
            let boeRows: any[] = [];
            let vehicleRows: any[] = [];

            const houseJobSid = Number(recordId);

            const [
                fetchedcargo,
                fetchedProducts,
                fetchedConnections,
                fetchedRates,
                fetchedBOE,
                others,
                customs,
                fetchedVehicles,
            ] = await Promise.all([
                this._db.houseJobCargo.findMany({
                    where: { HouseJobSid: houseJobSid },
                    select: {
                        HouseJobCargoSid: true,
                        CargoType: true
                    }
                }),
                this._db.houseJobProduct.findMany({
                    where: { HouseJobSid: houseJobSid },
                    select: {
                        HouseJobProductSid: true,
                        HouseJobCargoSid: true,
                        ProductName: true,
                        ShippingBillNo: true
                    },
                }),
                this._db.houseJobConnection.findMany({
                    where: { HouseJobSid: houseJobSid },
                    select: {
                        HouseJobConnectionSid: true,
                        VesselName: true
                    }
                }),
                this._db.costRevenueCharges.findMany({
                    where: { TransactionSid: houseJobSid },
                    select: {
                        CostRevenueChargesSid: true,
                        SerialNumber: true,
                        ChargeMasterSid: true,
                    }
                }),
                this._db.houseJobBOE.findMany({
                    where: { HouseJobSid: houseJobSid },
                    select: {
                        HouseJobBOESid: true,
                        DeclarationNo: true
                    }
                }),
                this._db.houseJobOthers.findMany({
                    where: { HouseJobSid: houseJobSid },
                    select: { HouseJobOthersSid: true }
                }),
                this._db.houseJobCustoms.findMany({
                    where: { HouseJobSid: houseJobSid },
                    select: { HouseJobCustomsSid: true }
                }),
                this._db.houseJobVehicle.findMany({
                    where: { HouseJobSid: houseJobSid },
                    select: {
                        HouseJobVehicleSid: true,
                        ChassisNo: true
                    }
                })
            ]);
            productRows = fetchedProducts;
            connectionRows = fetchedConnections;
            ratesRows = fetchedRates;
            boeRows = fetchedBOE;
            vehicleRows = fetchedVehicles;
            cargoRows = fetchedcargo;

            conditions = [
                {
                    tableName: 'HouseJob',
                    recordId: recordId
                },
                ...(cargoRows.length
                    ? [{
                        tableName: 'HouseJobCargo',
                        recordId: { in: cargoRows.map(x => String(x.HouseJobCargoSid)) }
                    }]
                    : []),
                ...(productRows.length
                    ? [{
                        tableName: 'HouseJobProduct',
                        recordId: { in: productRows.map(x => String(x.HouseJobProductSid)) }
                    }]
                    : []),
                ...(connectionRows.length
                    ? [{
                        tableName: 'HouseJobConnection',
                        recordId: { in: connectionRows.map(x => String(x.HouseJobConnectionSid)) }
                    }]
                    : []),
                {
                    tableName: 'HouseJobOthers',
                    recordId: { in: others.map(x => String(x.HouseJobOthersSid)) }
                },
                ...(ratesRows.length
                    ? [{
                        tableName: 'CostRevenueCharges',
                        recordId: { in: ratesRows.map(x => String(x.CostRevenueChargesSid)) }
                    }]
                    : []),
                ...(boeRows.length
                    ? [{
                        tableName: 'HouseJobBOE',
                        recordId: { in: boeRows.map(x => String(x.HouseJobBOESid)) }
                    }]
                    : []),
                {
                    tableName: 'HouseJobCustoms',
                    recordId: { in: customs.map(x => String(x.HouseJobCustomsSid)) }
                },
                ...(vehicleRows.length
                    ? [{
                        tableName: 'HouseJobVehicle',
                        recordId: { in: vehicleRows.map(x => String(x.HouseJobVehicleSid)) }
                    }]
                    : []),
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [departments, charges, users, customers, uoms, currencies, voucher, vouchertype] = await Promise.all([
                this._db.departmentMaster.findMany({
                    select: {
                        DepartmentMasterSid: true,
                        departmentName: true
                    }
                }),
                this._db.chargeMaster.findMany({
                    select: {
                        ChargeMasterSid: true,
                        chargeCode: true
                    }
                }),
                this._db.userMaster.findMany({
                    select: {
                        UserMasterSid: true,
                        userName: true
                    }
                }),
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                }),
                this._db.uOMMaster.findMany({
                    select: {
                        UOMMasterSid: true,
                        UOMCode: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
                this._db.voucherHeader.findMany({
                    select: {
                        VoucherHeaderSid: true,
                        VoucherNumber: true
                    }
                }),
                this._db.voucherTypeMaster.findMany({
                    select: {
                        VoucherTypeMasterSid: true,
                        DocumentTypeName: true
                    }
                })
            ]);

            const departmentMap = new Map<string, string>(
                departments.map(d => [String(d.DepartmentMasterSid), d.departmentName])
            );

            const chargeMap = new Map<string, string>(
                charges.map(c => [String(c.ChargeMasterSid), c.chargeCode])
            );

            const salesmanMap = new Map<string, string>(
                users.map(u => [String(u.UserMasterSid), u.userName])
            );

            const customerMap = new Map<string, string>(
                customers.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            );

            const uomMap = new Map<string, string>(
                uoms.map(c => [String(c.UOMMasterSid), c.UOMCode])
            );

            const currencyMap = new Map<string, string>(
                currencies.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const voucherMap = new Map<string, string>(
                voucher.map(c => [String(c.VoucherHeaderSid), c.VoucherNumber])
            );

            const voucherTypeMap = new Map<string, string>(
                vouchertype.map(c => [String(c.VoucherTypeMasterSid), c.DocumentTypeName])
            );

            const cargoMap = new Map<string, string>(
                cargoRows.map((c) => [
                    String(c.HouseJobCargoSid),
                    `Cargo [${c.CargoType?.toString().trim() || c.HouseJobCargoSid}]`
                ])
            )

            const productMap = new Map<string, string>(
                productRows.map((p) => {
                    const cargoLabel =
                        cargoMap.get(String(p.HouseJobCargoSid)) || `[${p.HouseJobCargoSid}]`;
                    const productLabel =
                        p.ProductName?.toString().trim() || `[${p.HouseJobProductSid}]`;
                    return [
                        String(p.HouseJobProductSid),
                        `Product [${cargoLabel} - ${productLabel}]`
                    ];
                })
            );

            const vehicleMap = new Map<string, string>(
                vehicleRows.map((v) => [
                    String(v.HouseJobVehicleSid),
                    `Vehicle [${v.ChassisNo?.toString().trim() || v.HouseJobVehicleSid}]`
                ])
            )

            const connectionMap = new Map<string, string>(
                connectionRows.map((c) => [
                    String(c.HouseJobConnectionSid),
                    `Connection [${c.VesselName?.toString().trim() || c.HouseJobConnectionSid}]`
                ])
            );

            const rateMap = new Map<string, string>(
                ratesRows.map((r) => {
                    const serial = r.SerialNumber?.toString().trim() || r.CostRevenueChargesSid;
                    const charge = chargeMap.get(String(r.ChargeMasterSid)) || r.ChargeMasterSid || '';
                    const label = charge ? `Rate [${serial} - ${charge}]` : `Rate [${serial}]`;
                    return [
                        String(r.CostRevenueChargesSid),
                        label
                    ];
                })
            );

            const boeMap = new Map<string, string>(
                boeRows.map((b) => [
                    String(b.HouseJobBOESid),
                    `BOE [${b.DeclarationNo?.toString().trim() || b.HouseJobBOESid}]`
                ])
            );

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const uom = {
                1: 'Meter',
                2: 'Centimeter',
                3: 'Inch'
            };

            const custom = {
                NCV: 'No Commercial Value',
                DVC: 'Declared value for Customs'
            };

            const carriage = {
                NVD: 'No value declared',
                DVC: 'Declared value for Carriage',
            };

            const cargocode = {
                F: 'FCL Container',
                L: 'LCL Container',
                M: 'Empty Container',
                B: 'Bulk Solid',
                Q: 'Bulk Liquid',
                R: 'RO-RO Unit',
                P: 'Passenger',
                G: 'General Cargo (Break Bulk)',
            }

            const un = {
                U: 'Used',
                N: 'New'
            }

            const storagerequest = {
                D: 'Direct Delivery',
                S: 'Storage in Sheds',
                Y: 'Storage in Yards',
            }

            const temp = {
                F: 'Fahrenheit',
                C: 'Celsius',
            }

            const vehicleIndicatorList = {
                V: 'Vehicle',
                E: 'Equipment',
                X: 'Others'
            }

            const rollingList = {
                R: 'Rolling',
                S: 'Static'
            }

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'CustomerBranchSid', 'CustomerMasterSid',
                'CarrierSid', 'VoyageMasterSid', 'CostAgentBranchSid', 'RevenueCustomerBranchSid', 'UpdatedBy',
                'UpdatedOn', 'CreatedBy', 'CreatedOn'
            ];

            const rowLabelMaps = {
                productMap,
                connectionMap,
                rateMap,
                boeMap,
                vehicleMap,
                cargoMap
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'DepartmentMasterSid', 'Department', departmentMap);
                this.replaceAndRename(newVal, 'DepartmentMasterSid', 'Department', departmentMap);

                this.replaceAndRename(oldVal, 'SalesmanSid', 'Salesman', salesmanMap);
                this.replaceAndRename(newVal, 'SalesmanSid', 'Salesman', salesmanMap);

                this.replaceAndRename(oldVal, 'DestinationAgent', 'DestinationAgent', customerMap);
                this.replaceAndRename(newVal, 'DestinationAgent', 'DestinationAgent', customerMap);

                this.replaceAndRename(oldVal, 'AgentName', 'OrginAgent', customerMap);
                this.replaceAndRename(newVal, 'AgentName', 'OrginAgent', customerMap);

                this.replaceAndRename(oldVal, 'ChargeMasterSid', 'Charge', chargeMap);
                this.replaceAndRename(newVal, 'ChargeMasterSid', 'Charge', chargeMap);

                this.replaceAndRename(oldVal, 'ChargeUomSid', 'ChargeUom', uomMap);
                this.replaceAndRename(newVal, 'ChargeUomSid', 'ChargeUom', uomMap);

                this.replaceAndRename(oldVal, 'RevenueChargeUomSid', 'RevenueChargeUom', uomMap);
                this.replaceAndRename(newVal, 'RevenueChargeUomSid', 'RevenueChargeUom', uomMap);

                this.replaceAndRename(oldVal, 'CostChargeUomSid', 'CostChargeUom', uomMap);
                this.replaceAndRename(newVal, 'CostChargeUomSid', 'CostChargeUom', uomMap);

                this.replaceAndRename(oldVal, 'RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap);
                this.replaceAndRename(newVal, 'RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap);

                this.replaceAndRename(oldVal, 'CostCurrencyMasterSid', 'CostCurrency', currencyMap);
                this.replaceAndRename(newVal, 'CostCurrencyMasterSid', 'CostCurrency', currencyMap);

                this.replaceAndRename(oldVal, 'RevenueCustomerMasterSid', 'BillingParty', customerMap);
                this.replaceAndRename(newVal, 'RevenueCustomerMasterSid', 'BillingParty', customerMap);

                this.replaceAndRename(oldVal, 'CostAgentMasterSid', 'Party', customerMap);
                this.replaceAndRename(newVal, 'CostAgentMasterSid', 'Party', customerMap);

                this.replaceAndRename(oldVal, 'RevenueVoucherHeaderSid', 'VoucherNo', voucherMap);
                this.replaceAndRename(newVal, 'RevenueVoucherHeaderSid', 'VoucherNo', voucherMap);

                this.replaceAndRename(oldVal, 'RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap);
                this.replaceAndRename(newVal, 'RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap);

                this.replaceAndRename(oldVal, 'CostVoucherHeaderSid', 'VoucherNo', voucherMap);
                this.replaceAndRename(newVal, 'CostVoucherHeaderSid', 'VoucherNo', voucherMap);

                this.replaceAndRename(oldVal, 'CostVoucherTypeMasterSid', 'Type', voucherTypeMap);
                this.replaceAndRename(newVal, 'CostVoucherTypeMasterSid', 'Type', voucherTypeMap);

                this.replaceValueFromMap(oldVal, 'Coload', yesNoMap);
                this.replaceValueFromMap(newVal, 'Coload', yesNoMap);

                this.replaceValueFromMap(oldVal, 'IsHaz', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsHaz', yesNoMap);

                this.replaceValueFromMap(oldVal, 'UomMasterSid', uom);
                this.replaceValueFromMap(newVal, 'UomMasterSid', uom);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.replaceValueFromMap(oldVal, 'DeclaredValueOfCustoms', custom);
                this.replaceValueFromMap(newVal, 'DeclaredValueOfCustoms', custom);

                this.replaceValueFromMap(oldVal, 'DeclaredValueOfCarriage', carriage);
                this.replaceValueFromMap(newVal, 'DeclaredValueOfCarriage', carriage);

                this.replaceValueFromMap(oldVal, 'CargoCode', cargocode);
                this.replaceValueFromMap(newVal, 'CargoCode', cargocode);

                this.replaceValueFromMap(oldVal, 'UsedOrNew', un);
                this.replaceValueFromMap(newVal, 'UsedOrNew', un);

                this.replaceValueFromMap(oldVal, 'StorageRequest', storagerequest);
                this.replaceValueFromMap(newVal, 'StorageRequest', storagerequest);

                this.replaceValueFromMap(oldVal, 'HazStorageRequest', storagerequest);
                this.replaceValueFromMap(newVal, 'HazStorageRequest', storagerequest);

                this.replaceValueFromMap(oldVal, 'RefTemperatureUnit', temp);
                this.replaceValueFromMap(newVal, 'RefTemperatureUnit', temp);

                this.replaceValueFromMap(oldVal, 'TemperatureUnit', temp);
                this.replaceValueFromMap(newVal, 'TemperatureUnit', temp);

                this.replaceValueFromMap(oldVal, 'VehicleIndicator', vehicleIndicatorList);
                this.replaceValueFromMap(newVal, 'VehicleIndicator', vehicleIndicatorList);

                this.replaceValueFromMap(oldVal, 'UsedNew', un);
                this.replaceValueFromMap(newVal, 'UsedNew', un);

                this.replaceValueFromMap(oldVal, 'Rolling', rollingList);
                this.replaceValueFromMap(newVal, 'Rolling', rollingList);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getAgentMasterAirWaybillLabel(log.tableName),
                    rowLabel: this.getAgentMasterAirWaybillRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });

            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getCreditNoteRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'VoucherDetail':
                return (
                    rowLabelMaps.detailMap.get(recordId) ||
                    `Detail [${newVal.Sno || oldVal.Sno || recordId} - ${newVal.Charge || oldVal.Charge || ''}]`
                );
            default:
                return null;
        }
    }

    private getCreditNoteLabel(tableName: string, voucherLabel = 'Credit Note'): string {
        const sectionMap: Record<string, string> = {
            VoucherHeader: voucherLabel,
            VoucherDetail: 'Detail',
            VoucherOthers: 'Others',
        };
        return sectionMap[tableName] || tableName;
    }

    private async getCreditNoteLogs(recordId?: string, voucherLabel = 'Credit Note') {
        try {
            let conditions: any[] = [];
            let detailRows: any[] = [];

            const voucherSid = Number(recordId);

            if (!voucherSid) {
                throw new BadRequestException('Valid recordId is required');
            }

            const [
                fetchedDetails,
                others,
            ] = await Promise.all([
                this._db.voucherDetail.findMany({
                    where: { VoucherHeaderSid: voucherSid },
                    select: {
                        VoucherDetailSid: true,
                        Sno: true,
                        ChargeMasterSid: true
                    }
                }),
                this._db.voucherOthers.findMany({
                    where: { VoucherHeaderSid: voucherSid },
                    select: { VoucherOthersSid: true }
                })
            ]);
            detailRows = fetchedDetails;

            conditions = [
                {
                    tableName: 'VoucherHeader',
                    recordId: recordId
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'VoucherDetail',
                        recordId: { in: detailRows.map(x => String(x.VoucherDetailSid)) }
                    }]
                    : []),
                {
                    tableName: 'VoucherOthers',
                    recordId: { in: others.map(x => String(x.VoucherOthersSid)) }
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [charges, currencies, coa, profit, cost, ledger, department] = await Promise.all([
                this._db.chargeMaster.findMany({
                    select: {
                        ChargeMasterSid: true,
                        chargeCode: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
                this._db.cOAMaster.findMany({
                    select: {
                        COAMasterSid: true,
                        LedgerName: true
                    }
                }),
                this._db.profitCenterMaster.findMany({
                    select: {
                        ProfitCenterMasterSid: true,
                        ProfitCenterName: true
                    }
                }),
                this._db.costCenterMaster.findMany({
                    select: {
                        CostCenterMasterSid: true,
                        CostCenterName: true
                    }
                }),
                this._db.subledgerMaster.findMany({
                    select: {
                        SubledgerMasterSid: true,
                        SubledgerName: true
                    }
                }),
                this._db.departmentMaster.findMany({
                    select: {
                        DepartmentMasterSid: true,
                        departmentName: true
                    }
                })
            ])

            const chargeMap = new Map<string, string>(
                charges.map(c => [String(c.ChargeMasterSid), c.chargeCode])
            );

            const currencyMap = new Map<string, string>(
                currencies.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const coaMap = new Map<string, string>(
                coa.map(c => [String(c.COAMasterSid), c.LedgerName ?? ''])
            );

            const profitMap = new Map<string, string>(
                profit.map(p => [String(p.ProfitCenterMasterSid), p.ProfitCenterName])
            );

            const costMap = new Map<string, string>(
                cost.map(c => [String(c.CostCenterMasterSid), c.CostCenterName])
            );

            const ledgerMap = new Map<string, string>(
                ledger.map(l => [String(l.SubledgerMasterSid), l.SubledgerName])
            );

            const departmentMap = new Map<string, string>(
                department.map(d => [String(d.DepartmentMasterSid), d.departmentName])
            );

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const serial = d.Sno?.toString().trim() || d.ChargeMasterSid;
                    const charge = chargeMap.get(String(d.ChargeMasterSid)) || d.ChargeMasterSid || '';
                    const label = charge ? `Detail [${serial} - ${charge}]` : `Detail [${serial}]`;
                    return [
                        String(d.VoucherDetailSid),
                        label
                    ];
                })
            );

            const PostStatus = {
                P: 'Posted',
                U: 'Unposted'
            }

            const invoiceList = {
                REG: 'Regular',
                REIMB: 'Reimbursement',
                BOS: 'Bill of Supply',
                NONGST: 'Non GST/Zero'
            }

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const ignoredFields = [
                'UpdatedBy', 'UpdatedOn', 'CreatedBy', 'CreatedOn', 'VoucherTransactionSid'
            ]

            const rowLabelMaps = {
                detailMap
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'ChargeMasterSid', 'Charge', chargeMap);
                this.replaceAndRename(newVal, 'ChargeMasterSid', 'Charge', chargeMap);

                this.replaceAndRename(oldVal, 'CurrencyMasterSid', 'Currency', currencyMap);
                this.replaceAndRename(newVal, 'CurrencyMasterSid', 'Currency', currencyMap);

                this.replaceAndRename(oldVal, 'COAMasterSid', 'Ledger', coaMap);
                this.replaceAndRename(newVal, 'COAMasterSid', 'Ledger', coaMap);

                this.replaceAndRename(oldVal, 'BankCOA', 'Bank/Cash', coaMap);
                this.replaceAndRename(newVal, 'BankCOA', 'Bank/Cash', coaMap);

                this.replaceAndRename(oldVal, 'LedgerMasterSid', 'Subledger', ledgerMap);
                this.replaceAndRename(newVal, 'LedgerMasterSid', 'Subledger', ledgerMap);

                this.replaceAndRename(oldVal, 'DepartmentMasterSid', 'Department', departmentMap);
                this.replaceAndRename(newVal, 'DepartmentMasterSid', 'Department', departmentMap);

                this.replaceAndRename(oldVal, 'CostCenter', 'CostCenter', costMap);
                this.replaceAndRename(newVal, 'CostCenter', 'CostCenter', costMap);

                this.replaceAndRename(oldVal, 'ProfitCenter', 'ProfitCenter', profitMap);
                this.replaceAndRename(newVal, 'ProfitCenter', 'ProfitCenter', profitMap);

                this.replaceValueFromMap(oldVal, 'PostStatus', PostStatus);
                this.replaceValueFromMap(newVal, 'PostStatus', PostStatus);

                this.replaceValueFromMap(oldVal, 'InvoiceType', invoiceList);
                this.replaceValueFromMap(newVal, 'InvoiceType', invoiceList);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getCreditNoteLabel(log.tableName, voucherLabel),
                    rowLabel: this.getCreditNoteRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });

            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getVendorCreditNoteLogs(recordId?: string) {
        return this.getCreditNoteLogs(recordId, 'Vendor Credit Note');
    }

    private async getInvoiceLogs(recordId?: string) {
        return this.getCreditNoteLogs(recordId, 'Invoice');
    }

    private async getVendorInvoiceLogs(recordId?: string) {
        return this.getCreditNoteLogs(recordId, 'Vendor Invoice');
    }

    private async getReverseVoucherLogs(recordId?: string) {
        return this.getCreditNoteLogs(recordId, 'Reverse Voucher')
    }

    private async getReceiptLogs(recordId?: string) {
        return this.getCreditNoteLogs(recordId, 'Receipt')
    }

    private async getPaymentLogs(recordId?: string) {
        return this.getCreditNoteLogs(recordId, 'Payment')
    }

    private async getJVLogs(recordId?: string) {
        return this.getCreditNoteLogs(recordId, 'Journal Voucher')
    }

    private getCreditRequestRowLabel(
        log: any,
        rowLabelMaps: {
            creditRequestMap: Map<string, string>;
            kycMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'CustomerCreditRequest':
                return (
                    rowLabelMaps.creditRequestMap.get(recordId) ||
                    `Credit Request [${newVal.Branch || oldVal.Branch || recordId}]`
                );
            case 'CustomerKyc':
                return (
                    rowLabelMaps.kycMap.get(recordId) ||
                    `KYC [${newVal.Branch || oldVal.Branch || recordId} - ${newVal.KycDocName || oldVal.KycDocName || ''} ]`
                )
            default:
                return null;
        }
    }

    private getCreditRequestLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            CustomerCreditRequest: 'Credit Request',
            CustomerKyc: 'KYC',
        };

        return sectionMap[tableName] || tableName;
    }

    private async getCreditRequestLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let creditRequestRows: any[] = [];
            let kycRows: any[] = [];

            const customerMasterSid = Number(recordId);

            const customer = await this._db.customerMaster.findUnique({
                where: { CustomerMasterSid: customerMasterSid },
                select: { CustomerMasterSid: true }
            });

            if (!customer) {
                throw new NotFoundException(`Customer with ID ${customerMasterSid} not found.`);
            }

            creditRequestRows = await this._db.customerCreditRequest.findMany({
                where: { CustomerMasterSid: customerMasterSid },
                select: {
                    CustomerCreditRequestSid: true,
                    CustomerBranchSid: true,
                }
            });

            const creditRequestIds = creditRequestRows.map(
                (x) => x.CustomerCreditRequestSid
            );

            kycRows = creditRequestIds.length
                ? await this._db.customerKyc.findMany({
                    where: {
                        CustomerCreditRequestSid: { in: creditRequestIds }
                    },
                    select: {
                        CustomerKycSid: true,
                        CustomerCreditRequestSid: true,
                        CustomerBranchSid: true,
                        KycDocName: true,
                    }
                })
                : [];

            conditions = [
                ...(creditRequestRows.length
                    ? [{
                        tableName: 'CustomerCreditRequest',
                        recordId: {
                            in: creditRequestRows.map((x) =>
                                String(x.CustomerCreditRequestSid)
                            )
                        }
                    }]
                    : []),

                ...(kycRows.length
                    ? [{
                        tableName: 'CustomerKyc',
                        recordId: {
                            in: kycRows.map((x) =>
                                String(x.CustomerKycSid)
                            )
                        }
                    }]
                    : [])
            ];

            if (!conditions.length) {
                return [];
            }

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [branches, users] = await Promise.all([
                this._db.customerBranch.findMany({
                    select: {
                        CustomerBranchSid: true,
                        BranchName: true
                    }
                }),
                this._db.userMaster.findMany({
                    select: {
                        UserMasterSid: true,
                        userName: true
                    }
                }),
            ]);

            const branchMap = new Map<string, string>(
                branches.map((b) => [String(b.CustomerBranchSid), b.BranchName])
            );

            const salesmanMap = new Map<string, string>(
                users.map(u => [String(u.UserMasterSid), u.userName])
            );

            const creditRequestMap = new Map<string, string>(
                creditRequestRows.map((cr) => {
                    const branch =
                        branchMap.get(String(cr.CustomerBranchSid)) ||
                        String(cr.CustomerBranchSid || '').trim();

                    return [
                        String(cr.CustomerCreditRequestSid),
                        `Credit Request [${cr.CustomerCreditRequestSid} - ${branch}]`
                    ];
                })
            );

            const kycMap = new Map<string, string>(
                kycRows.map((kyc) => {
                    const branch =
                        branchMap.get(String(kyc.CustomerBranchSid)) ||
                        String(kyc.CustomerBranchSid || '').trim();

                    const doc = kyc.KycDocName?.toString().trim() || '';

                    return [
                        String(kyc.CustomerKycSid),
                        `KYC [${kyc.CustomerKycSid} -${branch}${doc ? ` - ${doc}` : ''}]`
                    ];
                })
            );

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const ignoredFields = [
                'UpdatedBy', 'UpdatedOn', 'CreatedBy', 'CreatedOn', 'AttachDocumentSid'
            ];

            const rowLabelMaps = {
                creditRequestMap,
                kycMap
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'SalesmanSid', 'Salesman', salesmanMap);
                this.replaceAndRename(newVal, 'SalesmanSid', 'Salesman', salesmanMap);

                this.replaceAndRename(oldVal, 'CustomerBranchSid', 'CustomerBranch', branchMap);
                this.replaceAndRename(newVal, 'CustomerBranchSid', 'CustomerBranch', branchMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getCreditRequestLabel(log.tableName),
                    rowLabel: this.getCreditRequestRowLabel(
                        log,
                        rowLabelMaps,
                        oldVal,
                        newVal
                    ),
                    oldVal,
                    newVal
                };
            });

            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getMasterJobRowLabel(
        log: any,
        rowLabelMaps: {
            containerMap: Map<string, string>;
            connectionMap: Map<string, string>;
            rateMap: Map<string, string>;
            activityMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'MasterJobConnection':
                return (
                    rowLabelMaps.connectionMap.get(recordId) ||
                    `Connection [${newVal.VesselName || oldVal.VesselName || recordId}]`
                );
            case 'MasterJobContainer':
                return (
                    rowLabelMaps.containerMap.get(recordId) ||
                    `Container [${newVal.ContainerNumber || oldVal.ContainerNumber || recordId}]`
                );
            case 'CostRevenueCharges':
                return (
                    rowLabelMaps.rateMap.get(recordId) ||
                    `Rate [${newVal.SerialNumber || oldVal.SerialNumber || recordId} - ${newVal.Charge || oldVal.Charge || ''}]`
                );
            case 'ContainerActivity':
                return (
                    rowLabelMaps.activityMap.get(recordId) ||
                    `Activity [${newVal.ActivityName || oldVal.ActivityName || recordId}]`
                );
            default:
                return null;
        }
    }

    private getMasterJobLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            MasterJob: 'Master',
            MasterJobVoyage: 'Master',
            MasterJobContainer: 'Container',
            MasterJobOthers: 'Others',
            MasterJobConnection: 'Connection',
            CostRevenueCharges: 'Rates',
            HouseJobCustoms: 'Customs',
            ContainerActivity: 'Container Activity'
        };
        return sectionMap[tableName] || tableName;
    }

    private async getMasterJobLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let containerRows: any[] = [];
            let connectionRows: any[] = [];
            let rateRows: any[] = [];
            let activityRows: any[] = [];

            const masterJobSid = Number(recordId);

            const [
                voyage,
                fetchedContainers,
                others,
                fetchedConnections,
                fetchedRates,
                customs,
                fetchedactivities
            ] = await Promise.all([
                this._db.masterJobVoyage.findMany({
                    where: { MasterJobSid: masterJobSid },
                    select: { MasterJobVoyageSid: true }
                }),
                this._db.masterJobContainer.findMany({
                    where: { MasterJobSid: masterJobSid },
                    select: {
                        MasterJobContainerSid: true,
                        ContainerNumber: true
                    }
                }),
                this._db.masterJobOthers.findMany({
                    where: { MasterJobSid: masterJobSid },
                    select: { MasterJobOthersSid: true }
                }),
                this._db.masterJobConnection.findMany({
                    where: { MasterJobSid: masterJobSid },
                    select: {
                        MasterJobConnectionSid: true,
                        VesselName: true
                    }
                }),
                this._db.costRevenueCharges.findMany({
                    where: { TransactionSid: masterJobSid },
                    select: {
                        CostRevenueChargesSid: true,
                        SerialNumber: true,
                        ChargeMasterSid: true
                    }
                }),
                this._db.houseJobCustoms.findMany({
                    where: { MasterJobSid: masterJobSid },
                    select: { HouseJobCustomsSid: true }
                }),
                this._db.containerActivity.findMany({
                    where: { JobMasterSid: masterJobSid },
                    select: {
                        ContainerActivitySid: true,
                        ActivityName: true
                    }
                })
            ]);
            containerRows = fetchedContainers;
            connectionRows = fetchedConnections;
            rateRows = fetchedRates;
            activityRows = fetchedactivities;

            conditions = [
                {
                    tableName: 'MasterJob',
                    recordId: recordId
                },
                {
                    tableName: 'MasterJobVoyage',
                    recordId: { in: voyage.map(x => String(x.MasterJobVoyageSid)) }
                },
                ...(containerRows.length
                    ? [{
                        tableName: 'MasterJobContainer',
                        recordId: { in: containerRows.map(x => String(x.MasterJobContainerSid)) }
                    }]
                    : []),
                {
                    tableName: 'MasterJobOthers',
                    recordId: { in: others.map(x => String(x.MasterJobOthersSid)) }
                },
                ...(connectionRows.length
                    ? [{
                        tableName: 'MasterJobConnection',
                        recordId: { in: connectionRows.map(x => String(x.MasterJobConnectionSid)) }
                    }]
                    : []),
                ...(rateRows.length
                    ? [{
                        tableName: 'CostRevenueCharges',
                        recordId: { in: rateRows.map(x => String(x.CostRevenueChargesSid)) }
                    }]
                    : []),
                {
                    tableName: 'HouseJobCustoms',
                    recordId: { in: customs.map(x => String(x.HouseJobCustomsSid)) }
                },
                ...(activityRows.length
                    ? [{
                        tableName: 'ContainerActivity',
                        recordId: { in: activityRows.map(x => String(x.ContainerActivitySid)) }
                    }]
                    : []),
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [departments, charges, customers, uoms, currencies, voucher, vouchertype, container] = await Promise.all([
                this._db.departmentMaster.findMany({
                    select: {
                        DepartmentMasterSid: true,
                        departmentName: true
                    }
                }),
                this._db.chargeMaster.findMany({
                    select: {
                        ChargeMasterSid: true,
                        chargeCode: true
                    }
                }),
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                }),
                this._db.uOMMaster.findMany({
                    select: {
                        UOMMasterSid: true,
                        UOMCode: true,
                        UOMName: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
                this._db.voucherHeader.findMany({
                    select: {
                        VoucherHeaderSid: true,
                        VoucherNumber: true
                    }
                }),
                this._db.voucherTypeMaster.findMany({
                    select: {
                        VoucherTypeMasterSid: true,
                        DocumentTypeName: true
                    }
                }),
                this._db.containerTypeMaster.findMany({
                    select: {
                        ContainerTypeMasterSid: true,
                        ContainerName: true
                    }
                })
            ]);

            const departmentMap = new Map<string, string>(
                departments.map(d => [String(d.DepartmentMasterSid), d.departmentName])
            );

            const chargeMap = new Map<string, string>(
                charges.map(c => [String(c.ChargeMasterSid), c.chargeCode])
            );

            const customerMap = new Map<string, string>(
                customers.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            );

            const uomMap = new Map<string, string>(
                uoms.map(c => [String(c.UOMMasterSid), c.UOMName])
            );

            const umMap = new Map<string, string>(
                uoms.map(c => [String(c.UOMMasterSid), c.UOMCode])
            );

            const currencyMap = new Map<string, string>(
                currencies.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const voucherMap = new Map<string, string>(
                voucher.map(c => [String(c.VoucherHeaderSid), c.VoucherNumber])
            );

            const voucherTypeMap = new Map<string, string>(
                vouchertype.map(c => [String(c.VoucherTypeMasterSid), c.DocumentTypeName])
            );

            const containerTypeMap = new Map<string, string>(
                container.map(c => [String(c.ContainerTypeMasterSid), c.ContainerName])
            );

            const containerMap = new Map<string, string>(
                containerRows.map((c) => [
                    String(c.MasterJobContainerSid),
                    `Container [${c.ContainerNumber?.toString().trim() || c.MasterJobContainerSid}]`
                ])
            );

            const connectionMap = new Map<string, string>(
                connectionRows.map((co) => [
                    String(co.MasterJobConnectionSid),
                    `Connection [${co.VesselName?.toString().trim() || co.MasterJobConnectionSid}]`
                ])
            );

            const rateMap = new Map<string, string>(
                rateRows.map((r) => {
                    const serial = r.SerialNumber?.toString().trim() || r.CostRevenueChargesSid;
                    const charge = chargeMap.get(String(r.ChargeMasterSid)) || r.ChargeMasterSid || '';
                    const label = charge ? `Rate [${serial} - ${charge}]` : `Rate [${serial}]`;
                    return [
                        String(r.CostRevenueChargesSid),
                        label
                    ];
                })
            );

            const activityMap = new Map<string, string>(
                activityRows.map((a) => [
                    String(a.ContainerActivitySid),
                    `Activity [${a.ActivityName?.toString().trim() || a.ContainerActivitySid}]`
                ])
            );

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const custom = {
                NCV: 'No Commercial Value',
                DVC: 'Declared value for Customs'
            };

            const carriage = {
                NVD: 'No value declared',
                DVC: 'Declared value for Carriage',
            };

            const cargocode = {
                F: 'FCL Container',
                L: 'LCL Container',
                M: 'Empty Container',
                B: 'Bulk Solid',
                Q: 'Bulk Liquid',
                R: 'RO-RO Unit',
                P: 'Passenger',
                G: 'General Cargo (Break Bulk)',
            }

            const un = {
                U: 'Used',
                N: 'New'
            }

            const storagerequest = {
                D: 'Direct Delivery',
                S: 'Storage in Sheds',
                Y: 'Storage in Yards',
            }

            const temp = {
                F: 'Fahrenheit',
                C: 'Celsius',
            }

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'UpdatedOn', 'CreatedBy', 'CreatedOn', 'UpdatedBy',
                'VoyageMasterSid', 'CustomerBranchSid', 'CustomerMasterSid', 'CostAgentBranchSid', 'RevenueCustomerBranchSid',
            ];

            const rowLabelMaps = {
                containerMap,
                connectionMap,
                rateMap,
                activityMap
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'DepartmentMasterSid', 'Department', departmentMap);
                this.replaceAndRename(newVal, 'DepartmentMasterSid', 'Department', departmentMap);

                this.replaceAndRename(oldVal, 'ChargeMasterSid', 'Charge', chargeMap);
                this.replaceAndRename(newVal, 'ChargeMasterSid', 'Charge', chargeMap);

                this.replaceAndRename(oldVal, 'ChargeUomSid', 'ChargeUom', umMap);
                this.replaceAndRename(newVal, 'ChargeUomSid', 'ChargeUom', umMap);

                this.replaceAndRename(oldVal, 'RevenueChargeUomSid', 'RevenueChargeUom', umMap);
                this.replaceAndRename(newVal, 'RevenueChargeUomSid', 'RevenueChargeUom', umMap);

                this.replaceAndRename(oldVal, 'CostChargeUomSid', 'CostChargeUom', umMap);
                this.replaceAndRename(newVal, 'CostChargeUomSid', 'CostChargeUom', umMap);

                this.replaceAndRename(oldVal, 'DestinationAgent', 'DestinationAgent', customerMap);
                this.replaceAndRename(newVal, 'DestinationAgent', 'DestinationAgent', customerMap);

                this.replaceAndRename(oldVal, 'CarrierSid', 'Carrier', customerMap);
                this.replaceAndRename(newVal, 'CarrierSid', 'Carrier', customerMap);

                this.replaceAndRename(oldVal, 'OriginAgent', 'OriginAgent', customerMap);
                this.replaceAndRename(newVal, 'OriginAgent', 'OriginAgent', customerMap);

                this.replaceAndRename(oldVal, 'CFS', 'CFS', customerMap);
                this.replaceAndRename(newVal, 'CFS', 'CFS', customerMap);

                this.replaceAndRename(oldVal, 'Yard', 'Yard', customerMap);
                this.replaceAndRename(newVal, 'Yard', 'Yard', customerMap);

                this.replaceAndRename(oldVal, 'ContainerType', 'ContainerType', containerTypeMap);
                this.replaceAndRename(newVal, 'ContainerType', 'ContainerType', containerTypeMap);

                this.replaceAndRename(oldVal, 'PkgType', 'PackageType', uomMap);
                this.replaceAndRename(newVal, 'PkgType', 'PackageType', uomMap);

                this.replaceAndRename(oldVal, 'RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap);
                this.replaceAndRename(newVal, 'RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap);

                this.replaceAndRename(oldVal, 'CostCurrencyMasterSid', 'CostCurrency', currencyMap);
                this.replaceAndRename(newVal, 'CostCurrencyMasterSid', 'CostCurrency', currencyMap);

                this.replaceAndRename(oldVal, 'RevenueCustomerMasterSid', 'BillingParty', customerMap);
                this.replaceAndRename(newVal, 'RevenueCustomerMasterSid', 'BillingParty', customerMap);

                this.replaceAndRename(oldVal, 'CostAgentMasterSid', 'Party', customerMap);
                this.replaceAndRename(newVal, 'CostAgentMasterSid', 'Party', customerMap);

                this.replaceAndRename(oldVal, 'RevenueVoucherHeaderSid', 'VoucherNo', voucherMap);
                this.replaceAndRename(newVal, 'RevenueVoucherHeaderSid', 'VoucherNo', voucherMap);

                this.replaceAndRename(oldVal, 'RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap);
                this.replaceAndRename(newVal, 'RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap);

                this.replaceAndRename(oldVal, 'CostVoucherHeaderSid', 'VoucherNo', voucherMap);
                this.replaceAndRename(newVal, 'CostVoucherHeaderSid', 'VoucherNo', voucherMap);

                this.replaceAndRename(oldVal, 'CostVoucherTypeMasterSid', 'Type', voucherTypeMap);
                this.replaceAndRename(newVal, 'CostVoucherTypeMasterSid', 'Type', voucherTypeMap);

                this.replaceValueFromMap(oldVal, 'IsHaz', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsHaz', yesNoMap);

                this.replaceValueFromMap(oldVal, 'Haz', yesNoMap);
                this.replaceValueFromMap(newVal, 'Haz', yesNoMap);

                this.replaceValueFromMap(oldVal, 'IsSoc', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsSoc', yesNoMap);

                this.replaceValueFromMap(oldVal, 'Coload', yesNoMap);
                this.replaceValueFromMap(newVal, 'Coload', yesNoMap);

                this.replaceValueFromMap(oldVal, 'ExportToImport', yesNoMap);
                this.replaceValueFromMap(newVal, 'ExportToImport', yesNoMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.replaceValueFromMap(oldVal, 'DeclaredValueOfCustoms', custom);
                this.replaceValueFromMap(newVal, 'DeclaredValueOfCustoms', custom);

                this.replaceValueFromMap(oldVal, 'DeclaredValueOfCarriage', carriage);
                this.replaceValueFromMap(newVal, 'DeclaredValueOfCarriage', carriage);

                this.replaceValueFromMap(oldVal, 'CargoCode', cargocode);
                this.replaceValueFromMap(newVal, 'CargoCode', cargocode);

                this.replaceValueFromMap(oldVal, 'UsedOrNew', un);
                this.replaceValueFromMap(newVal, 'UsedOrNew', un);

                this.replaceValueFromMap(oldVal, 'StorageRequest', storagerequest);
                this.replaceValueFromMap(newVal, 'StorageRequest', storagerequest);

                this.replaceValueFromMap(oldVal, 'HazStorageRequest', storagerequest);
                this.replaceValueFromMap(newVal, 'HazStorageRequest', storagerequest);

                this.replaceValueFromMap(oldVal, 'RefTemperatureUnit', temp);
                this.replaceValueFromMap(newVal, 'RefTemperatureUnit', temp);

                this.replaceValueFromMap(oldVal, 'TemperatureUnit', temp);
                this.replaceValueFromMap(newVal, 'TemperatureUnit', temp);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getMasterJobLabel(log.tableName),
                    rowLabel: this.getMasterJobRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getQuoteRowLabel(
        log: any,
        rowLabelMaps: {
            routeMap: Map<string, string>;
            carrierMap: Map<string, string>;
            productMap: Map<string, string>;
            chargeMap: Map<string, string>;
            cargoMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');

        switch (log.tableName) {

            case 'QuoteRoute':
                return (
                    rowLabelMaps.routeMap.get(recordId) ||
                    `Route [${newVal.segmentType || oldVal.segmentType || recordId}]`
                );

            case 'QuoteCarrier':
                return (
                    rowLabelMaps.carrierMap.get(recordId) ||
                    `Carrier [${newVal.CarrierName || oldVal.CarrierName || recordId}]`
                );

            case 'QuoteCharge':
                return (
                    rowLabelMaps.chargeMap.get(recordId) ||
                    `Charge [${newVal.Charge || oldVal.Charge || recordId}]`
                );

            case 'QuoteCargo':
                return (
                    rowLabelMaps.cargoMap.get(recordId) ||
                    `Cargo [${newVal.CargoType || oldVal.CargoType || recordId}]`
                );

            case 'QuoteProduct':
                return (
                    rowLabelMaps.productMap.get(recordId) ||
                    `Product [${newVal.ProductName || oldVal.ProductName || recordId}]`
                );
            default:
                return null;
        }
    }

    private getQuoteLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            QuoteHeader: 'Quotation',
            QuoteRoute: 'Route Details',
            QuoteCarrier: 'Carrier Details',
            QuoteCargo: 'Cargo Details',
            QuoteProduct: 'Product Details',
            QuoteCharge: 'Charge Details',
        };

        return sectionMap[tableName] || tableName;
    }

    private async getQuoteLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let routeRows: any[] = [];
            let carrierRows: any[] = [];
            let cargoRows: any[] = [];
            let productRows: any[] = [];
            let chargeRows: any[] = [];

            const quoteHeaderSid = Number(recordId);

            const [
                route,
                carrier,
                cargo,
                product,
                charge
            ] = await Promise.all([
                this._db.quoteRoute.findMany({
                    where: { QuoteHeaderSid: quoteHeaderSid },
                    select: {
                        QuoteRouteSid: true,
                        segmentType: true,
                        POLSid: true,
                        PODSid: true,
                    }
                }),
                this._db.quoteCarrier.findMany({
                    where: { QuoteHeaderSid: quoteHeaderSid },
                    select: {
                        QuoteCarrierSid: true,
                        QuoteRouteSid: true,
                        CarrierName: true,
                    }
                }),
                this._db.quoteCargo.findMany({
                    where: { QuoteHeaderSid: quoteHeaderSid },
                    select: {
                        QuoteCargoSid: true,
                        QuoteRouteSid: true,
                        CargoType: true,
                    }
                }),
                this._db.quoteProduct.findMany({
                    where: { QuoteHeaderSid: quoteHeaderSid },
                    select: {
                        QuoteProductSid: true,
                        QuoteCargoSid: true,
                        ProductName: true,
                    }
                }),
                this._db.quoteCharge.findMany({
                    where: { QuoteHeaderSid: quoteHeaderSid },
                    select: {
                        QuoteChargeSid: true,
                        QuoteRouteSid: true,
                        QuoteCarrierSid: true,
                        ChargeUomSid: true,
                    }
                }),
            ]);

            routeRows = route;
            carrierRows = carrier;
            chargeRows = charge;
            cargoRows = cargo;
            productRows = product;

            conditions = [
                {
                    tableName: 'QuoteHeader',
                    recordId: recordId
                },
                ...(routeRows.length
                    ? [{
                        tableName: 'QuoteRoute',
                        recordId: { in: routeRows.map(x => String(x.QuoteRouteSid)) }
                    }]
                    : []),
                ...(carrierRows.length
                    ? [{
                        tableName: 'QuoteCarrier',
                        recordId: { in: carrierRows.map(x => String(x.QuoteCarrierSid)) }
                    }]
                    : []),
                ...(chargeRows.length
                    ? [{
                        tableName: 'QuoteCharge',
                        recordId: { in: chargeRows.map(x => String(x.QuoteChargeSid)) }
                    }]
                    : []),
                ...(cargoRows.length
                    ? [{
                        tableName: 'QuoteCargo',
                        recordId: { in: cargoRows.map(x => String(x.QuoteCargoSid)) }
                    }]
                    : []),
                ...(productRows.length
                    ? [{
                        tableName: 'QuoteProduct',
                        recordId: { in: productRows.map(x => String(x.QuoteProductSid)) }
                    }]
                    : []),
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [ports, customer, users, charges, uoms, currencies] = await Promise.all([
                this._db.portMaster.findMany({
                    select: {
                        PortMasterSid: true,
                        PortCode: true
                    }
                }),
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                }),
                this._db.userMaster.findMany({
                    select: {
                        UserMasterSid: true,
                        userName: true
                    }
                }),
                this._db.chargeMaster.findMany({
                    select: {
                        ChargeMasterSid: true,
                        chargeCode: true,
                    }
                }),
                this._db.uOMMaster.findMany({
                    select: {
                        UOMMasterSid: true,
                        UOMCode: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
            ]);

            const portMap = new Map<string, string>(
                ports.map(p => [String(p.PortMasterSid), p.PortCode])
            );

            const customerMap = new Map<string, string>(
                customer.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            );

            const salesmanMap = new Map<string, string>(
                users.map(u => [String(u.UserMasterSid), u.userName])
            );

            const chargesMap = new Map<string, string>(
                charges.map(c => [String(c.ChargeMasterSid), c.chargeCode])
            );

            const uomMap = new Map<string, string>(
                uoms.map(c => [String(c.UOMMasterSid), c.UOMCode])
            );

            const currencyMap = new Map<string, string>(
                currencies.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const routeMap = new Map<string, string>(
                routeRows.map((r) => {
                    const pol = portMap.get(String(r.POLSid)) || String(r.POLSid || '-');
                    const pod = portMap.get(String(r.PODSid)) || String(r.PODSid || '-');
                    const segment = r.segmentType?.toString().trim() || 'Route';

                    return [
                        String(r.QuoteRouteSid),
                        `Route ${segment} [${pol} - ${pod}]`
                    ];
                })
            );

            const carrierMap = new Map<string, string>(
                carrierRows.map((c) => {
                    const routeLabel =
                        routeMap.get(String(c.QuoteRouteSid)) ||
                        `[${c.QuoteRouteSid}]`;
                    const carrier =
                        c.CarrierName?.toString().trim() ||
                        customerMap.get(String(c.CarrierMasterSid)) ||
                        String(c.QuoteCarrierSid);
                    return [
                        String(c.QuoteCarrierSid),
                        `Carrier [${routeLabel} - ${carrier}]`
                    ];
                })
            );

            const cargoMap = new Map<string, string>(
                cargoRows.map((c) => {
                    const routeLabel =
                        routeMap.get(String(c.QuoteRouteSid)) ||
                        `[${c.QuoteRouteSid}]`;

                    const cargoType =
                        c.CargoType?.toString().trim() ||
                        String(c.QuoteCargoSid);

                    return [
                        String(c.QuoteCargoSid),
                        `Cargo [${routeLabel} - ${cargoType}]`
                    ];
                })
            );

            const productMap = new Map<string, string>(
                productRows.map((p) => {
                    const cargoLabel =
                        cargoMap.get(String(p.QuoteCargoSid)) ||
                        `[${p.QuoteCargoSid}]`;
                    const productLabel =
                        p.ProductName?.toString().trim() || `[${p.QuoteProductSid}]`;
                    return [
                        String(p.QuoteProductSid),
                        `Product [${cargoLabel} - ${productLabel}]`
                    ];
                })
            );

            const chargeMap = new Map<string, string>(
                chargeRows.map((c) => {
                    const routeLabel =
                        routeMap.get(String(c.QuoteRouteSid)) ||
                        `Route [${c.QuoteRouteSid}]`;

                    const carrierName = c.QuoteCarrierSid
                        ? (
                            carrierRows.find(x => String(x.QuoteCarrierSid) === String(c.QuoteCarrierSid))?.CarrierName?.toString().trim() ||
                            `Carrier ${c.QuoteCarrierSid}`
                        )
                        : null;

                    const chargeName =
                        chargesMap.get(String(c.ChargeUomSid)) ||
                        String(c.QuoteChargeSid);

                    const label = carrierName
                        ? `Charge [${routeLabel} - ${carrierName} - ${chargeName}]`
                        : `Charge [${routeLabel} - ${chargeName}]`;

                    return [
                        String(c.QuoteChargeSid),
                        label
                    ];
                })
            );

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy',
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy',
                'CostAgentBranchSid', 'RevenueCustomerBranchSid', 'BookingHeaderSid'
            ];

            const rowLabelMaps = {
                routeMap,
                carrierMap,
                cargoMap,
                chargeMap,
                productMap,
            };

            const formattedLogs = logs.map((logs: any) => {
                const oldVal = { ...(logs.oldVal || {}) };
                const newVal = { ...(logs.newVal || {}) };

                this.replaceAndRename(oldVal, 'SalesmanSid', 'Salesman', salesmanMap);
                this.replaceAndRename(newVal, 'SalesmanSid', 'Salesman', salesmanMap);

                this.replaceAndRename(oldVal, 'POLSid', 'POL', portMap);
                this.replaceAndRename(newVal, 'POLSid', 'POL', portMap);

                this.replaceAndRename(oldVal, 'PODSid', 'POD', portMap);
                this.replaceAndRename(newVal, 'PODSid', 'POD', portMap);

                this.replaceAndRename(oldVal, 'ChargeUomSid', 'Charge', chargesMap);
                this.replaceAndRename(newVal, 'ChargeUomSid', 'Charge', chargesMap);

                this.replaceAndRename(oldVal, 'CostChargeUomSid', 'CostChargeUom', uomMap);
                this.replaceAndRename(newVal, 'CostChargeUomSid', 'CostChargeUom', uomMap);

                this.replaceAndRename(oldVal, 'RevenueChargeUomSid', 'RevenueChargeUom', uomMap);
                this.replaceAndRename(newVal, 'RevenueChargeUomSid', 'RevenueChargeUom', uomMap);

                this.replaceAndRename(oldVal, 'CostAgentMasterSid', 'Party', customerMap);
                this.replaceAndRename(newVal, 'CostAgentMasterSid', 'Party', customerMap);

                this.replaceAndRename(oldVal, 'RevenueCustomerMasterSid', 'BillingParty', customerMap);
                this.replaceAndRename(newVal, 'RevenueCustomerMasterSid', 'BillingParty', customerMap);

                this.replaceAndRename(oldVal, 'RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap);
                this.replaceAndRename(newVal, 'RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap);

                this.replaceAndRename(oldVal, 'CostCurrencyMasterSid', 'CostCurrency', currencyMap);
                this.replaceAndRename(newVal, 'CostCurrencyMasterSid', 'CostCurrency', currencyMap);

                this.replaceValueFromMap(oldVal, 'IsContract', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsContract', yesNoMap);

                this.replaceValueFromMap(oldVal, 'AgreedRate', yesNoMap);
                this.replaceValueFromMap(newVal, 'AgreedRate', yesNoMap);

                this.replaceValueFromMap(oldVal, 'RateLock', yesNoMap);
                this.replaceValueFromMap(newVal, 'RateLock', yesNoMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...logs,
                    sectionLabel: this.getQuoteLabel(logs.tableName),
                    rowLabel: this.getQuoteRowLabel(logs, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getEnquiryRowLabel(
        log: any,
        rowLabelMaps: {
            routeMap: Map<string, string>;
            cargoMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');

        switch (log.tableName) {
            case 'EnquiryRoute':
                return (
                    rowLabelMaps.routeMap.get(recordId) ||
                    `Route [${recordId}]`
                );

            case 'EnquiryCargo':
                return (
                    rowLabelMaps.cargoMap.get(recordId) ||
                    `Cargo [${newVal.ProductName || oldVal.ProductName || recordId}]`
                );

            default:
                return null;
        }
    }

    private getEnquiryLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            EnquiryHeader: 'Enquiry',
            EnquiryRoute: 'Route Details',
            EnquiryCargo: 'Cargo Details',
        };

        return sectionMap[tableName] || tableName;
    }

    private async getEnquiryLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let routeRows: any[] = [];
            let cargoRows: any[] = [];

            const enquiryHeaderSid = Number(recordId);

            const [
                route,
                cargo,
                other
            ] = await Promise.all([
                this._db.enquiryRoute.findMany({
                    where: { EnquiryHeaderSid: enquiryHeaderSid },
                    select: {
                        EnquiryRouteSid: true,
                        POLSid: true,
                        PODSid: true,
                        DepartmentMasterSid: true,
                    }
                }),
                this._db.enquiryCargo.findMany({
                    where: { EnquiryHeaderSid: enquiryHeaderSid },
                    select: {
                        EnquiryCargoSid: true,
                        EnquiryRouteSid: true,
                        ProductName: true,
                    }
                }),
                this._db.enquiryOther.findMany({
                    where: { EnquiryHeaderSid: enquiryHeaderSid },
                    select: {
                        EnquiryOtherSid: true,
                    }
                }),
            ]);

            routeRows = route;
            cargoRows = cargo;

            conditions = [
                {
                    tableName: 'EnquiryHeader',
                    recordId: recordId
                },
                ...(routeRows.length
                    ? [{
                        tableName: 'EnquiryRoute',
                        recordId: { in: routeRows.map(x => String(x.EnquiryRouteSid)) }
                    }]
                    : []),
                ...(cargoRows.length
                    ? [{
                        tableName: 'EnquiryCargo',
                        recordId: { in: cargoRows.map(x => String(x.EnquiryCargoSid)) }
                    }]
                    : []),
                {
                    tableName: 'EnquiryOther',
                    recordId: { in: other.map(x => String(x.EnquiryOtherSid)) }
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [
                ports,
                customers,
                users,
                departments,
                uoms,
            ] = await Promise.all([
                this._db.portMaster.findMany({
                    select: {
                        PortMasterSid: true,
                        PortCode: true,
                    }
                }),
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                }),
                this._db.userMaster.findMany({
                    select: {
                        UserMasterSid: true,
                        userName: true
                    }
                }),
                this._db.departmentMaster.findMany({
                    select: {
                        DepartmentMasterSid: true,
                        departmentName: true
                    }
                }),
                this._db.uOMMaster.findMany({
                    select: {
                        UOMMasterSid: true,
                        UOMCode: true
                    }
                }),
            ]);

            const portMap = new Map<string, string>(
                ports.map(p => [
                    String(p.PortMasterSid),
                    p.PortCode?.toString().trim() || String(p.PortMasterSid)
                ])
            );

            const customerMap = new Map<string, string>(
                customers.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            );

            const userMap = new Map<string, string>(
                users.map(u => [String(u.UserMasterSid), u.userName])
            );

            const departmentMap = new Map<string, string>(
                departments.map(d => [String(d.DepartmentMasterSid), d.departmentName])
            );

            const uomMap = new Map<string, string>(
                uoms.map(u => [String(u.UOMMasterSid), u.UOMCode])
            );

            const routeMap = new Map<string, string>(
                routeRows.map((r) => {
                    const pol = portMap.get(String(r.POLSid)) || String(r.POLSid || '-');
                    const pod = portMap.get(String(r.PODSid)) || String(r.PODSid || '-');

                    return [
                        String(r.EnquiryRouteSid),
                        `Route [${pol} - ${pod}]`
                    ];
                })
            );

            const cargoMap = new Map<string, string>(
                cargoRows.map((c) => {
                    const routeLabel =
                        routeMap.get(String(c.EnquiryRouteSid)) ||
                        `Route [${c.EnquiryRouteSid || '-'}]`;

                    const product =
                        c.ProductName?.toString().trim();

                    const label = product
                        ? `Cargo [${routeLabel} - ${product}]`
                        : `Cargo [${routeLabel}]`;

                    return [
                        String(c.EnquiryCargoSid),
                        label
                    ];
                })
            );


            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const leadCustomerMap = {
                L: 'Lead',
                C: 'Customer'
            };


            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'QuoteHeaderSid',
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy',
            ];

            const rowLabelMaps = {
                routeMap,
                cargoMap,
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'DepartmentMasterSid', 'Department', departmentMap);
                this.replaceAndRename(newVal, 'DepartmentMasterSid', 'Department', departmentMap);

                this.replaceAndRename(oldVal, 'CustomerMasterSid', 'Customer', customerMap);
                this.replaceAndRename(newVal, 'CustomerMasterSid', 'Customer', customerMap);

                this.replaceAndRename(oldVal, 'AgentMasterSid', 'Agent', customerMap);
                this.replaceAndRename(newVal, 'AgentMasterSid', 'Agent', customerMap);

                this.replaceAndRename(oldVal, 'Carrier', 'Carrier', customerMap);
                this.replaceAndRename(newVal, 'Carrier', 'Carrier', customerMap);

                this.replaceAndRename(oldVal, 'UserMasterSid', 'User', userMap);
                this.replaceAndRename(newVal, 'UserMasterSid', 'User', userMap);

                this.replaceAndRename(oldVal, 'WeightUnitSid', 'UOM', uomMap);
                this.replaceAndRename(newVal, 'WeightUnitSid', 'UOM', uomMap);

                this.replaceAndRename(oldVal, 'PORSid', 'POR', portMap);
                this.replaceAndRename(newVal, 'PORSid', 'POR', portMap);

                this.replaceAndRename(oldVal, 'POLSid', 'POL', portMap);
                this.replaceAndRename(newVal, 'POLSid', 'POL', portMap);

                this.replaceAndRename(oldVal, 'PODSid', 'POD', portMap);
                this.replaceAndRename(newVal, 'PODSid', 'POD', portMap);

                this.replaceAndRename(oldVal, 'FDPSid', 'FPOD', portMap);
                this.replaceAndRename(newVal, 'FDPSid', 'FPOD', portMap);

                this.replaceValueFromMap(oldVal, 'LeadOrCustomer', leadCustomerMap);
                this.replaceValueFromMap(newVal, 'LeadOrCustomer', leadCustomerMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getEnquiryLabel(log.tableName),
                    rowLabel: this.getEnquiryRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });

            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getVoucherMatchingRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');

        switch (log.tableName) {
            case 'MatchingDetail':
                return (
                    rowLabelMaps.detailMap.get(recordId) ||
                    `Detail [${newVal.SourceVoucherNo || oldVal.SourceVoucherNo || recordId}]`
                );

            default:
                return null;
        }
    }

    private getVoucherMatchingLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            VoucherMatchingHeader: 'Voucher Matching',
            MatchingDetail: 'Matching Details',
        };

        return sectionMap[tableName] || tableName;
    }

    private async getVoucherMatchingLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let detailRows: any[] = [];

            const voucherMatchingHeaderSid = Number(recordId);

            const [
                header,
                details
            ] = await Promise.all([
                this._db.voucherMatchingHeader.findUnique({
                    where: { VoucherMatchingHeaderSid: voucherMatchingHeaderSid },
                    select: {
                        VoucherMatchingHeaderSid: true,
                        VoucherHeaderSid: true,
                    }
                }),
                this._db.matchingDetail.findMany({
                    where: { VoucherMatchingHeaderSid: voucherMatchingHeaderSid },
                    select: {
                        MatchingDetailSid: true,
                        VoucherMatchingHeaderSid: true,
                        MatchingType: true,
                        VoucherType: true,
                        Sno: true,
                        VoucherHeaderSid: true,
                    }
                }),
            ]);

            detailRows = details;

            conditions = [
                {
                    tableName: 'VoucherMatchingHeader',
                    recordId: String(recordId)
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'MatchingDetail',
                        recordId: { in: detailRows.map(x => String(x.MatchingDetailSid)) }
                    }]
                    : [])
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [
                vouchers,
                voucherTypes,
                currencies,
                coaMasters,
                subledgers
            ] = await Promise.all([
                this._db.voucherHeader.findMany({
                    select: {
                        VoucherHeaderSid: true,
                        VoucherNumber: true
                    }
                }),
                this._db.voucherTypeMaster.findMany({
                    select: {
                        VoucherTypeMasterSid: true,
                        DocumentTypeName: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
                this._db.cOAMaster.findMany({
                    select: {
                        COAMasterSid: true,
                        LedgerName: true
                    }
                }),
                this._db.subledgerMaster.findMany({
                    select: {
                        SubledgerMasterSid: true,
                        SubledgerName: true
                    }
                })
            ]);

            const voucherMap = new Map<string, string>(
                vouchers.map(v => [String(v.VoucherHeaderSid), v.VoucherNumber])
            );

            const voucherTypeMap = new Map<string, string>(
                voucherTypes.map((v: any) => [String(v.VoucherTypeMasterSid), v.DocumentTypeName])
            );

            const currencyMap = new Map<string, string>(
                currencies.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const coaMap = new Map<string, string>(
                coaMasters.map((c: any) => [String(c.COAMasterSid), c.LedgerName])
            );

            const subledgerMap = new Map<string, string>(
                subledgers.map((s: any) => [String(s.SubledgerMasterSid), s.SubledgerName])
            );

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const voucherNo =
                        d.VoucherNumber?.toString().trim() ||
                        voucherMap.get(String(d.VoucherHeaderSid)) ||
                        String(d.MatchingDetailSid);

                    const voucherType =
                        d.VoucherType?.toString().trim() || '';

                    const matchingType =
                        d.MatchingType?.toString().trim() || '';

                    const label =
                        matchingType
                            ? `Detail [${voucherNo} - ${voucherType} - ${matchingType}]`
                            : voucherType
                                ? `Detail [${voucherNo} - ${voucherType}]`
                                : `Detail [${voucherNo}]`;

                    return [String(d.MatchingDetailSid), label];
                })
            );

            const postStatusMap = {
                P: 'Posted',
                U: 'Unposted'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const matchingTypeMap = {
                Source: 'Source',
                Object: 'Object'
            };

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy',
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy',
                'CompanyMasterSid', 'BranchMasterSid',
                'VoucherMatchingHeaderSid', 'MatchingDetailSid',
                'VoucherDetailSid', 'VoucherTransactionSid', 'VoucherHeaderSid'
            ];

            const rowLabelMaps = {
                detailMap
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };


                this.replaceAndRename(oldVal, 'CurrencyMasterSid', 'Currency', currencyMap);
                this.replaceAndRename(newVal, 'CurrencyMasterSid', 'Currency', currencyMap);

                this.replaceAndRename(oldVal, 'MatchingCurrency', 'MatchingCurrency', currencyMap);
                this.replaceAndRename(newVal, 'MatchingCurrency', 'MatchingCurrency', currencyMap);

                this.replaceAndRename(oldVal, 'COAMasterSid', 'Ledger', coaMap);
                this.replaceAndRename(newVal, 'COAMasterSid', 'Ledger', coaMap);

                this.replaceAndRename(oldVal, 'SubledgerMasterSid', 'Subledger', subledgerMap);
                this.replaceAndRename(newVal, 'SubledgerMasterSid', 'Subledger', subledgerMap);

                this.replaceAndRename(oldVal, 'SourceVoucherHeaderSid', 'Voucher', voucherMap);
                this.replaceAndRename(newVal, 'SourceVoucherHeaderSid', 'Voucher', voucherMap);

                this.replaceValueFromMap(oldVal, 'PostStatus', postStatusMap);
                this.replaceValueFromMap(newVal, 'PostStatus', postStatusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'MatchingType', matchingTypeMap);
                this.replaceValueFromMap(newVal, 'MatchingType', matchingTypeMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getVoucherMatchingLabel(log.tableName),
                    rowLabel: this.getVoucherMatchingRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });

            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getdoctypeLogs(recordId?: string) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'VoucherTypeMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [coa] = await Promise.all([
                this._db.cOAMaster.findMany({
                    select: {
                        COAMasterSid: true,
                        LedgerName: true
                    }
                })
            ])

            const coaMap = new Map<string, string>(
                coa.map(c => [String(c.COAMasterSid), c.LedgerName ?? ''])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy',
            ];

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'COALedger', 'COALedger', coaMap);
                this.replaceAndRename(newVal, 'COALedger', 'COALedger', coaMap);

                this.replaceValueFromMap(oldVal, 'BranchFlag', yesNoMap);
                this.replaceValueFromMap(newVal, 'BranchFlag', yesNoMap);

                this.replaceValueFromMap(oldVal, 'CompanyFlag', yesNoMap);
                this.replaceValueFromMap(newVal, 'CompanyFlag', yesNoMap);

                this.replaceValueFromMap(oldVal, 'DocumentFlag', yesNoMap);
                this.replaceValueFromMap(newVal, 'DocumentFlag', yesNoMap);

                this.replaceValueFromMap(oldVal, 'MonthFlag', yesNoMap);
                this.replaceValueFromMap(newVal, 'MonthFlag', yesNoMap);

                this.replaceValueFromMap(oldVal, 'YearFlag', yesNoMap);
                this.replaceValueFromMap(newVal, 'YearFlag', yesNoMap);

                this.replaceValueFromMap(oldVal, 'IsAutoPosting', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsAutoPosting', yesNoMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getnumberseriesLogs(recordId?: string) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'NumberSeriesConfig',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy',
            ];

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'CompanyFlagRequired', yesNoMap);
                this.replaceValueFromMap(newVal, 'CompanyFlagRequired', yesNoMap);

                this.replaceValueFromMap(oldVal, 'BranchFlagRequired', yesNoMap);
                this.replaceValueFromMap(newVal, 'BranchFlagRequired', yesNoMap);

                this.replaceValueFromMap(oldVal, 'DepartmentCodeRequired', yesNoMap);
                this.replaceValueFromMap(newVal, 'DepartmentCodeRequired', yesNoMap);

                this.replaceValueFromMap(oldVal, 'MonthFlagRequired', yesNoMap);
                this.replaceValueFromMap(newVal, 'MonthFlagRequired', yesNoMap);

                this.replaceValueFromMap(oldVal, 'YearFlagRequired', yesNoMap);
                this.replaceValueFromMap(newVal, 'YearFlagRequired', yesNoMap);

                this.replaceValueFromMap(oldVal, 'DepartmentWiseCounter', yesNoMap);
                this.replaceValueFromMap(newVal, 'DepartmentWiseCounter', yesNoMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    async createManualAuditLog(payload: {
        tableName: string;
        recordId?: string;
        operation: string;
        changedBy?: string;
        changes?: any;
        oldVal?: any;
        newVal?: any;
    }) {
        try {
            return await this._db.auditLog.create({
                data: {
                    tableName: payload.tableName,
                    recordId: payload.recordId,
                    operation: payload.operation,
                    changedBy: payload.changedBy,
                    changes: payload.changes ?? null,
                    oldVal: payload.oldVal ?? null,
                    newVal: payload.newVal ?? null,
                },
            });
        } catch (error) {
            this.logger.warn(`createManualAuditLog error: ${error.message}`);
            throw error;
        }
    }

    private getPaymentRequestRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'PaymentRequestDetail':
                return (
                    rowLabelMaps.detailMap.get(recordId) ||
                    `Detail [${newVal.SerialNumber || oldVal.SerialNumber || recordId} - ${newVal.Charge || oldVal.Charge || ''}]`
                );
            default:
                return null;
        }
    }

    private getPaymentRequestLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            PaymentRequest: 'Payment Request',
            PaymentRequestDetail: 'Charge',
        };
        return sectionMap[tableName] || tableName;
    }

    private async getPaymentRequestLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let detailRows: any[] = [];

            const paymentRequestSid = Number(recordId);

            if (!paymentRequestSid) {
                throw new BadRequestException('valid recordId is required');
            }

            const [
                fetchedDetails
            ] = await Promise.all([
                this._db.paymentRequestDetail.findMany({
                    where: { PaymentRequestSid: paymentRequestSid },
                    select: {
                        PaymentRequestDtlSid: true,
                        SerialNumber: true,
                        ChargeMasterSid: true
                    }
                }),
            ]);
            detailRows = fetchedDetails;

            conditions = [
                {
                    tableName: 'PaymentRequest',
                    recordId: recordId
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'PaymentRequestDetail',
                        recordId: { in: detailRows.map(x => String(x.PaymentRequestDtlSid)) }
                    }]
                    : []),
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [charge, customers, uoms, currencies] = await Promise.all([
                this._db.chargeMaster.findMany({
                    select: {
                        ChargeMasterSid: true,
                        chargeCode: true
                    }
                }),
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                }),
                this._db.uOMMaster.findMany({
                    select: {
                        UOMMasterSid: true,
                        UOMCode: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
            ])

            const chargeMap = new Map<string, string>(
                charge.map(c => [String(c.ChargeMasterSid), c.chargeCode])
            );

            const customerMap = new Map<string, string>(
                customers.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            );

            const uomMap = new Map<string, string>(
                uoms.map(c => [String(c.UOMMasterSid), c.UOMCode])
            );

            const currencyMap = new Map<string, string>(
                currencies.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const serial = d.SerialNumber?.toString().trim() || d.ChargeMasterSid;
                    const charge = chargeMap.get(String(d.ChargeMasterSid)) || d.ChargeMasterSid || '';
                    const label = charge ? `Detail [${serial} - ${charge}]` : `Detail [${serial}]`;
                    return [
                        String(d.PaymentRequestDtlSid),
                        label
                    ];
                })
            );

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const ignoredFields = [
                'UpdatedBy', 'UpdatedOn', 'CreatedBy', 'CreatedOn'
            ]

            const rowLabelMaps = {
                detailMap
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'ChargeMasterSid', 'Charge', chargeMap);
                this.replaceAndRename(newVal, 'ChargeMasterSid', 'Charge', chargeMap);

                this.replaceAndRename(oldVal, 'Party', 'Party', customerMap);
                this.replaceAndRename(newVal, 'Party', 'Party', customerMap);

                this.replaceAndRename(oldVal, 'CostChargeUomSid', 'Unit', uomMap);
                this.replaceAndRename(newVal, 'CostChargeUomSid', 'Unit', uomMap);

                this.replaceAndRename(oldVal, 'CostCurrencyMasterSid', 'Currency', currencyMap);
                this.replaceAndRename(newVal, 'CostCurrencyMasterSid', 'Currency', currencyMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getPaymentRequestLabel(log.tableName),
                    rowLabel: this.getPaymentRequestRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getChartOfAccountsLogs(recordId?: string) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'COAMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [currencies] = await Promise.all([
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                })
            ]);

            const currencyMap = new Map<string, string>(
                currencies.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'LedgerCurrency', 'Currency', currencyMap);
                this.replaceAndRename(newVal, 'LedgerCurrency', 'Currency', currencyMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.replaceValueFromMap(oldVal, 'SubledgerName', yesNoMap);
                this.replaceValueFromMap(newVal, 'SubledgerName', yesNoMap);

                this.replaceValueFromMap(oldVal, 'JobNoRequire', yesNoMap);
                this.replaceValueFromMap(newVal, 'JobNoRequire', yesNoMap);

                this.replaceValueFromMap(oldVal, 'HSNRequire', yesNoMap);
                this.replaceValueFromMap(newVal, 'HSNRequire', yesNoMap);

                this.replaceValueFromMap(oldVal, 'ProfitandLoss', yesNoMap);
                this.replaceValueFromMap(newVal, 'ProfitandLoss', yesNoMap);

                this.replaceValueFromMap(oldVal, 'BalanceSheet', yesNoMap);
                this.replaceValueFromMap(newVal, 'BalanceSheet', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getCurrencyExchangeLogs(recordId?: string) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'CurrencyExchange',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getSubledgerMappingLogs(recordId?: string) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'SubledgerMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [coa, subledgers] = await Promise.all([
                this._db.cOAMaster.findMany({
                    select: {
                        COAMasterSid: true,
                        LedgerName: true
                    }
                }),
                this._db.subledgerMaster.findMany({
                    select: {
                        SubledgerMasterSid: true,
                        SubledgerName: true
                    }
                })
            ]);

            const coaMap = new Map<string, string>(
                coa.map(c => [
                    String(c.COAMasterSid),
                    c.LedgerName ?? ''
                ])
            );
            const subledgerMap = new Map<string, string>(
                subledgers.map(s => [
                    String(s.SubledgerMasterSid),
                    s.SubledgerName ?? ''
                ])
            );

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'AccrualCOAMasterSid', 'COA', coaMap);
                this.replaceAndRename(newVal, 'AccrualCOAMasterSid', 'COA', coaMap);

                this.replaceAndRename(oldVal, 'CrCOAMasterSid', 'COA', coaMap);
                this.replaceAndRename(newVal, 'CrCOAMasterSid', 'COA', coaMap);

                this.replaceAndRename(oldVal, 'DrCOAMasterSid', 'COA', coaMap);
                this.replaceAndRename(newVal, 'DrCOAMasterSid', 'COA', coaMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    tableName: subledgerMap.get(String(log.recordId)) || log.tableName,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getSupplierTdsMappingLogs(recordId?: string) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'SupplierTdsMapping',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getLeadLogs(recordId?: string) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'PreCustomerMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [country, state, city] = await Promise.all([
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                }),
                this._db.stateMaster.findMany({
                    select: {
                        StateMasterSid: true,
                        stateName: true
                    }
                }),
                this._db.cityMaster.findMany({
                    select: {
                        CityMasterSid: true,
                        cityName: true
                    }
                })
            ]);

            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const stateMap = new Map<string, string>(
                state.map(c => [String(c.StateMasterSid), c.stateName])
            );

            const cityMap = new Map<string, string>(
                city.map(c => [String(c.CityMasterSid), c.cityName])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'CountryMasterSid', 'Country', countryMap);
                this.replaceAndRename(newVal, 'CountryMasterSid', 'Country', countryMap);

                this.replaceAndRename(oldVal, 'StateMasterSid', 'State', stateMap);
                this.replaceAndRename(newVal, 'StateMasterSid', 'State', stateMap);

                this.replaceAndRename(oldVal, 'CityMasterSid', 'City', cityMap);
                this.replaceAndRename(newVal, 'CityMasterSid', 'City', cityMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'isQualify', yesNoMap);
                this.replaceValueFromMap(newVal, 'isQualify', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getMeetingLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'PreCustomerMeeting',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const LeadOrCustomer = {
                L: 'Lead',
                C: 'Customer'
            }

            const ignoredFields = [
                'createdOn', 'updatedOn', 'createdBy', 'updatedBy', 'CustomerMasterSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'LeadOrCustomer', LeadOrCustomer);
                this.replaceValueFromMap(newVal, 'LeadOrCustomer', LeadOrCustomer);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getCompanyRowLabel(
        log: any,
        rowLabelMaps: {
            branchMap: Map<string, string>;
            bankMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');

        switch (log.tableName) {
            case 'BranchMaster':
                return (
                    rowLabelMaps.branchMap.get(recordId) ||
                    `Branch [${newVal.BranchName || oldVal.BranchName || recordId}]`
                );

            case 'BranchBank':
                return (
                    rowLabelMaps.bankMap.get(recordId) ||
                    `Bank [${newVal.BankName || oldVal.BankName || recordId}]`
                );
            default:
                return null;
        }
    }

    private getCompanyLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            BranchBank: 'Bank',
            BranchMaster: 'Branch',
            CompanyMaster: 'Company',
        };
        return sectionMap[tableName] || tableName;
    }

    private async getCompanyLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let branchRows: any[] = [];
            let bankRows: any[] = [];

            const companyMasterSid = Number(recordId);

            const [
                branch
            ] = await Promise.all([
                this._db.branchMaster.findMany({
                    where: { CompanyMasterSid: companyMasterSid },
                    select: {
                        BranchMasterSid: true,
                        branchName: true
                    }
                }),
            ]);
            branchRows = branch;
            bankRows = branchRows.length ? await this._db.branchBank.findMany({
                where: {
                    BranchMasterSid: { in: branchRows.map(b => b.BranchMasterSid) },
                },
                select: {
                    BranchBankSid: true,
                    BankName: true,
                    BranchMasterSid: true,
                },
            })
                : [];
            conditions = [
                {
                    tableName: 'CompanyMaster',
                    recordId: recordId,
                },
                ...(branchRows.length
                    ? [{
                        tableName: 'BranchMaster',
                        recordId: { in: bankRows.map(x => String(x.BranchMasterSid)) },
                    }]
                    : []),
                ...(bankRows.length
                    ? [{
                        tableName: 'BranchBank',
                        recordId: { in: bankRows.map(x => String(x.BranchBankSid)) },
                    }]
                    : []),
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [country, currency, city, state] = await Promise.all([
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true,
                    }
                }),
                this._db.cityMaster.findMany({
                    select: {
                        CityMasterSid: true,
                        cityName: true
                    }
                }),
                this._db.stateMaster.findMany({
                    select: {
                        StateMasterSid: true,
                        stateName: true
                    }
                })
            ])

            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const currencyMap = new Map<string, string>(
                currency.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const cityMap = new Map<string, string>(
                city.map(c => [String(c.CityMasterSid), c.cityName])
            );

            const stateMap = new Map<string, string>(
                state.map(c => [String(c.StateMasterSid), c.stateName])
            );

            const branchMap = new Map<string, string>(
                branchRows.map((b) => [String(b.BranchMasterSid), `Branch [${b.branchName}]`])
            );

            const bankMap = new Map<string, string>(
                bankRows.map((b) => {
                    const branchLabel = branchMap.get(String(b.BranchMasterSid)) ||
                        `Branch [${b.BranchMasterSid}]`;
                    return [
                        String(b.BranchBankSid),
                        `Bank [${branchLabel} - ${b.BankName}]`,
                    ];
                })
            );

            const ignoredFields = [
                'createdBy', 'createdOn', 'updatedOn', 'updatedBy',
                'companyLogo', 'reportLogo'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const rowLabelMaps = {
                branchMap,
                bankMap
            };

            const formattedLogs = logs.map((logs: any) => {
                const oldVal = { ...(logs.oldVal || {}) };
                const newVal = { ...(logs.newVal || {}) };

                this.replaceAndRename(oldVal, 'CountryMasterSid', 'Country', countryMap);
                this.replaceAndRename(newVal, 'CountryMasterSid', 'Country', countryMap);

                this.replaceAndRename(oldVal, 'CurrencyMasterSid', 'Currency', currencyMap);
                this.replaceAndRename(newVal, 'CurrencyMasterSid', 'Currency', currencyMap);

                this.replaceAndRename(oldVal, 'CityMasterSid', 'City', cityMap);
                this.replaceAndRename(newVal, 'CityMasterSid', 'City', cityMap);

                this.replaceAndRename(oldVal, 'StateMasterSid', 'State', stateMap);
                this.replaceAndRename(newVal, 'StateMasterSid', 'State', stateMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'isHo', yesNoMap);
                this.replaceValueFromMap(newVal, 'isHo', yesNoMap);

                this.replaceValueFromMap(oldVal, 'PrintOnInvoice', yesNoMap);
                this.replaceValueFromMap(newVal, 'PrintOnInvoice', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...logs,
                    sectionLabel: this.getCompanyLabel(logs.tableName),
                    rowLabel: this.getCompanyRowLabel(logs, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getCostCenterLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'CostCenterMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getProfitCenterLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'ProfitCenterMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    getTDSSetRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
            exceptionMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'TDSSetRate':
                return (
                    rowLabelMaps.detailMap.get(recordId) ||
                    `TDS Detail [${newVal.ITSectionCode || oldVal.ITSectionCode || recordId} - ${newVal.CompanyType || oldVal.CompanyType || ''}]`
                );
            case 'TDSExemption':
                return (
                    rowLabelMaps.exceptionMap.get(recordId) ||
                    `TDS Exemption [${newVal.Vessel || oldVal.Vessel || ''}-${newVal.Carrier || oldVal.Carrier || recordId}]`
                );
            default:
                return null;
        }
    }

    private getTDSSetLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            TDSSetHeader: 'TDSSet Header',
            TDSSetRate: 'TDS Deatil',
            TDSExemption: 'Exemption Detail',
        };
        return sectionMap[tableName] || tableName;
    }

    private async getTDSSetLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let detailRows: any[] = [];
            let exemptionRows: any[] = [];

            const tdsSetHeaderSid = Number(recordId);

            const [
                fetchedDetails,
                fetchedExemptions
            ] = await Promise.all([
                this._db.tDSSetRate.findMany({
                    where: { TDSSetHeaderSid: tdsSetHeaderSid },
                    select: {
                        TDSSetRateSid: true,
                        ITSectionCode: true,
                        CompanyType: true
                    }
                }),
                this._db.tDSExemption.findMany({
                    where: { TDSSetHeaderSid: tdsSetHeaderSid },
                    select: {
                        TDSExemptionSid: true,
                        Vessel: true,
                        Carrier: true
                    }
                })
            ]);

            detailRows = fetchedDetails;
            exemptionRows = fetchedExemptions;

            conditions = [
                {
                    tableName: 'TDSSetHeader',
                    recordId: recordId
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'TDSSetRate',
                        recordId: { in: detailRows.map(x => String(x.TDSSetRateSid)) }
                    }]
                    : []),
                ...(exemptionRows.length
                    ? [{
                        tableName: 'TDSExemption',
                        recordId: { in: exemptionRows.map(x => String(x.TDSExemptionSid)) }
                    }]
                    : []),
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [country, vessel, customer] = await Promise.all([
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                }),
                this._db.vesselMaster.findMany({
                    select: {
                        VesselMasterSid: true,
                        VesselName: true
                    }
                }),
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                })
            ])

            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const vesselMap = new Map<string, string>(
                vessel.map(c => [String(c.VesselMasterSid), c.VesselName])
            );

            const customerMap = new Map<string, string>(
                customer.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            )

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const label = `Detail [${d.ITSectionCode} - ${d.CompanyType}]`;
                    return [String(d.TDSSetRateSid), label];
                })
            );
            const exceptionMap = new Map<string, string>(
                exemptionRows.map((e) => {
                    const label = `Exemption [${e.Vessel} - ${e.Carrier}]`;
                    return [String(e.TDSExemptionSid), label];
                })
            );

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const ignoredFields = [
                'updatedBy', 'updatedOn', 'createdBy', 'createdOn', 'CompanyMasterSid'
            ];

            const rowLabelMaps = {
                detailMap,
                exceptionMap
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'CountryMasterSid', 'Country', countryMap);
                this.replaceAndRename(newVal, 'CountryMasterSid', 'Country', countryMap);

                this.replaceAndRename(oldVal, 'Vessel', 'Vessel', vesselMap);
                this.replaceAndRename(newVal, 'Vessel', 'Vessel', vesselMap);

                this.replaceAndRename(oldVal, 'Carrier', 'Carrier', customerMap);
                this.replaceAndRename(newVal, 'Carrier', 'Carrier', customerMap);

                this.replaceAndRename(oldVal, 'Transporter', 'Transporter', customerMap);
                this.replaceAndRename(newVal, 'Transporter', 'Transporter', customerMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getTDSSetLabel(log.tableName),
                    rowLabel: this.getTDSSetRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getYearLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'YearMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [company] = await Promise.all([
                this._db.companyMaster.findMany({
                    select: {
                        CompanyMasterSid: true,
                        companyName: true
                    }
                })
            ])

            const companyMap = new Map<string, string>(
                company.map(c => [String(c.CompanyMasterSid), c.companyName])
            )

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'CompanyMasterSid', 'Company', companyMap);
                this.replaceAndRename(newVal, 'CompanyMasterSid', 'Company', companyMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'CurrentYear', yesNoMap);
                this.replaceValueFromMap(newVal, 'CurrentYear', yesNoMap);

                this.replaceValueFromMap(oldVal, 'YearEndCompleted', yesNoMap);
                this.replaceValueFromMap(newVal, 'YearEndCompleted', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getBlClauseLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'BLClauseMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [department] = await Promise.all([
                this._db.departmentMaster.findMany({
                    select: {
                        DepartmentMasterSid: true,
                        departmentName: true
                    }
                })
            ])

            const departmentMap = new Map<string, string>(
                department.map(c => [String(c.DepartmentMasterSid), c.departmentName])
            );

            const ignoredFields = [
                'createdBy', 'createdOn', 'updatedOn', 'updatedBy'
            ];

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'DepartmentMasterSid', 'Department', departmentMap);
                this.replaceAndRename(newVal, 'DepartmentMasterSid', 'Department', departmentMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'DefaultClause', yesNoMap);
                this.replaceValueFromMap(newVal, 'DefaultClause', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getChargeRowLabel(
        log: any,
        rowLabelMaps: {
            taxMap: Map<string, string>;
            tdsMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'ChargeTaxMaster':
                return (
                    rowLabelMaps.taxMap.get(recordId) ||
                    `Tax [${newVal.description || oldVal.description || recordId}]`
                );

            case 'ChargeTds':
                return (
                    rowLabelMaps.tdsMap.get(recordId) ||
                    `TDS [${newVal.TDSSet || oldVal.TDSSet || recordId}]`
                );
            default:
                return null;
        }
    }

    private getChargeLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            ChargeMaster: 'Charge',
            ChargeTaxMaster: 'Tax',
            ChargeTds: 'TDS',
        };
        return sectionMap[tableName] || tableName;
    }

    private async getChargeLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let taxRows: any[] = [];
            let tdsRows: any[] = [];

            const chargeMasterSid = Number(recordId);

            const [
                tax,
                tds
            ] = await Promise.all([
                this._db.chargeTaxMaster.findMany({
                    where: { chargeTaxMasterSid: chargeMasterSid },
                    select: {
                        ChargeTaxMasterSid: true,
                        description: true
                    }
                }),
                this._db.chargeTds.findMany({
                    where: { ChargeMasterSid: chargeMasterSid },
                    select: {
                        ChargeTdsSid: true,
                        TDSSet: true
                    }
                })
            ]);

            taxRows = tax;
            tdsRows = tds;

            conditions = [
                {
                    tableName: 'ChargeMaster',
                    recordId: recordId
                },
                ...(taxRows.length
                    ? [{
                        tableName: 'ChargeTaxMaster',
                        recordId: { in: taxRows.map(x => String(x.ChargeTaxMasterSid)) }
                    }]
                    : []),
                ...(tdsRows.length
                    ? [{
                        tableName: 'ChargeTds',
                        recordId: { in: tdsRows.map(x => String(x.ChargeTdsSid)) }
                    }]
                    : []),
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [uom, currency, chargegroup, tdsset] = await Promise.all([
                this._db.uOMMaster.findMany({
                    select: {
                        UOMMasterSid: true,
                        UOMCode: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
                this._db.chargeGroup.findMany({
                    select: {
                        ChargeGroupSid: true,
                        GroupName: true
                    }
                }),
                this._db.tDSSetHeader.findMany({
                    select: {
                        TDSSetHeaderSid: true,
                        TDSSetName: true
                    }
                })
            ])

            const uomMap = new Map<string, string>(
                uom.map(c => [String(c.UOMMasterSid), c.UOMCode])
            );

            const currencyMap = new Map<string, string>(
                currency.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const chargeGroupMap = new Map<string, string>(
                chargegroup.map(c => [String(c.ChargeGroupSid), c.GroupName])
            );

            const tdsSetMap = new Map<string, string>(
                tdsset.map(c => [String(c.TDSSetHeaderSid), c.TDSSetName])
            );

            const chargeTaxMap = new Map<string, string>(
                taxRows.map((t) => {
                    const label = `Tax [${t.description}]`;
                    return [String(t.ChargeTaxMasterSid), label]
                })
            );

            const chargeTdsMap = new Map<string, string>(
                tdsRows.map((t) => {
                    const tdsName =
                        tdsSetMap.get(String(t.TDSSet)) || t.TDSSet;

                    const label = `TDS [${tdsName}]`;

                    return [String(t.ChargeTdsSid), label];
                })
            );

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const ignoredFields = [
                'updatedBy', 'updatedOn', 'createdBy', 'createdOn', 'CompanyMasterSid', 'HSSACMasterSid'
            ];

            const rowLabelMaps = {
                taxMap: chargeTaxMap,
                tdsMap: chargeTdsMap
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'UOM', 'UOM', uomMap);
                this.replaceAndRename(newVal, 'UOM', 'UOM', uomMap);

                this.replaceAndRename(oldVal, 'CurrencyMasterSid', 'Currency', currencyMap);
                this.replaceAndRename(newVal, 'CurrencyMasterSid', 'Currency', currencyMap);

                this.replaceAndRename(oldVal, 'ChargeGroupSid', 'ChargeGroup', chargeGroupMap);
                this.replaceAndRename(newVal, 'ChargeGroupSid', 'ChargeGroup', chargeGroupMap);

                this.replaceAndRename(oldVal, 'TDSSet', 'TDSSet', tdsSetMap);
                this.replaceAndRename(newVal, 'TDSSet', 'TDSSet', tdsSetMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getChargeLabel(log.tableName),
                    rowLabel: this.getChargeRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getChargeGroupLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'ChargeGroup',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getContainerTypeLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'ContainerTypeMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getCurrencyLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'CurrencyMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [country] = await Promise.all([
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                })
            ])

            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'CountryMasterSid', 'Country', countryMap);
                this.replaceAndRename(newVal, 'CountryMasterSid', 'Country', countryMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getDepartmentLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'DepartmentMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [coa] = await Promise.all([
                this._db.cOAMaster.findMany({
                    select: {
                        COAMasterSid: true,
                        LedgerName: true
                    }
                })
            ])

            const coaMap = new Map<string, string>(
                coa.map(c => [String(c.COAMasterSid), c.LedgerName ?? ''])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'RevenueCOAMasterSid', 'RevenueCOA', coaMap);
                this.replaceAndRename(newVal, 'RevenueCOAMasterSid', 'RevenueCOA', coaMap);

                this.replaceAndRename(oldVal, 'CostCOAMasterSid', 'CostCOA', coaMap);
                this.replaceAndRename(newVal, 'CostCOAMasterSid', 'CostCOA', coaMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getDivisionLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'DivisionMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getHawbStockLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'HawbStock',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getHSSACLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'HSSACMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getMawbStockLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'MawbStock',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [customer] = await Promise.all([
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                }),
            ])

            const customerMap = new Map<string, string>(
                customer.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'Customer', 'Customer', customerMap);
                this.replaceAndRename(newVal, 'Customer', 'Customer', customerMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getMileStoneLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'MilestoneMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'AutoCapture', yesNoMap);
                this.replaceValueFromMap(newVal, 'AutoCapture', yesNoMap);

                this.replaceValueFromMap(oldVal, 'AutomailRequire', yesNoMap);
                this.replaceValueFromMap(newVal, 'AutomailRequire', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getNetworkLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'NetworkMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [country] = await Promise.all([
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                })
            ])

            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'CountrySid', 'Country', countryMap);
                this.replaceAndRename(newVal, 'CountrySid', 'Country', countryMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getOrganizationRowLabel(
        log: any,
        rowLabelMaps: {
            branchMap: Map<string, string>;
            salesmanMap: Map<string, string>;
            emailMap: Map<string, string>;
            loginMap: Map<string, string>;
            milestoneMap: Map<string, string>;
            contactMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');

        switch (log.tableName) {
            case 'CustomerBranch':
                return (
                    rowLabelMaps.branchMap.get(recordId) ||
                    `Product [${newVal.BranchName || oldVal.BranchName || recordId}]`
                );

            case 'CustomerSalesTeam':
                return (
                    rowLabelMaps.salesmanMap.get(recordId) ||
                    `Rates [${newVal.Salesman || oldVal.Salesman || recordId
                    }]`
                );

            case 'CustomerBrEmail':
                return (
                    rowLabelMaps.emailMap.get(recordId) ||
                    `Connection [${newVal.MenuMasterSid || oldVal.MenuMasterSid || recordId}]`
                );

            case 'CustomerLogin':
                return (
                    rowLabelMaps.loginMap.get(recordId) ||
                    `Cargo [${newVal.LoginName || oldVal.LoginName || recordId}]`
                );
            case 'CustomerMilestone':
                return (
                    rowLabelMaps.milestoneMap.get(recordId) ||
                    `Customer [${newVal.MilestoneMasterSid || oldVal.MilestoneMasterSid || recordId}]`
                );
            case 'CusBranchContact':
                return (
                    rowLabelMaps.contactMap.get(recordId) ||
                    `Branch [${newVal.ContactName || oldVal.ContactName || recordId} - ${newVal.ContactType || oldVal.ContactType || ''}]`
                );
            default:
                return null;
        }
    }

    private getOrganizationLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            CustomerMaster: 'Party',
            CustomerBranch: 'Branch',
            CustomerSalesTeam: 'Salesman',
            CustomerBrEmail: 'Email',
            CustomerLogin: 'eLogin',
            CustomerMilestone: 'Milestone',
            CusBranchContact: 'Contact',
        };

        return sectionMap[tableName] || tableName;
    }

    private async getOrganizationLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let branchRows: any[] = [];
            let salesmanRows: any[] = [];
            let emailRows: any[] = [];
            let loginRows: any[] = [];
            let milestoneRows: any[] = [];
            let contactRows: any[] = [];

            const customerMasterSid = Number(recordId);

            const [
                branch,
                salesman,
                email,
                login,
                milestone,
                contact
            ] = await Promise.all([
                this._db.customerBranch.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: {
                        CustomerBranchSid: true,
                        BranchName: true
                    }
                }),
                this._db.customerSalesTeam.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: {
                        CustomerSalesSid: true,
                        Salesman: true
                    }
                }),
                this._db.customerBrEmail.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: {
                        CustomerBrEmailSid: true,
                        MenuMasterSid: true
                    }
                }),
                this._db.customerLogin.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: {
                        CustomerLoginSid: true,
                        LoginName: true
                    }
                }),
                this._db.customerMilestone.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: {
                        CustomerMilestoneSid: true,
                        MilestoneMasterSid: true
                    }
                }),
                this._db.cusBranchContact.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: {
                        CusBranchContactSid: true,
                        ContactName: true,
                        ContactType: true
                    }
                }),
            ]);

            branchRows = branch;
            salesmanRows = salesman;
            emailRows = email;
            loginRows = login;
            milestoneRows = milestone;
            contactRows = contact;

            conditions = [
                {
                    tableName: 'CustomerMaster',
                    recordId: recordId
                },
                ...(branchRows.length
                    ? [{
                        tableName: 'CustomerBranch',
                        recordId: { in: branchRows.map(x => String(x.CustomerBranchSid)) }
                    }]
                    : []),
                ...(salesmanRows.length
                    ? [{
                        tableName: 'CustomerSalesTeam',
                        recordId: { in: salesmanRows.map(x => String(x.CustomerSalesSid)) }
                    }]
                    : []),
                ...(emailRows.length
                    ? [{
                        tableName: 'CustomerBrEmail',
                        recordId: { in: emailRows.map(x => String(x.CustomerBrEmailSid)) }
                    }]
                    : []),
                ...(loginRows.length
                    ? [{
                        tableName: 'CustomerLogin',
                        recordId: { in: loginRows.map(x => String(x.CustomerLoginSid)) }
                    }]
                    : []),
                ...(milestoneRows.length
                    ? [{
                        tableName: 'CustomerMilestone',
                        recordId: { in: milestoneRows.map(x => String(x.CustomerMilestoneSid)) }
                    }]
                    : []),
                ...(contactRows.length
                    ? [{
                        tableName: 'CusBranchContact',
                        recordId: { in: contactRows.map(x => String(x.CusBranchContactSid)) }
                    }]
                    : []),

            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [menu, milestones, currency, state, city, user, department] = await Promise.all([
                this._db.menuMaster.findMany({
                    select: {
                        MenuMasterSid: true,
                        MenuName: true
                    }
                }),
                this._db.milestoneMaster.findMany({
                    select: {
                        MilestoneMasterSid: true,
                        MilestoneName: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
                this._db.stateMaster.findMany({
                    select: {
                        StateMasterSid: true,
                        stateName: true
                    }
                }),
                this._db.cityMaster.findMany({
                    select: {
                        CityMasterSid: true,
                        cityName: true
                    }
                }),
                this._db.userMaster.findMany({
                    select: {
                        UserMasterSid: true,
                        userName: true
                    }
                }),
                this._db.departmentMaster.findMany({
                    select: {
                        DepartmentMasterSid: true,
                        departmentName: true
                    }
                }),
            ]);

            const menuMap = new Map<string, string>(
                menu.map(c => [String(c.MenuMasterSid), c.MenuName])
            );

            const milestonesMap = new Map<string, string>(
                milestones.map(c => [String(c.MilestoneMasterSid), c.MilestoneName])
            );

            const salesMap = new Map<string, string>(
                user.map(u => [String(u.UserMasterSid), u.userName])
            );

            const branchMap = new Map<string, string>(
                branchRows.map((b) => [String(b.CustomerBranchSid), `Branch [${b.BranchName}]`])
            );

            const salesmanMap = new Map<string, string>(
                salesmanRows.map((s) => [String(s.CustomerSalesSid), `Salesman [${salesMap.get(String(s.Salesman))}]`])
            );

            const emailMap = new Map<string, string>(
                emailRows.map((e) => [String(e.CustomerBrEmailSid), `Email [${menuMap.get(String(e.MenuMasterSid))}]`])
            );

            const loginMap = new Map<string, string>(
                loginRows.map((l) => [String(l.CustomerLoginSid), `Login [${l.LoginName}]`])
            );

            const milestoneMap = new Map<string, string>(
                milestoneRows.map((m) => [String(m.CustomerMilestoneSid), `Milestone [${milestonesMap.get(String(m.MilestoneMasterSid))}]`])
            );

            const contactMap = new Map<string, string>(
                contactRows.map((c) => [String(c.CusBranchContactSid), `Contact [${c.ContactName} - ${c.ContactType}]`])
            );

            const currencyMap = new Map<string, string>(
                currency.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const stateMap = new Map<string, string>(
                state.map(c => [String(c.StateMasterSid), c.stateName])
            );

            const cityMap = new Map<string, string>(
                city.map(c => [String(c.CityMasterSid), c.cityName])
            );

            const departmentMap = new Map<string, string>(
                department.map(d => [String(d.DepartmentMasterSid), d.departmentName])
            );

            const brMap = new Map<string, string>(
                branchRows.map((b) => [String(b.CustomerBranchSid), b.BranchName])
            );

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy',
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy',
            ];

            const rowLabelMaps = {
                branchMap,
                salesmanMap,
                emailMap,
                loginMap,
                milestoneMap,
                contactMap
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'CurrencyMasterSid', 'Currency', currencyMap);
                this.replaceAndRename(newVal, 'CurrencyMasterSid', 'Currency', currencyMap);

                this.replaceAndRename(oldVal, 'StateMasterSid', 'State', stateMap);
                this.replaceAndRename(newVal, 'StateMasterSid', 'State', stateMap);

                this.replaceAndRename(oldVal, 'CityMasterSid', 'City', cityMap);
                this.replaceAndRename(newVal, 'CityMasterSid', 'City', cityMap);

                this.replaceAndRename(oldVal, 'Salesman', 'Salesperson', salesMap);
                this.replaceAndRename(newVal, 'Salesman', 'Salesperson', salesMap);

                this.replaceAndRename(oldVal, 'MenuMasterSid', 'Menu', menuMap);
                this.replaceAndRename(newVal, 'MenuMasterSid', 'Menu', menuMap);

                this.replaceAndRename(oldVal, 'CustomerBranchSid', 'Branch', brMap);
                this.replaceAndRename(newVal, 'CustomerBranchSid', 'Branch', brMap);

                this.replaceArrayIdsWithNames(oldVal, 'DepartmentMasterSid', departmentMap);
                this.replaceArrayIdsWithNames(newVal, 'DepartmentMasterSid', departmentMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getOrganizationLabel(log.tableName),
                    rowLabel: this.getOrganizationRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                }
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getPackageTypeLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'PackageTypeMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getTaxGroupLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'TaxGroup',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getPortMasterLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'PortMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const [country,state, city,zone] = await Promise.all([
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                }),
                this._db.stateMaster.findMany({
                    select: {
                        StateMasterSid: true,
                        stateName: true
                    }
                }),
                this._db.cityMaster.findMany({
                    select: {
                        CityMasterSid: true,
                        cityName: true
                    }
                }),
                this._db.zoneMaster.findMany({
                    select: {
                        ZoneMasterSid: true,
                        ZoneName: true
                    }
                })
            ]) 

            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const stateMap = new Map<string, string>(
                state.map(c => [String(c.StateMasterSid), c.stateName])
            );

            const cityMap = new Map<string, string>(
                city.map(c => [String(c.CityMasterSid), c.cityName])
            );

            const zoneMap = new Map<string, string>(
                zone.map(c => [String(c.ZoneMasterSid), c.ZoneName])
            );
            
            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'CountryMasterSid', 'Country', countryMap);
                this.replaceAndRename(newVal, 'CountryMasterSid', 'Country', countryMap);

                this.replaceAndRename(oldVal, 'StateMasterSid', 'State', stateMap);
                this.replaceAndRename(newVal, 'StateMasterSid', 'State', stateMap);

                this.replaceAndRename(oldVal, 'CityMasterSid', 'City', cityMap);
                this.replaceAndRename(newVal, 'CityMasterSid', 'City', cityMap);

                this.replaceAndRename(oldVal, 'ZoneMasterSid', 'Region', zoneMap);
                this.replaceAndRename(newVal, 'ZoneMasterSid', 'Region', zoneMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'CBMRequire', yesNoMap);
                this.replaceValueFromMap(newVal, 'CBMRequire', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getProductLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'ProductMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const typeMap = {
                1: 'General',
                2: 'Haz',
                3: 'Frozen'
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'ProductType', typeMap);
                this.replaceValueFromMap(newVal, 'ProductType', typeMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getVoyageLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'VoyageMasterHeader',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [port,customer,vessel] = await Promise.all([
                this._db.portMaster.findMany({
                    select: {
                        PortMasterSid: true,
                        PortCode: true
                    }
                }),
                this._db.customerMaster.findMany({
                    select: {
                        CustomerMasterSid: true,
                        CustomerName: true
                    }
                }),
                this._db.vesselMaster.findMany({
                    select: {
                        VesselMasterSid: true,
                        VesselName: true
                    }
                })
            ])

            const portMap = new Map<string, string>(
                port.map(p => [String(p.PortMasterSid), p.PortCode])
            );

            const customerMap = new Map<string, string>(
                customer.map(c => [String(c.CustomerMasterSid), c.CustomerName])
            );

            const vesselMap = new Map<string, string>(
                vessel.map(c => [String(c.VesselMasterSid), c.VesselName])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'CoLoad', yesNoMap);
                this.replaceValueFromMap(newVal, 'CoLoad', yesNoMap);

                this.replaceAndRename(oldVal, 'Carrier', 'Carrier', customerMap);
                this.replaceAndRename(newVal, 'Carrier', 'Carrier', customerMap);

                this.replaceAndRename(oldVal, 'POLSid', 'POL', portMap);
                this.replaceAndRename(newVal, 'POLSid', 'POL', portMap);

                this.replaceAndRename(oldVal, 'PODSid', 'POD', portMap);
                this.replaceAndRename(newVal, 'PODSid', 'POD', portMap);

                this.replaceAndRename(oldVal, 'VesselMasterSid', 'Vessel', portMap);
                this.replaceAndRename(newVal, 'VesselMasterSid', 'Vessel', portMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getSectorLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'SectorMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getUOMLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'UOMMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'VolumeReq', yesNoMap);
                this.replaceValueFromMap(newVal, 'VolumeReq', yesNoMap);

                this.replaceValueFromMap(oldVal, 'WeightReq', yesNoMap);
                this.replaceValueFromMap(newVal, 'WeightReq', yesNoMap);

                this.replaceValueFromMap(oldVal, 'DimensionReq', yesNoMap);
                this.replaceValueFromMap(newVal, 'DimensionReq', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getUnitLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'UnitMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getTariffRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'TariffDetail':
                return (
                    rowLabelMaps.detailMap.get(recordId) ||
                    `Detail [${newVal.ChargeCode || oldVal.ChargeCode || recordId} - ${newVal.CargoType || oldVal.CargoType || ''}]`
                );
            default:
                return null;
        }
    }

    private getTariffLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            TariffHeader: 'Tariff',
            TariffDetail: 'Detail',        };
        return sectionMap[tableName] || tableName;
    }

    private async getTariffLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let detailRows: any[] = [];

            const tariffSid = Number(recordId);

            const [
                fetchedDetails
            ] = await Promise.all([
                this._db.tariffDetail.findMany({
                    where: { TariffHeaderSid: tariffSid },
                    select: {
                        TariffDetailSid: true,
                        ChargeCode: true,
                        CargoType: true
                    }
                })
            ])

            detailRows = fetchedDetails;

            conditions = [
                {
                    tableName: 'TariffHeader',
                    recordId: recordId
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'TariffDetail',
                        recordId: { in: detailRows.map(x => String(x.TariffDetailSid)) }
                    }]
                    : [])
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const chargeCode = d.ChargeCode?.toString().trim() || d.TariffDetailSid;
                    const cargoType = d.CargoType?.toString().trim() || '';
                    return [String(d.TariffDetailSid), `Detail [${chargeCode} - ${cargoType}]`];
                })
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const rowLabelMaps = {
                detailMap
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getTariffLabel(log.tableName),
                    rowLabel: this.getTariffRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getTaxLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'TaxMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [taxgroup] = await Promise.all([
                this._db.taxGroup.findMany({
                    select: {
                        TaxGroupSid: true,
                        TaxGroup: true
                    }
                })
            ])

            const taxGroupMap = new Map<string, string>(
                taxgroup.map(c => [String(c.TaxGroupSid), c.TaxGroup])
            );

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'TaxGroupSid', 'TaxGroup', taxGroupMap);
                this.replaceAndRename(newVal, 'TaxGroupSid', 'TaxGroup', taxGroupMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'TaxExempt', yesNoMap);
                this.replaceValueFromMap(newVal, 'TaxExempt', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getZoneLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'ZoneMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getVesselLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'VesselMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getStdChargeRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'StdTariffDetail':
                return (
                    rowLabelMaps.detailMap.get(recordId) ||
                    `Detail [${newVal.Charge || oldVal.Charge || newVal.ChargeCode || oldVal.ChargeCode || recordId} - ${newVal.CargoType || oldVal.CargoType || ''}]`
                );
            default:
                return null;
        }
    }

    private getStdChargeLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            StdRateHeader: 'Standard Charge',
            StdTariffDetail: 'Detail',        };
        return sectionMap[tableName] || tableName;
    }

    private async getStdChargeLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let detailRows: any[] = [];

            const stdChargeSid = Number(recordId);

            const [
                fetchedDetails
            ] = await Promise.all([
                this._db.stdTariffDetail.findMany({
                    where: { StdRateHeaderSid: stdChargeSid },
                    select: {
                        StdTariffDetailSid: true,
                        ChargeMasterSid: true,
                        ChargeName: true,
                        CargoType: true
                    }
                })
            ])

            detailRows = fetchedDetails;

            conditions = [
                {
                    tableName: 'StdRateHeader',
                    recordId: recordId
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'StdTariffDetail',
                        recordId: { in: detailRows.map(x => String(x.StdTariffDetailSid)) }
                    }]
                    : [])
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [charge,uom,currency] = await Promise.all([
                this._db.chargeMaster.findMany({
                    select: {
                        ChargeMasterSid: true,
                        chargeCode: true,
                    }
                }),
                this._db.uOMMaster.findMany({
                    select: {
                        UOMMasterSid: true,
                        UOMCode: true
                    }
                }),
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
            ])

            const chargeMap = new Map<string, string>(
                charge.map(c => [String(c.ChargeMasterSid), c.chargeCode])
            );

            const uomMap = new Map<string, string>(
                uom.map(c => [String(c.UOMMasterSid), c.UOMCode])
            );

            const currencyMap = new Map<string, string>(
                currency.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const chargeCode = chargeMap.get(String(d.ChargeMasterSid))|| d.StdTariffDetailSid;
                    const cargoType = d.CargoType?.toString().trim() || '';
                    return [String(d.StdTariffDetailSid), `Detail [${chargeCode} - ${cargoType}]`];
                })
            );

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const rowLabelMaps = {
                detailMap
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'ChargeMasterSid', 'Charge', chargeMap);
                this.replaceAndRename(newVal, 'ChargeMasterSid', 'Charge', chargeMap);

                this.replaceAndRename(oldVal, 'UomSid', 'UOM', uomMap);
                this.replaceAndRename(newVal, 'UomSid', 'UOM', uomMap);

                this.replaceAndRename(oldVal, 'SaleCurrency', 'SalesCurrency', currencyMap);    
                this.replaceAndRename(newVal, 'SaleCurrency', 'SalesCurrency', currencyMap);
                
                this.replaceAndRename(oldVal, 'CostCurrency', 'CostCurrency', currencyMap);    
                this.replaceAndRename(newVal, 'CostCurrency', 'CostCurrency', currencyMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getStdChargeLabel(log.tableName),
                    rowLabel: this.getStdChargeRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getTermsRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'TermsAndConditionsDetail':
                return (
                    rowLabelMaps.detailMap.get(recordId) ||
                    `Detail [${newVal.TandC || oldVal.TandC || recordId}]`
                );
            default:
                return null;
        }
    }

    private getTermsLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            TermsAndConditionsMaster: 'Terms and Conditions',   
            TermsAndConditionsDetail: 'Detail',        };
        return sectionMap[tableName] || tableName;
    }

    private async getTermsLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let detailRows: any[] = [];

            const termSid = Number(recordId);

            const [
                terms
            ] = await Promise.all([
                this._db.termsAndConditionsDetail.findMany({
                    where: {
                        TermsAndConditionsMasterSid: termSid,
                    },
                    select:{
                        TermsAndConditionsDetailSid: true,
                        TandC: true,
                    }
                })
            ])

            detailRows = terms;

            conditions = [
                {
                    tableName: 'TermsAndConditionsMaster',
                    recordId: recordId
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'TermsAndConditionsDetail',
                        recordId: {
                            in: detailRows.map(d => String(d.TermsAndConditionsDetailSid))
                        }
                    }]
                    : [])
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const detailMap = new Map<string, string>(
                detailRows.map((d) => [String(d.TermsAndConditionsDetailSid), d.TandC])
            );

             const rowLabelMaps = {
                detailMap
            }

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const yesNoMap = {
                S: 'Yes',
                N: 'No'
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'IsDefaut', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsDefaut', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getTermsLabel(log.tableName),
                    rowLabel: this.getTermsRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getPrintLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'PrintMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy', 'TaxGroupSid'
            ];

            const [menu] = await Promise.all([
                this._db.menuMaster.findMany({
                    select: {
                        MenuMasterSid: true,
                        MenuName: true
                    }
                }),
            ])

            const menuMap = new Map<string, string>(
                menu.map(c => [String(c.MenuMasterSid), c.MenuName])
            );


            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.replaceAndRename(oldVal, 'MenuMasterSid', 'Menu', menuMap);
                this.replaceAndRename(newVal, 'MenuMasterSid', 'Menu', menuMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getCountryLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'CountryMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [currency,zone] = await Promise.all([
                this._db.currencyMaster.findMany({
                    select: {
                        CurrencyMasterSid: true,
                        currencyCode: true
                    }
                }),
                this._db.zoneMaster.findMany({
                    select: {
                        ZoneMasterSid: true,
                        ZoneName: true
                    }
                })
            ])

            const currencyMap = new Map<string, string>(
                currency.map(c => [String(c.CurrencyMasterSid), c.currencyCode])
            );

            const zoneMap = new Map<string, string>(
                zone.map(c => [String(c.ZoneMasterSid), c.ZoneName])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceAndRename(oldVal, 'CurrencyMasterSid', 'Currency', currencyMap);    
                this.replaceAndRename(newVal, 'CurrencyMasterSid', 'Currency', currencyMap);
                
                this.replaceAndRename(oldVal, 'ZoneMasterSid', 'Zone', zoneMap);
                this.replaceAndRename(newVal, 'ZoneMasterSid', 'Zone', zoneMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getStateLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'StateMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [country,zone] = await Promise.all([
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                }),
                this._db.zoneMaster.findMany({
                    select: {
                        ZoneMasterSid: true,
                        ZoneName: true
                    }
                })
            ])

            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const zoneMap = new Map<string, string>(
                zone.map(c => [String(c.ZoneMasterSid), c.ZoneName])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            }

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceAndRename(oldVal, 'CountryMasterSid', 'Country', countryMap);    
                this.replaceAndRename(newVal, 'CountryMasterSid', 'Country', countryMap);
                
                this.replaceAndRename(oldVal, 'ZoneMasterSid', 'Zone', zoneMap);
                this.replaceAndRename(newVal, 'ZoneMasterSid', 'Zone', zoneMap);

                this.replaceValueFromMap(oldVal, 'IsUnionTerritory', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsUnionTerritory', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getIncoLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'IncoMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getImcoLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'ImcoMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private async getCityLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'CityMaster',
                    recordId: recordId
                }
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [country,state] =await Promise.all([
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                }),
                this._db.stateMaster.findMany({
                    select: {
                        StateMasterSid: true,
                        stateName: true
                    }
                }),
            ])

            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const stateMap = new Map<string, string>(
                state.map(c => [String(c.StateMasterSid), c.stateName])
            );

            const ignoredFields = [
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy', 'TaxGroupSid'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'CountryMasterSid', 'Country', countryMap);
                this.replaceAndRename(newVal, 'CountryMasterSid', 'Country', countryMap);

                this.replaceAndRename(oldVal, 'StateMasterSid', 'State', stateMap);
                this.replaceAndRename(newVal, 'StateMasterSid', 'State', stateMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getUserRowLabel(
        log: any,
        rowLabelMaps : {
            companyMap: Map<string, string>,
            branchMap: Map<string, string>,
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>,
    ): string | null {
        const recordId = String(log.recordId ?? '');

        switch (log.tableName) {
            case 'UserCompanyMaster':
                return (
                    rowLabelMaps.companyMap.get(recordId) || 
                    `Company [${newVal.companyName || oldVal.companyName || recordId}]`
                );
            
            case 'UserBranchMaster':
                return (
                    rowLabelMaps.branchMap.get(recordId) ||
                    `[${newVal.BranchName || oldVal.BranchName || recordId}]`
                );
            default:
                return null;
        }
    }

    private getUserLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            UserMaster : 'User',
            UserCompanyMaster : 'Company',
            UserBranchMaster : 'Branch',
        };

        return sectionMap[tableName] || tableName;
    }

    private async getUserLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let companyRows: any[] = [];
            let branchRows: any[] = [];

            const userid = Number(recordId);

            const[
                company,
                branch,
            ] = await Promise.all([
                this._db.userCompanyMaster.findMany({
                    where: {
                        UserMasterSid: userid
                    },
                    select: {
                        UserCompanyMasterSid: true,
                        CompanyMasterSid: true
                    }
                }),
                this._db.userBranchMaster.findMany({
                    where: {
                        UserMasterSid: userid
                    },
                    select: {
                        UserBranchMasterSid: true,
                        BranchMasterSid: true,
                        CompanyMasterSid: true,
                    }
                }),
            ]);

            companyRows = company;
            branchRows = branch;

            conditions = [
                {
                    tableName: 'UserMaster',
                    recordId: recordId
                },
                ...(companyRows.length
                    ? [{
                        tableName: 'UserCompanyMaster',
                        recordId: { in: companyRows.map(c => String(c.UserCompanyMasterSid)) }
                    }]
                :[]),
                ...(branchRows.length
                    ? [{
                        tableName: 'UserBranchMaster',
                        recordId: { in: branchRows.map(b => String(b.UserBranchMasterSid)) }
                    }]
                : []),
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [companies,branches,userType,user,country] = await Promise.all([
                this._db.companyMaster.findMany({
                    select: {
                        CompanyMasterSid: true,
                        companyName: true
                    }
                }),
                this._db.branchMaster.findMany({
                    select: {
                        CompanyMasterSid: true,
                        BranchMasterSid: true,
                        branchName: true
                    }
                }),
                this._db.userType.findMany({
                    select: {
                        UserTypeSid: true,
                        name: true
                    }
                }),
                this._db.userMaster.findMany({
                    select: {
                        UserMasterSid: true,
                        userName: true,
                    }
                }),
                this._db.countryMaster.findMany({
                    select: {
                        CountryMasterSid: true,
                        countryName: true
                    }
                }),
            ]);

            const companydataMap = new Map<string,string>(
                companies.map(c => [String(c.CompanyMasterSid),c.companyName])
            );
            const branchdataMap = new Map<string,string>(
                branches.map(b => [String(b.BranchMasterSid),b.branchName])
            );
            const userTypeMap = new Map<string,string>(
                userType.map(u => [String(u.UserTypeSid),u.name])
            );
            const userMap = new Map<string,string>(
                user.map(u => [String(u.UserMasterSid),u.userName])
            );
            const countryMap = new Map<string, string>(
                country.map(c => [String(c.CountryMasterSid), c.countryName])
            );

            const companyMap = new Map<string, string>(
                companyRows.map(c => [
                    String(c.UserCompanyMasterSid),
                    `Company ${companydataMap.get(String(c.CompanyMasterSid))}`
                ])
            );

            const branchMap = new Map<string, string>(
                branchRows.map(b => [
                    String(b.UserBranchMasterSid),
                    `Branch ${branchdataMap.get(String(b.BranchMasterSid))} - ${companydataMap.get(String(b.CompanyMasterSid))}`
                ])
            );

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            };

            const isMap = {
                1: 'Yes',
                0: 'No'
            }

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const ignoredFields = [
                'CreatedBy', 'CreatedOn', 'UpdatedBy', 'UpdatedOn', 'userPassword',
                'createdBy', 'createdOn', 'updatedBy', 'updatedOn',
            ]

            const rowLabelMaps = {
                companyMap,
                branchMap
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceAndRename(oldVal, 'userTypeId', 'UserType' , userTypeMap);
                this.replaceAndRename(newVal, 'userTypeId', 'UserType' , userTypeMap);

                this.replaceAndRename(oldVal, 'DeptHead', 'ReportingTo' , userMap);
                this.replaceAndRename(newVal, 'DeptHead', 'ReportingTo' , userMap);

                this.replaceAndRename(oldVal, 'CountryMasterSid', 'Country', countryMap);
                this.replaceAndRename(newVal, 'CountryMasterSid', 'Country', countryMap);

                this.replaceValueFromMap(oldVal, 'status', statusMap);
                this.replaceValueFromMap(newVal, 'status', statusMap);

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.replaceValueFromMap(oldVal, 'isSalesperson', isMap);
                this.replaceValueFromMap(newVal, 'isSalesperson', isMap);

                this.replaceValueFromMap(oldVal, 'isLoginUser', yesNoMap);
                this.replaceValueFromMap(newVal, 'isLoginUser', yesNoMap);

                this.replaceValueFromMap(oldVal, 'GiveAccess', yesNoMap);
                this.replaceValueFromMap(newVal, 'GiveAccess', yesNoMap);

                this.replaceValueFromMap(oldVal, 'IsDefault', yesNoMap);
                this.replaceValueFromMap(newVal, 'IsDefault', yesNoMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    oldVal,
                    newVal,
                    sectionLabel: this.getUserLabel(log.tableName),
                    rowLabel: this.getUserRowLabel(log, rowLabelMaps,oldVal,newVal),
                };
            })
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

    private getReportMasterRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
        },
        oldVal: Record<string, any>,
        newVal: Record<string, any>
    ): string | null {
        const recordId = String(log.recordId ?? '');
        switch (log.tableName) {
            case 'ReportMasterDetail':
                return (
                    rowLabelMaps.detailMap.get(recordId) ||
                    `Parameter [${newVal.ParameterName || oldVal.ParameterName || recordId}]`
                );
            default:
                return null;
        }
    }

    private getReportMasterLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            ReportMaster: 'Report',
            ReportMasterDetail: 'Parameter',        
        };
        return sectionMap[tableName] || tableName;
    }

    private async getReportMasterLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let detailRows: any[] = [];

            const reportSid = Number(recordId);

            const [
                fetchedDetails
            ] = await Promise.all([
                this._db.reportMasterDetail.findMany({
                    where: { ReportMasterDetailSid: reportSid },
                    select: {
                        ReportMasterDetailSid: true,
                        ParameterName: true,
                    }
                })
            ])

            detailRows = fetchedDetails;

            conditions = [
                {
                    tableName: 'ReportMaster',
                    recordId: recordId
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'ReportMasterDetail',
                        recordId: { in: detailRows.map(x => String(x.ReportMasterDetailSid)) }
                    }]
                    : [])
            ];

            const logs = await this._db.auditLog.findMany({
                where: {
                    OR: conditions
                },
                orderBy: {
                    changedAt: 'desc'
                }
            });

            const [company] = await Promise.all([
                this._db.companyMaster.findMany({
                    select: {
                        CompanyMasterSid: true,
                        companyName: true
                    }
                })
            ])

            const companyMap = new Map<string, string>(
                company.map(c => [String(c.CompanyMasterSid), c.companyName])
            );

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const parameter = d.ParameterName?.toString().trim() || d.ReportMasterDetailSid;
                    return [String(d.ReportMasterDetailSid), `Detail [${parameter}]`];
                })
            );

            const ignoredFields = [
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy'
            ];

            const statusMap = {
                A: 'Active',
                S: 'Suspended',
                D: 'Deleted'
            };

            const rowLabelMaps = {
                detailMap
            }

            const formattedLogs = logs.map((log: any) => {
                const oldVal = { ...(log.oldVal || {}) };
                const newVal = { ...(log.newVal || {}) };

                this.replaceValueFromMap(oldVal, 'Status', statusMap);
                this.replaceValueFromMap(newVal, 'Status', statusMap);

                this.replaceArrayIdsWithNames(oldVal, 'ReportExcludedCompany', companyMap);    
                this.replaceArrayIdsWithNames(newVal, 'ReportExcludedCompany', companyMap);

                this.removeIgnoredFields(oldVal, ignoredFields);
                this.removeIgnoredFields(newVal, ignoredFields);

                return {
                    ...log,
                    sectionLabel: this.getReportMasterLabel(log.tableName),
                    rowLabel: this.getReportMasterRowLabel(log, rowLabelMaps, oldVal, newVal),
                    oldVal,
                    newVal
                };
            });
            return formattedLogs;
        } catch (error) {
            this.logger.warn(`getAuditLogsError: ${error}`);
            throw new Error(`Error fetching audit logs: ${error.message}`);
        }
    }

}

