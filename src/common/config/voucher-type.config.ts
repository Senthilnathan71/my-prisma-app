// ==============================
// Party vs Voucher Type → Debit/Credit Mapping
// ==============================
export const PARTY_VTYPE_DRCR_MAP = {
  "Invoice": { DrCr: "D" },          // Party (Customer) Debited
  "Vendor Invoice": { DrCr: "C" },   // Party (Vendor) Credited
  "Receipt": { DrCr: "C" },          // Party Credited (Customer pays)
  "Payment Voucher": { DrCr: "D" },  // Party Debited (We pay Vendor)
  "Debit Note": { DrCr: "D" },       // Party Debited (They owe us more)
  "Credit Note": { DrCr: "D" },      // Party Credited (We owe them)
  "Vendor Credit Note" : { DrCr: "C" }, // Party Debited (They owe us more)
  "Journal Voucher" : { DrCr : "D"} 
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
  "Invoice": { DrCr: "C" , Tax_Type : "Input" ,Ledger : 'Creditor'},
  "Vendor Invoice": { DrCr: "D", Tax_Type : "Output" , Ledger : "Debtor" },
  "Receipt": { DrCr: "C" , Tax_Type : null , Ledger : null },
  "Payment Voucher": { DrCr: "D" , Tax_Type : null , Ledger : null },
  "Debit Note": { DrCr: "D", Tax_Type : "Output" ,Ledger : null},
  "Credit Note": { DrCr: "C", Tax_Type : "Input" , Ledger : 'Debtor' },
  "Vendor Credit Note": { DrCr: "D", Tax_Type : "Input" , Ledger : 'Creditor' },
} as const;

export type TaxVoucherType = keyof typeof TAX_VTYPE_DRCR_MAP;
export type TaxDrCrType = typeof TAX_VTYPE_DRCR_MAP[TaxVoucherType]["DrCr"];
export type TaxLedgerType =
  typeof TAX_VTYPE_DRCR_MAP[TaxVoucherType]["Ledger"];

export const getTaxDrCr = (voucherType: TaxVoucherType): TaxDrCrType | undefined => {
  return TAX_VTYPE_DRCR_MAP[voucherType]?.DrCr;
};

export const getTaxLedger = (voucherType: TaxVoucherType): TaxLedgerType | undefined => {
  return TAX_VTYPE_DRCR_MAP[voucherType]?.Ledger;
};


/**
 * Voucher Type those can have exchange rate jv
 * exchange rate jv is created when :
 * Sum of currency debits and credits = 0
 * Sum of local debits and credits > 0
 */
const typeWithExJv = ["Receipt", "Payment Voucher","Journal Voucher"];
export const checkIfExJvApplicable = (voucherType: string): boolean => {
  return typeWithExJv.includes(voucherType);
};

/**
 * Voucher Type those can have Voucher Matching
 * Voucher Matching is created when :
 * We generate a invoice for a customer
 * The customer pays us back
 * We have a matching record for the invoice
 */
const typeWithMatching = ["Credit Note", "Vendor Credit Note", "Payment Voucher", "Receipt"];
export const checkIfMatchingApplicable = (voucherType: string): boolean => {
  return typeWithMatching.includes(voucherType);
};
