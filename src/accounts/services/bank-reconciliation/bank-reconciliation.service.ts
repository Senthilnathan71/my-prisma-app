import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { roundAmount, statusWhereClause, toNumber } from 'src/common/helper';
import { AutoMatchBankReconciliationDto, BankReconciliationFilterDto, BankReconciliationReportDto, BankStatementRowDto, ManualMatchBankReconciliationDto, UnmatchBankReconciliationDto, UpdateClearanceBankReconciliationDto } from '../../dto/bank-reconciliation.dto';

type ReconStatus = 'Reconciled' | 'Unreconciled';

interface BankBookRow {
  VoucherHeaderSid: number;
  VoucherTransactionSid: number;
  VoucherNumber: string;
  VoucherDate: Date;
  ClearanceDate: Date | null;
  VoucherTypeCode: string | null;
  Amount: number;
  LocalAmount: number;
  DrCr: string;
  ReferenceNumber: string | null;
  Narration: string | null;
  LedgerName: string | null;
  PartyName: string | null; 
}

@Injectable()
export class BankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);

  constructor(private readonly _db: DatabaseService) {}

  async searchBookTransactions(filter: BankReconciliationFilterDto) {
    const items = await this.loadBookTransactions(filter);
    return { items: items.map((item) => this.formatBookRow(item)), totalCount: items.length };
  }

  async autoMatch(payload: AutoMatchBankReconciliationDto) {
    const bookTransactions = await this.loadBookTransactions(payload);
    const items: any[] = [];
    let matchedCount = 0;

    for (const bankTransaction of payload.BankTransactions || []) {
      const match = this.findMatch(bookTransactions, bankTransaction);
      if (match) {
        await this.applyMatch({ voucherHeaderSid: match.VoucherHeaderSid, bankTransaction, createdBy: payload.CreatedBy || 'System' });
        matchedCount += 1;
        items.push({ ...this.mapBankStatementRow(bankTransaction), status: 'Reconciled', linkedVoucherHeaderSid: match.VoucherHeaderSid, linkedVoucherTransactionSid: match.VoucherTransactionSid });
      } else {
        items.push({ ...this.mapBankStatementRow(bankTransaction), status: 'Unreconciled', linkedVoucherHeaderSid: null, linkedVoucherTransactionSid: null });
      }
    }

    return { matchedCount, items, message: `Auto match completed. Matched ${matchedCount} transaction(s).` };
  }

  async manualMatch(payload: ManualMatchBankReconciliationDto) {
    const voucher = await this._db.voucherHeader.findFirst({
      where: {
        VoucherHeaderSid: payload.VoucherHeaderSid,
        CompanyMasterSid: payload.CompanyMasterSid,
        BranchMasterSid: payload.BranchMasterSid,
        Status: statusWhereClause,
      },
      include: {
        VoucherTransaction: {
          where: { Status: 'A', COAMasterSid: payload.BankCOAMasterSid },
          orderBy: { VoucherTransactionSid: 'asc' },
        },
      },
    });

    if (!voucher) throw new NotFoundException(`Voucher ${payload.VoucherHeaderSid} not found`);

    const voucherTransaction = this.pickVoucherTransaction(voucher, payload.VoucherTransactionSid);
    if (!voucherTransaction) throw new BadRequestException('Matching bank ledger transaction not found for the selected voucher');

    if (!this.amountMatches(payload.BankTransaction.Amount, toNumber(voucherTransaction.LocalAmount))) {
      throw new BadRequestException('Amount must be equal for manual match');
    }

    await this.applyMatch({ voucherHeaderSid: voucher.VoucherHeaderSid, bankTransaction: payload.BankTransaction, createdBy: payload.CreatedBy || 'System' });

    return {
      status: 'Reconciled',
      linkedVoucherHeaderSid: voucher.VoucherHeaderSid,
      linkedVoucherTransactionSid: voucherTransaction.VoucherTransactionSid,
      voucherNumber: voucher.VoucherNumber,
      clearanceDate: payload.BankTransaction.TransactionDate,
    };
  }

  async unmatch(payload: UnmatchBankReconciliationDto) {
    const voucher = await this._db.voucherHeader.findFirst({
      where: {
        VoucherHeaderSid: payload.VoucherHeaderSid,
        CompanyMasterSid: payload.CompanyMasterSid,
        BranchMasterSid: payload.BranchMasterSid,
        Status: statusWhereClause,
      },
    });

    if (!voucher) throw new NotFoundException(`Voucher ${payload.VoucherHeaderSid} not found`);

    const updated = await this._db.voucherHeader.update({
      where: { VoucherHeaderSid: voucher.VoucherHeaderSid },
      data: { ClearanceDate: null, UpdatedOn: new Date(), UpdatedBy: payload.CreatedBy || 'System' },
    });

    return { status: 'Unreconciled', voucherHeaderSid: updated.VoucherHeaderSid, voucherNumber: updated.VoucherNumber };
  }

  async updateClearance(payload: UpdateClearanceBankReconciliationDto) {
    if (!payload.VoucherHeaderSids?.length) {
      throw new BadRequestException('Please select at least one voucher row');
    }

    const clearanceDate = new Date(payload.ClearanceDate);
    if (Number.isNaN(clearanceDate.getTime())) {
      throw new BadRequestException('Invalid clearance date');
    }

    const voucherHeaderSids = Array.from(new Set(payload.VoucherHeaderSids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)));
    if (!voucherHeaderSids.length) {
      throw new BadRequestException('Please select at least one valid voucher row');
    }

    const updated = await this._db.$transaction(async (tx) => {
      const items = await tx.voucherHeader.findMany({
        where: {
          VoucherHeaderSid: { in: voucherHeaderSids },
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          Status: statusWhereClause,
        },
      });

      if (!items.length) {
        throw new NotFoundException('Selected voucher row(s) not found');
      }

      const updatedItems: Array<{
        voucherHeaderSid: number;
        voucherNumber: string;
        clearanceDate: Date | null;
      }> = [];
      for (const voucher of items) {
        const result = await tx.voucherHeader.update({
          where: { VoucherHeaderSid: voucher.VoucherHeaderSid },
          data: {
            ClearanceDate: clearanceDate,
            UpdatedOn: new Date(),
            UpdatedBy: payload.CreatedBy || 'System',
          },
        });
        updatedItems.push({
          voucherHeaderSid: result.VoucherHeaderSid,
          voucherNumber: result.VoucherNumber,
          clearanceDate: result.ClearanceDate,
        });
      }
      return updatedItems;
    });

    return {
      status: 'Cleared',
      updatedCount: updated.length,
      items: updated,
      clearanceDate: payload.ClearanceDate,
    };
  }

  async generateReport(payload: BankReconciliationReportDto) {
    const bookRows = await this.loadBookTransactions(payload);
    const bankRows = (payload.BankTransactions || []).map((row) => this.mapBankStatementRow(row));

    const matchedBookMap = new Map<number, BankBookRow>();
    const unmatchedBankRows: ReturnType<typeof this.mapBankStatementRow>[] = [];

    for (const bankRow of bankRows) {
      const match = this.findMatch(bookRows, bankRow);
      if (match) matchedBookMap.set(match.VoucherTransactionSid, match);
      else unmatchedBankRows.push(bankRow);
    }

    const bookEntriesNotCleared = bookRows.filter((row) => !row.ClearanceDate);
    const bookBalance = roundAmount(bookRows.reduce((sum, row) => sum + this.signedAmount(row.Amount, row.DrCr), 0), 2);
    const addBankEntries = roundAmount(unmatchedBankRows.reduce((sum, row) => sum + this.signedAmount(row.Amount, row.DrCr), 0), 2);
    const lessBookEntries = roundAmount(bookEntriesNotCleared.reduce((sum, row) => sum + this.signedAmount(row.Amount, row.DrCr), 0), 2);
    const finalBalance = roundAmount(bookBalance + addBankEntries - lessBookEntries, 2);

    return {
      summary: {
        bankStatementBalance: payload.BankStatementBalance ?? null,
        bookBalance,
        addBankEntriesNotInBooks: addBankEntries,
        lessBookEntriesNotClearedInBank: lessBookEntries,
        finalBalance,
        difference: payload.BankStatementBalance === undefined || payload.BankStatementBalance === null ? null : roundAmount((payload.BankStatementBalance || 0) - finalBalance, 2),
      },
      counts: {
        bookRows: bookRows.length,
        bankRows: bankRows.length,
        reconciledBookRows: bookRows.filter((row) => !!row.ClearanceDate).length,
        unreconciledBookRows: bookRows.filter((row) => !row.ClearanceDate).length,
        unmatchedBankRows: unmatchedBankRows.length,
      },
      bookEntriesNotCleared: bookEntriesNotCleared.map((row) => this.formatBookRow(row)),
      bankEntriesNotInBooks: unmatchedBankRows,
      matchedBookEntries: Array.from(matchedBookMap.values()).map((row) => this.formatBookRow(row)),
    };
  }

  private async loadBookTransactions(filter: BankReconciliationFilterDto): Promise<BankBookRow[]> {
    const where: Prisma.VoucherTransactionWhereInput = {
      CompanyMasterSid: filter.CompanyMasterSid,
      BranchMasterSid: filter.BranchMasterSid,
      Status: 'A',
      COAMasterSid: filter.BankCOAMasterSid,
      VoucherHeader: { Status: statusWhereClause, CompanyMasterSid: filter.CompanyMasterSid, BranchMasterSid: filter.BranchMasterSid, PostStatus: 'P' },
    };

    if (filter.FromDate || filter.ToDate) {
      where.VoucherDate = {};
      if (filter.FromDate) where.VoucherDate.gte = new Date(filter.FromDate);
      if (filter.ToDate) where.VoucherDate.lte = new Date(filter.ToDate);
    }

    const rows = await this._db.voucherTransaction.findMany({
      where,
      include: {
        VoucherHeader: { include: { voucherTypeMaster: true, coaMaster: true, subledgerMaster: true } },
        coaMaster: true,
      },
      orderBy: [{ VoucherDate: 'asc' }, { VoucherTransactionSid: 'asc' }],
    });

    const normalizedSearch = filter.Search?.trim().toUpperCase() || '';
    return rows
      .map((row) => ({
        VoucherHeaderSid: row.VoucherHeaderSid,
        VoucherTransactionSid: row.VoucherTransactionSid,
        VoucherNumber: row.VoucherNumber,
        VoucherDate: row.VoucherDate,
        ClearanceDate: row.VoucherHeader?.ClearanceDate ?? null,
        VoucherTypeCode: row.VoucherHeader?.voucherTypeMaster?.DocumentTypeCode ?? null,
        Amount: toNumber(row.Amount),
        LocalAmount: toNumber(row.LocalAmount),
        DrCr: row.DrCr,
        ReferenceNumber: row.VoucherHeader?.InstrumentNumber || row.VoucherHeader?.DocumentNumber || row.VoucherHeader?.VoucherNumber || null,
        Narration: row.Narration || row.VoucherHeader?.Narration || null,
        LedgerName: row.coaMaster?.LedgerName || null,
        PartyName: row.VoucherHeader?.PartyName || null,
      }))
      .filter((row) => {
        if (!normalizedSearch) return true;
        return [row.VoucherNumber, row.ReferenceNumber, row.Narration]
          .filter(Boolean)
          .some((value) => String(value).toUpperCase().includes(normalizedSearch));
      })
      .filter((row) => {
        if (filter.ClearanceFilter === 'WITH') return !!row.ClearanceDate;
        if (filter.ClearanceFilter === 'WITHOUT') return !row.ClearanceDate;
        return true;
      });
  }

  private findMatch(bookTransactions: BankBookRow[], bankTransaction: BankStatementRowDto): BankBookRow | null {
    const bankAmount = toNumber(bankTransaction.Amount);
    const bankRef = this.normalizeRef(bankTransaction.ReferenceNumber || '');
    const bankDrCr = (bankTransaction.DrCr || this.defaultDrCr(bankAmount)).toUpperCase();

    const candidates = bookTransactions.filter((row) => {
      if (row.ClearanceDate) return false;
      if (!this.amountMatches(bankAmount, row.LocalAmount)) return false;
      const rowDrCr = (row.DrCr || '').toUpperCase();
      if (rowDrCr && bankDrCr && rowDrCr !== bankDrCr) return false;
      if (!bankRef) return true;
      const rowRefs = [row.ReferenceNumber, row.VoucherNumber].filter(Boolean).map((ref) => this.normalizeRef(String(ref)));
      return rowRefs.includes(bankRef);
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => new Date(b.VoucherDate).getTime() - new Date(a.VoucherDate).getTime() || b.VoucherTransactionSid - a.VoucherTransactionSid);
    return candidates[0];
  }

  private async applyMatch(payload: { bankTransaction: BankStatementRowDto; voucherHeaderSid: number; createdBy: string }) {
    await this._db.voucherHeader.update({
      where: { VoucherHeaderSid: payload.voucherHeaderSid },
      data: { ClearanceDate: new Date(payload.bankTransaction.TransactionDate), UpdatedOn: new Date(), UpdatedBy: payload.createdBy },
    });
  }

  private pickVoucherTransaction(voucher: any, voucherTransactionSid?: number) {
    if (voucherTransactionSid) return (voucher.VoucherTransaction || []).find((tx: any) => tx.VoucherTransactionSid === voucherTransactionSid) || null;
    return (voucher.VoucherTransaction || [])[0] || null;
  }

  private formatBookRow(row: BankBookRow) {
    return { ...row, status: row.ClearanceDate ? ('Reconciled' as ReconStatus) : ('Unreconciled' as ReconStatus) };
  }

  private mapBankStatementRow(row: BankStatementRowDto) {
    return { ReferenceNumber: row.ReferenceNumber || undefined, TransactionDate: row.TransactionDate, ValueDate: row.ValueDate || undefined, Narration: row.Narration || undefined, Amount: toNumber(row.Amount), DrCr: (row.DrCr || this.defaultDrCr(row.Amount)).toUpperCase() };
  }

  private normalizeRef(value: string): string {
    return String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[-_/]/g, '');
  }

  private amountMatches(a: number, b: number): boolean {
    return roundAmount(toNumber(a), 2) === roundAmount(toNumber(b), 2);
  }

  private signedAmount(amount: number, drCr: string): number {
    return (String(drCr || '').toUpperCase() === 'C' ? -1 : 1) * roundAmount(toNumber(amount), 2);
  }

  private defaultDrCr(amount: number): string {
    return toNumber(amount) >= 0 ? 'D' : 'C';
  }
}

