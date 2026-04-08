import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';

@Injectable()
export class PaymentRequestService {
  constructor(
    private readonly db: DatabaseService,
    private readonly logger: Logger,
    private readonly voucherService: VoucherService,
  ) {}

  async createPaymentRequest(payload: any) {
    this.validateHeader(payload);
    const detailRows = this.getSelectedDetails(payload.detailItems || payload.paymentRequestDetails || []);

    if (!detailRows.length) {
      throw new BadRequestException('Please select at least one prepaid cost row');
    }

    return this.db.$transaction(async (tx) => {
      await this.validateSourceChargesForPaymentRequest(detailRows, payload, tx);

      const paymentRequestNumber = await this.generatePaymentRequestNumber(
        payload.CompanyMasterSid,
        payload.BranchMasterSid,
        new Date(payload.PaymentRequestDate || payload.RequestDate || new Date()),
        tx,
      );

      const header = await tx.paymentRequest.create({
        data: {
          PaymentRequestNumber: paymentRequestNumber,
          PaymentRequestDate: new Date(payload.PaymentRequestDate || payload.RequestDate || new Date()),
          CompanyMasterSid: Number(payload.CompanyMasterSid),
          BranchMasterSid: Number(payload.BranchMasterSid),
          CashBank: payload.CashBank || 'Bank',
          DepartmentMasterSid: Number(payload.DepartmentMasterSid),
          PaymentRequestStatus: payload.PaymentRequestStatus || ApprovalStatus.Pending,
          Party: Number(payload.Party),
          PayableTo: payload.PayableTo || payload.PartyName || '',
          BookingSid: this.toNullableNumber(payload.BookingSid),
          MasterJobSid: this.toNullableNumber(payload.MasterJobSid),
          HouseJobSid: this.toNullableNumber(payload.HouseJobSid),
          Remarks: payload.Remarks || '',
          Status: payload.Status || 'A',
          CreatedBy: payload.CreatedBy || 'System',
        },
      });

      await tx.paymentRequestDetail.createMany({
        data: detailRows.map((item: any, index: number) => ({
          PaymentRequestSid: header.PaymentRequestSid,
          CompanyMasterSid: Number(payload.CompanyMasterSid),
          BranchMasterSid: Number(payload.BranchMasterSid),
          SerialNumber: index + 1,
          ChargeMasterSid: this.toNullableNumber(item.ChargeMasterSid),
          ChargeDescription: item.ChargeDescription || '',
          CostChargeUomSid: this.toNullableNumber(item.CostChargeUomSid || item.ChargeUOMSid),
          CostCurrencyMasterSid: this.toNullableNumber(item.CostCurrencyMasterSid),
          CostExchangeRate: this.toNullableDecimal(item.CostExchangeRate),
          CostRate: this.toNullableDecimal(item.CostRate),
          CostNumberOfUnit: this.toNullableDecimal(item.CostNumberOfUnit),
          CostDrCr: item.CostDrCr || 'D',
          CostAmount: this.toNullableDecimal(item.CostAmount),
          CostLocalAmount: this.toNullableDecimal(item.CostLocalAmount),
          CostAgentMasterSid: this.toNullableNumber(item.CostAgentMasterSid),
          CostAgentBranchSid: this.toNullableNumber(item.CostAgentBranchSid),
          CreatedBy: payload.CreatedBy || 'System',
        })),
      });

      await this.linkSourceCharges(detailRows, header.PaymentRequestSid, payload.UpdatedBy || payload.CreatedBy, tx);

      return this.getPaymentRequestById(header.PaymentRequestSid, tx);
    });
  }

