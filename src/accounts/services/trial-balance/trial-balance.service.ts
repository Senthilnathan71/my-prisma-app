import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  TrialBalanceQueryDto,
  TrialBalanceResponseDto,
  TrialBalanceItemDto,
  TrialBalanceSubtotalDto,
  TrialBalanceGrandTotalDto,
} from '../../dto/trial-balance.dto';

interface BalanceCalculation {
  debit: number;
  credit: number;
}

@Injectable()
export class TrialBalanceService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Generate Trial Balance Report
   */
  async generateTrialBalance(
    query: TrialBalanceQueryDto,
  ): Promise<TrialBalanceResponseDto> {
    
    // Ensure proper type conversion from query parameters
    const CompanyMasterSid = Number(query.companyId);
    const BranchMasterSid = query.Branch?.map(id => Number(id));
    const fromDate = query.FromDate;
    const toDate = query.ToDate;
    const GroupName = query.GroupName;
    const SubGroupName = query.SubGroupName;
    const showSubtotals = query.showSubtotals ?? true;
    const YearMasterSid = query.YearMasterSid ? Number(query.YearMasterSid) : undefined;
    const SubTotal =  query.SubTotal
    const Subledger = query.Subledger ?? false;
    // Validate dates
    this.validateDates(fromDate, toDate);

    // Validate financial year
    await this.validateFinancialYear(
      fromDate,
      toDate,
      CompanyMasterSid,
      YearMasterSid,
    );
    
    
    // Get all active ledgers matching filters
    const ledgers = await this.getLedgers(
      CompanyMasterSid,
      GroupName,
      SubGroupName,
    );


    // --- Resolve Group Name ---
    let GroupNameResolved = 'All';
    if (query.GroupName) {
      const groupIds = Array.isArray(query.GroupName)
        ? query.GroupName.map(Number)
        : [Number(query.GroupName)];

      const groups = await this.databaseService.cOAMaster.findMany({
        where: { COAMasterSid: { in: groupIds } },
        select: { GroupName: true },
      });

      GroupNameResolved = groups.map(g => g.GroupName).join(', ') || 'All';
    }

    // --- Resolve SubGroup Name ---
    let SubGroupNameResolved = 'All';
    if (query.SubGroupName) {
      const subGroupIds = Array.isArray(query.SubGroupName)
        ? query.SubGroupName.map(Number)
        : [Number(query.SubGroupName)];

      const subGroups = await this.databaseService.cOAMaster.findMany({
        where: { COAMasterSid: { in: subGroupIds } },
        select: { SubGroupName: true },
      });

      SubGroupNameResolved = subGroups.map(s => s.SubGroupName).join(', ') || 'All';
    }

    
    let BranchInvolved = 'All Branches';
    if (query.Branch && query.Branch.length > 0) {

      const selectedBranches = await this.databaseService.branchMaster.findMany({
        where: {
          CompanyMasterSid: Number(query.companyId),
          status: 'A',
          BranchMasterSid: {
            in: query.Branch.map(Number),
          },
        },
        select: {
          branchName: true,
        },
      });

      BranchInvolved = selectedBranches
        .map(b => b.branchName)
        .join(', ');
    }

    if (ledgers.length === 0) {
      return {
        success: true,
        message: 'No ledgers found matching the criteria',
        parameters: {
          CompanyMasterSid,
          BranchInvolved,
          GroupNameResolved,
          SubGroupNameResolved,
          BranchMasterSid,
          fromDate,
          toDate,
          GroupName,
          SubGroupName,
          showSubtotals,
          SubTotal,
          Subledger
        },
        items: [],
        subtotals: [],
        grandTotal: this.createEmptyGrandTotal(),
        totalLedgers: 0,
        generatedAt: new Date(),
      };
    }

    // Calculate balances for each ledger
    let items: TrialBalanceItemDto[];
    if (Subledger) {
      items = await this.calculateWithSubledger(
        ledgers,
        CompanyMasterSid,
        BranchMasterSid,
        fromDate,
        toDate,
      );
    } else {
      items = await Promise.all(
        ledgers.map((ledger) =>
          this.calculateLedgerBalances(
            ledger,
            CompanyMasterSid,
            BranchMasterSid,
            fromDate,
            toDate,
          ),
        ),
      );
    }

 

    // Filter out zero balance ledgers
    const nonZeroItems = items.filter(
      (item) =>
        item.OpeningDebit !== 0 ||
        item.OpeningCredit !== 0 ||
        item.CurrentDebit !== 0 ||
        item.CurrentCredit !== 0,
    );

    // Sort items: Category > Group > SubGroup > Ledger
    const sortedItems = this.sortItems(nonZeroItems);

    // Calculate subtotals if requested
    const subtotals = showSubtotals
      ? this.calculateSubtotals(sortedItems)
      : [];

    // Calculate grand totals
    const grandTotal = this.calculateGrandTotal(sortedItems);

    return {
      success: true,
      parameters: {
        CompanyMasterSid,
        BranchInvolved,
        GroupNameResolved,
        SubGroupNameResolved,
        BranchMasterSid,
        fromDate,
        toDate,
        GroupName,
        SubGroupName,
        showSubtotals,
        SubTotal,
        Subledger
      },
      items: sortedItems,
      subtotals,
      grandTotal,
      totalLedgers: sortedItems.length,
      generatedAt: new Date(),
    };
  }
  
