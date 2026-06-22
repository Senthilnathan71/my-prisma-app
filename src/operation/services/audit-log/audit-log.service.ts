import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
export interface AuditLogQuery {
    page?: number;      // 0-based
    pageSize?: number;  // default 50
    // Internal raw-cursor controls (set by the accumulation loop in
    // getAuditLogs, not by external callers). When rawSkip/rawTake are present
    // fetchLogs uses them instead of page*pageSize so the loop can scan raw
    // rows in batches while the client paginates over *real* (filtered) rows.
    rawSkip?: number;
    rawTake?: number;
}

type AnyRec = Record<string, any>;
@Injectable()
export class AuditLogService {
    constructor(
        private readonly _db: DatabaseService,
        private readonly logger: Logger
    ) { }

    private static readonly STATUS_MAP: Record<string, string> = {
        A: 'Active',
        S: 'Suspended',
        D: 'Deleted',
    };

    private static readonly YES_NO_MAP: Record<string, string> = {
        Y: 'Yes',
        N: 'No',
    };

    private static readonly COMMON_IGNORED = [
        'createdBy', 'createdOn', 'updatedBy', 'updatedOn',
        'CreatedBy', 'CreatedOn', 'UpdatedBy', 'UpdatedOn',
    ];

    // A/B TEST TOGGLE: set to true to return ALL audit rows unfiltered
    // (no hasMeaningfulChange drop, no diff trimming). Use to confirm whether
    // "missing" rows were blank/no-op saves. Set back to false for production.
    private static readonly DEBUG_NO_FILTER = false;

