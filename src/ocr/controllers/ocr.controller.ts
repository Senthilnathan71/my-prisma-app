import {
  Controller,
  Post,
  Get,
  Body,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from 'src/common/decorators/auth.decorator';
import { OcrService } from 'src/ocr/services/ocr.service';

@Auth()
@Controller('api/ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * POST /api/ocr/extract
   * Upload a PDF file and extract structured data using OCR + AI
   * 
   * Body (form-data):
   *   - file: PDF file (max 20MB)
   *   - documentType: 'invoice' | 'bill_of_lading' | 'packing_list' (default: 'invoice')
   */
  @Post('extract')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/jpg',
        ];
        if (!allowedMimes.includes(file.mimetype)) {
          cb(
            new HttpException(
              'Only PDF and image files (PNG, JPEG) are allowed.',
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async extractFromPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
  ) {
    if (!file) {
      throw new HttpException('No file uploaded.', HttpStatus.BAD_REQUEST);
    }

    if (file.size === 0) {
      throw new HttpException('Uploaded file is empty.', HttpStatus.BAD_REQUEST);
    }

    const normalizedDocumentType = (documentType || 'invoice').trim().toLowerCase();

    return this.ocrService.extractFromPdf(
      file.buffer,
      file.originalname,
      normalizedDocumentType,
    );
  }

  /**
   * GET /api/ocr/health
   * Check if OCR and LLM services are running
   */
  @Get('health')
  async healthCheck() {
    return this.ocrService.checkHealth();
  }
}
