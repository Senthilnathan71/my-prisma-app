import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
    private getBookingRowLabel(
        log: any,
        rowLabelMaps: {
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
            let productRows: any[] = [];
            let ratesRows: any[] = [];
            let connectionRows: any[] = [];

            const bookingHeaderSid = Number(recordId);

            const [
                cargo,
                fetchedProducts,
                fetchedConnections,
                others,
                fetchedRates,
                cro
            ] = await Promise.all([
                this._db.bookingCargo.findMany({
                    where: { BookingHeaderSid: bookingHeaderSid },
                    select: { BookingCargoSid: true }
                }),
                this._db.bookingProduct.findMany({
                    where: { BookingHeaderSid: bookingHeaderSid },
                    select: {
                        BookingProductSid: true,
                        ProductName: true,
                        ShippingBillNo: true
                    },
                    orderBy: { BookingProductSid: 'desc' }
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

            conditions = [
                {
                    tableName: 'BookingHeader',
                    recordId: recordId
                },
                {
                    tableName: 'BookingCargo',
                    recordId: { in: cargo.map(x => x.BookingCargoSid.toString()) }
                },
                ...(productRows.length
                    ? [{
                        tableName: 'BookingProduct',
                        recordId: { in: productRows.map(x => x.BookingProductSid.toString()) }
                    }]
                    : []),
                ...(connectionRows.length
                    ? [{
                        tableName: 'BookingConnection',
                        recordId: { in: connectionRows.map(x => x.BookingConnectionSid.toString()) }
                    }]
                    : []),
                {
                    tableName: 'BookingOthers',
                    recordId: { in: others.map(x => x.BookingOthersSid.toString()) }
                },
                ...(ratesRows.length
                    ? [{
                        tableName: 'BookingRates',
                        recordId: { in: ratesRows.map(x => x.BookingRatesSid.toString()) }
                    }]
                    : []),
                {
                    tableName: 'BookingCro',
                    recordId: { in: cro.map(x => x.BookingCroSid.toString()) }
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

            const productMap = new Map<string, string>(
                productRows.map((p) => [
                    String(p.BookingProductSid),
                    `Product [${p.ProductName?.toString().trim() || p.BookingProductSid}]`
                ])
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
                'createdOn', 'createdBy', 'updatedOn', 'updatedBy',
                'CarrierSid', 'CompanyMasterSid', 'CustomerBranchSid',
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy', 'MasterNoSid', 'HouseJobSid',
                'VoyageMasterSid', 'BookingHeaderSid', 'BranchMasterSid', 'BookingCroSid', 'AgentBranchSid'
            ];

            const rowLabelMaps = {
                productMap,
                connectionMap,
                ratesMap,
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
            productMap: Map<string, string>;
            connectionMap: Map<string, string>;
            rateMap: Map<string, string>;
            boeMap: Map<string, string>;
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
            case 'CostRevenueCharges' :
                return(
                    rowLabelMaps.rateMap.get(recordId) || 
                    `Rate [${newVal.SerialNumber || oldVal.SerialNumber || recordId} - ${newVal.Charge || oldVal.Charge || ''}]`
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
        };

        return sectionMap[tableName] || tableName;
    }

    private async getAgentMasterAirWaybillLogs(recordId?: string) {
        try {
            let conditions: any[] = [];
            let productRows: any[] = [];
            let connectionRows: any[] = [];
            let ratesRows: any[] = [];
            let boeRows: any[] = [];

            const houseJobSid = Number(recordId);

            const [
                cargo,
                fetchedProducts,
                fetchedConnections,
                fetchedRates,
                fetchedBOE,
                others,
                customs,
            ] = await Promise.all([
                this._db.houseJobCargo.findMany({
                    where: { HouseJobSid: houseJobSid},
                    select: { HouseJobCargoSid: true }
                }),
                this._db.houseJobProduct.findMany({
                    where: { HouseJobSid: houseJobSid},
                    select: {
                        HouseJobProductSid: true,
                        ProductName: true,
                        ShippingBillNo: true
                    },
                    orderBy: { HouseJobProductSid: 'desc' }
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
            ]);
            productRows = fetchedProducts;
            connectionRows = fetchedConnections;
            ratesRows = fetchedRates;
            boeRows = fetchedBOE;

            conditions = [
                {
                    tableName: 'HouseJob',
                    recordId: recordId
                },
                {
                    tableName: 'HouseJobCargo',
                    recordId: { in: cargo.map(x => x.HouseJobCargoSid.toString()) }
                },
                ...(productRows.length
                    ? [{
                        tableName: 'HouseJobProduct',
                        recordId: { in: productRows.map(x => x.HouseJobProductSid.toString()) }
                    }]
                : []),
                ...(connectionRows.length
                    ? [{
                        tableName: 'HouseJobConnection',
                        recordId: { in: connectionRows.map(x => x.HouseJobConnectionSid.toString()) }
                    }]
                : []),
                {
                    tableName: 'HouseJobOthers',
                    recordId: { in: others.map(x => x.HouseJobOthersSid.toString()) }
                },
                ...(ratesRows.length
                    ? [{
                        tableName: 'CostRevenueCharges',
                        recordId: { in: ratesRows.map(x => x.CostRevenueChargesSid.toString()) }
                    }]
                : []),
                ...(boeRows.length
                    ? [{
                        tableName: 'HouseJobBOE',
                        recordId: { in: boeRows.map(x => x.HouseJobBOESid.toString()) }
                    }]
                : []),
                {
                    tableName: 'HouseJobCustoms',
                    recordId: { in: customs.map(x => x.HouseJobCustomsSid.toString()) }
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

            const productMap = new Map<string, string>(
                productRows.map((p) => [
                    String(p.HouseJobProductSid),
                    `Product [${p.ProductName?.toString().trim() || p.HouseJobProductSid}]`
                ])
            );

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
                Y: 'Storage in Yards' ,
            }

            const temp = {
                F: 'Fahrenheit',
                C: 'Celsius',
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
}
