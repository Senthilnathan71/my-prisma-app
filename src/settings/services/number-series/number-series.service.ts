import {
  BadRequestException,
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

  /** Maximum allowed total length of a generated document number. */
  private readonly MAX_DOC_LENGTH = 35;

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
    // Restrict the configured format so generated numbers stay within the cap.
    const estimatedLength = this.estimateFormattedLength(payload);
    if (estimatedLength > this.MAX_DOC_LENGTH) {
      throw new BadRequestException(
        `Document number format is ${estimatedLength} characters; the maximum allowed is ${this.MAX_DOC_LENGTH}. Please remove some components or reduce the sequence length.`,
      );
    }

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
          OperationFlagRequired: payload.OperationFlagRequired || 'N',
          OperationCode: payload.OperationCode ?? null,
          POLPODFlagRequired: payload.POLPODFlagRequired ?? 'N',
          POLPODMode: payload.POLPODMode || 'BOTH',
          POLPODPortWiseCounter: payload.POLPODPortWiseCounter ?? 'Y',
          DepartmentCodeRequired: payload.DepartmentCodeRequired || 'N',
          MonthFlagRequired: payload.MonthFlagRequired || 'N',
          YearFlagRequired: payload.YearFlagRequired || 'N',
          Separator:payload.Separator !== null && payload.Separator !== undefined ? payload.Separator : '/',

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
          OperationFlagRequired: payload.OperationFlagRequired || 'N',
          OperationCode: payload.OperationCode ?? null,
          POLPODFlagRequired: payload.POLPODFlagRequired ?? 'N',
          POLPODMode: payload.POLPODMode || 'BOTH',
          POLPODPortWiseCounter: payload.POLPODPortWiseCounter ?? 'Y',
          DepartmentCodeRequired: payload.DepartmentCodeRequired || 'N',
          MonthFlagRequired: payload.MonthFlagRequired || 'N',
          YearFlagRequired: payload.YearFlagRequired || 'N',
          Separator: payload.Separator !== null && payload.Separator !== undefined ? payload.Separator : '/',
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
   *
   * Pass `tx` (the caller's open Prisma transaction client) to make the counter
   * increment commit/roll back WITH the document being saved — a failed save
   * then never burns a sequence number. Without `tx`, the increment runs in its
   * own serializable transaction (legacy behaviour, e.g. booking).
   */
  async generateNextNumber(
    CompanyMasterSid: number,
    BranchMasterSid: number,
    MenuMasterSid: number,
    DepartmentMasterSid?: number,
    documentDate?: Date,
    POLSid?: number,
    PODSid?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    this.logger.log(`[NumberSeries] generateNextNumber called with: Company=${CompanyMasterSid}, Branch=${BranchMasterSid}, Menu=${MenuMasterSid}, Dept=${DepartmentMasterSid}, InCallerTx=${!!tx}`);

    const core = async (prisma: Prisma.TransactionClient) => {
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
          // this.logger.warn(`[NumberSeries] No config found! Falling back to legacy format. Checking all configs for this menu...`);

          // // Debug: Check if config exists with different company/branch
          // const allConfigsForMenu = await prisma.numberSeriesConfig.findMany({
          //   where: { MenuMasterSid, Status: 'A' },
          //   select: { CompanyMasterSid: true, BranchMasterSid: true, MenuMasterSid: true }
          // });
          // this.logger.log(`[NumberSeries] All active configs for MenuMasterSid=${MenuMasterSid}: ${JSON.stringify(allConfigsForMenu)}`);

          // return await this.generateLegacyNumber(prisma, MenuMasterSid);
          throw new BadRequestException ('No configuration found for this menu.\nPlease configure it in the Operation Document Number settings.')
        }

        this.logger.log(`[NumberSeries] Config found: ${JSON.stringify({ ConfigSid: config.NumberSeriesConfigSid, CompanyPrefix: config.CompanyPrefix, BranchPrefix: config.BranchPrefix })}`);


        // 2. Determine reference date from document date or current date
        const now = documentDate ? moment(documentDate) : moment();

        // 3. Get financial year for the reference date
        const currentYear = await this.findFinancialYear(
          prisma,
          CompanyMasterSid,
          now,
        );

        // 4. Determine counter key based on reset option
        const yearMasterSid =
          config.ResetOption !== 'None' ? currentYear?.YearMasterSid : null;
        const month =
          config.ResetOption === 'Monthly' ? now.month() + 1 : null;

        // If DepartmentWiseCounter='Y', each dept gets own counter
        // If DepartmentWiseCounter='N', DepartmentMasterSid is NULL (shared counter)
        const deptSid =
          config.DepartmentWiseCounter === 'Y' ? DepartmentMasterSid : null;

        // Resolve port codes and counter key Sids for POL/POD flag (honours POLPODMode)
        // polSid/podSid are included in counter key only when PortWiseCounter='Y' (Case I)
        // When PortWiseCounter='N' (Case II), sids are null → shared counter, but port codes still appear in the number
        const { polSid, podSid, polCode, podCode } =
          await this.resolvePortSegment(prisma, config, POLSid, PODSid);

        // 4. Bump the counter atomically — one UPDATE that row-locks ONLY this
        // counter row; the lock is held until the surrounding transaction ends,
        // so concurrent savers on the same series queue instead of clashing.
        const startingNumber = config.StartingNumber || 1;
        const counterKey = {
          NumberSeriesConfigSid: config.NumberSeriesConfigSid,
          DepartmentMasterSid: deptSid ?? null,
          YearMasterSid: yearMasterSid ?? null,
          Month: month ?? null,
          POLSid: polSid ?? null,
          PODSid: podSid ?? null,
        };
        let nextNumber = await this.bumpCounter(prisma, counterKey, startingNumber);

        if (nextNumber === null) {
          // First generation for this counter key. The unique index cannot
          // block concurrent creates when key columns are NULL (Postgres
          // treats NULLs as distinct), so serialize the create per config via
          // a transaction-scoped advisory lock, then re-check under the lock.
          await prisma.$queryRaw`SELECT pg_advisory_xact_lock(${NumberSeriesService.COUNTER_LOCK_NS}::int, ${config.NumberSeriesConfigSid}::int)`;
          nextNumber = await this.bumpCounter(prisma, counterKey, startingNumber);
          if (nextNumber === null) {
            await prisma.numberSeriesCounter.create({
              data: {
                ...counterKey,
                CompanyMasterSid,
                BranchMasterSid,
                MenuMasterSid,
                LastNumber: startingNumber,
              },
            });
            nextNumber = startingNumber;
          }
        }

        // 5. Build the formatted number
        const formatted = await this.buildFormattedNumber(
          prisma,
          config,
          nextNumber,
          DepartmentMasterSid,
          currentYear,
          documentDate,
          polCode,
          podCode,
        );

        // Backstop: never emit a document number longer than the cap
        if (formatted.length > this.MAX_DOC_LENGTH) {
          throw new BadRequestException(
            `Generated document number "${formatted}" is ${formatted.length} characters, exceeding the maximum of ${this.MAX_DOC_LENGTH}. Please adjust the Operation Doc Number settings for this menu.`,
          );
        }

        return formatted;
    };

    if (tx) {
      // Caller-owned atomicity: the counter bump rides the caller's
      // transaction and rolls back with it — no burned numbers.
      return await core(tx);
    }

    return await this._db.$transaction(core, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  /** Advisory-lock namespace for number-series counter creation (arbitrary, app-unique). */
  private static readonly COUNTER_LOCK_NS = 748291;

  /**
   * Atomically increment a counter and return the new value, or null when no
   * counter row exists yet for this key. GREATEST keeps the existing
   * "jump to a raised StartingNumber" rule.
   */
  private async bumpCounter(
    prisma: Prisma.TransactionClient,
    key: {
      NumberSeriesConfigSid: number;
      DepartmentMasterSid: number | null;
      YearMasterSid: number | null;
      Month: number | null;
      POLSid: number | null;
      PODSid: number | null;
    },
    startingNumber: number,
  ): Promise<number | null> {
    const rows = await prisma.$queryRaw<{ LastNumber: number }[]>`
      UPDATE "NumberSeriesCounter"
         SET "LastNumber" = GREATEST("LastNumber" + 1, ${startingNumber}::int),
             "UpdatedOn"  = NOW()
       WHERE "NumberSeriesConfigSid" = ${key.NumberSeriesConfigSid}
         AND "DepartmentMasterSid" IS NOT DISTINCT FROM ${key.DepartmentMasterSid}::int
         AND "YearMasterSid"       IS NOT DISTINCT FROM ${key.YearMasterSid}::int
         AND "Month"               IS NOT DISTINCT FROM ${key.Month}::int
         AND "POLSid"              IS NOT DISTINCT FROM ${key.POLSid}::int
         AND "PODSid"              IS NOT DISTINCT FROM ${key.PODSid}::int
       RETURNING "LastNumber"`;
    return rows.length > 0 ? Number(rows[0].LastNumber) : null;
  }

  /**
   * Preview next number without incrementing counter
   */
  async previewNextNumber(
    CompanyMasterSid: number,
    BranchMasterSid: number,
    MenuMasterSid: number,
    DepartmentMasterSid?: number,
    documentDate?: Date,
    POLSid?: number,
    PODSid?: number,
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

    // Determine reference date from document date or current date
    const now = documentDate ? moment(documentDate) : moment();

    // Get financial year for the reference date
    const currentYear = await this.findFinancialYear(
      this._db,
      CompanyMasterSid,
      now,
    );
    const yearMasterSid =
      config.ResetOption !== 'None' ? currentYear?.YearMasterSid : null;
    const month = config.ResetOption === 'Monthly' ? now.month() + 1 : null;
    const deptSid =
      config.DepartmentWiseCounter === 'Y' ? DepartmentMasterSid : null;

    // Resolve port codes for POL/POD flag (honours POLPODMode)
    const { polSid, podSid, polCode, podCode } =
      await this.resolvePortSegment(this._db, config, POLSid, PODSid);

    const counter = await this._db.numberSeriesCounter.findFirst({
      where: {
        NumberSeriesConfigSid: config.NumberSeriesConfigSid,
        DepartmentMasterSid: deptSid,
        YearMasterSid: yearMasterSid,
        Month: month,
        POLSid: polSid,
        PODSid: podSid,
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
      documentDate,
      polCode,
      podCode,
    );

    return { preview, nextNumber };
  }

  /**
   * Estimate the formatted-number length for a config payload using the same
   * placeholder widths as the live preview (ports = 3 each, 'BOTH' = 7;
   * department = 2). Used to block saving a format that exceeds MAX_DOC_LENGTH.
   */
  private estimateFormattedLength(payload: any): number {
    const lengths: number[] = [];
    if (payload.CompanyFlagRequired === 'Y' && payload.CompanyPrefix) {
      lengths.push(String(payload.CompanyPrefix).length);
    }
    if (payload.BranchFlagRequired === 'Y' && payload.BranchPrefix) {
      lengths.push(String(payload.BranchPrefix).length);
    }
    if (payload.OperationFlagRequired === 'Y' && payload.OperationCode) {
      lengths.push(String(payload.OperationCode).length);
    }
    if (payload.POLPODFlagRequired === 'Y') {
      const mode = payload.POLPODMode || 'BOTH';
      lengths.push(mode === 'BOTH' ? 7 : 3); // 'XXX-XXX' or 'XXX'
    }
    if (payload.DepartmentCodeRequired === 'Y') {
      lengths.push(2); // department code placeholder (e.g. 'LE')
    }
    if (payload.MonthFlagRequired === 'Y') {
      lengths.push(2);
    }
    if (payload.YearFlagRequired === 'Y') {
      lengths.push(2);
    }
    lengths.push(Number(payload.NumberLength) || 5); // sequence

    const sep =
      payload.Separator !== null && payload.Separator !== undefined
        ? String(payload.Separator)
        : '/';
    return (
      lengths.reduce((sum, n) => sum + n, 0) +
      sep.length * Math.max(0, lengths.length - 1)
    );
  }

  /**
   * Resolve POL/POD counter-key sids and display codes based on POLPODMode.
   * - Counter-key sids are included only when PortWiseCounter !== 'N'.
   * - Only the port(s) selected by POLPODMode (POL | POD | BOTH) are resolved.
   * Shared by generateNextNumber / previewNextNumber / resetCounter.
   */
  private async resolvePortSegment(
    prisma: any,
    config: any,
    POLSid?: number,
    PODSid?: number,
  ): Promise<{
    polSid: number | null;
    podSid: number | null;
    polCode?: string;
    podCode?: string;
  }> {
    const mode = config.POLPODMode || 'BOTH';
    const on = config.POLPODFlagRequired === 'Y';
    const wantPol = on && (mode === 'POL' || mode === 'BOTH');
    const wantPod = on && (mode === 'POD' || mode === 'BOTH');
    const portWise = config.POLPODPortWiseCounter !== 'N';

    const polSid = wantPol && portWise ? (POLSid ?? null) : null;
    const podSid = wantPod && portWise ? (PODSid ?? null) : null;

    const last3 = (code?: string) =>
      code ? (code.length > 3 ? code.slice(-3) : code) : undefined;

    let polCode: string | undefined;
    let podCode: string | undefined;
    if (wantPol && POLSid) {
      const polPort = await prisma.portMaster.findUnique({
        where: { PortMasterSid: POLSid },
        select: { PortCode: true },
      });
      polCode = last3(polPort?.PortCode);
    }
    if (wantPod && PODSid) {
      const podPort = await prisma.portMaster.findUnique({
        where: { PortMasterSid: PODSid },
        select: { PortCode: true },
      });
      podCode = last3(podPort?.PortCode);
    }
    return { polSid, podSid, polCode, podCode };
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
    documentDate?: Date,
    polCode?: string,
    podCode?: string,
  ): Promise<string> {
    const parts: string[] = [];
    const sep = config.Separator || '';
    const now = documentDate ? moment(documentDate) : moment();

    // 1. Company Prefix
    if (config.CompanyFlagRequired === 'Y' && config.CompanyPrefix) {
      parts.push(config.CompanyPrefix);
    }

    // 2. Branch Prefix
    if (config.BranchFlagRequired === 'Y' && config.BranchPrefix) {
      parts.push(config.BranchPrefix);
    }

    // 3. Operation Code (e.g., BKG, QTN, MJB) — shown after branch
    if (config.OperationFlagRequired === 'Y' && config.OperationCode) {
      parts.push(config.OperationCode);
    }

    // 4. POL/POD segment by mode (POL | POD | BOTH)
    if (config.POLPODFlagRequired === 'Y') {
      const mode = config.POLPODMode || 'BOTH';
      if (mode === 'POL' && polCode) {
        parts.push(polCode);
      } else if (mode === 'POD' && podCode) {
        parts.push(podCode);
      } else if (mode === 'BOTH' && polCode && podCode) {
        parts.push(`${polCode}-${podCode}`); // e.g., MAA-CHE
      }
    }

    // 5. Department Code (fetched from DepartmentMaster)
    if (config.DepartmentCodeRequired === 'Y' && DepartmentMasterSid) {
      const dept = await prisma.departmentMaster.findUnique({
        where: { DepartmentMasterSid },
        select: { departmentCode: true },
      });
      if (dept?.departmentCode) {
        parts.push(dept.departmentCode); // e.g., "LE", "FE", "AE"
      }
    }

    // 6. Month (MM format)
    if (config.MonthFlagRequired === 'Y') {
      parts.push(now.format('MM'));
    }

    // 7. Year (YearCode from YearMaster)
    if (config.YearFlagRequired === 'Y' && yearMaster?.YearCode) {
      parts.push(String(yearMaster.YearCode).slice(-2)); // e.g., "25"
    }

    // 8. Sequence Number (padded to configured length)
    const paddedNumber = sequenceNumber
      .toString()
      .padStart(config.NumberLength || 5, '0');
    parts.push(paddedNumber);

    return parts.join(sep);
  }

  /**
   * Find the financial year that contains the given date.
   * Falls back to CurrentYear='Y' if no matching year is found.
   */
  private async findFinancialYear(
    prisma: any,
    CompanyMasterSid: number,
    referenceDate: moment.Moment,
  ): Promise<any> {
    const dateValue = referenceDate.toDate();

    // Find the year where the date falls within StartDate-EndDate
    const matchingYear = await prisma.yearMaster.findFirst({
      where: {
        CompanyMasterSid,
        status: 'A',
        StartDate: { lte: dateValue },
        EndDate: { gte: dateValue },
      },
    });

    if (matchingYear) {
      return matchingYear;
    }

    // Fallback: use the current year marker
    this.logger.warn(
      `[NumberSeries] No YearMaster found containing date ${referenceDate.format('YYYY-MM-DD')} for Company=${CompanyMasterSid}. Falling back to CurrentYear='Y'.`,
    );
    return await prisma.yearMaster.findFirst({
      where: {
        CompanyMasterSid,
        CurrentYear: 'Y',
        status: 'A',
      },
    });
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
    POLSid?: number,
    PODSid?: number,
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
    const { polSid, podSid } = await this.resolvePortSegment(
      this._db,
      config,
      POLSid,
      PODSid,
    );

    // Reset to StartingNumber - 1 so the next generated number will be StartingNumber
    // Using max(0, StartingNumber - 1) to handle edge case where StartingNumber is 1
    const resetValue = Math.max(0, (config.StartingNumber || 1) - 1);

    return await this._db.numberSeriesCounter.updateMany({
      where: {
        NumberSeriesConfigSid: config.NumberSeriesConfigSid,
        DepartmentMasterSid: deptSid,
        YearMasterSid: yearMasterSid,
        Month: month,
        POLSid: polSid,
        PODSid: podSid,
      },
      data: { LastNumber: resetValue },
    });
  }
}
