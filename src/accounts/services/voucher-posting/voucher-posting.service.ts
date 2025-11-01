import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  PostVoucherRequestDto,
  PostVoucherResponseDto,
  ValidationResultDto,
  ValidationErrorDto,
  TaxSummaryDto,
  DraftVoucherResponseDto,
} from '../../dto/voucher-posting.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Service for handling voucher posting operations
 * Transforms draft vouchers (VoucherHeader/VoucherDetail) into posted transactions (VoucherTransaction)
 * with tax summarization, validation, and idempotency
 */
@Injectable()
export class VoucherPostingService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly logger: Logger,
  ) {}

  /**
   * Retrieves a draft voucher with all its details
   * @param voucherHeaderSid - The ID of the voucher header
   * @returns Draft voucher with header and detail information
   */
  async getDraftVoucher(voucherHeaderSid: number): Promise<DraftVoucherResponseDto> {
    try {
      this.logger.log(`Fetching draft voucher: ${voucherHeaderSid}`);

      // Fetch voucher header with all necessary relations
      const header = await this._db.voucherHeader.findUnique({
        where: { VoucherHeaderSid: voucherHeaderSid },
        include: {
          VoucherDetail: {
            where: { Status: 'A' },
            orderBy: { Sno: 'asc' },
            include: {
              coaMaster: true,
              subledgerMaster: true,
              hSSACMaster: true,
              chargeMaster: true,
            },
          },
          voucherTypeMaster: true,
          CompanyMaster: true,
          BranchMaster: true,
          subledgerMaster: true,
          currencyMaster: true,
        },
      });

      if (!header) {
        throw new NotFoundException(`Voucher with ID ${voucherHeaderSid} not found`);
      }

      // Check if already posted
      const isPosted = header.SetoffStatus === 'Posted' || header.SetoffStatus === 'Completed';

      return {
        header: header,
        details: header.VoucherDetail,
        isPosted: isPosted,
        postingStatus: header.SetoffStatus ?? undefined,
      };
    } catch (error) {
      this.logger.error(`Error fetching draft voucher ${voucherHeaderSid}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validates a voucher before posting
   * @param voucherHeaderSid - The ID of the voucher to validate
   * @returns Validation result with any errors found
   */
  async validateVoucher(voucherHeaderSid: number): Promise<ValidationResultDto> {
    try {
      this.logger.log(`Validating voucher: ${voucherHeaderSid}`);

      const errors: ValidationErrorDto[] = [];

      // Fetch voucher with details
      const voucher = await this._db.voucherHeader.findUnique({
        where: { VoucherHeaderSid: voucherHeaderSid },
        include: {
          VoucherDetail: { where: { Status: 'A' } },
          voucherTypeMaster: true,
        },
      });

      if (!voucher) {
        errors.push({
          code: 'VOUCHER_NOT_FOUND',
          message: `Voucher with ID ${voucherHeaderSid} not found`,
        });
        return {
          isValid: false,
          errors,
          validatedAt: new Date(),
        };
      }

      // Check if already posted (idempotency)
      if (voucher.SetoffStatus === 'Posted' || voucher.SetoffStatus === 'Completed') {
        errors.push({
          code: 'ALREADY_POSTED',
          message: 'Voucher is already posted',
          details: { currentStatus: voucher.SetoffStatus },
        });
      }

      // Check if there are detail lines
      if (!voucher.VoucherDetail || voucher.VoucherDetail.length === 0) {
        errors.push({
          code: 'NO_DETAIL_LINES',
          message: 'Voucher has no detail lines',
        });
        return {
          isValid: false,
          errors,
          validatedAt: new Date(),
        };
      }

      // Calculate totals
      let totalDebit = 0;
      let totalCredit = 0;

      for (const detail of voucher.VoucherDetail) {
        const amount = this.toNumber(detail.Amount);

        if (detail.DrCr === 'D' || detail.DrCr === 'Debit') {
          totalDebit += amount;
        } else if (detail.DrCr === 'C' || detail.DrCr === 'Credit') {
          totalCredit += amount;
        } else {
          errors.push({
            code: 'INVALID_DRCR',
            message: `Invalid DrCr value: ${detail.DrCr}`,
            field: 'DrCr',
            details: { voucherDetailSid: detail.VoucherDetailSid, drCr: detail.DrCr },
          });
        }

        // Validate mandatory fields
        if (!detail.COAMasterSid) {
          errors.push({
            code: 'MISSING_COA',
            message: 'COA Master Sid is required',
            field: 'COAMasterSid',
            details: { voucherDetailSid: detail.VoucherDetailSid },
          });
        }

        if (amount <= 0) {
          errors.push({
            code: 'INVALID_AMOUNT',
            message: 'Amount must be greater than zero',
            field: 'Amount',
            details: { voucherDetailSid: detail.VoucherDetailSid, amount },
          });
        }
      }

      // Check balanced entry (with tolerance for floating point)
      const tolerance = 0.01;
      if (Math.abs(totalDebit - totalCredit) > tolerance) {
        errors.push({
          code: 'UNBALANCED_ENTRY',
          message: `Total Debit (${totalDebit.toFixed(2)}) and Credit (${totalCredit.toFixed(2)}) amounts do not match`,
          details: { totalDebit, totalCredit, difference: totalDebit - totalCredit },
        });
      }

      // Validate voucher date against current financial year
      const currentYear = await this._db.yearMaster.findFirst({
        where: {
          CompanyMasterSid: voucher.CompanyMasterSid,
          CurrentYear: 'Y',
        },
      });

      if (currentYear) {
        const voucherDate = new Date(voucher.VoucherDate);
        const startDate = new Date(currentYear.StartDate);
        const endDate = new Date(currentYear.EndDate);

        if (voucherDate < startDate || voucherDate > endDate) {
          errors.push({
            code: 'DATE_OUT_OF_YEAR',
            message: 'Voucher date is outside the current financial year range',
            field: 'VoucherDate',
            details: {
              voucherDate: voucher.VoucherDate,
              yearFrom: currentYear.StartDate,
              yearTo: currentYear.EndDate,
            },
          });
        }
      }

      // Validate COA and Ledger mappings
      const coaIds = voucher.VoucherDetail.map((d) => d.COAMasterSid).filter((id) => id !== null);
      const ledgerIds = voucher.VoucherDetail.map((d) => d.LedgerMasterSid).filter((id) => id !== null);

      if (coaIds.length > 0) {
        const coaCount = await this._db.cOAMaster.count({
          where: {
            COAMasterSid: { in: coaIds },
            Status: 'A',
          },
        });

        if (coaCount !== coaIds.length) {
          errors.push({
            code: 'INVALID_COA_MAPPING',
            message: 'One or more COA mappings are invalid or inactive',
          });
        }
      }

      if (ledgerIds.length > 0) {
        const ledgerCount = await this._db.subledgerMaster.count({
          where: {
            SubledgerMasterSid: { in: ledgerIds },
            Status: 'A',
          },
        });

        if (ledgerCount !== ledgerIds.length) {
          errors.push({
            code: 'INVALID_LEDGER_MAPPING',
            message: 'One or more Subledger mappings are invalid or inactive',
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        lineCount: voucher.VoucherDetail.length,
        validatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Error validating voucher ${voucherHeaderSid}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Prepares the posting payload from draft voucher data
   * @param voucherHeaderSid - The ID of the voucher to prepare
   * @returns Prepared posting payload ready for submission
   */
  async preparePostingPayload(voucherHeaderSid: number): Promise<PostVoucherRequestDto> {
    try {
      this.logger.log(`Preparing posting payload for voucher: ${voucherHeaderSid}`);

      const draftVoucher = await this.getDraftVoucher(voucherHeaderSid);

      if (draftVoucher.isPosted) {
        throw new BadRequestException('Voucher is already posted');
      }

      const header = draftVoucher.header;
      const details = draftVoucher.details;

      // Map detail lines
      const lines = details.map((detail, index) => ({
        sno: this.toNumber(detail.Sno) || index + 1,
        voucherDetailSid: detail.VoucherDetailSid,
        coaMasterSid: detail.COAMasterSid,
        ledgerMasterSid: detail.LedgerMasterSid,
        drCr: this.normalizeDrCr(detail.DrCr),
        chargeDescription: detail.ChargeDescription,
        taxableAmount: this.toNumber(detail.TaxableAmount),
        amount: this.toNumber(detail.Amount),
        localAmount: this.toNumber(detail.LocalAmount),
        gstVatCode: header.GST_VAT,
        hsSacMasterSid: detail.HSSACMasterSid,
        numberOfUnit: this.toNumber(detail.NumberOfUnit),
        rate: this.toNumber(detail.Rate),
        narration: detail.Narration,
        costCenter: detail.CostCenter,
        profitCenter: detail.ProfitCenter,
        departmentMasterSid: detail.DepartmentMasterSid,
        houseJobSid: detail.HouseJobSid,
        masterJobSid: detail.MasterJobSid,
        costRevenue: detail.CostRevenue,
        taxPercentage1: this.toNumber(detail.TaxPercentage1),
        taxAmount1: this.toNumber(detail.TaxAmount1),
        taxPercentage2: this.toNumber(detail.TaxPercentage2),
        taxAmount2: this.toNumber(detail.TaxAmount2),
        yearMasterSid: detail.YearMasterSid,
      }));

      // Summarize taxes by HS/SAC code
      const taxSummaries = await this.summarizeTaxes(details, header.CompanyMasterSid);

      // Get YearMasterSid from first detail line or fetch current year
      let yearMasterSid = details.length > 0 ? details[0].YearMasterSid : null;
      if (!yearMasterSid) {
        const currentYear = await this._db.yearMaster.findFirst({
          where: {
            CompanyMasterSid: header.CompanyMasterSid,
            CurrentYear: 'Y',
          },
        });
        yearMasterSid = currentYear?.YearMasterSid || null;
      }

      const payload: PostVoucherRequestDto = {
        voucherHeaderSid: header.VoucherHeaderSid,
        voucherNumber: header.VoucherNumber,
        companyMasterSid: header.CompanyMasterSid,
        branchMasterSid: header.BranchMasterSid,
        voucherDate: this.formatDate(header.VoucherDate),
        postDate: this.formatDate(header.PostDate),
        currencyCode: header.CurrencyCode || 'USD',
        exchangeRate: this.toNumber(header.ExchangeRate) || 1,
        voucherType: header.VoucherType,
        voucherTypeMasterSid: header.VoucherTypeMasterSid,
        yearMasterSid: yearMasterSid,
        gstVat: header.GST_VAT,
        lines: lines,
        taxSummaries: taxSummaries,
        createdBy: header.UpdatedBy || header.CreatedBy || 'System',
      };

      return payload;
    } catch (error) {
      this.logger.error(`Error preparing posting payload for ${voucherHeaderSid}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Summarizes taxes by grouping detail lines by HS/SAC code and tax type
   * @param details - Array of voucher detail lines
   * @param companyMasterSid - Company ID for fetching tax account mappings
   * @returns Array of tax summaries grouped by HS/SAC code and tax type
   */
  async summarizeTaxes(details: any[], companyMasterSid: number): Promise<TaxSummaryDto[]> {
    try {
      this.logger.log('Summarizing taxes by HS/SAC code');

      // Group details by HS/SAC code and tax percentage
      const taxGroups = new Map<string, TaxSummaryDto>();

      for (const detail of details) {
        // Skip if no tax
        if (!detail.TaxPercentage1 && !detail.TaxPercentage2) {
          continue;
        }

        const hsSacMasterSid = detail.HSSACMasterSid;
        if (!hsSacMasterSid) {
          continue;
        }

        // Fetch HS/SAC master for the code
        const hsSacMaster = detail.hSSACMaster ||
          (await this._db.hSSACMaster.findUnique({
            where: { HSSACMasterSid: hsSacMasterSid },
          }));

        if (!hsSacMaster) {
          continue;
        }

        const hsSacCode = hsSacMaster.Code || `HSN_${hsSacMasterSid}`;

        // Process Tax 1 (CGST)
        if (detail.TaxPercentage1 && detail.TaxAmount1) {
          const taxPercentage1 = this.toNumber(detail.TaxPercentage1);
          const taxAmount1 = this.toNumber(detail.TaxAmount1);
          const taxableAmount = this.toNumber(detail.TaxableAmount);

          const key1 = `${hsSacMasterSid}_CGST_${taxPercentage1}`;

          if (!taxGroups.has(key1)) {
            // Find or determine tax COA account
            const taxCOA = await this.getTaxCOAAccount(companyMasterSid, 'CGST', taxPercentage1);

            taxGroups.set(key1, {
              hsSacMasterSid: hsSacMasterSid,
              hsSacCode: hsSacCode,
              taxType: 'CGST',
              taxPercentage: taxPercentage1,
              taxableAmount: 0,
              taxAmount: 0,
              coaMasterSid: taxCOA,
            });
          }

          const group1 = taxGroups.get(key1);
          if (group1) {
            group1.taxableAmount += taxableAmount;
            group1.taxAmount += taxAmount1;
          }
        }

        // Process Tax 2 (SGST)
        if (detail.TaxPercentage2 && detail.TaxAmount2) {
          const taxPercentage2 = this.toNumber(detail.TaxPercentage2);
          const taxAmount2 = this.toNumber(detail.TaxAmount2);
          const taxableAmount = this.toNumber(detail.TaxableAmount);

          const key2 = `${hsSacMasterSid}_SGST_${taxPercentage2}`;

          if (!taxGroups.has(key2)) {
            const taxCOA = await this.getTaxCOAAccount(companyMasterSid, 'SGST', taxPercentage2);

            taxGroups.set(key2, {
              hsSacMasterSid: hsSacMasterSid,
              hsSacCode: hsSacCode,
              taxType: 'SGST',
              taxPercentage: taxPercentage2,
              taxableAmount: 0,
              taxAmount: 0,
              coaMasterSid: taxCOA,
            });
          }

          const group2 = taxGroups.get(key2);
          if (group2) {
            group2.taxableAmount += taxableAmount;
            group2.taxAmount += taxAmount2;
          }
        }
      }

      return Array.from(taxGroups.values());
    } catch (error) {
      this.logger.error(`Error summarizing taxes: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Posts a voucher by creating VoucherTransaction records and updating header status
   * @param payload - The posting payload with voucher and transaction data
   * @returns Posting response with success status and transaction details
   */
  async postVoucher(payload: PostVoucherRequestDto): Promise<PostVoucherResponseDto> {
    try {
      this.logger.log(`Posting voucher: ${payload.voucherHeaderSid}`);

      // Validate before posting
      const validation = await this.validateVoucher(payload.voucherHeaderSid);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          message: 'Validation failed',
        };
      }

      // Use transaction for atomicity
      const result = await this._db.$transaction(async (tx) => {
        const transactionSids: number[] = [];
        const createdAt = new Date();

        // Create VoucherTransaction records for each detail line
        for (const line of payload.lines) {
          const transaction = await tx.voucherTransaction.create({
            data: {
              CompanyMasterSid: payload.companyMasterSid,
              BranchMasterSid: payload.branchMasterSid,
              VoucherHeaderSid: payload.voucherHeaderSid,
              VoucherDetailSid: line.voucherDetailSid,
              VoucherNumber: payload.voucherNumber,
              VoucherType: payload.voucherType,
              VoucherDate: new Date(payload.voucherDate),
              PostDate: new Date(payload.postDate),
              GST_VAT: payload.gstVat || '',
              Sno: new Decimal(line.sno),
              ChargeDescription: line.chargeDescription || '',
              LedgerMasterSid: line.ledgerMasterSid || 0,
              COAMasterSid: line.coaMasterSid,
              DepartmentMasterSid: line.departmentMasterSid || 0,
              HouseJobSid: line.houseJobSid || 0,
              MasterJobSid: line.masterJobSid || 0,
              CostRevenue: line.costRevenue || '',
              CurrencyCode: payload.currencyCode,
              ExchangeRate: new Decimal(payload.exchangeRate),
              Rate: new Decimal(line.rate || 0),
              NumberOfUnit: new Decimal(line.numberOfUnit || 0),
              Narration: line.narration || '',
              DrCr: line.drCr,
              TaxableAmount: new Decimal(line.taxableAmount),
              Amount: new Decimal(line.amount),
              LocalAmount: new Decimal(line.localAmount),
              CostCenter: line.costCenter || null,
              ProfitCenter: line.profitCenter || null,
              TransType: 'POST',
              VoucherTypeMasterSid: payload.voucherTypeMasterSid,
              YearMasterSid: payload.yearMasterSid || null,
              Status: 'A',
              CreatedBy: payload.createdBy,
              CreatedOn: createdAt,
              UpdatedOn: createdAt,
            },
          });

          transactionSids.push(transaction.VoucherTransactionSid);

          // Update VoucherDetail with transaction link
          await tx.voucherDetail.update({
            where: { VoucherDetailSid: line.voucherDetailSid },
            data: {
              VoucherTransactionSid: transaction.VoucherTransactionSid,
              UpdatedOn: createdAt,
              UpdatedBy: payload.createdBy,
            },
          });
        }

        // Create VoucherTransaction records for tax summaries
        let taxSno = payload.lines.length + 1;
        for (const taxSummary of payload.taxSummaries) {
          const taxTransaction = await tx.voucherTransaction.create({
            data: {
              CompanyMasterSid: payload.companyMasterSid,
              BranchMasterSid: payload.branchMasterSid,
              VoucherHeaderSid: payload.voucherHeaderSid,
              VoucherDetailSid: 0, // Tax summary not linked to specific detail
              VoucherNumber: payload.voucherNumber,
              VoucherType: payload.voucherType,
              VoucherDate: new Date(payload.voucherDate),
              PostDate: new Date(payload.postDate),
              GST_VAT: payload.gstVat || '',
              Sno: new Decimal(taxSno++),
              ChargeDescription: `${taxSummary.taxType} @ ${taxSummary.taxPercentage}% - ${taxSummary.hsSacCode}`,
              LedgerMasterSid: 0,
              COAMasterSid: taxSummary.coaMasterSid,
              DepartmentMasterSid: 0,
              HouseJobSid: 0,
              MasterJobSid: 0,
              CostRevenue: '',
              CurrencyCode: payload.currencyCode,
              ExchangeRate: new Decimal(payload.exchangeRate),
              Rate: new Decimal(0),
              NumberOfUnit: new Decimal(0),
              Narration: `Tax Summary: ${taxSummary.taxType}`,
              DrCr: 'C', // Tax is typically a credit (liability)
              TaxableAmount: new Decimal(taxSummary.taxableAmount),
              Amount: new Decimal(taxSummary.taxAmount),
              LocalAmount: new Decimal(taxSummary.taxAmount * payload.exchangeRate),
              CostCenter: null,
              ProfitCenter: null,
              TransType: 'TAX',
              VoucherTypeMasterSid: payload.voucherTypeMasterSid,
              YearMasterSid: payload.yearMasterSid || null,
              Status: 'A',
              CreatedBy: payload.createdBy,
              CreatedOn: createdAt,
              UpdatedOn: createdAt,
            },
          });

          transactionSids.push(taxTransaction.VoucherTransactionSid);
        }

        // Update VoucherHeader status to Posted
        await tx.voucherHeader.update({
          where: { VoucherHeaderSid: payload.voucherHeaderSid },
          data: {
            SetoffStatus: 'Posted',
            PostDate: new Date(payload.postDate),
            UpdatedOn: createdAt,
            UpdatedBy: payload.createdBy,
          },
        });

        this.logger.log(
          `Successfully posted voucher ${payload.voucherHeaderSid}: ${transactionSids.length} transactions created`,
        );

        return {
          success: true,
          voucherHeaderSid: payload.voucherHeaderSid,
          transactionCount: transactionSids.length,
          transactionSids: transactionSids,
          postedAt: createdAt,
          errors: [],
          message: 'Voucher posted successfully',
        };
      });

      return result;
    } catch (error) {
      this.logger.error(`Error posting voucher: ${error.message}`, error.stack);

      return {
        success: false,
        errors: [
          {
            code: 'POSTING_FAILED',
            message: error.message || 'Failed to post voucher',
            details: error,
          },
        ],
        message: 'Posting failed due to an error',
      };
    }
  }

  /**
   * Gets or creates a COA account for a specific tax type
   * @param companyMasterSid - Company ID
   * @param taxType - Type of tax (CGST, SGST, IGST, VAT)
   * @param taxPercentage - Tax percentage
   * @returns COA Master Sid for the tax account
   */
  private async getTaxCOAAccount(
    companyMasterSid: number,
    taxType: string,
    taxPercentage: number,
  ): Promise<number> {
    try {
      // Try to find existing tax COA by searching for account with tax type in name
      const taxCOA = await this._db.cOAMaster.findFirst({
        where: {
          CompanyMasterSid: companyMasterSid,
          LedgerName: {
            contains: taxType,
          },
          Status: 'A',
        },
      });

      if (taxCOA) {
        return taxCOA.COAMasterSid;
      }

      // Fallback: Look for a generic tax account
      const genericTaxCOA = await this._db.cOAMaster.findFirst({
        where: {
          CompanyMasterSid: companyMasterSid,
          OR: [
            { LedgerName: { contains: 'Tax' } },
            { LedgerName: { contains: 'GST' } },
            { LedgerName: { contains: 'VAT' } },
          ],
          Status: 'A',
        },
      });

      if (genericTaxCOA) {
        this.logger.warn(
          `Using generic tax account ${genericTaxCOA.COAMasterSid} for ${taxType} @ ${taxPercentage}%`,
        );
        return genericTaxCOA.COAMasterSid;
      }

      // If no tax account found, throw error
      throw new BadRequestException(
        `No COA account found for ${taxType}. Please configure tax accounts in Chart of Accounts.`,
      );
    } catch (error) {
      this.logger.error(`Error getting tax COA account: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Helper: Converts Prisma Decimal to number
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    if (value instanceof Decimal) {
      return value.toNumber();
    }
    return parseFloat(value.toString()) || 0;
  }

  /**
   * Helper: Normalizes DrCr values to 'D' or 'C'
   */
  private normalizeDrCr(drCr: string): string {
    if (!drCr) return 'D';
    const normalized = drCr.toUpperCase().trim();
    if (normalized.startsWith('D')) return 'D';
    if (normalized.startsWith('C')) return 'C';
    return drCr;
  }

  /**
   * Helper: Formats date to YYYY-MM-DD string
   */
  private formatDate(date: Date | string): string {
    if (!date) return new Date().toISOString().split('T')[0];
    if (typeof date === 'string') return date.split('T')[0];
    return date.toISOString().split('T')[0];
  }
}
