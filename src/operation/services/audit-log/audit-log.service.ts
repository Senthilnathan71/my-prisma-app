import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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

            const [departments, users, customers, charges, uoms, currencies] = await Promise.all([
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
                'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy',
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

                this.replaceValueFromMap(oldVal, 'Coload', yesNoMap);
                this.replaceValueFromMap(newVal, 'Coload', yesNoMap);

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

}
