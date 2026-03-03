import { Injectable, Logger } from '@nestjs/common';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';

interface DocumentSearchResult {
    id: number;
    documentNumber: string;
    documentType: string;
    displayType: string;
    path: string;
    title: string;
}

interface SearchPayload {
    search: string;
    CompanyMasterSid: number;
    BranchMasterSid: number;
    limit?: number;
}

@Injectable()
export class GlobalDocumentSearchService {
    private readonly logger = new Logger(GlobalDocumentSearchService.name);

    constructor(private readonly db: DatabaseService) {}

    async searchDocuments(payload: SearchPayload): Promise<DocumentSearchResult[]> {
        const { search, CompanyMasterSid, BranchMasterSid, limit = 10 } = payload;

        if (!search || search.length < 3) {
            return [];
        }

        if (!CompanyMasterSid || !BranchMasterSid) {
            this.logger.warn('Company or Branch ID not provided for search');
            return [];
        }

        try {
            // Execute all searches in parallel
            const [bookings, masterJobs, houseJobs, serviceJobs , enquiries, quotations, vouchers] = await Promise.all([
                this.searchBookings(search, CompanyMasterSid, BranchMasterSid),
                this.searchMasterJobs(search, CompanyMasterSid, BranchMasterSid),
                this.searchHouseJobs(search, CompanyMasterSid, BranchMasterSid),
                this.searchServiceJobs(search, CompanyMasterSid, BranchMasterSid),
                this.searchEnquiries(search, CompanyMasterSid, BranchMasterSid),
                this.searchQuotations(search, CompanyMasterSid, BranchMasterSid),
                this.searchVouchers(search, CompanyMasterSid, BranchMasterSid),
            ]);

            const results: DocumentSearchResult[] = [
                ...bookings,
                ...masterJobs,
                ...houseJobs,
                ...serviceJobs,
                ...enquiries,
                ...quotations,
                ...vouchers,
            ];

            // Sort by relevance (exact match first) and limit results
            return results
                .sort((a, b) => {
                    const aExact = a.documentNumber.toLowerCase() === search.toLowerCase();
                    const bExact = b.documentNumber.toLowerCase() === search.toLowerCase();
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;
                    return 0;
                })
                .slice(0, limit);
        } catch (error) {
            this.logger.error(`Error searching documents: ${error.message}`, error.stack);
            throw error;
        }
    }

    private async searchBookings(
        search: string,
        companyId: number,
        branchId: number,
    ): Promise<DocumentSearchResult[]> {
        try {
            const bookings = await this.db.bookingHeader.findMany({
                where: {
                    CompanyMasterSid: companyId,
                    BranchMasterSid: branchId,
                    status: statusWhereClause,
                    BookingNo: { contains: search, mode: 'insensitive' },
                },
                select: { BookingHeaderSid: true, BookingNo: true },
                take: 5,
            });

            return bookings.map((b) => ({
                id: b.BookingHeaderSid,
                documentNumber: b.BookingNo || '',
                documentType: 'BOOKING',
                displayType: 'Booking',
                path: `/operation/booking/entry/${b.BookingHeaderSid}`,
                title: `Booking: ${b.BookingNo}`,
            }));
        } catch (error) {
            this.logger.error(`Error searching bookings: ${error.message}`);
            return [];
        }
    }

    private async searchMasterJobs(
        search: string,
        companyId: number,
        branchId: number,
    ): Promise<DocumentSearchResult[]> {
        try {

            const serviceJobMenu = await this.db.menuMaster.findFirst({
                where: {
                    MenuName: 'Service Job'
                },
                select : { MenuMasterSid : true }
            });

            const masterJobs = await this.db.masterJob.findMany({
                where: {
                    CompanyMasterSid: companyId,
                    BranchMasterSid: branchId,
                    Status: statusWhereClause,
                    ...(serviceJobMenu && { MenuMasterSid: { not: serviceJobMenu.MenuMasterSid } }),
                    OR : [
                        { MasterJobNumber: { contains: search, mode: 'insensitive' }},
                        { MBLNo : {contains : search, mode: 'insensitive'}},
                    ]
                },
                select: { 
                    MasterJobSid: true, 
                    MasterJobNumber: true,
                    MBLNo : true,
                    DepartmentMasterSid : true,
                    houseJob: {
                        where: {
                            status: statusWhereClause,
                            JobType: { equals: 'Agent', mode: 'insensitive' },
                        },
                        select: {
                            HouseJobSid: true,
                        },
                        take: 1,
                    },
                },
                take: 5,
            });

            return await Promise.all(masterJobs.map(async (m) => {
                const department = await this.db.departmentMaster.findUnique({
                    where: {
                        DepartmentMasterSid: m.DepartmentMasterSid
                    },
                    select: {
                        departmentType: true
                    }
                })
                const isSeaJob = department?.departmentType.toUpperCase() === 'SEA'
                const isAgentMasterAirWaybill = !isSeaJob && (m.houseJob?.length || 0) > 0;
                const searchLower = search.toLowerCase();
                const matchesMasterJobNumber = (m.MasterJobNumber || '').toLowerCase().includes(searchLower);
                const matchesMBLNo = (m.MBLNo || '').toLowerCase().includes(searchLower);
                const documentNumber = matchesMBLNo && !matchesMasterJobNumber ? (m.MBLNo || '') : (m.MasterJobNumber || '');
                const displayType = isAgentMasterAirWaybill
                    ? 'AMAWB'
                    : (matchesMasterJobNumber ? 'Master Job' : `${isSeaJob ? 'MBL' : 'MAWB'}`);
                const title = isAgentMasterAirWaybill
                    ? `AMAWB: ${documentNumber}`
                    : (matchesMasterJobNumber ? `${isSeaJob ? 'Master Job' : 'Master Air Waybill'}: ${m.MasterJobNumber}` : `${isSeaJob ? 'MBL' : 'MAWB'} : ${m.MBLNo}`);
                const path = isAgentMasterAirWaybill
                    ? `/operation/agent-master-air-waybill/entry/${m.houseJob[0].HouseJobSid}`
                    : `/operation/${isSeaJob ? 'master-job' : 'mawbill'}/entry/${m.MasterJobSid}`;
                return {
                id: m.MasterJobSid,
                documentNumber,
                documentType: 'MASTER_JOB',
                displayType,
                path,
                title,
                }
            }));
        } catch (error) {
            this.logger.error(`Error searching master jobs: ${error.message}`);
            return [];
        }
    }