  async updatePaymentRequest(paymentRequestSid: number, payload: any) {
    this.validateHeader(payload);
    const existing = await this.db.paymentRequest.findUnique({
      where: { PaymentRequestSid: paymentRequestSid },
    });

    if (!existing) {
      throw new NotFoundException('Payment request not found');
    }

    if (existing.VoucherSid) {
      throw new BadRequestException('Payment voucher already created for this request');
    }

    const detailRows = this.getSelectedDetails(payload.detailItems || payload.paymentRequestDetails || []);
    if (!detailRows.length) {
      throw new BadRequestException('Please select at least one prepaid cost row');
    }

    return this.db.$transaction(async (tx) => {
      await this.unlinkExistingSourceCharges(paymentRequestSid, payload.UpdatedBy || existing.UpdatedBy || existing.CreatedBy, tx);
      await this.validateSourceChargesForPaymentRequest(detailRows, payload, tx, paymentRequestSid);

      await tx.paymentRequest.update({
        where: { PaymentRequestSid: paymentRequestSid },
        data: {
          PaymentRequestDate: new Date(payload.PaymentRequestDate || payload.RequestDate || existing.PaymentRequestDate),
          CashBank: payload.CashBank || existing.CashBank,
          DepartmentMasterSid: Number(payload.DepartmentMasterSid),
          PaymentRequestStatus: payload.PaymentRequestStatus || existing.PaymentRequestStatus,
          Party: Number(payload.Party),
          PayableTo: payload.PayableTo || payload.PartyName || '',
          BookingSid: this.toNullableNumber(payload.BookingSid),
          MasterJobSid: this.toNullableNumber(payload.MasterJobSid),
          HouseJobSid: this.toNullableNumber(payload.HouseJobSid),
          Remarks: payload.Remarks || '',
          Status: payload.Status || existing.Status,
          UpdatedBy: payload.UpdatedBy || 'System',
        },
      });

      await tx.paymentRequestDetail.deleteMany({
        where: { PaymentRequestSid: paymentRequestSid },
      });

      await tx.paymentRequestDetail.createMany({
        data: detailRows.map((item: any, index: number) => ({
          PaymentRequestSid: paymentRequestSid,
          CompanyMasterSid: Number(payload.CompanyMasterSid),
          BranchMasterSid: Number(payload.BranchMasterSid),
          SerialNumber: index + 1,
          ChargeMasterSid: this.toNullableNumber(item.ChargeMasterSid),
          ChargeDescription: item.ChargeDescription || '',
          CostChargeUomSid: this.toNullableNumber(item.CostChargeUomSid || item.ChargeUOMSid),
          CostCurrencyMasterSid: this.toNullableNumber(item.CostCurrencyMasterSid),
          CostExchangeRate: this.toNullableDecimal(item.CostExchangeRate),
          CostRate: this.toNullableDecimal(item.CostRate),
          CostNumberOfUnit: this.toNullableDecimal(item.CostNumberOfUnit),
          CostDrCr: item.CostDrCr || 'D',
          CostAmount: this.toNullableDecimal(item.CostAmount),
          CostLocalAmount: this.toNullableDecimal(item.CostLocalAmount),
          CostAgentMasterSid: this.toNullableNumber(item.CostAgentMasterSid),
          CostAgentBranchSid: this.toNullableNumber(item.CostAgentBranchSid),
          CreatedBy: payload.UpdatedBy || existing.CreatedBy || 'System',
          UpdatedBy: payload.UpdatedBy || 'System',
        })),
      });

      await this.linkSourceCharges(detailRows, paymentRequestSid, payload.UpdatedBy || existing.CreatedBy, tx);

      return this.getPaymentRequestById(paymentRequestSid, tx);
    });
  }

  async getPaymentRequestById(paymentRequestSid: number, tx: any = this.db) {
    const header = await tx.paymentRequest.findUnique({
      where: { PaymentRequestSid: paymentRequestSid },
      include: {
        company: true,
        branch: true,
        dept: true,
        customer: true,
        bookingHeader: true,
        masterJob: true,
        houseJob: true,
        paymentRequestDetails: {
          orderBy: { PaymentRequestDtlSid: 'asc' },
          include: {
            Charge: true,
            currency: true,
            uomMaster: true,
            agent: true,
            agentBranch: true,
          },
        },
      },
    });

    if (!header) {
      throw new NotFoundException('Payment request not found');
    }

    const detailsWithSource = await Promise.all(
      (header.paymentRequestDetails || []).map(async (detail: any) => ({
        ...detail,
        sourceCostRevenueCharge: await this.findSourceCharge(header, detail, tx),
      })),
    );

    return {
      ...header,
      paymentRequestDetails: detailsWithSource,
    };
  }

