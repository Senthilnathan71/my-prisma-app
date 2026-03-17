import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class VoucherCorrectionService {
  constructor(private _db: DatabaseService, private logger: Logger) { }

  async searchVoucher(params: filterDto) {
    const {
      search = '',
      page = 1,
      pageSize = 10,
      activeCompanyId,
      activeBranchId,
      dateFrom,
      DateFrom,
      dateTo,
      DateTo,
      dateField,
      DateField,
      VoucherTypeMasterSid,
      voucherTypeMasterSid,
      PartyName,
      partyName,
      CurrencyCode,
      currencyCode,
      CashOrBank,
      cashOrBank
    } = params as any;
    const skip = (page - 1) * pageSize;
    const resolvedDateFrom = dateFrom ?? DateFrom;
    const resolvedDateTo = dateTo ?? DateTo;
    const rawDateField = (dateField ?? DateField ?? '').toString();
    const allowedDateFields = ['VoucherDate', 'PostDate'];
    const selectedDateField = allowedDateFields.includes(rawDateField) ? rawDateField : 'VoucherDate';
    const parsedDateFrom = resolvedDateFrom ? new Date(resolvedDateFrom) : null;
    const parsedDateTo = resolvedDateTo ? new Date(resolvedDateTo) : null;
    const normalizedDateFrom = parsedDateFrom && !Number.isNaN(parsedDateFrom.getTime()) ? parsedDateFrom : null;
    const normalizedDateTo = parsedDateTo && !Number.isNaN(parsedDateTo.getTime()) ? parsedDateTo : null;
    const normalizedVoucherTypeSid = Number(VoucherTypeMasterSid ?? voucherTypeMasterSid ?? 0) || null;
    const normalizedPartyName = (PartyName ?? partyName ?? '').toString().trim();
    const normalizedCurrencyCode = (CurrencyCode ?? currencyCode ?? '').toString().trim();
    const normalizedCashOrBank = (CashOrBank ?? cashOrBank ?? '').toString().trim();
    let normalizedCashBank = "";
    if (String(search).trim() === 'cash' || String(search).trim() === 'Cash') {
      normalizedCashBank = "C";
    } else if (String(search).trim() === 'bank' || String(search).trim() === 'Bank') {
      normalizedCashBank = "D";
    }
    const isSearchTextANumber = !isNaN(Number(search)) && search.trim() !== '';
    const where: Prisma.VoucherHeaderWhereInput = {
      CompanyMasterSid: activeCompanyId,
      BranchMasterSid: activeBranchId,
      Status: statusWhereClause,
      PostStatus: 'P',
      voucherTypeMaster: {
        DocumentTypeCode: {
          not: 'RJV'
        }
      },
      ...(normalizedVoucherTypeSid && { VoucherTypeMasterSid: normalizedVoucherTypeSid }),
      ...(normalizedPartyName && { PartyName: { contains: normalizedPartyName, mode: 'insensitive' } }),
      ...(normalizedCurrencyCode && { CurrencyCode: normalizedCurrencyCode }),
      ...(normalizedCashOrBank && { CashOrBank: normalizedCashOrBank }),
      ...((normalizedDateFrom || normalizedDateTo) && {
        [selectedDateField]: {
          ...(normalizedDateFrom && { gte: normalizedDateFrom }),
          ...(normalizedDateTo && { lte: normalizedDateTo })
        }
      }),
      ...(search
        ? {
          OR: [
            { voucherTypeMaster: { DocumentTypeName: { contains: search, mode: 'insensitive' } } },
            { VoucherNumber: { contains: search, mode: 'insensitive' } },
            { PartyName: { contains: search, mode: 'insensitive' } },
            { CurrencyCode: { contains: search, mode: 'insensitive' } },
            { CashOrBank: { equals: normalizedCashBank, mode: 'insensitive' } },
            { CreatedBy: { contains: search, mode: 'insensitive' } },
            { PostStatus: { contains: search, mode: 'insensitive' } },
            { Status: { contains: search, mode: 'insensitive' } },
            ...(isSearchTextANumber ? [{ Amount: search }] : []),
            ...(!isNaN(new Date(search).getTime())
              ? [{ VoucherDate: new Date(search) }]
              : []),
            ...(!isNaN(new Date(search).getTime())
              ? [{ PostDate: new Date(search) }]
              : []),
          ]
        } : {}
      )
    };
    const [items, totalCount] = await this._db.$transaction([
      this._db.voucherHeader.findMany({
        where,
        include: {
          voucherTypeMaster: {
            select: {
              DocumentTypeName: true,
            }
          }
        },
        skip,
        take: pageSize,
        orderBy: { VoucherHeaderSid: 'desc' },
      }),
      this._db.voucherHeader.count({ where }),
    ]);
    return {
      items,
      totalCount,
    };
  }

  async updateVoucher(VoucherHeaderSid: number, payload: any) {
    try {
      return await this._db.$transaction(async (prisma) => {

        const {
          CompanyMasterSid,
          BranchMasterSid,
          YearMasterSid,
          VoucherDate,
          VoucherDetail = [],
          UpdatedBy,
        } = payload;

        if (!VoucherHeaderSid) {
          throw new BadRequestException('VoucherHeaderSid is required for update');
        }



        const existingHeader = await prisma.voucherHeader.findUnique({
          where: { VoucherHeaderSid },
        });

        if (!existingHeader) {
          throw new BadRequestException('Voucher not found');
        }



        const currentYear = await prisma.yearMaster.findFirst({
          where: {
            CompanyMasterSid,
            YearMasterSid,
            status: 'A',
          },
        });

        if (!currentYear) {
          throw new BadRequestException('Financial year not found');
        }

        const voucherDateObj = new Date(VoucherDate);
        const startDate = new Date(currentYear.StartDate);
        const endDate = new Date(currentYear.EndDate);

        if (voucherDateObj < startDate || voucherDateObj > endDate) {
          throw new BadRequestException(
            `Voucher date must be within financial year ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
          );
        }



        const updatedHeader = await prisma.voucherHeader.update({
          where: { VoucherHeaderSid },
          data: {
            VoucherDate: voucherDateObj,
            Narration: payload.Narration,
            Remarks: payload.Remarks,
            DocumentNumber: payload.DocumentNumber,
            DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : null,
            BankPartyName: payload.BankPartyName,
            InstrumentNumber: payload.InstrumentNumber || "",
            InstrumentDate: payload.InstrumentDate
              ? new Date(payload.InstrumentDate)
              : null,
            InstrumentMode: payload.InstrumentMode || "",
            UpdatedBy,
            UpdatedOn: new Date(),
          },
        });



        const updatedDetails = await Promise.all(
          VoucherDetail.map(async (item: any) => {

            if (!item.VoucherDetailSid) return null;

            return prisma.voucherDetail.update({
              where: { VoucherDetailSid: item.VoucherDetailSid },
              data: {
                ChargeDescription: item.ChargeDescription || null,
                Narration: item.Narration || "",
                Remarks: item.Remarks || "",
                UpdatedBy,
                UpdatedOn: new Date(),
              },
            });
          })
        );



        const existingTransactions = await prisma.voucherTransaction.findMany({
          where: { VoucherHeaderSid },
        });

        const updatedTransactions = await Promise.all(
          existingTransactions.map(async (transaction) => {

            const matchingDetail = VoucherDetail.find(
              (d: any) =>
                d.VoucherDetailSid === transaction.VoucherDetailSid
            );

            return prisma.voucherTransaction.update({
              where: {
                VoucherTransactionSid:
                  transaction.VoucherTransactionSid,
              },
              data: {
                VoucherDate: voucherDateObj,
                ChargeDescription:
                  matchingDetail?.ChargeDescription || null,
                Narration:
                  matchingDetail?.Narration || "",
                UpdatedBy,
                UpdatedOn: new Date(),
              },
            });
          })
        );



        return {
          status: true,
          message: 'Voucher updated successfully',
          data: {
            voucherHeader: updatedHeader,
            details: updatedDetails,
            transactions: updatedTransactions,
          },
        };

      }, { timeout: 60000 });

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        error.message || 'Failed to update voucher'
      );
    }
  }


  async findVoucherById(VoucherHeaderSid: number) {
    try {
      const voucherHeader = await this._db.voucherHeader.findUnique({
        where: { VoucherHeaderSid: VoucherHeaderSid, Status: statusWhereClause },
        include: {
          VoucherDetail: {
            where: { Status: 'A' },
            include: {
              chargeMaster: {
                include: {
                  chargeTaxMaster: {
                    select: {
                      ChargeTaxMasterSid: true,
                      HSNCode: true,
                      description: true,
                      TaxGroup: true,
                      TaxRate: true
                    }
                  }
                }
              },
              currencyMaster: true,
              hSSACMaster: true,
            },
            orderBy: {
              Sno: 'asc'
            }
          },
          VoucherOthers: { where: { Status: 'A' } },
          masterJob: {
            where: { Status: 'A' },
            include: {
              voyages: {
                where: { Status: 'A' }
              }
            }
          },
          houseJob: {
            where: { status: 'A' },
            include: {
              Cargo: {
                select: {
                  NoOfPackage: true,
                  GrossWeight: true,
                  Volume: true,
                  ChargeableWeight: true,
                  CommodityDescription: true
                }
              },
              Others: {
                select: {
                  YardCFS: true,
                  CustomerRefNo: true,
                }
              },
              Products: {
                select: {
                  ShippingBillNo: true,
                }
              }
            }
          },
          BookingHeader: {
            select: {
              BookingHeaderSid: true,
              BookingNo: true,
              VesselName: true,
              VoyageNo: true,
              POL: true,
              POD: true,
              FPD: true,
              ETD: true,
              ETA: true,
              FreightTerms: true,
              ShipperName: true,
              ShipperAddress: true,
              ConsigneeName: true,
              ConsigneeAddress: true,
              CustomerName: true,
              CustomerAddress: true,
              SalesmanSid: true,
              DepartmentMasterSid: true,
              bookingCargo: {
                where: {
                  status: 'A'
                },
                select: {
                  NoOfPackage: true,
                  GrossWeight: true,
                  Volume: true,
                  ChargeableWeight: true
                }
              }
            }
          },
          currencyMaster: true,
          subledgerMaster: true,
          customerBranch: true,
          departmentMaster: true,
          voucherTypeMaster: {
            select: {
              DocumentTypeCode: true,
            }
          },
          VoucherTransaction: true,

        }
      });

      if (!voucherHeader) {
        throw new BadRequestException('Voucher not found');
      }

      if (voucherHeader.ReversalVoucher) {
        // Checking if any other credit note is created against this vendor invoice
        const reversalVoucher = await this._db.voucherHeader.findFirst({
          where: {
            AND: [
              { VoucherHeaderSid: voucherHeader.ReversalVoucher },
            ]
          },
          select: {
               VoucherHeaderSid: true,
               VoucherNumber: true,
          }
        })

        if (!reversalVoucher) {
          return voucherHeader;
        }

        return {
          ...voucherHeader,
          reversalVoucher
        }
      }

      return voucherHeader;
    } catch (error) {
      this.logger.error('findVoucherHeaderById error', error);
      throw new InternalServerErrorException("Something Went Wrong while fetching the data");
    }
  }
}