    private async searchHouseJobs(
        search: string,
        companyId: number,
        branchId: number,
    ): Promise<DocumentSearchResult[]> {
        try {
            const houseJobs = await this.db.houseJob.findMany({
                where: {
                    CompanyMasterSid: companyId,
                    BranchMasterSid: branchId,
                    status: statusWhereClause,
                    IsServiceJob : { not : 'Y'},
                    HBLNo: { contains: search, mode: 'insensitive' }
                },
                select: { HouseJobSid: true, HBLNo: true , departmentMaster : {select : {departmentType : true}}},
                take: 5,
            });

            return houseJobs.map((h) => {
                const isSeaJob = h.departmentMaster?.departmentType.toUpperCase() === 'SEA'
                return {
                id: h.HouseJobSid,
                documentNumber: h.HBLNo || '',
                documentType: 'HOUSE_JOB',
                displayType: isSeaJob ? 'HBL' : 'HAWB',
                path: `/operation/house-job/entry/${h.HouseJobSid}`,
                title: `${isSeaJob ? 'HBL' : 'HAWB'}: ${h.HBLNo}`,
                }
            });
        } catch (error) {
            this.logger.error(`Error searching house jobs: ${error.message}`);
            return [];
        }
    }

    private async searchServiceJobs(
        search: string,
        companyId: number,
        branchId: number,
    ): Promise<DocumentSearchResult[]> {
        try {
            // Search in house jobs with IsServiceJob = 'Y'
            const serviceJobs = await this.db.houseJob.findMany({
                where: {
                    CompanyMasterSid: companyId,
                    BranchMasterSid: branchId,
                    status: statusWhereClause,
                    IsServiceJob: 'Y',
                    OR: [
                        { ShipmentNo: { contains: search, mode: 'insensitive' } },
                        { HBLNo: { contains: search, mode: 'insensitive' } },
                        { masterJob: { MasterJobNumber: { contains: search, mode: 'insensitive' } } },
                    ]
                },
                select: {
                    HouseJobSid: true,
                    ShipmentNo: true,
                    HBLNo: true,
                    MasterJobSid: true,
                    departmentMaster: { select: { departmentType: true } },
                    masterJob: { select: { MasterJobNumber: true } }
                },
                take: 5,
            });

            return serviceJobs.map((sj) => {
                const isSeaJob = sj.departmentMaster?.departmentType.toUpperCase() === 'SEA';
                const searchMatchesShipmentNo = sj.ShipmentNo?.toLowerCase().includes(search.toLowerCase());
                const searchMatchesHBLNo = sj.HBLNo?.toLowerCase().includes(search.toLowerCase());
                const searchMatchesMasterJobNumber = sj.masterJob?.MasterJobNumber?.toLowerCase().includes(search.toLowerCase());

                let documentNumber: string;
                let displayType: string;
                let title: string;

                if (searchMatchesMasterJobNumber) {
                    documentNumber = sj.masterJob?.MasterJobNumber || '';
                    displayType = `Service Job`;
                    title = `Service Job ${isSeaJob ? 'MBL' : 'MAWB'}: ${documentNumber}`;
                } else if (searchMatchesShipmentNo) {
                    documentNumber = sj.ShipmentNo || '';
                    displayType = 'Service Job';
                    title = `Service Job: ${documentNumber}`;
                } else {
                    documentNumber = sj.HBLNo || '';
                    displayType = 'Service Job';
                    title = `Service Job HBL: ${documentNumber}`;
                }

                return {
                    id: sj.HouseJobSid,
                    documentNumber,
                    documentType: 'SERVICE_JOB',
                    displayType,
                    path: `/operation/service-job/entry/${sj.HouseJobSid}`,
                    title,
                };
            });
        } catch (error) {
            this.logger.error(`Error searching service jobs: ${error.message}`);
            return [];
        }
    }

