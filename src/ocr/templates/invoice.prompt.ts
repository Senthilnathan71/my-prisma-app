/**
 * Prompt templates for extracting structured data from OCR text.
 * Each document type has its own prompt with specific rules and JSON structure.
 * 
 * IMPORTANT: When tuning prompts, test with real invoices from Postman first:
 * POST http://192.168.2.12:11434/api/generate
 * 
 * Tips for better accuracy:
 * - Add RULES to clarify ambiguous fields (e.g., seller vs buyer)
 * - Include field descriptions in JSON template for guidance
 * - Keep prompts concise — fewer tokens = faster response
 * - Always end with "JSON only:" to prevent LLM explanations
 */

export function buildInvoicePrompt(ocrText: string): string {
  return `You are an invoice data extractor for a freight forwarding company.

RULES:
- The company issuing the invoice is the SELLER (usually the logistics/freight company)
- BILLED TO is the BUYER (the customer)
- Extract ALL line item columns accurately: qty, rate, vat%, vat amount
- Dates should be in DD/MM/YYYY format as they appear
- Amounts should be numbers without currency symbols
- Use null only if a field is truly absent from the document

Return this exact JSON structure:
{"invoice_number":"","invoice_date":"","due_date":"","place_of_supply":"","currency":"","seller":{"name":"the company issuing invoice","address":""},"buyer":{"name":"BILLED TO party","address":"","vat_no":""},"shipping":{"shipper":"","consignee":"","hbl":"","mbl":"","vessel":"","voyage":"","loading_port":"","destination":"","job_number":""},"line_items":[{"sno":1,"description":"","hsn_sac":"","currency":"","qty":0,"rate":0,"taxable_value":0,"vat_percent":0,"vat_amount":0,"total":0}],"subtotal":0,"total_vat":0,"grand_total":0,"amount_in_words":""}

INVOICE TEXT:
${ocrText}

JSON only:`;
}

export function buildBillOfLadingPrompt(ocrText: string): string {
  return `You are a Bill of Lading data extractor for a freight forwarding company.

RULES:
- Extract all party information: shipper, consignee, notify party
- Container numbers follow format: 4 letters + 7 digits (e.g., MSCU7234561)
- Port names should include country where visible
- Use null only if a field is truly absent

Return this exact JSON structure:
{"bl_number":"","date_of_issue":"","shipper":{"name":"","address":""},"consignee":{"name":"","address":""},"notify_party":{"name":"","address":""},"vessel_name":"","voyage_number":"","port_of_loading":"","port_of_discharge":"","place_of_receipt":"","place_of_delivery":"","containers":[{"number":"","type":"","seal":""}],"cargo":{"description":"","packages":"","gross_weight":"","measurement":"","marks_and_numbers":""},"freight_terms":""}

DOCUMENT TEXT:
${ocrText}

JSON only:`;
}

export function buildPackingListPrompt(ocrText: string): string {
  return `You are a Packing List data extractor for a freight forwarding company.

RULES:
- Extract all item details with quantities and weights
- Net weight and gross weight should be numbers
- Dimensions should be preserved as they appear
- Use null only if a field is truly absent

Return this exact JSON structure:
{"reference_number":"","date":"","shipper":{"name":"","address":""},"consignee":{"name":"","address":""},"items":[{"sno":1,"description":"","quantity":0,"net_weight":0,"gross_weight":0,"dimensions":""}],"total_packages":0,"total_net_weight":0,"total_gross_weight":0}

DOCUMENT TEXT:
${ocrText}

JSON only:`;
}

/**
 * Returns the appropriate prompt builder for the given document type.
 */
export function getPromptBuilder(documentType: string): (ocrText: string) => string {
  switch (documentType) {
    case 'invoice':
      return buildInvoicePrompt;
    case 'bill_of_lading':
      return buildBillOfLadingPrompt;
    case 'packing_list':
      return buildPackingListPrompt;
    default:
      return buildInvoicePrompt;
  }
}
