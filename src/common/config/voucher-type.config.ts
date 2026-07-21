// ==============================
// Document Type Codes
// ==============================
export const DOC_TYPE_CODE = {
  INVOICE: 'INV',
  INVOICE_NON_JOB: 'NIN',
  VENDOR_INVOICE: 'VIN',
  CREDIT_NOTE: 'CRN',
  RECEIPT: 'RPT',
  PAYMENT: 'PMT',
  VENDOR_CREDIT_NOTE: 'VRN',
  CREDIT_NOTE_NON_JOB: 'NCN',
  JOURNAL_VOUCHER: 'JV',
  INTER_BRANCH_JV: 'IJV',
  REVERSAL_JOURNAL_VOUCHER: 'RJV',
  VOUCHER_MATCHING : 'VM'
} as const;

export type DocTypeCode = typeof DOC_TYPE_CODE[keyof typeof DOC_TYPE_CODE];

// ==============================
// Party vs Voucher Type → Debit/Credit Mapping
// ==============================
export const PARTY_VTYPE_DRCR_MAP = {
  "INV": { DrCr: "D" },   // Party (Customer) Debited
  "NIN": { DrCr: "D" },   // Party (Customer) Debited - Non Job Invoice
  "VIN": { DrCr: "C" },   // Party (Vendor) Credited
  "RPT": { DrCr: "C" },   // Party Credited (Customer pays)
  "PMT": { DrCr: "D" },   // Party Debited (We pay Vendor)
  "CRN": { DrCr: "C" },   // Party Credited (We owe them)
  "NCN": { DrCr: "C" },   // Party Credited - Non Job Credit Note (mirrors CRN)
  "VRN": { DrCr: "D" },   // Party Debited (They owe us more)
  "JV":  { DrCr: "D" },   // Journal Voucher
} as const;

export type VoucherType = keyof typeof PARTY_VTYPE_DRCR_MAP;
export type DrCrType = typeof PARTY_VTYPE_DRCR_MAP[VoucherType]["DrCr"];

export const getPartyDrCr = (voucherType: VoucherType | string): DrCrType | undefined => {
  return PARTY_VTYPE_DRCR_MAP[voucherType]?.DrCr;
};

// ==============================
// Tax vs Voucher Type → Debit/Credit Mapping
// ==============================
// Generally, tax follows how it impacts company books:
// - Output Tax (on Invoice) → Credit (liability)
// - Input Tax (on Vendor Invoice) → Debit (asset)
// - For Receipts/Payments, depends on nature of underlying transaction
export const TAX_VTYPE_DRCR_MAP = {
  "INV": { DrCr: "C" , Tax_Type : "Output" ,Ledger : 'Creditor'},
  "NIN": { DrCr: "C" , Tax_Type : "Output" ,Ledger : 'Creditor'},
  "VIN": { DrCr: "D", Tax_Type : "Input" , Ledger : "Debtor" },
  "RPT": { DrCr: "C" , Tax_Type : null , Ledger : null },
  "PMT": { DrCr: "D" , Tax_Type : "Input" , Ledger : "Debtor" },
  "CRN": { DrCr: "D", Tax_Type : "Output" , Ledger : 'Creditor' },
  "NCN": { DrCr: "D", Tax_Type : "Output" , Ledger : 'Creditor' }, // Non Job Credit Note (mirrors CRN)
  "VRN": { DrCr: "C", Tax_Type : "Input" , Ledger : 'Debtor' },
  "JV":  { DrCr: null, Tax_Type : null , Ledger : null }, // Handled by Ledger Type of that particular detail's ledger
} as const;

export type TaxVoucherType = keyof typeof TAX_VTYPE_DRCR_MAP;
export type TaxDrCrType = typeof TAX_VTYPE_DRCR_MAP[TaxVoucherType]["DrCr"];
export type TaxInputOutputType = typeof TAX_VTYPE_DRCR_MAP[TaxVoucherType]["Tax_Type"];
export type TaxLedgerType =
  typeof TAX_VTYPE_DRCR_MAP[TaxVoucherType]["Ledger"];

export const getTaxDrCr = (voucherType: TaxVoucherType): TaxDrCrType | undefined => {
  return TAX_VTYPE_DRCR_MAP[voucherType]?.DrCr;
};

export const getTaxInputOutput = (voucherType: TaxVoucherType): TaxInputOutputType | undefined => {
  return TAX_VTYPE_DRCR_MAP[voucherType]?.Tax_Type;
};

export const getTaxLedger = (voucherType: TaxVoucherType): TaxLedgerType | undefined => {
  return TAX_VTYPE_DRCR_MAP[voucherType]?.Ledger;
};


// ==============================
// Ledger Types allowed per Voucher Type (for COA dropdown filtering)
// ==============================
// Full ledger-type vocabulary (mirrors COAMaster.LedgerType values / admin modeOfledgertype list)
const ALL_LEDGER_TYPES = [
  'Accrual','Asset','Bank','Cash','Cost','Depreciation','Expenses GST','Imprest',
  'Income GST','Income Tax Payable','Income Tax Receivable','Input Tax','Liabilities',
  'Other Cost','Other Revenue','Output Tax','Revenue','Sy Cr','Sy Dr',
  'TDS Payable','TDS Receivable','Inter Branch','Other Cost & Revenue','Asset and Liability',
];
const REVENUE_SIDE = ['Revenue','Other Revenue','Income GST','Output Tax','TDS Receivable','Sy Dr','Other Cost & Revenue','Asset and Liability'];
const COST_SIDE    = ['Other Cost','Cost','Expenses GST','Input Tax','TDS Payable','Imprest','Asset','Sy Cr','Other Cost & Revenue','Asset and Liability'];

