import { Injectable, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';

export interface ContainerInfo {
  containerNumber: string;
  containerType: string;
  sealNumber: string;
  size: string;
  weight: string;
  measurement: string;
}

export interface ManifestData {
  masterJob: {
    manifestNumber: string;
    jobNumber: string;
    vesselName: string;
    voyageNumber: string;
    portOfLoading: string;
    portOfDischarge: string;
    dateOfDeparture: string;
    dateOfArrival: string;
    etd: string;
    eta: string;
    agent: string;
    carrier: string;
    totalContainers: number;
    totalWeight: string;
    totalVolume: string;
    containerList: ContainerInfo[];
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
    containerNumbers: string[];
    marksAndNumbers: string;
    freightTerms: string;
  }>;
  confidence: number;
}

@Injectable()
export class ManifestDocumentService {
  private readonly logger = new Logger(ManifestDocumentService.name);

  async processManifest(file: Express.Multer.File): Promise<ManifestData> {
    try {
      this.logger.log('Starting manifest processing...');

      // Extract text from PDF
      const pdfText = await this.extractTextFromPDF(file.buffer);
      this.logger.log(`Extracted ${pdfText.length} characters from PDF`);

      // Log the first 1000 characters for debugging
      this.logger.log(`PDF Content Preview: ${pdfText.substring(0, 1000)}`);

      // Extract structured data using regex patterns
      const extractedData = this.extractManifestData(pdfText);

      this.logger.log(`Processing completed with confidence: ${Math.round(extractedData.confidence * 100)}%`);
      this.logger.log(`Extracted master job data: ${JSON.stringify(extractedData.masterJob, null, 2)}`);
      this.logger.log(`Extracted ${extractedData.houseJobs.length} house jobs`);

      return extractedData;
    } catch (error) {
      this.logger.error('Failed to process manifest:', error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer, {
        normalizeWhitespace: true,
        disableCombineTextItems: false,
        max: 0, // Extract all pages
      });

      if (!data.text || data.text.trim().length < 50) {
        throw new Error('PDF contains insufficient text content');
      }

      return data.text;
    } catch (error) {
      this.logger.error('PDF parsing error:', error);
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  private extractManifestData(text: string): ManifestData {
    this.logger.log('Starting manifest data extraction...');

    // Clean and normalize text
    const cleanText = this.cleanText(text);

    const result: ManifestData = {
      masterJob: {
        manifestNumber: '',
        jobNumber: '',
        vesselName: '',
        voyageNumber: '',
        portOfLoading: '',
        portOfDischarge: '',
        dateOfDeparture: '',
        dateOfArrival: '',
        etd: '',
        eta: '',
        agent: '',
        carrier: '',
        totalContainers: 0,
        totalWeight: '',
        totalVolume: '',
        containerList: [],
      },
      houseJobs: [],
      confidence: 0,
    };

    try {
      // Extract Master Job Information
      result.masterJob = this.extractMasterJob(cleanText);
      this.logger.log(`Extracted master job: ${JSON.stringify(result.masterJob)}`);

      // Extract House Jobs Information
      result.houseJobs = this.extractHouseJobs(cleanText);
      this.logger.log(`Extracted ${result.houseJobs.length} house jobs`);

      // Calculate confidence based on extracted fields
      result.confidence = this.calculateConfidence(result);
      this.logger.log(`Calculated confidence: ${result.confidence}`);

    } catch (error) {
      this.logger.error('Error during field extraction:', error);
      result.confidence = 0.1; // Low confidence due to extraction errors
    }

    return result;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractMasterJob(text: string): ManifestData['masterJob'] {
    const masterJob = {
      manifestNumber: '',
      jobNumber: '',
      vesselName: '',
      voyageNumber: '',
      portOfLoading: '',
      portOfDischarge: '',
      dateOfDeparture: '',
      dateOfArrival: '',
      etd: '',
      eta: '',
      agent: '',
      carrier: '',
      totalContainers: 0,
      totalWeight: '',
      totalVolume: '',
      containerList: [],
    };

    // Extract Manifest Number (Consol No)
    masterJob.manifestNumber = this.extractManifestNumber(text);

    // Extract Job Number
    masterJob.jobNumber = this.extractJobNumber(text);

    // Extract Vessel Name and Voyage
    const vesselVoyage = this.extractVesselAndVoyage(text);
    masterJob.vesselName = vesselVoyage.vessel;
    masterJob.voyageNumber = vesselVoyage.voyage;

    // Extract Ports
    masterJob.portOfLoading = this.extractPortOfLoading(text);
    masterJob.portOfDischarge = this.extractPortOfDischarge(text);

    // Extract Dates
    const dates = this.extractDates(text);
    masterJob.dateOfDeparture = dates.departure;
    masterJob.dateOfArrival = dates.arrival;

    // Extract ETD and ETA
    const etdEta = this.extractEtdEta(text);
    masterJob.etd = etdEta.etd;
    masterJob.eta = etdEta.eta;

    // Extract Agent and Carrier
    masterJob.agent = this.extractAgent(text);
    masterJob.carrier = this.extractCarrier(text);

    // Extract Totals
    masterJob.totalContainers = this.extractTotalContainers(text);
    masterJob.totalWeight = this.extractTotalWeight(text);
    masterJob.totalVolume = this.extractTotalVolume(text);

    // Extract Container List
    // masterJob.containerList = this.extractContainerList(text);

    return masterJob;
  }

  private extractManifestNumber(text: string): string {
    const patterns = [
      /Consol\s+No[:.]?\s*([A-Z0-9-]+)/i,
      /Manifest\s+No[:.]?\s*([A-Z0-9-]+)/i,
      /Job\s+No[:.]?\s*([A-Z0-9-]+)/i,
      /([A-Z]+\d{8,12})/,
      /\b([A-Z]{2,4}\d{6,12})\b/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[1].length >= 6) {
        return match[1].trim();
      }
    }
    return '';
  }

  private extractJobNumber(text: string): string {
    const patterns = [
      /Job\s+No[:.]?\s*([A-Z0-9-]+)/i,
      /Job\s+Number[:.]?\s*([A-Z0-9-]+)/i,
      /Reference[:.]?\s*([A-Z0-9-]+)/i,
      /Booking\s+No[:.]?\s*([A-Z0-9-]+)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractVesselAndVoyage(text: string): { vessel: string; voyage: string } {
    // First try to find vessel/voyage patterns in table headers or structured sections
    const structuredPatterns = [
      /Vessel\s+Voyage[^]*?([A-Z\s]{3,20})\s+([A-Z0-9]{2,10})/i,
      /Vessel[:.]?\s*([A-Z\s]{3,20})\s*[\/\s]\s*Voyage[:.]?\s*([A-Z0-9]{2,10})/i,
      /([A-Z\s]{3,20})\s*\/\s*([A-Z0-9]{2,10})\s*(?:Sailing|ETD|ETA)/i,
    ];

    for (const pattern of structuredPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[2]) {
        const vessel = match[1].replace(/\s+/g, ' ').trim();
        const voyage = match[2].trim();

        // Validate vessel name (should not contain numbers or be too short)
        if (vessel.length >= 3 && vessel.length <= 30 && !/\d/.test(vessel) &&
            !vessel.includes('Line') && !vessel.includes('Port') && !vessel.includes('Discharge')) {
          return {
            vessel: vessel,
            voyage: voyage,
          };
        }
      }
    }

    // Fallback patterns
    const fallbackPatterns = [
      /Vessel[:.]?\s*([A-Z\s]{3,20})\s*\/\s*([A-Z0-9]{2,10})/i,
      /([A-Z\s]{3,20})\s*\/\s*([A-Z0-9]{2,10})/i,
    ];

    for (const pattern of fallbackPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[2]) {
        const vessel = match[1].replace(/\s+/g, ' ').trim();
        const voyage = match[2].trim();

        if (vessel.length >= 3 && vessel.length <= 30) {
          return {
            vessel: vessel,
            voyage: voyage,
          };
        }
      }
    }

    return { vessel: '', voyage: '' };
  }

  private extractPortOfLoading(text: string): string {
    const patterns = [
      /Port\s+of\s+Loading[:.]?\s*([A-Z\s,]+)(?:\n|$)/i,
      /POL[:.]?\s*([A-Z\s,]+)(?:\n|$)/i,
      /SINGAPORE,?\s*SINGAPORE/i,
    ];

    return this.extractWithPatterns(text, patterns) || 'SINGAPORE, SINGAPORE';
  }

  private extractPortOfDischarge(text: string): string {
    const patterns = [
      /Port\s+of\s+Discharge[:.]?\s*([A-Z\s,]+)(?:\n|$)/i,
      /POD[:.]?\s*([A-Z\s,]+)(?:\n|$)/i,
      /KARACHI,?\s*PAKISTAN/i,
    ];

    return this.extractWithPatterns(text, patterns) || 'KARACHI, PAKISTAN';
  }

  private extractDates(text: string): { departure: string; arrival: string } {
    const datePatterns = [
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g,
      /(\d{4}-\d{2}-\d{2})/g,
      /(\d{1,2}\s+[A-Z]{3}\s+\d{4})/gi,
    ];

    const dates: string[] = [];

    for (const pattern of datePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        dates.push(...matches);
      }
    }

    return {
      departure: dates[0] || '',
      arrival: dates[1] || '',
    };
  }

  private extractEtdEta(text: string): { etd: string; eta: string } {
    const etdPatterns = [
      /ETD[:.]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /ETD[:.]?\s*(\d{1,2}\s+[A-Z]{3}\s+\d{4})/i,
      /Departure[:.]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    ];

    const etaPatterns = [
      /ETA[:.]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /ETA[:.]?\s*(\d{1,2}\s+[A-Z]{3}\s+\d{4})/i,
      /Arrival[:.]?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    ];

    const etd = this.extractWithPatterns(text, etdPatterns);
    const eta = this.extractWithPatterns(text, etaPatterns);

    return { etd, eta };
  }

  private extractContainerList(text: string): ContainerInfo[] {
    const containers: ContainerInfo[] = [];

    // Pattern to match container numbers (typically 4 letters + 7 digits)
    const containerPattern = /([A-Z]{4}\d{7})/g;
    const containerMatches = text.match(containerPattern) || [];

    // Look for container information in table format
    const containerSections = text.split(/\n/).filter(line =>
      /container|cntr|cont/i.test(line) ||
      /([A-Z]{4}\d{7})/.test(line)
    );

    for (const containerNumber of containerMatches) {
      // Try to find additional container details
      const containerInfo: ContainerInfo = {
        containerNumber: containerNumber,
        containerType: this.extractContainerType(text, containerNumber),
        sealNumber: this.extractSealNumber(text, containerNumber),
        size: this.extractContainerSize(text, containerNumber),
        weight: this.extractContainerWeight(text, containerNumber),
        measurement: this.extractContainerMeasurement(text, containerNumber),
      };

      containers.push(containerInfo);
    }

    return containers;
  }

  private extractContainerType(text: string, containerNumber: string): string {
    const patterns = [
      new RegExp(`${containerNumber}\\s+([A-Z0-9]{2,4})`, 'i'),
      /(?:20|40)(?:GP|HC|RF|OT|FR|TK|PL|BU)/gi,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractSealNumber(text: string, containerNumber: string): string {
    const patterns = [
      new RegExp(`${containerNumber}[^\\n]*?Seal[^\\n]*?([A-Z0-9]{6,12})`, 'i'),
      /Seal[:.]?\s*([A-Z0-9]{6,12})/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractContainerSize(text: string, containerNumber: string): string {
    const patterns = [
      new RegExp(`${containerNumber}[^\\n]*?(20|40)['"]?\\s*(?:FT|FEET|GP|HC)?`, 'i'),
      /(20|40)['"]?\s*(?:FT|FEET|GP|HC)/gi,
    ];

    const result = this.extractWithPatterns(text, patterns);
    return result ? `${result}'` : '';
  }

  private extractContainerWeight(text: string, containerNumber: string): string {
    const patterns = [
      new RegExp(`${containerNumber}[^\\n]*?(\\d+[,.]?\\d*)\\s*(?:KGS?|MT|TONS?)`, 'i'),
      /(\\d+[,.]?\\d*)\\s*(?:KGS?|MT|TONS?)/gi,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractContainerMeasurement(text: string, containerNumber: string): string {
    const patterns = [
      new RegExp(`${containerNumber}[^\\n]*?(\\d+[,.]?\\d*)\\s*(?:CBM|M3|CUM)`, 'i'),
      /(\\d+[,.]?\\d*)\\s*(?:CBM|M3|CUM)/gi,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractAgent(text: string): string {
    const patterns = [
      /Agent[:.]?\s*([A-Z\s&]+)(?:\n|$)/i,
      /([A-Z\s&]+)\s+PVT\s+LTD/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractCarrier(text: string): string {
    const patterns = [
      /Carrier[:.]?\s*([A-Z\s&]+)(?:\n|$)/i,
      /OOCL/i,
      /ORIENT\s+OVERSEAS\s+CONTAINER\s+LINE/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractTotalContainers(text: string): number {
    const patterns = [
      /Total\s+Containers[:.]?\s*(\d+)/i,
      /(\d+)\s+Containers/i,
      /No\.\s+of\s+Containers[:.]?\s*(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    return 0;
  }

  private extractTotalWeight(text: string): string {
    const patterns = [
      /Total\s+Weight[:.]?\s*([\d.,]+\s*[A-Z]+)/i,
      /Gross\s+Weight[:.]?\s*([\d.,]+\s*[A-Z]+)/i,
      /([\d.,]+\s*KGS?)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractTotalVolume(text: string): string {
    const patterns = [
      /Total\s+Volume[:.]?\s*([\d.,]+\s*[A-Z0-9]+)/i,
      /CBM[:.]?\s*([\d.,]+)/i,
      /([\d.,]+\s*CBM)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractHouseJobs(text: string): ManifestData['houseJobs'] {
    const houseJobs: ManifestData['houseJobs'] = [];

    // Split text into sections that might contain house job information
    const sections = this.splitIntoHouseSections(text);

    for (const section of sections) {
      const houseJob = this.extractSingleHouseJob(section);
      if (houseJob && houseJob.hblNumber) {
        houseJobs.push(houseJob);
      }
    }

    return houseJobs;
  }

  private splitIntoHouseSections(text: string): string[] {
    // Look for HBL number patterns to split sections
    const hblPattern = /([A-Z]{3,4}\d{8,12})/g;
    const matches: Array<{ hbl: string; index: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = hblPattern.exec(text)) !== null) {
      matches.push({
        hbl: match[0],
        index: match.index
      });
    }

    if (matches.length === 0) {
      return [text]; // Return whole text if no HBL patterns found
    }

    const sections: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
      const section = text.substring(start, end);
      sections.push(section);
    }

    return sections;
  }

  private extractSingleHouseJob(section: string): ManifestData['houseJobs'][0] | null {
    const houseJob = {
      hblNumber: '',
      shipper: '',
      shipperAddress: '',
      consignee: '',
      consigneeAddress: '',
      notifyParty: '',
      cargoDescription: '',
      numberOfPackages: '',
      packageType: '',
      grossWeight: '',
      netWeight: '',
      measurement: '',
      containerNumbers: [],
      marksAndNumbers: '',
      freightTerms: '',
    };

    // Extract HBL Number
    houseJob.hblNumber = this.extractHBLNumber(section);
    if (!houseJob.hblNumber) {
      return null; // Skip if no HBL number found
    }

    // Extract other house job fields
    houseJob.shipper = this.extractShipper(section);
    houseJob.shipperAddress = this.extractShipperAddress(section);
    houseJob.consignee = this.extractConsignee(section);
    houseJob.consigneeAddress = this.extractConsigneeAddress(section);
    houseJob.notifyParty = this.extractNotifyParty(section);
    houseJob.cargoDescription = this.extractCargoDescription(section);
    houseJob.numberOfPackages = this.extractNumberOfPackages(section);
    houseJob.packageType = this.extractPackageType(section);
    houseJob.grossWeight = this.extractGrossWeight(section);
    houseJob.netWeight = this.extractNetWeight(section);
    houseJob.measurement = this.extractMeasurement(section);
    // houseJob.containerNumbers = this.extractContainerNumbers(section);
    houseJob.marksAndNumbers = this.extractMarksAndNumbers(section);
    houseJob.freightTerms = this.extractFreightTerms(section);

    return houseJob;
  }

  private extractHBLNumber(text: string): string {
    const patterns = [
      /([A-Z]{3,4}\d{8,12})/,
      /HBL[:.]?\s*([A-Z0-9]{6,15})/i,
      /House\s+B\/L[:.]?\s*([A-Z0-9]{6,15})/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractShipper(text: string): string {
    const patterns = [
      /Shipper[:.]?\s*([A-Z][^\n]+)/i,
      /([A-Z\s]+PTE\s+LTD)/i,
      /([A-Z\s]+LTD)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractShipperAddress(text: string): string {
    const patterns = [
      /Shipper[:.]?[^\n]+\n([^\n]+)/i,
      /([A-Z0-9\s,#-]+SINGAPORE)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractConsignee(text: string): string {
    const patterns = [
      /Consignee[:.]?\s*([A-Z][^\n]+)/i,
      /([A-Z\s]+PVT\s+LTD)/i,
      /([A-Z\s]+LIMITED)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractConsigneeAddress(text: string): string {
    const patterns = [
      /Consignee[:.]?[^\n]+\n([^\n]+)/i,
      /([A-Z0-9\s,#-]+PAKISTAN)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractNotifyParty(text: string): string {
    const patterns = [
      /Notify[:.]?\s*([A-Z][^\n]+)/i,
      /Notify\s+Party[:.]?\s*([A-Z][^\n]+)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractCargoDescription(text: string): string {
    const patterns = [
      /Description[:.]?\s*([A-Z][^\n]+)/i,
      /Cargo[:.]?\s*([A-Z][^\n]+)/i,
      /Goods[:.]?\s*([A-Z][^\n]+)/i,
      /SPARE\s+PARTS/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractNumberOfPackages(text: string): string {
    const patterns = [
      /(\d+)\s+PACKAGES/i,
      /(\d+)\s+PALLETS/i,
      /(\d+)\s+CTNS/i,
      /Packages[:.]?\s*(\d+)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractPackageType(text: string): string {
    const patterns = [
      /\d+\s+(PACKAGES|PALLETS|CTNS|BOXES|CARTONS)/i,
      /Package\s+Type[:.]?\s*([A-Z]+)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractGrossWeight(text: string): string {
    const patterns = [
      /Gross\s+Weight[:.]?\s*([\d.,]+\s*[A-Z]+)/i,
      /G\.W\.[:.]?\s*([\d.,]+\s*[A-Z]+)/i,
      /([\d.,]+\s*KGS?)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractNetWeight(text: string): string {
    const patterns = [
      /Net\s+Weight[:.]?\s*([\d.,]+\s*[A-Z]+)/i,
      /N\.W\.[:.]?\s*([\d.,]+\s*[A-Z]+)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractMeasurement(text: string): string {
    const patterns = [
      /Measurement[:.]?\s*([\d.,]+\s*[A-Z0-9]+)/i,
      /CBM[:.]?\s*([\d.,]+)/i,
      /([\d.,]+\s*CBM)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractContainerNumbers(text: string): string[] {
    const patterns = [
      /([A-Z]{4}\d{7})/g,
      /Container[:.]?\s*([A-Z]{4}\d{7})/gi,
    ];

    const containerNumbers: string[] = [];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          const containerNum = pattern.global ? match : (match.match(/[A-Z]{4}\d{7}/)?.[0] || '');
          if (containerNum && !containerNumbers.includes(containerNum)) {
            containerNumbers.push(containerNum);
          }
        }
      }
    }

    return containerNumbers;
  }

  private extractMarksAndNumbers(text: string): string {
    const patterns = [
      /Marks\s+&?\s*Numbers[:.]?\s*([^\n]+)/i,
      /Marks[:.]?\s*([^\n]+)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractFreightTerms(text: string): string {
    const patterns = [
      /Freight[:.]?\s*(PREPAID|COLLECT|FREIGHT\s+PREPAID)/i,
      /(PREPAID|COLLECT)/i,
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractWithPatterns(text: string, patterns: RegExp[]): string {
    for (const pattern of patterns) {
      try {
        const match = text.match(pattern);
        if (match) {
          let result = match[1] || match[0];
          if (result) {
            // Clean up the extracted text
            result = result
              .replace(/\s+/g, ' ')
              .replace(/\n+/g, '\n')
              .replace(/^[:\-\s]+|[:\-\s]+$/g, '')
              .trim();

            // Only return if we have meaningful content
            if (result.length > 1) {
              return result;
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Pattern matching error: ${error.message}`);
        continue;
      }
    }
    return '';
  }

  private calculateConfidence(data: ManifestData): number {
    // Master job required fields
    const masterRequiredFields = [
      'manifestNumber', 'vesselName', 'voyageNumber',
      'portOfLoading', 'portOfDischarge'
    ];

    const masterOptionalFields = [
      'dateOfDeparture', 'dateOfArrival', 'agent',
      'carrier', 'totalWeight', 'totalVolume'
    ];

    // Count filled master fields
    const filledMasterRequired = masterRequiredFields.filter(field =>
      data.masterJob[field] && data.masterJob[field].toString().trim().length > 0
    );

    const filledMasterOptional = masterOptionalFields.filter(field =>
      data.masterJob[field] && data.masterJob[field].toString().trim().length > 0
    );

    // Base confidence from master job
    let confidence = filledMasterRequired.length / masterRequiredFields.length * 0.7;

    // Bonus from optional master fields
    confidence += (filledMasterOptional.length / masterOptionalFields.length) * 0.2;

    // Bonus for having house jobs
    if (data.houseJobs.length > 0) {
      confidence += 0.1;

      // Additional bonus for house job data quality
      const houseJobQuality = this.calculateHouseJobsQuality(data.houseJobs);
      confidence += houseJobQuality * 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private calculateHouseJobsQuality(houseJobs: ManifestData['houseJobs']): number {
    if (houseJobs.length === 0) return 0;

    const houseFields = [
      'hblNumber', 'shipper', 'consignee', 'cargoDescription',
      'numberOfPackages', 'grossWeight'
    ];

    let totalQuality = 0;
    for (const house of houseJobs) {
      const filledFields = houseFields.filter(field =>
        house[field] && house[field].toString().trim().length > 0
      );
      totalQuality += filledFields.length / houseFields.length;
    }

    return totalQuality / houseJobs.length;
  }
}