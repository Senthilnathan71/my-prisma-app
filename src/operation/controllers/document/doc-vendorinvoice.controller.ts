import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  HttpException,
  HttpStatus,
  Get,
  Param,
  Put,
  Delete,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/common/decorators/auth.decorator';
import { DocVendorInvoiceService } from 'src/operation/services/document/doc-vendorinvoice.service';

export interface VendorInvoiceExtractionResult {
  success: boolean;
  data?: VendorInvoiceData;
  error?: string;
  message?: string;
  processingTime?: number;
  extractionSummary?: {
    totalFields: number;
    extractedFields: number;
    missingFields: string[];
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  rawExtraction?: any;
}

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

@Auth()
@Controller('api/documents/vendor-invoice')
export class DocVendorInvoiceController {
  private readonly logger = new Logger(DocVendorInvoiceController.name);

  constructor(private readonly docVendorInvoiceService: DocVendorInvoiceService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed'), 
            false
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async uploadVendorInvoice(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<VendorInvoiceExtractionResult> {
    const startTime = Date.now();

    try {
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      if (file.size === 0) {
        throw new BadRequestException('Uploaded file is empty');
      }

      this.logger.log(`Processing vendor invoice: ${file.originalname}, Size: ${file.size} bytes`);

      // Process the document
      const extractedData = await this.docVendorInvoiceService.processVendorInvoice(file);
      
      const processingTime = Date.now() - startTime;
      
      // Generate extraction summary
      const extractionSummary = this.generateExtractionSummary(extractedData);
      
      this.logger.log(`Vendor invoice processed successfully in ${processingTime}ms`);

      const confidencePercentage = Math.round(extractedData.confidence * 100);
      let message = `Vendor invoice processed successfully with ${confidencePercentage}% confidence`;
      
      if (extractedData.confidence >= 0.8) {
        message += ' - HIGH confidence extraction';
      } else if (extractedData.confidence >= 0.6) {
        message += ' - MEDIUM confidence extraction, please review';
      } else {
        message += ' - LOW confidence extraction, manual review recommended';
      }

      return {
        success: true,
        data: extractedData,
        message,
        processingTime,
        extractionSummary,
        rawExtraction: {
          fieldMappings: extractedData.fieldMappings,
          extractedText: extractedData.extractedText?.substring(0, 500) + '...'
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error('Vendor invoice processing error:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        throw new HttpException(
          'File too large. Maximum size is 10MB',
          HttpStatus.PAYLOAD_TOO_LARGE
        );
      }

      if (error.message.includes('PDF parsing failed')) {
        return {
          success: false,
          error: 'Invalid or corrupted PDF file. Please ensure the file is a valid PDF document.',
          processingTime,
        };
      }

      if (error.message.includes('insufficient text content')) {
        return {
          success: false,
          error: 'PDF appears to be mostly images or has insufficient text content. Please ensure the PDF contains readable text.',
          processingTime,
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to process vendor invoice',
        processingTime,
      };
    }
  }

  @Post('review')
  async saveExtractionReview(@Body() reviewData: ExtractionReview): Promise<{ success: boolean; reviewId: string; message: string }> {
    try {
      const result = await this.docVendorInvoiceService.saveExtractionReview(reviewData);
      return {
        success: true,
        reviewId: result.reviewId,
        message: 'Extraction review saved successfully'
      };
    } catch (error) {
      throw new BadRequestException(`Failed to save extraction review: ${error.message}`);
    }
  }

  @Post('save-to-db')
  async saveToDatabase(@Body() saveData: {
    reviewId: string;
    companyMasterSid: number;
    branchMasterSid: number;
    voucherTypeMasterSid: number;
    validatedData: VendorInvoiceData;
    userId: string;
  }): Promise<{ success: boolean; voucherHeaderId: number; message: string }> {
    try {
      const result = await this.docVendorInvoiceService.saveToDatabase(saveData);
      return {
        success: true,
        voucherHeaderId: result.voucherHeaderId,
        message: 'Vendor invoice saved to database successfully'
      };
    } catch (error) {
      throw new BadRequestException(`Failed to save to database: ${error.message}`);
    }
  }

  @Get('label-mappings')
  async getLabelMappings(): Promise<{ success: boolean; mappings: any[] }> {
    try {
      const mappings = await this.docVendorInvoiceService.getLabelMappings();
      return {
        success: true,
        mappings
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get label mappings: ${error.message}`);
    }
  }

  @Put('label-mappings')
  async updateLabelMappings(@Body() mappings: any[]): Promise<{ success: boolean; message: string }> {
    try {
      await this.docVendorInvoiceService.updateLabelMappings(mappings);
      return {
        success: true,
        message: 'Label mappings updated successfully'
      };
    } catch (error) {
      throw new BadRequestException(`Failed to update label mappings: ${error.message}`);
    }
  }

  @Get('extraction-logs/:reviewId')
  async getExtractionLogs(@Param('reviewId') reviewId: string): Promise<{ success: boolean; logs: any[] }> {
    try {
      const logs = await this.docVendorInvoiceService.getExtractionLogs(reviewId);
      return {
        success: true,
        logs
      };
    } catch (error) {
      throw new BadRequestException(`Failed to get extraction logs: ${error.message}`);
    }
  }

  @Post('validate')
  async validateExtractedData(@Body() data: VendorInvoiceData): Promise<{
    isValid: boolean;
    validationResults: Array<{
      field: string;
      isValid: boolean;
      value: any;
      issues?: string[];
    }>;
    totalMismatches?: {
      lineTotal: number;
      headerTotal: number;
      difference: number;
    };
  }> {
    try {
      const validationResults = this.validateVendorInvoiceData(data);
      const totalMismatches = this.checkTotalMismatches(data);
      
      const isValid = validationResults.every(result => result.isValid) && 
                     (!totalMismatches || Math.abs(totalMismatches.difference) < 0.01);

      return {
        isValid,
        validationResults,
        totalMismatches: totalMismatches ? {
          lineTotal: Math.round(totalMismatches.lineTotal * 100) / 100,
          headerTotal: Math.round(totalMismatches.headerTotal * 100) / 100,
          difference: Math.round(totalMismatches.difference * 100) / 100
        } : undefined
      };
    } catch (error) {
      throw new BadRequestException('Failed to validate vendor invoice data: ' + error.message);
    }
  }

  @Get('test')
  async testEndpoint(): Promise<{ 
    message: string; 
    timestamp: string; 
    version: string;
    supportedFields: string[];
  }> {
    return {
      message: 'Vendor Invoice document service is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      supportedFields: [
        // Header fields
        'voucherNumber', 'voucherDate', 'documentNumber', 'documentDate',
        'partyName', 'partyAddress', 'gstNo', 'gstType', 'placeOfSupply',
        'currencyCode', 'exchangeRate', 'amount', 'localAmount', 'netAmount',
        'masterNumber', 'houseNumber', 'masterJobSid', 'houseJobSid', 'departmentMasterSid',
        
        // Charge detail fields
        'chargeDescription', 'narration', 'sacCode', 'hsnCode', 'unit',
        'numberOfUnit', 'drCr', 'currencyCode', 'rate', 'exchangeRate',
        'amount', 'taxableAmount', 'cgstRate', 'cgstAmount', 'sgstRate',
        'sgstAmount', 'igstRate', 'igstAmount', 'localAmount', 'partyAmount'
      ]
    };
  }

  private generateExtractionSummary(data: VendorInvoiceData): {
    totalFields: number;
    extractedFields: number;
    missingFields: string[];
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    const headerFields = [
      'partyName', 'partyAddress', 'gstNo', 'documentDate', 'currencyCode',
      'amount', 'voucherDetails'
    ];

    const extractedHeaderFields = headerFields.filter(field => {
      if (field === 'voucherDetails') {
        return data.voucherDetails && data.voucherDetails.length > 0;
      }
      return data[field] && data[field].toString().trim().length > 0;
    });

    const missingHeaderFields = headerFields.filter(field => {
      if (field === 'voucherDetails') {
        return !data.voucherDetails || data.voucherDetails.length === 0;
      }
      return !data[field] || data[field].toString().trim().length === 0;
    });

    let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    if (data.confidence >= 0.8) {
      confidenceLevel = 'HIGH';
    } else if (data.confidence >= 0.6) {
      confidenceLevel = 'MEDIUM';
    } else {
      confidenceLevel = 'LOW';
    }

    return {
      totalFields: headerFields.length,
      extractedFields: extractedHeaderFields.length,
      missingFields: missingHeaderFields,
      confidenceLevel,
    };
  }

  private validateVendorInvoiceData(data: VendorInvoiceData): Array<{
    field: string;
    isValid: boolean;
    value: any;
    issues?: string[];
  }> {
    const validationResults: Array<{
      field: string;
      isValid: boolean;
      value: any;
      issues?: string[];
    }> = [];

    // Validate required fields
    const requiredFields = [
      { field: 'partyName', name: 'Vendor Name' },
      { field: 'documentDate', name: 'Document Date' },
      { field: 'currencyCode', name: 'Currency Code' },
      { field: 'amount', name: 'Amount' }
    ];

    requiredFields.forEach(({ field, name }) => {
      const issues: string[] = [];
      if (!data[field]) {
        issues.push(`${name} is required`);
      } else if (field === 'amount' && data[field] <= 0) {
        issues.push(`${name} must be greater than 0`);
      }

      validationResults.push({
        field,
        isValid: issues.length === 0,
        value: data[field],
        issues: issues.length > 0 ? issues : undefined
      });
    });

    // Validate GST No format if present
    if (data.gstNo) {
      const gstIssues: string[] = [];
      const gstValid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.gstNo);
      
      if (!gstValid) {
        gstIssues.push('GST number format may be incorrect');
      }

      validationResults.push({
        field: 'gstNo',
        isValid: gstValid,
        value: data.gstNo,
        issues: gstIssues.length > 0 ? gstIssues : undefined
      });
    }

    // Validate currency consistency
    if (data.voucherDetails && data.voucherDetails.length > 0) {
      const mainCurrency = data.currencyCode;
      const inconsistentCurrency = data.voucherDetails.some(detail => 
        detail.currencyCode && detail.currencyCode !== mainCurrency
      );

      if (inconsistentCurrency) {
        validationResults.push({
          field: 'currencyCode',
          isValid: false,
          value: mainCurrency,
          issues: ['Currency codes in details do not match header currency']
        });
      }
    }

    // Validate numeric fields
    const numericFields = ['amount', 'exchangeRate', 'localAmount', 'netAmount'];
    numericFields.forEach(field => {
      if (data[field]) {
        const value = data[field];
        if (isNaN(value) || value < 0) {
          validationResults.push({
            field,
            isValid: false,
            value,
            issues: [`${field} must be a valid positive number`]
          });
        }
      }
    });

    return validationResults;
  }

  private checkTotalMismatches(data: VendorInvoiceData): { lineTotal: number; headerTotal: number; difference: number } | null {
    if (!data.voucherDetails || data.voucherDetails.length === 0 || !data.amount) {
      return null;
    }

    const lineTotal = data.voucherDetails.reduce((sum, detail) => {
      return sum + (detail.amount || 0);
    }, 0);

    const headerTotal = data.amount;
    const difference = lineTotal - headerTotal;

    return {
      lineTotal,
      headerTotal,
      difference
    };
  }
}
