import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  CreateJournalVoucherDto,
  UpdateJournalVoucherDto,
  JournalVoucherListQueryDto,
  JournalVoucherResponseDto,
} from '../../dto/journal-voucher.dto';

@Injectable()
export class JournalVoucherService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a new journal voucher in draft mode
   */
  async create(
    createDto: CreateJournalVoucherDto,
  ): Promise<JournalVoucherResponseDto> {
    const {
      CompanyMasterSid,
      BranchMasterSid,
      VoucherDate,
      Narration,
      Remarks,
      Status,
      details,
    } = createDto;

    // Validate financial year
    await this.validateFinancialYear(VoucherDate, CompanyMasterSid);

    // Validate debit/credit balance
    this.validateDebitCreditBalance(details);

    // Generate voucher number
    const voucherNumber = await this.generateVoucherNumber(
      CompanyMasterSid,
      BranchMasterSid,
      VoucherDate,
    );

    // Get voucher type for Journal Voucher
    const voucherType = await this.getJournalVoucherType(CompanyMasterSid);

    // Calculate totals
    const { debitTotal, creditTotal, totalAmount, totalLocalAmount } =
      this.calculateTotals(details);

    // Process tax lines based on company country
    const processedDetails = await this.processTaxLines(
      details,
      CompanyMasterSid,
      BranchMasterSid,
    );

    // Create voucher header and details in transaction
    const result = await this.databaseService.$transaction(async (prisma) => {
      // Create header
      const header = await prisma.voucherHeader.create({
        data: {
          CompanyMasterSid,
          BranchMasterSid,
          VoucherNumber: voucherNumber,
          VoucherType: voucherType.VoucherTypeMasterSid,
          VoucherDate: new Date(VoucherDate),
          PostDate: new Date(VoucherDate), // Default to voucher date
          VoucherTypeMasterSid: voucherType.VoucherTypeMasterSid,
          PartyMasterSid: 0, // Required - 0 for journal voucher
          PartyName: '', // Required field - empty for journal voucher
          COAMasterSid: 0, // Required - 0 for journal voucher
          PostStatus: 'U', // Unposted
          SetoffStatus: 'Draft',
          Amount: totalAmount,
          LocalAmount: totalLocalAmount,
          Narration: Narration || '',
          Remarks: Remarks || null,
          Status: Status || 'Active',
          CreatedBy: '1', // TODO: Get from auth context
          CreatedOn: new Date(),
        },
      });

      // Create details
      const createdDetails = await Promise.all(
        processedDetails.map((detail, index) =>
          prisma.voucherDetail.create({
            data: {
              VoucherHeaderSid: header.VoucherHeaderSid,
              CompanyMasterSid: CompanyMasterSid,
              BranchMasterSid: BranchMasterSid,
              Sno: index + 1,
              COAMasterSid: detail.COAMasterSid,
              LedgerMasterSid: detail.LedgerMasterSid || null,
              CurrencyMasterSid: detail.CurrencyMasterSid,
              CurrencyCode: detail.CurrencyCode || null,
              ExchangeRate: detail.ExchangeRate,
              Rate: detail.ExchangeRate, // Same as exchange rate
              Amount: detail.Amount,
              TaxableAmount: detail.LocalAmount, // Taxable amount is local amount
              LocalAmount: detail.LocalAmount,
              DrCr: detail.DrCr,
              Narration: detail.Narration || null,
              DepartmentMasterSid: detail.DepartmentMasterSid || null,
              ChargeMasterSid: detail.ChargeMasterSid || null,
              ChargeDescription: detail.ChargeDescription || null,
              MasterJobSid: detail.MasterJobSid || null,
              HouseJobSid: detail.HouseJobSid || null,
              TaxPercentage1: detail.TaxPercentage1 || null,
              TaxAmount1: detail.TaxAmount1 || null,
              TaxPercentage2: detail.TaxPercentage2 || null,
              TaxAmount2: detail.TaxAmount2 || null,
              CostCenter: detail.CostCenterMasterSid || null,
              ProfitCenter: detail.ProfitCenterMasterSid || null,
              Status: 'Active',
              CreatedBy: '1', // TODO: Get from auth context
              CreatedOn: new Date(),
            },
          }),
        ),
      );

      return { header, details: createdDetails };
    });

    return this.mapToResponseDto(result.header, result.details);
  }

  /**
   * Get journal voucher by ID
   */
  async findById(id: number, companyMasterSid: number, branchMasterSid: number): Promise<JournalVoucherResponseDto> {
    const voucher = await this.databaseService.voucherHeader.findFirst({
      where: {
        VoucherHeaderSid: id,
        CompanyMasterSid: companyMasterSid,
        BranchMasterSid: branchMasterSid,
      },
      include: {
        VoucherDetail: {
          orderBy: { Sno: 'asc' },
        },
        CompanyMaster: true,
        BranchMaster: true,
      },
    });

    if (!voucher) {
      throw new NotFoundException(`Journal voucher with ID ${id} not found`);
    }

    return this.mapToResponseDto(voucher, voucher.VoucherDetail);
  }

  /**
   * List journal vouchers with pagination and filters
   */
  async findAll(query: JournalVoucherListQueryDto) {
    const {
      CompanyMasterSid,
      BranchMasterSid,
      page = 1,
      limit = 20,
      voucherNumber,
      fromDate,
      toDate,
      postStatus,
      searchTerm,
    } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      CompanyMasterSid,
      BranchMasterSid,
    };

    if (voucherNumber) {
      where.VoucherNumber = { contains: voucherNumber };
    }

    if (fromDate || toDate) {
      where.VoucherDate = {};
      if (fromDate) where.VoucherDate.gte = new Date(fromDate);
      if (toDate) where.VoucherDate.lte = new Date(toDate);
    }

    if (postStatus) {
      where.PostStatus = postStatus;
    }

    if (searchTerm) {
      where.OR = [
        { VoucherNumber: { contains: searchTerm } },
        { Narration: { contains: searchTerm } },
        { Remarks: { contains: searchTerm } },
      ];
    }

    const [vouchers, total] = await Promise.all([
      this.databaseService.voucherHeader.findMany({
        where,
        include: {
          VoucherDetail: {
            orderBy: { Sno: 'asc' },
          },
        },
        orderBy: { VoucherDate: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.voucherHeader.count({ where }),
    ]);

    const data = vouchers.map((v) => this.mapToResponseDto(v, v.VoucherDetail));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update journal voucher (only unposted vouchers can be updated)
   */
  async update(
    id: number,
    updateDto: UpdateJournalVoucherDto,
    companyMasterSid: number,
    branchMasterSid: number,
  ): Promise<JournalVoucherResponseDto> {
    // Check if voucher exists and is unposted
    const existing = await this.databaseService.voucherHeader.findFirst({
      where: {
        VoucherHeaderSid: id,
        CompanyMasterSid: companyMasterSid,
        BranchMasterSid: branchMasterSid,
      },
      include: { VoucherDetail: true },
    });

    if (!existing) {
      throw new NotFoundException(`Journal voucher with ID ${id} not found`);
    }

    if (existing.PostStatus === 'P') {
      throw new BadRequestException('Cannot update posted voucher');
    }

    const { VoucherDate, Narration, Remarks, Status, details } = updateDto;

    // If voucher date is being updated, validate financial year
    if (VoucherDate) {
      await this.validateFinancialYear(
        VoucherDate,
        existing.CompanyMasterSid,
      );
    }

    // If details are being updated, validate balance
    if (details) {
      this.validateDebitCreditBalance(details);

      // Process tax lines
      const processedDetails = await this.processTaxLines(
        details,
        existing.CompanyMasterSid,
        existing.BranchMasterSid,
      );

      const { debitTotal, creditTotal, totalAmount, totalLocalAmount } =
        this.calculateTotals(processedDetails);

      // Update in transaction
      const result = await this.databaseService.$transaction(async (prisma) => {
        // Delete existing details
        await prisma.voucherDetail.deleteMany({
          where: { VoucherHeaderSid: id },
        });

        // Update header
        const header = await prisma.voucherHeader.update({
          where: { VoucherHeaderSid: id },
          data: {
            VoucherDate: VoucherDate ? new Date(VoucherDate) : undefined,
            Narration: Narration !== undefined ? Narration : undefined,
            Remarks: Remarks !== undefined ? Remarks : undefined,
            Status: Status !== undefined ? Status : undefined,
            Amount: totalAmount,
            LocalAmount: totalLocalAmount,
            UpdatedBy: '1', // TODO: Get from auth context
            UpdatedOn: new Date(),
          },
        });

        // Create new details
        const createdDetails = await Promise.all(
          processedDetails.map((detail, index) =>
            prisma.voucherDetail.create({
              data: {
                VoucherHeaderSid: id,
                CompanyMasterSid: existing.CompanyMasterSid,
                BranchMasterSid: existing.BranchMasterSid,
                Sno: index + 1,
                COAMasterSid: detail.COAMasterSid,
                LedgerMasterSid: detail.LedgerMasterSid || null,
                CurrencyMasterSid: detail.CurrencyMasterSid,
                CurrencyCode: detail.CurrencyCode || null,
                ExchangeRate: detail.ExchangeRate,
                Rate: detail.ExchangeRate, // Same as exchange rate
                Amount: detail.Amount,
                TaxableAmount: detail.LocalAmount, // Taxable amount is local amount
                LocalAmount: detail.LocalAmount,
                DrCr: detail.DrCr,
                Narration: detail.Narration || null,
                DepartmentMasterSid: detail.DepartmentMasterSid || null,
                ChargeMasterSid: detail.ChargeMasterSid || null,
                ChargeDescription: detail.ChargeDescription || null,
                MasterJobSid: detail.MasterJobSid || null,
                HouseJobSid: detail.HouseJobSid || null,
                TaxPercentage1: detail.TaxPercentage1 || null,
                TaxAmount1: detail.TaxAmount1 || null,
                TaxPercentage2: detail.TaxPercentage2 || null,
                TaxAmount2: detail.TaxAmount2 || null,
                CostCenter: detail.CostCenterMasterSid || null,
                ProfitCenter: detail.ProfitCenterMasterSid || null,
                Status: 'Active',
                CreatedBy: '1', // TODO: Get from auth context
                CreatedOn: new Date(),
              },
            }),
          ),
        );

        return { header, details: createdDetails };
      });

      return this.mapToResponseDto(result.header, result.details);
    } else {
      // Update header only
      const header = await this.databaseService.voucherHeader.update({
        where: { VoucherHeaderSid: id },
        data: {
          VoucherDate: VoucherDate ? new Date(VoucherDate) : undefined,
          Narration: Narration !== undefined ? Narration : undefined,
          Remarks: Remarks !== undefined ? Remarks : undefined,
          Status: Status !== undefined ? Status : undefined,
          UpdatedBy: '1', // TODO: Get from auth context
          UpdatedOn: new Date(),
        },
        include: { VoucherDetail: true },
      });

      return this.mapToResponseDto(header, header.VoucherDetail);
    }
  }

  /**
   * Delete journal voucher (only unposted vouchers can be deleted)
   */
  async delete(id: number, companyMasterSid: number, branchMasterSid: number): Promise<{ message: string }> {
    const existing = await this.databaseService.voucherHeader.findFirst({
      where: {
        VoucherHeaderSid: id,
        CompanyMasterSid: companyMasterSid,
        BranchMasterSid: branchMasterSid,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Journal voucher with ID ${id} not found`);
    }

    if (existing.PostStatus === 'P') {
      throw new BadRequestException('Cannot delete posted voucher');
    }

    await this.databaseService.$transaction(async (prisma) => {
      // Delete details first (foreign key constraint)
      await prisma.voucherDetail.deleteMany({
        where: { VoucherHeaderSid: id },
      });

      // Delete header
      await prisma.voucherHeader.delete({
        where: { VoucherHeaderSid: id },
      });
    });

    return { message: 'Journal voucher deleted successfully' };
  }

  /**
   * Validate financial year
   */
  private async validateFinancialYear(
    voucherDate: string,
    companyMasterSid: number,
  ): Promise<void> {
    const date = new Date(voucherDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if voucher date is not in future
    if (date > today) {
      throw new BadRequestException(
        'Voucher date cannot be in the future. Please select today or a past date.',
      );
    }

    // Check if voucher date falls within an active financial year
    const year = await this.databaseService.yearMaster.findFirst({
      where: {
        CompanyMasterSid: companyMasterSid,
        StartDate: { lte: date },
        EndDate: { gte: date },
        CurrentYear: 'Y',
      },
    });

    if (!year) {
      throw new BadRequestException(
        'Voucher date must be within the current financial year range.',
      );
    }
  }

  /**
   * Validate debit/credit balance
   */
  private validateDebitCreditBalance(details: any[]): void {
    const debitTotal = details
      .filter((d) => d.DrCr === 'D')
      .reduce((sum, d) => sum + d.LocalAmount, 0);

    const creditTotal = details
      .filter((d) => d.DrCr === 'C')
      .reduce((sum, d) => sum + d.LocalAmount, 0);

    const difference = Math.abs(debitTotal - creditTotal);

    if (difference > 0.01) {
      // Allow 0.01 tolerance for floating point
      throw new BadRequestException(
        `Debit and Credit totals must be equal. Debit: ${debitTotal.toFixed(2)}, Credit: ${creditTotal.toFixed(2)}, Difference: ${difference.toFixed(2)}`,
      );
    }
  }

  /**
   * Generate voucher number
   */
  private async generateVoucherNumber(
    companyMasterSid: number,
    branchMasterSid: number,
    voucherDate: string,
  ): Promise<string> {
    const voucherType = await this.getJournalVoucherType(companyMasterSid);

    if (!voucherType) {
      throw new NotFoundException('Journal Voucher type not configured');
    }

    const {
      DocumentTypeCode,
      DocumentStartingNo,
      DocumentSLNoLength,
      BranchFlag,
    } = voucherType;

    // Get last voucher number
    const lastVoucher = await this.databaseService.voucherHeader.findFirst({
      where: {
        CompanyMasterSid: companyMasterSid,
        VoucherTypeMasterSid: voucherType.VoucherTypeMasterSid,
        ...(BranchFlag === 'Y' ? { BranchMasterSid: branchMasterSid } : {}),
      },
      orderBy: { VoucherHeaderSid: 'desc' },
    });

    let nextNumber = Number(DocumentStartingNo) || 1;

    if (lastVoucher && lastVoucher.VoucherNumber) {
      // Extract number from last voucher
      const match = lastVoucher.VoucherNumber.match(/\d+$/);
      if (match) {
        nextNumber = parseInt(match[0]) + 1;
      }
    }

    // Apply reset logic (if needed, based on financial year, month, etc.)
    // For simplicity, we'll just increment

    // Format number with padding
    const paddedNumber = String(nextNumber).padStart(Number(DocumentSLNoLength) || 4, '0');

    return `${DocumentTypeCode}${paddedNumber}`;
  }

  /**
   * Get Journal Voucher type configuration
   */
  private async getJournalVoucherType(companyMasterSid: number) {
    const voucherType = await this.databaseService.voucherTypeMaster.findFirst({
      where: {
        CompanyMasterSid: companyMasterSid,
        DocumentTypeCode: 'JV',
      },
    });

    if (!voucherType) {
      throw new NotFoundException(
        'Journal Voucher type is not configured in VoucherTypeMaster',
      );
    }

    return voucherType;
  }

  /**
   * Calculate totals
   */
  private calculateTotals(details: any[]) {
    const debitTotal = details
      .filter((d) => d.DrCr === 'D')
      .reduce((sum, d) => sum + d.LocalAmount, 0);

    const creditTotal = details
      .filter((d) => d.DrCr === 'C')
      .reduce((sum, d) => sum + d.LocalAmount, 0);

    const totalAmount = details.reduce((sum, d) => sum + d.Amount, 0);
    const totalLocalAmount = details.reduce(
      (sum, d) => sum + d.LocalAmount,
      0,
    );

    return { debitTotal, creditTotal, totalAmount, totalLocalAmount };
  }

  /**
   * Process tax lines based on company country
   */
  private async processTaxLines(
    details: any[],
    companyMasterSid: number,
    branchMasterSid: number,
  ): Promise<any[]> {
    // Get company country
    const company = await this.databaseService.companyMaster.findUnique({
      where: { CompanyMasterSid: companyMasterSid },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const country = company.CountryMasterSid;

    // Get country name for tax logic
    let countryName = '';
    if (country) {
      const countryMaster = await this.databaseService.countryMaster.findUnique({
        where: { CountryMasterSid: country },
      });
      countryName = countryMaster?.countryName?.toUpperCase() || '';
    }

    const processedDetails: any[] = [];

    for (const detail of details) {
      // Add the main detail line
      processedDetails.push(detail);

      // If this detail has tax and is not already a tax line
      if (
        detail.ChargeMasterSid &&
        detail.TaxPercentage1 &&
        !detail.isAutoTaxLine
      ) {
        // Get COA for tax ledgers (need to be configured in system)
        const taxCOAs = await this.getTaxCOAs(companyMasterSid, countryName);

        // India: CGST/SGST or IGST
        if (countryName === 'INDIA') {
          const isInterstate = await this.checkInterstate(
            company,
            detail.LedgerMasterSid,
          );

          if (isInterstate) {
            // IGST
            const igstAmount =
              (detail.LocalAmount * (detail.TaxPercentage1 || 0)) / 100;
            if (igstAmount > 0 && taxCOAs.IGST) {
              processedDetails.push({
                ...detail,
                COAMasterSid: taxCOAs.IGST,
                Amount: igstAmount / detail.ExchangeRate,
                LocalAmount: igstAmount,
                TaxPercentage1: null,
                TaxAmount1: null,
                TaxPercentage2: null,
                TaxAmount2: null,
                Narration: `IGST @ ${detail.TaxPercentage1}%`,
                isAutoTaxLine: true,
              });
            }
          } else {
            // CGST + SGST (split equally)
            const halfTax = (detail.TaxPercentage1 || 0) / 2;
            const cgstAmount = (detail.LocalAmount * halfTax) / 100;
            const sgstAmount = (detail.LocalAmount * halfTax) / 100;

            if (cgstAmount > 0 && taxCOAs.CGST) {
              processedDetails.push({
                ...detail,
                COAMasterSid: taxCOAs.CGST,
                Amount: cgstAmount / detail.ExchangeRate,
                LocalAmount: cgstAmount,
                TaxPercentage1: null,
                TaxAmount1: null,
                TaxPercentage2: null,
                TaxAmount2: null,
                Narration: `CGST @ ${halfTax}%`,
                isAutoTaxLine: true,
              });
            }

            if (sgstAmount > 0 && taxCOAs.SGST) {
              processedDetails.push({
                ...detail,
                COAMasterSid: taxCOAs.SGST,
                Amount: sgstAmount / detail.ExchangeRate,
                LocalAmount: sgstAmount,
                TaxPercentage1: null,
                TaxAmount1: null,
                TaxPercentage2: null,
                TaxAmount2: null,
                Narration: `SGST @ ${halfTax}%`,
                isAutoTaxLine: true,
              });
            }
          }
        } else if (
          countryName.includes('UAE') ||
          countryName.includes('DUBAI') ||
          countryName.includes('EMIRATES')
        ) {
          // VAT for UAE/Middle East
          const vatAmount =
            (detail.LocalAmount * (detail.TaxPercentage1 || 0)) / 100;
          if (vatAmount > 0 && taxCOAs.VAT) {
            processedDetails.push({
              ...detail,
              COAMasterSid: taxCOAs.VAT,
              Amount: vatAmount / detail.ExchangeRate,
              LocalAmount: vatAmount,
              TaxPercentage1: null,
              TaxAmount1: null,
              TaxPercentage2: null,
              TaxAmount2: null,
              Narration: `VAT @ ${detail.TaxPercentage1}%`,
              isAutoTaxLine: true,
            });
          }
        }
      }
    }

    return processedDetails;
  }

  /**
   * Check if transaction is interstate (India)
   * NOTE: StateMasterSid doesn't exist in SubledgerMaster schema
   * This is a simplified implementation - returns false (intrastate) by default
   * TODO: Implement proper state checking when state information is available
   */
  private async checkInterstate(
    company: any,
    ledgerMasterSid?: number,
  ): Promise<boolean> {
    // Simplified implementation - always return false (use CGST+SGST)
    // In production, state information should come from a related table or different source
    return false;
  }

  /**
   * Get tax COA mappings based on country
   */
  private async getTaxCOAs(companyMasterSid: number, countryName: string) {
    // In a production system, these should be configured in VoucherTypeMaster or a separate tax configuration table
    // For now, we'll fetch by ledger name pattern

    const coaList = await this.databaseService.cOAMaster.findMany({
      where: {
        CompanyMasterSid: companyMasterSid,
        Status: 'Active',
      },
    });

    const result: any = {};

    if (countryName === 'INDIA') {
      result.CGST = coaList.find((c) =>
        c.LedgerName?.toUpperCase().includes('CGST'),
      )?.COAMasterSid;
      result.SGST = coaList.find((c) =>
        c.LedgerName?.toUpperCase().includes('SGST'),
      )?.COAMasterSid;
      result.IGST = coaList.find((c) =>
        c.LedgerName?.toUpperCase().includes('IGST'),
      )?.COAMasterSid;
    } else {
      result.VAT = coaList.find((c) =>
        c.LedgerName?.toUpperCase().includes('VAT'),
      )?.COAMasterSid;
    }

    return result;
  }

  /**
   * Map to response DTO
   */
  private mapToResponseDto(header: any, details: any[]): JournalVoucherResponseDto {
    const debitTotal = details
      .filter((d) => d.DrCr === 'D')
      .reduce((sum, d) => sum + (d.LocalAmount || 0), 0);

    const creditTotal = details
      .filter((d) => d.DrCr === 'C')
      .reduce((sum, d) => sum + (d.LocalAmount || 0), 0);

    const isBalanced = Math.abs(debitTotal - creditTotal) <= 0.01;

    return {
      VoucherHeaderSid: header.VoucherHeaderSid,
      VoucherNumber: header.VoucherNumber,
      VoucherDate: header.VoucherDate,
      PostDate: header.PostDate,
      PostStatus: header.PostStatus,
      Narration: header.Narration,
      Remarks: header.Remarks,
      Status: header.Status,
      Amount: header.Amount || 0,
      LocalAmount: header.LocalAmount || 0,
      details: details,
      DebitTotal: debitTotal,
      CreditTotal: creditTotal,
      IsBalanced: isBalanced,
    };
  }
}
