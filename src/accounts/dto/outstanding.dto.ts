import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

/**
 * DTO for voucher outstanding response
 */
export class VoucherOutstandingResponseDto {
  @ApiProperty({ description: 'Company Master Sid', example: 1 })
  companyMasterSid: number;

  @ApiProperty({ description: 'Voucher Transaction Sid', example: 100 })
  voucherTransactionSid: number;

  @ApiProperty({ description: 'Voucher Number', example: 'INV/2024/001' })
  voucherNumber: string;

  @ApiProperty({ description: 'Original voucher amount in transaction currency', example: 10000.00 })
  originalCurrencyAmount: number;

  @ApiProperty({ description: 'Original voucher amount in local currency', example: 10000.00 })
  originalLocalAmount: number;

  @ApiProperty({ description: 'Total matched amount in transaction currency', example: 3000.00 })
  matchedCurrencyAmount: number;

  @ApiProperty({ description: 'Total matched amount in local currency', example: 3000.00 })
  matchedLocalAmount: number;

  @ApiProperty({ description: 'Outstanding amount in transaction currency', example: 7000.00 })
  outstandingCurrencyAmount: number;

  @ApiProperty({ description: 'Outstanding amount in local currency', example: 7000.00 })
  outstandingLocalAmount: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currencyCode: string;

  @ApiProperty({ description: 'Debit or Credit indicator', example: 'D' })
  drCr: string;

  @ApiProperty({ description: 'Voucher date' })
  voucherDate: Date;

  @ApiProperty({ description: 'Customer/Party name', required: false })
  partyName?: string;
}

/**
 * DTO for single outstanding transaction in customer outstanding list
 */
export class CustomerOutstandingTransactionDto {
  @ApiProperty({ description: 'Voucher Transaction Sid', example: 100 })
  voucherTransactionSid: number;

  @ApiProperty({ description: 'Voucher Header Sid', example: 100 })
  voucherHeaderSid: number;

  @ApiProperty({ description: 'Voucher Detail Sid', example: 100 })
  voucherDetailSid: number;

  @ApiProperty({ description: 'Voucher Number', example: 'INV/2024/001' })
  voucherNumber: string;

  @ApiProperty({ description: 'Voucher Date' })
  voucherDate: Date;

  @ApiProperty({ description: 'Voucher Type Master Sid', example: 1 })
  voucherTypeMasterSid: number;
  
  @ApiProperty({ description: 'Voucher Type Code', example: 'INV' })
  voucherTypeCode: string;

  @ApiProperty({ description: 'Voucher Type', example: 1 })
  voucherType: string;

  @ApiProperty({ description: 'Ledger Master Sid', example: 1 })
  ledgerMasterSid?: number;

  @ApiProperty({ description: 'COA Master Sid', example: 1 })
  coaMasterSid?: number;

  @ApiProperty({ description: 'Branch Master Sid (owning branch of the voucher)', example: 1 })
  branchMasterSid?: number;

  @ApiProperty({ description: 'Branch Name (owning branch of the voucher)', example: 'Chennai' })
  branchName?: string;

  @ApiProperty({ description: 'Dr/Cr', example: 'D' })
  DrCr?: string;

  @ApiProperty({ description: 'CurrencyCode', example: "INR" })
  CurrencyCode?: string;

  @ApiProperty({ description: 'Exchange Rate', example: 1.2 })
  ExchangeRate?: number;

  @ApiProperty({ description: 'Original amount in transaction currency', example: 10000.00 })
  originalCurrencyAmount: number;

  @ApiProperty({ description: 'Original amount in local currency', example: 10000.00 })
  originalLocalAmount: number;

  @ApiProperty({ description: 'Matched amount in transaction currency', example: 3000.00 })
  matchedCurrencyAmount: number;

  @ApiProperty({ description: 'Matched amount in local currency', example: 3000.00 })
  matchedLocalAmount: number;

  @ApiProperty({ description: 'Outstanding amount in transaction currency', example: 7000.00 })
  outstandingCurrencyAmount: number;

  @ApiProperty({ description: 'Outstanding amount in local currency', example: 7000.00 })
  outstandingLocalAmount: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currencyCode: string;

  @ApiProperty({ description: 'Exchange rate', example: 1.2 })
  exchangeRate : number;

  @ApiProperty({ description: 'Debit or Credit indicator', example: 'D' })
  drCr: string;

  @ApiProperty({ description: 'Charge description', required: false })
  chargeDescription?: string;

  @ApiProperty({ description: 'Party-row narration (VoucherTransaction.Narration)', required: false })
  narration?: string;
}

/**
 * DTO for customer outstanding response
 */
export class CustomerOutstandingResponseDto {
  @ApiProperty({ description: 'Company Master Sid', example: 1 })
  companyMasterSid: number;

  @ApiProperty({ description: 'Ledger Master Sid (Customer Subledger)', example: 50 })
  ledgerMasterSid: number;

  @ApiProperty({ description: 'Customer name', required: false })
  customerName?: string;

  @ApiProperty({ description: 'Total outstanding in currency', example: 15000.00 })
  totalOutstandingCurrency: number;

  @ApiProperty({ description: 'Total outstanding in local currency', example: 15000.00 })
  totalOutstandingLocal: number;

  @ApiProperty({ description: 'Number of outstanding vouchers', example: 5 })
  voucherCount: number;

  @ApiProperty({ description: 'List of outstanding transactions', type: [CustomerOutstandingTransactionDto] })
  transactions: CustomerOutstandingTransactionDto[];
}

/**
 * DTO for outstanding summary
 */
export class OutstandingSummaryDto {
  @ApiProperty({ description: 'Total debit amount', example: 50000.00 })
  totalDebit: number;

  @ApiProperty({ description: 'Total credit amount', example: 30000.00 })
  totalCredit: number;

  @ApiProperty({ description: 'Net outstanding (Debit - Credit)', example: 20000.00 })
  netOutstanding: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currencyCode: string;
}
