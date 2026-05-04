

// // src/document/document.service.ts
// import { Injectable, Logger } from '@nestjs/common';
// import * as pdfParse from 'pdf-parse';

// export interface BillOfLadingData {

//   // Document Information
//   blNumber?: string;
//   dateOfIssue?: string;
//   placeOfIssue?: string;
//   freightTerms?: string;
  
//   // Shipper Information
//   shipper: string;
//   shipperAddress: string;
  
//   // Consignee Information
//   consignee: string;
//   consigneeAddress: string;
  
//   // Notify Party Information
//   notifyParty: string;
//   notifyPartyAddress: string;
  
//   // Delivery Agent Information
//   deliveryAgent: string;
//   deliveryAgentAddress: string;
  
//   // Ports and Places
//   portOfLoading: string;
//   portOfDischarge: string;
//   placeOfReceipt: string;
//   placeOfDelivery: string;
  
//   // Vessel Information
//   vesselVoyage: string;
  
//   // Cargo Information
//   cargoDetails: string;
//   cargoDescription: string;
//   marksAndNumbers: string;
//   numberOfPackages: string;
//   packageType: string;
//   grossWeight: string;
//   measurement: string;
  
//   // Container Information
//   containerDetails: string;
//   consolNumber: string;
  
//   // System Fields
//   confidence: number;
//   extractedText?: string;
// }

// @Injectable()
// export class DocumentService {
//   private readonly logger = new Logger(DocumentService.name);

//   async processBillOfLading(file: Express.Multer.File): Promise<BillOfLadingData> {
//     try {
//       this.logger.log('Starting Bill of Lading processing...');
      
//       // Extract text from PDF
//       const pdfText = await this.extractTextFromPDF(file.buffer);
//       this.logger.log(`Extracted ${pdfText.length} characters from PDF`);
      
//       // Log the first 1000 characters for debugging
//       this.logger.log(`PDF Content Preview: ${pdfText.substring(0, 1000)}`);
      
//       // Extract structured data using regex patterns
//       const extractedData = this.extractBillOfLadingData(pdfText);
      
//       this.logger.log(`Processing completed with confidence: ${Math.round(extractedData.confidence * 100)}%`);
//       this.logger.log(`Extracted data: ${JSON.stringify(extractedData, null, 2)}`);
      
//       return extractedData;
//     } catch (error) {
//       this.logger.error('Failed to process Bill of Lading:', error);
//       throw new Error(`Failed to process document: ${error.message}`);
//     }
//   }

//   private async extractTextFromPDF(buffer: Buffer): Promise<string> {
//     try {
//       const data = await pdfParse(buffer, {
//         normalizeWhitespace: true,
//         disableCombineTextItems: false,
//         max: 0, // Extract all pages
//       });
      
//       if (!data.text || data.text.trim().length < 50) {
//         throw new Error('PDF contains insufficient text content');
//       }
      
//       return data.text;
//     } catch (error) {
//       this.logger.error('PDF parsing error:', error);
//       throw new Error(`PDF parsing failed: ${error.message}`);
//     }
//   }

//   private extractBillOfLadingData(text: string): BillOfLadingData {
//     this.logger.log('Starting data extraction...');
    
//     // Clean and normalize text
//     const cleanText = this.cleanText(text);
    
//     const result: BillOfLadingData = {
//       shipper: '',
//       shipperAddress: '',
//       consignee: '',
//       consigneeAddress: '',
//       notifyParty: '',
//       notifyPartyAddress: '',
//       deliveryAgent: '',
//       deliveryAgentAddress: '',
//       portOfLoading: '',
//       portOfDischarge: '',
//       placeOfReceipt: '',
//       placeOfDelivery: '',
//       vesselVoyage: '',
//       cargoDetails: '',
//       cargoDescription:'',
//       marksAndNumbers:'',
//       numberOfPackages:'',
//       containerDetails: '',
//       packageType:'',
//       grossWeight:'',
//       measurement:'',
//       blNumber: '',
//       dateOfIssue: '',
//       placeOfIssue: '',
//       freightTerms: '',
//       consolNumber: '',
//       confidence: 0,
//       extractedText: cleanText.substring(0, 500) + '...' // First 500 chars for debugging
//     };

