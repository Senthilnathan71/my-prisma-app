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
import { ManifestDocumentService } from 'src/operation/services/manifest-document/manifest-document.service';

interface ManifestData {
  masterJob: {
    manifestNumber: string;
    vesselName: string;
    voyageNumber: string;
    portOfLoading: string;
    portOfDischarge: string;
    dateOfDeparture: string;
    dateOfArrival: string;
    agent: string;
    carrier: string;
    totalContainers: number;
    totalWeight: string;
    totalVolume: string;
  };
  houseJobs: Array<{
    hblNumber: string;
    shipper: string;
    shipperAddress: string;
    consignee: string;
    consigneeAddress: string;
    notifyParty: string;
    cargoDescription: string;
    numberOfPackages: string;
    packageType: string;
    grossWeight: string;
    netWeight: string;
    measurement: string;
    containerNumber: string;
    marksAndNumbers: string;
    freightTerms: string;
  }>;
  confidence: number;
}

export interface ManifestProcessResponse {
  success: boolean;
  data?: ManifestData;
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
@Controller('api/manifestDoc')
export class ManifestDocumentController {
  constructor(private readonly manifestService: ManifestDocumentService) {}

  @Post('upload/manifest')
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
        fileSize: 20 * 1024 * 1024, // 20MB limit for manifest documents
      },
    }),
  )
  async uploadManifest(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ManifestProcessResponse> {
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

      console.log(`Processing manifest file: ${file.originalname}, Size: ${file.size} bytes`);

      // Process the manifest document
      const extractedData:any = await this.manifestService.processManifest(file);

      const processingTime = Date.now() - startTime;

      // Generate extraction summary
      const extractionSummary = this.generateExtractionSummary(extractedData);

      console.log(`Manifest processed successfully in ${processingTime}ms`);
      console.log(`Extraction Summary:`, extractionSummary);

      // Determine confidence level message
      const confidencePercentage = Math.round(extractedData.confidence * 100);
      let message = `Manifest processed successfully with ${confidencePercentage}% confidence`;

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

      console.error('Manifest processing error:', error);

      // Handle different types of errors
      if (error instanceof BadRequestException) {
        throw error;
      }

      // Handle file too large error
      if (error.code === 'LIMIT_FILE_SIZE') {
        throw new HttpException(
          'File too large. Maximum size is 20MB',
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
        error: error.message || 'Failed to process manifest document',
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
      message: 'Manifest document service is running with OCR processing',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      supportedFields: [
        // Master Job Fields
        'manifestNumber', 'vesselName', 'voyageNumber', 'portOfLoading',
        'portOfDischarge', 'dateOfDeparture', 'dateOfArrival', 'agent',
        'carrier', 'totalContainers', 'totalWeight', 'totalVolume',

        // House Job Fields
        'hblNumber', 'shipper', 'shipperAddress', 'consignee',
        'consigneeAddress', 'notifyParty', 'cargoDescription',
        'numberOfPackages', 'packageType', 'grossWeight', 'netWeight',
        'measurement', 'containerNumber', 'marksAndNumbers', 'freightTerms'
      ]
    };
  }

  private generateExtractionSummary(data: ManifestData): {
    totalFields: number;
    extractedFields: number;
    missingFields: string[];
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  } {
    // Master job fields
    const masterFields = [
      'manifestNumber', 'vesselName', 'voyageNumber', 'portOfLoading',
      'portOfDischarge', 'dateOfDeparture', 'dateOfArrival', 'agent',
      'carrier', 'totalContainers', 'totalWeight', 'totalVolume'
    ];

    // House job fields (count first house job if exists)
    const houseFields = data.houseJobs.length > 0 ? [
      'hblNumber', 'shipper', 'shipperAddress', 'consignee',
      'consigneeAddress', 'notifyParty', 'cargoDescription',
      'numberOfPackages', 'packageType', 'grossWeight', 'netWeight',
      'measurement', 'containerNumber', 'marksAndNumbers', 'freightTerms'
    ] : [];

    const allFields = [...masterFields, ...houseFields];

    // Check master job fields
    const extractedMasterFields = masterFields.filter(field =>
      data.masterJob[field] && data.masterJob[field].toString().trim().length > 0
    );

    // Check house job fields (from first house job if exists)
    const extractedHouseFields = data.houseJobs.length > 0 ?
      houseFields.filter(field =>
        data.houseJobs[0][field] && data.houseJobs[0][field].toString().trim().length > 0
      ) : [];

    const extractedFields = [...extractedMasterFields, ...extractedHouseFields];

    // Find missing fields
    const missingMasterFields = masterFields.filter(field =>
      !data.masterJob[field] || data.masterJob[field].toString().trim().length === 0
    );

    const missingHouseFields = data.houseJobs.length > 0 ?
      houseFields.filter(field =>
        !data.houseJobs[0][field] || data.houseJobs[0][field].toString().trim().length === 0
      ) : houseFields;

    const missingFields = [...missingMasterFields, ...missingHouseFields];

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
}
