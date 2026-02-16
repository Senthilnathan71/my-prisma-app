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
    const llmEndTime = Date.now();

    return {
      success: true,
      documentType,
      rawText,
      extractedData,
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
            num_predict: 512,     // Max tokens (invoices rarely need more)
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
      try {
        return JSON.parse(jsonText);
      } catch (parseError) {
        this.logger.error(`Failed to parse LLM JSON response: ${jsonText?.substring(0, 200)}`);
        throw new HttpException(
          'AI extraction returned invalid data format. Please try again.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
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