    private async searchEnquiries(
        search: string,
        companyId: number,
        branchId: number,
    ): Promise<DocumentSearchResult[]> {
        try {
            const enquiries = await this.db.enquiryHeader.findMany({
                where: {
                    CompanyMasterSid: companyId,
                    BranchMasterSid: branchId,
                    status: statusWhereClause,
                    EnquiryNumber: { contains: search, mode: 'insensitive' },
                },
                select: { EnquiryHeaderSid: true, EnquiryNumber: true },
                take: 5,
            });

            return enquiries.map((e) => ({
                id: e.EnquiryHeaderSid,
                documentNumber: e.EnquiryNumber || '',
                documentType: 'ENQUIRY',
                displayType: 'Enquiry',
                path: `/crm/enquiry/entry/${e.EnquiryHeaderSid}`,
                title: `Enquiry: ${e.EnquiryNumber}`,
            }));
        } catch (error) {
            this.logger.error(`Error searching enquiries: ${error.message}`);
            return [];
        }
    }

    private async searchQuotations(
        search: string,
        companyId: number,
        branchId: number,
    ): Promise<DocumentSearchResult[]> {
        try {
            const quotations = await this.db.quoteHeader.findMany({
                where: {
                    CompanyMasterSid: companyId,
                    BranchMasterSid: branchId,
                    status: statusWhereClause,
                    QuoteNumber: { contains: search, mode: 'insensitive' },
                },
                select: { QuoteHeaderSid: true, QuoteNumber: true },
                take: 5,
            });

            return quotations.map((q) => ({
                id: q.QuoteHeaderSid,
                documentNumber: q.QuoteNumber || '',
                documentType: 'QUOTATION',
                displayType: 'Quote',
                path: `/crm/quotation/entry/${q.QuoteHeaderSid}`,
                title: `Quote: ${q.QuoteNumber}`,
            }));
        } catch (error) {
            this.logger.error(`Error searching quotations: ${error.message}`);
            return [];
        }
    }

    private async searchVouchers(
        search: string,
        companyId: number,
        branchId: number,
    ): Promise<DocumentSearchResult[]> {
        try {
            const vouchers = await this.db.voucherHeader.findMany({
                where: {
                    CompanyMasterSid: companyId,
                    BranchMasterSid: branchId,
                    Status: statusWhereClause,
                    VoucherNumber: { contains: search, mode: 'insensitive' },
                },
                include: {
                    voucherTypeMaster: {
                        select: { DocumentTypeCode: true },
                    },
                },
                take: 10,
            });

            return vouchers.map((v) => {
                const voucherType = v.voucherTypeMaster?.DocumentTypeCode || 'Voucher';

                // Determine path and display type based on document type name (case-insensitive partial match)
                let basePath: string;
                let displayType: string;
                let documentType: string;

                switch (voucherType) {
                    case 'INV' :
                        basePath = '/operation/invoice/entry';
                        displayType = 'Invoice';
                        documentType = 'INVOICE';
                        break;
                    case 'VIN' :
                        basePath = '/operation/vendor-invoice/entry';
                        displayType = 'Vendor Invoice';
                        documentType = 'VENDOR_INVOICE';
                        break;
                    case 'RPT':
                        basePath = '/accounts/receipt/entry';
                        displayType = 'Receipt';
                        documentType = 'RECEIPT';
                        break;
                    case 'PMT' :
                        basePath = '/accounts/payment/entry';
                        displayType = 'Payment';
                        documentType = 'PAYMENT';
                        break;
                    case 'CRN' :
                        basePath = '/operation/credit-note/entry';
                        displayType = 'Credit Note';
                        documentType = 'CREDIT_NOTE';
                        break;
                    case 'VRN' :
                        basePath = '/operation/vendor-credit-note/entry';
                        displayType = 'Vendor Credit Note';
                        documentType = 'VENDOR_CREDIT_NOTE';
                        break;
                    case 'JV':
                        basePath = '/accounts/journal-voucher/entry';
                        displayType = 'Journal';
                        documentType = 'JOURNAL';
                        break;
                    case 'RJV':
                        basePath = '/accounts/reversal-journal-voucher/entry';
                        displayType = 'Reversal Journal';
                        documentType = 'REVERSAL_JOURNAL';
                        break;
                    default:
                        // Default fallback
                        basePath = '/accounts/journal-voucher/entry';
                        displayType = voucherType;
                        documentType = voucherType.toUpperCase().replace(/\s+/g, '_');
                }

                return {
                    id: v.VoucherHeaderSid,
                    documentNumber: v.VoucherNumber || '',
                    documentType: documentType,
                    displayType: displayType,
                    path: `${basePath}/${v.VoucherHeaderSid}`,
                    title: `${displayType}: ${v.VoucherNumber}`,
                };
            });
        } catch (error) {
            this.logger.error(`Error searching vouchers: ${error.message}`);
            return [];
        }
    }
}