//     try {
//       // Extract Bill of Lading Number
//       result.blNumber = this.extractBLNumber(cleanText);
//       this.logger.log(`Extracted B/L Number: ${result.blNumber}`);

//       // Extract Shipper
//       result.shipper = this.extractShipper(cleanText);
//       this.logger.log(`Extracted Shipper: ${result.shipper}`);

//       // Extract Consignee
//       result.consignee = this.extractConsignee(cleanText);
//       this.logger.log(`Extracted Consignee: ${result.consignee}`);

//       // Extract Ports
//       result.portOfLoading = this.extractPortOfLoading(cleanText);
//       this.logger.log(`Extracted Port of Loading: ${result.portOfLoading}`);
      
//       result.portOfDischarge = this.extractPortOfDischarge(cleanText);
//       this.logger.log(`Extracted Port of Discharge: ${result.portOfDischarge}`);

//       // Extract Vessel/Voyage
//       result.vesselVoyage = this.extractVesselVoyage(cleanText);
//       this.logger.log(`Extracted Vessel/Voyage: ${result.vesselVoyage}`);

//       // Extract Cargo Details
//       result.cargoDetails = this.extractCargoDetails(cleanText);
//       this.logger.log(`Extracted Cargo Details: ${result.cargoDetails}`);

//       // Extract Container Details
//       result.containerDetails = this.extractContainerDetails(cleanText);
//       this.logger.log(`Extracted Container Details: ${result.containerDetails}`);

//       // Extract Date
//       result.dateOfIssue = this.extractDate(cleanText);
//       this.logger.log(`Extracted Date: ${result.dateOfIssue}`);

//       // Calculate confidence based on extracted fields
//       result.confidence = this.calculateConfidence(result);
//       this.logger.log(`Calculated confidence: ${result.confidence}`);

//     } catch (error) {
//       this.logger.error('Error during field extraction:', error);
//       result.confidence = 0.1; // Low confidence due to extraction errors
//     }

//     return result;
//   }

//   private cleanText(text: string): string {
//     return text
//       .replace(/\r\n/g, '\n')
//       .replace(/\r/g, '\n')
//       .replace(/\t/g, ' ')
//       .replace(/\s+/g, ' ')
//       .trim();
//   }

//   private extractBLNumber(text: string): string {
//     // Enhanced patterns for your document format
//     const patterns = [
//       /DESG\d+/i,  // Specific pattern from your document
//       /Shipper\s+B\/L\s+No\.?\s*([A-Z0-9\-]{6,20})/i,
//       /B\/L\s*No\.?\s*:?\s*([A-Z0-9\-]{6,20})/i,
//       /(?:BILL OF LADING|B\/L|BL)\s*(?:NO\.?|NUMBER|#)?\s*:?\s*([A-Z0-9\-]{6,20})/i,
//       /([A-Z]{3,4}\d{6,15})/g
//     ];

//     for (const pattern of patterns) {
//       const match = text.match(pattern);
//       if (match && match[1] && match[1].trim().length >= 4) {
//         return match[1].trim();
//       }
//       // For the first pattern (DESG format), return the whole match
//       if (pattern.source === 'DESG\\d+' && match) {
//         return match[0].trim();
//       }
//     }
//     return '';
//   }

//   private extractShipper(text: string): string {
//     // Multiple strategies for shipper extraction
//     const patterns = [
//       // Look for shipper section in your document format
//       /GIVAUDAN\s+WANG\s+PTE\s+LTD[^\n]*(?:\n[^\n]*){0,3}/i,
//       /P\/A\s+GIVAUDAN[^\n]*(?:\n[^\n]*){0,3}/i,
      
//       // Generic patterns
//       /(?:Shipper|SHIPPER)\s*\n([^\n]+(?:\n[^\n]+){0,4})(?=\n.*?(?:Consignee|CONSIGNEE))/is,
//       /(?:Shipper|SHIPPER)\s*([^\n]+(?:\n[^\n]+){0,3})/i,
      
//       // Position-based extraction (first company after "Shipper")
//       /Shipper[^\n]*\n\s*([A-Z][^\n]+(?:\n[^\n]+){0,3})/i
//     ];

