import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import {
  VoucherOutstandingResponseDto,
  CustomerOutstandingResponseDto,
  CustomerOutstandingTransactionDto,
} from '../../dto/outstanding.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Service for calculating outstanding amounts for vouchers and customers
 * Handles calculation of outstanding balances by subtracting matched amounts
 * from original transaction amounts
 */
@Injectable()
export class OutstandingService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get outstanding amount for a specific voucher transaction
   * @param companyMasterSid - Company ID
   * @param voucherTransactionSid - Voucher Transaction ID
   * @returns Outstanding amount details
   */
  async getVoucherOutstanding(
    companyMasterSid: number,
    voucherTransactionSid: number,
  ): Promise<VoucherOutstandingResponseDto> {
    try {
      this.logger.log(
        `Getting outstanding for voucher: CompanySid=${companyMasterSid}, VoucherTransactionSid=${voucherTransactionSid}`,
      );

      // Fetch voucher transaction with header to check for reversals
      const voucherTransaction = await this._db.voucherTransaction.findFirst({
        where: {
          VoucherTransactionSid: voucherTransactionSid,
          CompanyMasterSid: companyMasterSid,
          Status: 'A', // Active only
        },
        include: {
          VoucherHeader: true,
          subledgerMaster: true,
        },
      });

      if (!voucherTransaction) {
        throw new NotFoundException(
          `Voucher Transaction with ID ${voucherTransactionSid} not found for Company ${companyMasterSid}`,
        );
      }

      /** Update : Voucher Reversal also follows the same logic
       *  Scenerio explained : for 5000 rs invoice and the customer already receipt for 2500 . and Now if the invoice is reversed , the outstanding amount should be zero
       */
      // Check if this is a reversed voucher
      // if (voucherTransaction.VoucherHeader?.ReversalVoucher !== null) {
      //   this.logger.warn(
      //     `Voucher ${voucherTransactionSid} is reversed (ReversalVoucher: ${voucherTransaction.VoucherHeader.ReversalVoucher})`,
      //   );
      //   // Return zero outstanding for reversed vouchers
      //   return {
      //     companyMasterSid: companyMasterSid,
      //     voucherTransactionSid: voucherTransactionSid,
      //     voucherNumber: voucherTransaction.VoucherNumber,
      //     originalCurrencyAmount: 0,
      //     originalLocalAmount: 0,
      //     matchedCurrencyAmount: 0,
      //     matchedLocalAmount: 0,
      //     outstandingCurrencyAmount: 0,
      //     outstandingLocalAmount: 0,
      //     currencyCode: voucherTransaction.CurrencyCode || 'USD',
      //     drCr: voucherTransaction.DrCr,
      //     voucherDate: voucherTransaction.VoucherDate,
      //     partyName: voucherTransaction.subledgerMaster?.SubledgerName,
      //   };
      // }

      // Get original amounts
      const originalCurrencyAmount = this.toNumber(voucherTransaction.Amount);
      const originalLocalAmount = this.toNumber(voucherTransaction.LocalAmount);

      // Aggregate matched amounts
      const matchings = await this._db.voucherMatching.aggregate({
        where: {
          VoucherTransactionSid: voucherTransactionSid,
          CompanyMasterSid: companyMasterSid,
          Status: 'A', // Active matchings only
        },
        _sum: {
          Amount: true,
          LocalAmount: true,
        },
      });

      const matchedCurrencyAmount = this.toNumber(matchings._sum.Amount) || 0;
      const matchedLocalAmount = this.toNumber(matchings._sum.LocalAmount) || 0;

      // Calculate outstanding
      const outstandingCurrencyAmount = this.roundToDecimal(originalCurrencyAmount - matchedCurrencyAmount, 2);
      const outstandingLocalAmount = this.roundToDecimal(originalLocalAmount - matchedLocalAmount, 2);

      const response: VoucherOutstandingResponseDto = {
        companyMasterSid: companyMasterSid,
        voucherTransactionSid: voucherTransactionSid,
        voucherNumber: voucherTransaction.VoucherNumber,
        originalCurrencyAmount: this.roundToDecimal(originalCurrencyAmount, 2),
        originalLocalAmount: this.roundToDecimal(originalLocalAmount, 2),
        matchedCurrencyAmount: this.roundToDecimal(matchedCurrencyAmount, 2),
        matchedLocalAmount: this.roundToDecimal(matchedLocalAmount, 2),
        outstandingCurrencyAmount: outstandingCurrencyAmount,
        outstandingLocalAmount: outstandingLocalAmount,
        currencyCode: voucherTransaction.CurrencyCode || 'USD',
        drCr: voucherTransaction.DrCr,
        voucherDate: voucherTransaction.VoucherDate,
        partyName: voucherTransaction.subledgerMaster?.SubledgerName,
      };

      this.logger.log(
        `Outstanding calculated: Currency=${outstandingCurrencyAmount}, Local=${outstandingLocalAmount}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error getting voucher outstanding for ${voucherTransactionSid}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all outstanding vouchers for a customer (by LedgerMasterSid)
   * @param companyMasterSid - Company ID
   * @param ledgerMasterSid - Customer's Subledger Master ID
   * @returns List of outstanding transactions with totals
   */
  async getCustomerOutstanding(
    companyMasterSid: number,
    ledgerMasterSid: number,
  ): Promise<CustomerOutstandingResponseDto> {
    try {
      this.logger.log(
        `Getting customer outstanding: CompanySid=${companyMasterSid}, LedgerMasterSid=${ledgerMasterSid}`,
      );

      // Get customer/subledger information
      const subledger = await this._db.subledgerMaster.findUnique({
        where: { SubledgerMasterSid: ledgerMasterSid },
      });

      // Fetch all active voucher transactions for this customer
      // Exclude reversed vouchers
      const voucherTransactions = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid: companyMasterSid,
          LedgerMasterSid: ledgerMasterSid,
          Status: 'A',
          VoucherHeader : { PostStatus : 'P'},
          subledgerMaster : {
            SubledgerType : 'Customer'
          },
          voucherTypeMaster : {
            DocumentTypeName : {not : 'Receipt'}
          },
          /**
           * UPDATE:
           * Voucher Reversal also follows the same logic.
           * Scenario: For 5000 invoice, customer paid 2500. 
           * If invoice is reversed, outstanding should become zero.
           * Meaning → Exclude vouchers that are reversed
           */
          // VoucherHeader: {
          //   ReversalVoucher: null, // Exclude reversed vouchers
          // },
        },
        include: {
          VoucherHeader: true,
          voucherMatchings: {
            where: {
              Status: 'A',
            },
          },
          voucherTypeMaster : {
            select : {DocumentTypeName : true}
          }
        },
        orderBy: {
          VoucherDate: 'asc',
        },
      });

      if (voucherTransactions.length === 0) {
        this.logger.log(`No outstanding vouchers found for LedgerMasterSid ${ledgerMasterSid}`);
        return {
          companyMasterSid: companyMasterSid,
          ledgerMasterSid: ledgerMasterSid,
          customerName: subledger?.SubledgerName,
          totalOutstandingCurrency: 0,
          totalOutstandingLocal: 0,
          voucherCount: 0,
          transactions: [],
        };
      }

      // Calculate outstanding for each transaction
      const transactions: CustomerOutstandingTransactionDto[] = [];
      let totalOutstandingCurrency = 0;
      let totalOutstandingLocal = 0;

      for (const vt of voucherTransactions) {
        const originalCurrencyAmount = this.toNumber(vt.Amount);
        const originalLocalAmount = this.toNumber(vt.LocalAmount);

        // Sum matched amounts for this transaction
        let matchedCurrencyAmount = 0;
        let matchedLocalAmount = 0;

        if (vt.voucherMatchings && vt.voucherMatchings.length > 0) {
          matchedCurrencyAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + this.toNumber(m.Amount),
            0,
          );
          matchedLocalAmount = vt.voucherMatchings.reduce(
            (sum, m) => sum + this.toNumber(m.LocalAmount),
            0,
          );
        }

        const outstandingCurrencyAmount = this.roundToDecimal(
          originalCurrencyAmount - matchedCurrencyAmount,
          2,
        );
        const outstandingLocalAmount = this.roundToDecimal(originalLocalAmount - matchedLocalAmount, 2);

        // Calculate exchange rate
        const exchangeRate = originalCurrencyAmount !== 0
          ? this.roundToDecimal(originalLocalAmount / originalCurrencyAmount, 4)
          : 1.0;

        // Only include if there's outstanding balance
        if (Math.abs(outstandingCurrencyAmount) > 0 || Math.abs(outstandingLocalAmount) > 0) {
          transactions.push({
            voucherTransactionSid: vt.VoucherTransactionSid,
            voucherHeaderSid: vt.VoucherHeaderSid,
            voucherDetailSid: vt.VoucherDetailSid,
            voucherNumber: vt.VoucherNumber,
            voucherDate: vt.VoucherDate,
            voucherTypeMasterSid: vt.VoucherTypeMasterSid,
            ledgerMasterSid: vt.LedgerMasterSid!,
            coaMasterSid: vt.COAMasterSid!,
            voucherType: vt.voucherTypeMaster?.DocumentTypeName,
            originalCurrencyAmount: this.toNumber(originalCurrencyAmount),
            originalLocalAmount: this.toNumber(originalLocalAmount),
            matchedCurrencyAmount: this.toNumber(matchedCurrencyAmount),
            matchedLocalAmount: this.toNumber(matchedLocalAmount),
            outstandingCurrencyAmount: outstandingCurrencyAmount,
            outstandingLocalAmount: outstandingLocalAmount,
            currencyCode: vt.CurrencyCode || 'USD',
            exchangeRate: this.toNumber(vt.ExchangeRate || 1),
            drCr: vt.DrCr,
            chargeDescription: vt.ChargeDescription || "",
          });

          totalOutstandingCurrency += outstandingCurrencyAmount;
          totalOutstandingLocal += outstandingLocalAmount;
        }
      }

      const response: CustomerOutstandingResponseDto = {
        companyMasterSid: companyMasterSid,
        ledgerMasterSid: ledgerMasterSid,
        customerName: subledger?.SubledgerName,
        totalOutstandingCurrency: this.roundToDecimal(totalOutstandingCurrency, 2),
        totalOutstandingLocal: this.roundToDecimal(totalOutstandingLocal, 2),
        voucherCount: transactions.length,
        transactions: transactions,
      };

      this.logger.log(
        `Customer outstanding calculated: ${transactions.length} transactions, Total=${response.totalOutstandingLocal}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error getting customer outstanding for ${ledgerMasterSid}: ${error.message}`,
        error.stack,
      );
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
   * Helper: Rounds number to specified decimal places
   */
  private roundToDecimal(value: number, decimals: number): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }
}
