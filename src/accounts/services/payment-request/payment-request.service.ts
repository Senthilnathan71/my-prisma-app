import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class PaymentRequestService {
  constructor(
    private readonly db: DatabaseService,
    private readonly logger: Logger,
  ) {}

  async createPaymentRequest(payload: any) {
    try {
      this.validateHeader(payload);
      const detailRows = this.getSelectedDetails(payload.detailItems || payload.paymentRequestDetails || []);

      if (!detailRows.length) {
        throw new BadRequestException('Please select at least one prepaid cost row');
      }

      return await this.db.$transaction(async (tx) => {
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
            Party: this.toNullableNumber(payload.Party) ?? null,
            PayableTo: payload.PayableTo || payload.PartyName || '',
            BookingSid: this.toNullableNumber(payload.BookingSid),
            MasterJobSid: this.toNullableNumber(payload.MasterJobSid),
            HouseJobSid: this.toNullableNumber(payload.HouseJobSid),
            Remarks: payload.Remarks || '',
            Status: payload.Status || 'A',
            CreatedBy: payload.CreatedBy || 'System',
          },
        });

        const paymentRequestDetails = detailRows.map((item: any, index: number) =>
          this.mapPaymentRequestDetail(item, payload, index + 1, payload.CreatedBy || 'System'),
        );

        await tx.paymentRequestDetail.createMany({
          data: paymentRequestDetails.map((item: any) => ({
            ...item,
            PaymentRequestSid: header.PaymentRequestSid,
          })),
        });

        await this.linkSourceCharges(
          detailRows,
          header.PaymentRequestSid,
          payload.UpdatedBy || payload.CreatedBy,
          tx,
          payload,
        );

        return this.getPaymentRequestById(header.PaymentRequestSid, tx);
      });
    } catch (error) {
      this.logger.error(`createPaymentRequest failed: ${error?.message || error}`);
      throw error;
    }
  }

  async updatePaymentRequest(paymentRequestSid: number, payload: any) {
    this.validateHeader(payload);
    const existing = await this.db.paymentRequest.findUnique({
      where: { PaymentRequestSid: paymentRequestSid },
      include: {
        paymentRequestDetails: true,
      },
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
      await this.unlinkExistingSourceCharges(
        paymentRequestSid,
        payload.UpdatedBy || existing.UpdatedBy || existing.CreatedBy,
        tx,
        payload,
      );
      await this.validateSourceChargesForPaymentRequest(detailRows, payload, tx, paymentRequestSid);

      await tx.paymentRequest.update({
        where: { PaymentRequestSid: paymentRequestSid },
        data: {
          PaymentRequestDate: new Date(payload.PaymentRequestDate || payload.RequestDate || existing.PaymentRequestDate),
          CashBank: payload.CashBank || existing.CashBank,
          DepartmentMasterSid: Number(payload.DepartmentMasterSid),
          PaymentRequestStatus: payload.PaymentRequestStatus || existing.PaymentRequestStatus,
          Party: this.toNullableNumber(payload.Party) ?? 0,
          PayableTo: payload.PayableTo || payload.PartyName || '',
          BookingSid: this.toNullableNumber(payload.BookingSid),
          MasterJobSid: this.toNullableNumber(payload.MasterJobSid),
          HouseJobSid: this.toNullableNumber(payload.HouseJobSid),
          Remarks: payload.Remarks || '',
          Status: payload.Status || existing.Status,
          UpdatedBy: payload.UpdatedBy || 'System',
          UpdatedOn: new Date()
        },
      });

      const existingDetails = existing.paymentRequestDetails || [];
      const existingDetailMap = new Map(
        existingDetails.map((detail: any) => [detail.PaymentRequestDtlSid, detail]),
      );
      const incomingDetailIds = new Set<number>();

      for (let index = 0; index < detailRows.length; index++) {
        const item = detailRows[index];
        const detailData = this.mapPaymentRequestDetail(
          item,
          payload,
          index + 1,
          payload.UpdatedBy || existing.CreatedBy || 'System',
          payload.UpdatedBy || 'System',
        );
        const detailSid = this.toNullableNumber(item?.PaymentRequestDtlSid);

        if (detailSid && existingDetailMap.has(detailSid)) {
          incomingDetailIds.add(detailSid);
          await tx.paymentRequestDetail.update({
            where: { PaymentRequestDtlSid: detailSid },
            data: detailData,
          });
          continue;
        }

        const createdDetail = await tx.paymentRequestDetail.create({
          data: {
            ...detailData,
            PaymentRequestSid: paymentRequestSid,
          },
        });

        if (createdDetail?.PaymentRequestDtlSid) {
          incomingDetailIds.add(createdDetail.PaymentRequestDtlSid);
        }
      }

      const detailIdsToDelete = existingDetails
        .filter((detail: any) => !incomingDetailIds.has(detail.PaymentRequestDtlSid))
        .map((detail: any) => detail.PaymentRequestDtlSid);

      if (detailIdsToDelete.length) {
        await tx.paymentRequestDetail.deleteMany({
          where: {
            PaymentRequestDtlSid: { in: detailIdsToDelete },
          },
        });
      }

      await this.linkSourceCharges(
        detailRows,
        paymentRequestSid,
        payload.UpdatedBy || existing.CreatedBy,
        tx,
        payload,
      );

      return this.getPaymentRequestById(paymentRequestSid, tx);
    });
  }

  async getPaymentRequestById(paymentRequestSid: number, tx: any = this.db) {
    const header = await tx.paymentRequest.findUnique({
      where: { PaymentRequestSid: paymentRequestSid },
      include: {
        bookingHeader: true,
        masterJob: true,
        houseJob: true,
        paymentRequestDetails: {
          orderBy: { PaymentRequestDtlSid: 'asc' },
          include: {
            agent: true,
            agentBranch: true,
            Charge: true,
            uomMaster: true,
            currency: true,
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

    const voucherNumber = header.VoucherSid
      ? (await tx.voucherHeader.findUnique({
          where: { VoucherHeaderSid: header.VoucherSid },
          select: { VoucherNumber: true },
        }))?.VoucherNumber ?? null
      : null;

    return {
      ...header,
      paymentRequestDetails: detailsWithSource,
      VoucherNumber: voucherNumber,
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

  async suspendCharges(paymentRequestSid: number, chargeIds: number[]) {
    if (!chargeIds.length) return;
    await this.db.$transaction([
      this.db.bookingRates.updateMany({
        where: {
          BookingRatesSid: { in: chargeIds },
          PaymentRequestSid: paymentRequestSid,
        },
        data: { PaymentRequestSid: null },
      }),
      this.db.costRevenueCharges.updateMany({
        where: {
          CostRevenueChargesSid: { in: chargeIds },
          PaymentRequestSid: paymentRequestSid,
        },
        data: { PaymentRequestSid: null },
      }),
    ]);
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
        UpdatedOn: new Date()
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
  const voucherTypeMaster = await tx.voucherTypeMaster.findFirst({
    where: {
      CompanyMasterSid: companyMasterSid,
      BranchMasterSid: branchMasterSid,
      DocumentTypeCode: 'PRQ',
      status: 'A',
    },
  });

  if (!voucherTypeMaster) {
    throw new BadRequestException('Active VoucherTypeMaster not found for payment request');
  }

  const currentYear = await tx.yearMaster.findFirst({
    where: {
      CompanyMasterSid: companyMasterSid,
      status: 'A',
      StartDate: { lte: paymentDate },
      EndDate: { gte: paymentDate },
    },
    select: { YearMasterSid: true, StartDate: true, EndDate: true },
  });

  const fallbackYear = await tx.yearMaster.findFirst({
    where: { CompanyMasterSid: companyMasterSid, CurrentYear: 'Y', status: 'A' },
    select: { YearMasterSid: true, StartDate: true, EndDate: true },
  });

  const financialYear = currentYear || fallbackYear;
  if (!financialYear?.YearMasterSid) {
    throw new BadRequestException('Financial year not found');
  }

  return this.generatePaymentRequestNumberFromConfig(
    voucherTypeMaster,
    companyMasterSid,
    branchMasterSid,
    paymentDate,
    financialYear,
    tx,
  );
}

private async generatePaymentRequestNumberFromConfig(
  voucherTypeMaster: any,
  companyMasterSid: number,
  branchMasterSid: number,
  paymentDate: Date,
  financialYear: { YearMasterSid: number; StartDate: Date; EndDate: Date },
  tx: any,
): Promise<string> {
  await tx.$queryRawUnsafe(`
    SELECT "VoucherTypeMasterSid"
    FROM "VoucherTypeMaster"
    WHERE "VoucherTypeMasterSid" = ${voucherTypeMaster.VoucherTypeMasterSid}
    FOR UPDATE
  `);

  const parts: string[] = [];
  const separatorRaw = voucherTypeMaster.DocumentSeparator?.trim() ?? '-';
  const separator = separatorRaw === 'None' || separatorRaw === '' ? '' : separatorRaw;
  const date = new Date(paymentDate);
  const resetValue = voucherTypeMaster.ResetValue?.toLowerCase()?.replace(/\s+/g, '');

  if (voucherTypeMaster.CompanyFlag === 'Y') {
    const company = await tx.companyMaster.findUnique({
      where: { CompanyMasterSid: companyMasterSid },
      select: { companyCode: true },
    });
    const companyValue = (voucherTypeMaster.CompanyValue || company?.companyCode || 'CO').trim();
    parts.push(companyValue.substring(0, 3));
  }

  if (voucherTypeMaster.BranchFlag === 'Y') {
    const branch = await tx.branchMaster.findUnique({
      where: { BranchMasterSid: branchMasterSid },
      select: { branchCode: true },
    });
    const branchValue = (voucherTypeMaster.BranchValue || branch?.branchCode || 'BR').trim();
    parts.push(branchValue.substring(0, 3));
  }

  if (voucherTypeMaster.DocumentFlag === 'Y') {
    const docValue = (voucherTypeMaster.DocumentValue || voucherTypeMaster.DocumentTypeCode || 'DOC').trim();
    parts.push(docValue.substring(0, 5));
  }

  if (voucherTypeMaster.YearFlag === 'Y') {
    parts.push(date.getFullYear().toString().substring(2, 4));
  }

  const partsBeforeMonth = [...parts];

  if (voucherTypeMaster.MonthFlag === 'Y') {
    parts.push((date.getMonth() + 1).toString().padStart(2, '0'));
  }

  const displayPrefix = parts.join(separator);
  let queryPrefixParts = [...parts];
  if (resetValue === 'year' && voucherTypeMaster.MonthFlag === 'Y') {
    queryPrefixParts = partsBeforeMonth;
  }
  const queryPrefix = queryPrefixParts.join(separator);

  const whereConditions: string[] = [
    `"CompanyMasterSid" = ${companyMasterSid}`,
    `"BranchMasterSid" = ${branchMasterSid}`,
  ];

  const escapedQueryPrefix = queryPrefix.replace(/'/g, "''");
  whereConditions.push(`"PaymentRequestNumber" LIKE '${escapedQueryPrefix}${separator}%'`);

  if (resetValue === 'financialyear') {
    const fyStartDate = new Date(financialYear.StartDate).toISOString().split('T')[0];
    const fyEndDate = new Date(financialYear.EndDate).toISOString().split('T')[0];
    whereConditions.push(`"PaymentRequestDate"::date >= '${fyStartDate}'::date`);
    whereConditions.push(`"PaymentRequestDate"::date <= '${fyEndDate}'::date`);
  }

  const slNoLength = Number(voucherTypeMaster.DocumentSLNoLength || 5);
  const whereClause = whereConditions.join(' AND ');
  const query = `
    SELECT "PaymentRequestNumber"
    FROM "PaymentRequest"
    WHERE ${whereClause}
    ORDER BY CAST(RIGHT("PaymentRequestNumber", ${slNoLength}) AS INTEGER) DESC
    LIMIT 1
    FOR UPDATE
  `;

  const result: any[] = await tx.$queryRawUnsafe(query);
  const lastPaymentRequest = result[0];

  let nextNumber = Number(voucherTypeMaster.DocumentStartingNo || 1);
  if (lastPaymentRequest?.PaymentRequestNumber) {
    const prefixToStrip = displayPrefix + separator;
    const serialPart = lastPaymentRequest.PaymentRequestNumber.substring(prefixToStrip.length);
    const parsed = parseInt(serialPart, 10);
    if (!isNaN(parsed)) {
      nextNumber = parsed + 1;
    }
  }

  parts.push(String(nextNumber).padStart(slNoLength, '0'));
  const paymentRequestNumber = parts.join(separator);

  if (paymentRequestNumber.length > 20) {
    throw new BadRequestException(`Generated payment request number exceeds 20 characters: ${paymentRequestNumber}`);
  }

  return paymentRequestNumber;
}


  private async findSourceCharge(header: any, detail: any, tx: any) {
    const directSourceId =
      this.toNullableNumber(detail?.BookingRatesSid) ||
      this.toNullableNumber(detail?.CostRevenueChargesSid) ||
      this.toNullableNumber(detail?.SourceCostRevenueChargeSid) ||
      this.toNullableNumber(detail?.sourceCostRevenueCharge?.CostRevenueChargesSid) ||
      this.toNullableNumber(detail?.sourceCostRevenueCharge?.BookingRatesSid) ||
      this.toNullableNumber(detail?.sourceCostRevenueCharge?.RateSid);

    const isBookingSource = this.isBookingPaymentRequest(header);

    if (directSourceId) {
      if (isBookingSource) {
        return tx.bookingRates.findFirst({
          where: {
            BookingRatesSid: directSourceId,
            CompanyMasterSid: header.CompanyMasterSid,
            BranchMasterSid: header.BranchMasterSid,
          },
        });
      }

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

    if (isBookingSource) {
      return tx.bookingRates.findFirst({
        where: {
          CompanyMasterSid: header.CompanyMasterSid,
          BranchMasterSid: header.BranchMasterSid,
          ...(transactionCandidates.length
            ? { BookingHeaderSid: { in: transactionCandidates } }
            : {}),
          ChargeMasterSid: detail.ChargeMasterSid ?? undefined,
          AgentMasterSid: detail.CostAgentMasterSid ?? undefined,
          AgentBranchSid: detail.CostAgentBranchSid ?? undefined,
          CostCurrencyMasterSid: detail.CostCurrencyMasterSid ?? undefined,
          CostRate: detail.CostRate ?? undefined,
          CostAmount: detail.CostAmount ?? undefined,
          CostLocalAmount: detail.CostLocalAmount ?? undefined,
          Status: 'A',
        },
      });
    }

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

    const isBookingSource = this.isBookingPaymentRequest(payload);
    const sourceRows = isBookingSource
      ? await tx.bookingRates.findMany({
          where: {
            BookingRatesSid: { in: sourceChargeIds },
            CompanyMasterSid: Number(payload.CompanyMasterSid),
            BranchMasterSid: Number(payload.BranchMasterSid),
          },
          select: {
            BookingRatesSid: true,
            CostPrepaidCollect: true,
            CostVoucherHeaderSid: true,
            PaymentRequestSid: true,
            CostAmount: true,
          },
        })
      : await tx.costRevenueCharges.findMany({
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

  private async linkSourceCharges(
    detailRows: any[],
    paymentRequestSid: number,
    updatedBy: string | undefined,
    tx: any,
    payload?: any,
  ) {
    const sourceChargeItems = this.extractSourceChargeItems(detailRows);
    if (!sourceChargeItems.length) {
      return;
    }

    const isBookingSource = this.isBookingPaymentRequest(payload);

    await Promise.all(
      sourceChargeItems.map((item) =>
        isBookingSource
          ? tx.bookingRates.update({
              where: {
                BookingRatesSid: item.sourceChargeId,
              },
              data: {
                PaymentRequestSid: paymentRequestSid,
                CostExchangeRate: this.toNullableDecimal(item.CostExchangeRate),
                CostRate: this.toNullableDecimal(item.CostRate),
                CostNumberOfUnit: this.toNullableDecimal(item.CostNumberOfUnit),
                CostAmount: this.toNullableDecimal(item.CostAmount),
                CostLocalAmount: this.toNullableDecimal(item.CostLocalAmount),
                UpdatedBy: updatedBy || 'System',
                UpdatedOn: new Date(),
              },
            })
          : tx.costRevenueCharges.update({
              where: {
                CostRevenueChargesSid: item.sourceChargeId,
              },
              data: {
                PaymentRequestSid: paymentRequestSid,
                CostExchangeRate: this.toNullableDecimal(item.CostExchangeRate),
                CostRate: this.toNullableDecimal(item.CostRate),
                CostNumberOfUnit: this.toNullableDecimal(item.CostNumberOfUnit),
                CostAmount: this.toNullableDecimal(item.CostAmount),
                CostLocalAmount: this.toNullableDecimal(item.CostLocalAmount),
                updatedBy: updatedBy || 'System',
                updatedOn: new Date(),
              },
            }),
      ),
    );
  }

  private async unlinkExistingSourceCharges(
    paymentRequestSid: number,
    updatedBy: string | undefined,
    tx: any,
    payload?: any,
  ) {
    if (this.isBookingPaymentRequest(payload)) {
      await tx.bookingRates.updateMany({
        where: {
          PaymentRequestSid: paymentRequestSid,
        },
        data: {
          PaymentRequestSid: null,
          UpdatedBy: updatedBy || 'System',
          UpdatedOn: new Date(),
        },
      });
      return;
    }

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
              item?.BookingRatesSid ||
              item?.CostRevenueChargesSid ||
              item?.SourceCostRevenueChargeSid ||
              item?.sourceCostRevenueCharge?.CostRevenueChargesSid ||
              item?.sourceCostRevenueCharge?.BookingRatesSid,
            ),
          )
          .filter((value: number | null): value is number => value !== null),
      ),
    );
  }

  private extractSourceChargeItems(detailRows: any[]) {
    return (detailRows || [])
      .map((item: any) => ({
        ...item,
        sourceChargeId: this.toNullableNumber(
          item?.BookingRatesSid ||
          item?.CostRevenueChargesSid ||
          item?.SourceCostRevenueChargeSid ||
          item?.sourceCostRevenueCharge?.CostRevenueChargesSid ||
          item?.sourceCostRevenueCharge?.BookingRatesSid,
        ),
      }))
      .filter((item: any) => item.sourceChargeId);
  }

  private isBookingPaymentRequest(payload: any) {
    return !!this.toNullableNumber(payload?.BookingSid)
      && !this.toNullableNumber(payload?.MasterJobSid)
      && !this.toNullableNumber(payload?.HouseJobSid);
  }

  private mapPaymentRequestDetail(
    item: any,
    payload: any,
    serialNumber: number,
    createdBy: string,
    updatedBy?: string,
  ) {
    return {
      CompanyMasterSid: Number(payload.CompanyMasterSid),
      BranchMasterSid: Number(payload.BranchMasterSid),
      SerialNumber: serialNumber,
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
      COAMasterSid:          this.toNullableNumber(item.COAMasterSid),
      LedgerMasterSid:       this.toNullableNumber(item.LedgerMasterSid),
      BookingRatesSid:       this.toNullableNumber(item.BookingRatesSid),
      CostRevenueChargesSid: this.toNullableNumber(item.CostRevenueChargesSid),
      CreatedBy: createdBy,
      ...(updatedBy ? { UpdatedBy: updatedBy } : {}),
      UpdatedOn: new Date()
    };
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