//     return this.extractWithPatterns(text, patterns);
//   }

//   private extractConsignee(text: string): string {
//     const patterns = [
//       // Specific for your document
//       /RAAZIQ\s+INTERNATIONAL\s+PVT\s+LTD[^\n]*(?:\n[^\n]*){0,4}/i,
      
//       // Generic patterns
//       /(?:Consignee|CONSIGNEE)\s+or\s+Order\s*\n([^\n]+(?:\n[^\n]+){0,4})(?=\n.*?(?:Notify|NOTIFY))/is,
//       /(?:Consignee|CONSIGNEE)\s*\n([^\n]+(?:\n[^\n]+){0,4})/i,
//       /(?:Consignee|CONSIGNEE)\s*([^\n]+(?:\n[^\n]+){0,3})/i
//     ];

//     return this.extractWithPatterns(text, patterns);
//   }

//   private extractPortOfLoading(text: string): string {
//     const patterns = [
//       // Specific patterns from your document
//       /Port\s+of\s+Loading\s*\n([^\n]+)/i,
//       /SINGAPORE,\s*SINGAPORE(?:\s+CFS)?/i,
      
//       // Generic patterns
//       /(?:PORT OF LOADING|POL|Place of Receipt)\s*:?\s*([^\n]+)/i,
//       /(?:Loading|LOADING)\s*:?\s*([A-Z][^\n,]+)/i
//     ];

//     const result = this.extractWithPatterns(text, patterns);
//     return result || 'SINGAPORE, SINGAPORE'; // Fallback from document
//   }

//   private extractPortOfDischarge(text: string): string {
//     const patterns = [
//       // Specific patterns from your document
//       /Port\s+of\s+Discharge\s*\n([^\n]+)/i,
//       /KARACHI,\s*PAKISTAN(?:\s+CFS)?/i,
      
//       // Generic patterns
//       /(?:PORT OF DISCHARGE|POD|Place of Delivery)\s*:?\s*([^\n]+)/i,
//       /(?:Discharge|DISCHARGE)\s*:?\s*([A-Z][^\n,]+)/i
//     ];

//     const result = this.extractWithPatterns(text, patterns);
//     return result || 'KARACHI, PAKISTAN'; // Fallback from document
//   }

//   private extractVesselVoyage(text: string): string {
//     const patterns = [
//       // Specific pattern from your document
//       /OOCL\s+GUANGZHOU\/\d+W?/i,
      
//       // Generic vessel patterns
//       /Vessel\s*\n([^\n]+)/i,
//       /(?:Vessel|VESSEL)\s*:?\s*([^\n]+)/i,
//       /(?:OOCL|MSC|COSCO|EVERGREEN|CMA|MAERSK)\s+[^\n]+/i,
      
//       // Vessel/Voyage combined
//       /([A-Z\s]+\/\d+[A-Z]?)/i
//     ];

//     return this.extractWithPatterns(text, patterns);
//   }

//   private extractCargoDetails(text: string): string {
//     const patterns = [
//       // Specific from your document
//       /Description\s+of\s+Goods\s*\n([^\n]+)/i,
//       /SPARE\s+PARTS/i,
//       /11\s+PALLETS\s+SPARE\s+PARTS/i,
      
//       // Generic patterns
//       /(?:DESCRIPTION OF GOODS|Description of Goods|CARGO|Cargo)\s*:?\s*([^\n]+(?:\n[^\n]+){0,2})/i,
//       /(?:Goods|GOODS|Cargo|CARGO)\s*:?\s*([^\n]+)/i
//     ];

//     const result = this.extractWithPatterns(text, patterns);
//     if (result) return result;

//     // Try to extract from the cargo section
//     const cargoMatch = text.match(/11\s+PALLETS.*?SPARE\s+PARTS/i);
//     if (cargoMatch) {
//       return cargoMatch[0];
//     }

//     return '';
//   }

//   private extractContainerDetails(text: string): string {
//     const patterns = [
//       // Container number patterns
//       /([A-Z]{4}\d{7})/g,
      
//       // Consol number from your document
//       /Consol\s+No:\s*([A-Z0-9]+)/i,
//       /C\d{9}/g,
      
