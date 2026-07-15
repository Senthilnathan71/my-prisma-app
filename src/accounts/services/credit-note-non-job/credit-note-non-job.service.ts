import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { VoucherService } from '../voucher/voucher.service';
import { VoucherPeriodService } from 'src/accounts/services/voucher-period/voucher-period.service';
import { PullVoucherDTO } from 'src/accounts/dto/voucher.dto';
import { roundAmount, statusWhereClause, toNumber } from 'src/common/helper';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import {
  extractVoucherValidationMessage,
  DbTriggerValidationException,
} from 'src/common/db-validation-error.helper';

// This voucher's own document type.
const NCN_DOC_TYPE_CODE = DOC_TYPE_CODE.CREDIT_NOTE_NON_JOB; // 'NCN'
// The *source* voucher a Credit Note Non Job reverses (grep-safe rule: source → NIN, self → NCN).
const SOURCE_DOC_TYPE_CODE = DOC_TYPE_CODE.INVOICE_NON_JOB; // 'NIN'

/**
 * Credit Note Non Job (NCN) — reverses a posted Invoice Non Job (NIN).
 *
 * Standalone service that mirrors the reversal semantics of {@link CreditNoteService}
 * (ReversalVoucher / CreditNoteReason / SourceDetailSid-driven outstanding, DrCr swap,
 * auto-post) but strips every job-charge concern (BookingRates / CostRevenueCharges
 * actuals, RevenueVoucherHeaderSid clearing) and nulls all job dimensions the way
 * {@link InvoiceNonJobService} does — NCN details are ledger-based, not charge-based.
 */
