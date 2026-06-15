
// src/document/document.service.ts
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
//       // Document Information
//       blNumber: '',
//       dateOfIssue: '',
//       placeOfIssue: '',
//       freightTerms: '',
      
//       // Shipper Information
//       shipper: '',
//       shipperAddress: '',
      
//       // Consignee Information
//       consignee: '',
//       consigneeAddress: '',
      
//       // Notify Party Information
//       notifyParty: '',
//       notifyPartyAddress: '',
      
//       // Delivery Agent Information
//       deliveryAgent: '',
//       deliveryAgentAddress: '',
      
//       // Ports and Places
//       portOfLoading: '',
//       portOfDischarge: '',
//       placeOfReceipt: '',
//       placeOfDelivery: '',
      
//       // Vessel Information
//       vesselVoyage: '',
      
//       // Cargo Information
//       cargoDetails: '',
//       cargoDescription: '',
//       marksAndNumbers: '',
//       numberOfPackages: '',
//       packageType: '',
//       grossWeight: '',
//       measurement: '',
      
//       // Container Information
//       containerDetails: '',
//       consolNumber: '',
      
//       // System Fields
//       confidence: 0,
//       extractedText: cleanText.substring(0, 500) + '...'
//     };

//     try {
//       // Extract Document Information
//       result.blNumber = this.extractBLNumber(cleanText);
//       this.logger.log(`Extracted B/L Number: ${result.blNumber}`);
      
//       const dateInfo = this.extractDateAndPlaceInfo(cleanText);
//       result.dateOfIssue = dateInfo.date;
//       result.placeOfIssue = dateInfo.place;
//       this.logger.log(`Extracted Date: ${result.dateOfIssue}, Place: ${result.placeOfIssue}`);
      
//       result.freightTerms = this.extractFreightTerms(cleanText);
//       this.logger.log(`Extracted Freight Terms: ${result.freightTerms}`);

//       // Extract Shipper Information
//       const shipperInfo = this.extractShipperInfo(cleanText);
//       result.shipper = shipperInfo.name;
//       result.shipperAddress = shipperInfo.address;
//       this.logger.log(`Extracted Shipper: ${result.shipper}`);
//       this.logger.log(`Extracted Shipper Address: ${result.shipperAddress}`);

//       // Extract Consignee Information
//       const consigneeInfo = this.extractConsigneeInfo(cleanText);
//       result.consignee = consigneeInfo.name;
//       result.consigneeAddress = consigneeInfo.address;
//       this.logger.log(`Extracted Consignee: ${result.consignee}`);
//       this.logger.log(`Extracted Consignee Address: ${result.consigneeAddress}`);

//       // Extract Notify Party Information
//       const notifyInfo = this.extractNotifyPartyInfo(cleanText);
//       result.notifyParty = notifyInfo.name;
//       result.notifyPartyAddress = notifyInfo.address;
//       this.logger.log(`Extracted Notify Party: ${result.notifyParty}`);
//       this.logger.log(`Extracted Notify Party Address: ${result.notifyPartyAddress}`);

//       // Extract Delivery Agent Information
//       const deliveryAgentInfo = this.extractDeliveryAgentInfo(cleanText);
//       result.deliveryAgent = deliveryAgentInfo.name;
//       result.deliveryAgentAddress = deliveryAgentInfo.address;
//       this.logger.log(`Extracted Delivery Agent: ${result.deliveryAgent}`);

//       // Extract Ports and Places
//       result.portOfLoading = this.extractPortOfLoading(cleanText);
//       result.portOfDischarge = this.extractPortOfDischarge(cleanText);
//       result.placeOfReceipt = this.extractPlaceOfReceipt(cleanText);
//       result.placeOfDelivery = this.extractPlaceOfDelivery(cleanText);
//       this.logger.log(`Extracted Ports - Loading: ${result.portOfLoading}, Discharge: ${result.portOfDischarge}`);

//       // Extract Vessel Information
//       result.vesselVoyage = this.extractVesselVoyage(cleanText);
//       this.logger.log(`Extracted Vessel/Voyage: ${result.vesselVoyage}`);

//       // Extract Cargo Information
//       const cargoInfo = this.extractCargoInfo(cleanText);
//       result.cargoDetails = cargoInfo.details;
//       result.cargoDescription = cargoInfo.description;
//       result.marksAndNumbers = cargoInfo.marksAndNumbers;
//       result.numberOfPackages = cargoInfo.numberOfPackages;
//       result.packageType = cargoInfo.packageType;
//       result.grossWeight = cargoInfo.grossWeight;
//       result.measurement = cargoInfo.measurement;
//       this.logger.log(`Extracted Cargo - Details: ${result.cargoDetails}, Weight: ${result.grossWeight}, Measurement: ${result.measurement}`);