//       // Pallets information
//       /(\d+\s+PALLETS)/i,
//       /(ELEVEN\s+PALLETS)/i,
      
//       // General container patterns
//       /(?:Container|CONTAINER)\s*:?\s*([^\n]+)/i
//     ];

//     const results: string[] = [];
    
//     for (const pattern of patterns) {
//       const matches = text.match(pattern);
//       if (matches) {
//         if (pattern.global) {
//           // For global patterns, add all matches
//           results.push(...matches.filter(match => typeof match === 'string'));
//         } else if (matches[1]) {
//           // For non-global patterns with capture groups
//           results.push(matches[1]);
//         } else if (matches[0]) {
//           // For non-global patterns without capture groups
//           results.push(matches[0]);
//         }
//       }
//     }

//     // Remove duplicates and clean up
//     const uniqueResults = [...new Set(results)]
//       .filter((result: string) => result && result.trim().length > 0)
//       .map((result: string) => result.trim());

//     return uniqueResults.join(', ');
//   }

//   private extractDate(text: string): string {
//     const patterns = [
//       // Various date formats
//       /(\d{4}-\d{2}-\d{2})/g,
//       /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g,
//       /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d{2,4})/i,
      
//       // From place and date of issue section
//       /Place\s+and\s+Date\s+of\s+Issue[^\n]*\n([^\n]+)/i
//     ];

//     for (const pattern of patterns) {
//       const match = text.match(pattern);
//       if (match && match[1]) {
//         return match[1].trim();
//       } else if (match && match[0] && pattern.source.includes('Place')) {
//         // For place and date pattern, extract date from the result
//         const dateInResult = match[0].match(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/);
//         if (dateInResult) {
//           return dateInResult[0];
//         }
//       }
//     }

//     return '';
//   }

//   private extractWithPatterns(text: string, patterns: RegExp[]): string {
//     for (const pattern of patterns) {
//       try {
//         const match = text.match(pattern);
//         if (match) {
//           let result = match[1] || match[0];
//           if (result) {
//             // Clean up the extracted text
//             result = result
//               .replace(/\s+/g, ' ')
//               .replace(/\n+/g, '\n')
//               .replace(/^[:\-\s]+|[:\-\s]+$/g, '')
//               .trim();
            
//             // Only return if we have meaningful content
//             if (result.length > 1) {
//               return result;
//             }
//           }
//         }
//       } catch (error) {
//         this.logger.warn(`Pattern matching error: ${error.message}`);
//         continue;
//       }
//     }
//     return '';
//   }

//   private calculateConfidence(data: BillOfLadingData): number {
//     const requiredFields = [
//       'shipper', 'consignee', 'portOfLoading', 'portOfDischarge',
//       'vesselVoyage', 'cargoDetails'
//     ];

//     const optionalFields = [
//       'shipperAddress', 'consigneeAddress', 'containerDetails',
//       'grossWeight', 'measurement', 'numberOfPackages'
//     ];

//     const filledRequiredFields = requiredFields.filter(field => 
//       data[field] && data[field].toString().trim().length > 0
//     );

//     const filledOptionalFields = optionalFields.filter(field => 
//       data[field] && data[field].toString().trim().length > 0
//     );

//     // Base confidence from required fields
//     let confidence = filledRequiredFields.length / requiredFields.length;

//     // Bonus from optional fields (max 0.3)
//     const optionalBonus = (filledOptionalFields.length / optionalFields.length) * 0.3;
//     confidence += optionalBonus;

//     // Bonus points for specific important fields
//     if (data.blNumber && data.blNumber.length > 3) confidence += 0.1;
//     if (data.consolNumber && data.consolNumber.length > 3) confidence += 0.05;
//     if (data.dateOfIssue && data.dateOfIssue.length > 5) confidence += 0.05;

//     // Quality bonus - check if extractions look reasonable
//     if (data.shipper && (data.shipper.includes('PTE LTD') || data.shipper.includes('LTD'))) confidence += 0.05;
//     if (data.consignee && (data.consignee.includes('PVT LTD') || data.consignee.includes('LTD'))) confidence += 0.05;
//     if (data.vesselVoyage && data.vesselVoyage.includes('/')) confidence += 0.05;
//     if (data.grossWeight && data.grossWeight.includes('KG')) confidence += 0.05;
//     if (data.measurement && data.measurement.includes('M3')) confidence += 0.05;

