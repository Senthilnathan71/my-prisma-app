import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { VoucherService } from '../voucher/voucher.service';
import { SearchPostedVouchersDto, CreateStandaloneVoucherMatchingDto } from 'src/accounts/dto/voucher-matching.dto';

@Injectable()
export class VoucherMatchingService {
    constructor(
        private _db: DatabaseService,
        private logger: Logger,
        private voucherService: VoucherService,
    ) { }

    async searchVoucherMatching(params: filterDto) {
        const {search='', page=1, pageSize=10,activeCompanyId} = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoucherMatchingHeaderWhereInput = {
            Status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR:[
                        { VoucherMatchingNo: { contains: search, mode: 'insensitive'}},
                        { SubledgerName: { contains:search, mode:'insensitive'}},
                        { Status: { contains: search,  mode: 'insensitive'}}
                    ],
                }
                : {}
            ),
        };
        const [items, totalCount] = await this._db.$transaction([
            this._db.voucherMatchingHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VoucherMatchingHeaderSid : 'desc'},
            }),
            this._db.voucherMatchingHeader.count({ where }),
        ]);

        return {
            items,
            totalCount,
        };
    }

    async getVoucherMatchingById(VoucherMatchingHeaderSid:number) {
        try {
            const voucherMatching = await this._db.voucherMatchingHeader.findUnique({
                where: {
                    VoucherMatchingHeaderSid: VoucherMatchingHeaderSid,
                    Status: 'A'
                } as any,
                include:{
                    voucherMatchings : {
                        include: {
                            CoaMaster :{
                                select: {
                                    LedgerName: true,
                                }
                            },
                            subledgerMaster: {
                                select: {
                                    SubledgerName : true,
                                }
                            },
                            branch: {
                                select: {
                                    branchName : true,
                                }
                            },
                            VoucherHeader: {
                                select : {
                                    VoucherNumber: true,
                                    voucherTypeMaster : {
                                        select: {
                                            DocumentTypeName: true,
                                        }
                                    },
                                    VoucherDate: true,
                                    PostDate: true
                                }
                            }
                        }
                    },
                }
            });
            if (!voucherMatching) {
                throw new BadRequestException('Voucher Matching not Found');
            }
            return voucherMatching;
        } catch (error) {
            this.logger.error('find VoucherMatchiing', error);
            throw new InternalServerErrorException("Something went wrong");
        }
    }

    async searchPostedVouchers(params: SearchPostedVouchersDto) {
        const { CompanyMasterSid, BranchMasterSid, VoucherType, search = '', page = 1, pageSize = 20 } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.VoucherHeaderWhereInput = {
            Status: 'A',
            PostStatus: 'P',
            CompanyMasterSid,
            BranchMasterSid,
            voucherTypeMaster: {
                DocumentTypeName: VoucherType,
            },
            ...(search
                ? {
                    OR: [
                        { VoucherNumber: { contains: search, mode: 'insensitive' } },
                        { PartyName: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}
            ),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.voucherHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { VoucherHeaderSid: 'desc' },
                select: {
                    VoucherHeaderSid: true,
                    VoucherNumber: true,
                    VoucherDate: true,
                    PostDate: true,
                    PartyName: true,
                    CurrencyCode: true,
                    ExchangeRate: true,
                    VoucherTypeMasterSid: true,
                    voucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                        },
                    },
                },
            }),
            this._db.voucherHeader.count({ where }),
        ]);

        return { items, totalCount };
    }

    async getPostedVoucherWithDetails(voucherHeaderSid: number) {
        try {
            const voucher = await this._db.voucherHeader.findUnique({
                where: {
                    VoucherHeaderSid: voucherHeaderSid,
                    Status: 'A',
                    PostStatus: 'P',
                } as any,
                include: {
                    VoucherDetail : {
                        where: { Status: 'A' },
                        include: {
                            coaMaster: {
                                select: {
                                    LedgerName: true,
                                    COAMasterSid: true,
                                },
                            },
                            subledgerMaster: {
                                select: {
                                    SubledgerName: true,
                                    SubledgerMasterSid: true,
                                },
                            },
                            voucherTransaction: {
                                where: { Status: 'A' },
                                select: {
                                    VoucherTransactionSid: true,
                                    COAMasterSid: true,
                                    LedgerMasterSid: true,
                                    CurrencyCode: true,
                                    ExchangeRate: true,
                                    DrCr: true,
                                    Amount : true,
                                    LocalAmount: true,
                                },
                            },
                        },
                    },
                    voucherTypeMaster: {
                        select: {
                            DocumentTypeName: true,
                            VoucherTypeMasterSid: true,
                        },
                    },
                },
            });

            if (!voucher) {
                throw new BadRequestException('Posted voucher not found');
            }

            return voucher;
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            this.logger.error('getPostedVoucherWithDetails', error);
            throw new InternalServerErrorException('Something went wrong');
        }
    }

    async createStandaloneVoucherMatching(dto: CreateStandaloneVoucherMatchingDto) {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                // Lookup YearMasterSid for the posting date
                const postDate = new Date(dto.PostDate);
                const yearMaster = await prisma.yearMaster.findFirst({
                    where: {
                        CompanyMasterSid: dto.CompanyMasterSid,
                        status: 'A',
                        yearStartDate: { lte: postDate },
                        yearEndDate: { gte: postDate },
                    },
                });
                if (!yearMaster) {
                    throw new BadRequestException('Active financial year not found for the posting date.');
                }

                const payload = {
                    CompanyMasterSid: dto.CompanyMasterSid,
                    BranchMasterSid: dto.BranchMasterSid,
                    VoucherHeaderSid: dto.VoucherHeaderSid,
                    VoucherTypeMasterSid: dto.VoucherTypeMasterSid,
                    voucherTypeInName: dto.voucherTypeInName,
                    SubledgerName: dto.SubledgerName || '',
                    PostDate: postDate,
                    VoucherMatchingDate: postDate,
                    YearMasterSid: yearMaster.YearMasterSid,
                    Narration: dto.Narration || '',
                    createdBy: dto.CreatedBy,
                    partyVoucherDetail: dto.partyVoucherDetail.map((d, i) => ({
                        VoucherDetailSid: d.VoucherDetailSid,
                        VoucherTransactionSid: d.VoucherTransactionSid,
                        COAMasterSid: d.COAMasterSid,
                        LedgerMasterSid: d.LedgerMasterSid,
                        CurrencyCode: d.CurrencyCode,
                        ExchangeRate: d.ExchangeRate,
                        DrCr: d.DrCr,
                        PartyAmount: d.PartyAmount,
                        LocalAmount: d.LocalAmount,
                        Sno: d.Sno ?? i + 1,
                    })),
                    voucherMatching: dto.matchingInvoices.map((m) => ({
                        VoucherHeaderSid: m.VoucherHeaderSid,
                        VoucherDetailSid: m.VoucherDetailSid,
                        VoucherTransactionSid: m.VoucherTransactionSid,
                        VoucherTypeMasterSid: m.VoucherTypeMasterSid,
                        COAMasterSid: m.COAMasterSid,
                        LedgerMasterSid: m.LedgerMasterSid,
                        CurrencyCode: m.CurrencyCode,
                        ExchangeRate: m.ExchangeRate,
                        DrCr: m.DrCr,
                        PartyAmount: m.PartyAmount,
                        LocalAmount: m.LocalAmount,
                    })),
                    BillMatchingCurrencyAmount: dto.matchingInvoices.reduce(
                        (sum, m) => sum + Number(m.PartyAmount || 0), 0
                    ),
                    BillMatchingLocalAmount: dto.matchingInvoices.reduce(
                        (sum, m) => sum + Number(m.LocalAmount || 0), 0
                    ),
                };

                const matchingResult = await this.voucherService.createVoucherMatching(payload as any, prisma);

                // Exchange JV creation for Scenario 2 (single foreign currency, different exchange rates)
                if (dto.exchangeJvRequired && dto.exchangeDifference && Math.abs(dto.exchangeDifference) > 0.01) {
                    const exchangeJvResult = await this.createExchangeJvForMatching(
                        prisma, dto, matchingResult.VoucherMatchingHeaderSid, yearMaster.YearMasterSid
                    );
                    return { ...matchingResult, exchangeJv: exchangeJvResult };
                }

                return matchingResult;
            });

            return result;
        } catch (error) {
            this.logger.error('createStandaloneVoucherMatching', error);
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Failed to create voucher matching');
        }
    }

    /**
     * Creates an Exchange JV for voucher matching when single foreign currency
     * has different exchange rates causing a local amount difference.
     * JV has 1 header, 2 details (party + exchange ledger), 2 transactions.
     */
    private async createExchangeJvForMatching(
        prisma: Prisma.TransactionClient,
        dto: CreateStandaloneVoucherMatchingDto,
        voucherMatchingHeaderSid: number,
        yearMasterSid: number,
    ) {
        const exchangeDiff = dto.exchangeDifference!;
        const absExchangeDiff = Math.abs(exchangeDiff);
        const postDate = new Date(dto.PostDate);

        // 1. Get Exchange Rate Mismatch Ledger from company config
        const exchangeRateLedgerSid = await this.voucherService.getExchangeRateMismatchLedger(dto.CompanyMasterSid);
        if (!exchangeRateLedgerSid) {
            throw new BadRequestException('Exchange Rate Mismatch Ledger not configured. Please configure it in Company Settings.');
        }

        // 2. Get JV VoucherTypeMaster
        const jvVoucherType = await prisma.voucherTypeMaster.findFirst({
            where: {
                DocumentTypeCode: 'JV',
                CompanyMasterSid: dto.CompanyMasterSid,
                BranchMasterSid: dto.BranchMasterSid,
                status: 'A',
            },
        });
        if (!jvVoucherType) {
            throw new BadRequestException('Journal Voucher type not found for this company/branch.');
        }

        // 3. Generate JV number
        const jvNumber = await this.voucherService.generateVoucherNumberFromConfig(
            jvVoucherType, dto.CompanyMasterSid, dto.BranchMasterSid, yearMasterSid, prisma, postDate
        );

        // 4. Create VoucherHeader (auto-posted)
        const jvHeader = await prisma.voucherHeader.create({
            data: {
                VoucherNumber: jvNumber,
                VoucherDate: postDate,
                PostDate: postDate,
                VoucherType: jvVoucherType.VoucherTypeMasterSid,
                Narration: `Exchange Rate JV for Voucher Matching`,
                CompanyMasterSid: dto.CompanyMasterSid,
                BranchMasterSid: dto.BranchMasterSid,
                VoucherTypeMasterSid: jvVoucherType.VoucherTypeMasterSid,
                PostStatus: 'P',
                Amount: absExchangeDiff,
                LocalAmount: absExchangeDiff,
                NetAmount: absExchangeDiff,
                CurrencyCode: dto.exchangeCurrencyCode || '',
                ExchangeRate: 1,
                Status: 'A',
                CreatedBy: dto.CreatedBy,
            },
        });

        // 5. Determine Dr/Cr direction
        // exchangeDiff > 0 (source local > object local) → Loss → Party Cr, Exchange Ledger Dr
        // exchangeDiff < 0 (source local < object local) → Gain → Party Dr, Exchange Ledger Cr
        const partyDrCr = exchangeDiff > 0 ? 'C' : 'D';
        const exchangeLedgerDrCr = exchangeDiff > 0 ? 'D' : 'C';

        // 6. Create 2 VoucherDetail lines
        const partyDetail = await prisma.voucherDetail.create({
            data: {
                CompanyMasterSid: dto.CompanyMasterSid,
                BranchMasterSid: dto.BranchMasterSid,
                VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                Sno: 1,
                ChargeDescription: 'Exchange Rate Difference - Party',
                COAMasterSid: dto.partyLedgerSid!,
                LedgerMasterSid: dto.partySubledgerSid || null,
                CurrencyCode: dto.exchangeCurrencyCode || '',
                ExchangeRate: 1,
                Rate: absExchangeDiff,
                NumberOfUnit: 1,
                Narration: 'Exchange Rate Difference',
                DrCr: partyDrCr,
                Amount: absExchangeDiff,
                LocalAmount: absExchangeDiff,
                TaxableAmount: 0,
                YearMasterSid: yearMasterSid,
                CreatedBy: dto.CreatedBy,
                Status: 'A',
            },
        });

        const exchangeDetail = await prisma.voucherDetail.create({
            data: {
                CompanyMasterSid: dto.CompanyMasterSid,
                BranchMasterSid: dto.BranchMasterSid,
                VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                Sno: 2,
                ChargeDescription: 'Exchange Rate',
                COAMasterSid: exchangeRateLedgerSid,
                CurrencyCode: dto.exchangeCurrencyCode || '',
                ExchangeRate: 1,
                Rate: absExchangeDiff,
                NumberOfUnit: 1,
                Narration: 'Exchange Rate',
                DrCr: exchangeLedgerDrCr,
                Amount: absExchangeDiff,
                LocalAmount: absExchangeDiff,
                TaxableAmount: 0,
                YearMasterSid: yearMasterSid,
                CreatedBy: dto.CreatedBy,
                Status: 'A',
            },
        });

        // 7. Create VoucherTransaction for each detail
        const allDetails = [partyDetail, exchangeDetail];
        for (const detail of allDetails) {
            await prisma.voucherTransaction.create({
                data: {
                    CompanyMasterSid: dto.CompanyMasterSid,
                    BranchMasterSid: dto.BranchMasterSid,
                    VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                    VoucherDetailSid: detail.VoucherDetailSid,
                    VoucherNumber: jvNumber,
                    VoucherType: jvVoucherType.VoucherTypeMasterSid,
                    VoucherDate: postDate,
                    PostDate: postDate,
                    Sno: detail.Sno,
                    ChargeDescription: detail.ChargeDescription || '',
                    LedgerMasterSid: detail.LedgerMasterSid!,
                    COAMasterSid: detail.COAMasterSid!,
                    CurrencyCode: detail.CurrencyCode,
                    ExchangeRate: detail.ExchangeRate || 1,
                    Narration: detail.Narration,
                    DrCr: detail.DrCr,
                    Amount: detail.Amount || 0,
                    LocalAmount: detail.LocalAmount || 0,
                    VoucherTypeMasterSid: jvVoucherType.VoucherTypeMasterSid,
                    YearMasterSid: yearMasterSid,
                    Status: 'A',
                    CreatedBy: dto.CreatedBy,
                    CreatedOn: postDate,
                },
            });
        }

        // 8. Add the Exchange JV party line as a matching record
        const partyTransaction = await prisma.voucherTransaction.findFirst({
            where: { VoucherHeaderSid: jvHeader.VoucherHeaderSid, COAMasterSid: dto.partyLedgerSid },
        });

        if (partyTransaction) {
            await prisma.voucherMatching.create({
                data: {
                    CreatedBy: dto.CreatedBy,
                    Status: 'A',
                    CompanyMasterSid: dto.CompanyMasterSid,
                    BranchMasterSid: dto.BranchMasterSid,
                    VoucherMatchingHeaderSid: voucherMatchingHeaderSid,
                    VoucherHeaderSid: jvHeader.VoucherHeaderSid,
                    VoucherDetailSid: partyDetail.VoucherDetailSid,
                    VoucherTransactionSid: partyTransaction.VoucherTransactionSid,
                    MatchingTransactionSid: partyTransaction.VoucherTransactionSid,
                    VoucherMatchingDate: postDate,
                    VoucherType: jvVoucherType.VoucherTypeMasterSid,
                    Sno: 0,
                    COAMasterSid: dto.partyLedgerSid!,
                    LedgerMasterSid: dto.partySubledgerSid || 0,
                    CurrencyCode: dto.exchangeCurrencyCode || '',
                    ExchangeRate: 1,
                    DrCr: partyDrCr,
                    Amount: absExchangeDiff,
                    LocalAmount: absExchangeDiff,
                    PartyAmount: absExchangeDiff,
                    MatchingType: 'ExchangeJV',
                },
            });
        }

        return {
            VoucherHeaderSid: jvHeader.VoucherHeaderSid,
            VoucherNumber: jvNumber,
            ExchangeDifference: exchangeDiff,
            IsGain: exchangeDiff < 0,
        };
    }
}