    private async fetchLogs(
        conditions: any[],
        query: AuditLogQuery = {},
    ): Promise<any[]> {
        if (!conditions.length) return this.tagRawCount([], 0, 0);

        const page = Math.max(0, query.page ?? 0);
        const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));

        // When the accumulation loop drives raw paging it passes rawSkip/rawTake.
        // Otherwise fall back to the classic page*pageSize window.
        const skip = query.rawSkip ?? (page * pageSize);
        const take = Math.min(200, Math.max(1, query.rawTake ?? pageSize));

        const rows = await this._db.auditLog.findMany({
            where: { OR: conditions },
            orderBy: { changedAt: 'desc' },
            take,
            skip,
        });

        // Tag each raw row with its position within this batch (0-based). After
        // filtering, a kept row still carries __rawIndex, so the accumulation
        // loop can compute exactly how many raw rows it consumed to reach the
        // page target and resume precisely — without losing or repeating rows.
        rows.forEach((r: any, i: number) => {
            Object.defineProperty(r, '__rawIndex', { value: i, enumerable: false, configurable: true });
        });

        // Stash how many RAW rows this batch returned (before formatLogs drops
        // no-op/blank UPDATE rows) plus the raw window used, so the caller can
        // tell whether the underlying table still has more raw rows to scan.
        return this.tagRawCount(rows, rows.length, take);
    }

    /**
     * Attach raw-page metadata to a logs array as non-enumerable props so it
     * survives the formatLogs().flatMap() pass-through and can be read back in
     * the dispatcher. Non-enumerable keeps it out of JSON serialization.
     */
    private tagRawCount<T extends any[]>(arr: T, rawCount: number, pageSize: number): T {
        Object.defineProperty(arr, '__rawCount', { value: rawCount, enumerable: false, configurable: true });
        Object.defineProperty(arr, '__pageSize', { value: pageSize, enumerable: false, configurable: true });
        return arr;
    }

    private formatLogs(
        logs: any[],
        opts: {
            renameRules?: Array<[string, string, Map<string, string>]>;
            valueRules?: Array<[string, Record<string, string>]>;
            arrayRules?: Array<[string, Map<string, string>]>;
            ignored?: string[];
            decorate?: (log: any, oldVal: AnyRec, newVal: AnyRec) => AnyRec;
            diff?: boolean; // default true
            debug?: boolean; // when true, skip hasMeaningfulChange/diff filtering (A/B testing)
        },
    ): any[] {
        const {
            renameRules = [],
            valueRules = [],
            arrayRules = [],
            ignored = [],
            decorate,
            diff = true,
            debug = AuditLogService.DEBUG_NO_FILTER,
        } = opts;

        const ignoreSet = [...AuditLogService.COMMON_IGNORED, ...ignored];

        const formatted = logs.flatMap((log) => {

            let oldVal: AnyRec = { ...(log.oldVal || {}) };
            let newVal: AnyRec = { ...(log.newVal || {}) };

            this.removeIgnoredFields(oldVal, ignoreSet);
            this.removeIgnoredFields(newVal, ignoreSet);

            // now decide if anything real changed (skipped in debug mode)
            if (!debug && !this.hasMeaningfulChange({ ...log, oldVal, newVal })) return [];


            for (const [from, to, map] of renameRules) {
                this.replaceAndRename(oldVal, from, to, map);
                this.replaceAndRename(newVal, from, to, map);
            }
            for (const [key, map] of valueRules) {
                this.replaceValueFromMap(oldVal, key, map);
                this.replaceValueFromMap(newVal, key, map);
            }
            for (const [key, map] of arrayRules) {
                this.replaceArrayIdsWithNames(oldVal, key, map);
                this.replaceArrayIdsWithNames(newVal, key, map);
            }

            this.removeIgnoredFields(oldVal, ignoreSet);
            this.removeIgnoredFields(newVal, ignoreSet);

            if (diff && !debug) {
                const d = this.diffObjects(oldVal, newVal);
                oldVal = d.oldVal;
                newVal = d.newVal;
            }

            const extra = decorate ? decorate(log, oldVal, newVal) : {};

            const out: AnyRec = { ...log, ...extra, oldVal, newVal };
            // Preserve the raw-batch index (non-enumerable, so it survives the
            // spread above only if we re-attach it) for precise resume math.
            if ((log as any).__rawIndex !== undefined) {
                Object.defineProperty(out, '__rawIndex', {
                    value: (log as any).__rawIndex, enumerable: false, configurable: true,
                });
            }
            return out;
        });

        // Carry the raw-page metadata from the input logs onto the formatted
        // output so the dispatcher can compute hasMore from raw rows fetched.
        return this.tagRawCount(
            formatted,
            (logs as any).__rawCount ?? formatted.length,
            (logs as any).__pageSize ?? formatted.length,
        );
    }

    private isBlank(v: any): boolean {
        return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    }

    private hasMeaningfulChange(log: any): boolean {
        // keep non-UPDATE operations (CREATE / DELETE / PRINT / EMAIL) regardless
        const op = String(log.operation || '').toUpperCase();
        if (op !== 'UPDATE') return true;

        const oldVal: AnyRec = log.oldVal || {};
        const newVal: AnyRec = log.newVal || {};

        const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
        if (keys.size === 0) return false; // empty {} / {} → drop

        for (const k of keys) {
            const a = oldVal[k];
            const b = newVal[k];
            if (this.isBlank(a) && this.isBlank(b)) continue;        // ""/null noise
            if (JSON.stringify(a) !== JSON.stringify(b)) return true; // genuine change
        }
        return false; // only blank-noise differences
    }

    private collectIds(logs: any[], keys: string[]): number[] {
        const ids = new Set<number>();
        for (const log of logs) {
            for (const v of [log.oldVal, log.newVal]) {
                if (!v) continue;
                for (const k of keys) {
                    const raw = v[k];
                    if (raw == null || raw === '') continue;
                    if (Array.isArray(raw)) {
                        for (const x of raw) {
                            const n = Number(x);
                            if (!Number.isNaN(n)) ids.add(n);
                        }
                    } else {
                        const n = Number(raw);
                        if (!Number.isNaN(n)) ids.add(n);
                    }
                }
            }
        }
        return [...ids];
    }

    private async buildScopedMap<T extends AnyRec>(
        ids: number[],
        loader: (ids: number[]) => Promise<T[]>,
        keyField: keyof T,
        labelField: keyof T | ((row: T) => string),
    ): Promise<Map<string, string>> {
        const map = new Map<string, string>();
        if (!ids.length) return map;

        const rows = await loader(ids);
        for (const row of rows) {
            const label =
                typeof labelField === 'function'
                    ? labelField(row)
                    : (row[labelField] as unknown as string) ?? '';
            map.set(String(row[keyField]), label);
        }
        return map;
    }

    private diffObjects(
        oldVal: AnyRec,
        newVal: AnyRec,
    ): { oldVal: AnyRec; newVal: AnyRec } {
        const outOld: AnyRec = {};
        const outNew: AnyRec = {};
        const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);

        for (const k of keys) {
            const a = oldVal[k];
            const b = newVal[k];
            if (JSON.stringify(a) !== JSON.stringify(b)) {
                if (k in oldVal) outOld[k] = a;
                if (k in newVal) outNew[k] = b;
            }
        }
        // If a row only has one side populated (insert/delete), keep it as-is.
        if (!Object.keys(oldVal).length) return { oldVal, newVal: outNew };
        if (!Object.keys(newVal).length) return { oldVal: outOld, newVal };
        return { oldVal: outOld, newVal: outNew };
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

    async getAuditLogs(tableName: string, recordId?: string, screenName?: string, query: AuditLogQuery = {}) {
        const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
        const page = Math.max(0, query.page ?? 0);

        // Where to start scanning RAW rows. The client echoes back the
        // nextRawOffset we returned last time; on the very first page it can
        // also be derived from page*pageSize as a reasonable starting estimate,
        // but rawOffset (when provided) always wins.
        const startRawOffset = query.rawSkip ?? (page * pageSize);

        // Scan raw rows in batches, keeping only the meaningful (post-filter)
        // rows, until we've collected pageSize real changes or run out of raw
        // rows. This avoids returning a near-empty page when most raw rows are
        // no-op saves.
        //
        // RAW_BATCH is deliberately larger than pageSize: each batch re-runs the
        // full master-data enrichment (sub-row findMany + buildScopedMap), so a
        // small batch over a record with many no-op saves means many round-trips
        // and repeated master lookups — the main latency cost. Pulling a wider
        // raw window collapses those into fewer (often one) iterations.
        const RAW_BATCH = Math.min(200, Math.max(pageSize, pageSize * 4));
        const MAX_BATCHES = 10;               // safety cap (10 * RAW_BATCH raw rows)

        const collected: any[] = [];
        let rawOffset = startRawOffset;
        let rawScanned = 0;
        let exhausted = false;
        let batches = 0;
        let trimmedResume: number | null = null;

        while (collected.length < pageSize && !exhausted && batches < MAX_BATCHES) {
            batches++;

            const batch = await this.dispatch(tableName, recordId, screenName, {
                ...query,
                rawSkip: rawOffset,
                rawTake: RAW_BATCH,
            });

            const list = batch ?? [];
            const rawCount = (list as any).__rawCount ?? list.length;
            const batchStartOffset = rawOffset;

            // Will this batch push us past the page target? If so, keep only as
            // many real rows as needed and compute the exact raw offset to
            // resume from next time (one past the last kept row's raw index).
            const remaining = pageSize - collected.length;
            if (list.length > remaining) {
                const kept = list.slice(0, remaining);
                const lastKept = kept[kept.length - 1];
                const lastRawIndex = (lastKept as any).__rawIndex;

                collected.push(...kept);

                // Resume one raw row AFTER the last kept row. Falls back to the
                // full batch consumption if the index tag is somehow missing.
                trimmedResume = typeof lastRawIndex === 'number'
                    ? batchStartOffset + lastRawIndex + 1
                    : batchStartOffset + rawCount;

                rawScanned += (typeof lastRawIndex === 'number' ? lastRawIndex + 1 : rawCount);
                break;
            }

            collected.push(...list);
            rawScanned += rawCount;
            rawOffset += rawCount;

            // If the DB returned fewer raw rows than we asked for, there are no
            // more raw rows to scan — stop.
            if (rawCount < RAW_BATCH) {
                exhausted = true;
            }
        }

        const data = collected;

        // More to fetch unless we exhausted the raw rows. (If we trimmed on
        // overshoot, there are definitely more.)
        const hasMore = trimmedResume !== null ? true : !exhausted;

        // Where the next "load more" should resume scanning raw rows.
        const nextRawOffset = trimmedResume !== null ? trimmedResume : rawOffset;

        return {
            data,
            hasMore,
            page,
            pageSize,
            count: data.length,
            rawScanned,
            // Client should send this back as rawSkip on the next "load more".
            nextRawOffset,
        };
    }

    private async dispatch(tableName: string, recordId?: string, screenName?: string, query: AuditLogQuery = {}) {
        try {
            if (!tableName) {
                throw new BadRequestException('Table name is required');
            }
            if (!screenName) {
                throw new BadRequestException('Screen name is required');
            }
            switch (screenName) {
                case 'Booking':
                    return this.getBookingLogs(recordId, query);
                case 'AgentMasterAirWaybill':
                    return this.getAgentMasterAirWaybillLogs(recordId, query);
                case 'CreditNote':
                    return this.getCreditNoteLogs(recordId, query);
                case 'VendorCreditNote':
                    return this.getVendorCreditNoteLogs(recordId, query);
                case 'ReverseVoucher':
                    return this.getReverseVoucherLogs(recordId, query);
                case 'CreditRequest':
                    return this.getCreditRequestLogs(recordId, query);
                case 'HouseAirwaybill':
                    return this.getAgentMasterAirWaybillLogs(recordId, query);
                case 'HouseJob':
                    return this.getAgentMasterAirWaybillLogs(recordId, query);
                case 'Invoice':
                    return this.getInvoiceLogs(recordId, query);
                case 'VendorInvoice':
                    return this.getVendorInvoiceLogs(recordId, query);
                case 'MasterJob':
                    return this.getMasterJobLogs(recordId, query);
                case 'MasterAirwayBill':
                    return this.getMasterJobLogs(recordId, query);
                case 'ServiceJob':
                    return this.getAgentMasterAirWaybillLogs(recordId, query);
                case 'Receipt':
                    return this.getReceiptLogs(recordId, query);
                case 'Payment':
                    return this.getPaymentLogs(recordId, query);
                case 'JournalVoucher':
                    return this.getJVLogs(recordId, query);
                case 'Quotation':
                    return this.getQuoteLogs(recordId, query);
                case 'Enquiry':
                    return this.getEnquiryLogs(recordId, query);
                case 'VoucherMatching':
                    return this.getVoucherMatchingLogs(recordId, query);
                case 'DocType':
                    return this.getdoctypeLogs(recordId, query);
                case 'NumberSeriesConfig':
                    return this.getnumberseriesLogs(recordId, query);
                case 'PaymentRequest':
                    return this.getPaymentRequestLogs(recordId, query);
                case 'ChartOfAccounts':
                    return this.getChartOfAccountsLogs(recordId, query);
                case 'CurrencyExchange':
                    return this.getCurrencyExchangeLogs(recordId, query);
                case 'SubledgerMapping':
                    return this.getSubledgerMappingLogs(recordId, query);
                case 'SupplierTdsMapping':
                    return this.getSupplierTdsMappingLogs(recordId, query);
                case 'Lead':
                    return this.getLeadLogs(recordId, query);
                case 'Meeting':
                    return this.getMeetingLogs(recordId, query);
                case 'Company':
                    return this.getCompanyLogs(recordId, query);
                case 'CostCenter':
                    return this.getCostCenterLogs(recordId, query);
                case 'ProfitCenter':
                    return this.getProfitCenterLogs(recordId, query);
                case 'TDSSet':
                    return this.getTDSSetLogs(recordId, query);
                case 'Year':
                    return this.getYearLogs(recordId, query);
                case 'BLClause':
                    return this.getBlClauseLogs(recordId, query);
                case 'Charge':
                    return this.getChargeLogs(recordId, query);
                case 'ChargeGroup':
                    return this.getChargeGroupLogs(recordId, query);
                case 'ContainerType':
                    return this.getContainerTypeLogs(recordId, query);
                case 'Currency':
                    return this.getCurrencyLogs(recordId, query);
                case 'Department':
                    return this.getDepartmentLogs(recordId, query);
                case 'Division':
                    return this.getDivisionLogs(recordId, query);
                case 'HawbStock':
                    return this.getHawbStockLogs(recordId, query);
                case 'hs-sac':
                    return this.getHSSACLogs(recordId, query);
                case 'MawbStock':
                    return this.getMawbStockLogs(recordId, query);
                case 'Milestone':
                    return this.getMileStoneLogs(recordId, query);
                case 'Network':
                    return this.getNetworkLogs(recordId, query);
                case 'Organization':
                    return this.getOrganizationLogs(recordId, query);
                case 'PackageType':
                    return this.getPackageTypeLogs(recordId, query);
                case 'TaxGroup':
                    return this.getTaxGroupLogs(recordId, query);
                case 'PortMaster':
                    return this.getPortMasterLogs(recordId, query);
                case 'Product':
                    return this.getProductLogs(recordId, query);
                case 'Voyage':
                    return this.getVoyageLogs(recordId, query);
                case 'Sector':
                    return this.getSectorLogs(recordId, query);
                case 'UOM':
                    return this.getUOMLogs(recordId, query);
                case 'Unit':
                    return this.getUnitLogs(recordId, query);
                case 'Tariff':
                    return this.getTariffLogs(recordId, query);
                case 'Tax':
                    return this.getTaxLogs(recordId, query);
                case 'Zone':
                    return this.getZoneLogs(recordId, query);
                case 'Vessel':
                    return this.getVesselLogs(recordId, query);
                case 'StdCharge':
                    return this.getStdChargeLogs(recordId, query);
                case 'Terms':
                    return this.getTermsLogs(recordId, query);
                case 'Print':
                    return this.getPrintLogs(recordId, query);
                case 'Country':
                    return this.getCountryLogs(recordId, query);
                case 'State':
                    return this.getStateLogs(recordId, query);
                case 'Inco':
                    return this.getIncoLogs(recordId, query);
                case 'Imco':
                    return this.getImcoLogs(recordId, query);
                case 'City':
                    return this.getCityLogs(recordId, query);
                case 'User':
                    return this.getUserLogs(recordId, query);
                case 'ReportMaster':
                    return this.getReportMasterLogs(recordId, query);
            }
        } catch (error) {
            this.logger.warn(`getAuditLog Error: ${error.message}`);
            throw error;
        }
    }

    private fail(error: any): never {
        this.logger.warn(`getAuditLogsError: ${error}`);
        throw new Error(`Error fetching audit logs: ${error.message}`);
    }

    private getBookingRowLabel(
        log: any,
        rowLabelMaps: {
            cargoMap: Map<string, string>;
            productMap: Map<string, string>;
            ratesMap: Map<string, string>;
            connectionMap: Map<string, string>;
        },
        oldVal: AnyRec,
        newVal: AnyRec
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

    private async getBookingLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
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
            const conditions = [
                {
                    tableName: 'BookingHeader',
                    recordId: recordId
                },
                ...(fetchedcargo.length
                    ? [{
                        tableName: 'BookingCargo',
                        recordId: { in: fetchedcargo.map(x => String(x.BookingCargoSid)) }
                    }]
                    : []),
                ...(fetchedProducts.length
                    ? [{
                        tableName: 'BookingProduct',
                        recordId: { in: fetchedProducts.map(x => String(x.BookingProductSid)) }
                    }]
                    : []),
                ...(fetchedConnections.length
                    ? [{
                        tableName: 'BookingConnection',
                        recordId: { in: fetchedConnections.map(x => String(x.BookingConnectionSid)) }
                    }]
                    : []),
                {
                    tableName: 'BookingOthers',
                    recordId: { in: others.map(x => String(x.BookingOthersSid)) }
                },
                ...(fetchedRates.length
                    ? [{
                        tableName: 'BookingRates',
                        recordId: { in: fetchedRates.map(x => String(x.BookingRatesSid)) }
                    }]
                    : []),
                {
                    tableName: 'BookingCro',
                    recordId: { in: cro.map(x => String(x.BookingCroSid)) }
                }
            ];
            const logs = await this.fetchLogs(conditions, query);

            const [departmentMap, salesmanMap, customerMap, chargeMap, uomMap, currencyMap, voucherMap, voucherTypeMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['DepartmentMasterSid']),
                    ids => this._db.departmentMaster.findMany({
                        where: {
                            DepartmentMasterSid: { in: ids }
                        },
                        select: {
                            DepartmentMasterSid: true, departmentName: true,
                        }
                    }), 'DepartmentMasterSid', 'departmentName'),

                this.buildScopedMap(this.collectIds(logs, ['SalesmanSid']),
                    ids => this._db.userMaster.findMany({
                        where: {
                            UserMasterSid: { in: ids }
                        },
                        select: {
                            UserMasterSid: true, userName: true,
                        }
                    }), 'UserMasterSid', 'userName'),

                this.buildScopedMap(this.collectIds(logs, ['AgentMasterSid', 'CustomerMasterSid', 'DestinationAgent']),
                    ids => this._db.customerMaster.findMany({
                        where: {
                            CustomerMasterSid: { in: ids }
                        },
                        select: {
                            CustomerMasterSid: true, CustomerName: true,
                        }
                    }), 'CustomerMasterSid', 'CustomerName'),

                this.buildScopedMap(this.collectIds(logs, ['ChargeMasterSid']),
                    ids => this._db.chargeMaster.findMany({
                        where: {
                            ChargeMasterSid: { in: ids }
                        },
                        select: {
                            ChargeMasterSid: true, chargeCode: true
                        }
                    }), 'ChargeMasterSid', 'chargeCode'),

                this.buildScopedMap(this.collectIds(logs, ['ChargeUomSid', 'RevenueChargeUomSid', 'CostChargeUomSid']),
                    ids => this._db.uOMMaster.findMany({
                        where: {
                            UOMMasterSid: { in: ids }
                        },
                        select: {
                            UOMMasterSid: true, UOMCode: true
                        }
                    }), 'UOMMasterSid', 'UOMCode'),
                this.buildScopedMap(this.collectIds(logs, ['RevenueCurrencyMasterSid', 'CostCurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: {
                            CurrencyMasterSid: { in: ids }
                        },
                        select: {
                            CurrencyMasterSid: true, currencyCode: true
                        }
                    }), 'CurrencyMasterSid', 'currencyCode'),
                this.buildScopedMap(this.collectIds(logs, ['RevenueVoucherHeaderSid', 'CostVoucherHeaderSid']),
                    ids => this._db.voucherHeader.findMany({
                        where: {
                            VoucherHeaderSid: { in: ids }
                        },
                        select: {
                            VoucherHeaderSid: true, VoucherNumber: true
                        }
                    }), 'VoucherHeaderSid', 'VoucherNumber'),
                this.buildScopedMap(this.collectIds(logs, ['RevenueVoucherTypeMasterSid', 'CostVoucherTypeMasterSid']),
                    ids => this._db.voucherTypeMaster.findMany({
                        where: {
                            VoucherTypeMasterSid: { in: ids }
                        },
                        select: {
                            VoucherTypeMasterSid: true, DocumentTypeName: true
                        }
                    }), 'VoucherTypeMasterSid', 'DocumentTypeName'),
            ]);

            const cargoMap = new Map(
                fetchedcargo.map(c => [
                    String(c.BookingCargoSid),
                    `Cargo [${c.CargoType?.toString().trim() || c.BookingCargoSid}]`
                ])
            )

            const productMap = new Map(
                fetchedProducts.map(p => {
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

            const connectionMap = new Map(
                fetchedConnections.map(c => [
                    String(c.BookingConnectionSid),
                    `Connection [${c.VesselName?.toString().trim() || c.BookingConnectionSid}]`
                ])
            );

            const ratesMap = new Map(
                fetchedRates.map(r => {

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

            const uom = {
                1: 'Meter',
                2: 'Centimeter',
                3: 'Inch'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                renameRules: [
                    ['DepartmentMasterSid', 'Department', departmentMap],
                    ['SalesmanSid', 'Salesman', salesmanMap],
                    ['DestinationAgent', 'DestinationAgent', customerMap],
                    ['CustomerMasterSid', 'BillingParty', customerMap],
                    ['AgentMasterSid', 'Party', customerMap],
                    ['ChargeMasterSid', 'Charge', chargeMap],
                    ['ChargeUomSid', 'ChargeUom', uomMap],
                    ['RevenueChargeUomSid', 'RevenueChargeUom', uomMap],
                    ['CostChargeUomSid', 'CostChargeUom', uomMap],
                    ['RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap],
                    ['CostCurrencyMasterSid', 'CostCurrency', currencyMap],
                    ['RevenueVoucherHeaderSid', 'VoucherNo', voucherMap],
                    ['RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap],
                    ['CostVoucherHeaderSid', 'VoucherNo', voucherMap],
                    ['CostVoucherTypeMasterSid', 'Type', voucherTypeMap]
                ],
                valueRules: [
                    ['Coload', AuditLogService.YES_NO_MAP],
                    ['IsHaz', AuditLogService.YES_NO_MAP],
                    ['ShipmentType', AuditLogService.YES_NO_MAP],
                    ['UomMasterSid', uom],
                    ['SwitchBL', AuditLogService.YES_NO_MAP],
                    ['BacktoBack', AuditLogService.YES_NO_MAP],
                    ['status', AuditLogService.STATUS_MAP],
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                ignored: [
                    'BookingConnectionSid',
                    'CarrierSid', 'CompanyMasterSid', 'CustomerBranchSid',
                    'CreatedOn', 'CreatedBy', 'UpdatedOn', 'UpdatedBy', 'MasterNoSid', 'HouseJobSid',
                    'VoyageMasterSid', 'BookingHeaderSid', 'BranchMasterSid', 'BookingCroSid', 'AgentBranchSid'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getBookingLabel(log.tableName),
                    rowLabel: this.getBookingRowLabel(log, { cargoMap, productMap, connectionMap, ratesMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
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
        oldVal: AnyRec,
        newVal: AnyRec
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

    private async getAgentMasterAirWaybillLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
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

            const conditions = [
                {
                    tableName: 'HouseJob',
                    recordId: recordId
                },
                ...(fetchedcargo.length
                    ? [{
                        tableName: 'HouseJobCargo',
                        recordId: { in: fetchedcargo.map(x => String(x.HouseJobCargoSid)) }
                    }]
                    : []),
                ...(fetchedProducts.length
                    ? [{
                        tableName: 'HouseJobProduct',
                        recordId: { in: fetchedProducts.map(x => String(x.HouseJobProductSid)) }
                    }]
                    : []),
                ...(fetchedConnections.length
                    ? [{
                        tableName: 'HouseJobConnection',
                        recordId: { in: fetchedConnections.map(x => String(x.HouseJobConnectionSid)) }
                    }]
                    : []),
                {
                    tableName: 'HouseJobOthers',
                    recordId: { in: others.map(x => String(x.HouseJobOthersSid)) }
                },
                ...(fetchedRates.length
                    ? [{
                        tableName: 'CostRevenueCharges',
                        recordId: { in: fetchedRates.map(x => String(x.CostRevenueChargesSid)) }
                    }]
                    : []),
                ...(fetchedBOE.length
                    ? [{
                        tableName: 'HouseJobBOE',
                        recordId: { in: fetchedBOE.map(x => String(x.HouseJobBOESid)) }
                    }]
                    : []),
                {
                    tableName: 'HouseJobCustoms',
                    recordId: { in: customs.map(x => String(x.HouseJobCustomsSid)) }
                },
                ...(fetchedVehicles.length
                    ? [{
                        tableName: 'HouseJobVehicle',
                        recordId: { in: fetchedVehicles.map(x => String(x.HouseJobVehicleSid)) }
                    }]
                    : []),
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [departmentMap, chargeMap, salesmanMap, customerMap, uomMap, currencyMap, voucherMap, voucherTypeMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['DepartmentMasterSid']),
                    ids => this._db.departmentMaster.findMany({
                        where: {
                            DepartmentMasterSid: { in: ids }
                        },
                        select: {
                            DepartmentMasterSid: true, departmentName: true,
                        }
                    }), 'DepartmentMasterSid', 'departmentName'),

                this.buildScopedMap(this.collectIds(logs, ['ChargeMasterSid']),
                    ids => this._db.chargeMaster.findMany({
                        where: {
                            ChargeMasterSid: { in: ids }
                        },
                        select: {
                            ChargeMasterSid: true, chargeCode: true
                        }
                    }), 'ChargeMasterSid', 'chargeCode'),

                this.buildScopedMap(this.collectIds(logs, ['SalesmanSid']),
                    ids => this._db.userMaster.findMany({
                        where: {
                            UserMasterSid: { in: ids }
                        },
                        select: {
                            UserMasterSid: true, userName: true,
                        }
                    }), 'UserMasterSid', 'userName'),

                this.buildScopedMap(this.collectIds(logs, ['DestinationAgent', 'AgentName', 'RevenueCustomerMasterSid', 'CostAgentMasterSid']),
                    ids => this._db.customerMaster.findMany({
                        where: {
                            CustomerMasterSid: { in: ids }
                        },
                        select: {
                            CustomerMasterSid: true, CustomerName: true,
                        }
                    }), 'CustomerMasterSid', 'CustomerName'),

                this.buildScopedMap(this.collectIds(logs, ['ChargeUomSid', 'RevenueChargeUomSid', 'CostChargeUomSid']),
                    ids => this._db.uOMMaster.findMany({
                        where: {
                            UOMMasterSid: { in: ids }
                        },
                        select: {
                            UOMMasterSid: true, UOMCode: true
                        }
                    }), 'UOMMasterSid', 'UOMCode'),

                this.buildScopedMap(this.collectIds(logs, ['RevenueCurrencyMasterSid', 'CostCurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: {
                            CurrencyMasterSid: { in: ids }
                        },
                        select: {
                            CurrencyMasterSid: true, currencyCode: true
                        }
                    }), 'CurrencyMasterSid', 'currencyCode'),

                this.buildScopedMap(this.collectIds(logs, ['RevenueVoucherHeaderSid', 'CostVoucherHeaderSid']),
                    ids => this._db.voucherHeader.findMany({
                        where: {
                            VoucherHeaderSid: { in: ids }
                        },
                        select: {
                            VoucherHeaderSid: true, VoucherNumber: true
                        }
                    }), 'VoucherHeaderSid', 'VoucherNumber'),

                this.buildScopedMap(this.collectIds(logs, ['RevenueVoucherTypeMasterSid', 'CostVoucherTypeMasterSid']),
                    ids => this._db.voucherTypeMaster.findMany({
                        where: {
                            VoucherTypeMasterSid: { in: ids }
                        },
                        select: {
                            VoucherTypeMasterSid: true, DocumentTypeName: true
                        }
                    }), 'VoucherTypeMasterSid', 'DocumentTypeName'),
            ]);

            const cargoMap = new Map<string, string>(
                fetchedcargo.map((c) => [
                    String(c.HouseJobCargoSid),
                    `Cargo [${c.CargoType?.toString().trim() || c.HouseJobCargoSid}]`
                ])
            )

            const productMap = new Map<string, string>(
                fetchedProducts.map((p) => {
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
                fetchedVehicles.map((v) => [
                    String(v.HouseJobVehicleSid),
                    `Vehicle [${v.ChassisNo?.toString().trim() || v.HouseJobVehicleSid}]`
                ])
            )

            const connectionMap = new Map<string, string>(
                fetchedConnections.map((c) => [
                    String(c.HouseJobConnectionSid),
                    `Connection [${c.VesselName?.toString().trim() || c.HouseJobConnectionSid}]`
                ])
            );

            const rateMap = new Map<string, string>(
                fetchedRates.map((r) => {
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
                fetchedBOE.map((b) => [
                    String(b.HouseJobBOESid),
                    `BOE [${b.DeclarationNo?.toString().trim() || b.HouseJobBOESid}]`
                ])
            );

            const uom = {
                1: 'Meter',
                2: 'Centimeter',
                3: 'Inch'
            };

            const custom = {
                NCV: 'No Commercial Value',
                DVC: 'Declared value for Customs'
            } as Record<string, string>;

            const carriage = {
                NVD: 'No value declared',
                DVC: 'Declared value for Carriage',
            } as Record<string, string>;

            const cargocode = {
                F: 'FCL Container',
                L: 'LCL Container',
                M: 'Empty Container',
                B: 'Bulk Solid',
                Q: 'Bulk Liquid',
                R: 'RO-RO Unit',
                P: 'Passenger',
                G: 'General Cargo (Break Bulk)',
            } as Record<string, string>;

            const un = {
                U: 'Used',
                N: 'New'
            } as Record<string, string>;

            const storagerequest = {
                D: 'Direct Delivery',
                S: 'Storage in Sheds',
                Y: 'Storage in Yards',
            } as Record<string, string>;

            const temp = {
                F: 'Fahrenheit',
                C: 'Celsius',
            } as Record<string, string>;

            const vehicleIndicatorList = {
                V: 'Vehicle',
                E: 'Equipment',
                X: 'Others'
            } as Record<string, string>;

            const rollingList = {
                R: 'Rolling',
                S: 'Static'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                renameRules: [
                    ['DepartmentMasterSid', 'Department', departmentMap],
                    ['SalesmanSid', 'Salesman', salesmanMap],
                    ['DestinationAgent', 'DestinationAgent', customerMap],
                    ['AgentName', 'OrginAgent', customerMap],
                    ['ChargeMasterSid', 'Charge', chargeMap],
                    ['ChargeUomSid', 'ChargeUom', uomMap],
                    ['RevenueChargeUomSid', 'RevenueChargeUom', uomMap],
                    ['CostChargeUomSid', 'CostChargeUom', uomMap],
                    ['RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap],
                    ['CostCurrencyMasterSid', 'CostCurrency', currencyMap],
                    ['RevenueCustomerMasterSid', 'BillingParty', customerMap],
                    ['CostAgentMasterSid', 'Party', customerMap],
                    ['RevenueVoucherHeaderSid', 'VoucherNo', voucherMap],
                    ['RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap],
                    ['CostVoucherHeaderSid', 'VoucherNo', voucherMap],
                    ['CostVoucherTypeMasterSid', 'Type', voucherTypeMap]
                ],
                valueRules: [
                    ['Coload', AuditLogService.YES_NO_MAP],
                    ['IsHaz', AuditLogService.YES_NO_MAP],
                    ['UomMasterSid', uom],
                    ['status', AuditLogService.STATUS_MAP],
                    ['Status', AuditLogService.STATUS_MAP],
                    ['DeclaredValueOfCustoms', custom],
                    ['DeclaredValueOfCarriage', carriage],
                    ['CargoCode', cargocode],
                    ['UsedOrNew', un],
                    ['StorageRequest', storagerequest],
                    ['HazStorageRequest', storagerequest],
                    ['RefTemperatureUnit', temp],
                    ['TemperatureUnit', temp],
                    ['VehicleIndicator', vehicleIndicatorList],
                    ['UsedNew', un],
                    ['Rolling', rollingList]
                ],
                ignored: [
                    'CustomerBranchSid', 'CustomerMasterSid',
                    'CarrierSid', 'VoyageMasterSid', 'CostAgentBranchSid', 'RevenueCustomerBranchSid'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getAgentMasterAirWaybillLabel(log.tableName),
                    rowLabel: this.getAgentMasterAirWaybillRowLabel(log, { cargoMap, productMap, vehicleMap, connectionMap, rateMap, boeMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private getCreditNoteRowLabel(
        log: any,
        rowLabelMaps: {
            detailMap: Map<string, string>;
        },
        oldVal: AnyRec,
        newVal: AnyRec
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

    private async getCreditNoteLogs(recordId?: string, query: AuditLogQuery = {}, voucherLabel = 'Credit Note') {
        try {
            const voucherSid = Number(recordId);
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

            const conditions = [
                {
                    tableName: 'VoucherHeader',
                    recordId: recordId
                },
                ...(fetchedDetails.length
                    ? [{
                        tableName: 'VoucherDetail',
                        recordId: { in: fetchedDetails.map(x => String(x.VoucherDetailSid)) }
                    }]
                    : []),
                {
                    tableName: 'VoucherOthers',
                    recordId: { in: others.map(x => String(x.VoucherOthersSid)) }
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [chargeMap, currencyMap, coaMap, profitMap, costMap, ledgerMap, departmentMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['ChargeMasterSid']),
                    ids => this._db.chargeMaster.findMany({
                        where: {
                            ChargeMasterSid: { in: ids }
                        },
                        select: {
                            ChargeMasterSid: true, chargeCode: true
                        }
                    }), 'ChargeMasterSid', 'chargeCode'),

                this.buildScopedMap(this.collectIds(logs, ['CurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: {
                            CurrencyMasterSid: { in: ids }
                        },
                        select: {
                            CurrencyMasterSid: true, currencyCode: true
                        }
                    }), 'CurrencyMasterSid', 'currencyCode'),

                this.buildScopedMap(this.collectIds(logs, ['COAMasterSid', 'BankCOA']),
                    ids => this._db.cOAMaster.findMany({
                        where: {
                            COAMasterSid: { in: ids }
                        },
                        select: {
                            COAMasterSid: true, LedgerName: true
                        }
                    }), 'COAMasterSid', 'LedgerName'),

                this.buildScopedMap(this.collectIds(logs, ['ProfitCenter']),
                    ids => this._db.profitCenterMaster.findMany({
                        where: {
                            ProfitCenterMasterSid: { in: ids }
                        },
                        select: {
                            ProfitCenterMasterSid: true, ProfitCenterName: true
                        }
                    }), 'ProfitCenterMasterSid', 'ProfitCenterName'),

                this.buildScopedMap(this.collectIds(logs, ['CostCenter']),
                    ids => this._db.costCenterMaster.findMany({
                        where: {
                            CostCenterMasterSid: { in: ids }
                        },
                        select: {
                            CostCenterMasterSid: true, CostCenterName: true
                        }
                    }), 'CostCenterMasterSid', 'CostCenterName'),

                this.buildScopedMap(this.collectIds(logs, ['LedgerMasterSid']),
                    ids => this._db.subledgerMaster.findMany({
                        where: {
                            SubledgerMasterSid: { in: ids }
                        },
                        select: {
                            SubledgerMasterSid: true, SubledgerName: true
                        }
                    }), 'SubledgerMasterSid', 'SubledgerName'),

                this.buildScopedMap(this.collectIds(logs, ['DepartmentMasterSid']),
                    ids => this._db.departmentMaster.findMany({
                        where: {
                            DepartmentMasterSid: { in: ids }
                        },
                        select: {
                            DepartmentMasterSid: true, departmentName: true,
                        }
                    }), 'DepartmentMasterSid', 'departmentName'),
            ])

            const detailMap = new Map<string, string>(
                fetchedDetails.map((d) => {
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
            } as Record<string, string>;

            const invoiceList = {
                REG: 'Regular',
                REIMB: 'Reimbursement',
                BOS: 'Bill of Supply',
                NONGST: 'Non GST/Zero'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                renameRules: [
                    ['ChargeMasterSid', 'Charge', chargeMap],
                    ['CurrencyMasterSid', 'Currency', currencyMap],
                    ['COAMasterSid', 'Ledger', coaMap],
                    ['BankCOA', 'Bank/Cash', coaMap],
                    ['LedgerMasterSid', 'Subledger', ledgerMap],
                    ['DepartmentMasterSid', 'Department', departmentMap],
                    ['CostCenter', 'CostCenter', costMap],
                    ['ProfitCenter', 'ProfitCenter', profitMap],
                ],
                valueRules: [
                    ['PostStatus', PostStatus],
                    ['InvoiceType', invoiceList],
                    ['Status', AuditLogService.STATUS_MAP],
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: [
                    'VoucherTransactionSid'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getCreditNoteLabel(log.tableName, voucherLabel),
                    rowLabel: this.getCreditNoteRowLabel(log, { detailMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getVendorCreditNoteLogs(recordId?: string, query: AuditLogQuery = {}) {
        return this.getCreditNoteLogs(recordId, query, 'Vendor Credit Note');
    }

    private async getInvoiceLogs(recordId?: string, query: AuditLogQuery = {}) {
        return this.getCreditNoteLogs(recordId, query, 'Invoice');
    }

    private async getVendorInvoiceLogs(recordId?: string, query: AuditLogQuery = {}) {
        return this.getCreditNoteLogs(recordId, query, 'Vendor Invoice');
    }

    private async getReverseVoucherLogs(recordId?: string, query: AuditLogQuery = {}) {
        return this.getCreditNoteLogs(recordId, query, 'Reverse Voucher')
    }

    private async getReceiptLogs(recordId?: string, query: AuditLogQuery = {}) {
        return this.getCreditNoteLogs(recordId, query, 'Receipt')
    }

    private async getPaymentLogs(recordId?: string, query: AuditLogQuery = {}) {
        return this.getCreditNoteLogs(recordId, query, 'Payment')
    }

    private async getJVLogs(recordId?: string, query: AuditLogQuery = {}) {
        return this.getCreditNoteLogs(recordId, query, 'Journal Voucher')
    }

    private getCreditRequestRowLabel(
        log: any,
        rowLabelMaps: {
            creditRequestMap: Map<string, string>;
            kycMap: Map<string, string>;
        },
        oldVal: AnyRec,
        newVal: AnyRec
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

    private async getCreditRequestLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
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

            const conditions = [
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

            const logs = await this.fetchLogs(conditions, query);

            const [branchMap, userMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['CustomerBranchSid']),
                    ids => this._db.customerBranch.findMany({
                        where: {
                            CustomerBranchSid: { in: ids }
                        },
                        select: {
                            CustomerBranchSid: true, BranchName: true,
                        }
                    }), 'CustomerBranchSid', 'BranchName'),

                this.buildScopedMap(this.collectIds(logs, ['SalesmanSid']),
                    ids => this._db.userMaster.findMany({
                        where: {
                            UserMasterSid: { in: ids }
                        },
                        select: {
                            UserMasterSid: true, userName: true,
                        }
                    }), 'UserMasterSid', 'userName'),
            ]);

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

            return this.formatLogs(logs, {
                renameRules: [
                    ['SalesmanSid', 'Salesman', userMap],
                    ['CustomerBranchSid', 'CustomerBranch', branchMap]
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: [
                    'AttachDocumentSid'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getCreditRequestLabel(log.tableName),
                    rowLabel: this.getCreditRequestRowLabel(log, { creditRequestMap, kycMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
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

    private async getMasterJobLogs(recordId?: string, query: AuditLogQuery = {}) {
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

            const logs = await this.fetchLogs(conditions, query);

            const [departmentMap, chargeMap, customerMap, uomMap, umMap, currencyMap, voucherMap, voucherTypeMap, containerTypeMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['DepartmentMasterSid']),
                    ids => this._db.departmentMaster.findMany({
                        where: { DepartmentMasterSid: { in: ids } },
                        select: { DepartmentMasterSid: true, departmentName: true }
                    }), 'DepartmentMasterSid', 'departmentName'),

                this.buildScopedMap(this.collectIds(logs, ['ChargeMasterSid']),
                    ids => this._db.chargeMaster.findMany({
                        where: { ChargeMasterSid: { in: ids } },
                        select: { ChargeMasterSid: true, chargeCode: true }
                    }), 'ChargeMasterSid', 'chargeCode'),

                this.buildScopedMap(this.collectIds(logs, ['DestinationAgent', 'CarrierSid', 'OriginAgent', 'CFS', 'Yard', 'RevenueCustomerMasterSid', 'CostAgentMasterSid']),
                    ids => this._db.customerMaster.findMany({
                        where: { CustomerMasterSid: { in: ids } },
                        select: { CustomerMasterSid: true, CustomerName: true }
                    }), 'CustomerMasterSid', 'CustomerName'),

                this.buildScopedMap(this.collectIds(logs, ['PkgType']),
                    ids => this._db.uOMMaster.findMany({
                        where: { UOMMasterSid: { in: ids } },
                        select: { UOMMasterSid: true, UOMName: true }
                    }), 'UOMMasterSid', 'UOMName'),

                this.buildScopedMap(this.collectIds(logs, ['ChargeUomSid', 'RevenueChargeUomSid', 'CostChargeUomSid']),
                    ids => this._db.uOMMaster.findMany({
                        where: { UOMMasterSid: { in: ids } },
                        select: { UOMMasterSid: true, UOMCode: true }
                    }), 'UOMMasterSid', 'UOMCode'),

                this.buildScopedMap(this.collectIds(logs, ['RevenueCurrencyMasterSid', 'CostCurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),

                this.buildScopedMap(this.collectIds(logs, ['RevenueVoucherHeaderSid', 'CostVoucherHeaderSid']),
                    ids => this._db.voucherHeader.findMany({
                        where: { VoucherHeaderSid: { in: ids } },
                        select: { VoucherHeaderSid: true, VoucherNumber: true }
                    }), 'VoucherHeaderSid', 'VoucherNumber'),

                this.buildScopedMap(this.collectIds(logs, ['RevenueVoucherTypeMasterSid', 'CostVoucherTypeMasterSid']),
                    ids => this._db.voucherTypeMaster.findMany({
                        where: { VoucherTypeMasterSid: { in: ids } },
                        select: { VoucherTypeMasterSid: true, DocumentTypeName: true }
                    }), 'VoucherTypeMasterSid', 'DocumentTypeName'),

                this.buildScopedMap(this.collectIds(logs, ['ContainerType']),
                    ids => this._db.containerTypeMaster.findMany({
                        where: { ContainerTypeMasterSid: { in: ids } },
                        select: { ContainerTypeMasterSid: true, ContainerName: true }
                    }), 'ContainerTypeMasterSid', 'ContainerName'),
            ]);

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

            const custom = {
                NCV: 'No Commercial Value',
                DVC: 'Declared value for Customs'
            } as Record<string, string>;

            const carriage = {
                NVD: 'No value declared',
                DVC: 'Declared value for Carriage',
            } as Record<string, string>;

            const cargocode = {
                F: 'FCL Container',
                L: 'LCL Container',
                M: 'Empty Container',
                B: 'Bulk Solid',
                Q: 'Bulk Liquid',
                R: 'RO-RO Unit',
                P: 'Passenger',
                G: 'General Cargo (Break Bulk)',
            } as Record<string, string>;

            const un = {
                U: 'Used',
                N: 'New'
            } as Record<string, string>;

            const storagerequest = {
                D: 'Direct Delivery',
                S: 'Storage in Sheds',
                Y: 'Storage in Yards',
            } as Record<string, string>;

            const temp = {
                F: 'Fahrenheit',
                C: 'Celsius',
            } as Record<string, string>;

            return this.formatLogs(logs, {
                renameRules: [
                    ['DepartmentMasterSid', 'Department', departmentMap],
                    ['ChargeMasterSid', 'Charge', chargeMap],
                    ['ChargeUomSid', 'ChargeUom', umMap],
                    ['RevenueChargeUomSid', 'RevenueChargeUom', umMap],
                    ['CostChargeUomSid', 'CostChargeUom', umMap],
                    ['DestinationAgent', 'DestinationAgent', customerMap],
                    ['CarrierSid', 'Carrier', customerMap],
                    ['OriginAgent', 'OriginAgent', customerMap],
                    ['CFS', 'CFS', customerMap],
                    ['Yard', 'Yard', customerMap],
                    ['ContainerType', 'ContainerType', containerTypeMap],
                    ['PkgType', 'PackageType', uomMap],
                    ['RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap],
                    ['CostCurrencyMasterSid', 'CostCurrency', currencyMap],
                    ['RevenueCustomerMasterSid', 'BillingParty', customerMap],
                    ['CostAgentMasterSid', 'Party', customerMap],
                    ['RevenueVoucherHeaderSid', 'VoucherNo', voucherMap],
                    ['RevenueVoucherTypeMasterSid', 'Type', voucherTypeMap],
                    ['CostVoucherHeaderSid', 'VoucherNo', voucherMap],
                    ['CostVoucherTypeMasterSid', 'Type', voucherTypeMap],
                ],
                valueRules: [
                    ['IsHaz', AuditLogService.YES_NO_MAP],
                    ['Haz', AuditLogService.YES_NO_MAP],
                    ['IsSoc', AuditLogService.YES_NO_MAP],
                    ['Coload', AuditLogService.YES_NO_MAP],
                    ['ExportToImport', AuditLogService.YES_NO_MAP],
                    ['status', AuditLogService.STATUS_MAP],
                    ['Status', AuditLogService.STATUS_MAP],
                    ['DeclaredValueOfCustoms', custom],
                    ['DeclaredValueOfCarriage', carriage],
                    ['CargoCode', cargocode],
                    ['UsedOrNew', un],
                    ['StorageRequest', storagerequest],
                    ['HazStorageRequest', storagerequest],
                    ['RefTemperatureUnit', temp],
                    ['TemperatureUnit', temp],
                ],
                ignored: [
                    'VoyageMasterSid', 'CustomerBranchSid', 'CustomerMasterSid', 'CostAgentBranchSid', 'RevenueCustomerBranchSid',
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getMasterJobLabel(log.tableName),
                    rowLabel: this.getMasterJobRowLabel(log, { containerMap, connectionMap, rateMap, activityMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
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

    private async getQuoteLogs(recordId?: string, query: AuditLogQuery = {}) {
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

            const logs = await this.fetchLogs(conditions, query);

            const [portMap, customerMap, salesmanMap, chargesMap, uomMap, currencyMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['POLSid', 'PODSid']),
                    ids => this._db.portMaster.findMany({
                        where: { PortMasterSid: { in: ids } },
                        select: { PortMasterSid: true, PortCode: true }
                    }), 'PortMasterSid', 'PortCode'),

                this.buildScopedMap(this.collectIds(logs, ['CostAgentMasterSid', 'RevenueCustomerMasterSid']),
                    ids => this._db.customerMaster.findMany({
                        where: { CustomerMasterSid: { in: ids } },
                        select: { CustomerMasterSid: true, CustomerName: true }
                    }), 'CustomerMasterSid', 'CustomerName'),

                this.buildScopedMap(this.collectIds(logs, ['SalesmanSid']),
                    ids => this._db.userMaster.findMany({
                        where: { UserMasterSid: { in: ids } },
                        select: { UserMasterSid: true, userName: true }
                    }), 'UserMasterSid', 'userName'),

                this.buildScopedMap(this.collectIds(logs, ['ChargeUomSid']),
                    ids => this._db.chargeMaster.findMany({
                        where: { ChargeMasterSid: { in: ids } },
                        select: { ChargeMasterSid: true, chargeCode: true }
                    }), 'ChargeMasterSid', 'chargeCode'),

                this.buildScopedMap(this.collectIds(logs, ['CostChargeUomSid', 'RevenueChargeUomSid']),
                    ids => this._db.uOMMaster.findMany({
                        where: { UOMMasterSid: { in: ids } },
                        select: { UOMMasterSid: true, UOMCode: true }
                    }), 'UOMMasterSid', 'UOMCode'),

                this.buildScopedMap(this.collectIds(logs, ['RevenueCurrencyMasterSid', 'CostCurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),
            ]);

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

            return this.formatLogs(logs, {
                renameRules: [
                    ['SalesmanSid', 'Salesman', salesmanMap],
                    ['POLSid', 'POL', portMap],
                    ['PODSid', 'POD', portMap],
                    ['ChargeUomSid', 'Charge', chargesMap],
                    ['CostChargeUomSid', 'CostChargeUom', uomMap],
                    ['RevenueChargeUomSid', 'RevenueChargeUom', uomMap],
                    ['CostAgentMasterSid', 'Party', customerMap],
                    ['RevenueCustomerMasterSid', 'BillingParty', customerMap],
                    ['RevenueCurrencyMasterSid', 'RevenueCurrency', currencyMap],
                    ['CostCurrencyMasterSid', 'CostCurrency', currencyMap],
                ],
                valueRules: [
                    ['IsContract', AuditLogService.YES_NO_MAP],
                    ['AgreedRate', AuditLogService.YES_NO_MAP],
                    ['RateLock', AuditLogService.YES_NO_MAP],
                    ['status', AuditLogService.STATUS_MAP],
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                ignored: [
                    'CostAgentBranchSid', 'RevenueCustomerBranchSid', 'BookingHeaderSid'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getQuoteLabel(log.tableName),
                    rowLabel: this.getQuoteRowLabel(log, { routeMap, carrierMap, cargoMap, chargeMap, productMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
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

    private async getEnquiryLogs(recordId?: string, query: AuditLogQuery = {}) {
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

            const logs = await this.fetchLogs(conditions, query);

            const [portMap, customerMap, userMap, departmentMap, uomMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['PORSid', 'POLSid', 'PODSid', 'FDPSid']),
                    ids => this._db.portMaster.findMany({
                        where: { PortMasterSid: { in: ids } },
                        select: { PortMasterSid: true, PortCode: true }
                    }), 'PortMasterSid', 'PortCode'),

                this.buildScopedMap(this.collectIds(logs, ['CustomerMasterSid', 'AgentMasterSid', 'Carrier']),
                    ids => this._db.customerMaster.findMany({
                        where: { CustomerMasterSid: { in: ids } },
                        select: { CustomerMasterSid: true, CustomerName: true }
                    }), 'CustomerMasterSid', 'CustomerName'),

                this.buildScopedMap(this.collectIds(logs, ['UserMasterSid']),
                    ids => this._db.userMaster.findMany({
                        where: { UserMasterSid: { in: ids } },
                        select: { UserMasterSid: true, userName: true }
                    }), 'UserMasterSid', 'userName'),

                this.buildScopedMap(this.collectIds(logs, ['DepartmentMasterSid']),
                    ids => this._db.departmentMaster.findMany({
                        where: { DepartmentMasterSid: { in: ids } },
                        select: { DepartmentMasterSid: true, departmentName: true }
                    }), 'DepartmentMasterSid', 'departmentName'),

                this.buildScopedMap(this.collectIds(logs, ['WeightUnitSid']),
                    ids => this._db.uOMMaster.findMany({
                        where: { UOMMasterSid: { in: ids } },
                        select: { UOMMasterSid: true, UOMCode: true }
                    }), 'UOMMasterSid', 'UOMCode'),
            ]);

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
                        `Route [${c.EnquiryRouteSid}]`;

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


            const leadCustomerMap = {
                L: 'Lead',
                C: 'Customer'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                renameRules: [
                    ['DepartmentMasterSid', 'Department', departmentMap],
                    ['CustomerMasterSid', 'Customer', customerMap],
                    ['AgentMasterSid', 'Agent', customerMap],
                    ['Carrier', 'Carrier', customerMap],
                    ['UserMasterSid', 'User', userMap],
                    ['WeightUnitSid', 'UOM', uomMap],
                    ['PORSid', 'POR', portMap],
                    ['POLSid', 'POL', portMap],
                    ['PODSid', 'POD', portMap],
                    ['FDPSid', 'FPOD', portMap],
                ],
                valueRules: [
                    ['LeadOrCustomer', leadCustomerMap],
                    ['status', AuditLogService.STATUS_MAP],
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                ignored: [
                    'QuoteHeaderSid',
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getEnquiryLabel(log.tableName),
                    rowLabel: this.getEnquiryRowLabel(log, { routeMap, cargoMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
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

    private async getVoucherMatchingLogs(recordId?: string, query: AuditLogQuery = {}) {
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

            const logs = await this.fetchLogs(conditions, query);

            const [voucherMap, currencyMap, coaMap, subledgerMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['SourceVoucherHeaderSid']),
                    ids => this._db.voucherHeader.findMany({
                        where: { VoucherHeaderSid: { in: ids } },
                        select: { VoucherHeaderSid: true, VoucherNumber: true }
                    }), 'VoucherHeaderSid', 'VoucherNumber'),

                this.buildScopedMap(this.collectIds(logs, ['CurrencyMasterSid', 'MatchingCurrency']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),

                this.buildScopedMap(this.collectIds(logs, ['COAMasterSid']),
                    ids => this._db.cOAMaster.findMany({
                        where: { COAMasterSid: { in: ids } },
                        select: { COAMasterSid: true, LedgerName: true }
                    }), 'COAMasterSid', 'LedgerName'),

                this.buildScopedMap(this.collectIds(logs, ['SubledgerMasterSid']),
                    ids => this._db.subledgerMaster.findMany({
                        where: { SubledgerMasterSid: { in: ids } },
                        select: { SubledgerMasterSid: true, SubledgerName: true }
                    }), 'SubledgerMasterSid', 'SubledgerName'),
            ]);

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
            } as Record<string, string>;

            const matchingTypeMap = {
                Source: 'Source',
                Object: 'Object'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                renameRules: [
                    ['CurrencyMasterSid', 'Currency', currencyMap],
                    ['MatchingCurrency', 'MatchingCurrency', currencyMap],
                    ['COAMasterSid', 'Ledger', coaMap],
                    ['SubledgerMasterSid', 'Subledger', subledgerMap],
                    ['SourceVoucherHeaderSid', 'Voucher', voucherMap],
                ],
                valueRules: [
                    ['PostStatus', postStatusMap],
                    ['Status', AuditLogService.STATUS_MAP],
                    ['status', AuditLogService.STATUS_MAP],
                    ['MatchingType', matchingTypeMap],
                ],
                ignored: [
                    'CompanyMasterSid', 'BranchMasterSid',
                    'VoucherMatchingHeaderSid', 'MatchingDetailSid',
                    'VoucherDetailSid', 'VoucherTransactionSid', 'VoucherHeaderSid'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getVoucherMatchingLabel(log.tableName),
                    rowLabel: this.getVoucherMatchingRowLabel(log, { detailMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getdoctypeLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'VoucherTypeMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const coaMap = await this.buildScopedMap(this.collectIds(logs, ['COALedger']),
                ids => this._db.cOAMaster.findMany({
                    where: { COAMasterSid: { in: ids } },
                    select: { COAMasterSid: true, LedgerName: true }
                }), 'COAMasterSid', 'LedgerName');

            return this.formatLogs(logs, {
                renameRules: [
                    ['COALedger', 'COALedger', coaMap],
                ],
                valueRules: [
                    ['BranchFlag', AuditLogService.YES_NO_MAP],
                    ['CompanyFlag', AuditLogService.YES_NO_MAP],
                    ['DocumentFlag', AuditLogService.YES_NO_MAP],
                    ['MonthFlag', AuditLogService.YES_NO_MAP],
                    ['YearFlag', AuditLogService.YES_NO_MAP],
                    ['IsAutoPosting', AuditLogService.YES_NO_MAP],
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getnumberseriesLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'NumberSeriesConfig',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['CompanyFlagRequired', AuditLogService.YES_NO_MAP],
                    ['BranchFlagRequired', AuditLogService.YES_NO_MAP],
                    ['DepartmentCodeRequired', AuditLogService.YES_NO_MAP],
                    ['MonthFlagRequired', AuditLogService.YES_NO_MAP],
                    ['YearFlagRequired', AuditLogService.YES_NO_MAP],
                    ['DepartmentWiseCounter', AuditLogService.YES_NO_MAP],
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
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

    private async getPaymentRequestLogs(recordId?: string, query: AuditLogQuery = {}) {
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

            const logs = await this.fetchLogs(conditions, query);

            const [chargeMap, customerMap, uomMap, currencyMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['ChargeMasterSid']),
                    ids => this._db.chargeMaster.findMany({
                        where: { ChargeMasterSid: { in: ids } },
                        select: { ChargeMasterSid: true, chargeCode: true }
                    }), 'ChargeMasterSid', 'chargeCode'),

                this.buildScopedMap(this.collectIds(logs, ['Party']),
                    ids => this._db.customerMaster.findMany({
                        where: { CustomerMasterSid: { in: ids } },
                        select: { CustomerMasterSid: true, CustomerName: true }
                    }), 'CustomerMasterSid', 'CustomerName'),

                this.buildScopedMap(this.collectIds(logs, ['CostChargeUomSid']),
                    ids => this._db.uOMMaster.findMany({
                        where: { UOMMasterSid: { in: ids } },
                        select: { UOMMasterSid: true, UOMCode: true }
                    }), 'UOMMasterSid', 'UOMCode'),

                this.buildScopedMap(this.collectIds(logs, ['CostCurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),
            ])

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

            return this.formatLogs(logs, {
                renameRules: [
                    ['ChargeMasterSid', 'Charge', chargeMap],
                    ['Party', 'Party', customerMap],
                    ['CostChargeUomSid', 'Unit', uomMap],
                    ['CostCurrencyMasterSid', 'Currency', currencyMap],
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getPaymentRequestLabel(log.tableName),
                    rowLabel: this.getPaymentRequestRowLabel(log, { detailMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getChartOfAccountsLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'COAMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const currencyMap = await this.buildScopedMap(this.collectIds(logs, ['LedgerCurrency']),
                ids => this._db.currencyMaster.findMany({
                    where: { CurrencyMasterSid: { in: ids } },
                    select: { CurrencyMasterSid: true, currencyCode: true }
                }), 'CurrencyMasterSid', 'currencyCode');

            return this.formatLogs(logs, {
                renameRules: [
                    ['LedgerCurrency', 'Currency', currencyMap],
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                    ['SubledgerName', AuditLogService.YES_NO_MAP],
                    ['JobNoRequire', AuditLogService.YES_NO_MAP],
                    ['HSNRequire', AuditLogService.YES_NO_MAP],
                    ['ProfitandLoss', AuditLogService.YES_NO_MAP],
                    ['BalanceSheet', AuditLogService.YES_NO_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getCurrencyExchangeLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'CurrencyExchange',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getSubledgerMappingLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'SubledgerMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [coaMap, subledgerMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['AccrualCOAMasterSid', 'CrCOAMasterSid', 'DrCOAMasterSid']),
                    ids => this._db.cOAMaster.findMany({
                        where: { COAMasterSid: { in: ids } },
                        select: { COAMasterSid: true, LedgerName: true }
                    }), 'COAMasterSid', 'LedgerName'),

                this.buildScopedMap([Number(recordId)].filter(id => !Number.isNaN(id)),
                    ids => this._db.subledgerMaster.findMany({
                        where: { SubledgerMasterSid: { in: ids } },
                        select: { SubledgerMasterSid: true, SubledgerName: true }
                    }), 'SubledgerMasterSid', 'SubledgerName'),
            ]);

            return this.formatLogs(logs, {
                renameRules: [
                    ['AccrualCOAMasterSid', 'COA', coaMap],
                    ['CrCOAMasterSid', 'COA', coaMap],
                    ['DrCOAMasterSid', 'COA', coaMap],
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                decorate: (log) => ({
                    tableName: subledgerMap.get(String(log.recordId)) || log.tableName,
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getSupplierTdsMappingLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'SupplierTdsMapping',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getLeadLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let conditions: any[] = [];

            conditions = [
                {
                    tableName: 'PreCustomerMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [countryMap, stateMap, cityMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['CountryMasterSid']),
                    ids => this._db.countryMaster.findMany({
                        where: { CountryMasterSid: { in: ids } },
                        select: { CountryMasterSid: true, countryName: true }
                    }), 'CountryMasterSid', 'countryName'),

                this.buildScopedMap(this.collectIds(logs, ['StateMasterSid']),
                    ids => this._db.stateMaster.findMany({
                        where: { StateMasterSid: { in: ids } },
                        select: { StateMasterSid: true, stateName: true }
                    }), 'StateMasterSid', 'stateName'),

                this.buildScopedMap(this.collectIds(logs, ['CityMasterSid']),
                    ids => this._db.cityMaster.findMany({
                        where: { CityMasterSid: { in: ids } },
                        select: { CityMasterSid: true, cityName: true }
                    }), 'CityMasterSid', 'cityName'),
            ]);

            return this.formatLogs(logs, {
                renameRules: [
                    ['CountryMasterSid', 'Country', countryMap],
                    ['StateMasterSid', 'State', stateMap],
                    ['CityMasterSid', 'City', cityMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['isQualify', AuditLogService.YES_NO_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getMeetingLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let conditions: any[] = [];
            conditions = [
                {
                    tableName: 'PreCustomerMeeting',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const LeadOrCustomer = {
                L: 'Lead',
                C: 'Customer'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['LeadOrCustomer', LeadOrCustomer],
                ],
                ignored: ['CustomerMasterSid'],
            });
        } catch (error) {
            return this.fail(error);
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

    private async getCompanyLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let branchRows: any[] = [];
            let bankRows: any[] = [];

            const companyMasterSid = Number(recordId);

            branchRows = await this._db.branchMaster.findMany({
                where: { CompanyMasterSid: companyMasterSid },
                select: {
                    BranchMasterSid: true,
                    branchName: true
                }
            });

            bankRows = branchRows.length
                ? await this._db.branchBank.findMany({
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

            const conditions = [
                {
                    tableName: 'CompanyMaster',
                    recordId: recordId,
                },
                ...(branchRows.length
                    ? [{
                        tableName: 'BranchMaster',
                        recordId: { in: branchRows.map(x => String(x.BranchMasterSid)) },
                    }]
                    : []),
                ...(bankRows.length
                    ? [{
                        tableName: 'BranchBank',
                        recordId: { in: bankRows.map(x => String(x.BranchBankSid)) },
                    }]
                    : []),
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [countryMap, currencyMap, cityMap, stateMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['CountryMasterSid']),
                    ids => this._db.countryMaster.findMany({
                        where: { CountryMasterSid: { in: ids } },
                        select: { CountryMasterSid: true, countryName: true }
                    }), 'CountryMasterSid', 'countryName'),

                this.buildScopedMap(this.collectIds(logs, ['CurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),

                this.buildScopedMap(this.collectIds(logs, ['CityMasterSid']),
                    ids => this._db.cityMaster.findMany({
                        where: { CityMasterSid: { in: ids } },
                        select: { CityMasterSid: true, cityName: true }
                    }), 'CityMasterSid', 'cityName'),

                this.buildScopedMap(this.collectIds(logs, ['StateMasterSid']),
                    ids => this._db.stateMaster.findMany({
                        where: { StateMasterSid: { in: ids } },
                        select: { StateMasterSid: true, stateName: true }
                    }), 'StateMasterSid', 'stateName'),
            ]);

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

            return this.formatLogs(logs, {
                renameRules: [
                    ['CountryMasterSid', 'Country', countryMap],
                    ['CurrencyMasterSid', 'Currency', currencyMap],
                    ['CityMasterSid', 'City', cityMap],
                    ['StateMasterSid', 'State', stateMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['isHo', AuditLogService.YES_NO_MAP],
                    ['PrintOnInvoice', AuditLogService.YES_NO_MAP],
                ],
                ignored: [
                    'companyLogo', 'reportLogo', 'config'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getCompanyLabel(log.tableName),
                    rowLabel: this.getCompanyRowLabel(log, { branchMap, bankMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getCostCenterLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'CostCenterMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getProfitCenterLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'ProfitCenterMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
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

    private async getTDSSetLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
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

            const conditions = [
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

            const logs = await this.fetchLogs(conditions, query);

            const [countryMap, vesselMap, customerMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['CountryMasterSid']),
                    ids => this._db.countryMaster.findMany({
                        where: { CountryMasterSid: { in: ids } },
                        select: { CountryMasterSid: true, countryName: true }
                    }), 'CountryMasterSid', 'countryName'),

                this.buildScopedMap(this.collectIds(logs, ['Vessel']),
                    ids => this._db.vesselMaster.findMany({
                        where: { VesselMasterSid: { in: ids } },
                        select: { VesselMasterSid: true, VesselName: true }
                    }), 'VesselMasterSid', 'VesselName'),

                this.buildScopedMap(this.collectIds(logs, ['Carrier', 'Transporter']),
                    ids => this._db.customerMaster.findMany({
                        where: { CustomerMasterSid: { in: ids } },
                        select: { CustomerMasterSid: true, CustomerName: true }
                    }), 'CustomerMasterSid', 'CustomerName'),
            ]);

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

            return this.formatLogs(logs, {
                renameRules: [
                    ['CountryMasterSid', 'Country', countryMap],
                    ['Vessel', 'Vessel', vesselMap],
                    ['Carrier', 'Carrier', customerMap],
                    ['Transporter', 'Transporter', customerMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: [
                    'CompanyMasterSid'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getTDSSetLabel(log.tableName),
                    rowLabel: this.getTDSSetRowLabel(log, { detailMap, exceptionMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getYearLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'YearMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const companyMap = await this.buildScopedMap(this.collectIds(logs, ['CompanyMasterSid']),
                ids => this._db.companyMaster.findMany({
                    where: { CompanyMasterSid: { in: ids } },
                    select: { CompanyMasterSid: true, companyName: true }
                }), 'CompanyMasterSid', 'companyName');

            return this.formatLogs(logs, {
                renameRules: [
                    ['CompanyMasterSid', 'Company', companyMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['CurrentYear', AuditLogService.YES_NO_MAP],
                    ['YearEndCompleted', AuditLogService.YES_NO_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getBlClauseLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'BLClauseMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const departmentMap = await this.buildScopedMap(this.collectIds(logs, ['DepartmentMasterSid']),
                ids => this._db.departmentMaster.findMany({
                    where: { DepartmentMasterSid: { in: ids } },
                    select: { DepartmentMasterSid: true, departmentName: true }
                }), 'DepartmentMasterSid', 'departmentName');

            return this.formatLogs(logs, {
                renameRules: [
                    ['DepartmentMasterSid', 'Department', departmentMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['DefaultClause', AuditLogService.YES_NO_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
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

    private async getChargeLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
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

            const conditions = [
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

            const logs = await this.fetchLogs(conditions, query);

            const [uomMap, currencyMap, chargeGroupMap, tdsSetMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['UOM']),
                    ids => this._db.uOMMaster.findMany({
                        where: { UOMMasterSid: { in: ids } },
                        select: { UOMMasterSid: true, UOMCode: true }
                    }), 'UOMMasterSid', 'UOMCode'),

                this.buildScopedMap(this.collectIds(logs, ['CurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),

                this.buildScopedMap(this.collectIds(logs, ['ChargeGroupSid']),
                    ids => this._db.chargeGroup.findMany({
                        where: { ChargeGroupSid: { in: ids } },
                        select: { ChargeGroupSid: true, GroupName: true }
                    }), 'ChargeGroupSid', 'GroupName'),

                this.buildScopedMap(this.collectIds(logs, ['TDSSet']),
                    ids => this._db.tDSSetHeader.findMany({
                        where: { TDSSetHeaderSid: { in: ids } },
                        select: { TDSSetHeaderSid: true, TDSSetName: true }
                    }), 'TDSSetHeaderSid', 'TDSSetName'),
            ]);

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

            return this.formatLogs(logs, {
                renameRules: [
                    ['UOM', 'UOM', uomMap],
                    ['CurrencyMasterSid', 'Currency', currencyMap],
                    ['ChargeGroupSid', 'ChargeGroup', chargeGroupMap],
                    ['TDSSet', 'TDSSet', tdsSetMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                ignored: [
                    'CompanyMasterSid', 'HSSACMasterSid'
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getChargeLabel(log.tableName),
                    rowLabel: this.getChargeRowLabel(log, { taxMap: chargeTaxMap, tdsMap: chargeTdsMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getChargeGroupLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'ChargeGroup',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getContainerTypeLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'ContainerTypeMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getCurrencyLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'CurrencyMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const countryMap = await this.buildScopedMap(this.collectIds(logs, ['CountryMasterSid']),
                ids => this._db.countryMaster.findMany({
                    where: { CountryMasterSid: { in: ids } },
                    select: { CountryMasterSid: true, countryName: true }
                }), 'CountryMasterSid', 'countryName');

            return this.formatLogs(logs, {
                renameRules: [
                    ['CountryMasterSid', 'Country', countryMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getDepartmentLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'DepartmentMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const coaMap = await this.buildScopedMap(this.collectIds(logs, ['RevenueCOAMasterSid', 'CostCOAMasterSid']),
                ids => this._db.cOAMaster.findMany({
                    where: { COAMasterSid: { in: ids } },
                    select: { COAMasterSid: true, LedgerName: true }
                }), 'COAMasterSid', (row) => row.LedgerName ?? '');

            return this.formatLogs(logs, {
                renameRules: [
                    ['RevenueCOAMasterSid', 'RevenueCOA', coaMap],
                    ['CostCOAMasterSid', 'CostCOA', coaMap],
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getDivisionLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'DivisionMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getHawbStockLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'HawbStock',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getHSSACLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'HSSACMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getMawbStockLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'MawbStock',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const customerMap = await this.buildScopedMap(this.collectIds(logs, ['Customer']),
                ids => this._db.customerMaster.findMany({
                    where: { CustomerMasterSid: { in: ids } },
                    select: { CustomerMasterSid: true, CustomerName: true }
                }), 'CustomerMasterSid', 'CustomerName');

            return this.formatLogs(logs, {
                renameRules: [
                    ['Customer', 'Customer', customerMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getMileStoneLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'MilestoneMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['AutoCapture', AuditLogService.YES_NO_MAP],
                    ['AutomailRequire', AuditLogService.YES_NO_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getNetworkLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                {
                    tableName: 'NetworkMaster',
                    recordId: recordId
                }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const countryMap = await this.buildScopedMap(this.collectIds(logs, ['CountrySid']),
                ids => this._db.countryMaster.findMany({
                    where: { CountryMasterSid: { in: ids } },
                    select: { CountryMasterSid: true, countryName: true }
                }), 'CountryMasterSid', 'countryName');

            return this.formatLogs(logs, {
                renameRules: [
                    ['CountrySid', 'Country', countryMap],
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
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
                    `Branch [${newVal.BranchName || oldVal.BranchName || recordId}]`
                );

            case 'CustomerSalesTeam':
                return (
                    rowLabelMaps.salesmanMap.get(recordId) ||
                    `Salesman [${newVal.Salesman || oldVal.Salesman || recordId}]`
                );

            case 'CustomerBrEmail':
                return (
                    rowLabelMaps.emailMap.get(recordId) ||
                    `Email [${newVal.MenuMasterSid || oldVal.MenuMasterSid || recordId}]`
                );

            case 'CustomerLogin':
                return (
                    rowLabelMaps.loginMap.get(recordId) ||
                    `Login [${newVal.LoginName || oldVal.LoginName || recordId}]`
                );
            case 'CustomerMilestone':
                return (
                    rowLabelMaps.milestoneMap.get(recordId) ||
                    `Milestone [${newVal.MilestoneMasterSid || oldVal.MilestoneMasterSid || recordId}]`
                );
            case 'CusBranchContact':
                return (
                    rowLabelMaps.contactMap.get(recordId) ||
                    `Contact [${newVal.ContactName || oldVal.ContactName || recordId} - ${newVal.ContactType || oldVal.ContactType || ''}]`
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

    private async getOrganizationLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const customerMasterSid = Number(recordId);

            const [
                branchRows,
                salesmanRows,
                emailRows,
                loginRows,
                milestoneRows,
                contactRows
            ] = await Promise.all([
                this._db.customerBranch.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: { CustomerBranchSid: true, BranchName: true }
                }),
                this._db.customerSalesTeam.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: { CustomerSalesSid: true, Salesman: true }
                }),
                this._db.customerBrEmail.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: { CustomerBrEmailSid: true, MenuMasterSid: true }
                }),
                this._db.customerLogin.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: { CustomerLoginSid: true, LoginName: true }
                }),
                this._db.customerMilestone.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: { CustomerMilestoneSid: true, MilestoneMasterSid: true }
                }),
                this._db.cusBranchContact.findMany({
                    where: { CustomerMasterSid: customerMasterSid },
                    select: { CusBranchContactSid: true, ContactName: true, ContactType: true }
                }),
            ]);

            const conditions = [
                {
                    tableName: 'CustomerMaster',
                    recordId: recordId
                },
                ...(branchRows.length
                    ? [{ tableName: 'CustomerBranch', recordId: { in: branchRows.map(x => String(x.CustomerBranchSid)) } }]
                    : []),
                ...(salesmanRows.length
                    ? [{ tableName: 'CustomerSalesTeam', recordId: { in: salesmanRows.map(x => String(x.CustomerSalesSid)) } }]
                    : []),
                ...(emailRows.length
                    ? [{ tableName: 'CustomerBrEmail', recordId: { in: emailRows.map(x => String(x.CustomerBrEmailSid)) } }]
                    : []),
                ...(loginRows.length
                    ? [{ tableName: 'CustomerLogin', recordId: { in: loginRows.map(x => String(x.CustomerLoginSid)) } }]
                    : []),
                ...(milestoneRows.length
                    ? [{ tableName: 'CustomerMilestone', recordId: { in: milestoneRows.map(x => String(x.CustomerMilestoneSid)) } }]
                    : []),
                ...(contactRows.length
                    ? [{ tableName: 'CusBranchContact', recordId: { in: contactRows.map(x => String(x.CusBranchContactSid)) } }]
                    : []),
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [menuMap, milestonesMap, salesMap, currencyMap, stateMap, cityMap, departmentMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['MenuMasterSid']),
                    ids => this._db.menuMaster.findMany({
                        where: { MenuMasterSid: { in: ids } },
                        select: { MenuMasterSid: true, MenuName: true }
                    }), 'MenuMasterSid', 'MenuName'),

                this.buildScopedMap(this.collectIds(logs, ['MilestoneMasterSid']),
                    ids => this._db.milestoneMaster.findMany({
                        where: { MilestoneMasterSid: { in: ids } },
                        select: { MilestoneMasterSid: true, MilestoneName: true }
                    }), 'MilestoneMasterSid', 'MilestoneName'),

                this.buildScopedMap(this.collectIds(logs, ['Salesman']),
                    ids => this._db.userMaster.findMany({
                        where: { UserMasterSid: { in: ids } },
                        select: { UserMasterSid: true, userName: true }
                    }), 'UserMasterSid', 'userName'),

                this.buildScopedMap(this.collectIds(logs, ['CurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),

                this.buildScopedMap(this.collectIds(logs, ['StateMasterSid']),
                    ids => this._db.stateMaster.findMany({
                        where: { StateMasterSid: { in: ids } },
                        select: { StateMasterSid: true, stateName: true }
                    }), 'StateMasterSid', 'stateName'),

                this.buildScopedMap(this.collectIds(logs, ['CityMasterSid']),
                    ids => this._db.cityMaster.findMany({
                        where: { CityMasterSid: { in: ids } },
                        select: { CityMasterSid: true, cityName: true }
                    }), 'CityMasterSid', 'cityName'),

                this.buildScopedMap(this.collectIds(logs, ['DepartmentMasterSid']),
                    ids => this._db.departmentMaster.findMany({
                        where: { DepartmentMasterSid: { in: ids } },
                        select: { DepartmentMasterSid: true, departmentName: true }
                    }), 'DepartmentMasterSid', 'departmentName'),
            ]);

            const branchMap = new Map<string, string>(
                branchRows.map((b) => [String(b.CustomerBranchSid), `Branch [${b.BranchName}]`])
            );

            const salesmanMap = new Map<string, string>(
                salesmanRows.map((s) => [String(s.CustomerSalesSid), `Salesman [${salesMap.get(String(s.Salesman)) ?? s.Salesman}]`])
            );

            const emailMap = new Map<string, string>(
                emailRows.map((e) => [String(e.CustomerBrEmailSid), `Email [${menuMap.get(String(e.MenuMasterSid)) ?? e.MenuMasterSid}]`])
            );

            const loginMap = new Map<string, string>(
                loginRows.map((l) => [String(l.CustomerLoginSid), `Login [${l.LoginName}]`])
            );

            const milestoneMap = new Map<string, string>(
                milestoneRows.map((m) => [String(m.CustomerMilestoneSid), `Milestone [${milestonesMap.get(String(m.MilestoneMasterSid)) ?? m.MilestoneMasterSid}]`])
            );

            const contactMap = new Map<string, string>(
                contactRows.map((c) => [String(c.CusBranchContactSid), `Contact [${c.ContactName} - ${c.ContactType}]`])
            );

            const brMap = new Map<string, string>(
                branchRows.map((b) => [String(b.CustomerBranchSid), b.BranchName])
            );

            return this.formatLogs(logs, {
                renameRules: [
                    ['CurrencyMasterSid', 'Currency', currencyMap],
                    ['StateMasterSid', 'State', stateMap],
                    ['CityMasterSid', 'City', cityMap],
                    ['Salesman', 'Salesperson', salesMap],
                    ['MenuMasterSid', 'Menu', menuMap],
                    ['CustomerBranchSid', 'Branch', brMap],
                ],
                arrayRules: [
                    ['DepartmentMasterSid', departmentMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getOrganizationLabel(log.tableName),
                    rowLabel: this.getOrganizationRowLabel(log, { branchMap, salesmanMap, emailMap, loginMap, milestoneMap, contactMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getPackageTypeLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'PackageTypeMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getTaxGroupLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'TaxGroup', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getPortMasterLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'PortMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [countryMap, stateMap, cityMap, zoneMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['CountryMasterSid']),
                    ids => this._db.countryMaster.findMany({
                        where: { CountryMasterSid: { in: ids } },
                        select: { CountryMasterSid: true, countryName: true }
                    }), 'CountryMasterSid', 'countryName'),

                this.buildScopedMap(this.collectIds(logs, ['StateMasterSid']),
                    ids => this._db.stateMaster.findMany({
                        where: { StateMasterSid: { in: ids } },
                        select: { StateMasterSid: true, stateName: true }
                    }), 'StateMasterSid', 'stateName'),

                this.buildScopedMap(this.collectIds(logs, ['CityMasterSid']),
                    ids => this._db.cityMaster.findMany({
                        where: { CityMasterSid: { in: ids } },
                        select: { CityMasterSid: true, cityName: true }
                    }), 'CityMasterSid', 'cityName'),

                this.buildScopedMap(this.collectIds(logs, ['ZoneMasterSid']),
                    ids => this._db.zoneMaster.findMany({
                        where: { ZoneMasterSid: { in: ids } },
                        select: { ZoneMasterSid: true, ZoneName: true }
                    }), 'ZoneMasterSid', 'ZoneName'),
            ]);

            return this.formatLogs(logs, {
                renameRules: [
                    ['CountryMasterSid', 'Country', countryMap],
                    ['StateMasterSid', 'State', stateMap],
                    ['CityMasterSid', 'City', cityMap],
                    ['ZoneMasterSid', 'Region', zoneMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['CBMRequire', AuditLogService.YES_NO_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getProductLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'ProductMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const typeMap = {
                1: 'General',
                2: 'Haz',
                3: 'Frozen'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['ProductType', typeMap],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getVoyageLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'VoyageMasterHeader', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [portMap, customerMap, vesselMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['POLSid', 'PODSid']),
                    ids => this._db.portMaster.findMany({
                        where: { PortMasterSid: { in: ids } },
                        select: { PortMasterSid: true, PortCode: true }
                    }), 'PortMasterSid', 'PortCode'),

                this.buildScopedMap(this.collectIds(logs, ['Carrier']),
                    ids => this._db.customerMaster.findMany({
                        where: { CustomerMasterSid: { in: ids } },
                        select: { CustomerMasterSid: true, CustomerName: true }
                    }), 'CustomerMasterSid', 'CustomerName'),

                this.buildScopedMap(this.collectIds(logs, ['VesselMasterSid']),
                    ids => this._db.vesselMaster.findMany({
                        where: { VesselMasterSid: { in: ids } },
                        select: { VesselMasterSid: true, VesselName: true }
                    }), 'VesselMasterSid', 'VesselName'),
            ]);

            return this.formatLogs(logs, {
                renameRules: [
                    ['Carrier', 'Carrier', customerMap],
                    ['POLSid', 'POL', portMap],
                    ['PODSid', 'POD', portMap],
                    ['VesselMasterSid', 'Vessel', vesselMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['CoLoad', AuditLogService.YES_NO_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getSectorLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'SectorMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getUOMLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'UOMMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['VolumeReq', AuditLogService.YES_NO_MAP],
                    ['WeightReq', AuditLogService.YES_NO_MAP],
                    ['DimensionReq', AuditLogService.YES_NO_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getUnitLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'UnitMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
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
            TariffDetail: 'Detail',
        };
        return sectionMap[tableName] || tableName;
    }

    private async getTariffLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
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
            ]);

            detailRows = fetchedDetails;

            const conditions = [
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

            const logs = await this.fetchLogs(conditions, query);

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const chargeCode = d.ChargeCode?.toString().trim() || d.TariffDetailSid;
                    const cargoType = d.CargoType?.toString().trim() || '';
                    return [String(d.TariffDetailSid), `Detail [${chargeCode} - ${cargoType}]`];
                })
            );

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getTariffLabel(log.tableName),
                    rowLabel: this.getTariffRowLabel(log, { detailMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getTaxLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'TaxMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const taxGroupMap = await this.buildScopedMap(this.collectIds(logs, ['TaxGroupSid']),
                ids => this._db.taxGroup.findMany({
                    where: { TaxGroupSid: { in: ids } },
                    select: { TaxGroupSid: true, TaxGroup: true }
                }), 'TaxGroupSid', 'TaxGroup');

            return this.formatLogs(logs, {
                renameRules: [
                    ['TaxGroupSid', 'TaxGroup', taxGroupMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['TaxExempt', AuditLogService.YES_NO_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getZoneLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'ZoneMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getVesselLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'VesselMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
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
            StdTariffDetail: 'Detail',
        };
        return sectionMap[tableName] || tableName;
    }

    private async getStdChargeLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
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
            ]);

            detailRows = fetchedDetails;

            const conditions = [
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

            const logs = await this.fetchLogs(conditions, query);

            const [chargeMap, uomMap, currencyMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['ChargeMasterSid']),
                    ids => this._db.chargeMaster.findMany({
                        where: { ChargeMasterSid: { in: ids } },
                        select: { ChargeMasterSid: true, chargeCode: true }
                    }), 'ChargeMasterSid', 'chargeCode'),

                this.buildScopedMap(this.collectIds(logs, ['UomSid']),
                    ids => this._db.uOMMaster.findMany({
                        where: { UOMMasterSid: { in: ids } },
                        select: { UOMMasterSid: true, UOMCode: true }
                    }), 'UOMMasterSid', 'UOMCode'),

                this.buildScopedMap(this.collectIds(logs, ['SaleCurrency', 'CostCurrency']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),
            ]);

            // detailMap needs charge codes for ALL detail rows (not just logged ones),
            // so load the charge labels for the detail rows' ChargeMasterSid set.
            const detailChargeMap = await this.buildScopedMap(
                [...new Set(detailRows.map(d => Number(d.ChargeMasterSid)).filter(n => !Number.isNaN(n)))],
                ids => this._db.chargeMaster.findMany({
                    where: { ChargeMasterSid: { in: ids } },
                    select: { ChargeMasterSid: true, chargeCode: true }
                }), 'ChargeMasterSid', 'chargeCode');

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const chargeCode = detailChargeMap.get(String(d.ChargeMasterSid)) || d.StdTariffDetailSid;
                    const cargoType = d.CargoType?.toString().trim() || '';
                    return [String(d.StdTariffDetailSid), `Detail [${chargeCode} - ${cargoType}]`];
                })
            );

            return this.formatLogs(logs, {
                renameRules: [
                    ['ChargeMasterSid', 'Charge', chargeMap],
                    ['UomSid', 'UOM', uomMap],
                    ['SaleCurrency', 'SalesCurrency', currencyMap],
                    ['CostCurrency', 'CostCurrency', currencyMap],
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getStdChargeLabel(log.tableName),
                    rowLabel: this.getStdChargeRowLabel(log, { detailMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
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
            TermsAndConditionsDetail: 'Detail',
        };
        return sectionMap[tableName] || tableName;
    }

    private async getTermsLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            let detailRows: any[] = [];

            const termSid = Number(recordId);

            const [
                terms
            ] = await Promise.all([
                this._db.termsAndConditionsDetail.findMany({
                    where: { TermsAndConditionsMasterSid: termSid },
                    select: {
                        TermsAndConditionsDetailSid: true,
                        TandC: true,
                    }
                })
            ]);

            detailRows = terms;

            const conditions = [
                {
                    tableName: 'TermsAndConditionsMaster',
                    recordId: recordId
                },
                ...(detailRows.length
                    ? [{
                        tableName: 'TermsAndConditionsDetail',
                        recordId: { in: detailRows.map(d => String(d.TermsAndConditionsDetailSid)) }
                    }]
                    : [])
            ];

            const logs = await this.fetchLogs(conditions, query);

            const detailMap = new Map<string, string>(
                detailRows.map((d) => [String(d.TermsAndConditionsDetailSid), d.TandC])
            );

            const yesNoMap = {
                Y: 'Yes',
                N: 'No'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['IsDefaut', yesNoMap],
                ],
                ignored: ['TaxGroupSid'],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getTermsLabel(log.tableName),
                    rowLabel: this.getTermsRowLabel(log, { detailMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getPrintLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'PrintMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const menuMap = await this.buildScopedMap(this.collectIds(logs, ['MenuMasterSid']),
                ids => this._db.menuMaster.findMany({
                    where: { MenuMasterSid: { in: ids } },
                    select: { MenuMasterSid: true, MenuName: true }
                }), 'MenuMasterSid', 'MenuName');

            return this.formatLogs(logs, {
                renameRules: [
                    ['MenuMasterSid', 'Menu', menuMap],
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getCountryLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'CountryMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [currencyMap, zoneMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['CurrencyMasterSid']),
                    ids => this._db.currencyMaster.findMany({
                        where: { CurrencyMasterSid: { in: ids } },
                        select: { CurrencyMasterSid: true, currencyCode: true }
                    }), 'CurrencyMasterSid', 'currencyCode'),

                this.buildScopedMap(this.collectIds(logs, ['ZoneMasterSid']),
                    ids => this._db.zoneMaster.findMany({
                        where: { ZoneMasterSid: { in: ids } },
                        select: { ZoneMasterSid: true, ZoneName: true }
                    }), 'ZoneMasterSid', 'ZoneName'),
            ]);

            return this.formatLogs(logs, {
                renameRules: [
                    ['CurrencyMasterSid', 'Currency', currencyMap],
                    ['ZoneMasterSid', 'Zone', zoneMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getStateLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'StateMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [countryMap, zoneMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['CountryMasterSid']),
                    ids => this._db.countryMaster.findMany({
                        where: { CountryMasterSid: { in: ids } },
                        select: { CountryMasterSid: true, countryName: true }
                    }), 'CountryMasterSid', 'countryName'),

                this.buildScopedMap(this.collectIds(logs, ['ZoneMasterSid']),
                    ids => this._db.zoneMaster.findMany({
                        where: { ZoneMasterSid: { in: ids } },
                        select: { ZoneMasterSid: true, ZoneName: true }
                    }), 'ZoneMasterSid', 'ZoneName'),
            ]);

            return this.formatLogs(logs, {
                renameRules: [
                    ['CountryMasterSid', 'Country', countryMap],
                    ['ZoneMasterSid', 'Zone', zoneMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['IsUnionTerritory', AuditLogService.YES_NO_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getIncoLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'IncoMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getImcoLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'ImcoMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            return this.formatLogs(logs, {
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private async getCityLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const conditions = [
                { tableName: 'CityMaster', recordId: recordId }
            ];

            const logs = await this.fetchLogs(conditions, query);

            const [countryMap, stateMap] = await Promise.all([
                this.buildScopedMap(this.collectIds(logs, ['CountryMasterSid']),
                    ids => this._db.countryMaster.findMany({
                        where: { CountryMasterSid: { in: ids } },
                        select: { CountryMasterSid: true, countryName: true }
                    }), 'CountryMasterSid', 'countryName'),

                this.buildScopedMap(this.collectIds(logs, ['StateMasterSid']),
                    ids => this._db.stateMaster.findMany({
                        where: { StateMasterSid: { in: ids } },
                        select: { StateMasterSid: true, stateName: true }
                    }), 'StateMasterSid', 'stateName'),
            ]);

            return this.formatLogs(logs, {
                renameRules: [
                    ['CountryMasterSid', 'Country', countryMap],
                    ['StateMasterSid', 'State', stateMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                ],
                ignored: ['TaxGroupSid'],
            });
        } catch (error) {
            return this.fail(error);
        }
    }

    private getUserRowLabel(
        log: any,
        rowLabelMaps: {
            companyMap: Map<string, string>;
            branchMap: Map<string, string>;
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
                    `Branch [${newVal.BranchName || oldVal.BranchName || recordId}]`
                );
            default:
                return null;
        }
    }

    private getUserLabel(tableName: string): string {
        const sectionMap: Record<string, string> = {
            UserMaster: 'User',
            UserCompanyMaster: 'Company',
            UserBranchMaster: 'Branch',
        };

        return sectionMap[tableName] || tableName;
    }

    private async getUserLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
            const userid = Number(recordId);

            const [
                companyRows,
                branchRows,
            ] = await Promise.all([
                this._db.userCompanyMaster.findMany({
                    where: { UserMasterSid: userid },
                    select: { UserCompanyMasterSid: true, CompanyMasterSid: true }
                }),
                this._db.userBranchMaster.findMany({
                    where: { UserMasterSid: userid },
                    select: {
                        UserBranchMasterSid: true,
                        BranchMasterSid: true,
                        CompanyMasterSid: true,
                    }
                }),
            ]);

            const conditions = [
                {
                    tableName: 'UserMaster',
                    recordId: recordId
                },
                ...(companyRows.length
                    ? [{ tableName: 'UserCompanyMaster', recordId: { in: companyRows.map(c => String(c.UserCompanyMasterSid)) } }]
                    : []),
                ...(branchRows.length
                    ? [{ tableName: 'UserBranchMaster', recordId: { in: branchRows.map(b => String(b.UserBranchMasterSid)) } }]
                    : []),
            ];

            const logs = await this.fetchLogs(conditions, query);

            // Company/branch label maps are needed for the row-label decorators of the
            // sub-rows we already fetched, so they must cover those rows' FK ids — collect
            // those ids together with any referenced in the logs themselves.
            const companyIds = [
                ...this.collectIds(logs, ['CompanyMasterSid']),
                ...companyRows.map(c => Number(c.CompanyMasterSid)),
                ...branchRows.map(b => Number(b.CompanyMasterSid)),
            ].filter(n => !Number.isNaN(n));

            const branchIds = [
                ...this.collectIds(logs, ['BranchMasterSid']),
                ...branchRows.map(b => Number(b.BranchMasterSid)),
            ].filter(n => !Number.isNaN(n));

            const [companydataMap, branchdataMap, userTypeMap, userMap, countryMap] = await Promise.all([
                this.buildScopedMap([...new Set(companyIds)],
                    ids => this._db.companyMaster.findMany({
                        where: { CompanyMasterSid: { in: ids } },
                        select: { CompanyMasterSid: true, companyName: true }
                    }), 'CompanyMasterSid', 'companyName'),

                this.buildScopedMap([...new Set(branchIds)],
                    ids => this._db.branchMaster.findMany({
                        where: { BranchMasterSid: { in: ids } },
                        select: { BranchMasterSid: true, branchName: true }
                    }), 'BranchMasterSid', 'branchName'),

                this.buildScopedMap(this.collectIds(logs, ['userTypeId']),
                    ids => this._db.userType.findMany({
                        where: { UserTypeSid: { in: ids } },
                        select: { UserTypeSid: true, name: true }
                    }), 'UserTypeSid', 'name'),

                this.buildScopedMap(this.collectIds(logs, ['DeptHead']),
                    ids => this._db.userMaster.findMany({
                        where: { UserMasterSid: { in: ids } },
                        select: { UserMasterSid: true, userName: true }
                    }), 'UserMasterSid', 'userName'),

                this.buildScopedMap(this.collectIds(logs, ['CountryMasterSid']),
                    ids => this._db.countryMaster.findMany({
                        where: { CountryMasterSid: { in: ids } },
                        select: { CountryMasterSid: true, countryName: true }
                    }), 'CountryMasterSid', 'countryName'),
            ]);

            const companyMap = new Map<string, string>(
                companyRows.map(c => [
                    String(c.UserCompanyMasterSid),
                    `Company ${companydataMap.get(String(c.CompanyMasterSid)) ?? c.CompanyMasterSid}`
                ])
            );

            const branchMap = new Map<string, string>(
                branchRows.map(b => [
                    String(b.UserBranchMasterSid),
                    `Branch ${branchdataMap.get(String(b.BranchMasterSid)) ?? b.BranchMasterSid} - ${companydataMap.get(String(b.CompanyMasterSid)) ?? b.CompanyMasterSid}`
                ])
            );

            const isMap = {
                1: 'Yes',
                0: 'No'
            } as Record<string, string>;

            return this.formatLogs(logs, {
                renameRules: [
                    ['userTypeId', 'UserType', userTypeMap],
                    ['DeptHead', 'ReportingTo', userMap],
                    ['CountryMasterSid', 'Country', countryMap],
                ],
                valueRules: [
                    ['status', AuditLogService.STATUS_MAP],
                    ['Status', AuditLogService.STATUS_MAP],
                    ['isSalesperson', isMap],
                    ['isLoginUser', AuditLogService.YES_NO_MAP],
                    ['GiveAccess', AuditLogService.YES_NO_MAP],
                    ['IsDefault', AuditLogService.YES_NO_MAP],
                ],
                ignored: [
                    'userPassword',
                    'UserMasterSid', 'BranchMasterSid', 'CompanyMasterSid',
                    'UserBranchMasterSid', 'UserCompanyMasterSid',
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getUserLabel(log.tableName),
                    rowLabel: this.getUserRowLabel(log, { companyMap, branchMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
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

    private async getReportMasterLogs(recordId?: string, query: AuditLogQuery = {}) {
        try {
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
            ]);

            detailRows = fetchedDetails;

            const conditions = [
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

            const logs = await this.fetchLogs(conditions, query);

            const companyMap = await this.buildScopedMap(this.collectIds(logs, ['ReportExcludedCompany']),
                ids => this._db.companyMaster.findMany({
                    where: { CompanyMasterSid: { in: ids } },
                    select: { CompanyMasterSid: true, companyName: true }
                }), 'CompanyMasterSid', 'companyName');

            const detailMap = new Map<string, string>(
                detailRows.map((d) => {
                    const parameter = d.ParameterName?.toString().trim() || d.ReportMasterDetailSid;
                    return [String(d.ReportMasterDetailSid), `Detail [${parameter}]`];
                })
            );

            return this.formatLogs(logs, {
                arrayRules: [
                    ['ReportExcludedCompany', companyMap],
                ],
                valueRules: [
                    ['Status', AuditLogService.STATUS_MAP],
                ],
                decorate: (log, oldVal, newVal) => ({
                    sectionLabel: this.getReportMasterLabel(log.tableName),
                    rowLabel: this.getReportMasterRowLabel(log, { detailMap }, oldVal, newVal),
                }),
            });
        } catch (error) {
            return this.fail(error);
        }
    }
}