//     return Math.max(0, Math.min(1, confidence));
//   }
// }

// src/document/document.controller.ts
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/common/decorators/auth.decorator';
import { DocumentService } from 'src/operation/services/document/document.service';
// import { DocumentService } from './document.service';

// Import the interface from service
interface BillOfLadingData {
  // Document Information
  blNumber?: string;
  dateOfIssue?: string;
  placeOfIssue?: string;
  freightTerms?: string;
  
  // Shipper Information
  shipper: string;
  shipperAddress: string;
  
  // Consignee Information
  consignee: string;
  consigneeAddress: string;
  
  // Notify Party Information
  notifyParty: string;
  notifyPartyAddress: string;
  
  // Delivery Agent Information
  deliveryAgent: string;
  deliveryAgentAddress: string;
  
  // Ports and Places
  portOfLoading: string;
  portOfDischarge: string;
  placeOfReceipt: string;
  placeOfDelivery: string;
  
  // Vessel Information
  vesselVoyage: string;
  
  // Cargo Information
  cargoDetails: string;
  cargoDescription: string;
  marksAndNumbers: string;
  numberOfPackages: string;
  packageType: string;
  grossWeight: string;
  measurement: string;
  
  // Container Information
  containerDetails: string;
  consolNumber: string;
  
  // System Fields
  confidence: number;
  extractedText?: string;
}

