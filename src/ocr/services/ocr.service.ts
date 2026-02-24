import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as pdfParse from 'pdf-parse';
import axios from 'axios';
import * as FormData from 'form-data';
import { ExtractedInvoice, OcrHealthResponse } from 'src/ocr/DTO/extract-response.dto';
import { getPromptBuilder } from 'src/ocr/templates/invoice.prompt';

@Injectable()
export class OcrService {
  private readonly ollamaHost: string;
  private readonly ollamaModel: string;
  private readonly ocrApiHost: string;

  constructor(
    private configService: ConfigService,
    private logger: Logger,
  ) {
    this.ollamaHost = this.configService.get('OLLAMA_HOST') || 'http://192.168.2.12:11434';
    this.ollamaModel = this.configService.get('OLLAMA_MODEL') || 'qwen2.5:3b';
    this.ocrApiHost = this.configService.get('OCR_API_HOST') || 'http://192.168.2.12:8090';

    this.logger.log(`OCR Service initialized — Ollama: ${this.ollamaHost}, Model: ${this.ollamaModel}, OCR API: ${this.ocrApiHost}`);
  }

  // ============================================================
  // MAIN METHOD: Extract structured data from uploaded PDF
  // ============================================================
  async extractFromPdf(fileBuffer: Buffer, fileName: string, documentType: string = 'invoice') {
    const startTime = Date.now();

    // STEP 1: Extract raw text from PDF
    this.logger.log(`Processing file: ${fileName}, type: ${documentType}`);
    let rawText = '';
    let ocrUsed = false;

    try {
      // Try digital extraction first (instant, no external API call)
      rawText = await this.extractDigitalText(fileBuffer);
      this.logger.log(`Digital extraction: ${rawText.length} characters`);
    } catch (error) {
      this.logger.warn(`Digital extraction failed: ${error.message}`);
    }

    const ocrEndTime = Date.now();

    // If digital text is too short or empty, fall back to EasyOCR
    if (!rawText || rawText.trim().length < 50) {
      this.logger.log('Digital text insufficient (<50 chars), sending to EasyOCR...');
      rawText = await this.runOcr(fileBuffer, fileName);
      ocrUsed = true;
      this.logger.log(`OCR extraction: ${rawText.length} characters`);
    }

    const ocrFinalTime = Date.now();

    // Validate we have enough text to work with
    if (!rawText || rawText.trim().length < 10) {
      throw new HttpException(
        'Could not extract any text from the PDF. Please check the file quality or ensure the PDF is not password-protected.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // STEP 2: Send to LLM for structured data extraction
    const llmStartTime = Date.now();
    const extractedData = await this.extractWithLlm(rawText, documentType);
    const normalizedData = this.normalizeInvoiceOutput(extractedData, rawText, documentType);
    const llmEndTime = Date.now();

    return {
      success: true,
      documentType,
      rawText,
      extractedData: normalizedData,
      ocrUsed,
      model: this.ollamaModel,
      processingTime: {
        ocrMs: ocrFinalTime - startTime,
        llmMs: llmEndTime - llmStartTime,
        totalMs: Date.now() - startTime,
      },
    };
  }

  // ============================================================
  // STEP 1a: Extract text from digital PDF using pdf-parse
  // This runs inside NestJS — no external API call needed
  // ============================================================
  private async extractDigitalText(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer, {
      normalizeWhitespace: true,
      max: 0, // Extract all pages
    });
    return data.text;
  }

  // ============================================================
  // STEP 1b: Send PDF to EasyOCR API for scanned PDFs
  // API running on: http://192.168.2.12:8090/ocr/extract
  // ============================================================
  private async runOcr(buffer: Buffer, fileName: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: fileName || 'document.pdf',
        contentType: 'application/pdf',
      });