//       // Extract Container Information
//       const containerInfo = this.extractContainerInfo(cleanText);
//       result.containerDetails = containerInfo.details;
//       result.consolNumber = containerInfo.consolNumber;
//       this.logger.log(`Extracted Container Details: ${result.containerDetails}`);
//       this.logger.log(`Extracted Consol Number: ${result.consolNumber}`);

//       // Calculate confidence
//       result.confidence = this.calculateConfidence(result);
//       this.logger.log(`Calculated confidence: ${result.confidence}`);

//     } catch (error) {
//       this.logger.error('Error during field extraction:', error);
//       result.confidence = 0.1;
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

//   // DOCUMENT INFORMATION EXTRACTION METHODS

//   private extractBLNumber(text: string): string {
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

//   private extractDateAndPlaceInfo(text: string): { date: string; place: string } {
//     // Extract place and date of issue
//     const placeAndDateSection = text.match(/Place\s+and\s+Date\s+of\s+Issue\s*([^\n]+)/i);
    
//     if (placeAndDateSection) {
//       const content = placeAndDateSection[1].trim();
      
//       // Try to separate place and date
//       const parts = content.split(/\s+/);
//       const place = parts.slice(0, -1).join(' ');
//       const date = parts[parts.length - 1];
      
//       // Validate if last part looks like a date
//       const datePattern = /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/;
//       if (datePattern.test(date)) {
//         return { place, date };
//       } else {
//         return { place: content, date: '' };
//       }
//     }
    
//     // Fallback patterns
//     const placePatterns = [
//       /CHENNAI,\s*UNITED\s+ARAB\s+EMIRATES/i,
//       /SINGAPORE,\s*SINGAPORE/i,
//       /Place\s+of\s+Issue[:\s]*([^\n]+)/i
//     ];
    
//     const datePatterns = [
//       /(\d{4}-\d{2}-\d{2})/,
//       /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
//       /(\d{1,2}\s+(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+\d{2,4})/i
//     ];
    
//     const place = this.extractWithPatterns(text, placePatterns);
//     const date = this.extractWithPatterns(text, datePatterns);
    
//     return { place, date };
//   }

//   private extractFreightTerms(text: string): string {
//     const patterns = [
//       /(FREIGHT\s+PREPAID)/i,
//       /(FREIGHT\s+COLLECT)/i,
//       /Freight\s+&\s+Charges.*?(PREPAID|COLLECT)/i,
//       /(PREPAID)/i,
//       /(COLLECT)/i
//     ];
    
//     return this.extractWithPatterns(text, patterns);
//   }

//   // PARTIES INFORMATION EXTRACTION METHODS

//   private extractShipperInfo(text: string): { name: string; address: string } {
//     // Look for shipper section specifically
//     const shipperSection = text.match(/Shipper\s+(.*?)(?=Consignee|$)/is);
    
//     if (shipperSection) {
//       const content = shipperSection[1].trim();
//       const lines = content.split('\n').filter(line => line.trim().length > 0);
      
//       if (lines.length > 0) {
//         // First line is typically the company name
//         let name = lines[0].trim();
//         name = name.replace(/^(P\/A\s+)?/, '').trim(); // Remove P/A prefix
        
//         // Address is the remaining lines
//         const address = lines.slice(1).join(', ').trim();
        
//         return { name, address };
//       }
//     }
    
//     // Fallback patterns
//     const namePatterns = [
//       /GIVAUDAN\s+WANG\s+PTE\s+LTD\.?/i,
//       /P\/A\s+GIVAUDAN\s+SINGAPORE\s+PTE\s+LTD/i,
//       /(?:Shipper|SHIPPER)[:\s]*([A-Z][A-Z\s&.,-]+(?:PTE|LTD|INC|CORP|CO)\.?[A-Z\s]*)/i
//     ];
    
//     const addressPatterns = [
//       /1\s+WOODLANDS\s+AVE\s+8[^\n]*\n[^\n]*SINGAPORE\s+\d+/i,
//       /(?:Shipper|SHIPPER)[:\s]*[^\n]+\n([^\n]+(?:\n[^\n]+){0,2})/i
//     ];
    
//     const name = this.extractWithPatterns(text, namePatterns) || '';
//     const address = this.extractWithPatterns(text, addressPatterns) || '';
    
//     return { name: name.replace(/^P\/A\s+/, ''), address };
//   }

//   private extractConsigneeInfo(text: string): { name: string; address: string } {
//     // Look for consignee section specifically
//     const consigneeSection = text.match(/Consignee\s+or\s+Order\s+(.*?)(?=Notify Party|$)/is);
    
//     if (consigneeSection) {
//       const content = consigneeSection[1].trim();
//       const lines = content.split('\n').filter(line => line.trim().length > 0);
      
//       if (lines.length > 0) {
//         // First line is typically the company name
//         const name = lines[0].trim();
        