  async searchPaymentRequests(params: filterDto) {
    const {
      search = '',
      page = 1,
      pageSize = 15,
      activeCompanyId,
      activeBranchId,
      sortColumn = 'PaymentRequestDate',
      sortDirection = 'desc',
    } = params;

    const skip = (Number(page) - 1) * Number(pageSize);
    const sortDirectionValue = sortDirection === 'asc' ? 'asc' : 'desc';
    const validRootSortColumns = new Set([
      'PaymentRequestNumber',
      'PaymentRequestDate',
      'CashBank',
      'PayableTo',
      'PaymentRequestStatus',
      'Status',
    ]);

    const orderByMap: Record<string, any> = {
      PaymentRequestNumber: { PaymentRequestNumber: sortDirectionValue },
      PaymentRequestDate: { PaymentRequestDate: sortDirectionValue },
      CashBank: { CashBank: sortDirectionValue },
      PayableTo: { PayableTo: sortDirectionValue },
      PaymentRequestStatus: { PaymentRequestStatus: sortDirectionValue },
      Status: { Status: sortDirectionValue },
      PartyName: { customer: { CustomerName: sortDirectionValue } },
      DepartmentName: { dept: { departmentName: sortDirectionValue } },
    };

    const resolvedSortColumn = validRootSortColumns.has(sortColumn)
      ? sortColumn
      : (orderByMap[sortColumn] ? sortColumn : 'PaymentRequestDate');

    const orderBy = orderByMap[resolvedSortColumn] || { PaymentRequestDate: sortDirectionValue };

    const where: Prisma.PaymentRequestWhereInput = {
      CompanyMasterSid: Number(activeCompanyId),
      ...(activeBranchId ? { BranchMasterSid: Number(activeBranchId) } : {}),
      ...(search
        ? {
            OR: [
              { PaymentRequestNumber: { contains: search, mode: 'insensitive' } },
              { PayableTo: { contains: search, mode: 'insensitive' } },
              { customer: { CustomerName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, totalCount] = await this.db.$transaction([
      this.db.paymentRequest.findMany({
        where,
        include: {
          customer: true,
          dept: true,
          paymentRequestDetails: {
            include: {
              currency: true,
            },
          },
        },
        skip,
        take: Number(pageSize),
        orderBy,
      }),
      this.db.paymentRequest.count({ where }),
    ]);

    return { items, totalCount };
  }
  async getApprovedPendingForPayment(companyMasterSid: number, branchMasterSid: number) {
    return this.db.paymentRequest.findMany({
      where: {
        CompanyMasterSid: companyMasterSid,
        BranchMasterSid: branchMasterSid,
        PaymentRequestStatus: ApprovalStatus.Approved,
        VoucherSid: null,
        Status: 'A',
      },
      include: {
          customer: true,
          dept: true,
          paymentRequestDetails: {
            include: {
              currency: true,
            },
          },
        },
      orderBy: { PaymentRequestDate: 'desc' },
    });
  }

  async linkVoucher(paymentRequestSid: number, voucherSid: number, updatedBy?: string) {
    const existing = await this.db.paymentRequest.findUnique({
      where: { PaymentRequestSid: paymentRequestSid },
    });

    if (!existing) {
      throw new NotFoundException('Payment request not found');
    }

    if (existing.PaymentRequestStatus !== ApprovalStatus.Approved) {
      throw new BadRequestException('Only approved payment requests can create payment voucher');
    }

    if (existing.VoucherSid && existing.VoucherSid !== voucherSid) {
      throw new BadRequestException('Payment voucher already created for this request');
    }

    return this.db.paymentRequest.update({
      where: { PaymentRequestSid: paymentRequestSid },
      data: {
        VoucherSid: voucherSid,
        UpdatedBy: updatedBy || 'System',
      },
    });
  }

  private validateHeader(payload: any) {
    if (!payload.CompanyMasterSid || !payload.BranchMasterSid) {
      throw new BadRequestException('Company and branch are required');
    }
    if (!payload.DepartmentMasterSid) {
      throw new BadRequestException('Department is required');
    }
    if (!payload.Party) {
      throw new BadRequestException('Party is required');
    }
    if (!payload.PayableTo) {
      throw new BadRequestException('Payable To is required');
    }
  }

  private getSelectedDetails(items: any[]) {
    return (items || []).filter((item) => {
      const selected = item?.Selected ?? item?.selected ?? item?.IsSelected;
      return selected === true || selected === 'Y' || selected === 1 || selected === '1';
    });
  }

private async generatePaymentRequestNumber(
  companyMasterSid: number,
  branchMasterSid: number,
  paymentDate: Date,
  tx: any,
) {
  try {
    const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
      where: {
        CompanyMasterSid: companyMasterSid,
        BranchMasterSid: branchMasterSid,
        DocumentTypeCode: 'PRQ',
        status: 'A',
      },
    });

    if (!voucherTypeMaster?.MenuMasterSid) {
      throw new BadRequestException('Payment request document type is not configured with a menu');
    }

    const currentYear = await tx.yearMaster.findFirst({
      where: {
        CompanyMasterSid: companyMasterSid,
        status: 'A',
        StartDate: { lte: paymentDate },
        EndDate: { gte: paymentDate },
      },
      select: { YearMasterSid: true },
    });

    const yearMasterSid = currentYear?.YearMasterSid || (await tx.yearMaster.findFirst({
      where: { CompanyMasterSid: companyMasterSid, CurrentYear: 'Y', status: 'A' },
      select: { YearMasterSid: true },
    }))?.YearMasterSid;

    if (!yearMasterSid) {
      throw new BadRequestException('Financial year not found');
    }

    return await this.voucherService.generateVoucherNumberFromConfig(
      voucherTypeMaster,
      companyMasterSid,
      branchMasterSid,
      yearMasterSid,
      tx,
      paymentDate,
    );
  } catch (error) {
    this.logger.warn(`Payment request number series fallback used: ${error?.message}`);
  }

  const count = await tx.paymentRequest.count({
    where: { CompanyMasterSid: companyMasterSid, BranchMasterSid: branchMasterSid },
  });

  return `PRQ-${branchMasterSid}-${String(count + 1).padStart(5, '0')}`;
}


  private async findSourceCharge(header: any, detail: any, tx: any) {
    const directSourceId =
      this.toNullableNumber(detail?.SourceCostRevenueChargeSid) ||
      this.toNullableNumber(detail?.sourceCostRevenueCharge?.CostRevenueChargesSid) ||
      this.toNullableNumber(detail?.sourceCostRevenueCharge?.RateSid);

    if (directSourceId) {
      return tx.costRevenueCharges.findFirst({
        where: {
          CostRevenueChargesSid: directSourceId,
          CompanyMasterSid: header.CompanyMasterSid,
          BranchMasterSid: header.BranchMasterSid,
        },
        include: {
          chargeCOAMaster: true,
          chargeSubledgerMaster: true,
          vendorCOAMaster: true,
          vendorSubledgerMaster: true,
          costCustomerMaster: true,
          costCustomerBranch: true,
        },
      });
    }

    const transactionCandidates = [
      this.toNullableNumber(header.BookingSid),
      this.toNullableNumber(header.MasterJobSid),
      this.toNullableNumber(header.HouseJobSid),
    ].filter(Boolean) as number[];

    return tx.costRevenueCharges.findFirst({
      where: {
        CompanyMasterSid: header.CompanyMasterSid,
        BranchMasterSid: header.BranchMasterSid,
        ...(transactionCandidates.length
          ? { TransactionSid: { in: transactionCandidates } }
          : {}),
        ChargeMasterSid: detail.ChargeMasterSid ?? undefined,
        CostAgentMasterSid: detail.CostAgentMasterSid ?? undefined,
        CostAgentBranchSid: detail.CostAgentBranchSid ?? undefined,
        CostCurrencyMasterSid: detail.CostCurrencyMasterSid ?? undefined,
        CostRate: detail.CostRate ?? undefined,
        CostAmount: detail.CostAmount ?? undefined,
        CostLocalAmount: detail.CostLocalAmount ?? undefined,
        status: 'A',
      },
      include: {
        chargeCOAMaster: true,
        chargeSubledgerMaster: true,
        vendorCOAMaster: true,
        vendorSubledgerMaster: true,
        costCustomerMaster: true,
        costCustomerBranch: true,
      },
    });
  }

  private async validateSourceChargesForPaymentRequest(
    detailRows: any[],
    payload: any,
    tx: any,
    currentPaymentRequestSid?: number,
  ) {
    const sourceChargeIds = this.extractSourceChargeIds(detailRows);
    if (!sourceChargeIds.length) {
      return;
    }

    const sourceRows = await tx.costRevenueCharges.findMany({
      where: {
        CostRevenueChargesSid: { in: sourceChargeIds },
        CompanyMasterSid: Number(payload.CompanyMasterSid),
        BranchMasterSid: Number(payload.BranchMasterSid),
      },
      select: {
        CostRevenueChargesSid: true,
        CostPrepaidCollect: true,
        CostVoucherHeaderSid: true,
        PaymentRequestSid: true,
        CostAmount: true,
      },
    });

    if (sourceRows.length !== sourceChargeIds.length) {
      throw new BadRequestException('Some source cost rows were not found');
    }

    const blockedVoucherRows = sourceRows.filter((row: any) => !!row.CostVoucherHeaderSid);
    if (blockedVoucherRows.length) {
      throw new BadRequestException('Payment request cannot be created because voucher already exists for one or more selected cost rows');
    }

    const blockedPaymentRequestRows = sourceRows.filter(
      (row: any) => !!row.PaymentRequestSid && row.PaymentRequestSid !== currentPaymentRequestSid,
    );
    if (blockedPaymentRequestRows.length) {
      throw new BadRequestException('Payment request already exists for one or more selected cost rows');
    }

    const invalidRows = sourceRows.filter(
      (row: any) =>
        String(row.CostPrepaidCollect || '').toLowerCase() !== 'prepaid' ||
        Number(row.CostAmount || 0) <= 0,
    );
    if (invalidRows.length) {
      throw new BadRequestException('Only prepaid cost rows can be used for payment request');
    }
  }

  private async linkSourceCharges(detailRows: any[], paymentRequestSid: number, updatedBy: string | undefined, tx: any) {
    const sourceChargeIds = this.extractSourceChargeIds(detailRows);
    if (!sourceChargeIds.length) {
      return;
    }

    await tx.costRevenueCharges.updateMany({
      where: {
        CostRevenueChargesSid: { in: sourceChargeIds },
      },
      data: {
        PaymentRequestSid: paymentRequestSid,
        updatedBy: updatedBy || 'System',
        updatedOn: new Date(),
      },
    });
  }

  private async unlinkExistingSourceCharges(paymentRequestSid: number, updatedBy: string | undefined, tx: any) {
    await tx.costRevenueCharges.updateMany({
      where: {
        PaymentRequestSid: paymentRequestSid,
      },
      data: {
        PaymentRequestSid: null,
        updatedBy: updatedBy || 'System',
        updatedOn: new Date(),
      },
    });
  }

  private extractSourceChargeIds(detailRows: any[]): number[] {
    return Array.from(
      new Set(
        (detailRows || [])
          .map((item: any) =>
            this.toNullableNumber(
              item?.SourceCostRevenueChargeSid ||
              item?.sourceCostRevenueCharge?.CostRevenueChargesSid ||
              item?.CostRevenueChargesSid,
            ),
          )
          .filter((value: number | null): value is number => value !== null),
      ),
    );
  }

  private toNullableNumber(value: any) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  private toNullableDecimal(value: any) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return new Prisma.Decimal(value);
  }
}