private async calculateWithSubledger(
  ledgers: any[],
  CompanyMasterSid: number,
  BranchMasterSid: number[] | undefined,
  fromDate: string,
  toDate: string,
): Promise<TrialBalanceItemDto[]> {
 
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const results: TrialBalanceItemDto[] = [];
 
  for (const ledger of ledgers) {
 
    const txs = await this.databaseService.voucherTransaction.findMany({
      where: {
        COAMasterSid: ledger.COAMasterSid,
        CompanyMasterSid,
        Status: 'A',
        ...(BranchMasterSid?.length && {
          BranchMasterSid: { in: BranchMasterSid },
        }),
      },
      select: {
        LedgerMasterSid: true,     // ✅ correct field
        VoucherDate: true,
        DrCr: true,
        LocalAmount: true,
        subledgerMaster: {
          select: {
            SubledgerName: true,
          },
        },
      },
    });
 
    // group by LedgerMasterSid (subledger)
    const map = new Map<number | null, typeof txs>();
 
    for (const t of txs) {
      const key = t.LedgerMasterSid ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
 
    map.forEach((list, subSid) => {
 
      const opening = list.filter(t => new Date(t.VoucherDate) < from);
      const current = list.filter(t => {
        const d = new Date(t.VoucherDate);
        return d >= from && d <= to;
      });
 
      const sum = (arr, drcr) =>
        arr.filter(x => x.DrCr === drcr)
           .reduce((s,x)=> s + Number(x.LocalAmount),0);
 
      const openingDebit = sum(opening,'D');
      const openingCredit = sum(opening,'C');
      const currentDebit = sum(current,'D');
      const currentCredit = sum(current,'C');
 
      const closingDebit = openingDebit + currentDebit;
      const closingCredit = openingCredit + currentCredit;
 
      results.push({
        COAMasterSid: ledger.COAMasterSid,
        LedgerCode: ledger.LedgerCode || '',
        LedgerName: ledger.LedgerName || '',
        SubledgerName: list[0]?.subledgerMaster?.SubledgerName || '',
        Category: ledger.Category || '',
        GroupName: ledger.GroupName || '',
        SubGroupName: ledger.SubGroupName || '',
        LedgerType: ledger.LedgerType || '',
        OpeningDebit: openingDebit,
        OpeningCredit: openingCredit,
        CurrentDebit: currentDebit,
        CurrentCredit: currentCredit,
        ClosingDebit: closingDebit,
        ClosingCredit: closingCredit,
        ClosingNet: closingDebit - closingCredit,
      });
 
    });
 
  }
 
  return results;
}
  /**
   * Validate date range
   */
  private validateDates(fromDate: string, toDate: string): void {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (to < from) {
      throw new BadRequestException('To Date must be greater than or equal to From Date');
    }
  }

  /**
   * Validate financial year
   */
  private async validateFinancialYear(
    fromDate: string,
    toDate: string,
    CompanyMasterSid: number,
    YearMasterSid?: number,
  ): Promise<void> {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    let year;

    if (YearMasterSid) {
      // Validate against specific financial year
      year = await this.databaseService.yearMaster.findUnique({
        where: { YearMasterSid },
      });

      if (!year) {
        throw new NotFoundException(`Financial year not found`);
      }
    } else {
      // Find financial year containing the date range
      year = await this.databaseService.yearMaster.findFirst({
        where: {
          CompanyMasterSid,
          status: 'A',
          StartDate: { lte: from },
          EndDate: { gte: to },
        },
      });

      if (!year) {
        throw new BadRequestException(
          'Date range must fall within a single financial year',
        );
      }
    }

    // Ensure both dates are within the same financial year
    if (from < year.StartDate || to > year.EndDate) {
      throw new BadRequestException(
        `Dates must be within financial year ${year.YearName} (${year.StartDate.toISOString().split('T')[0]} to ${year.EndDate.toISOString().split('T')[0]})`,
      );
    }
  }

  /**
   * Get active ledgers with filters
   */
  // private async getLedgers(
  //   CompanyMasterSid: number,
  //   GroupName?: string,
  //   SubGroupName?: string,
  // ) {
  //   return await this.databaseService.cOAMaster.findMany({
  //     where: {
  //       CompanyMasterSid,
  //       Status: 'A',
  //       LedgerCategory: 'Ledger', // Only get ledger-level accounts
  //       ...(GroupName && { GroupName }),
  //       ...(SubGroupName && { SubGroupName }),
  //     },
  //     orderBy: [
  //       { Category: 'asc' },
  //       { GroupName: 'asc' },
  //       { SubGroupName: 'asc' },
  //       { LedgerName: 'asc' },
  //     ],
  //   });
  // }

  
  private async getLedgers(
  CompanyMasterSid: number,
  GroupName?: string | number,
  SubGroupName?: string | number,
) {
  // Ensure string conversion
  const where: any = {
    CompanyMasterSid,
    Status: 'A',
    LedgerCategory: 'Ledger',
  };

  if (GroupName !== undefined && GroupName !== null) {
    const group = await this.databaseService.cOAMaster.findUnique({
      where: { COAMasterSid: Number(GroupName) },
      select: { GroupName: true },
    });

    if (group?.GroupName) {
      where.GroupName = group.GroupName;
    }
  }

  // ✅ Resolve SubGroup ID → Name
  if (SubGroupName !== undefined && SubGroupName !== null) {
    const subGroup = await this.databaseService.cOAMaster.findUnique({
      where: { COAMasterSid: Number(SubGroupName) },
      select: { SubGroupName: true },
    });

    if (subGroup?.SubGroupName) {
      where.SubGroupName = subGroup.SubGroupName;
    }
  }

  return await this.databaseService.cOAMaster.findMany({
    where,
    orderBy: [
      { Category: 'asc' },
      { GroupName: 'asc' },
      { SubGroupName: 'asc' },
      { LedgerName: 'asc' },
    ],
  });
}


  /**
   * Calculate balances for a single ledger
   */
  private async calculateLedgerBalances(
    ledger: any,
    CompanyMasterSid: number,
    BranchMasterSid: number[] | undefined,
    fromDate: string,
    toDate: string,
  ): Promise<TrialBalanceItemDto> {
    const from = new Date(fromDate);
    const to = new Date(toDate);

    // Calculate opening balance (before fromDate)
    const opening = await this.calculateBalance(
      ledger.COAMasterSid,
      CompanyMasterSid,
      BranchMasterSid,
      undefined,
      from,
      true
    );

    // Calculate current period transactions (fromDate to toDate)
    const current = await this.calculateBalance(
      ledger.COAMasterSid,
      CompanyMasterSid,
      BranchMasterSid,
      from,
      to,
    );

    // Calculate closing balances
    const closingDebit = opening.debit + current.debit;
    const closingCredit = opening.credit + current.credit;
    const closingNet = closingDebit - closingCredit;

    return {
      COAMasterSid: ledger.COAMasterSid,
      LedgerCode: ledger.LedgerCode || '',
      LedgerName: ledger.LedgerName || '',
      Category: ledger.Category || '',
      GroupName: ledger.GroupName || '',
      SubGroupName: ledger.SubGroupName || '',
      LedgerType: ledger.LedgerType || '',
      OpeningDebit: opening.debit,
      OpeningCredit: opening.credit,
      CurrentDebit: current.debit,
      CurrentCredit: current.credit,
      ClosingDebit: closingDebit,
      ClosingCredit: closingCredit,
      ClosingNet: closingNet,
    };
  }

  /**
   * Calculate balance for a specific ledger and date range
   */
  private async calculateBalance(
    COAMasterSid: number,
    CompanyMasterSid: number,
    BranchMasterSid: number[] | undefined,
    fromDate?: Date,
    toDate?: Date,
    isOpening ?: boolean
  ): Promise<BalanceCalculation> {
    const transactions = await this.databaseService.voucherTransaction.findMany({
      where: {
        COAMasterSid,
        CompanyMasterSid,
        Status: 'A',
        ...(BranchMasterSid &&
          BranchMasterSid.length > 0 && {
            BranchMasterSid: { in: BranchMasterSid },
          }),
        VoucherDate: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && !isOpening && { lte: toDate }),
          ...(toDate && isOpening && { lt : toDate }),
        },
      },
      select: {
        DrCr: true,
        LocalAmount: true,
      },
    });

    const debit = transactions
      .filter((t) => t.DrCr === 'D')
      .reduce((sum, t) => sum + Number(t.LocalAmount), 0);

    const credit = transactions
      .filter((t) => t.DrCr === 'C')
      .reduce((sum, t) => sum + Number(t.LocalAmount), 0);

    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
    };
  }

  /**
   * Sort items by hierarchy
   */
  private sortItems(items: TrialBalanceItemDto[]): TrialBalanceItemDto[] {
    return items.sort((a, b) => {
      // Sort by Category
      if (a.Category !== b.Category) {
        return a.Category.localeCompare(b.Category);
      }
      // Then by Group
      if (a.GroupName !== b.GroupName) {
        return a.GroupName.localeCompare(b.GroupName);
      }
      // Then by SubGroup
      if (a.SubGroupName !== b.SubGroupName) {
        return (a.SubGroupName || '').localeCompare(b.SubGroupName || '');
      }
      // Finally by Ledger Name
      return a.LedgerName.localeCompare(b.LedgerName);
    });
  }

  /**
   * Calculate subtotals by Group and SubGroup
   */
  private calculateSubtotals(
    items: TrialBalanceItemDto[],
  ): TrialBalanceSubtotalDto[] {
    const subtotals: TrialBalanceSubtotalDto[] = [];
    const groupTotals = new Map<string, TrialBalanceItemDto[]>();
    const subGroupTotals = new Map<string, TrialBalanceItemDto[]>();

    // Group items
    items.forEach((item) => {
      const groupKey = `${item.Category}|${item.GroupName}`;
      if (!groupTotals.has(groupKey)) {
        groupTotals.set(groupKey, []);
      }
      groupTotals.get(groupKey)!.push(item);

      if (item.SubGroupName) {
        const subGroupKey = `${item.Category}|${item.GroupName}|${item.SubGroupName}`;
        if (!subGroupTotals.has(subGroupKey)) {
          subGroupTotals.set(subGroupKey, []);
        }
        subGroupTotals.get(subGroupKey)!.push(item);
      }
    });

    // Calculate SubGroup subtotals
    subGroupTotals.forEach((items, key) => {
      const [category, group, subGroup] = key.split('|');
      subtotals.push(this.createSubtotal('SubGroup', subGroup, items));
    });

    // Calculate Group subtotals
    groupTotals.forEach((items, key) => {
      const [category, group] = key.split('|');
      subtotals.push(this.createSubtotal('Group', group, items));
    });

    return subtotals;
  }

  /**
   * Create a single subtotal
   */
  private createSubtotal(
    type: 'Group' | 'SubGroup',
    name: string,
    items: TrialBalanceItemDto[],
  ): TrialBalanceSubtotalDto {
    const totals = items.reduce(
      (acc, item) => ({
        OpeningDebit: acc.OpeningDebit + item.OpeningDebit,
        OpeningCredit: acc.OpeningCredit + item.OpeningCredit,
        CurrentDebit: acc.CurrentDebit + item.CurrentDebit,
        CurrentCredit: acc.CurrentCredit + item.CurrentCredit,
        ClosingDebit: acc.ClosingDebit + item.ClosingDebit,
        ClosingCredit: acc.ClosingCredit + item.ClosingCredit,
      }),
      {
        OpeningDebit: 0,
        OpeningCredit: 0,
        CurrentDebit: 0,
        CurrentCredit: 0,
        ClosingDebit: 0,
        ClosingCredit: 0,
      },
    );

    return {
      type,
      name,
      ...totals,
      ClosingNet: totals.ClosingDebit - totals.ClosingCredit,
    };
  }

  /**
   * Calculate grand totals
   */
  private calculateGrandTotal(
    items: TrialBalanceItemDto[],
  ): TrialBalanceGrandTotalDto {
    const totals = items.reduce(
      (acc, item) => ({
        TotalOpeningDebit: acc.TotalOpeningDebit + item.OpeningDebit,
        TotalOpeningCredit: acc.TotalOpeningCredit + item.OpeningCredit,
        TotalCurrentDebit: acc.TotalCurrentDebit + item.CurrentDebit,
        TotalCurrentCredit: acc.TotalCurrentCredit + item.CurrentCredit,
        TotalClosingDebit: acc.TotalClosingDebit + item.ClosingDebit,
        TotalClosingCredit: acc.TotalClosingCredit + item.ClosingCredit,
      }),
      {
        TotalOpeningDebit: 0,
        TotalOpeningCredit: 0,
        TotalCurrentDebit: 0,
        TotalCurrentCredit: 0,
        TotalClosingDebit: 0,
        TotalClosingCredit: 0,
      },
    );

    // Round totals to 2 decimal places
    Object.keys(totals).forEach((key) => {
      totals[key] = Math.round(totals[key] * 100) / 100;
    });

    const difference = totals.TotalClosingDebit - totals.TotalClosingCredit;
    const isBalanced = Math.abs(difference) < 0.01; // Allow 1 cent tolerance

    return {
      ...totals,
      IsBalanced: isBalanced,
      Difference: Math.round(difference * 100) / 100,
    };
  }

  /**
   * Create empty grand total
   */
  private createEmptyGrandTotal(): TrialBalanceGrandTotalDto {
    return {
      TotalOpeningDebit: 0,
      TotalOpeningCredit: 0,
      TotalCurrentDebit: 0,
      TotalCurrentCredit: 0,
      TotalClosingDebit: 0,
      TotalClosingCredit: 0,
      IsBalanced: true,
      Difference: 0,
    };
  }
}