//         // Address is the remaining lines (excluding NTN which is tax number)
//         const addressLines = lines.slice(1).filter(line => 
//           !line.includes('NTN #') && line.trim().length > 0
//         );
//         const address = addressLines.join(', ').trim();
        
//         return { name, address };
//       }
//     }
    
//     // Fallback patterns
//     const namePatterns = [
//       /RAAZIQ\s+INTERNATIONAL\s+PVT\s+LTD/i,
//       /(?:Consignee|CONSIGNEE)[:\s]*([A-Z][A-Z\s&.,-]+(?:PTE|PVT|LTD|INC|CORP|CO)\.?[A-Z\s]*)/i
//     ];
    
//     const addressPatterns = [
//       /1ST\s+FLOOR,\s+BEAUMONT\s+PLAZA[^\n]*(?:\n[^\n]*){0,3}PAKISTAN/i,
//       /(?:Consignee|CONSIGNEE)[:\s]*[^\n]+\n([^\n]+(?:\n[^\n]+){0,3})/i
//     ];
    
//     const name = this.extractWithPatterns(text, namePatterns) || '';
//     const address = this.extractWithPatterns(text, addressPatterns) || '';
    
//     return { name, address };
//   }

//   private extractNotifyPartyInfo(text: string): { name: string; address: string } {
//     // Look for notify party section
//     const notifySection = text.match(/Notify\s+Party\s+(.*?)(?=Vessel|Port|$)/is);
    
//     if (notifySection) {
//       const content = notifySection[1].trim();
//       const lines = content.split('\n').filter(line => line.trim().length > 0);
      
//       if (lines.length > 0) {
//         const name = lines[0].trim();
//         const address = lines.slice(1).join(', ').trim();
//         return { name, address };
//       }
//     }
    
//     // Fallback patterns
//     const namePatterns = [
//       /Notify\s+Party[:\s]*([A-Z][A-Z\s&.,-]+(?:PTE|PVT|LTD|INC|CORP|CO)\.?[A-Z\s]*)/i,
//       /NOTIFY[:\s]*([^\n]+)/i
//     ];
    
//     const addressPatterns = [
//       /Notify\s+Party[:\s]*[^\n]+\n([^\n]+(?:\n[^\n]+){0,2})/i
//     ];
    
//     const name = this.extractWithPatterns(text, namePatterns) || '';
//     const address = this.extractWithPatterns(text, addressPatterns) || '';
    
//     return { name, address };
//   }

//   private extractDeliveryAgentInfo(text: string): { name: string; address: string } {
//     const patterns = [
//       /(?:For delivery of goods, please apply to|Delivery Agent|DELIVERY AGENT)[:\s]*([^\n]+)/i,
//       /(?:Signed on behalf of the Carrier by|Agent|AGENT)[:\s]*([^\n]+)/i,
//       /DEMO\s+COMPANY\s+PTE\s+LTD/i,
//       /AS\s+AGENT\s+FOR\s+CARRIER\s+([^\n]*)/i
//     ];
    
//     const agentName = this.extractWithPatterns(text, patterns);
    
//     // Try to find address for the delivery agent
//     const addressPatterns = [
//       /DEMO\s+COMPANY\s+PTE\s+LTD[^\n]*\n([^\n]+)/i,
//       /Agent[:\s]*[^\n]+\n([^\n]+)/i
//     ];
    
//     const agentAddress = this.extractWithPatterns(text, addressPatterns);
    
//     return { 
//       name: agentName || '', 
//       address: agentAddress || '' 
//     };
//   }

//   // PORTS AND PLACES EXTRACTION METHODS

//   private extractPortOfLoading(text: string): string {
//     const patterns = [
//       // Specific patterns from your document
//       /Port\s+of\s+Loading\s*\n([^\n]+)/i,
//       /SINGAPORE,\s*SINGAPORE(?:\s+CFS)?/i,
      
//       // Generic patterns
//       /(?:PORT OF LOADING|POL|Place of Receipt)\s*:?\s*([^\n]+)/i,
//       /(?:Loading|LOADING)\s*:?\s*([A-Z][^\n,]+)/i
//     ];

//     return this.extractWithPatterns(text, patterns) || 'SINGAPORE, SINGAPORE';
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

//     return this.extractWithPatterns(text, patterns) || 'KARACHI, PAKISTAN';
//   }

//   private extractPlaceOfReceipt(text: string): string {
//     const patterns = [
//       /Place\s+of\s+Receipt\s*([^\n]+)/i,
//       /SINGAPORE,\s*SINGAPORE\s+CFS/i,
//       /(?:RECEIPT|Receipt)\s*:?\s*([^\n]+)/i
//     ];
    
//     return this.extractWithPatterns(text, patterns);
//   }

