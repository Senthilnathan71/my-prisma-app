import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';

@Injectable()
export class NumberSeriesService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
  ) {}

  /**
   * Get all configurations for a branch
   */
  async getConfigsByBranch(CompanyMasterSid: number, BranchMasterSid: number) {
    return await this._db.numberSeriesConfig.findMany({
      where: {
        CompanyMasterSid,
        BranchMasterSid,
        Status: 'A',
      },
      include: {
        menuMaster: {
          select: {
            MenuMasterSid: true,
            MenuCode: true,
            MenuName: true,
          },
        },
      },
      orderBy: {
        CreatedOn: 'desc',
      },
    });
  }

  /**
   * Get configuration for a specific menu
   */
  async getConfigByMenu(
    CompanyMasterSid: number,
    BranchMasterSid: number,
    MenuMasterSid: number,
  ) {
    return await this._db.numberSeriesConfig.findFirst({
      where: {
        CompanyMasterSid,
        BranchMasterSid,
        MenuMasterSid,
        Status: 'A',
      },
      include: {
        menuMaster: {
          select: {
            MenuMasterSid: true,
            MenuCode: true,
            MenuName: true,
          },
        },
      },
    });
  }

  /**
   * Create or update configuration (upsert)
   */
  async upsertConfig(payload: any) {
    const existing = await this._db.numberSeriesConfig.findFirst({
      where: {
        CompanyMasterSid: payload.CompanyMasterSid,
        BranchMasterSid: payload.BranchMasterSid,
        MenuMasterSid: payload.MenuMasterSid,
      },
    });

    if (existing) {
      return await this._db.numberSeriesConfig.update({
        where: { NumberSeriesConfigSid: existing.NumberSeriesConfigSid },
        data: {
          CompanyFlagRequired: payload.CompanyFlagRequired || 'N',
          CompanyPrefix: payload.CompanyPrefix,
          BranchFlagRequired: payload.BranchFlagRequired || 'N',
          BranchPrefix: payload.BranchPrefix,
          DepartmentCodeRequired: payload.DepartmentCodeRequired || 'N',
          MonthFlagRequired: payload.MonthFlagRequired || 'N',
          YearFlagRequired: payload.YearFlagRequired || 'N',
          Separator: payload.Separator || '/',
          NumberLength: payload.NumberLength || 5,
          ResetOption: payload.ResetOption || 'None',
          DepartmentWiseCounter: payload.DepartmentWiseCounter || 'N',
          StartingNumber: payload.StartingNumber || 1,
          UpdatedBy: payload.UpdatedBy || payload.CreatedBy,
          Status: 'A',
        },
      });
    } else {
      return await this._db.numberSeriesConfig.create({
        data: {
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          MenuMasterSid: payload.MenuMasterSid,
          CompanyFlagRequired: payload.CompanyFlagRequired || 'N',
          CompanyPrefix: payload.CompanyPrefix,
          BranchFlagRequired: payload.BranchFlagRequired || 'N',
          BranchPrefix: payload.BranchPrefix,
          DepartmentCodeRequired: payload.DepartmentCodeRequired || 'N',
          MonthFlagRequired: payload.MonthFlagRequired || 'N',
          YearFlagRequired: payload.YearFlagRequired || 'N',
          Separator: payload.Separator || '/',
          NumberLength: payload.NumberLength || 5,
          ResetOption: payload.ResetOption || 'None',
          DepartmentWiseCounter: payload.DepartmentWiseCounter || 'N',
          StartingNumber: payload.StartingNumber || 1,
          CreatedBy: payload.CreatedBy,
          Status: 'A',
        },
      });
    }
  }

  /**
   * Generate next document number - MAIN METHOD
   * Uses database transaction with serializable isolation for concurrency safety
   */
  async generateNextNumber(
    CompanyMasterSid: number,
    BranchMasterSid: number,
    MenuMasterSid: number,
    DepartmentMasterSid?: number,
  ): Promise<string> {
    this.logger.log(`[NumberSeries] generateNextNumber called with: Company=${CompanyMasterSid}, Branch=${BranchMasterSid}, Menu=${MenuMasterSid}, Dept=${DepartmentMasterSid}`);

    return await this._db.$transaction(
      async (prisma) => {
        // 1. Get configuration for this menu
        this.logger.log(`[NumberSeries] Looking for config with Company=${CompanyMasterSid}, Branch=${BranchMasterSid}, Menu=${MenuMasterSid}`);

        const config = await prisma.numberSeriesConfig.findFirst({
          where: {
            CompanyMasterSid,
            BranchMasterSid,
            MenuMasterSid,
            Status: 'A',
          },
        });

        // Fallback to legacy format if no config exists
        if (!config) {
          this.logger.warn(`[NumberSeries] No config found! Falling back to legacy format. Checking all configs for this menu...`);

          // Debug: Check if config exists with different company/branch
          const allConfigsForMenu = await prisma.numberSeriesConfig.findMany({
            where: { MenuMasterSid, Status: 'A' },
            select: { CompanyMasterSid: true, BranchMasterSid: true, MenuMasterSid: true }
          });
          this.logger.log(`[NumberSeries] All active configs for MenuMasterSid=${MenuMasterSid}: ${JSON.stringify(allConfigsForMenu)}`);

          return await this.generateLegacyNumber(prisma, MenuMasterSid);
        }

        this.logger.log(`[NumberSeries] Config found: ${JSON.stringify({ ConfigSid: config.NumberSeriesConfigSid, CompanyPrefix: config.CompanyPrefix, BranchPrefix: config.BranchPrefix })}`);


        // 2. Get current financial year for company
        const currentYear = await prisma.yearMaster.findFirst({
          where: {
            CompanyMasterSid,
            CurrentYear: 'Y',
            status: 'A',
          },
        });

        // 3. Determine counter key based on reset option
        const now = moment();
        const yearMasterSid =
          config.ResetOption !== 'None' ? currentYear?.YearMasterSid : null;
        const month =
          config.ResetOption === 'Monthly' ? now.month() + 1 : null;

        // If DepartmentWiseCounter='Y', each dept gets own counter
        // If DepartmentWiseCounter='N', DepartmentMasterSid is NULL (shared counter)
        const deptSid =
          config.DepartmentWiseCounter === 'Y' ? DepartmentMasterSid : null;

        // 4. Get or create counter with row-level locking
        let counter = await prisma.numberSeriesCounter.findFirst({
          where: {
            NumberSeriesConfigSid: config.NumberSeriesConfigSid,
            DepartmentMasterSid: deptSid,
            YearMasterSid: yearMasterSid,
            Month: month,
          },
        });

        let nextNumber: number;
        const startingNumber = config.StartingNumber || 1;

        if (!counter) {
          // Create new counter starting at configured StartingNumber
          counter = await prisma.numberSeriesCounter.create({
            data: {
              NumberSeriesConfigSid: config.NumberSeriesConfigSid,
              CompanyMasterSid,
              BranchMasterSid,
              MenuMasterSid,
              DepartmentMasterSid: deptSid,
              YearMasterSid: yearMasterSid,
              Month: month,
              LastNumber: startingNumber,
            },
          });
          nextNumber = startingNumber;
        } else {
          // Check if StartingNumber was updated to be greater than current LastNumber
          // This handles the case where user updates an existing config with a new StartingNumber
          if (startingNumber > counter.LastNumber) {
            // StartingNumber was increased, use it as the next number
            nextNumber = startingNumber;
            this.logger.log(`[NumberSeries] StartingNumber (${startingNumber}) > LastNumber (${counter.LastNumber}), jumping to StartingNumber`);
          } else {
            // Normal increment
            nextNumber = counter.LastNumber + 1;
          }

          await prisma.numberSeriesCounter.update({
            where: {
              NumberSeriesCounterSid: counter.NumberSeriesCounterSid,
            },
            data: { LastNumber: nextNumber },
          });
        }

        // 5. Build the formatted number
        return await this.buildFormattedNumber(
          prisma,
          config,
          nextNumber,
          DepartmentMasterSid,
          currentYear,
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * Preview next number without incrementing counter
   */
  async previewNextNumber(
    CompanyMasterSid: number,
    BranchMasterSid: number,
    MenuMasterSid: number,
    DepartmentMasterSid?: number,
  ): Promise<{ preview: string; nextNumber: number }> {
    const config = await this._db.numberSeriesConfig.findFirst({
      where: {
        CompanyMasterSid,
        BranchMasterSid,
        MenuMasterSid,
        Status: 'A',
      },
    });

    if (!config) {
      const legacyPreview = await this.generateLegacyNumber(
        this._db,
        MenuMasterSid,
      );
      return { preview: legacyPreview, nextNumber: 1 };
    }

    // Get current financial year
    const currentYear = await this._db.yearMaster.findFirst({
      where: {
        CompanyMasterSid,
        CurrentYear: 'Y',
        status: 'A',
      },
    });

    const now = moment();
    const yearMasterSid =
      config.ResetOption !== 'None' ? currentYear?.YearMasterSid : null;
    const month = config.ResetOption === 'Monthly' ? now.month() + 1 : null;
    const deptSid =
      config.DepartmentWiseCounter === 'Y' ? DepartmentMasterSid : null;

    const counter = await this._db.numberSeriesCounter.findFirst({
      where: {
        NumberSeriesConfigSid: config.NumberSeriesConfigSid,
        DepartmentMasterSid: deptSid,
        YearMasterSid: yearMasterSid,
        Month: month,
      },
    });

    const startingNumber = config.StartingNumber || 1;
    let nextNumber: number;

    if (!counter) {
      // No counter exists, use StartingNumber
      nextNumber = startingNumber;
    } else if (startingNumber > counter.LastNumber) {
      // StartingNumber was updated to be greater than current LastNumber
      nextNumber = startingNumber;
    } else {
      // Normal increment
      nextNumber = counter.LastNumber + 1;
    }
    const preview = await this.buildFormattedNumber(
      this._db,
      config,
      nextNumber,
      DepartmentMasterSid,
      currentYear,
    );

    return { preview, nextNumber };
  }

  /**
   * Build formatted number string based on configuration
   */
  private async buildFormattedNumber(
    prisma: any,
    config: any,
    sequenceNumber: number,
    DepartmentMasterSid?: number,
    yearMaster?: any,
  ): Promise<string> {
    const parts: string[] = [];
    const sep = config.Separator || '';
    const now = moment();

    // 1. Company Prefix
    if (config.CompanyFlagRequired === 'Y' && config.CompanyPrefix) {
      parts.push(config.CompanyPrefix);
    }

    // 2. Branch Prefix
    if (config.BranchFlagRequired === 'Y' && config.BranchPrefix) {
      parts.push(config.BranchPrefix);
    }

    // 3. Department Code (fetched from DepartmentMaster)
    if (config.DepartmentCodeRequired === 'Y' && DepartmentMasterSid) {
      const dept = await prisma.departmentMaster.findUnique({
        where: { DepartmentMasterSid },
        select: { departmentCode: true },
      });
      if (dept?.departmentCode) {
        parts.push(dept.departmentCode); // e.g., "LE", "FE", "AE"
      }
    }

    // 4. Month (MM format)
    if (config.MonthFlagRequired === 'Y') {
      parts.push(now.format('MM'));
    }

    // 5. Year (YearCode from YearMaster)
    if (config.YearFlagRequired === 'Y' && yearMaster?.YearCode) {
      parts.push(String(yearMaster.YearCode).slice(-2)); // e.g., "25"
    }

    // 6. Sequence Number (padded to configured length)
    const paddedNumber = sequenceNumber
      .toString()
      .padStart(config.NumberLength || 5, '0');
    parts.push(paddedNumber);

    return parts.join(sep);
  }

  /**
   * Legacy number generation for backward compatibility
   * Used when no NumberSeriesConfig exists
   */
  private async generateLegacyNumber(
    prisma: any,
    MenuMasterSid: number,
  ): Promise<string> {
    const menu = await prisma.menuMaster.findUnique({
      where: { MenuMasterSid },
      select: { MenuCode: true, MenuName: true },
    });

    const dateString = moment().format('YYYYMMDD');
    const prefix = menu?.MenuCode?.toLowerCase() || 'doc';
    return `${prefix}-${dateString}-001`;
  }

  /**
   * Delete configuration (soft delete)
   */
  async deleteConfig(NumberSeriesConfigSid: number, UpdatedBy: string) {
    return await this._db.numberSeriesConfig.update({
      where: { NumberSeriesConfigSid },
      data: {
        Status: 'D',
        UpdatedBy,
      },
    });
  }

  /**
   * Get current financial year for a company
   */
  async getCurrentFinancialYear(CompanyMasterSid: number) {
    return await this._db.yearMaster.findFirst({
      where: {
        CompanyMasterSid,
        CurrentYear: 'Y',
        status: 'A',
      },
    });
  }

  /**
   * Get all counters for a configuration (for debugging/reporting)
   */
  async getCountersByConfig(NumberSeriesConfigSid: number) {
    return await this._db.numberSeriesCounter.findMany({
      where: { NumberSeriesConfigSid },
      include: {
        departmentMaster: {
          select: {
            departmentCode: true,
            departmentName: true,
          },
        },
        yearMaster: {
          select: {
            YearCode: true,
            YearName: true,
          },
        },
      },
      orderBy: {
        CreatedOn: 'desc',
      },
    });
  }

  /**
   * Debug: Get ALL number series configs across all companies/branches
   */
  async getAllConfigsDebug() {
    return await this._db.numberSeriesConfig.findMany({
      where: { Status: 'A' },
      include: {
        menuMaster: {
          select: {
            MenuMasterSid: true,
            MenuCode: true,
            MenuName: true,
          },
        },
        companyMaster: {
          select: {
            CompanyMasterSid: true,
            // CompanyName: true,
          },
        },
        branchMaster: {
          select: {
            BranchMasterSid: true,
            // BranchName: true,
          },
        },
      },
      orderBy: { CreatedOn: 'desc' },
    });
  }

  /**
   * Reset counter (for admin use or year-end procedures)
   */
  async resetCounter(
    CompanyMasterSid: number,
    BranchMasterSid: number,
    MenuMasterSid: number,
    DepartmentMasterSid?: number,
  ) {
    const config = await this._db.numberSeriesConfig.findFirst({
      where: {
        CompanyMasterSid,
        BranchMasterSid,
        MenuMasterSid,
        Status: 'A',
      },
    });

    if (!config) {
      throw new NotFoundException('Number series configuration not found');
    }

    const currentYear = await this._db.yearMaster.findFirst({
      where: {
        CompanyMasterSid,
        CurrentYear: 'Y',
        status: 'A',
      },
    });

    const now = moment();
    const yearMasterSid =
      config.ResetOption !== 'None' ? currentYear?.YearMasterSid : null;
    const month = config.ResetOption === 'Monthly' ? now.month() + 1 : null;
    const deptSid =
      config.DepartmentWiseCounter === 'Y' ? DepartmentMasterSid : null;

    // Reset to StartingNumber - 1 so the next generated number will be StartingNumber
    // Using max(0, StartingNumber - 1) to handle edge case where StartingNumber is 1
    const resetValue = Math.max(0, (config.StartingNumber || 1) - 1);

    return await this._db.numberSeriesCounter.updateMany({
      where: {
        NumberSeriesConfigSid: config.NumberSeriesConfigSid,
        DepartmentMasterSid: deptSid,
        YearMasterSid: yearMasterSid,
        Month: month,
      },
      data: { LastNumber: resetValue },
    });
  }
}
