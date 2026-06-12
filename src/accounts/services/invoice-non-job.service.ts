import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { statusWhereClause, toNumber } from 'src/common/helper';
import { VoucherService } from './voucher/voucher.service';
import { VoucherPeriodService } from './voucher-period/voucher-period.service';

const INVOICE_NON_JOB_DOC_TYPE_CODE = 'NIN';

@Injectable()
export class InvoiceNonJobService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly logger: Logger,
    private readonly voucherService: VoucherService,
    private readonly voucherPeriodService: VoucherPeriodService,
  ) {}

  async createInvoice(payload: any) {
    try {
      const normalized = this.normalizePayload(payload);
      const periodValidation = await this.voucherPeriodService.validateVoucherPeriod({
        voucherDate: normalized.VoucherDate || new Date(),
        module: 'AR',
        CompanyMasterSid: normalized.CompanyMasterSid,
        BranchMasterSid: normalized.BranchMasterSid,
      });
      if (!periodValidation.allowed) {
        throw new BadRequestException(periodValidation.message);
      }

      return await this._db.$transaction(async (tx) => {
        const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
          where: {
            DocumentTypeCode: INVOICE_NON_JOB_DOC_TYPE_CODE,
            CompanyMasterSid: normalized.CompanyMasterSid,
            BranchMasterSid: normalized.BranchMasterSid,
            status: 'A',
          },
        });
        if (!voucherTypeMaster) {
          throw new BadRequestException('Invoice Non Job voucher type not configured for this company/branch.');
        }

        const voucherNumber = await this.voucherService.generateVoucherNumberFromConfig(
          voucherTypeMaster,
          normalized.CompanyMasterSid,
          normalized.BranchMasterSid,
          normalized.YearMasterSid,
          tx,
          normalized.VoucherDate ? new Date(normalized.VoucherDate) : undefined,
        );

        const voucherHeader = await tx.voucherHeader.create({
          data: {
            VoucherNumber: voucherNumber,
            VoucherDate: normalized.VoucherDate ? new Date(normalized.VoucherDate) : new Date(),
            PostDate: null,
            CreatedBy: normalized.CreatedBy || 'System',
            UpdatedOn: new Date(),
            Status: normalized.Status || normalized.status || 'A',
            CompanyMasterSid: normalized.CompanyMasterSid,
            BranchMasterSid: normalized.BranchMasterSid,
            VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
            VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
            PartyMasterSid: normalized.PartyMasterSid ? Number(normalized.PartyMasterSid) : null,
            PartyName: normalized.PartyName || '',
            PartyAddress: normalized.PartyAddress || '',
            CustomerBranchSid: normalized.CustomerBranchSid || null,
            PlaceOfSupply: normalized.PlaceOfSupply || '',
            State: normalized.State || '',
            COAMasterSid: normalized.COAMasterSid ? Number(normalized.COAMasterSid) : null,
            GST_VAT: normalized.GST_VAT || null,
            InvoiceType: normalized.InvoiceType || 'REG',
            TaxNumber: normalized.TaxNumber || null,
            GSTType: normalized.GSTType || null,
            TaxType: normalized.TaxType || null,
            Remarks: normalized.Narration || '',
            DepartmentMasterSid: null,
            HouseNumber: null,
            MasterNumber: null,
            HouseJobSid: null,
            MasterJobSid: null,
            PostStatus: normalized.PostStatus || 'U',
            CurrencyMasterSid: normalized.CurrencyMasterSid ? Number(normalized.CurrencyMasterSid) : null,
            CurrencyCode: normalized.CurrencyCode || null,
            ExchangeRate: normalized.ExchangeRate != null ? Number(normalized.ExchangeRate) : null,
            Amount: normalized.Amount != null ? Number(normalized.Amount) : null,
            LocalAmount: normalized.LocalAmount != null ? Number(normalized.LocalAmount) : null,
            NetAmount: normalized.NetAmount != null ? Number(normalized.NetAmount) : null,
            DocumentNumber: normalized.BillNo || normalized.DocumentNumber || '',
            DocumentDate: normalized.BillDate || normalized.DocumentDate ? new Date(normalized.BillDate || normalized.DocumentDate) : null,
            Narration: normalized.Narration || '',
            CustomsDuty: 'N',
            CashOrBank: 'Y',
          } as Prisma.VoucherHeaderUncheckedCreateInput,
        });

        await this.createVoucherDetails(tx, voucherHeader.VoucherHeaderSid, normalized);
        await this.createVoucherOthers(tx, voucherHeader.VoucherHeaderSid, normalized);

        return {
          newVoucher: await this.findVoucherHeaderById(voucherHeader.VoucherHeaderSid,voucherHeader.CompanyMasterSid,voucherHeader.BranchMasterSid, tx),
          VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
          VoucherNumber: voucherNumber,
        };
      });
    } catch (error) {
      this.logger.error(`createInvoiceNonJob error: ${error?.message}`, error?.stack);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create invoice non job');
    }
  }

  async findVoucherHeaderById(voucherHeaderSid: number, CompanyMasterSid: number, BranchMasterSid: number,tx?: any) {
    const db = tx || this._db;
    const voucherHeader = await db.voucherHeader.findFirst({
      where: {
        VoucherHeaderSid: voucherHeaderSid,
        CompanyMasterSid: CompanyMasterSid,
        BranchMasterSid: BranchMasterSid,
        Status: statusWhereClause,
        CashOrBank: 'Y',
        voucherTypeMaster: { DocumentTypeCode: INVOICE_NON_JOB_DOC_TYPE_CODE },
      },
      include: {
        VoucherDetail: {
          where: { Status: 'A' },
          include: {
            currencyMaster: true,
            hSSACMaster: true,
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
            customerMaster: {
              select: {
                PanType: true,
                countryMaster: {
                  select: { CountryMasterSid: true, countryCode: true },
                },
              },
            },
          },
        },
        voucherTypeMaster: true,
      },
    });

    if (!voucherHeader) {
      throw new BadRequestException('Invoice Non Job not found');
    }

    return {
      ...voucherHeader,
      BillNo: voucherHeader.DocumentNumber,
      BillDate: voucherHeader.DocumentDate,
    };
  }

  async updateVoucherHeaderById(voucherHeaderSid: number, payload: any) {
    try {
      const normalized = this.normalizePayload(payload);
      const existingVoucher = await this._db.voucherHeader.findFirst({
        where: {
          VoucherHeaderSid: voucherHeaderSid,
          Status: statusWhereClause,
          CashOrBank: 'Y',
          voucherTypeMaster: { DocumentTypeCode: INVOICE_NON_JOB_DOC_TYPE_CODE },
        },
      });
      if (!existingVoucher) {
        throw new BadRequestException('Invoice Non Job not found');
      }

      const periodValidation = await this.voucherPeriodService.validateVoucherPeriod({
        voucherDate: normalized.VoucherDate || existingVoucher.VoucherDate,
        module: 'AR',
        CompanyMasterSid: normalized.CompanyMasterSid || existingVoucher.CompanyMasterSid,
        BranchMasterSid: normalized.BranchMasterSid || existingVoucher.BranchMasterSid,
      });
      if (!periodValidation.allowed) {
        throw new BadRequestException(periodValidation.message);
      }

      return await this._db.$transaction(async (tx) => {
        await tx.voucherHeader.update({
          where: { VoucherHeaderSid: voucherHeaderSid },
          data: {
            UpdatedBy: normalized.UpdatedBy || normalized.CreatedBy || 'System',
            UpdatedOn: new Date(),
            VoucherDate: normalized.VoucherDate ? new Date(normalized.VoucherDate) : existingVoucher.VoucherDate,
            PartyMasterSid: normalized.PartyMasterSid !== undefined ? Number(normalized.PartyMasterSid) : existingVoucher.PartyMasterSid,
            PartyName: normalized.PartyName !== undefined ? normalized.PartyName : existingVoucher.PartyName,
            PartyAddress: normalized.PartyAddress !== undefined ? normalized.PartyAddress : existingVoucher.PartyAddress,
            CustomerBranchSid: normalized.CustomerBranchSid !== undefined ? normalized.CustomerBranchSid : existingVoucher.CustomerBranchSid,
            PlaceOfSupply: normalized.PlaceOfSupply !== undefined ? normalized.PlaceOfSupply : existingVoucher.PlaceOfSupply,
            State: normalized.State !== undefined ? normalized.State : existingVoucher.State,
            COAMasterSid: normalized.COAMasterSid !== undefined ? normalized.COAMasterSid : existingVoucher.COAMasterSid,
            GST_VAT: normalized.GST_VAT !== undefined ? normalized.GST_VAT : existingVoucher.GST_VAT,
            InvoiceType: normalized.InvoiceType || existingVoucher.InvoiceType,
            GSTType: normalized.GSTType !== undefined ? normalized.GSTType : existingVoucher.GSTType,
            TaxType: normalized.TaxType !== undefined ? normalized.TaxType : existingVoucher.TaxType,
            Remarks: normalized.Narration || existingVoucher.Remarks,
            DepartmentMasterSid: null,
            HouseNumber: null,
            MasterNumber: null,
            HouseJobSid: null,
            MasterJobSid: null,
            PostStatus: normalized.PostStatus || existingVoucher.PostStatus,
            CurrencyMasterSid: normalized.CurrencyMasterSid !== undefined ? normalized.CurrencyMasterSid : existingVoucher.CurrencyMasterSid,
            CurrencyCode: normalized.CurrencyCode !== undefined ? normalized.CurrencyCode : existingVoucher.CurrencyCode,
            ExchangeRate: normalized.ExchangeRate != null ? Number(normalized.ExchangeRate) : existingVoucher.ExchangeRate,
            Amount: normalized.Amount != null ? Number(normalized.Amount) : existingVoucher.Amount,
            LocalAmount: normalized.LocalAmount != null ? Number(normalized.LocalAmount) : existingVoucher.LocalAmount,
            NetAmount: normalized.NetAmount != null ? Number(normalized.NetAmount) : existingVoucher.NetAmount,
            DocumentNumber: normalized.BillNo || normalized.DocumentNumber || existingVoucher.DocumentNumber,
            DocumentDate: normalized.BillDate || normalized.DocumentDate ? new Date(normalized.BillDate || normalized.DocumentDate) : existingVoucher.DocumentDate,
            Narration: normalized.Narration || existingVoucher.Narration,
            CustomsDuty: 'N',
            CashOrBank: 'Y',
            Status: String(normalized.status || normalized.Status || existingVoucher.Status || 'A').charAt(0).toUpperCase(),
          } as Prisma.VoucherHeaderUncheckedUpdateInput,
        });

        if (Array.isArray(normalized.VoucherDetail)) {
          await tx.voucherDetail.updateMany({
            where: { VoucherHeaderSid: voucherHeaderSid, Status: 'A' },
            data: {
              Status: 'D',
              UpdatedBy: normalized.UpdatedBy || 'System',
              UpdatedOn: new Date(),
            },
          });
          await this.createVoucherDetails(tx, voucherHeaderSid, normalized);
        }

        if (normalized.VoucherOthers) {
          await tx.voucherOthers.updateMany({
            where: { VoucherHeaderSid: voucherHeaderSid, Status: 'A' },
            data: { Status: 'D', UpdatedBy: normalized.UpdatedBy || 'System', UpdatedOn: new Date() },
          });
          await this.createVoucherOthers(tx, voucherHeaderSid, normalized);
        }

        return this.findVoucherHeaderById(voucherHeaderSid,payload.CompanyMasterSid,payload.BranchMasterSid, tx);
      });
    } catch (error) {
      this.logger.error(`updateInvoiceNonJob error: ${error?.message}`, error?.stack);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to update invoice non job');
    }
  }

  async searchVoucherHeader(params: filterDto) {
    const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
    const skip = (Number(page) - 1) * Number(pageSize);
    let dateFromRaw = (params as any).dateFrom ?? (params as any).DateFrom;
    let dateToRaw = (params as any).dateTo ?? (params as any).DateTo;

    const resolvedYearSid = (params as any).YearMasterSid ?? (params as any).yearMasterSid;
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

    const dateFieldRaw = (params as any).dateField ?? (params as any).DateField ?? 'VoucherDate';
    const allowedDateFields = new Set(['VoucherDate', 'DocumentDate']);
    const dateField = allowedDateFields.has(dateFieldRaw) ? dateFieldRaw : 'VoucherDate';
    const partyMasterSid = (params as any).PartyMasterSid ?? (params as any).partyMasterSid ?? null;
    const currencyCode = (params as any).CurrencyCode ?? (params as any).currencyCode ?? null;
    const dateRange: Prisma.DateTimeFilter = {};

    if (dateFromRaw) {
      const parsedFrom = new Date(dateFromRaw);
      if (!Number.isNaN(parsedFrom.getTime())) dateRange.gte = parsedFrom;
    }
    if (dateToRaw) {
      const parsedTo = new Date(dateToRaw);
      if (!Number.isNaN(parsedTo.getTime())) dateRange.lte = parsedTo;
    }

    const where: Prisma.VoucherHeaderWhereInput = {
      CompanyMasterSid: activeCompanyId,
      BranchMasterSid: activeBranchId,
      Status: statusWhereClause,
      CashOrBank: 'Y',
      voucherTypeMaster: { DocumentTypeCode: INVOICE_NON_JOB_DOC_TYPE_CODE },
      ...(partyMasterSid ? { PartyMasterSid: Number(partyMasterSid) } : {}),
      ...(currencyCode ? { CurrencyCode: String(currencyCode) } : {}),
      ...(Object.keys(dateRange).length ? { [dateField]: dateRange } : {}),
      ...(search && {
        OR: [
          { VoucherNumber: { contains: search, mode: 'insensitive' } },
          { PartyName: { contains: search, mode: 'insensitive' } },
          { DocumentNumber: { contains: search, mode: 'insensitive' } },
          { Narration: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, totalCount] = await this._db.$transaction([
      this._db.voucherHeader.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: [{ VoucherDate: 'desc' }, { VoucherNumber: 'desc' }],
        include: {
          VoucherDetail: { where: { Status: 'A' }, take: 1 },
          currencyMaster: {
            where: { status: 'A' },
            select: { currencyCode: true, currencyName: true },
          },
        },
      }),
      this._db.voucherHeader.count({ where }),
    ]);

    return {
      items: items.map((item: any) => ({
        ...item,
        BillNo: item.DocumentNumber,
        BillDate: item.DocumentDate,
      })),
      totalCount,
    };
  }

  private async createVoucherDetails(tx: any, voucherHeaderSid: number, payload: any) {
    if (!Array.isArray(payload.VoucherDetail)) return;
    const details = payload.VoucherDetail.map((detail: any, index: number) => ({
      VoucherHeaderSid: voucherHeaderSid,
      CreatedBy: payload.CreatedBy || payload.UpdatedBy || 'System',
      CreatedOn: new Date(),
      UpdatedBy: payload.UpdatedBy || payload.CreatedBy || 'System',
      UpdatedOn: new Date(),
      Status: 'A',
      CompanyMasterSid: payload.CompanyMasterSid,
      BranchMasterSid: payload.BranchMasterSid,
      Sno: index + 1,
      ChargeMasterSid: null,
      ChargeDescription: payload.Narration || '',
      LedgerMasterSid: detail.LedgerMasterSid ? Number(detail.LedgerMasterSid) : null,
      COAMasterSid: detail.COAMasterSid ? Number(detail.COAMasterSid) : null,
      HSSACMasterSid: detail.HSSACMasterSid ? Number(detail.HSSACMasterSid) : null,
      ChargeUOMSid: null,
      NumberOfUnit: 1,
      DrCr: detail.DrCr || 'C',
      CurrencyMasterSid: detail.CurrencyMasterSid ? Number(detail.CurrencyMasterSid) : payload.CurrencyMasterSid,
      CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
      ExchangeRate: detail.ExchangeRate != null ? Number(detail.ExchangeRate) : payload.ExchangeRate || 1,
      Rate: toNumber(detail.Rate),
      Amount: toNumber(detail.Amount),
      TaxableAmount: toNumber(detail.TaxableAmount),
      TaxPercentage1: toNumber(detail.TaxPercentage1),
      TaxAmount1: toNumber(detail.TaxAmount1),
      TaxPercentage2: toNumber(detail.TaxPercentage2),
      TaxAmount2: toNumber(detail.TaxAmount2),
      LocalAmount: toNumber(detail.LocalAmount),
      PartyAmount: toNumber(detail.PartyAmount),
      YearMasterSid: detail.YearMasterSid || payload.YearMasterSid,
      MasterJobSid: null,
      HouseJobSid: null,
      DepartmentMasterSid: null,
      Narration: payload.Narration || '',
    }));

    if (details.length) {
      await tx.voucherDetail.createMany({ data: details });
    }
  }

  private async createVoucherOthers(tx: any, voucherHeaderSid: number, payload: any) {
    if (!payload.VoucherOthers) return;
    await tx.voucherOthers.create({
      data: {
        VoucherHeaderSid: voucherHeaderSid,
        ContainerNumber: payload.VoucherOthers.ContainerNumber || '',
        VoucherNote: payload.VoucherOthers.VoucherNote || '',
        Footer: payload.VoucherOthers.Footer || '',
        IRNNumber: payload.VoucherOthers.IRNNumber,
        IRNStatus: payload.VoucherOthers.IRNStatus,
        IRNQRCode: payload.VoucherOthers.IRNQRCode,
        CreatedBy: payload.CreatedBy || payload.UpdatedBy || 'System',
      CreatedOn: new Date(),
      UpdatedBy: payload.UpdatedBy || payload.CreatedBy || 'System',
      UpdatedOn: new Date(),
      Status: 'A',
      },
    });
  }

  private normalizePayload(payload: any) {
    const narration = payload?.Narration || payload?.Remarks || '';
    return {
      ...payload,
      CreatedBy: payload?.CreatedBy || payload?.createdBy,
      UpdatedBy: payload?.UpdatedBy || payload?.updatedBy,
      CreatedOn: payload?.CreatedOn || payload?.createdOn,
      UpdatedOn: payload?.UpdatedOn || payload?.updatedOn,
      CashOrBank: 'Y',
      JobOrNonJob: true,
      MasterJobSid: null,
      HouseJobSid: null,
      DepartmentMasterSid: null,
      BookingHeaderSid: null,
      CustomsDuty: 'N',
      DocumentNumber: payload?.BillNo || payload?.DocumentNumber,
      DocumentDate: payload?.BillDate || payload?.DocumentDate,
      BillNo: payload?.BillNo || payload?.DocumentNumber,
      BillDate: payload?.BillDate || payload?.DocumentDate,
      Narration: narration,
      Remarks: narration,
      VoucherDetail: Array.isArray(payload?.VoucherDetail)
        ? payload.VoucherDetail.map((detail: any) => ({
            ...detail,
            ChargeMasterSid: null,
            ChargeUOMSid: null,
            NumberOfUnit: 1,
            MasterJobSid: null,
            HouseJobSid: null,
            DepartmentMasterSid: null,
            BookingRateSid: null,
            BookingRatesSid: null,
            CostRevenueChargesSid: null,
            Narration: narration,
            ChargeDescription: narration,
          }))
        : [],
    };
  }
}







