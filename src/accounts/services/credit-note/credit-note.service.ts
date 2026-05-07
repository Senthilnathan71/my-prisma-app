import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { VoucherService } from '../voucher/voucher.service';
import { VoucherPeriodService } from 'src/accounts/services/voucher-period/voucher-period.service';
import { PullVoucherDTO } from 'src/accounts/dto/voucher.dto';
import { roundAmount, statusWhereClause, toNumber } from 'src/common/helper';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';

@Injectable()
export class CreditNoteService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
    private voucherService: VoucherService,
    private voucherPeriodService: VoucherPeriodService,
  ) { }

  // Helper method to get CurrencyMasterSid by CurrencyCode
  private async getCurrencyMasterIdByCode(currencyCode: string, prisma: any): Promise<number | null> {
    if (!currencyCode) return null;

    try {
      const currency = await prisma.currencyMaster.findFirst({
        where: {
          CurrencyCode: currencyCode,
          Status: 'A'
        },
        select: { CurrencyMasterSid: true }
      });

      return currency ? currency.CurrencyMasterSid : null;
    } catch (error) {
      this.logger.warn(`Failed to find currency for code: ${currencyCode}`, error);
      return null;
    }
  }

  /**
   * Resolve PartyName into a string suitable for DB:
   * - If payload.PartyName is numeric (branch id) => lookup customerBranch and return Address || BranchName || string(id)
   * - Else if payload.CustomerBranchSid is present => same lookup
   * - Else return the payload.PartyName converted to string (if present) or null
   */
  private async resolvePartyName(payload: any, prisma: any): Promise<string | null> {
    try {
      // If PartyName is present and numeric -> treat as branch id
      if (payload && payload.PartyName != null) {
        const p = payload.PartyName;
        // treat numeric-like strings also as numbers
        const asNum = (typeof p === 'number') ? p : (typeof p === 'string' && p.trim() !== '' && !isNaN(Number(p)) ? Number(p) : null);
        if (asNum != null) {
          const branch = await prisma.customerBranch.findUnique({
            where: { CustomerBranchSid: Number(asNum) } as any,
            select: { Address: true, BranchName: true }
          });
          if (branch) {
            return String(branch.Address || branch.BranchName || asNum);
          }
          // if branch not found, fallback to stringified numeric id
          return String(asNum);
        }

        // If PartyName is already a string (non-numeric) use it
        if (typeof p === 'string') {
          return p;
        }

        // For other object shapes, try to extract meaningful string fields
        if (typeof p === 'object' && p !== null) {
          if ('Address' in p && p.Address) return String(p.Address);
          if ('CustomerBranchName' in p && p.CustomerBranchName) return String(p.CustomerBranchName);
          if ('PartyName' in p && p.PartyName) return String(p.PartyName);
        }
      }

      // If PartyName not provided, check CustomerBranchSid
      if (payload && payload.CustomerBranchSid != null) {
        const cb = payload.CustomerBranchSid;
        const asNum = Number(cb);
        if (!isNaN(asNum)) {
          const branch = await prisma.customerBranch.findUnique({
            where: { CustomerBranchSid: asNum } as any,
            select: { Address: true, BranchName: true }
          });
          if (branch) return String(branch.Address || branch.BranchName || asNum);
          return String(asNum);
        }
      }

      return null;
    } catch (err) {
      this.logger.warn('resolvePartyName failed', err);
      // fallback: try to stringify whatever was provided
      if (payload && payload.PartyName != null) return String(payload.PartyName);
      if (payload && payload.CustomerBranchSid != null) return String(payload.CustomerBranchSid);
      return null;
    }
  }

  async allInvoices(CompanyMasterSid: number) {
    try {
      const result = await this._db.voucherHeader.findMany({
        where: {
          Status: 'A',
          PostStatus: 'P',
          voucherTypeMaster: {
            DocumentTypeName: DOC_TYPE_CODE.INVOICE
          },
          CompanyMasterSid: CompanyMasterSid,
        },
        include: {
          masterJob: { select: { MasterJobNumber: true } },
          houseJob: { select: { HouseNo: true } }
        }
      });
      return result;
    } catch (error) {
      this.logger.error('fetchInvoices error', error);
      throw new InternalServerErrorException("Something Went Wrong while fetching the data");
    }
  }

  async findInvoiceById(VoucherHeaderSid: number) {
    try {
      const voucherHeader = await this._db.voucherHeader.findUnique({
        where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' } as any,
        include: {
          VoucherOthers: { where: { Status: 'A' } },
          masterJob: { where: { Status: 'A' } },
          houseJob: { where: { status: 'A' } },
          currencyMaster: true,
          subledgerMaster: true,
          customerBranch: {
            include: {
              stateMaster: {
                select: { StateMasterSid: true, stateName: true, IsUnionTerritory: true }
              }
            }
          },
          departmentMaster: true,
          voucherTypeMaster: true,
          VoucherTransaction: {
            where: {
              OR: [
                { IsAutoGenerated: 'N' },
                { IsAutoGenerated: null }
              ]
            },
            include: {
              voucherDetail: true
            }
          }
        }
      });

      if (!voucherHeader) {
        throw new BadRequestException('Voucher not found');
      }

      return voucherHeader;
    } catch (error) {
      this.logger.error('findVoucherHeaderById error', error);
      throw new InternalServerErrorException("Something Went Wrong while fetching the data");
    }
  }

  async fetchCreditNotes() {
    try {
      const result = await this._db.voucherHeader.findMany({
        where: {
          voucherTypeMaster: {
            DocumentTypeCode: DOC_TYPE_CODE.CREDIT_NOTE
          },
          Status: 'A'
        },
        include: {
          VoucherDetail: { where: { Status: 'A' } },
          VoucherOthers: { where: { Status: 'A' } },
          masterJob: true,
          houseJob: true,
          currencyMaster: true,
          subledgerMaster: true,
          voucherTypeMaster: true,
        }
      });
      return result;
    } catch (error) {
      this.logger.error('fetchInvoices error', error);
      throw new InternalServerErrorException("Something Went Wrong while fetching the data");
    }
  }

  async findVoucherHeaderById(VoucherHeaderSid: number) {
    try {
      const creditNote = await this._db.voucherHeader.findUnique({
        where: { VoucherHeaderSid: VoucherHeaderSid },
        include: {
          VoucherDetail: {
            where: { Status: 'A' },
            include: {
              chargeMaster: {
                include: {
                  chargeTaxMaster: true
                },
              },
              currencyMaster: true,
              hSSACMaster: true,
            },
            orderBy: {
              Sno: 'asc'
            }
          },
          VoucherOthers: { where: { Status: 'A' } },
          masterJob: { where: { Status: 'A' } },
          houseJob: { where: { status: 'A' }, include: { Cargo: true } },
          BookingHeader: { where: { status: 'A' }, include: { bookingCargo: true } },
          currencyMaster: true,
          subledgerMaster: true,
          customerBranch: true,
          departmentMaster: true
        }
      });

      if (!creditNote) {
        throw new BadRequestException('Voucher not found');
      }

      if (creditNote.ReversalVoucher) {
        // Checking if any other credit note is created against this vendor invoice
        const reversalVoucher = await this._db.voucherHeader.findFirst({
          where: {
            AND: [
              { VoucherHeaderSid: creditNote.ReversalVoucher },
              { voucherTypeMaster: { DocumentTypeCode: DOC_TYPE_CODE.INVOICE } },
              { PostStatus: 'P' },
            ]
          },
          select: {
            VoucherHeaderSid: true,
            VoucherNumber: true,
            VoucherDetail: {
              select: {
                VoucherDetailSid: true,
                Rate: true,
                CostRevenueChargesSid: true
              }
            }
          }
        })

        // If no reversal voucher found, return original vendor credit note
        if (!reversalVoucher) {
          return creditNote;
        }

        return {
          ...creditNote,
          reversalVoucher
        }
      }

      return creditNote;
    } catch (error) {
      throw error;
    }
  }

  async createCreditNote(payload: any) {
    try {
      // Validate period before creating credit note (AR module)
      const periodValidation = await this.voucherPeriodService.validateVoucherPeriod({
        voucherDate: payload.VoucherDate || new Date(),
        module: 'AR',
        CompanyMasterSid: payload.CompanyMasterSid,
        BranchMasterSid: payload.BranchMasterSid
      });
      if (!periodValidation.allowed) {
        throw new BadRequestException(periodValidation.message);
      }

      return await this._db.$transaction(async (prisma) => {
        // Fetch VoucherTypeMaster for Credit Note
        const voucherTypeMaster = await prisma.voucherTypeMaster.findFirst({
          where: {
            DocumentTypeCode: DOC_TYPE_CODE.CREDIT_NOTE,
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            status: 'A'
          }
        });

        if (!voucherTypeMaster) {
          throw new BadRequestException(
            'Credit Note voucher type not configured. Please configure "Credit Note" in VoucherTypeMaster for this company/branch.'
          );
        }

        // Generate Voucher Number using config-based approach
        const VoucherNumber = await this.voucherService.generateVoucherNumberFromConfig(
          voucherTypeMaster,
          payload.CompanyMasterSid,
          payload.BranchMasterSid,
          payload.YearMasterSid,
          prisma,
          payload.VoucherDate ? new Date(payload.VoucherDate) : undefined
        );

        // Create VoucherHeader
        const voucherHeader = await prisma.voucherHeader.create({
          data: {
            VoucherNumber: VoucherNumber,
            VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
            // TODO - need to remove
            UpdatedOn: new Date(),
            PostDate: null,
            VoucherType: voucherTypeMaster.VoucherTypeMasterSid,
            Narration: payload.Narration || '',
            COAMasterSid: payload.COAMasterSid,
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
            PartyMasterSid: payload.PartyMasterSid, // Vendor SubledgerMasterSid
            PartyName: payload.PartyName || '',
            PartyAddress: payload.PartyAddress || '',
            CustomerBranchSid: payload.CustomerBranchSid,
            PostStatus: payload.PostStatus,
            PlaceOfSupply: payload.PlaceOfSupply,
            GST_VAT: payload.GSTNo || payload.GST_VAT,
            InvoiceType: payload.InvoiceType || 'B2B',
            GSTType: payload.GSTType,
            CurrencyMasterSid: payload.CurrencyMasterSid,
            CurrencyCode: payload.CurrencyCode,
            ExchangeRate: payload.ExchangeRate || 1,
            DocumentNumber: payload.BillNo || payload.DocumentNumber,
            DocumentDate: payload.BillDate ? new Date(payload.BillDate) : null,
            Amount: payload.BillAmt || payload.Amount,
            BookingHeaderSid: payload.BookingHeaderSid || null,
            MasterJobSid: payload.MasterJobSid,
            HouseJobSid: payload.HouseJobSid,
            MasterNumber: payload.MBLNo,
            HouseNumber: payload.HBLNo,
            Remarks: payload.Remarks,
            Status: payload.Status || 'A',
            CreatedBy: payload.CreatedBy || 'System',
            ReversalVoucher: payload.ReversalVoucher || null,
            CreditNoteReason: payload.CreditNoteReason || null,
            CashOrBank: payload.CashOrBank || null,
            Salesman: payload.Salesman || null,
            DepartmentMasterSid: payload.DepartmentMasterSid || null,
          }
        });

        // Create VoucherDetails
        let totalTaxableAmount = 0;
        const finalDetails: any[] = [];
        if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {
          let sno = 1;
          for (const detail of payload.VoucherDetail) {
            const newDetail = await prisma.voucherDetail.create({
              data: {
                VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                Sno: sno++,
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                ChargeMasterSid: detail.ChargeMasterSid,
                ChargeDescription: detail.ChargeDescription || '',
                HSSACMasterSid: detail.HSSACMasterSid,
                ChargeUOMSid: detail.ChargeUOMSid,
                NumberOfUnit: detail.NumberOfUnit || 1,
                Rate: detail.Rate || 0,
                Amount: detail.Amount || 0,
                TaxableAmount: detail.TaxableAmount || detail.LocalAmount || 0,
                TaxPercentage1: detail.TaxPercentage1 || 0, // CGST or VAT
                TaxAmount1: detail.TaxAmount1 || 0,
                TaxPercentage2: detail.TaxPercentage2 || 0, // SGST
                TaxAmount2: detail.TaxAmount2 || 0,
                LocalAmount: detail.LocalAmount || 0,
                CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                CurrencyMasterSid: detail.CurrencyMasterSid || null,
                ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                DrCr: detail.DrCr || 'D', // Vendor CreditNote = Debit (payable)
                LedgerMasterSid: detail.LedgerMasterSid,
                COAMasterSid: detail.COAMasterSid,
                PartyAmount: detail.PartyAmount,
                CostRevenue: detail.CostRevenue || (detail.DrCr === 'D' ? 'Revenue' : 'Cost'),
                MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                YearMasterSid: detail.YearMasterSid || payload.YearMasterSid,
                CreatedBy: payload.CreatedBy || 'System',
                SourceDetailSid: detail.SourceDetailSid,
                DepartmentMasterSid: detail.DepartmentMasterSid,
                BookingRatesSid: detail.BookingRatesSid,
                Narration: detail.Narration,
                CostRevenueChargesSid: detail.CostRevenueChargesSid,
                Status: 'A'
              }
            });
            finalDetails.push(newDetail);
            totalTaxableAmount += Number(detail.TaxableAmount || detail.Amount || 0);
          }
        }

        // Create VoucherOthers if provided
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
              Status: 'A'
            }
          });
        }

        // Fetch complete vendor creditnote with relations
        if (voucherTypeMaster.IsAutoPosting === 'Y') {
          const postResult = await this.voucherService.postVoucherByVoucherSid({
            voucherHeaderSid: voucherHeader.VoucherHeaderSid,
            companyMasterSid: voucherHeader.CompanyMasterSid,
            branchMasterSid: voucherHeader.BranchMasterSid,
            yearMasterSid: payload.YearMasterSid,
            localCurrencyMasterSid: Number(payload?.PostingInfo?.LocalCurrencyMasterSid),
            localCurrencyCode: String(payload?.PostingInfo?.LocalCurrencyCode),
            current_date: payload.current_date,
            postedBy: payload.CreatedBy,
            taxDetails: payload?.PostingInfo?.TaxDetails,
          }, prisma);

          if (postResult && payload.IsFullyReversed && voucherHeader.ReversalVoucher) {
            const isBookingScreen = !!voucherHeader.BookingHeaderSid && !voucherHeader.HouseJobSid;

            const allDetails = await this._db.voucherDetail.findMany({
              where: {
                VoucherHeaderSid: voucherHeader.ReversalVoucher,
                Status: 'A'
              }
            });

            await this.voucherService.handleFullVoucherReversal({
              VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
              VoucherDetails: allDetails,
              userEmail: payload.CreatedBy,
              isBookingScreen
            }, 'revenue', prisma);
          }
        }


        return {
          ...voucherHeader,
          VoucherDetail: finalDetails
        };
      }, { timeout: 60000 });
    } catch (error) {
      this.logger.error(`createCreditNote Error: ${error?.message}`, error?.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Something Went Wrong While Creating CreditNote');
    }
  }

  async updateVoucherHeaderById(VoucherHeaderSid: number, payload: any) {
    try {
      return await this._db.$transaction(async (prisma) => {
        // Load existing voucher
        const existingVoucher = await prisma.voucherHeader.findUnique({
          where: { VoucherHeaderSid: VoucherHeaderSid }
        });

        if (!existingVoucher || existingVoucher.Status !== 'A') {
          throw new BadRequestException('Voucher not found');
        }

        // Prepare update payload
        const updatedVoucherHeader = await prisma.voucherHeader.update({
          where: { VoucherHeaderSid },
          data: {
            VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : undefined,
            Narration: payload.Narration,
            PartyMasterSid: payload.PartyMasterSid,
            PartyName: payload.PartyName,
            PartyAddress: payload.PartyAddress,
            PlaceOfSupply: payload.PlaceOfSupply,
            GST_VAT: payload.GSTNo || payload.GST_VAT,
            InvoiceType: payload.InvoiceType,
            CurrencyMasterSid: payload.CurrencyMasterSid,
            CurrencyCode: payload.CurrencyCode,
            ExchangeRate: payload.ExchangeRate,
            PostStatus: payload.PostStatus,
            DocumentNumber: payload.BillNo || payload.DocumentNumber,
            DocumentDate: payload.BillDate ? new Date(payload.BillDate) : undefined,
            Amount: payload.BillAmt || payload.Amount,
            MasterJobSid: payload.MasterJobSid,
            HouseJobSid: payload.HouseJobSid,
            MasterNumber: payload.MBLNo,
            HouseNumber: payload.HBLNo,
            Remarks: payload.Remarks,
            Status: payload.status,
            UpdatedBy: payload.UpdatedBy || 'System',
            UpdatedOn: new Date(),
            CreditNoteReason: payload.CreditNoteReason || null,
          }
        });

        //  const updatedVoucherHeader = await prisma.voucherHeader.update({
        //    where: { VoucherHeaderSid: VoucherHeaderSid } as any,
        //    data: voucherHeaderPayload
        //  });

        // Update VoucherDetail rows with proper CurrencyMasterSid mapping
        if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail) && payload.VoucherDetail.length > 0) {

          const voucherDetailsPayload = await Promise.all(
            payload.VoucherDetail.map(async (detail: any, index: number) => {
              const currencyMasterSid = detail.CurrencyMasterSid
                ? Number(detail.CurrencyMasterSid)
                : await this.getCurrencyMasterIdByCode(detail.CurrencyCode, prisma);

              return {
                VoucherDetailSid: detail.VoucherDetailSid ? Number(detail.VoucherDetailSid) : null,
                VoucherHeaderSid: VoucherHeaderSid,
                CreatedBy: payload.UpdatedBy,
                Status: "A",
                CompanyMasterSid: existingVoucher.CompanyMasterSid,
                BranchMasterSid: existingVoucher.BranchMasterSid,
                Sno: index + 1,
                ChargeMasterSid: detail.ChargeMasterSid ? Number(detail.ChargeMasterSid) : null,
                ChargeDescription: detail.ChargeDescription,
                LedgerMasterSid: detail.LedgerMasterSid ? Number(detail.LedgerMasterSid) : null,
                COAMasterSid: detail.COAMasterSid ? Number(detail.COAMasterSid) : null,
                HSSACMasterSid: detail.HSSACMasterSid ? Number(detail.HSSACMasterSid) : null,
                DepartmentMasterSid: detail.DepartmentMasterSid ? Number(detail.DepartmentMasterSid) : null,
                HouseJobSid: detail.HouseJobSid ? Number(detail.HouseJobSid) : null,
                MasterJobSid: detail.MasterJobSid ? Number(detail.MasterJobSid) : null,
                CostRevenue: detail.CostRevenue || (detail.DrCr === 'D' ? 'Revenue' : 'Cost'),
                ChargeUOMSid: detail.ChargeUOMSid ? Number(detail.ChargeUOMSid) : null,
                CurrencyMasterSid: currencyMasterSid,
                CurrencyCode: detail.CurrencyCode,
                ExchangeRate: detail.ExchangeRate ? Number(detail.ExchangeRate) : null,
                Rate: detail.Rate ? Number(detail.Rate) : null,
                NumberOfUnit: detail.NumberOfUnit ? Number(detail.NumberOfUnit) : null,
                Narration: detail.Narration,
                DrCr: detail.DrCr,
                TaxableAmount: detail.TaxableAmount ? Number(detail.TaxableAmount) : null,
                TaxPercentage1: detail.TaxPercentage1 ? Number(detail.TaxPercentage1) : null,
                TaxAmount1: detail.TaxAmount1 ? Number(detail.TaxAmount1) : null,
                TaxPercentage2: detail.TaxPercentage2 ? Number(detail.TaxPercentage2) : null,
                TaxAmount2: detail.TaxAmount2 ? Number(detail.TaxAmount2) : null,
                Amount: detail.Amount ? Number(detail.Amount) : null,
                LocalAmount: detail.LocalAmount ? Number(detail.LocalAmount) : null,
                PartyAmount: detail.PartyAmount ? Number(detail.PartyAmount) : null,
                InvoiceType: detail.InvoiceType,
                CostCenter: detail.CostCenter ? Number(detail.CostCenter) : null,
                ProfitCenter: detail.ProfitCenter ? Number(detail.ProfitCenter) : null,
                Remarks: detail.Remarks,
                CreditNoteReason: detail.CreditNoteReason,
                YearMasterSid: detail.YearMasterSid || payload.YearMasterSid,
                SourceDetailSid: detail.SourceDetailSid || null,
                BookingRatesSid: detail.BookingRatesSid || null,
                CostRevenueChargesSid: detail.CostRevenueChargesSid || null,
              };
            })
          );

          // 🔥 MAIN CHANGE HERE (update or create)
          for (const detail of voucherDetailsPayload) {
            if (detail.VoucherDetailSid) {
              // UPDATE existing
              const { VoucherDetailSid, ...rest } = detail;
              await prisma.voucherDetail.update({
                where: { VoucherDetailSid: detail.VoucherDetailSid },
                data: rest
              });
            } else {
              // CREATE new
              await prisma.voucherDetail.create({
                data: detail,
              });
            }
          }
        }
        // Update or create VoucherOthers
        if (payload.VoucherOthers) {
          const existingOthers = await prisma.voucherOthers.findFirst({
            where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' }
          });

          if (existingOthers) {
            await prisma.voucherOthers.update({
              where: { VoucherOthersSid: existingOthers.VoucherOthersSid },
              data: {
                UpdatedBy: payload.UpdatedBy,
                UpdatedOn: new Date(),
                IRNStatus: payload.VoucherOthers.IRNStatus,
                IRNNumber: payload.VoucherOthers.IRNNumber,
                IRNQRCode: payload.VoucherOthers.IRNQRCode,
                VoucherReverseSid: payload.VoucherOthers.VoucherReverseSid ? Number(payload.VoucherOthers.VoucherReverseSid) : null,
                ContainerNumber: payload.VoucherOthers.ContainerNumber,
                VoucherNote: payload.VoucherOthers.VoucherNote,
                Footer: payload.VoucherOthers.Footer
              }
            });
          } else {
            await prisma.voucherOthers.create({
              data: {
                VoucherHeaderSid: VoucherHeaderSid,
                CreatedBy: payload.UpdatedBy,
                Status: "A",
                IRNStatus: payload.VoucherOthers.IRNStatus,
                IRNNumber: payload.VoucherOthers.IRNNumber,
                IRNQRCode: payload.VoucherOthers.IRNQRCode,
                VoucherReverseSid: payload.VoucherOthers.VoucherReverseSid ? Number(payload.VoucherOthers.VoucherReverseSid) : null,
                ContainerNumber: payload.VoucherOthers.ContainerNumber,
                VoucherNote: payload.VoucherOthers.VoucherNote,
                Footer: payload.VoucherOthers.Footer
              }
            });
          }
        }

        return updatedVoucherHeader;
      });
    } catch (error) {
      this.logger.error(`updateVoucherHeaderById Error: ${error?.message}`, error?.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Something Went Wrong While Updating CreditNote');
    }
  }

  async deleteVoucherHeader(VoucherHeaderSid: number) {
    try {
      const result = await this._db.$transaction(async (prisma) => {
        const existing = await prisma.voucherHeader.findUnique({
          where: { VoucherHeaderSid: VoucherHeaderSid } as any
        });

        if (!existing || existing.Status !== 'A') {
          throw new BadRequestException('Voucher not found or already deleted');
        }

        const deletedVoucherHeader = await prisma.voucherHeader.update({
          where: { VoucherHeaderSid: VoucherHeaderSid } as any,
          data: { Status: 'D' }
        });

        const deletedVoucherDetails = await prisma.voucherDetail.updateMany({
          where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' },
          data: { Status: 'D' }
        });

        const deletedVoucherOthers = await prisma.voucherOthers.updateMany({
          where: { VoucherHeaderSid: VoucherHeaderSid, Status: 'A' },
          data: { Status: 'D' }
        });

        return {
          deletedVoucherHeader,
          deletedVoucherDetails,
          deletedVoucherOthers
        };
      });
      return result;
    } catch (error) {
      this.logger.error(`deleteVoucherHeader Error: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async searchVoucherHeader(params: any): Promise<any> {
    try {
      const {
        search = '',
        page = 1,
        pageSize = 10,
        sortColumn = 'VoucherDate',
        sortDirection = 'desc',
        activeCompanyId,
        activeBranchId
      } = params;
      const dateFromRaw = params?.dateFrom ?? params?.DateFrom;
      const dateToRaw = params?.dateTo ?? params?.DateTo;
      const dateFieldRaw = params?.dateField ?? params?.DateField ?? 'VoucherDate';
      const allowedDateFields = new Set(['VoucherDate', 'DocumentDate']);
      const dateField = allowedDateFields.has(dateFieldRaw) ? dateFieldRaw : 'VoucherDate';
      const partyMasterSid = params?.PartyMasterSid ?? params?.partyMasterSid ?? params?.CustomerMasterSid ?? params?.customerMasterSid ?? null;
      const currencyCode = params?.CurrencyCode ?? params?.currencyCode ?? null;
      const dateRange: Prisma.DateTimeFilter = {};
      if (dateFromRaw) {
        const parsedFrom = new Date(dateFromRaw);
        if (!Number.isNaN(parsedFrom.getTime())) {
          dateRange.gte = parsedFrom;
        }
      }
      if (dateToRaw) {
        const parsedTo = new Date(dateToRaw);
        if (!Number.isNaN(parsedTo.getTime())) {
          dateRange.lte = parsedTo;
        }
      }
      const skip = (page - 1) * pageSize;
      const take = Number(pageSize);

      const where: Prisma.VoucherHeaderWhereInput = {
        CompanyMasterSid: activeCompanyId,
        BranchMasterSid: activeBranchId,
        voucherTypeMaster: {
          DocumentTypeCode: DOC_TYPE_CODE.CREDIT_NOTE
        },
        Status: statusWhereClause,
        ...(partyMasterSid ? { PartyMasterSid: Number(partyMasterSid) } : {}),
        ...(currencyCode ? { CurrencyCode: String(currencyCode) } : {}),
        ...(Object.keys(dateRange).length ? { [dateField]: dateRange } : {}),
      }
      if (search) {
        const matchingOriginalVouchers =
          await this._db.voucherHeader.findMany({
            where: {
              VoucherNumber: {
                contains: search,
                mode: 'insensitive'
              }
            },
            select: {
              VoucherHeaderSid: true
            }
          });
        const reverseIds = matchingOriginalVouchers.map(
          v => v.VoucherHeaderSid
        );
        where.OR = [
          { VoucherNumber: { contains: search, mode: 'insensitive' } },
          { PartyName: { contains: search, mode: 'insensitive' } },
          { DocumentNumber: { contains: search, mode: 'insensitive' } },
          { HouseNumber: { contains: search, mode: 'insensitive' } },
          { MasterNumber: { contains: search, mode: 'insensitive' } },
          ...(reverseIds.length > 0
            ? [{ ReversalVoucher: { in: reverseIds } }]
            : [])
        ];
      };

      const [items, totalCount] = await Promise.all([
        this._db.voucherHeader.findMany({
          where,
          skip,
          take: pageSize,
          include: {
            VoucherDetail: {
              where: { Status: 'A' },
            },
            VoucherTDS: {
              where: { Status: 'A' }
            },
            subledgerMaster: true,
            currencyMaster: true,
            masterJob: {
              select: {
                MasterJobNumber: true
              }
            },
            departmentMaster: {
              select: {
                departmentType: true
              }
            },

            houseJob: {
              select: {
                HBLNo: true
              }
            },

          },
          orderBy: [
            { VoucherDate: 'desc' },
            { VoucherNumber: 'desc' }
          ]
        }),
        this._db.voucherHeader.count({ where }),
      ]);
      const reversalIds = items.filter(item => item.ReversalVoucher).map(item => item.ReversalVoucher as number);
      let reversalMap = new Map<number, string>();
      if (reversalIds.length > 0) {
        const reversalVoucher = await this._db.voucherHeader.findMany({
          where: {
            VoucherHeaderSid: { in: reversalIds }
          },
          select: {
            VoucherHeaderSid: true,
            VoucherNumber: true
          }
        });
        reversalMap = new Map(
          reversalVoucher.map(v => [v.VoucherHeaderSid, v.VoucherNumber])
        );
      }
      const enrichedItems = items.map(item => ({
        ...item,
        LocalAmount: item.VoucherDetail?.reduce((sum, d) => sum + Number(d.LocalAmount || 0), 0) || 0,
        TDSAmount: item.VoucherTDS?.[0]?.TDSAmount || 0,
        VendorName: item.PartyName,
        BillNo: item.DocumentNumber,
        BillDate: item.DocumentDate,
        MBLNo: item.MasterNumber,
        HBLNo: item.HouseNumber,
        ReversalVoucherNumber: item.ReversalVoucher
          ? reversalMap.get(item.ReversalVoucher) || null
          : null
      }));

      return {
        items: enrichedItems,
        totalCount,
        page: Number(page),
        pageSize: Number(pageSize)
      };
    } catch (error) {
      this.logger.error(`Error searching vendor creditNotes: ${error.message}`);
      throw new InternalServerErrorException('Failed to search vendor creditNotes');
    }
  }

  async fetchInvoice(
    payload: PullVoucherDTO,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const prisma = tx || this._db;

    const { VoucherNumber, CompanyMasterSid, BranchMasterSid } = payload;

    const invoice = await prisma.voucherHeader.findFirst({
      where: {
        VoucherNumber: { contains: VoucherNumber, mode: 'insensitive' },
        CompanyMasterSid,
        BranchMasterSid,
        voucherTypeMaster: { DocumentTypeCode: DOC_TYPE_CODE.INVOICE },
        Status: 'A',
      },
      include: {
        VoucherDetail: {
          where: { Status: 'A' },
          include: {
            currencyMaster: { select: { amountDecimal: true } },
          },
          orderBy: { Sno: 'asc' },
        },
        voucherTypeMaster: { select: { DocumentTypeName: true } },
        currencyMaster: {
          select: { amountDecimal: true, currencyCode: true },
        },
        customerBranch: {
          select: {
            CustomerGstType: true,
            stateMaster: {
              select: {
                StateMasterSid: true,
                IsUnionTerritory: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(
        `Invoice with Voucher Number ${VoucherNumber} not found`,
      );
    }

    if (invoice.PostStatus !== 'P') {
      throw new BadRequestException(
        `Invoice with Voucher Number ${VoucherNumber} is not posted`,
      );
    }

    if (!invoice.VoucherDetail?.length) {
      throw new BadRequestException(
        `Invoice with Voucher Number ${VoucherNumber} has no details`,
      );
    }

    const headerCurrencyDecimals =
      invoice.currencyMaster?.amountDecimal ?? 2;

    const toSafeNumber = (val: any): number => {
      const n = toNumber(val);
      return Math.abs(n) < 1e-8 ? 0 : n;
    };

    const roundFinal = (val: number, decimals: number): number =>
      roundAmount(val, decimals);

    /* Fetch Credit Notes against this invoice */
    const creditNotes = await prisma.voucherHeader.findMany({
      where: {
        ReversalVoucher: invoice.VoucherHeaderSid,
        CompanyMasterSid: invoice.CompanyMasterSid,
        BranchMasterSid: invoice.BranchMasterSid,
        PostStatus: 'P',
        Status: 'A',
      },
      include: {
        VoucherDetail: { where: { Status: 'A' }, orderBy: { Sno: 'asc' } },
      },
    });

    const creditMap = new Map<number, any[]>();

    creditNotes.forEach((credit) => {
      credit.VoucherDetail.forEach((d) => {
        if (!d.SourceDetailSid) return;
        const arr = creditMap.get(d.SourceDetailSid) || [];
        creditMap.set(d.SourceDetailSid, [...arr, d]);
      });
    });

    /* Process Voucher Details */
    const updatedDetails = (invoice.VoucherDetail || [])
      .filter(d => d.IsAutoGenerated === 'N')
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
          taxableAmount -= credits.reduce(
            (s, d) => s + toSafeNumber(d.TaxableAmount),
            0,
          );
          localAmount -= credits.reduce(
            (s, d) => s + toSafeNumber(d.LocalAmount),
            0,
          );
          tax1 -= credits.reduce(
            (s, d) => s + toSafeNumber(d.TaxAmount1),
            0,
          );
          tax2 -= credits.reduce(
            (s, d) => s + toSafeNumber(d.TaxAmount2),
            0,
          );
          partyAmount -= credits.reduce(
            (s, d) => s + toSafeNumber(d.PartyAmount),
            0,
          );
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

    /* Totals */
    const partyDetail = (invoice.VoucherDetail || []).find(d => d.LedgerMasterSid === invoice.PartyMasterSid);

    if (!partyDetail) {
      throw new BadRequestException('Party Voucher Detail not found for Invoice.');
    }

    if (!partyDetail.VoucherTransactionSid) {
      throw new BadRequestException('Party Voucher Transaction Sid not found for Invoice.');
    }

    let outstanding = await this.voucherService.getOutstandingAmount(partyDetail.VoucherTransactionSid, prisma);
    const osAmount = roundFinal(outstanding.OutstandingAmount, headerCurrencyDecimals);
    const osLocalAmount = roundFinal(outstanding.OutstandingLocalAmount, 4);

    const { VoucherDetail, currencyMaster, voucherTypeMaster, ...header } = invoice;
    return {
      ...header,
      VoucherDetail: updatedDetails.filter(d => d.IsAutoGenerated === 'N'),
      totalOSAmount: osAmount,
      totalOSLocalAmount: osLocalAmount,
      hasOutstandingAmount: osAmount > 0 || osLocalAmount > 0,
    };
  }

}