      const response = await axios.post(
        `${this.ocrApiHost}/ocr/extract`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 120000, // 2 minutes — large PDFs can be slow
          maxContentLength: 50 * 1024 * 1024, // 50MB
        },
      );

      return response.data?.text || '';
    } catch (error) {
      this.logger.error(`EasyOCR API error: ${error.message}`);

      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          'OCR service is not running. Please contact the administrator.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (error.code === 'ETIMEDOUT') {
        throw new HttpException(
          'OCR processing timed out. Try with a smaller PDF.',
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      throw new HttpException(
        'OCR service is unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ============================================================
  // STEP 2: Send raw text to Ollama LLM with extraction prompt
  // API running on: http://192.168.2.12:11434/api/generate
  // ============================================================
  private async extractWithLlm(rawText: string, documentType: string): Promise<ExtractedInvoice | null> {
    // Get the right prompt builder for this document type
    const promptBuilder = getPromptBuilder(documentType);
    const prompt = promptBuilder(rawText);

    try {
      this.logger.log(`Sending to Ollama (model: ${this.ollamaModel})...`);

      const response = await axios.post(
        `${this.ollamaHost}/api/generate`,
        {
          model: this.ollamaModel,
          prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0,       // Deterministic — same input = same output
            num_predict: 4096,    // Allow large invoices with many line items
            num_thread: 40,       // Physical CPU cores on dofiapp1 server
          },
        },
        {
          timeout: 180000, // 3 minutes — LLM can be slow on first request
        },
      );

      const jsonText = response.data?.response;
      this.logger.log(`Ollama response received (${jsonText?.length || 0} chars)`);

      // Parse the JSON response
      const parsed = this.safeParseLlmJson(jsonText);
      if (parsed) {
        return parsed;
      }

      this.logger.warn(`Failed to parse LLM JSON response. Falling back to rule-based extraction. Snippet: ${jsonText?.substring(0, 200)}`);
      return null;
    } catch (error) {
      // Re-throw HttpException as-is
      if (error instanceof HttpException) throw error;

      this.logger.error(`Ollama API error: ${error.message}`);

      if (error.code === 'ECONNREFUSED') {
        throw new HttpException(
          'AI extraction service is not running. Please contact the administrator.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (error.code === 'ETIMEDOUT') {
        throw new HttpException(
          'AI extraction timed out. The document may be too complex. Try the 3B model.',
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      throw new HttpException(
        'AI extraction service is unavailable. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private normalizeInvoiceOutput(
    extractedData: ExtractedInvoice | null,
    rawText: string,
    documentType: string,
  ): ExtractedInvoice | null {
    if (documentType !== 'invoice') {
      return extractedData;
    }

    const fwaChargeRows = this.extractFwaChargeRows(rawText);
    const dwChargeRows = this.extractDwChargeRows(rawText);
    const chargeRows = fwaChargeRows.length > 0 ? fwaChargeRows : dwChargeRows;

    const inferred = this.extractInvoiceHeaderFromRawText(rawText);
    const inferredPartiesAndShipping = this.extractPartyAndShippingFromRawText(rawText);

    const base: ExtractedInvoice = extractedData ?? {
      invoice_number: inferred.invoice_number,
      invoice_date: inferred.invoice_date,
      due_date: null,
      place_of_supply: null,
      currency: inferred.currency,
      seller: { name: null, address: null },
      buyer: { name: null, address: null, vat_no: null },
      shipping: {
        shipper: null,
        consignee: null,
        hbl: null,
        mbl: null,
        vessel: null,
        voyage: null,
        loading_port: null,
        destination: null,
        job_number: null,
      },
      line_items: [],
      subtotal: null,
      total_vat: null,
      grand_total: null,
      amount_in_words: null,
    };

    const subtotalMatch = rawText.match(/Sub\s*Total\s*:\s*([0-9,]+\.\d{2})/i);
    const totalBeforeWordsMatch = rawText.match(/Total\s*:?\s*([0-9,]+\.\d{2})\s*[\r\n]+\s*Amount\s*In\s*Words/i);
    const detectedSubtotal = subtotalMatch
      ? Number.parseFloat(subtotalMatch[1].replace(/,/g, ''))
      : (totalBeforeWordsMatch ? Number.parseFloat(totalBeforeWordsMatch[1].replace(/,/g, '')) : null);

    const subtotal = chargeRows.reduce((sum, row) => sum + (row.total ?? 0), 0);
    const totalVat = chargeRows.reduce((sum, row) => sum + (row.vat_amount ?? 0), 0);

    return {
      ...base,
      charge_heading: base.charge_heading || (
        fwaChargeRows.length > 0
          ? 'Charges Unit Qty Amount / Qty Currency Ex.Rate FCY Amount Taxable Amount Non Taxable Amount Tax % Tax Amount Total Amount (AED)'
          : dwChargeRows.length > 0
            ? 'S.No Particulars Curr No. of Unit Rate ROE Taxable Amt VAT % VAT Amt Amt In AED Amt In USD'
            : null
      ),
      currency: base.currency || chargeRows[0]?.currency || inferred.currency || 'AED',
      seller: {
        name: this.firstNonEmpty(base.seller?.name, inferredPartiesAndShipping.seller.name),
        address: this.firstNonEmpty(base.seller?.address, inferredPartiesAndShipping.seller.address),
      },
      buyer: {
        name: this.firstNonEmpty(base.buyer?.name, inferredPartiesAndShipping.buyer.name),
        address: this.firstNonEmpty(base.buyer?.address, inferredPartiesAndShipping.buyer.address),
        vat_no: this.firstNonEmpty(base.buyer?.vat_no, inferredPartiesAndShipping.buyer.vat_no),
      },
      shipping: {
        shipper: this.firstNonEmpty(base.shipping?.shipper, inferredPartiesAndShipping.shipping.shipper),
        consignee: this.firstNonEmpty(base.shipping?.consignee, inferredPartiesAndShipping.shipping.consignee),
        hbl: this.firstNonEmpty(base.shipping?.hbl, inferredPartiesAndShipping.shipping.hbl),
        mbl: this.firstNonEmpty(base.shipping?.mbl, inferredPartiesAndShipping.shipping.mbl),
        vessel: this.firstNonEmpty(base.shipping?.vessel, inferredPartiesAndShipping.shipping.vessel),
        voyage: this.firstNonEmpty(base.shipping?.voyage, inferredPartiesAndShipping.shipping.voyage),
        loading_port: this.firstNonEmpty(base.shipping?.loading_port, inferredPartiesAndShipping.shipping.loading_port),
        destination: this.firstNonEmpty(base.shipping?.destination, inferredPartiesAndShipping.shipping.destination),
        job_number: this.firstNonEmpty(base.shipping?.job_number, inferredPartiesAndShipping.shipping.job_number),
      },
      line_items: chargeRows.length > 0
        ? (fwaChargeRows.length > 0 ? chargeRows.slice(0, 3) : chargeRows)
        : (base.line_items || []),
      subtotal: detectedSubtotal ?? (chargeRows.length > 0 ? subtotal : base.subtotal),
      total_vat: chargeRows.length > 0 ? totalVat : base.total_vat,
      grand_total: detectedSubtotal ?? (chargeRows.length > 0 ? subtotal : base.grand_total),
    };
  }

  private extractPartyAndShippingFromRawText(rawText: string): {
    seller: { name: string | null; address: string | null };
    buyer: { name: string | null; address: string | null; vat_no: string | null };
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
  } {
    const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);

    let sellerName: string | null = null;
    let sellerAddress: string | null = null;

    const sellerBlockMatch = normalized.match(
      /([A-Za-z][^\n]{2,})\n([^\n]{2,})\n([^\n]{2,})\nPhone\s*No\s*:\s*[^\n]+\nVAT\s*No\s*:\s*[^\n]+\nTAX\s*INVOICE/i
    );
    if (sellerBlockMatch) {
      sellerName = this.cleanCapturedValue(sellerBlockMatch[1]);
      sellerAddress = this.cleanCapturedValue(`${sellerBlockMatch[2]}, ${sellerBlockMatch[3]}`);
    }

    const taxInvoiceIndex = lines.findIndex(line => /tax\s+invoice/i.test(line));
    if (!sellerName && taxInvoiceIndex > 0) {
      const nearby = lines.slice(Math.max(0, taxInvoiceIndex - 10), taxInvoiceIndex);
      const phoneIndex = nearby.findIndex(line => /phone\s*no/i.test(line));
      const vatIndex = nearby.findIndex(line => /^vat\s*no/i.test(line));
      const endIndex = phoneIndex !== -1 ? phoneIndex : (vatIndex !== -1 ? vatIndex : nearby.length);
      const idLines = nearby
        .slice(0, endIndex)
        .filter(line => !/^(taxamount|vat|trn\s*no|invoice\s*no|printed by|page\s+\d+)/i.test(line));

      if (idLines.length > 0) {
        sellerName = this.cleanCapturedValue(idLines[0]);
        sellerAddress = this.cleanCapturedValue(idLines.slice(1).join(', '));
      }
    }

    const trnMatch = normalized.match(/(?:TRN\s*NO|VAT\s*\/?\s*GST\s*No|VAT\s*No|GSTIN)\s*:?\s*([A-Z0-9]+)/i);
    let vatNo = trnMatch ? this.cleanCapturedValue(trnMatch[1]) : null;

    const buyerName = this.captureAndClean(
      normalized,
      /(?:Bill(?:ed)?\s*To)\s*:?\s*([\s\S]*?)(?=Phone\s*:|Credit\s*Term\s*:|Invoice\s*No\.?:|Consignee\s*:|Shipper\s*:|VAT\s*No\.?:|$)/i
    );
    const buyerAddressRegex = this.captureAndClean(
      normalized,
      /(?:Bill(?:ed)?\s*To)\s*:?[\s\S]*?(?:Address\s*:\s*)([\s\S]*?)(?=Phone\s*:|Credit\s*Term\s*:|Invoice\s*No\.?:|Consignee\s*:|Shipper\s*:|$)/i
    );
    const billedToIndex = lines.findIndex(line => /bill(?:ed)?\s*to/i.test(line));
    let buyerNameLine = buyerName;
    let buyerAddressLine = buyerAddressRegex;
    if (billedToIndex !== -1) {
      const block: string[] = [];
      for (let i = billedToIndex + 1; i < Math.min(lines.length, billedToIndex + 6); i++) {
        const value = lines[i].replace(/^:\s*/, '').trim();
        if (!value || value === ':') continue;
        if (/^(invoice\s*no|invoice\s*date|vat\s*no|printed\s*by|tax\s*invoice)$/i.test(value)) break;
        block.push(value);
      }
      const buyerVat = this.extractValueByLabel(lines.slice(billedToIndex, Math.min(lines.length, billedToIndex + 12)), ['VAT No', 'VAT/GST No', 'GSTIN']);
      vatNo = this.firstNonEmpty(buyerVat, vatNo);
      if (block.length > 0) {
        buyerNameLine = this.firstNonEmpty(buyerNameLine, block[0]);
        buyerAddressLine = this.firstNonEmpty(buyerAddressLine, block.slice(1).join(', '));
      }
    }

    const mbl = this.firstNonEmpty(
      this.extractValueByLabel(lines, ['MBL', 'MBL / MAWB No', 'MBL/MAWB No']),
      this.captureAndClean(
      normalized,
      /MBL\s*\/?\s*MAWB\s*No\.?\s*:\s*([\s\S]*?)(?=Place\s*of\s*Receipt\s*:|Port\s*of\s*Loading\s*:|Vessel\s*\/\s*Flight\s*Name\s*:|$)/i
      )
    );
    const hbl = this.firstNonEmpty(
      this.extractValueByLabel(lines, ['HBL', 'HBL / AWB No', 'HBL/AWB No']),
      this.captureAndClean(
      normalized,
      /HBL\s*\/?\s*AWB\s*No\.?\s*:\s*([\s\S]*?)(?=Remarks\s*:|Description|Charges|$)/i
      )
    );
    const vessel = this.firstNonEmpty(
      this.extractValueByLabel(lines, ['Vessel Name', 'Vessel / Flight Name']),
      this.captureAndClean(
      normalized,
      /Vessel\s*\/?\s*Flight\s*Name\s*:\s*([\s\S]*?)(?=Place\s*of\s*Delivery\s*:|Voyage\s*\/?\s*Flight\s*No\.?\s*:|$)/i
      )
    );
    const voyage = this.firstNonEmpty(
      this.extractValueByLabel(lines, ['Voyage No', 'Voyage / Flight No']),
      this.captureAndClean(
      normalized,
      /Voyage\s*\/?\s*Flight\s*No\.?\s*:\s*([\s\S]*?)(?=ETD\s*:|Narration\s*:|Reference\s*No\.?\s*:|$)/i
      )
    );
    const loadingPort = this.firstNonEmpty(
      this.extractValueByLabel(lines, ['Loading Port', 'Port of Loading']),
      this.captureAndClean(
      normalized,
      /Port\s*of\s*Loading\s*:\s*([\s\S]*?)(?=Port\s*of\s*Discharge\s*:|Vessel\s*\/?\s*Flight\s*Name\s*:|$)/i
      )
    );
    const destination = this.firstNonEmpty(
      this.extractValueByLabel(lines, ['Final Destination', 'Destination', 'Port of Discharge', 'Place of Delivery']),
      this.captureAndClean(
        normalized,
        /Port\s*of\s*Discharge\s*:\s*([\s\S]*?)(?=Vessel\s*\/?\s*Flight\s*Name\s*:|Place\s*of\s*Delivery\s*:|$)/i
      ),
      this.captureAndClean(
        normalized,
        /Place\s*of\s*Delivery\s*:\s*([\s\S]*?)(?=POR\s*:|POF\s*:|Voyage\s*\/?\s*Flight\s*No\.?\s*:|$)/i
      ),
    );
    const jobNumber = this.firstNonEmpty(
      this.extractValueByLabel(lines, ['Job No', 'Job Number']),
      this.captureAndClean(
      normalized,
      /Job\s*No\.?\s*:\s*([\s\S]*?)(?=MBL\s*\/?\s*MAWB\s*No\.?\s*:|Place\s*of\s*Receipt\s*:|Port\s*of\s*Loading\s*:|$)/i
      )
    );

    return {
      seller: { name: sellerName, address: sellerAddress },
      buyer: { name: buyerNameLine, address: buyerAddressLine, vat_no: vatNo },
      shipping: {
        shipper: this.captureAndClean(normalized, /Shipper\s*:\s*([\s\S]*?)(?=Shipment\s*No\.?:|Consignee\s*:|$)/i),
        consignee: this.captureAndClean(normalized, /Consignee\s*:\s*([\s\S]*?)(?=Shipper\s*:|Shipment\s*No\.?:|$)/i),
        hbl,
        mbl,
        vessel,
        voyage,
        loading_port: loadingPort,
        destination,
        job_number: jobNumber,
      },
    };
  }

  private extractValueByLabel(lines: string[], labels: string[]): string | null {
    const normalizedLabels = labels.map(label => this.normalizeLabel(label));
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLabel = this.normalizeLabel(line);
      const matched = normalizedLabels.some(label =>
        lineLabel === label || lineLabel.startsWith(label)
      );
      if (!matched) continue;

      const inlineMatch = line.match(/:\s*(.+)$/);
      if (inlineMatch?.[1]) {
        return this.cleanCapturedValue(inlineMatch[1]);
      }

      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const next = lines[j].replace(/^:\s*/, '').trim();
        if (!next || next === ':') continue;
        if (/^(s\.?no|particulars|currency|invoice|billed\s*to|tax\s*invoice)$/i.test(next)) break;
        return this.cleanCapturedValue(next);
      }
    }
    return null;
  }

  private normalizeLabel(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private captureAndClean(text: string, pattern: RegExp): string | null {
    const match = text.match(pattern);
    if (!match || !match[1]) return null;
    return this.cleanCapturedValue(match[1]);
  }

  private cleanCapturedValue(value: string | null | undefined): string | null {
    if (!value) return null;
    const cleaned = value
      .replace(/\s+/g, ' ')
      .replace(/\s*\/\s*\d{1,2}-[A-Za-z]{3}-\d{2,4}\b/g, '')
      .replace(/(Phone|Credit\s*Term|Invoice\s*No\.?|Shipment\s*No\.?|Job\s*No\.?|MBL|HBL|Port\s*of\s*Loading|Port\s*of\s*Discharge|Vessel|Voyage)\s*:.*$/i, '')
      .trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  private firstNonEmpty(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
      if (value && value.toString().trim().length > 0) {
        return value.toString().trim();
      }
    }
    return null;
  }

  private extractInvoiceHeaderFromRawText(rawText: string): {
    invoice_number: string | null;
    invoice_date: string | null;
    currency: string | null;
  } {
    const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
    const invoiceLineMatch = rawText.match(/Invoice\s*No\.?\s*:?\s*([^\n\r]+)/i);
    const invoiceLine = invoiceLineMatch ? invoiceLineMatch[1].trim() : (this.extractValueByLabel(lines, ['Invoice No']) || '');

    let invoice_number: string | null = null;
    let invoice_date: string | null = null;

    if (invoiceLine) {
      const parts = invoiceLine.split('/').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        invoice_number = parts.slice(0, 3).join('/');
      } else {
        invoice_number = invoiceLine.split(/\s+/)[0] || null;
      }

      const inlineDateMatch = invoiceLine.match(/(\d{1,2}[\/-][A-Za-z0-9]{2,3}[\/-]\d{2,4})/);
      if (inlineDateMatch) {
        invoice_date = inlineDateMatch[1];
      }
    }

    if (!invoice_date) {
      invoice_date =
        this.extractValueByLabel(lines, ['Invoice Date']) ||
        ((rawText.match(/Invoice\s*Date\s*:?\s*([0-9]{1,2}[\/-][0-9A-Za-z]{2,3}[\/-][0-9]{2,4})/i) || [])[1] ?? null);
    }

    const currencyMatch =
      rawText.match(/Currency\s*:\s*([A-Z]{3})/i) ||
      rawText.match(/Currency\s*\/\s*Ex-Rate\s*:?\s*([A-Z]{3})/i);
    const currencyFromLine = this.extractValueByLabel(lines, ['Currency', 'Currency / Ex-Rate']);
    const currency = currencyMatch
      ? currencyMatch[1].toUpperCase()
      : (currencyFromLine ? currencyFromLine.split('/')[0].trim().toUpperCase() : null);

    return { invoice_number, invoice_date, currency };
  }

  private safeParseLlmJson(jsonText: string | undefined): ExtractedInvoice | null {
    if (!jsonText || typeof jsonText !== 'string') {
      return null;
    }

    const direct = this.tryParseJson(jsonText);
    if (direct) {
      return direct;
    }

    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sliced = jsonText.slice(firstBrace, lastBrace + 1);
      const parsed = this.tryParseJson(sliced);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private tryParseJson(text: string): ExtractedInvoice | null {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  private extractFwaChargeRows(rawText: string): ExtractedInvoice['line_items'] {
    const normalizedLines = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const headerIndex = normalizedLines.findIndex(line =>
      line.replace(/\s+/g, '').toLowerCase().includes('chargesunitqty'),
    );
    if (headerIndex === -1) {
      return [];
    }

    const footerIndex = normalizedLines.findIndex((line, index) =>
      index > headerIndex && /^sub\s*total/i.test(line),
    );
    const endIndex = footerIndex === -1 ? normalizedLines.length : footerIndex;

    const rows: ExtractedInvoice['line_items'] = [];
    const descriptionParts: string[] = [];

    for (let i = headerIndex + 1; i < endIndex; i++) {
      const line = normalizedLines[i];
      const parsed = this.parseFwaChargeValueLine(line);

      if (parsed) {
        const description = descriptionParts
          .filter(part => !/^(per|shipment)$/i.test(part))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (description) {
          const amountPerQty = parsed.fcyAmount;
          rows.push({
            sno: rows.length + 1,
            description,
            hsn_sac: null,
            currency: parsed.currency,
            unit: 'PER SHIPMENT',
            qty: 1,
            amount_per_qty: amountPerQty,
            exchange_rate: parsed.exchangeRate,
            fcy_amount: parsed.fcyAmount,
            taxable_value: parsed.taxableAmount,
            non_taxable_amount: parsed.nonTaxableAmount,
            vat_percent: parsed.vatPercent,
            vat_amount: parsed.vatAmount,
            total: parsed.total,
            rate: amountPerQty,
          });
        }

        descriptionParts.length = 0;
        continue;
      }

      if (/^(amount|qty|currency|ex\.?rate|fcy|taxable|non|tax|total|\(aed\)|charges)/i.test(line)) {
        continue;
      }
      if (/^[^A-Za-z0-9]+$/.test(line)) {
        continue;
      }

      descriptionParts.push(line);
    }

    return rows;
  }

  private extractDwChargeRows(rawText: string): ExtractedInvoice['line_items'] {
    const lines = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const hasDwHeader = lines.some(line =>
      /particulars/i.test(line) && /curr/i.test(line) && /no\.?\s*of\s*unit/i.test(line),
    );
    if (!hasDwHeader) {
      return [];
    }

    const rows: ExtractedInvoice['line_items'] = [];
    let tableStarted = false;

    for (const line of lines) {
      if (
        tableStarted &&
        /^(demo world logistics|tax invoice|billed to|printed by|page\s*\d+\s*of\s*\d+|total\d|amount in words|remarks)/i.test(line)
      ) {
        break;
      }

      const parsed = this.parseDwChargeLine(line);
      if (!parsed) {
        continue;
      }
      tableStarted = true;

      rows.push({
        sno: parsed.sno,
        description: parsed.description,
        hsn_sac: null,
        currency: parsed.currency,
        unit: null,
        qty: parsed.qty,
        amount_per_qty: parsed.rate,
        exchange_rate: parsed.roe,
        fcy_amount: parsed.amountInForeign,
        taxable_value: parsed.taxableAmount,
        non_taxable_amount: 0,
        vat_percent: parsed.vatPercent,
        vat_amount: parsed.vatAmount,
        total: parsed.amountInAed,
        rate: parsed.rate,
      });
    }

    return rows.filter(row => (row.sno || 0) <= 32);
  }

  private parseDwChargeLine(line: string): {
    sno: number;
    description: string;
    currency: string;
    qty: number;
    rate: number;
    roe: number;
    taxableAmount: number;
    vatPercent: number;
    vatAmount: number;
    amountInAed: number;
    amountInForeign: number;
  } | null {
    const compact = line.replace(/\s+/g, ' ');
    const match = compact.match(
      /^(\d{1,4})\s*([A-Za-z][A-Za-z\s&/().-]*?)\s*(AED|USD|INR|EUR|GBP|SAR)\s*(\d+(?:\.\d{3})?)\s*(\d+\.\d{2})(.+)$/i,
    );

    if (!match) {
      return null;
    }

    const sno = Number.parseInt(match[1], 10);
    const description = this.cleanCapturedValue(match[2]);
    if (!description || Number.isNaN(sno)) {
      return null;
    }

    const tail = match[6].replace(/\s+/g, '');
    const tailMatch = tail.match(/^(.*?)(\d+\.\d{2})(\d+\.\d{3})(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})$/);
    if (!tailMatch) {
      return null;
    }

    const roe = Number.parseFloat(tailMatch[1]);
    const taxableAmount = Number.parseFloat(tailMatch[2]);
    const vatPercent = Number.parseFloat(tailMatch[3]);
    const vatAmount = Number.parseFloat(tailMatch[4]);
    const amountInAed = Number.parseFloat(tailMatch[5]);
    const amountInForeign = Number.parseFloat(tailMatch[6]);

    if ([roe, taxableAmount, vatPercent, vatAmount, amountInAed, amountInForeign].some(v => Number.isNaN(v))) {
      return null;
    }

    return {
      sno,
      description,
      currency: match[3].toUpperCase(),
      qty: Number.parseFloat(match[4]),
      rate: Number.parseFloat(match[5]),
      roe,
      taxableAmount,
      vatPercent,
      vatAmount,
      amountInAed,
      amountInForeign,
    };
  }

  private parseFwaChargeValueLine(line: string): {
    amountPerQty: number;
    currency: string;
    exchangeRate: number;
    fcyAmount: number;
    taxableAmount: number;
    nonTaxableAmount: number;
    vatPercent: number;
    vatAmount: number;
    total: number;
  } | null {
    const compact = line.replace(/\s+/g, '');
    const match = compact.match(/^(\d+\.\d{2})([A-Z]{3})(\d+\.\d{6})(.+)$/i);
    if (!match) {
      return null;
    }

    const amountPerQty = Number.parseFloat(match[1]);
    const currency = match[2].toUpperCase();
    const exchangeRate = Number.parseFloat(match[3]);
    const tail = match[4];
    const values = (tail.match(/\d+\.\d{2}/g) || []).map(v => Number.parseFloat(v));

    if (values.length < 3) {
      return null;
    }

    const fcyAmount = values[0] || 0;
    const taxableAmount = values[1] ?? fcyAmount;
    const nonTaxableAmount = values[2] ?? 0;

    let vatPercent = 0;
    let vatAmount = 0;
    let total = values[values.length - 1] || taxableAmount;

    if (values.length === 5) {
      vatPercent = values[3] || 0;
    } else if (values.length >= 6) {
      vatPercent = values[3] || 0;
      vatAmount = values[4] || 0;
      total = values[5] || total;
    }

    return {
      amountPerQty,
      currency,
      exchangeRate,
      fcyAmount,
      taxableAmount,
      nonTaxableAmount,
      vatPercent,
      vatAmount,
      total,
    };
  }

  // ============================================================
  // HEALTH CHECK: Verify both OCR and LLM services
  // ============================================================
  async checkHealth(): Promise<OcrHealthResponse> {
    const health: OcrHealthResponse = { ocr: false, llm: false, models: [] };

    // Check EasyOCR API
    try {
      const ocrRes = await axios.get(`${this.ocrApiHost}/health`, { timeout: 5000 });
      health.ocr = ocrRes.data?.status === 'ok';
    } catch (error) {
      this.logger.warn(`EasyOCR health check failed: ${error.message}`);
    }

    // Check Ollama LLM
    try {
      const llmRes = await axios.get(`${this.ollamaHost}/api/tags`, { timeout: 5000 });
      health.llm = true;
      health.models = llmRes.data?.models?.map((m: any) => m.name) || [];
    } catch (error) {
      this.logger.warn(`Ollama health check failed: ${error.message}`);
    }

    return health;
  }
}
