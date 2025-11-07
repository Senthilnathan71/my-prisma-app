// ==============================
// Party vs Voucher Type → Debit/Credit Mapping
// ==============================
export const PARTY_VTYPE_DRCR_MAP = {
  "Invoice": { DrCr: "D" },          // Party (Customer) Debited
  "Vendor Invoice": { DrCr: "C" },   // Party (Vendor) Credited
  "Receipt": { DrCr: "C" },          // Party Credited (Customer pays)
  "Payment Voucher": { DrCr: "D" },  // Party Debited (We pay Vendor)
  "Debit Note": { DrCr: "D" },       // Party Debited (They owe us more)
  "Credit Note": { DrCr: "C" },      // Party Credited (We owe them)
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
  "Invoice": { DrCr: "C" , Tax_Type : "Input" },
  "Vendor Invoice": { DrCr: "D", Tax_Type : "Output" },
  "Receipt": { DrCr: "C" },
  "Payment Voucher": { DrCr: "D" },
  "Debit Note": { DrCr: "C", Tax_Type : "Output" },
  "Credit Note": { DrCr: "D", Tax_Type : "Input" },
} as const;

export type TaxVoucherType = keyof typeof TAX_VTYPE_DRCR_MAP;
export type TaxDrCrType = typeof TAX_VTYPE_DRCR_MAP[TaxVoucherType]["DrCr"];

export const getTaxDrCr = (voucherType: TaxVoucherType): TaxDrCrType | undefined => {
  return TAX_VTYPE_DRCR_MAP[voucherType]?.DrCr;
};