//   private extractPlaceOfDelivery(text: string): string {
//     const patterns = [
//       /Place\s+of\s+Delivery\s*([^\n]+)/i,
//       /KARACHI,\s*PAKISTAN\s+CFS/i,
//       /(?:DELIVERY|Delivery)\s*:?\s*([^\n]+)/i
//     ];
    
//     return this.extractWithPatterns(text, patterns);
//   }

//   // VESSEL INFORMATION EXTRACTION METHODS

//   private extractVesselVoyage(text: string): string {
//     const patterns = [
//       // Specific pattern from your document
//       /OOCL\s+GUANGZHOU\/\d+W?/i,
      
//       // Generic vessel patterns
//       /Vessel\s*\n([^\n]+)/i,
//       /(?:Vessel|VESSEL)\s*:?\s*([^\n]+)/i,
//       /(?:OOCL|MSC|COSCO|EVERGREEN|CMA|MAERSK|HAPAG)\s+[^\n]+/i,
      
//       // Vessel/Voyage combined
//       /([A-Z\s]+\/\d+[A-Z]?)/i
//     ];

//     return this.extractWithPatterns(text, patterns);
//   }

//   // CARGO INFORMATION EXTRACTION METHODS

//   private extractCargoInfo(text: string): {
//     details: string;
//     description: string;
//     marksAndNumbers: string;
//     numberOfPackages: string;
//     packageType: string;
//     grossWeight: string;
//     measurement: string;
//   } {
//     // Extract cargo details/description
//     const detailsPatterns = [
//       /Description\s+of\s+Goods\s*([^\n]+)/i,
//       /SPARE\s+PARTS/i,
//       /(?:DESCRIPTION OF GOODS|Description of Goods|CARGO|Cargo)\s*:?\s*([^\n]+)/i
//     ];
//     const details = this.extractWithPatterns(text, detailsPatterns);

//     // Extract detailed cargo description
//     const descriptionPatterns = [
//       /(\d+\s+PALLETS\s+SPARE\s+PARTS)/i,
//       /(11\s+PALLETS.*?SPARE\s+PARTS)/i,
//       /Description\s+of\s+Goods[^\n]*\n([^\n]+(?:\n[^\n]+){0,2})/i
//     ];
//     const description = this.extractWithPatterns(text, descriptionPatterns);

//     // Extract marks and numbers
//     const marksPatterns = [
//       /Marks\s+and\s+Numbers\s*([^\n]+(?:\n[^\n]+){0,2})/i,
//       /(?:MARKS|Marks)[:\s]*([^\n]+)/i,
//       /(?:Number and Type|Marks and Numbers)\s*([^\n]+)/i
//     ];
//     const marksAndNumbers = this.extractWithPatterns(text, marksPatterns);

//     // Extract number of packages
//     const packageNumberPatterns = [
//       /(\d+)\s+PALLETS/i,
//       /(ELEVEN)\s+PALLETS/i,
//       /Total\s+(\d+)/i,
//       /(\d+)\s+(?:PACKAGES|PALLETS|BOXES|CARTONS)/i
//     ];
//     const numberOfPackages = this.extractWithPatterns(text, packageNumberPatterns);

//     // Extract package type
//     const packageTypePatterns = [
//       /\d+\s+(PALLETS)/i,
//       /(PALLETS|BOXES|CARTONS|PACKAGES)/i,
//       /Total number of Containers or Packages.*?([A-Z]+\s+[A-Z]+)/i
//     ];
//     const packageType = this.extractWithPatterns(text, packageTypePatterns);

//     // Extract gross weight
//     const weightPatterns = [
//       /(\d+\.\d+\s+KG(?:\(s\))?)/i,
//       /(7237\.000\s+KG\(s\))/i,
//       /Gross\s+Weight[^\d]*(\d+[\d.,]*\s*(?:KG|MT|TON))/i,
//       /(\d+[\d.,]*\s*KG)/i
//     ];
//     const grossWeight = this.extractWithPatterns(text, weightPatterns);

//     // Extract measurement
//     const measurementPatterns = [
//       /(\d+\.\d+\s+M3)/i,
//       /(15\.125\s+M3)/i,
//       /Measurement[^\d]*(\d+[\d.,]*\s*M3)/i,
//       /(\d+[\d.,]*\s*M3)/i
//     ];
//     const measurement = this.extractWithPatterns(text, measurementPatterns);

//     return {
//       details,
//       description,
//       marksAndNumbers,
//       numberOfPackages,
//       packageType,
//       grossWeight,
//       measurement
//     };
//   }

//   // CONTAINER INFORMATION EXTRACTION METHODS

//   private extractContainerInfo(text: string): { details: string; consolNumber: string } {
//     // Extract consol number specifically
//     const consolPatterns = [
//       /Consol\s+No:\s*([A-Z0-9]+)/i,
//       /(C\d{9})/g,
//       /Consolidation\s+No[:\s]*([A-Z0-9]+)/i
//     ];
//     const consolNumber = this.extractWithPatterns(text, consolPatterns);

