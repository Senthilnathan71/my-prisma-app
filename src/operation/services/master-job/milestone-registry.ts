export type MilestoneCode =
    | 'PKG_WT_CBM'
    | 'CONTAINER_MAPPING'
    | 'SI_CONFIRMED'
    | 'CARGO_ARRIVAL_NOTICE'
    | 'CARGO_RECEIVED'
    | 'PRE_ALERT'
    | 'INVOICE_OPS'
    | 'ATD'
    | 'CARGO_MANIFEST'
    | 'DO_ISSUED'
    | 'CARGO_DELIVERED'
    | 'INVOICE_ACC'
    | 'VENDOR_INVOICE'
    | 'REVENUE_ALL_HBL'
    | 'JOB_PROFITABLE'
    | 'UNBOOKED_COST'
    | 'UNBOOKED_REVENUE'
    | 'JOB_TO_SUBJOB'
    | 'ALL_PREVIOUS_CLOSED'
    | 'JOB_PROFIT_LOSS';

export type MilestoneCategory = 'documentation' | 'operation' | 'accounts' | 'jobClose';

export interface MilestoneDefinition {
    code: MilestoneCode;
    label: string;
    category: MilestoneCategory;
    applicableTo: 'export' | 'import' | 'both';
    nonBlocking?: boolean;
}

export const MILESTONE_REGISTRY: MilestoneDefinition[] = [
    // Documentation - Export
    { code: 'PKG_WT_CBM', label: 'All Houses have Pkg, Gross Wt, CBM', category: 'documentation', applicableTo: 'export' },
    { code: 'CONTAINER_MAPPING', label: 'Container mapping done', category: 'documentation', applicableTo: 'export' },
    { code: 'SI_CONFIRMED', label: 'Draft BL generated & SI confirmed', category: 'documentation', applicableTo: 'export' },
    // Documentation - Import
    { code: 'CARGO_ARRIVAL_NOTICE', label: 'Cargo Arrival Notice sent', category: 'documentation', applicableTo: 'import' },
    { code: 'CARGO_RECEIVED', label: 'Cargo Received', category: 'documentation', applicableTo: 'import' },
    // Operation - Export
    { code: 'PRE_ALERT', label: 'Pre Alert Sent', category: 'operation', applicableTo: 'export' },
    { code: 'INVOICE_OPS', label: 'Invoice generated', category: 'operation', applicableTo: 'both' },
    { code: 'ATD', label: 'ATD or On Board Confirmation', category: 'operation', applicableTo: 'export' },
    { code: 'CARGO_MANIFEST', label: 'Cargo Manifest generated', category: 'operation', applicableTo: 'export' },
    // Operation - Import
    { code: 'DO_ISSUED', label: 'Delivery Order Issued', category: 'operation', applicableTo: 'import' },
    { code: 'CARGO_DELIVERED', label: 'Cargo Delivered', category: 'operation', applicableTo: 'import' },
    // Accounts - Both
    { code: 'INVOICE_ACC', label: 'Invoice generated', category: 'accounts', applicableTo: 'both' },
    { code: 'VENDOR_INVOICE', label: 'Vendor Invoice booked', category: 'accounts', applicableTo: 'both' },
    { code: 'REVENUE_ALL_HBL', label: 'Revenue entered in all HBL', category: 'accounts', applicableTo: 'both' },
    { code: 'JOB_PROFITABLE', label: 'Job Profitable', category: 'accounts', applicableTo: 'both' },
    { code: 'UNBOOKED_COST', label: 'Unbooked cost to Accrual', category: 'accounts', applicableTo: 'both' },
    { code: 'UNBOOKED_REVENUE', label: 'Unbooked Revenue to WIP', category: 'accounts', applicableTo: 'both' },
    // Job Close - Both
    { code: 'JOB_TO_SUBJOB', label: 'Job to SubJob done', category: 'jobClose', applicableTo: 'both' },
    { code: 'ALL_PREVIOUS_CLOSED', label: 'All previous closers done', category: 'jobClose', applicableTo: 'both' },
    { code: 'JOB_PROFIT_LOSS', label: 'Job Profit or Loss', category: 'jobClose', applicableTo: 'both', nonBlocking: true },
];

/**
 * Returns the default milestone codes for a given category and export/import type.
 * This matches the original hardcoded behavior.
 */
export function getDefaultMilestoneCodes(category: MilestoneCategory, exportImport: string): MilestoneCode[] {
    const isExport = exportImport?.toLowerCase() === 'export';
    return MILESTONE_REGISTRY
        .filter(m => m.category === category)
        .filter(m => m.applicableTo === 'both' || (isExport ? m.applicableTo === 'export' : m.applicableTo === 'import'))
        .map(m => m.code);
}

/**
 * Lookup a milestone definition by its code.
 */
export function getMilestoneByCode(code: string): MilestoneDefinition | undefined {
    return MILESTONE_REGISTRY.find(m => m.code === code);
}
