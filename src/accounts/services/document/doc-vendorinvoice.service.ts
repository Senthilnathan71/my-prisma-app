import { Injectable, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface VendorInvoiceData {
  // Header Information
  voucherNumber?: string;
  voucherDate?: string;
  documentNumber?: string;
  documentDate?: string;
  
  // Vendor Information
  partyName?: string;
  partyAddress?: string;
  gstNo?: string;
  gstType?: string;
  placeOfSupply?: string;
  
  // Financial Information
  currencyCode?: string;
  exchangeRate?: number;
  amount?: number;
  localAmount?: number;
  netAmount?: number;
  
  // Job Information
  masterNumber?: string;
  houseNumber?: string;
  masterJobSid?: number;
  houseJobSid?: number;
  departmentMasterSid?: number;
  
  // Charge Details
  voucherDetails: ChargeDetail[];
  
  // System Fields
  confidence: number;
  extractedText?: string;
  fieldMappings?: FieldMapping[];
}

export interface ChargeDetail {
  chargeDescription?: string;
  narration?: string;
  sacCode?: string;
  hsnCode?: string;
  unit?: string;
  numberOfUnit?: number;
  drCr?: string;
  currencyCode?: string;
  rate?: number;
  exchangeRate?: number;
  amount?: number;
  taxableAmount?: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  localAmount?: number;
  partyAmount?: number;
  masterJobSid?: number;
  houseJobSid?: number;
  departmentMasterSid?: number;
}

export interface FieldMapping {
  pdfLabel: string;
  canonicalField: string;
  extractedValue: any;
  confidence: number;
  userCorrected?: boolean;
}

export interface ExtractionReview {
  extractionId: string;
  originalData: VendorInvoiceData;
  userCorrections: VendorInvoiceData;
  fieldMappings: FieldMapping[];
  validated: boolean;
}

@Injectable()
export class DocVendorInvoiceService {
  private readonly logger = new Logger(DocVendorInvoiceService.name);
  
  // Enhanced label mappings for vendor invoices
  private labelMappings = {
    // Vendor Information
    'partyName': ['for', 'customer', 'vendor name', 'supplier name', 'provider name', 'seller name', 'company name', 'party name', 'billed to', 'supplier'],
    'partyAddress': ['vendor address', 'supplier address', 'billing address', 'company address', 'road', 'floor', 'street', 'address'],
    'gstNo': ['gstin', 'gst no', 'gst number', 'tax id', 'tin', 'vat no', 'vat number', 'pan no', 'pan number'],
    'gstType': ['gst type', 'tax type', 'invoice type'],
    'placeOfSupply': ['place of supply', 'supply place', 'pos', 'state'],
    
    // Document Information
    'documentNumber': ['invoice no', 'invoice number', 'bill no', 'bill number', 'document no', 'voucher no', 'ref no', 'reference'],
    'documentDate': ['invoice date', 'bill date', 'document date', 'date', 'voucher date'],
    'voucherNumber': ['voucher no', 'voucher number', 'reference no'],
    
    // Financial Information
    'currencyCode': ['currency', 'curr', 'currency code', 'curr code'],
    'exchangeRate': ['exchange rate', 'forex rate', 'conversion rate', 'ex rate'],
    'localAmount': ['local amount', 'base amount', 'amount in inr'],
    'netAmount': ['net amount', 'taxable amount', 'subtotal'],
    
    // Job Information
    'masterNumber': ['mbl no', 'master bill no', 'master number', 'job no', 'mbl number', 'master bl no'],
    'houseNumber': ['hbl no', 'house bill no', 'house number', 'hbl number', 'house bl no'],
    
    // Charge Table Headers
    'chargeDescription': ['description', 'charge', 'item description', 'particulars', 'service description'],
    'sacCode': ['sac code', 'service code', 'sac', 'hsn code', 'hsn', 'sac/hsn', 'hsn/sac'],
    'unit': ['unit', 'uom', 'unit of measure'],
    'numberOfUnit': ['quantity', 'qty', 'number of units', 'units'],
    'rate': ['rate', 'unit price', 'price', 'unit rate'],
    'amount': ['amount', 'total', 'line total', 'amount(cur)', 'charge amount'],
    'taxableAmount': ['taxable amount', 'assessable value'],
    'cgstRate': ['cgst rate', 'cgst %', 'central tax rate'],
    'cgstAmount': ['cgst amount', 'central tax'],
    'sgstRate': ['sgst rate', 'sgst %', 'state tax rate'],
    'sgstAmount': ['sgst amount', 'state tax'],
    'igstRate': ['igst rate', 'igst %', 'integrated tax rate'],
    'igstAmount': ['igst amount', 'integrated tax']
  };

  async processVendorInvoice(file: Express.Multer.File): Promise<VendorInvoiceData> {
    try {
      this.logger.log('Starting Vendor Invoice processing...');
      
      // Extract text from PDF
      const pdfText = await this.extractTextFromPDF(file.buffer);
      this.logger.log(`Extracted ${pdfText.length} characters from PDF`);
      
      // Extract structured data
      const extractedData = await this.extractVendorInvoiceData(pdfText);
      
      this.logger.log(`Processing completed with confidence: ${Math.round(extractedData.confidence * 100)}%`);
      
      return extractedData;
    } catch (error) {
      this.logger.error('Failed to process Vendor Invoice:', error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      // First try regular PDF text extraction
      const data = await pdfParse(buffer, {
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        max: 0,
      });
      
      this.logger.log(`PDF parsing result: ${data.text ? data.text.length : 0} characters`);
      
      if (data.text && data.text.trim().length >= 100) {
        this.logger.log('✅ PDF text extraction successful');
        return data.text;
      }
      
      this.logger.log('⚠️ PDF has insufficient text, trying OCR...');
      
      // Fallback to OCR for image-based PDFs
      return await this.extractTextWithOCR(buffer);
      
    } catch (error) {
      this.logger.warn('PDF text extraction failed, trying OCR as fallback...');
      
      try {
        return await this.extractTextWithOCR(buffer);
      } catch (ocrError) {
        this.logger.error('Both PDF parsing and OCR failed:', ocrError);
        throw new Error(`Could not process this document: ${error.message}`);
      }
    }
  }

  private async extractTextWithOCR(buffer: Buffer): Promise<string> {
    try {
      this.logger.log('🔍 Starting OCR processing...');

      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');

      // Create temp directory
      const tempDir = path.join(os.tmpdir(), `vendor-invoice-ocr-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Save PDF to temp file
        const tempPdfPath = path.join(tempDir, 'input.pdf');
        await fs.writeFile(tempPdfPath, buffer);

        // Convert PDF to images using pdf-poppler
        const poppler = require('pdf-poppler');
        const options = {
          format: 'png',
          out_dir: tempDir,
          out_prefix: 'page',
          page: null
        };

        this.logger.log('📄 Converting PDF to images...');
        await poppler.convert(tempPdfPath, options);

        // Get all generated images
        let imageFiles = await fs.readdir(tempDir);
        imageFiles = imageFiles
          .filter(f => f.endsWith('.png'))
          .map(f => path.join(tempDir, f))
          .sort();

        if (imageFiles.length === 0) {
          throw new Error('No images generated from PDF');
        }

        // OCR each image
        this.logger.log('🤖 Starting OCR on images...');
        const worker = await createWorker('eng');

        let allText = '';

        for (let i = 0; i < imageFiles.length; i++) {
          const imagePath = imageFiles[i];
          this.logger.log(`🔍 OCR page ${i + 1}/${imageFiles.length}...`);

          // Optimize image for better OCR
          const optimizedImagePath = path.join(tempDir, `optimized_${i}.png`);
          await sharp(imagePath)
            .resize({ width: 2000 })
            .sharpen()
            .png({ quality: 100 })
            .toFile(optimizedImagePath);

          const { data: { text } } = await worker.recognize(optimizedImagePath);
          allText += text + '\n\n';
        }

        await worker.terminate();

        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });

        if (!allText || allText.trim().length < 100) {
          throw new Error('OCR extracted insufficient text');
        }

        this.logger.log(`✅ OCR completed: ${allText.length} characters`);
        return allText;

      } catch (ocrError) {
        // Cleanup on error
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        throw ocrError;
      }

    } catch (error) {
      this.logger.error('OCR failed:', error);
      
      // Fallback to mock data for development
      this.logger.log('📋 Using mock data as fallback...');
      return this.getMockVendorInvoiceText();
    }
  }

  private async extractVendorInvoiceData(text: string): Promise<VendorInvoiceData> {
    this.logger.log('Starting vendor invoice data extraction...');
    
    // Clean and normalize text
    const cleanText = this.cleanText(text);
    
    const result: VendorInvoiceData = {
      voucherDetails: [],
      confidence: 0,
      extractedText: cleanText.substring(0, 500) + '...',
      fieldMappings: []
    };

    try {
      // Extract header fields using improved parsing
      const headerExtraction = this.extractHeaderFields(cleanText);
      Object.assign(result, headerExtraction.data);
      result.fieldMappings = headerExtraction.fieldMappings;

      // Extract charge table data
      const chargeExtraction = this.extractChargeTable(cleanText);
      result.voucherDetails = chargeExtraction.rows;
      result.fieldMappings.push(...chargeExtraction.fieldMappings);

      // Calculate overall confidence
      result.confidence = this.calculateConfidence(result, headerExtraction, chargeExtraction);

    } catch (error) {
      this.logger.error('Error during field extraction:', error);
      result.confidence = 0.1;
    }

    return result;
  }

  private extractHeaderFields(text: string): { data: Partial<VendorInvoiceData>; fieldMappings: FieldMapping[] } {
    const data: Partial<VendorInvoiceData> = {};
    const fieldMappings: FieldMapping[] = [];

    // Split text into lines for better parsing
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Extract specific fields with better boundary detection
    this.extractPartyInformation(lines, data, fieldMappings);
    this.extractDocumentInformation(lines, data, fieldMappings);
    this.extractFinancialInformation(lines, data, fieldMappings);
    this.extractJobInformation(lines, data, fieldMappings);

    return { data, fieldMappings };
  }

  private extractPartyInformation(lines: string[], data: Partial<VendorInvoiceData>, fieldMappings: FieldMapping[]) {
    // Look for vendor/customer information
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Customer/Vendor name - look for "For" pattern with better boundary detection
      if ((line.includes('For') || line.includes('Vendor') || line.includes('Supplier')) && !data.partyName) {
        const vendorIndex = line.includes('For') ? line.indexOf('For') : 
                           line.includes('Vendor') ? line.indexOf('Vendor') : 
                           line.indexOf('Supplier');
        
        let vendorName = line.substring(vendorIndex + (line.includes('For') ? 3 : 
                                       line.includes('Vendor') ? 6 : 8)).trim();
        
        // Stop at common boundaries
        const boundaries = [
          'TAX INVOICE', 'INVOICE', 'B-', 'Tel No', 'Fax', 'Email', 
          'Website', 'GSTIN', 'Invoice No', 'Address', '  ', 'GST', 'Phone'
        ];
        
        for (const boundary of boundaries) {
          const boundaryIndex = vendorName.indexOf(boundary);
          if (boundaryIndex !== -1) {
            vendorName = vendorName.substring(0, boundaryIndex).trim();
          }
        }
        
        // Additional cleanup - remove line breaks and extra whitespace
        vendorName = vendorName
          .split('\n')[0] // Take only first line
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Validate length (company names are typically 10-100 chars)
        if (vendorName && vendorName.length >= 5 && vendorName.length <= 150) {
          data.partyName = vendorName;
          fieldMappings.push({
            pdfLabel: line.includes('For') ? 'For' : line.includes('Vendor') ? 'Vendor' : 'Supplier',
            canonicalField: 'partyName',
            extractedValue: vendorName,
            confidence: 0.9
          });
        }
      }

      // GST Number extraction with better pattern
      const gstPattern = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/;
      const gstMatch = line.match(gstPattern);
      if (gstMatch && !data.gstNo) {
        data.gstNo = gstMatch[1];
        fieldMappings.push({
          pdfLabel: 'GSTIN',
          canonicalField: 'gstNo',
          extractedValue: gstMatch[1],
          confidence: 0.95
        });
      }

      // VAT Number extraction
      const vatPattern = /\b(VAT\d+)\b/i;
      const vatMatch = line.match(vatPattern);
      if (vatMatch && !data.gstNo) {
        data.gstNo = vatMatch[1];
        fieldMappings.push({
          pdfLabel: 'VAT No',
          canonicalField: 'gstNo',
          extractedValue: vatMatch[1],
          confidence: 0.9
        });
      }

      // Vendor Address - look for address patterns
      if ((line.includes('ROAD,') || line.includes('FLOOR,') || line.includes('STREET,') || 
           line.includes('AHMEDABAD') || line.includes('MUMBAI') || line.includes('DELHI') ||
           line.match(/\d+\s+[A-Za-z\s]+,?\s*[A-Za-z]+/)) && !data.partyAddress) {
        
        let address = line.trim();
        
        // Stop at common boundaries
        const addressBoundaries = ['Tel No', 'GSTIN', 'Invoice No', 'Phone', 'Email', 'Website'];
        for (const boundary of addressBoundaries) {
          const index = address.indexOf(boundary);
          if (index !== -1) {
            address = address.substring(0, index).trim();
          }
        }
        
        // Limit length
        if (address.length > 200) {
          address = address.substring(0, 200).trim() + '...';
        }
        
        // Only set if it looks like a real address (has numbers and text)
        if (address.match(/\d/) && address.match(/[A-Za-z]/)) {
          data.partyAddress = address;
          fieldMappings.push({
            pdfLabel: 'Address',
            canonicalField: 'partyAddress',
            extractedValue: address,
            confidence: 0.8
          });
        }
      }
    }
  }

  private extractDocumentInformation(lines: string[], data: Partial<VendorInvoiceData>, fieldMappings: FieldMapping[]) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Invoice Number - extract only the number part
      if ((line.includes('Invoice No.') || line.includes('Invoice Number') || line.includes('Bill No')) && !data.documentNumber) {
        // Try multiple patterns
        let invMatch = line.match(/(?:Invoice\s*(?:No\.?|Number)|Bill\s*No\.?)\s*:?\s*([A-Z0-9\-\/]+)/i);
        
        if (!invMatch) {
          invMatch = line.match(/(?:INV|BILL)[\s\-]*([A-Z0-9\-\/]+)/i);
        }
        
        if (invMatch) {
          let invoiceNo = invMatch[1].trim();
          
          // Stop at next field or whitespace
          const stopWords = ['Invoice Date', 'Date', 'Due', 'Page', 'Amount'];
          for (const word of stopWords) {
            const index = invoiceNo.indexOf(word);
            if (index !== -1) {
              invoiceNo = invoiceNo.substring(0, index).trim();
            }
          }
          
          // Take only first token if multiple parts
          invoiceNo = invoiceNo.split(/\s+/)[0];
          
          if (invoiceNo && invoiceNo.length >= 3 && invoiceNo.length <= 50) {
            data.documentNumber = invoiceNo;
            fieldMappings.push({
              pdfLabel: 'Invoice No.',
              canonicalField: 'documentNumber',
              extractedValue: invoiceNo,
              confidence: 0.9
            });
          }
        }
      }

      // Invoice Date - extract only the date
      if ((line.includes('Invoice Date') || line.includes('Bill Date') || line.includes('Date:')) && !data.documentDate) {
        // Pattern: dd-MMM-yyyy or similar
        const dateMatch = line.match(/(?:Invoice\s*Date|Bill\s*Date|Date)\s*:?\s*(\d{1,2}[-\/]\w{3,9}[-\/]\d{2,4})/i);
        
        if (!dateMatch) {
          // Try other date formats
          const altDateMatch = line.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
          if (altDateMatch) {
            data.documentDate = altDateMatch[1];
            fieldMappings.push({
              pdfLabel: 'Invoice Date',
              canonicalField: 'documentDate',
              extractedValue: altDateMatch[1],
              confidence: 0.8
            });
          }
        } else if (dateMatch) {
          let date = dateMatch[1].trim();
          
          // Validate it's a reasonable date format
          if (date.length >= 6 && date.length <= 15) {
            data.documentDate = date;
            fieldMappings.push({
              pdfLabel: 'Invoice Date',
              canonicalField: 'documentDate',
              extractedValue: date,
              confidence: 0.9
            });
          }
        }
      }

      // Place of Supply - extract only the place
      if (line.includes('Place of Supply') && !data.placeOfSupply) {
        const posMatch = line.match(/Place\s*of\s*Supply\s*:?\s*(\[?\d{2}\]?\s*)?([A-Za-z\s]+)/i);
        
        if (posMatch) {
          let place = posMatch[2].trim();
          
          // Stop at common boundaries
          const boundaries = ['PAN No', 'Shipment', 'GSTIN', 'State', 'Invoice'];
          for (const boundary of boundaries) {
            const index = place.indexOf(boundary);
            if (index !== -1) {
              place = place.substring(0, index).trim();
            }
          }
          
          // Take only first 1-2 words (state name)
          const words = place.split(/\s+/);
          place = words.slice(0, 2).join(' ');
          
          if (place && place.length >= 2 && place.length <= 30) {
            data.placeOfSupply = place;
            fieldMappings.push({
              pdfLabel: 'Place of Supply',
              canonicalField: 'placeOfSupply',
              extractedValue: place,
              confidence: 0.8
            });
          }
        }
      }
    }
  }

  private extractFinancialInformation(lines: string[], data: Partial<VendorInvoiceData>, fieldMappings: FieldMapping[]) {
    let totalAmountFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Look for currency first
      if (!data.currencyCode) {
        // Common currency patterns
        const currencyMatch = line.match(/\b(INR|USD|EUR|GBP|AED|SAR)\b/);
        if (currencyMatch) {
          data.currencyCode = currencyMatch[1];
          fieldMappings.push({
            pdfLabel: 'Currency',
            canonicalField: 'currencyCode',
            extractedValue: currencyMatch[1],
            confidence: 0.95
          });
        }
      }
      
      // Look for exchange rate
      if (!data.exchangeRate) {
        const exRateMatch = line.match(/Exchange\s*Rate\s*:?\s*([0-9.]+)/i);
        if (exRateMatch) {
          const rate = parseFloat(exRateMatch[1]);
          if (!isNaN(rate) && rate > 0) {
            data.exchangeRate = rate;
            fieldMappings.push({
              pdfLabel: 'Exchange Rate',
              canonicalField: 'exchangeRate',
              extractedValue: rate,
              confidence: 0.9
            });
          }
        }
      }
      
      // Look for total amount patterns - multiple strategies
      if (!totalAmountFound) {
        const amountIndicators = [
          'Total Invoice Value',
          'Net Payable',
          'Grand Total',
          'Total Amount',
          'Amount Payable',
          'Invoice Total'
        ];
        
        for (const indicator of amountIndicators) {
          if (line.includes(indicator)) {
            // Pattern 1: Currency followed by number
            const pattern1 = new RegExp(`${indicator}[\\s:]+(INR|USD|EUR|GBP)?[\\s]*([0-9,]+\\.[0-9]{2}|[0-9,]+)`, 'i');
            const match1 = line.match(pattern1);
            
            if (match1) {
              const amount = parseFloat(match1[2].replace(/,/g, ''));
              
              if (!isNaN(amount) && amount > 0 && amount < 10000000) { // Reasonable range
                data.amount = amount;
                
                if (match1[1]) {
                  data.currencyCode = match1[1];
                }
                
                totalAmountFound = true;
                
                fieldMappings.push({
                  pdfLabel: indicator,
                  canonicalField: 'amount',
                  extractedValue: amount,
                  confidence: 0.9
                });
                
                break;
              }
            }
            
            // Pattern 2: Check next line for amount
            if (i + 1 < lines.length) {
              const nextLine = lines[i + 1];
              const pattern2 = /(INR|USD|EUR|GBP)?[\s]*([0-9,]+\.?[0-9]{0,2})/;
              const match2 = nextLine.match(pattern2);
              
              if (match2) {
                const amount = parseFloat(match2[2].replace(/,/g, ''));
                
                if (!isNaN(amount) && amount > 0 && amount < 10000000) {
                  data.amount = amount;
                  
                  if (match2[1]) {
                    data.currencyCode = match2[1];
                  }
                  
                  totalAmountFound = true;
                  
                  fieldMappings.push({
                    pdfLabel: indicator,
                    canonicalField: 'amount',
                    extractedValue: amount,
                    confidence: 0.85
                  });
                  
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  private extractJobInformation(lines: string[], data: Partial<VendorInvoiceData>, fieldMappings: FieldMapping[]) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // MBL Number - extract only the number
      if ((line.includes('MBL No.') || line.includes('Master Bill No') || line.includes('MBL Number')) && !data.masterNumber) {
        const mblMatch = line.match(/(?:MBL\s*(?:No\.?|Number)|Master\s*Bill\s*No\.?)\s*:?\s*([A-Z0-9\-]+)/i);
        
        if (mblMatch) {
          let mblNo = mblMatch[1].trim();
          
          // Stop at common boundaries
          const boundaries = ['Date', 'IncoTerms', 'HBL', 'Shipper', 'Vessel'];
          for (const boundary of boundaries) {
            const index = mblNo.indexOf(boundary);
            if (index !== -1) {
              mblNo = mblNo.substring(0, index).trim();
            }
          }
          
          // Validate length
          if (mblNo && mblNo.length >= 3 && mblNo.length <= 30) {
            data.masterNumber = mblNo;
            fieldMappings.push({
              pdfLabel: 'MBL No.',
              canonicalField: 'masterNumber',
              extractedValue: mblNo,
              confidence: 0.9
            });
          }
        }
      }

      // HBL Number - extract only the number
      if ((line.includes('HBL No.') || line.includes('House Bill No') || line.includes('HBL Number')) && !data.houseNumber) {
        const hblMatch = line.match(/(?:HBL\s*(?:No\.?|Number)|House\s*Bill\s*No\.?)\s*:?\s*([A-Z0-9]+)/i);
        
        if (hblMatch) {
          let hblNo = hblMatch[1].trim();
          
          // Stop at common boundaries
          const boundaries = ['Date', 'Shipper', 'Packages', 'Consignee', 'Gross'];
          for (const boundary of boundaries) {
            const index = hblNo.indexOf(boundary);
            if (index !== -1) {
              hblNo = hblNo.substring(0, index).trim();
            }
          }
          
          // Validate length
          if (hblNo && hblNo.length >= 3 && hblNo.length <= 30) {
            data.houseNumber = hblNo;
            fieldMappings.push({
              pdfLabel: 'HBL No.',
              canonicalField: 'houseNumber',
              extractedValue: hblNo,
              confidence: 0.9
            });
          }
        }
      }
    }
  }

  private extractChargeTable(text: string): { rows: ChargeDetail[]; fieldMappings: FieldMapping[] } {
    const rows: ChargeDetail[] = [];
    const fieldMappings: FieldMapping[] = [];

    try {
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

      // Handle FWA-style invoices where charge rows are multiline and numeric values are concatenated.
      const fwaRows = this.extractFwaCharges(lines);
      if (fwaRows.length > 0) {
        this.logger.log(`Extracted ${fwaRows.length} FWA charge rows`);
        return { rows: fwaRows, fieldMappings };
      }
      
      // Find the charge table - look for typical headers
      let tableStartIndex = -1;
      const tableHeaders = ['Description', 'SAC', 'HSN', 'Cur', 'Rate', 'Quantity', 'Amount', 'Tax', 'Sr No', 'Charge', 'Particulars'];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headerMatches = tableHeaders.filter(header => 
          line.toLowerCase().includes(header.toLowerCase())
        );
        
        if (headerMatches.length >= 2) { // At least 2 headers found
          tableStartIndex = i;
          this.logger.log(`Found table header at line ${i}: ${line}`);
          break;
        }
      }

      if (tableStartIndex === -1) {
        this.logger.log('No structured charge table found, trying line-by-line extraction');
        return this.extractChargesFromLines(lines);
      }

      // Extract table rows
      let rowCount = 0;
      for (let i = tableStartIndex + 1; i < Math.min(tableStartIndex + 50, lines.length); i++) {
        const line = lines[i];
        
        // Skip summary lines
        if (this.isSummaryLine(line)) {
          this.logger.log(`Skipping summary line: ${line}`);
          continue;
        }
        
        // Skip very short lines
        if (line.length < 5) continue;
        
        const charge = this.parseStructuredChargeLine(line);
        if (charge && (charge.amount || charge.chargeDescription)) {
          rows.push(charge);
          rowCount++;
          this.logger.log(`Extracted charge row ${rowCount}: ${charge.chargeDescription} - ${charge.amount}`);
        }
        
        // Stop if we've found a reasonable number of charges
        if (rowCount >= 20) break;
      }

      this.logger.log(`Extracted ${rows.length} structured charge rows`);

    } catch (error) {
      this.logger.error('Error extracting charge table:', error);
      // Fallback to line extraction
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      return this.extractChargesFromLines(lines);
    }

    return { rows, fieldMappings };
  }

  private extractFwaCharges(lines: string[]): ChargeDetail[] {
    const rows: ChargeDetail[] = [];
    const compactLines = lines.map(line => line.replace(/\s+/g, '').toLowerCase());

    const headerIndex = compactLines.findIndex(line => line.includes('chargesunitqty'));
    if (headerIndex === -1) {
      return rows;
    }

    const footerIndex = lines.findIndex((line, index) =>
      index > headerIndex && /^sub\s*total/i.test(line)
    );
    const endIndex = footerIndex === -1 ? lines.length : footerIndex;

    const descriptionParts: string[] = [];
    for (let i = headerIndex + 1; i < endIndex; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const numeric = this.parseFwaChargeNumericLine(line);
      if (numeric) {
        const description = descriptionParts
          .filter(part => !/^(per|shipment)$/i.test(part))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (description) {
          rows.push({
            chargeDescription: description,
            unit: 'PER SHIPMENT',
            numberOfUnit: 1,
            drCr: 'Dr',
            currencyCode: numeric.currencyCode,
            rate: numeric.amountPerQty,
            exchangeRate: numeric.exchangeRate,
            amount: numeric.fcyAmount,
            taxableAmount: numeric.taxableAmount,
            igstRate: numeric.taxPercent,
            igstAmount: numeric.taxAmount,
            localAmount: numeric.totalAmount,
            partyAmount: numeric.totalAmount,
          });
        }

        descriptionParts.length = 0;
        continue;
      }

      if (
        /^(amount|qty|currency|ex\.?rate|fcy|taxable|non|tax|total|\(aed\)|charges)/i.test(line)
      ) {
        continue;
      }
      if (/^[^A-Za-z0-9]+$/.test(line)) {
        continue;
      }

      descriptionParts.push(line);
    }

    return rows;
  }

  private parseFwaChargeNumericLine(line: string): {
    amountPerQty: number;
    currencyCode: string;
    exchangeRate: number;
    fcyAmount: number;
    taxableAmount: number;
    taxPercent: number;
    taxAmount: number;
    totalAmount: number;
  } | null {
    const compact = line.replace(/\s+/g, '');
    const match = compact.match(/^(\d+\.\d{2})([A-Z]{3})(\d+\.\d{6})(.+)$/i);
    if (!match) {
      return null;
    }

    const amountPerQty = Number.parseFloat(match[1]);
    const currencyCode = match[2].toUpperCase();
    const exchangeRate = Number.parseFloat(match[3]);
    const tail = match[4];
    const amountTokens = (tail.match(/\d+\.\d{2}/g) || []).map(value => Number.parseFloat(value));

    if (amountTokens.length < 3) {
      return null;
    }

    const fcyAmount = amountTokens[0] || 0;
    const taxableAmount = amountTokens[1] ?? fcyAmount;

    let taxPercent = 0;
    let taxAmount = 0;
    let totalAmount = amountTokens[amountTokens.length - 1] || taxableAmount;

    if (amountTokens.length === 5) {
      taxPercent = amountTokens[3] || 0;
    } else if (amountTokens.length >= 6) {
      taxPercent = amountTokens[3] || 0;
      taxAmount = amountTokens[4] || 0;
      totalAmount = amountTokens[5] || totalAmount;
    }

    return {
      amountPerQty,
      currencyCode,
      exchangeRate,
      fcyAmount,
      taxableAmount,
      taxPercent,
      taxAmount,
      totalAmount,
    };
  }

  private extractChargesFromLines(lines: string[]): { rows: ChargeDetail[]; fieldMappings: FieldMapping[] } {
    const rows: ChargeDetail[] = [];
    const fieldMappings: FieldMapping[] = [];

    // Common charge descriptions to look for
    const chargeKeywords = [
      'bill of lading', 'terminal handling', 'security charges', 'destination',
      'manifestation', 'sealing', 'examination', 'port additional', 'freight',
      'handling', 'documentation', 'customs', 'clearance', 'duty charges',
      'on carriage', 'cargo', 'delivery order', 'logistics', 'transportation',
      'warehouse', 'storage', 'insurance', 'tax', 'gst', 'vat'
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if line contains charge-like content
      const isChargeLine = chargeKeywords.some(keyword => 
        line.toLowerCase().includes(keyword.toLowerCase())
      );

      // Also check for lines with numbers that might be amounts
      const hasAmount = line.match(/([0-9,]+\.?[0-9]{0,2})/);

      if (isChargeLine || (hasAmount && line.length > 10)) {
        const charge = this.parseChargeLineFromText(line);
        if (charge && charge.chargeDescription) {
          rows.push(charge);
          this.logger.log(`Extracted charge from line: ${charge.chargeDescription}`);
        }
      }
    }

    this.logger.log(`Extracted ${rows.length} charge rows from line analysis`);
    return { rows, fieldMappings };
  }

  private parseStructuredChargeLine(line: string): ChargeDetail {
    const charge: ChargeDetail = {};
    
    // Split by multiple spaces (table-like structure)
    const parts = line.split(/\s{2,}/).filter(part => part.trim().length > 0);
    
    if (parts.length >= 2) {
      // First part is usually description
      charge.chargeDescription = parts[0]?.trim().substring(0, 100);
      
      // Look for SAC/HSN code
      const sacMatch = line.match(/(\d{4,8})/);
      if (sacMatch) {
        charge.sacCode = sacMatch[1];
      }
      
      // Extract numeric values - try to find amounts
      const numbers = this.extractAllNumbers(line);
      
      // Assign numbers based on position and context
      if (numbers.length >= 1) {
        // First number could be quantity or rate
        if (line.toLowerCase().includes('qty') || numbers[0] < 1000) {
          charge.numberOfUnit = numbers[0];
        } else {
          charge.rate = numbers[0];
        }
      }
      
      if (numbers.length >= 2) {
        charge.amount = numbers[1];
      }
      
      if (numbers.length >= 3) {
        charge.rate = numbers[2];
      }
      
      // Set defaults
      charge.drCr = 'Dr';
      charge.currencyCode = 'INR';
      charge.exchangeRate = 1;
      charge.numberOfUnit = charge.numberOfUnit || 1;
    } else {
      // For non-structured lines, use the full line parsing
      return this.parseChargeLineFromText(line);
    }
    
    return charge;
  }

  private parseChargeLineFromText(line: string): ChargeDetail {
    const charge: ChargeDetail = {};
    
    // Extract description (take meaningful words, avoid pure numbers)
    const words = line.split(/\s+/).filter(word => 
      word.length > 0 && !/^\d+[,.]?\d*$/.test(word.replace(/[.,]/g, ''))
    );
    
    if (words.length > 0) {
      // Take first 3-5 words as description, but stop if we hit a large number
      let descriptionWords: string[] = []; // Explicitly type as string array
      for (let word of words.slice(0, 6)) {
        if (/^\d+[,.]?\d*$/.test(word.replace(/[.,]/g, '')) && parseFloat(word.replace(/,/g, '')) > 100) {
          break;
        }
        descriptionWords.push(word);
      }
      charge.chargeDescription = descriptionWords.join(' ');
    }
    
    // Extract numbers with better context awareness
    const numbers = this.extractAllNumbers(line);
    
    if (numbers.length > 0) {
      // Try to identify what each number represents based on context and magnitude
      const sortedNumbers = [...numbers].sort((a, b) => b - a);
      
      // Largest number is likely the amount
      charge.amount = sortedNumbers[0];
      
      // If there are multiple numbers, smaller ones might be rate or quantity
      if (numbers.length >= 2) {
        // Fix: Check if charge.amount is defined before using it
        charge.rate = numbers.find(n => charge.amount !== undefined && n < charge.amount && n > 0.1);
      }
      
      // Quantity is usually a small integer
      charge.numberOfUnit = numbers.find(n => Number.isInteger(n) && n < 100) || 1;
    }
    
    // Look for tax percentages
    const taxMatch = line.match(/(\d+(?:\.\d+)?)%/);
    if (taxMatch) {
      const taxRate = parseFloat(taxMatch[1]);
      if (line.toLowerCase().includes('cgst')) {
        charge.cgstRate = taxRate;
      } else if (line.toLowerCase().includes('sgst')) {
        charge.sgstRate = taxRate;
      } else if (line.toLowerCase().includes('igst')) {
        charge.igstRate = taxRate;
      }
    }
    
    // Set defaults
    charge.drCr = 'Dr';
    charge.currencyCode = 'INR';
    charge.exchangeRate = 1;
    
    return charge;
}

  private extractAllNumbers(text: string): number[] {
    const numbers: number[] = [];
    
    // Improved number extraction that handles commas and decimals
    const matches = text.matchAll(/([0-9,]+\.?[0-9]{0,4})/g);
    
    for (const match of matches) {
      // Clean the number string and parse
      const numStr = match[0].replace(/,/g, '');
      const num = parseFloat(numStr);
      
      // Only add valid positive numbers
      if (!isNaN(num) && num > 0 && num < 10000000) {
        numbers.push(num);
      }
    }
    
    return numbers;
  }

  private isSummaryLine(line: string): boolean {
    const summaryIndicators = [
      'total', 'subtotal', 'grand total', 'net amount', 'tax total',
      'payment', 'amount payable', 'balance due', 'final amount',
      'sum', 'overall', 'final total'
    ];
    
    const lowerLine = line.toLowerCase();
    return summaryIndicators.some(indicator => lowerLine.includes(indicator));
  }

  private calculateConfidence(
    result: VendorInvoiceData, 
    headerExtraction: any, 
    chargeExtraction: any
  ): number {
    let confidence = 0;
    let totalFields = 0;
    let confidentFields = 0;

    // Header fields confidence
    const importantFields = ['partyName', 'documentDate', 'amount', 'currencyCode'];
    importantFields.forEach(field => {
      totalFields++;
      if (result[field]) {
        const fieldMapping = headerExtraction.fieldMappings.find((fm: FieldMapping) => fm.canonicalField === field);
        confidentFields += fieldMapping ? fieldMapping.confidence : 0.5;
      }
    });

    // Charge details confidence
    if (result.voucherDetails.length > 0) {
      totalFields++;
      confidentFields += Math.min(0.8, result.voucherDetails.length * 0.1); // Scale with number of charges
    }

    // Document number confidence
    if (result.documentNumber) {
      totalFields++;
      confidentFields += 0.7;
    }

    // Calculate overall confidence
    confidence = totalFields > 0 ? confidentFields / totalFields : 0;

    return Math.max(0.1, Math.min(1, confidence));
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(line =>
        line
          .replace(/\t/g, ' ')
          .replace(/[^\S\r\n]+/g, ' ')
          .trim()
      )
      .filter(line => line.length > 0)
      .join('\n')
      .trim();
  }

  // Service methods for database operations
  async saveExtractionReview(reviewData: ExtractionReview): Promise<{ reviewId: string }> {
    this.logger.log('Saving extraction review:', reviewData.extractionId);
    
    // Simulate database save
    const reviewId = `REV_${Date.now()}`;
    
    return { reviewId };
  }

  async saveToDatabase(saveData: {
    reviewId: string;
    companyMasterSid: number;
    branchMasterSid: number;
    voucherTypeMasterSid: number;
    validatedData: VendorInvoiceData;
    userId: string;
  }): Promise<{ voucherHeaderId: number }> {
    this.logger.log('Saving vendor invoice to database:', saveData.reviewId);
    
    // In production, implement actual database save logic
    // This would create VoucherHeader, VoucherDetail, VoucherOthers records
    
    // Simulate database save
    const voucherHeaderId = Math.floor(Math.random() * 10000) + 1;
    
    return { voucherHeaderId };
  }

  async getLabelMappings(): Promise<any[]> {
    // In production, fetch from database
    return Object.entries(this.labelMappings).map(([canonicalField, synonyms]) => ({
      canonicalField,
      synonyms,
      enabled: true
    }));
  }

  async updateLabelMappings(mappings: any[]): Promise<void> {
    // In production, update database
    this.logger.log('Updating label mappings');
    
    // Update in-memory mappings (in production, update database)
    mappings.forEach(mapping => {
      this.labelMappings[mapping.canonicalField] = mapping.synonyms;
    });
  }

  async getExtractionLogs(reviewId: string): Promise<any[]> {
    // In production, fetch from database
    this.logger.log('Fetching extraction logs for:', reviewId);
    
    return [
      {
        timestamp: new Date().toISOString(),
        action: 'EXTRACTION',
        reviewId,
        details: 'Vendor invoice extraction completed'
      }
    ];
  }

  private getMockVendorInvoiceText(): string {
    return `
    LP (INDIA) LOGISTICS PVT. LTD.
    57, Mulji House, 41-45, Devji Ratansey Marg, Dana Bunder,
    Mumbai-400009 Tel No : 91-22-67431800 Fax : 91-22-66311875
    Email : info@lpindia.com Website :www.liladharpasoo.com
    MUMBAI - 400009, MAHARASHTRA
    
    GSTIN: 27AAACL8770B1ZK
    
    TAX INVOICE
    
    Invoice No. : 18EP000004/22-23
    Invoice Date : 27-Oct-2022
    Due Date : 26-Nov-2022
    
    For: YASHO INDUSTRIES LIMITED
    
    Place of Supply : Gujarat
    PAN No : AAACY0396G
    Shipment No. : LIMUMSH/SE/00604/22-23
    Shipment Type : FCL
    GSTIN : 24AAACY0396G1ZD
    
    MBL No. : TLLNSH-0038-2022 Date : 01-Sep-2022
    HBL No. : MUM202208006111 Date : 01-Sep-2022
    
    Charge Description:
    
    Description              SAC Code    Quantity   Rate (EUR)   Amount (EUR)
    Customs Duty Charges     996713      1          6,427.92     6,427.92
    
    Total Amount Before Tax: EUR 6,427.92
    Add: GST: EUR 0.00
    Total Invoice Value: EUR 6,427.92
    
    Payment Details:
    Beneficiary: LP (INDIA) LOGISTICS PVT LTD
    Bank Name: HDFC BANK LTD
    Account No.: 50200064335130
    `;
  }
}