//     // Extract container details
//     const containerPatterns: RegExp[] = [
//       // Standard container numbers
//       /([A-Z]{4}\d{7})/g,
      
//       // Container information from your document
//       /Total\s+(\d+)/i,
//       /(\d+\s+PALLETS)/i,
//       /(ELEVEN\s+PALLETS)/i,
      
//       // Container types
//       /(?:20|40|45)(?:\s*FT|'|GP|HC|HQ|DV|RF|OT|FR)/gi,
      
//       // General container patterns
//       /(?:Container|CONTAINER)\s*:?\s*([^\n]+)/i
//     ];

//     const results: string[] = [];
    
//     for (const pattern of containerPatterns) {
//       const matches = text.match(pattern);
//       if (matches) {
//         if (pattern.global) {
//           results.push(...matches.filter(match => typeof match === 'string'));
//         } else if (matches[1]) {
//           results.push(matches[1]);
//         } else if (matches[0]) {
//           results.push(matches[0]);
//         }
//       }
//     }

//     // Remove duplicates and clean up
//     const uniqueResults = [...new Set(results)]
//       .filter((result: string) => result && result.trim().length > 0)
//       .map((result: string) => result.trim());

//     return {
//       details: uniqueResults.join(', '),
//       consolNumber
//     };
//   }

//   // HELPER METHODS

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
//       'shipperAddress', 'consigneeAddress', 'notifyParty', 'containerDetails',
//       'grossWeight', 'measurement', 'numberOfPackages', 'marksAndNumbers'
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

// src/document/document.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';

export interface BillOfLadingData {
  blNumber?: string;
  dateOfIssue?: string;
  placeOfIssue?: string;
  freightTerms?: string;
  shipper: string;
  shipperAddress: string;
  consignee: string;
  consigneeAddress: string;
  notifyParty: string;
  notifyPartyAddress: string;
  deliveryAgent: string;
  deliveryAgentAddress: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfReceipt: string;
  placeOfDelivery: string;
  vesselVoyage: string;
  cargoDetails: string;
  cargoDescription: string;
  marksAndNumbers: string;
  numberOfPackages: string;
  packageType: string;
  grossWeight: string;
  measurement: string;
  containerDetails: string;
  consolNumber: string;
  confidence: number;
  extractedText?: string;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  async processBillOfLading(file: Express.Multer.File): Promise<BillOfLadingData> {
    try {
      this.logger.log('Starting Bill of Lading processing...');
      const pdfText = await this.extractTextFromPDF(file.buffer);
      const extractedData = this.extractBillOfLadingData(pdfText);
      this.logger.log(`Processing completed with confidence: ${Math.round(extractedData.confidence * 100)}%`);
      return extractedData;
    } catch (error) {
      this.logger.error('Failed to process Bill of Lading:', error);
      throw new Error(`Failed to process document: ${error.message}`);
    }
  }

  private async extractTextFromPDF(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    const text = data.text || '';
    if (text.trim().length < 50) {
      throw new Error('PDF has insufficient text content');
    }
    return text;
  }