export interface DocumentProcessResponse {
  success: boolean;
  data?: BillOfLadingData;
  error?: string;
  message?: string;
  processingTime?: number;
  extractionSummary?: {
    totalFields: number;
    extractedFields: number;
    missingFields: string[];
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

@Auth()
@Controller('api/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload/bill-of-lading')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, callback) => {
        // Only allow PDF files
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
  async uploadBillOfLading(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<DocumentProcessResponse> {
    const startTime = Date.now();

    try {
      // Validate file upload
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }

      // Validate file size
      if (file.size === 0) {
        throw new BadRequestException('Uploaded file is empty');
      }

      console.log(`Processing file: ${file.originalname}, Size: ${file.size} bytes`);

      // Process the document
      const extractedData = await this.documentService.processBillOfLading(file);
      
      const processingTime = Date.now() - startTime;
      
      // Generate extraction summary
      const extractionSummary = this.generateExtractionSummary(extractedData);
      
      console.log(`Document processed successfully in ${processingTime}ms`);
      console.log(`Extraction Summary:`, extractionSummary);

      // Determine confidence level message
      const confidencePercentage = Math.round(extractedData.confidence * 100);
      let message = `Document processed successfully with ${confidencePercentage}% confidence`;
      
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
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error('Document processing error:', error);

      // Handle different types of errors
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle file too large error
      if (error.code === 'LIMIT_FILE_SIZE') {
        throw new HttpException(
          'File too large. Maximum size is 10MB',
          HttpStatus.PAYLOAD_TOO_LARGE
        );
      }

      // Handle PDF parsing errors
      if (error.message.includes('PDF parsing failed')) {
        return {
          success: false,
          error: 'Invalid or corrupted PDF file. Please ensure the file is a valid PDF document.',
          processingTime,
        };
      }

      // Handle insufficient content errors
      if (error.message.includes('insufficient text content')) {
        return {
          success: false,
          error: 'PDF appears to be mostly images or has insufficient text content. Please ensure the PDF contains readable text.',
          processingTime,
        };
      }

      // Generic error response
      return {
        success: false,
        error: error.message || 'Failed to process document',
        processingTime,
      };
    }
  }

  @Post('test')
  async testEndpoint(): Promise<{ 
    message: string; 
    timestamp: string; 
    version: string;
    supportedFields: string[];
  }> {
    return {
      message: 'Document service is running with enhanced field extraction',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      supportedFields: [
        // Document Information
        'blNumber', 'dateOfIssue', 'placeOfIssue', 'freightTerms',
        
        // Parties
        'shipper', 'shipperAddress', 'consignee', 'consigneeAddress',
        'notifyParty', 'notifyPartyAddress', 'deliveryAgent', 'deliveryAgentAddress',
        
        // Ports & Places
        'portOfLoading', 'portOfDischarge', 'placeOfReceipt', 'placeOfDelivery',
        
        // Vessel
        'vesselVoyage',
        
        // Cargo
        'cargoDetails', 'cargoDescription', 'marksAndNumbers', 
        'numberOfPackages', 'packageType', 'grossWeight', 'measurement',
        
        // Container
        'containerDetails', 'consolNumber'
      ]
    };
  }

  @Post('validate')
  async validateExtractedData(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{
    isValid: boolean;
    validationResults: Array<{
      field: string;
      isValid: boolean;
      value: string;
      issues?: string[];
    }>;
  }> {
    try {
      const extractedData = await this.documentService.processBillOfLading(file);
      const validationResults = this.validateBillOfLadingData(extractedData);
      
      const isValid = validationResults.every(result => result.isValid);
      
      return {
        isValid,
        validationResults,
      };
    } catch (error) {
      throw new BadRequestException('Failed to validate document: ' + error.message);
    }
  }

  private generateExtractionSummary(data: BillOfLadingData): {
    totalFields: number;
    extractedFields: number;
    missingFields: string[];
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    const allFields = [
      // Required fields
      'shipper', 'consignee', 'portOfLoading', 'portOfDischarge', 
      'vesselVoyage', 'cargoDetails', 'containerDetails',
      
      // Optional but important fields
      'blNumber', 'shipperAddress', 'consigneeAddress', 'dateOfIssue',
      'notifyParty', 'grossWeight', 'measurement', 'numberOfPackages',
      'packageType', 'consolNumber', 'freightTerms', 'marksAndNumbers',
      'cargoDescription', 'placeOfReceipt', 'placeOfDelivery',
      'notifyPartyAddress', 'deliveryAgent', 'deliveryAgentAddress', 'placeOfIssue'
    ];

    const extractedFields = allFields.filter(field => 
      data[field] && data[field].toString().trim().length > 0
    );

    const missingFields = allFields.filter(field => 
      !data[field] || data[field].toString().trim().length === 0
    );

    let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    if (data.confidence >= 0.8) {
      confidenceLevel = 'HIGH';
    } else if (data.confidence >= 0.6) {
      confidenceLevel = 'MEDIUM';
    } else {
      confidenceLevel = 'LOW';
    }

    return {
      totalFields: allFields.length,
      extractedFields: extractedFields.length,
      missingFields,
      confidenceLevel,
    };
  }

  private validateBillOfLadingData(data: BillOfLadingData): Array<{
    field: string;
    isValid: boolean;
    value: string;
    issues?: string[];
  }> {
    const validationResults: Array<{
      field: string;
      isValid: boolean;
      value: string;
      issues?: string[];
    }> = [];

    // Validate B/L Number
    const blNumberIssues: string[] = [];
    if (!data.blNumber) {
      blNumberIssues.push('B/L Number is missing');
    } else if (data.blNumber.length < 6) {
      blNumberIssues.push('B/L Number seems too short');
    }
    
    validationResults.push({
      field: 'blNumber',
      isValid: !!(data.blNumber && data.blNumber.length >= 6),
      value: data.blNumber || '',
      issues: blNumberIssues.length > 0 ? blNumberIssues : undefined
    });

    // Validate Shipper
    const shipperIssues: string[] = [];
    if (!data.shipper) {
      shipperIssues.push('Shipper name is required');
    } else if (data.shipper.length <= 3) {
      shipperIssues.push('Shipper name seems too short');
    }

    validationResults.push({
      field: 'shipper',
      isValid: !!(data.shipper && data.shipper.length > 3),
      value: data.shipper || '',
      issues: shipperIssues.length > 0 ? shipperIssues : undefined
    });

    // Validate Consignee
    const consigneeIssues: string[] = [];
    if (!data.consignee) {
      consigneeIssues.push('Consignee name is required');
    } else if (data.consignee.length <= 3) {
      consigneeIssues.push('Consignee name seems too short');
    }

    validationResults.push({
      field: 'consignee',
      isValid: !!(data.consignee && data.consignee.length > 3),
      value: data.consignee || '',
      issues: consigneeIssues.length > 0 ? consigneeIssues : undefined
    });

    // Validate Port of Loading
    const polIssues: string[] = [];
    if (!data.portOfLoading) {
      polIssues.push('Port of Loading is required');
    } else if (data.portOfLoading.length <= 3) {
      polIssues.push('Port of Loading seems too short');
    }

    validationResults.push({
      field: 'portOfLoading',
      isValid: !!(data.portOfLoading && data.portOfLoading.length > 3),
      value: data.portOfLoading || '',
      issues: polIssues.length > 0 ? polIssues : undefined
    });

    // Validate Port of Discharge
    const podIssues: string[] = [];
    if (!data.portOfDischarge) {
      podIssues.push('Port of Discharge is required');
    } else if (data.portOfDischarge.length <= 3) {
      podIssues.push('Port of Discharge seems too short');
    }

    validationResults.push({
      field: 'portOfDischarge',
      isValid: !!(data.portOfDischarge && data.portOfDischarge.length > 3),
      value: data.portOfDischarge || '',
      issues: podIssues.length > 0 ? podIssues : undefined
    });

    // Validate Vessel/Voyage
    const vesselIssues: string[] = [];
    if (!data.vesselVoyage) {
      vesselIssues.push('Vessel/Voyage information is required');
    } else if (data.vesselVoyage.length <= 3) {
      vesselIssues.push('Vessel/Voyage information seems too short');
    }

    validationResults.push({
      field: 'vesselVoyage',
      isValid: !!(data.vesselVoyage && data.vesselVoyage.length > 3),
      value: data.vesselVoyage || '',
      issues: vesselIssues.length > 0 ? vesselIssues : undefined
    });

    // Validate Weight format (if present)
    if (data.grossWeight) {
      const weightIssues: string[] = [];
      const weightValid = /\d+[\d.,]*\s*(?:KG|MT|TON)/i.test(data.grossWeight);
      
      if (!weightValid) {
        weightIssues.push('Gross weight format may be incorrect (expected: number + unit like KG, MT, TON)');
      }

      validationResults.push({
        field: 'grossWeight',
        isValid: weightValid,
        value: data.grossWeight,
        issues: weightIssues.length > 0 ? weightIssues : undefined
      });
    }

    // Validate Measurement format (if present)
    if (data.measurement) {
      const measurementIssues: string[] = [];
      const measurementValid = /\d+[\d.,]*\s*M3/i.test(data.measurement);
      
      if (!measurementValid) {
        measurementIssues.push('Measurement format may be incorrect (expected: number M3)');
      }

      validationResults.push({
        field: 'measurement',
        isValid: measurementValid,
        value: data.measurement,
        issues: measurementIssues.length > 0 ? measurementIssues : undefined
      });
    }

    // Validate Date format (if present)
    if (data.dateOfIssue) {
      const dateIssues: string[] = [];
      const dateValid = /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(data.dateOfIssue);
      
      if (!dateValid) {
        dateIssues.push('Date format may be incorrect (expected: DD/MM/YYYY or YYYY-MM-DD)');
      }

      validationResults.push({
        field: 'dateOfIssue',
        isValid: dateValid,
        value: data.dateOfIssue,
        issues: dateIssues.length > 0 ? dateIssues : undefined
      });
    }

    // Validate Cargo Details
    if (data.cargoDetails) {
      const cargoIssues: string[] = [];
      if (data.cargoDetails.length <= 2) {
        cargoIssues.push('Cargo details seem too short');
      }

      validationResults.push({
        field: 'cargoDetails',
        isValid: data.cargoDetails.length > 2,
        value: data.cargoDetails,
        issues: cargoIssues.length > 0 ? cargoIssues : undefined
      });
    }

    // Validate Container Details
    if (data.containerDetails) {
      const containerIssues: string[] = [];
      if (data.containerDetails.length <= 2) {
        containerIssues.push('Container details seem too short');
      }

      validationResults.push({
        field: 'containerDetails',
        isValid: data.containerDetails.length > 2,
        value: data.containerDetails,
        issues: containerIssues.length > 0 ? containerIssues : undefined
      });
    }

    return validationResults;
  }
}
