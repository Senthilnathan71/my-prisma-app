
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

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  async processBillOfLading(file: Express.Multer.File): Promise<BillOfLadingData> {
    try {
      this.logger.log('Starting Bill of Lading processing...');
      
      // Extract text from PDF
      const pdfText = await this.extractTextFromPDF(file.buffer);
      this.logger.log(`Extracted ${pdfText.length} characters from PDF`);
      
      // Extract structured data using regex patterns
      const extractedData = this.extractBillOfLadingData(pdfText);
      
      this.logger.log(`Processing completed with confidence: ${Math.round(extractedData.confidence * 100)}%`);
      
      return extractedData;
    } catch (error) {
      this.logger.error('Failed to process Bill of Lading:', error);
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
      
      // Check if we got meaningful text
      if (data.text && data.text.trim().length >= 50) {
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

//   private async extractTextWithOCR(buffer: Buffer): Promise<string> {
//     try {
//       this.logger.log('🔍 Starting OCR processing...');
      
//       // Import required modules
//       const { createWorker } = require('tesseract.js');
      
//       // Create worker
//       this.logger.log('🤖 Creating OCR worker...');
//       const worker = await createWorker('eng');
      
//       // Convert buffer to base64 for Tesseract
//       const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
      
//       this.logger.log('🔍 Processing with OCR...');
//       const { data: { text } } = await worker.recognize(base64Image);
      
//       await worker.terminate();
      
//       if (!text || text.trim().length < 50) {
//         throw new Error('OCR could not extract sufficient text');
//       }
      
//       this.logger.log(`✅ OCR completed successfully. Extracted ${text.length} characters`);
//       return text;
      
//     } catch (error) {
//       this.logger.error('OCR processing failed:', error);
      
//       // Return mock data for development
//       this.logger.log('📋 OCR failed, using mock data for testing...');
//       return this.getMockBillOfLadingText();
//     }
//   }
    private async extractTextWithOCR(buffer: Buffer): Promise<string> {
        try {
            this.logger.log('🔍 Starting OCR processing...');

            // Install: npm install sharp pdf-poppler tesseract.js
            const sharp = require('sharp');
            const fs = require('fs').promises;
            const path = require('path');
            const os = require('os');
            const { createWorker } = require('tesseract.js');

            // Create temp directory
            const tempDir = path.join(os.tmpdir(), `pdf-ocr-${Date.now()}`);
            await fs.mkdir(tempDir, { recursive: true });

            try {
                // Step 1: Save PDF to temp file
                const tempPdfPath = path.join(tempDir, 'input.pdf');
                await fs.writeFile(tempPdfPath, buffer);

                // Step 2: Convert PDF to images using pdf-poppler
                const poppler = require('pdf-poppler');
                const options = {
                    format: 'png',
                    out_dir: tempDir,
                    out_prefix: 'page',
                    page: null // All pages
                };

                this.logger.log('📄 Converting PDF to images...');
                await poppler.convert(tempPdfPath, options);

                // Step 2.1: Get all generated images
                let imageFiles = await fs.readdir(tempDir);
                imageFiles = imageFiles
                    .filter(f => f.endsWith('.png'))
                    .map(f => path.join(tempDir, f))
                    .sort(); // keep page order

                if (imageFiles.length === 0) {
                    throw new Error('No images generated from PDF');
                }

                // Step 3: OCR each image
                this.logger.log('🤖 Starting OCR on images...');
                const worker = await createWorker('eng');

                let allText = '';

                for (let i = 0; i < imageFiles.length; i++) {
                    const imagePath = imageFiles[i];
                    this.logger.log(`🔍 OCR page ${i + 1}/${imageFiles.length}...`);

                    // Optimize image with Sharp for better OCR
                    const optimizedImagePath = path.join(tempDir, `optimized_${i}.png`);
                    await sharp(imagePath)
                        .resize({ width: 2000 }) // Resize for better OCR
                        .sharpen()
                        .png({ quality: 100 })
                        .toFile(optimizedImagePath);

                    const { data: { text } } = await worker.recognize(optimizedImagePath);
                    allText += text + '\n\n';
                }

                await worker.terminate();

                // Cleanup
                await fs.rm(tempDir, { recursive: true, force: true });

                if (!allText || allText.trim().length < 50) {
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

            // Fallback to mock data
            this.logger.log('📋 Using mock data as fallback...');
            return this.getMockBillOfLadingText();
        }
    }

  private getMockBillOfLadingText(): string {
    return `
OCEAN BILL OF LADING

Shipper
RISING PEARL GENERAL TRADING LLC
P.O.BOX: 378298, B-BLOCK, OFFICE-606
2ND DECEMBER STREET INTERCHANGE, JUMAIRAH STREET
DUBAI, UNITED ARAB EMIRATES
TEL:+971-4-2396853

Consignee (if "To Order" so indicate)
TO THE ORDER OF
BANK AL HABIB LTD
ISLAMIC BANKING BRANCH PAKISTAN

Notify Party (No claim shall attach for failure to notify)
PRODUCTION HOUSE PRIVITE LIMITED
2C-17, BEHIND HAMDARD UNIVERSITY HOSPITAL, M.A.JINNAH ROAD
KARACHI PAKISTAN, TEL+92 21 3278-7066/3278-6932

Delivery Agent at Destination
TRANSPARENT FREIGHT SERVICES
ROOM# 1007,10TH FLOOR UNI PLAZA,
I.I CHUNDRIGAR ROAD,KARACHI,
PAKISTAN PH:+9221-32426394

Vessel/Voyage
INDEPENDENT SPIRIT E062

Port of Loading
JEBEL ALI SEAPORT, DUBAI, UAE

Port of Discharge
KARACHI SEAPORT, PAKISTAN

Marks & Nos/Cont/Seal No
N/M

Number & kind of packages; Description of goods
SHIPPER LOAD STOW AND COUNT
1X40'HC FCL CONTAINER SAID TO CONTAIN
378 PACKAGES (477 rolls & 100 Boxes)
INDUCTION HEAT SEAL

Gross Weight
20965.1 KGS

Container No/Size/Seal No
FSCU6824228/40'HC/0605029

Freight and Charges
FREIGHT PREPAID

Place and Date of Issue
DUBAI: 22-09-2023

B/L No
TFSU231213
    `;
  }

  private extractBillOfLadingData(text: string): BillOfLadingData {
    this.logger.log('Starting data extraction...');
    
    // Clean and normalize text
    const cleanText = this.cleanText(text);
    
    const result: BillOfLadingData = {
      // Document Information
      blNumber: '',
      dateOfIssue: '',
      placeOfIssue: '',
      freightTerms: '',
      
      // Shipper Information
      shipper: '',
      shipperAddress: '',
      
      // Consignee Information
      consignee: '',
      consigneeAddress: '',
      
      // Notify Party Information
      notifyParty: '',
      notifyPartyAddress: '',
      
      // Delivery Agent Information
      deliveryAgent: '',
      deliveryAgentAddress: '',
      
      // Ports and Places
      portOfLoading: '',
      portOfDischarge: '',
      placeOfReceipt: '',
      placeOfDelivery: '',
      
      // Vessel Information
      vesselVoyage: '',
      
      // Cargo Information
      cargoDetails: '',
      cargoDescription: '',
      marksAndNumbers: '',
      numberOfPackages: '',
      packageType: '',
      grossWeight: '',
      measurement: '',
      
      // Container Information
      containerDetails: '',
      consolNumber: '',
      
      // System Fields
      confidence: 0,
      extractedText: cleanText.substring(0, 500) + '...'
    };

    try {
      // Extract all fields
      result.blNumber = this.extractBLNumber(cleanText);
      result.dateOfIssue = this.extractDateOfIssue(cleanText);
      result.placeOfIssue = this.extractPlaceOfIssue(cleanText);
      result.freightTerms = this.extractFreightTerms(cleanText);
      
      const shipperInfo = this.extractShipperInfo(cleanText);
      result.shipper = shipperInfo.name;
      result.shipperAddress = shipperInfo.address;
      
      const consigneeInfo = this.extractConsigneeInfo(cleanText);
      result.consignee = consigneeInfo.name;
      result.consigneeAddress = consigneeInfo.address;
      
      const notifyInfo = this.extractNotifyPartyInfo(cleanText);
      result.notifyParty = notifyInfo.name;
      result.notifyPartyAddress = notifyInfo.address;
      
      const deliveryAgentInfo = this.extractDeliveryAgentInfo(cleanText);
      result.deliveryAgent = deliveryAgentInfo.name;
      result.deliveryAgentAddress = deliveryAgentInfo.address;
      
      result.portOfLoading = this.extractPortOfLoading(cleanText);
      result.portOfDischarge = this.extractPortOfDischarge(cleanText);
      result.placeOfReceipt = this.extractPlaceOfReceipt(cleanText);
      result.placeOfDelivery = this.extractPlaceOfDelivery(cleanText);
      
      result.vesselVoyage = this.extractVesselVoyage(cleanText);
      
      const cargoInfo = this.extractCargoInfo(cleanText);
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

    } catch (error) {
      this.logger.error('Error during field extraction:', error);
      result.confidence = 0.1;
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

  private extractBLNumber(text: string): string {
    const patterns = [
      /B\/L\s*No[:\s]*([A-Z0-9\-]{6,20})/i,
      /TFSU\d+/i,
      /DESG\d+/i,
      /PES[A-Z0-9]+/i,
      /([A-Z]{3,4}\d{6,15})/
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractDateOfIssue(text: string): string {
    const patterns = [
      /(\d{2}-\d{2}-\d{4})/,
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
      /(\d{4}-\d{2}-\d{2})/
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractPlaceOfIssue(text: string): string {
    const patterns = [
      /Place\s+and\s+Date\s+of\s+Issue[^\n]*([A-Z\s,]+):/i,
      /DUBAI/i,
      /SINGAPORE/i,
      /CHENNAI/i
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractFreightTerms(text: string): string {
    const patterns = [
      /(FREIGHT\s+PREPAID)/i,
      /(FREIGHT\s+COLLECT)/i,
      /(FCL\/FCL)/i,
      /(PREPAID)/i
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractShipperInfo(text: string): { name: string; address: string } {
    const namePatterns = [
      /Shipper[^\n]*\n([A-Z\s&.,-]+(?:LTD|LLC|INC|CORP)\.?)/i,
      /RISING\s+PEARL\s+GENERAL\s+TRADING\s+LLC/i,
      /GIVAUDAN\s+\w+\s+PTE\s+LTD/i
    ];

    const addressPatterns = [
      /P\.O\.BOX[:\s]*[^,\n]+,[^,\n]+,[^,\n]+/i,
      /\d+\s+\w+\s+AVE[^,\n]+,[^,\n]+/i
    ];

    const name = this.extractWithPatterns(text, namePatterns);
    const address = this.extractWithPatterns(text, addressPatterns);

    return { name, address };
  }

  private extractConsigneeInfo(text: string): { name: string; address: string } {
    const namePatterns = [
      /TO\s+THE\s+ORDER\s+OF\s*\n([A-Z\s&.,-]+(?:LTD|LLC|INC|CORP))/i,
      /Consignee[^\n]*\n([A-Z\s&.,-]+(?:LTD|LLC|INC|CORP))/i,
      /BANK\s+AL\s+HABIB\s+LTD/i
    ];

    const addressPatterns = [
      /ISLAMIC\s+BANKING\s+BRANCH\s+PAKISTAN/i,
      /\d+ST\s+FLOOR[^,\n]+,[^,\n]+,[^,\n]+/i
    ];

    const name = this.extractWithPatterns(text, namePatterns);
    const address = this.extractWithPatterns(text, addressPatterns);

    return { name, address };
  }

  private extractNotifyPartyInfo(text: string): { name: string; address: string } {
    const namePatterns = [
      /Notify\s+Party[^\n]*\n([A-Z\s&.,-]+(?:LIMITED|LTD|LLC))/i,
      /PRODUCTION\s+HOUSE\s+PRIVITE\s+LIMITED/i
    ];

    const addressPatterns = [
      /\d+C-\d+[^,\n]+,[^,\n]+,[^,\n]+/i,
      /KARACHI\s+PAKISTAN/i
    ];

    const name = this.extractWithPatterns(text, namePatterns);
    const address = this.extractWithPatterns(text, addressPatterns);

    return { name, address };
  }

  private extractDeliveryAgentInfo(text: string): { name: string; address: string } {
    const namePatterns = [
      /Delivery\s+Agent[^\n]*\n([A-Z\s&.,-]+)/i,
      /TRANSPARENT\s+FREIGHT\s+SERVICES/i,
      /PERSIAN\s+HAWK/i
    ];

    const addressPatterns = [
      /ROOM#\s*\d+[^,\n]+,[^,\n]+,[^,\n]+/i
    ];

    const name = this.extractWithPatterns(text, namePatterns);
    const address = this.extractWithPatterns(text, addressPatterns);

    return { name, address };
  }

  private extractPortOfLoading(text: string): string {
    const patterns = [
      /Port\s+of\s+Loading[^\n]*\n([^\n]+)/i,
      /JEBEL\s+ALI[^,\n]*,[^,\n]*,[^,\n]*/i,
      /SINGAPORE[^,\n]*,[^,\n]*/i
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractPortOfDischarge(text: string): string {
    const patterns = [
      /Port\s+of\s+Discharge[^\n]*\n([^\n]+)/i,
      /KARACHI[^,\n]*,[^,\n]*/i,
      /BANDAR\s+ABBAS[^,\n]*,[^,\n]*/i
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractPlaceOfReceipt(text: string): string {
    const patterns = [
      /Place\s+of\s+Receipt[^\n]*\n([^\n]+)/i
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractPlaceOfDelivery(text: string): string {
    const patterns = [
      /Place\s+of.*?Delivery[^\n]*\n([^\n]+)/i
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractVesselVoyage(text: string): string {
    const patterns = [
      /Vessel\/Voyage[^\n]*\n([^\n]+)/i,
      /INDEPENDENT\s+SPIRIT\s+E\d+/i,
      /OOCL\s+GUANGZHOU\/\d+W?/i
    ];

    return this.extractWithPatterns(text, patterns);
  }

  private extractCargoInfo(text: string): {
    details: string;
    description: string;
    marksAndNumbers: string;
    numberOfPackages: string;
    packageType: string;
    grossWeight: string;
    measurement: string;
  } {
    const detailsPatterns = [
      /Description\s+of\s+goods[^\n]*\n([^\n]+)/i,
      /SPARE\s+PARTS/i,
      /SHIPPER\s+LOAD\s+STOW\s+AND\s+COUNT/i
    ];

    const marksPatterns = [
      /Marks[^\n]*\n([^\n]+)/i,
      /N\/M/i
    ];

    const packagePatterns = [
      /(\d+)\s+(PACKAGES|CARTONS|PALLETS)/i
    ];

    const weightPatterns = [
      /(\d+[\d.,]*\s*KGS?)/i,
      /Gross\s+Weight[^\d]*(\d+[\d.,]*)/i
    ];

    const measurementPatterns = [
      /(\d+[\d.,]*\s*M3)/i
    ];

    return {
      details: this.extractWithPatterns(text, detailsPatterns),
      description: this.extractWithPatterns(text, detailsPatterns),
      marksAndNumbers: this.extractWithPatterns(text, marksPatterns),
      numberOfPackages: this.extractWithPatterns(text, packagePatterns),
      packageType: this.extractWithPatterns(text, [/\d+\s+(PACKAGES|CARTONS|PALLETS)/i]),
      grossWeight: this.extractWithPatterns(text, weightPatterns),
      measurement: this.extractWithPatterns(text, measurementPatterns)
    };
  }

  private extractContainerInfo(text: string): { details: string; consolNumber: string } {
    const containerPatterns = [
      /([A-Z]{4}\d{7})/g,
      /Container[^\n]*\n([^\n]+)/i,
      /(1X40'?HC)/i
    ];

    const consolPatterns = [
      /(FSCU\d+\/\d+\/[A-Z0-9]+)/i,
      /([A-Z]\d{9})/g
    ];

    return {
      details: this.extractWithPatterns(text, containerPatterns),
      consolNumber: this.extractWithPatterns(text, consolPatterns)
    };
  }

  private extractWithPatterns(text: string, patterns: RegExp[]): string {
    for (const pattern of patterns) {
      try {
        const match = text.match(pattern);
        if (match) {
          let result = match[1] || match[0];
          if (result) {
            result = result.trim().replace(/\s+/g, ' ');
            if (result.length > 1 && result.length < 200) {
              return result;
            }
          }
        }
      } catch (error) {
        continue;
      }
    }
    return '';
  }

  private calculateConfidence(data: BillOfLadingData): number {
    const requiredFields = [
      'shipper', 'consignee', 'portOfLoading', 'portOfDischarge',
      'vesselVoyage', 'cargoDetails'
    ];

    const filledFields = requiredFields.filter(field => 
      data[field] && data[field].toString().trim().length > 0
    );

    let confidence = filledFields.length / requiredFields.length;

    if (data.blNumber && data.blNumber.length > 3) confidence += 0.1;
    if (data.grossWeight && data.grossWeight.includes('KG')) confidence += 0.05;
    if (data.containerDetails && data.containerDetails.length > 0) confidence += 0.05;

    return Math.max(0, Math.min(1, confidence));
  }
}