@Injectable()
export class CreditNoteNonJobService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly logger: Logger,
    private readonly voucherService: VoucherService,
    private readonly voucherPeriodService: VoucherPeriodService,
  ) {}

  // ---------------------------------------------------------------------------
  // Detail row builder — ledger-based, every job dimension forced null.
  // ---------------------------------------------------------------------------
  private buildDetailData(
    voucherHeaderSid: number,
    payload: any,
    detail: any,
    index: number,
  ): any {
    const drCr = detail.DrCr || 'C';
    return {
      VoucherHeaderSid: voucherHeaderSid,
      Sno: index + 1,
      CompanyMasterSid: payload.CompanyMasterSid,
      BranchMasterSid: payload.BranchMasterSid,
      CreatedBy: payload.CreatedBy || payload.UpdatedBy || 'System',
      CreatedOn: new Date(),
      UpdatedBy: payload.UpdatedBy || payload.CreatedBy || 'System',
      UpdatedOn: new Date(),
      Status: 'A',
      // Non-job: no charge / job dimensions.
      ChargeMasterSid: null,
      ChargeUOMSid: null,
      NumberOfUnit: 1,
      MasterJobSid: null,
      HouseJobSid: null,
      DepartmentMasterSid: null,
      BookingRatesSid: null,
      CostRevenueChargesSid: null,
      // Ledger-based columns.
      LedgerMasterSid: detail.LedgerMasterSid ? Number(detail.LedgerMasterSid) : null,
      COAMasterSid: detail.COAMasterSid ? Number(detail.COAMasterSid) : null,
      HSSACMasterSid: detail.HSSACMasterSid ? Number(detail.HSSACMasterSid) : null,
      ChargeDescription:
        detail.ChargeDescription || detail.Narration || payload.Narration || '',
      Narration: detail.Narration || detail.ChargeDescription || payload.Narration || '',
      // Amounts — comma-safe parse (masked "20,000.00" → number, never Number()/NaN).
      CurrencyMasterSid: detail.CurrencyMasterSid
        ? Number(detail.CurrencyMasterSid)
        : payload.CurrencyMasterSid
          ? Number(payload.CurrencyMasterSid)
          : null,
      CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
      ExchangeRate:
        detail.ExchangeRate != null
          ? Number(detail.ExchangeRate)
          : payload.ExchangeRate != null
            ? Number(payload.ExchangeRate)
            : 1,
      Rate: toNumber(detail.Rate),
      Amount: toNumber(detail.Amount),
      TaxableAmount: toNumber(detail.TaxableAmount ?? detail.LocalAmount),
      TaxPercentage1: toNumber(detail.TaxPercentage1),
      TaxAmount1: toNumber(detail.TaxAmount1),
      TaxPercentage2: toNumber(detail.TaxPercentage2),
      TaxAmount2: toNumber(detail.TaxAmount2),
      LocalAmount: toNumber(detail.LocalAmount),
      PartyAmount: toNumber(detail.PartyAmount),
      DrCr: drCr,
      CostRevenue: detail.CostRevenue || (drCr === 'D' ? 'Revenue' : 'Cost'),
      // Outstanding math (fetchSourceInvoice) keys credits by SourceDetailSid — keep it.
      SourceDetailSid: detail.SourceDetailSid ?? null,
      YearMasterSid: detail.YearMasterSid || payload.YearMasterSid,
    };
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async createCreditNote(payload: any) {
    try {
      const periodValidation = await this.voucherPeriodService.validateVoucherPeriod({
        voucherDate: payload.VoucherDate || new Date(),
        module: 'AR',
        CompanyMasterSid: payload.CompanyMasterSid,
        BranchMasterSid: payload.BranchMasterSid,
      });
      if (!periodValidation.allowed) {
        throw new BadRequestException(periodValidation.message);
      }

      return await this._db.$transaction(
        async (prisma) => {
          const voucherTypeMaster = await prisma.voucherTypeMaster.findFirst({
            where: {
              DocumentTypeCode: NCN_DOC_TYPE_CODE,
              CompanyMasterSid: payload.CompanyMasterSid,
              BranchMasterSid: payload.BranchMasterSid,
              status: 'A',
            },
          });

          if (!voucherTypeMaster) {
            throw new BadRequestException(
              'Credit Note Non Job voucher type not configured. Please configure "Credit Note Non Job" (NCN) in VoucherTypeMaster for this company/branch.',
            );
          }

          const VoucherNumber =
            await this.voucherService.generateVoucherNumberFromConfig(
              voucherTypeMaster,
              payload.CompanyMasterSid,
              payload.BranchMasterSid,
              payload.YearMasterSid,
              prisma,
              payload.VoucherDate ? new Date(payload.VoucherDate) : undefined,
            );

          const voucherHeader = await prisma.voucherHeader.create({
            data: {
              VoucherNumber,
              VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
              UpdatedOn: new Date(),
              PostDate: null,
              VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
              VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
              Narration: payload.Narration || '',
              COAMasterSid: payload.COAMasterSid ? Number(payload.COAMasterSid) : null,
              CompanyMasterSid: payload.CompanyMasterSid,
              BranchMasterSid: payload.BranchMasterSid,
              PartyMasterSid: payload.PartyMasterSid ? Number(payload.PartyMasterSid) : null,
              PartyName: payload.PartyName || '',
              PartyAddress: payload.PartyAddress || '',
              CustomerBranchSid: payload.CustomerBranchSid || null,
              PostStatus: payload.PostStatus || 'U',
              PlaceOfSupply: payload.PlaceOfSupply,
              GST_VAT: payload.GSTNo || payload.GST_VAT,
              InvoiceType: payload.InvoiceType || 'B2B',
              GSTType: payload.GSTType,
              TaxType: payload.TaxType || null,
              CurrencyMasterSid: payload.CurrencyMasterSid ? Number(payload.CurrencyMasterSid) : null,
              CurrencyCode: payload.CurrencyCode,
              ExchangeRate: payload.ExchangeRate != null ? Number(payload.ExchangeRate) : 1,
              DocumentNumber: payload.BillNo || payload.DocumentNumber,
              DocumentDate: payload.BillDate ? new Date(payload.BillDate) : null,
              Amount: toNumber(payload.BillAmt ?? payload.Amount),
              Remarks: payload.Remarks || payload.Narration || '',
              Status: payload.Status || 'A',
              CreatedBy: payload.CreatedBy || 'System',
              ReversalVoucher: payload.ReversalVoucher || null,
              CreditNoteReason: payload.CreditNoteReason || null,
              // Non-job: null every job dimension; non-job discriminator flags.
              MasterJobSid: null,
              HouseJobSid: null,
              MasterNumber: null,
              HouseNumber: null,
              DepartmentMasterSid: null,
              BookingHeaderSid: null,
              CustomsDuty: 'N',
              CashOrBank: 'Y',
            } as Prisma.VoucherHeaderUncheckedCreateInput,
          });

          const finalDetails: any[] = [];
          if (Array.isArray(payload.VoucherDetail)) {
            for (let i = 0; i < payload.VoucherDetail.length; i++) {
              const newDetail = await prisma.voucherDetail.create({
                data: this.buildDetailData(
                  voucherHeader.VoucherHeaderSid,
                  payload,
                  payload.VoucherDetail[i],
                  i,
                ),
              });
              finalDetails.push(newDetail);
            }
          }

          if (payload.VoucherOthers) {
            await prisma.voucherOthers.create({
              data: {
                VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                ContainerNumber: payload.VoucherOthers.ContainerNumber || '',
                VoucherNote: payload.VoucherOthers.VoucherNote || '',
                Footer: payload.VoucherOthers.Footer || '',
                IRNNumber: payload.VoucherOthers.IRNNumber,
                IRNStatus: payload.VoucherOthers.IRNStatus,
                IRNQRCode: payload.VoucherOthers.IRNQRCode,
                CreatedBy: payload.CreatedBy || 'System',
                CreatedOn: new Date(),
                UpdatedBy: payload.CreatedBy || 'System',
                UpdatedOn: new Date(),
                Status: 'A',
              },
            });
          }

          // Auto-post (mirrors CRN). Only fires when the voucher type is configured
          // IsAutoPosting='Y' AND the frontend sent PostingInfo. No job-charge clearing.
          if (voucherTypeMaster.IsAutoPosting === 'Y') {
            await this.voucherService.postVoucherByVoucherSid(
              {
                voucherHeaderSid: voucherHeader.VoucherHeaderSid,
                companyMasterSid: voucherHeader.CompanyMasterSid,
                branchMasterSid: voucherHeader.BranchMasterSid,
                yearMasterSid: payload.YearMasterSid,
                localCurrencyMasterSid: Number(payload?.PostingInfo?.LocalCurrencyMasterSid),
                localCurrencyCode: String(payload?.PostingInfo?.LocalCurrencyCode),
                current_date: payload.current_date,
                postedBy: payload.CreatedBy,
                taxDetails: payload?.PostingInfo?.TaxDetails,
              },
              prisma,
            );
          }

          return { ...voucherHeader, VoucherDetail: finalDetails };
        },
        { timeout: 60000 },
      );
    } catch (error) {
      const vmsg = extractVoucherValidationMessage(error);
      if (vmsg) {
        throw new DbTriggerValidationException(vmsg);
      }
      this.logger.error(`createCreditNoteNonJob Error: ${error?.message}`, error?.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Something Went Wrong While Creating Credit Note Non Job',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Update — R3 upsert of detail rows (preserve PKs), no job-charge subtraction.
  // ---------------------------------------------------------------------------
  async updateVoucherHeaderById(VoucherHeaderSid: number, payload: any) {
    try {
      const existingVoucher = await this._db.voucherHeader.findFirst({
        where: {
          VoucherHeaderSid: VoucherHeaderSid,
          Status: statusWhereClause,
          CashOrBank: 'Y',
          voucherTypeMaster: { DocumentTypeCode: NCN_DOC_TYPE_CODE },
        },
      });
      if (!existingVoucher) {
        throw new BadRequestException('Credit Note Non Job not found');
      }

      return await this._db.$transaction(async (prisma) => {
        await prisma.voucherHeader.update({
          where: { VoucherHeaderSid },
          data: {
            VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : undefined,
            Narration: payload.Narration,
            PartyMasterSid: payload.PartyMasterSid !== undefined ? Number(payload.PartyMasterSid) : undefined,
            PartyName: payload.PartyName,
            PartyAddress: payload.PartyAddress,
            CustomerBranchSid: payload.CustomerBranchSid !== undefined ? payload.CustomerBranchSid : undefined,
            PlaceOfSupply: payload.PlaceOfSupply,
            GST_VAT: payload.GSTNo || payload.GST_VAT,
            InvoiceType: payload.InvoiceType,
            GSTType: payload.GSTType,
            TaxType: payload.TaxType,
            COAMasterSid: payload.COAMasterSid !== undefined ? (payload.COAMasterSid ? Number(payload.COAMasterSid) : null) : undefined,
            CurrencyMasterSid: payload.CurrencyMasterSid !== undefined ? Number(payload.CurrencyMasterSid) : undefined,
            CurrencyCode: payload.CurrencyCode,
            ExchangeRate: payload.ExchangeRate != null ? Number(payload.ExchangeRate) : undefined,
            PostStatus: payload.PostStatus,
            DocumentNumber: payload.BillNo || payload.DocumentNumber,
            DocumentDate: payload.BillDate ? new Date(payload.BillDate) : undefined,
            Amount: toNumber(payload.BillAmt ?? payload.Amount),
            Remarks: payload.Remarks,
            ReversalVoucher: payload.ReversalVoucher !== undefined ? (payload.ReversalVoucher || null) : undefined,
            CreditNoteReason: payload.CreditNoteReason || null,
            // Non-job: keep every job dimension null.
            MasterJobSid: null,
            HouseJobSid: null,
            MasterNumber: null,
            HouseNumber: null,
            DepartmentMasterSid: null,
            BookingHeaderSid: null,
            CustomsDuty: 'N',
            CashOrBank: 'Y',
            UpdatedBy: payload.UpdatedBy || 'System',
            UpdatedOn: new Date(),
            Status: payload.status ? String(payload.status).charAt(0).toUpperCase() : undefined,
          },
        });

        if (Array.isArray(payload.VoucherDetail)) {
          await this.syncVoucherDetails(prisma, VoucherHeaderSid, existingVoucher, payload);
        }

        if (payload.VoucherOthers) {
          const existingOthers = await prisma.voucherOthers.findFirst({
            where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' },
          });
          if (existingOthers) {
            await prisma.voucherOthers.update({
              where: { VoucherOthersSid: existingOthers.VoucherOthersSid },
              data: {
                UpdatedBy: payload.UpdatedBy || 'System',
                UpdatedOn: new Date(),
                IRNStatus: payload.VoucherOthers.IRNStatus,
                IRNNumber: payload.VoucherOthers.IRNNumber,
                IRNQRCode: payload.VoucherOthers.IRNQRCode,
                VoucherReverseSid: payload.VoucherOthers.VoucherReverseSid
                  ? Number(payload.VoucherOthers.VoucherReverseSid)
                  : null,
                ContainerNumber: payload.VoucherOthers.ContainerNumber,
                VoucherNote: payload.VoucherOthers.VoucherNote,
                Footer: payload.VoucherOthers.Footer,
              },
            });
          } else {
            await prisma.voucherOthers.create({
              data: {
                VoucherHeaderSid: VoucherHeaderSid,
                CreatedBy: payload.UpdatedBy || 'System',
                CreatedOn: new Date(),
                UpdatedBy: payload.UpdatedBy || 'System',
                UpdatedOn: new Date(),
                Status: 'A',
                IRNStatus: payload.VoucherOthers.IRNStatus,
                IRNNumber: payload.VoucherOthers.IRNNumber,
                IRNQRCode: payload.VoucherOthers.IRNQRCode,
                VoucherReverseSid: payload.VoucherOthers.VoucherReverseSid
                  ? Number(payload.VoucherOthers.VoucherReverseSid)
                  : null,
                ContainerNumber: payload.VoucherOthers.ContainerNumber,
                VoucherNote: payload.VoucherOthers.VoucherNote,
                Footer: payload.VoucherOthers.Footer,
              },
            });
          }
        }

        return this.findVoucherHeaderById(
          VoucherHeaderSid,
          payload.CompanyMasterSid ?? existingVoucher.CompanyMasterSid,
          payload.BranchMasterSid ?? existingVoucher.BranchMasterSid,
          prisma,
        );
      });
    } catch (error) {
      const vmsg = extractVoucherValidationMessage(error);
      if (vmsg) {
        throw new DbTriggerValidationException(vmsg);
      }
      this.logger.error(`updateCreditNoteNonJob Error: ${error?.message}`, error?.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Something Went Wrong While Updating Credit Note Non Job',
      );
    }
  }

  /**
   * Reconcile detail rows on update WITHOUT churning primary keys (R3):
   * rows arriving with an existing VoucherDetailSid are updated in place,
   * new rows are inserted, previously-active rows no longer present are soft-deleted.
   */
  private async syncVoucherDetails(
    prisma: Prisma.TransactionClient,
    voucherHeaderSid: number,
    existingVoucher: any,
    payload: any,
  ) {
    const detailPayload = {
      ...payload,
      CompanyMasterSid: payload.CompanyMasterSid ?? existingVoucher.CompanyMasterSid,
      BranchMasterSid: payload.BranchMasterSid ?? existingVoucher.BranchMasterSid,
    };

    const existingRows = await prisma.voucherDetail.findMany({
      where: { VoucherHeaderSid: voucherHeaderSid, Status: 'A' },
      select: { VoucherDetailSid: true },
    });
    const existingSids = new Set<number>(existingRows.map((r) => Number(r.VoucherDetailSid)));
    const keptSids = new Set<number>();

    for (let index = 0; index < payload.VoucherDetail.length; index++) {
      const detail = payload.VoucherDetail[index];
      const data = this.buildDetailData(voucherHeaderSid, detailPayload, detail, index);
      const sid = detail?.VoucherDetailSid ? Number(detail.VoucherDetailSid) : null;

      if (sid && existingSids.has(sid)) {
        keptSids.add(sid);
        // Preserve creation audit fields on update.
        const { CreatedBy, CreatedOn, ...updateData } = data;
        await prisma.voucherDetail.update({
          where: { VoucherDetailSid: sid },
          data: updateData,
        });
      } else {
        await prisma.voucherDetail.create({ data });
      }
    }

    const removedSids = [...existingSids].filter((sid) => !keptSids.has(sid));
    if (removedSids.length) {
      await prisma.voucherDetail.updateMany({
        where: { VoucherDetailSid: { in: removedSids } },
        data: {
          Status: 'D',
          UpdatedBy: payload.UpdatedBy || 'System',
          UpdatedOn: new Date(),
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Fetch one (edit-load) — resolves the source NIN so ReversalVoucherNumber repopulates.
  // ---------------------------------------------------------------------------
  async findVoucherHeaderById(
    VoucherHeaderSid: number,
    CompanyMasterSid: number,
    BranchMasterSid: number,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = tx || this._db;

    const creditNote = await prisma.voucherHeader.findFirst({
      where: {
        VoucherHeaderSid: VoucherHeaderSid,
        CompanyMasterSid: CompanyMasterSid,
        BranchMasterSid: BranchMasterSid,
        Status: statusWhereClause,
        CashOrBank: 'Y',
        voucherTypeMaster: { DocumentTypeCode: NCN_DOC_TYPE_CODE },
      },
      include: {
        VoucherDetail: {
          where: { Status: 'A' },
          include: {
            currencyMaster: true,
            hSSACMaster: { include: { taxGroup: true } },
            coaMaster: true,
            subledgerMaster: true,
          },
          orderBy: { Sno: 'asc' },
        },
        VoucherOthers: { where: { Status: 'A' } },
        currencyMaster: true,
        subledgerMaster: true,
        customerBranch: {
          include: {
            stateMaster: {
              select: { StateMasterSid: true, stateName: true, IsUnionTerritory: true },
            },
          },
        },
        voucherTypeMaster: true,
      },
    });

    if (!creditNote) {
      throw new BadRequestException('Credit Note Non Job not found');
    }

    let reversalVoucher: any = null;
    if (creditNote.ReversalVoucher) {
      // ⚠️ Source filter is the *non-job* invoice — the second of the two
      // INVOICE→INVOICE_NON_JOB flips. Wrong code here silently blanks the
      // source-NIN number on reopen (R4).
      reversalVoucher = await prisma.voucherHeader.findFirst({
        where: {
          AND: [
            { VoucherHeaderSid: creditNote.ReversalVoucher },
            { voucherTypeMaster: { DocumentTypeCode: SOURCE_DOC_TYPE_CODE } },
            { PostStatus: 'P' },
          ],
        },
        select: {
          VoucherHeaderSid: true,
          VoucherNumber: true,
          VoucherDetail: {
            where: { Status: 'A' },
            select: { VoucherDetailSid: true, Rate: true },
          },
        },
      });
    }

    return {
      ...creditNote,
      BillNo: creditNote.DocumentNumber,
      BillDate: creditNote.DocumentDate,
      reversalVoucher,
      ReversalVoucherNumber: reversalVoucher?.VoucherNumber ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // List / search — projects the source NIN number per row.
  // ---------------------------------------------------------------------------
  async searchVoucherHeader(params: any): Promise<any> {
    try {
      const {
        search = '',
        page = 1,
        pageSize = 15,
        activeCompanyId,
        activeBranchId,
      } = params;

      let dateFromRaw = params?.dateFrom ?? params?.DateFrom;
      let dateToRaw = params?.dateTo ?? params?.DateTo;

      const resolvedYearSid = params?.YearMasterSid ?? params?.yearMasterSid;
      if (resolvedYearSid) {
        const year = await this._db.yearMaster.findUnique({
          where: { YearMasterSid: Number(resolvedYearSid) },
          select: { StartDate: true, EndDate: true },
        });
        if (year) {
          dateFromRaw = year.StartDate.toISOString().split('T')[0];
          dateToRaw = year.EndDate.toISOString().split('T')[0];
        }
      }

      const dateFieldRaw = params?.dateField ?? params?.DateField ?? 'VoucherDate';
      const allowedDateFields = new Set(['VoucherDate', 'DocumentDate']);
      const dateField = allowedDateFields.has(dateFieldRaw) ? dateFieldRaw : 'VoucherDate';
      const partyMasterSid =
        params?.PartyMasterSid ??
        params?.partyMasterSid ??
        params?.CustomerMasterSid ??
        params?.customerMasterSid ??
        null;
      const currencyCode = params?.CurrencyCode ?? params?.currencyCode ?? null;

      const dateRange: Prisma.DateTimeFilter = {};
      if (dateFromRaw) {
        const parsedFrom = new Date(dateFromRaw);
        if (!Number.isNaN(parsedFrom.getTime())) dateRange.gte = parsedFrom;
      }
      if (dateToRaw) {
        const parsedTo = new Date(dateToRaw);
        if (!Number.isNaN(parsedTo.getTime())) dateRange.lte = parsedTo;
      }

      const skip = (Number(page) - 1) * Number(pageSize);

      const where: Prisma.VoucherHeaderWhereInput = {
        CompanyMasterSid: activeCompanyId,
        BranchMasterSid: activeBranchId,
        Status: statusWhereClause,
        CashOrBank: 'Y',
        voucherTypeMaster: { DocumentTypeCode: NCN_DOC_TYPE_CODE },
        ...(partyMasterSid ? { PartyMasterSid: Number(partyMasterSid) } : {}),
        ...(currencyCode ? { CurrencyCode: String(currencyCode) } : {}),
        ...(Object.keys(dateRange).length ? { [dateField]: dateRange } : {}),
      };

      if (search) {
        const matchingSources = await this._db.voucherHeader.findMany({
          where: { VoucherNumber: { contains: search, mode: 'insensitive' } },
          select: { VoucherHeaderSid: true },
        });
        const reverseIds = matchingSources.map((v) => v.VoucherHeaderSid);
        where.OR = [
          { VoucherNumber: { contains: search, mode: 'insensitive' } },
          { PartyName: { contains: search, mode: 'insensitive' } },
          { DocumentNumber: { contains: search, mode: 'insensitive' } },
          { Narration: { contains: search, mode: 'insensitive' } },
          ...(reverseIds.length > 0 ? [{ ReversalVoucher: { in: reverseIds } }] : []),
        ];
      }

      const [items, totalCount] = await Promise.all([
        this._db.voucherHeader.findMany({
          where,
          skip,
          take: Number(pageSize),
          orderBy: [{ VoucherDate: 'desc' }, { VoucherNumber: 'desc' }],
          include: {
            VoucherDetail: { where: { Status: 'A' } },
            currencyMaster: { select: { currencyCode: true, currencyName: true } },
          },
        }),
        this._db.voucherHeader.count({ where }),
      ]);

      const reversalIds = items
        .filter((item) => item.ReversalVoucher)
        .map((item) => item.ReversalVoucher as number);
      let reversalMap = new Map<number, string>();
      if (reversalIds.length > 0) {
        const reversalVouchers = await this._db.voucherHeader.findMany({
          where: { VoucherHeaderSid: { in: reversalIds } },
          select: { VoucherHeaderSid: true, VoucherNumber: true },
        });
        reversalMap = new Map(reversalVouchers.map((v) => [v.VoucherHeaderSid, v.VoucherNumber]));
      }

      const enrichedItems = items.map((item: any) => ({
        ...item,
        LocalAmount:
          item.VoucherDetail?.reduce((sum: number, d: any) => sum + Number(d.LocalAmount || 0), 0) || 0,
        BillNo: item.DocumentNumber,
        BillDate: item.DocumentDate,
        ReversalVoucherNumber: item.ReversalVoucher
          ? reversalMap.get(item.ReversalVoucher) || null
          : null,
      }));

      return {
        items: enrichedItems,
        totalCount,
        page: Number(page),
        pageSize: Number(pageSize),
      };
    } catch (error) {
      this.logger.error(`searchCreditNoteNonJob error: ${error?.message}`, error?.stack);
      throw new InternalServerErrorException('Failed to search Credit Note Non Job');
    }
  }

  // ---------------------------------------------------------------------------
  // Delete (soft) — scoped to NCN.
  // ---------------------------------------------------------------------------
  async deleteVoucherHeader(VoucherHeaderSid: number) {
    try {
      return await this._db.$transaction(async (prisma) => {
        const existing = await prisma.voucherHeader.findFirst({
          where: {
            VoucherHeaderSid: VoucherHeaderSid,
            CashOrBank: 'Y',
            voucherTypeMaster: { DocumentTypeCode: NCN_DOC_TYPE_CODE },
          },
        });
        if (!existing || existing.Status !== 'A') {
          throw new BadRequestException('Credit Note Non Job not found or already deleted');
        }

        const deletedVoucherHeader = await prisma.voucherHeader.update({
          where: { VoucherHeaderSid: VoucherHeaderSid },
          data: { Status: 'D' },
        });
        const deletedVoucherDetails = await prisma.voucherDetail.updateMany({
          where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' },
          data: { Status: 'D' },
        });
        const deletedVoucherOthers = await prisma.voucherOthers.updateMany({
          where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' },
          data: { Status: 'D' },
        });

        return { deletedVoucherHeader, deletedVoucherDetails, deletedVoucherOthers };
      });
    } catch (error) {
      this.logger.error(`deleteCreditNoteNonJob Error: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Pull the source Invoice Non Job (NIN) by number, DrCr-swapped lines + outstanding.
  // Copy of CreditNoteService.fetchInvoice with the source filter flipped to NIN.
  // ---------------------------------------------------------------------------
  async fetchSourceInvoice(payload: PullVoucherDTO, tx?: Prisma.TransactionClient): Promise<any> {
    const prisma = tx || this._db;
    const { VoucherNumber, CompanyMasterSid, BranchMasterSid } = payload;

    const invoice = await prisma.voucherHeader.findFirst({
      where: {
        VoucherNumber: { contains: VoucherNumber, mode: 'insensitive' },
        CompanyMasterSid,
        BranchMasterSid,
        // ⚠️ Source is the *non-job* invoice (NIN), not INV — the first filter flip.
        voucherTypeMaster: { DocumentTypeCode: SOURCE_DOC_TYPE_CODE },
        Status: 'A',
      },
      include: {
        VoucherDetail: {
          where: { Status: 'A' },
          include: { currencyMaster: { select: { amountDecimal: true } } },
          orderBy: { Sno: 'asc' },
        },
        voucherTypeMaster: { select: { DocumentTypeName: true } },
        currencyMaster: { select: { amountDecimal: true, currencyCode: true } },
        customerBranch: {
          select: {
            CustomerGstType: true,
            stateMaster: { select: { StateMasterSid: true, IsUnionTerritory: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Invoice Non Job with Voucher Number ${VoucherNumber} not found`,
      );
    }
    if (invoice.PostStatus !== 'P') {
      throw new BadRequestException(
        `Invoice Non Job with Voucher Number ${VoucherNumber} is not posted`,
      );
    }
    if (!invoice.VoucherDetail?.length) {
      throw new BadRequestException(
        `Invoice Non Job with Voucher Number ${VoucherNumber} has no details`,
      );
    }

    const headerCurrencyDecimals = invoice.currencyMaster?.amountDecimal ?? 2;
    const toSafeNumber = (val: any): number => {
      const n = toNumber(val);
      return Math.abs(n) < 1e-8 ? 0 : n;
    };
    const roundFinal = (val: number, decimals: number): number => roundAmount(val, decimals);

    // Existing NCNs against this NIN — deduct their per-line amounts (keyed by SourceDetailSid).
    const creditNotes = await prisma.voucherHeader.findMany({
      where: {
        ReversalVoucher: invoice.VoucherHeaderSid,
        CompanyMasterSid: invoice.CompanyMasterSid,
        BranchMasterSid: invoice.BranchMasterSid,
        PostStatus: 'P',
        Status: 'A',
      },
      include: { VoucherDetail: { where: { Status: 'A' }, orderBy: { Sno: 'asc' } } },
    });

    const creditMap = new Map<number, any[]>();
    creditNotes.forEach((credit) => {
      credit.VoucherDetail.forEach((d) => {
        if (!d.SourceDetailSid) return;
        const arr = creditMap.get(d.SourceDetailSid) || [];
        creditMap.set(d.SourceDetailSid, [...arr, d]);
      });
    });

    const updatedDetails = (invoice.VoucherDetail || [])
      .filter((d) => d.IsAutoGenerated === 'N')
      .map((detail) => {
        let rate = toSafeNumber(detail.Rate);
        let amount = toSafeNumber(detail.Amount);
        let taxableAmount = toSafeNumber(detail.TaxableAmount);
        let localAmount = toSafeNumber(detail.LocalAmount);
        let tax1 = toSafeNumber(detail.TaxAmount1);
        let tax2 = toSafeNumber(detail.TaxAmount2);
        let partyAmount = toSafeNumber(detail.PartyAmount);

        if (creditMap.has(detail.VoucherDetailSid)) {
          const credits = creditMap.get(detail.VoucherDetailSid)!;
          rate -= credits.reduce((s, d) => s + toSafeNumber(d.Rate), 0);
          amount -= credits.reduce((s, d) => s + toSafeNumber(d.Amount), 0);
          taxableAmount -= credits.reduce((s, d) => s + toSafeNumber(d.TaxableAmount), 0);
          localAmount -= credits.reduce((s, d) => s + toSafeNumber(d.LocalAmount), 0);
          tax1 -= credits.reduce((s, d) => s + toSafeNumber(d.TaxAmount1), 0);
          tax2 -= credits.reduce((s, d) => s + toSafeNumber(d.TaxAmount2), 0);
          partyAmount -= credits.reduce((s, d) => s + toSafeNumber(d.PartyAmount), 0);
        }

        return {
          ...detail,
          Rate: roundFinal(rate, 4),
          Amount: roundFinal(amount, 4),
          TaxableAmount: roundFinal(taxableAmount, 4),
          LocalAmount: roundFinal(localAmount, 4),
          TaxAmount1: roundFinal(tax1, 4),
          TaxAmount2: roundFinal(tax2, 4),
          PartyAmount: roundFinal(partyAmount, headerCurrencyDecimals),
        };
      });

    // Outstanding — party line via LedgerMasterSid === PartyMasterSid (NIN is ledger-based).
    const partyDetail = (invoice.VoucherDetail || []).find(
      (d) => d.LedgerMasterSid === invoice.PartyMasterSid,
    );
    if (!partyDetail) {
      throw new BadRequestException('Party Voucher Detail not found for Invoice Non Job.');
    }
    if (!partyDetail.VoucherTransactionSid) {
      throw new BadRequestException(
        'Party Voucher Transaction Sid not found for Invoice Non Job.',
      );
    }

    const outstanding = await this.voucherService.getOutstandingAmount(
      partyDetail.VoucherTransactionSid,
      prisma,
    );
    const osAmount = roundFinal(outstanding.OutstandingAmount, headerCurrencyDecimals);
    const osLocalAmount = roundFinal(outstanding.OutstandingLocalAmount, 4);

    const { VoucherDetail, currencyMaster, voucherTypeMaster, ...header } = invoice;
    return {
      ...header,
      // Skip any line with nothing left to reverse — a zero Amount OR zero LocalAmount
      // (e.g. a charge already fully credited by prior credit notes).
      VoucherDetail: updatedDetails.filter(
        (d) =>
          d.IsAutoGenerated === 'N' &&
          toNumber(d.Amount) > 0 &&
          toNumber(d.LocalAmount) > 0,
      ),
      totalOSAmount: osAmount,
      totalOSLocalAmount: osLocalAmount,
      hasOutstandingAmount: osAmount > 0 || osLocalAmount > 0,
    };
  }
}