  private extractBillOfLadingData(text: string): BillOfLadingData {
    const cleanText = this.cleanText(text);
    const lines = this.getLines(cleanText);

    const result: BillOfLadingData = {
      blNumber: this.extractBLNumber(lines, cleanText),
      dateOfIssue: this.extractDateOfIssue(lines, cleanText),
      placeOfIssue: this.extractPlaceOfIssue(lines, cleanText),
      freightTerms: this.extractFreightTerms(cleanText),
      shipper: '',
      shipperAddress: '',
      consignee: '',
      consigneeAddress: '',
      notifyParty: '',
      notifyPartyAddress: '',
      deliveryAgent: '',
      deliveryAgentAddress: '',
      portOfLoading: this.extractPortOfLoading(lines),
      portOfDischarge: this.extractPortOfDischarge(lines),
      placeOfReceipt: '',
      placeOfDelivery: '',
      vesselVoyage: this.extractVesselVoyage(lines, cleanText),
      cargoDetails: '',
      cargoDescription: '',
      marksAndNumbers: '',
      numberOfPackages: '',
      packageType: '',
      grossWeight: '',
      measurement: '',
      containerDetails: '',
      consolNumber: '',
      confidence: 0,
      extractedText: cleanText.substring(0, 500) + '...'
    };

    const shipperInfo = this.extractShipperInfo(lines);
    result.shipper = shipperInfo.name;
    result.shipperAddress = shipperInfo.address;

    const consigneeInfo = this.extractConsigneeInfo(lines);
    result.consignee = consigneeInfo.name;
    result.consigneeAddress = consigneeInfo.address;

    const notifyInfo = this.extractNotifyPartyInfo(lines);
    result.notifyParty = notifyInfo.name;
    result.notifyPartyAddress = notifyInfo.address;

    const deliveryAgentInfo = this.extractDeliveryAgentInfo(lines);
    result.deliveryAgent = deliveryAgentInfo.name;
    result.deliveryAgentAddress = deliveryAgentInfo.address;

    result.placeOfReceipt = result.portOfLoading;
    result.placeOfDelivery = result.portOfDischarge;

    const cargoInfo = this.extractCargoInfo(lines);
    result.cargoDetails = cargoInfo.details;
    result.cargoDescription = cargoInfo.description;
    result.marksAndNumbers = cargoInfo.marksAndNumbers;
    result.numberOfPackages = cargoInfo.numberOfPackages;
    result.packageType = cargoInfo.packageType;
    result.grossWeight = cargoInfo.grossWeight;
    result.measurement = cargoInfo.measurement;

    const containerInfo = this.extractContainerInfo(cleanText);
    result.containerDetails = containerInfo.details;
    result.consolNumber = containerInfo.consolNumber;

    result.confidence = this.calculateConfidence(result);
    return result;
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ \f\v]+/g, ' ')
      .replace(/ *\n+ */g, '\n')
      .trim();
  }

  private getLines(text: string): string[] {
    return text.split(/\n/).map(line => line.trim()).filter(Boolean);
  }

  private extractBLNumber(lines: string[], text: string): string {
    const labelIndex = lines.findIndex(line => /^(MTD No\.?|BL\/MTD Number|B\/L No)$/i.test(line));
    if (labelIndex >= 0) {
      const value = this.extractNextValue(lines, labelIndex, 6);
      if (/^[A-Z]{2,}\d{4,}/i.test(value)) return value;
    }
    return this.extractWithPatterns(text, [/\b(GLS[A-Z0-9]{6,20})\b/i, /\b(BLE\d{5,20})\b/i, /\b([A-Z]{3,5}\d{6,15})\b/]);
  }

  private extractDateOfIssue(lines: string[], text: string): string {
    const datePattern = /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/;
    const labelIndex = lines.findIndex(line => /Place and Date of Issue/i.test(line));
    if (labelIndex >= 0) {
      for (let index = Math.max(0, labelIndex - 1); index <= Math.min(lines.length - 1, labelIndex + 5); index++) {
        const match = lines[index].match(datePattern);
        if (match) return this.normalizeDate(match[0]);
      }
    }
    return '';
  }

  private normalizeDate(value: string): string {
    const match = String(value || '').match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
    if (!match) return value || '';
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}-${year}`;
  }

  private extractPlaceOfIssue(lines: string[], text: string): string {
    const labelIndex = lines.findIndex(line => /Place and Date of Issue/i.test(line));
    const cityPattern = /\b(MUMBAI|DUBAI|CHENNAI|SINGAPORE)\b/i;
    if (labelIndex >= 0) {
      for (let index = Math.max(0, labelIndex - 3); index <= Math.min(lines.length - 1, labelIndex + 5); index++) {
        const match = lines[index].match(cityPattern);
        if (match) return match[1].toUpperCase();
      }
    }
    return '';
  }

  private extractFreightTerms(text: string): string {
    return this.extractWithPatterns(text, [/(FREIGHT\s+PREPAID(?:\s+AS\s+ARRANGED)?)/i, /(FREIGHT\s+COLLECT)/i, /(PREPAID)/i, /(COLLECT)/i]).toUpperCase();
  }

  private extractShipperInfo(lines: string[]): { name: string; address: string } {
    if (/^Consignor$/i.test(lines[0] || '') && /^Consignee$/i.test(lines[1] || '')) return this.splitPartyBlock(lines, 3, 0);
    const labelIndex = lines.findIndex(line => /Consignor\s*\/\s*Shipper|^Shipper$/i.test(line));
    const values = labelIndex >= 0 ? this.extractLinesBetween(lines, labelIndex, [/^Consignee/i], 8) : [];
    return { name: values[0] || '', address: values.slice(1).join(', ') };
  }

  private extractConsigneeInfo(lines: string[]): { name: string; address: string } {
    if (/^Consignor$/i.test(lines[0] || '') && /^Consignee$/i.test(lines[1] || '')) return this.splitPartyBlock(lines, 3, 1);
    const labelIndex = lines.findIndex(line => /^Consignee/i.test(line));
    const values = labelIndex >= 0 ? this.extractLinesBetween(lines, labelIndex, [/^Notify/i], 8) : [];
    return { name: values[0] || '', address: values.slice(1).join(', ') };
  }

  private extractNotifyPartyInfo(lines: string[]): { name: string; address: string } {
    if (/^Consignor$/i.test(lines[0] || '') && /^Consignee$/i.test(lines[1] || '')) return this.splitPartyBlock(lines, 3, 2);
    const labelIndex = lines.findIndex(line => /^Notify/i.test(line));
    const values = labelIndex >= 0 ? this.extractLinesBetween(lines, labelIndex, [/Place Of Acceptance|Port Of Discharge|MTD No/i], 6) : [];
    return { name: values[0] || '', address: values.slice(1).join(', ') };
  }

  private splitPartyBlock(lines: string[], valueStartIndex: number, partyOffset: number): { name: string; address: string } {
    const endIndex = lines.findIndex((line, index) => index > valueStartIndex && /Port of Discharge|BL\/MTD Number|Date of Acceptance|Vessel Voy No\.|Number of packages/i.test(line));
    const rows = lines.slice(valueStartIndex, endIndex > valueStartIndex ? endIndex : valueStartIndex + 18);
    const blocks = [rows.slice(0, 4), rows.slice(4, 8), rows.slice(8, 11)];
    const block = blocks[partyOffset] || [];
    return { name: block[0] || '', address: block.slice(1).join(', ') };
  }

  private extractDeliveryAgentInfo(lines: string[]): { name: string; address: string } {
    const labelIndex = lines.findIndex(line => /Delivery Agent/i.test(line));
    const values = labelIndex >= 0 ? this.extractLinesBetween(lines, labelIndex, [/Freight Payable|Other particulars/i], 5) : [];
    return { name: values[0] || '', address: values.slice(1).join(', ') };
  }

  private extractPortOfLoading(lines: string[]): string {
    const index = lines.findIndex(line => /Port\s+of\s+Loading|Date of AcceptancePort of Loading/i.test(line));
    return index >= 0 ? this.extractPortNear(lines, index) : '';
  }

  private extractPortOfDischarge(lines: string[]): string {
    const index = lines.findIndex(line => /Port\s+of\s+Discharge/i.test(line));
    return index >= 0 ? this.extractPortNear(lines, index) : '';
  }

  private extractPortNear(lines: string[], startIndex: number): string {
    for (let offset = 1; offset <= 20 && startIndex + offset < lines.length; offset++) {
      const candidate = this.normalizePortValue(lines[startIndex + offset]);
      if (candidate) return candidate;
    }
    return '';
  }

  private normalizePortValue(value: string): string {
    let cleaned = this.cleanDuplicatedValue(value);
    if (!cleaned || /^(PLACE|PORT|DATE|VESSEL|MODE|ROUTE|TAKEN|MENTAINED|MAINTAINED|MTD|ONE OF|BEING|MULTIMODAL|BILL OF LADING|TO OBTAIN|FOR SUCH|AT WHICH|PROVISIONS|DESIGNATED|IN WITNESS|ORIGINAL|INDICATED|BL\/MTD|SHIPMENT REFERENCE|WEB\s*:|\(|NO\.?$)/i.test(cleaned)) return '';
    if (cleaned.split(/\s+/).length > 8 || /^[A-Z]{2,5}\d{4,}/i.test(cleaned)) return '';
    const portName = cleaned.match(/\b(NHAVA(?:\s+SHEVA)?|JEBEL(?:\s+ALI)?|MUMBAI|DUBAI|CHENNAI|SINGAPORE)\b/i)?.[0];
    if (portName) return portName.toUpperCase();
    const unLocationCode = cleaned.match(/\b[A-Z]{2}[A-Z0-9]{3}\b/);
    return unLocationCode?.[0] || '';
  }

  private extractVesselVoyage(lines: string[], text: string): string {
    const labelIndex = lines.findIndex(line => /Vessel.*Voy/i.test(line));
    if (labelIndex >= 0) {
      const value = this.extractNextValue(lines, labelIndex, 4);
      if (value) return value;
    }
    return this.extractWithPatterns(text, [/\b(X-PRESS\s+[A-Z]+\s+\d+[A-Z])\b/i, /\b(NORTHERN\s+PRACTISE\/\d+)\b/i, /\b([A-Z][A-Z\s-]+\/\d+[A-Z]?)\b/i]);
  }

  private extractCargoInfo(lines: string[]): Pick<BillOfLadingData, 'cargoDetails' | 'cargoDescription' | 'marksAndNumbers' | 'numberOfPackages' | 'packageType' | 'grossWeight' | 'measurement'> & { details: string; description: string } {
    const packageLine = lines.find(line => /\b\d+\s+(CARTONS?|PACKAGES?|PALLETS?)\b/i.test(line)) || '';
    const packageMatch = packageLine.match(/\b(\d+)\s+(CARTONS?|PACKAGES?|PALLETS?)\b/i);
    const cargoLine = lines.find(line => /TEXTILE PIECE GOODS|READYMADE GARMENTS|SPARE PARTS/i.test(line)) || '';
    const measurement = lines.find(line => /\b\d+(?:\.\d+)?\s*(?:CBM|M3)\b/i.test(line)) || '';
    const grossWeight = this.extractGrossWeight(lines);
    const marksIndex = lines.findIndex(line => /^MARKS/i.test(line));
    const marksAndNumbers = marksIndex >= 0 ? this.extractNextValue(lines, marksIndex, 4) : '';
    return {
      details: cargoLine,
      description: cargoLine,
      cargoDetails: cargoLine,
      cargoDescription: cargoLine,
      marksAndNumbers,
      numberOfPackages: packageMatch?.[1] || '',
      packageType: packageMatch?.[2]?.toUpperCase() || '',
      grossWeight,
      measurement: measurement.replace(/\s+/g, ' ')
    };
  }

  private extractGrossWeight(lines: string[]): string {
    const sameLine = lines.find(line => /GR\.WT\s*:\s*\d/i.test(line));
    if (sameLine) return `${sameLine.match(/\d[\d,.]*/)?.[0] || ''} KGS`.trim();
    const numberIndex = lines.findIndex((line, index) => /^\d[\d,.]*$/.test(line) && /KGS?/i.test(lines[index + 1] || ''));
    return numberIndex >= 0 ? `${lines[numberIndex]} KGS` : '';
  }

  private extractContainerInfo(text: string): { details: string; consolNumber: string } {
    return {
      details: text.match(/\b[A-Z]{4}\d{7}\b/)?.[0] || '',
      consolNumber: text.match(/(?:C\.SEAL|C\.S\.No|SEAL)[:\s]*([A-Z0-9-]+)/i)?.[1] || ''
    };
  }

  private cleanDuplicatedValue(value: string): string {
    let cleaned = String(value || '').replace(/\s{2,}/g, ' ').trim();
    cleaned = cleaned
      .replace(/(.+?\b(?:INDIA|U\.?A\.?E\.?|UAE|PAKISTAN|SINGAPORE|SRI LANKA))\s*\1$/i, '$1')
      .replace(/(.+?\b(?:INDIA|U\.?A\.?E\.?|UAE|PAKISTAN|SINGAPORE|SRI LANKA))\1/i, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return this.getRepeatedHalf(cleaned) || cleaned;
  }

  private getRepeatedHalf(value: string): string {
    const compact = value.replace(/\s+/g, '').replace(/[.,]/g, '').toUpperCase();
    if (compact.length % 2 !== 0) return '';
    const halfLength = compact.length / 2;
    if (compact.slice(0, halfLength) !== compact.slice(halfLength)) return '';
    let prefixCompact = '';
    let prefix = '';
    for (const char of value) {
      prefix += char;
      if (!/[\s.,]/.test(char)) prefixCompact += char.toUpperCase();
      if (prefixCompact === compact.slice(0, halfLength)) return prefix.replace(/[\s,.-]+$/, '').trim();
    }
    return '';
  }

  private extractNextValue(lines: string[], startIndex: number, maxOffset = 12): string {
    for (let offset = 1; offset <= maxOffset && startIndex + offset < lines.length; offset++) {
      const candidate = this.cleanDuplicatedValue(lines[startIndex + offset]);
      if (!candidate || this.isSectionLabel(candidate)) continue;
      if (/^(Taken|mentained|maintained|provisions|multimodal transport|One of|the original|being|for such transport|Web\s*:|\(no responsibility)/i.test(candidate)) continue;
      return candidate;
    }
    return '';
  }

  private extractLinesBetween(lines: string[], startIndex: number, stopPatterns: RegExp[], maxLines = 8): string[] {
    const values: string[] = [];
    for (let index = startIndex + 1; index < lines.length && values.length < maxLines; index++) {
      const line = this.cleanDuplicatedValue(lines[index]);
      if (!line || stopPatterns.some(pattern => pattern.test(line))) break;
      if (this.isSectionLabel(line)) continue;
      values.push(line);
    }
    return values;
  }

  private isSectionLabel(line: string): boolean {
    return /^(Consignor|Consignee|Notify|Place|Port|MTD|BL\/MTD|Shipment Reference|Taken in charge|Vessel|Container|Gross Weight|Delivery Agent|Freight|Number of Original|Other Particulars|Weight and Measurement|Authorised|Particulars above|Date of Acceptance|Modes|Route|To Obtain|MULTIMODAL|BILL OF LADING)$/i.test(line.trim());
  }

  private extractWithPatterns(text: string, patterns: RegExp[]): string {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1] || match?.[0]) return (match[1] || match[0]).trim().replace(/\s+/g, ' ');
    }
    return '';
  }

  private calculateConfidence(data: BillOfLadingData): number {
    const requiredFields = ['blNumber', 'shipper', 'consignee', 'portOfLoading', 'portOfDischarge', 'vesselVoyage', 'cargoDetails', 'containerDetails'];
    const filledFields = requiredFields.filter(field => data[field] && data[field].toString().trim().length > 0);
    return Math.max(0, Math.min(1, filledFields.length / requiredFields.length));
  }
}

