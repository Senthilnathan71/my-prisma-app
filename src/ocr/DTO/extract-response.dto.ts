export interface ExtractedInvoice {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  place_of_supply: string | null;
  currency: string | null;
  charge_heading?: string | null;
  seller: {
    name: string | null;
    address: string | null;
  };
  buyer: {
    name: string | null;
    address: string | null;
    vat_no: string | null;
  };
  shipping: {
    shipper: string | null;
    consignee: string | null;
    hbl: string | null;
    mbl: string | null;
    vessel: string | null;
    voyage: string | null;
    loading_port: string | null;
    destination: string | null;
    job_number: string | null;
  };
  line_items: Array<{
    sno: number;
    description: string | null;
    hsn_sac: string | null;
    currency: string | null;
    unit?: string | null;
    qty: number | null;
    amount_per_qty?: number | null;
    exchange_rate?: number | null;
    fcy_amount?: number | null;
    taxable_value: number | null;
    non_taxable_amount?: number | null;
    vat_percent: number | null;
    vat_amount: number | null;
    total: number | null;
    rate: number | null;
  }>;
  subtotal: number | null;
  total_vat: number | null;
  grand_total: number | null;
  amount_in_words: string | null;
}

export interface OcrExtractResponse {
  success: boolean;
  documentType: string;
  rawText: string;
  extractedData: ExtractedInvoice | null;
  model: string;
  processingTime: {
    ocrMs: number;
    llmMs: number;
    totalMs: number;
  };
  error?: string;
}

export interface OcrHealthResponse {
  ocr: boolean;
  llm: boolean;
  models: string[];
}