// Configurable ceiling per voucher type — also the *posted-mode* / fallback definition.
export const VOUCHER_LEDGER_TYPE_MAP: Record<string, string[]> = {
  // Cash / Bank / Sy Dr | Sy Cr are NOT here — they come from the Type-aware mandatory floor
  // (getMandatoryLedgerTypes) so a Cash receipt never offers Bank, etc. These are the charge/tax types.
  PMT: ['Other Cost','Cost','Expenses GST','Imprest','Income Tax Payable','TDS Payable','Input Tax','Asset','Other Cost & Revenue','Asset and Liability'],
  RPT: ['Other Cost','Other Revenue','Income GST','TDS Receivable','Output Tax','Other Cost & Revenue','Asset and Liability'],
  INV: REVENUE_SIDE, NIN: ALL_LEDGER_TYPES, CRN: ALL_LEDGER_TYPES,
  NCN: ALL_LEDGER_TYPES,
  VIN: ALL_LEDGER_TYPES, VRN: ALL_LEDGER_TYPES,
  JV:  ALL_LEDGER_TYPES, RJV: ALL_LEDGER_TYPES,
  VM:  ['Sy Dr','Sy Cr'],
};

export const getAllowedLedgerTypes = (voucherType: string): string[] => {
  return VOUCHER_LEDGER_TYPE_MAP[voucherType] ?? [];
};

// Mandatory ("floor") ledger types: always offered regardless of the configured AllowedLedgerTypes.
// Only RPT/PMT/VM force a floor. RPT/PMT are Type-aware (VoucherTypeMaster.Type = Cash/Bank/Others):
//   Cash → [Cash, Sy]   Bank → [Bank, Sy]   Others/unknown → [Cash, Bank, Sy]   (Sy = Sy Dr RPT / Sy Cr PMT)
// Every other document type's BEFORE-posting set is the manually-maintained DB AllowedLedgerTypes;
// POSTED vouchers fall back to the static VOUCHER_LEDGER_TYPE_MAP above.
export const MANDATORY_LEDGER_TYPE_MAP: Record<string, string[]> = {
  VM: ['Sy Dr','Sy Cr'],
};

const receiptPaymentMandatory = (type: string | undefined, sy: 'Sy Dr' | 'Sy Cr'): string[] => {
  switch ((type || '').trim().toLowerCase()) {
    case 'cash': return ['Cash', sy];
    case 'bank': return ['Bank', sy];
    default:     return ['Cash', 'Bank', sy]; // 'Others' / unresolved
  }
};

export const getMandatoryLedgerTypes = (voucherType: string, type?: string): string[] => {
  if (voucherType === 'RPT') return receiptPaymentMandatory(type, 'Sy Dr');
  if (voucherType === 'PMT') return receiptPaymentMandatory(type, 'Sy Cr');
  return MANDATORY_LEDGER_TYPE_MAP[voucherType] ?? [];
};

// Restricted ("blocklist") ledger types: never offered for a voucher type — subtracted from the
// resolved dropdown set even if present in AllowedLedgerTypes or the static VOUCHER_LEDGER_TYPE_MAP.
export const RESTRICTED_LEDGER_TYPE_MAP: Record<string, string[]> = {
  NIN: ['Revenue', 'Cost'],   // non-job invoice — exclude the generic Revenue / Cost types
  NCN: ['Revenue', 'Cost'],   // non-job credit note — same exclusion as NIN
};

export const getRestrictedLedgerTypes = (voucherType: string): string[] => {
  return RESTRICTED_LEDGER_TYPE_MAP[voucherType] ?? [];
};

/**
 * Voucher Type those can have exchange rate jv
 * exchange rate jv is created when :
 * Sum of currency debits and credits = 0
 * Sum of local debits and credits > 0
 */
const typeWithExJv: string[] = [DOC_TYPE_CODE.RECEIPT, DOC_TYPE_CODE.PAYMENT, DOC_TYPE_CODE.JOURNAL_VOUCHER];
export const checkIfExJvApplicable = (voucherType: string): boolean => {
  return typeWithExJv.includes(voucherType);
};

/**
 * Voucher Type those are reversals
 */
const reversalVouchers: string[] = [DOC_TYPE_CODE.CREDIT_NOTE, DOC_TYPE_CODE.CREDIT_NOTE_NON_JOB, DOC_TYPE_CODE.VENDOR_CREDIT_NOTE, DOC_TYPE_CODE.REVERSAL_JOURNAL_VOUCHER];
export const checkIfReversalApplicable = (voucherType: string): boolean => {
  return reversalVouchers.includes(voucherType);
};

/**
 * Voucher Type those can have Voucher Matching
 * Voucher Matching is created when :
 * We generate a invoice for a customer
 * The customer pays us back
 * We have a matching record for the invoice
 */
const typeWithMatching: string[] = [DOC_TYPE_CODE.CREDIT_NOTE, DOC_TYPE_CODE.CREDIT_NOTE_NON_JOB, DOC_TYPE_CODE.VENDOR_CREDIT_NOTE, DOC_TYPE_CODE.PAYMENT, DOC_TYPE_CODE.RECEIPT];
export const checkIfMatchingApplicable = (voucherType: string): boolean => {
  return typeWithMatching.includes(voucherType);
};
