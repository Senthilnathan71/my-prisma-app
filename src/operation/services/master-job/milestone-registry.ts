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
    failedLabel: string;
    category: MilestoneCategory;
    applicableTo: 'export' | 'import' | 'both';
    nonBlocking?: boolean;
}

export const MILESTONE_REGISTRY: MilestoneDefinition[] = [
    // Documentation - Export
    { code: 'PKG_WT_CBM', label: 'All Houses have Pkg, Gross Wt, CBM', failedLabel: "All Houses don't have Pkg, Gross Wt, CBM", category: 'documentation', applicableTo: 'export' },
    { code: 'CONTAINER_MAPPING', label: 'Container mapping done', failedLabel: 'Container mapping not done', category: 'documentation', applicableTo: 'export' },
    { code: 'SI_CONFIRMED', label: 'Draft BL generated & SI confirmed', failedLabel: 'Draft BL not generated & SI not confirmed', category: 'documentation', applicableTo: 'export' },
    // Documentation - Import
    { code: 'CARGO_ARRIVAL_NOTICE', label: 'Cargo Arrival Notice sent', failedLabel: 'Cargo Arrival Notice not sent', category: 'documentation', applicableTo: 'import' },
    { code: 'CARGO_RECEIVED', label: 'Cargo Received', failedLabel: 'Cargo not Received', category: 'documentation', applicableTo: 'import' },
    // Operation - Export
    { code: 'PRE_ALERT', label: 'Pre Alert Sent', failedLabel: 'Pre Alert not Sent', category: 'operation', applicableTo: 'export' },
    { code: 'INVOICE_OPS', label: 'Invoice generated', failedLabel: 'Invoice not generated', category: 'operation', applicableTo: 'both' },
    { code: 'ATD', label: 'ATD or On Board Confirmation', failedLabel: 'No ATD or On Board Confirmation', category: 'operation', applicableTo: 'export' },
    { code: 'CARGO_MANIFEST', label: 'Cargo Manifest generated', failedLabel: 'Cargo Manifest not generated', category: 'operation', applicableTo: 'export' },
    // Operation - Import
    { code: 'DO_ISSUED', label: 'Delivery Order Issued', failedLabel: 'Delivery Order not Issued', category: 'operation', applicableTo: 'import' },
    { code: 'CARGO_DELIVERED', label: 'Cargo Delivered', failedLabel: 'Cargo not Delivered', category: 'operation', applicableTo: 'import' },
    // Accounts - Both
    { code: 'INVOICE_ACC', label: 'Invoice generated', failedLabel: 'Invoice not generated', category: 'accounts', applicableTo: 'both' },
    { code: 'VENDOR_INVOICE', label: 'Vendor Invoice booked', failedLabel: 'Vendor Invoice not booked', category: 'accounts', applicableTo: 'both' },
    { code: 'REVENUE_ALL_HBL', label: 'Revenue entered in all HBL', failedLabel: 'Revenue not entered in all HBL', category: 'accounts', applicableTo: 'both' },
    { code: 'JOB_PROFITABLE', label: 'Job Profitable', failedLabel: 'Job not Profitable', category: 'accounts', applicableTo: 'both' },
    { code: 'UNBOOKED_COST', label: 'Unbooked cost to Accrual', failedLabel: 'Unbooked cost not moved to Accrual', category: 'accounts', applicableTo: 'both' },
    { code: 'UNBOOKED_REVENUE', label: 'Unbooked Revenue to WIP', failedLabel: 'Unbooked Revenue not moved to WIP', category: 'accounts', applicableTo: 'both' },
    // Job Close - Both
    { code: 'JOB_TO_SUBJOB', label: 'Job to SubJob done', failedLabel: 'Job to SubJob not done', category: 'jobClose', applicableTo: 'both' },
    { code: 'ALL_PREVIOUS_CLOSED', label: 'All previous closers done', failedLabel: 'All previous closers not done', category: 'jobClose', applicableTo: 'both' },
    { code: 'JOB_PROFIT_LOSS', label: 'Job Profit or Loss', failedLabel: 'Job Profit or Loss', category: 'jobClose', applicableTo: 'both', nonBlocking: true },
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
