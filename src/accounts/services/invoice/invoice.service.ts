import { SubledgerMaster } from './../../../../node_modules/.prisma/client/index.d';

import { BadRequestException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { Prisma } from '@prisma/client';
import * as moment from 'moment-timezone';
import { Debug } from '@prisma/client/runtime/library';
import { statusWhereClause, toNumber } from 'src/common/helper';
import { VoucherService } from 'src/accounts/services/voucher/voucher.service';
import { VoucherPeriodService } from 'src/accounts/services/voucher-period/voucher-period.service';
import { DOC_TYPE_CODE } from 'src/common/config/voucher-type.config';
import { CompanyConfigService } from 'src/masters/services/company/company-config.service';

export interface UninvoicedChargeForBooking {
  CompanyMasterSid: number;
  BranchMasterSid: number;
  BookingHeaderSid?: number;
  RevenueCustomerBranchSid?: number;
  RevenueCustomerMasterSid?: number;
  transactionSid?: number;
  MenuMasterSid?: number;
  IsBooking: boolean;
}

@Injectable()
export class InvoiceService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
    private voucherService: VoucherService,
    private voucherPeriodService: VoucherPeriodService,
    private companyConfigService: CompanyConfigService,
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
   * Delete a single invoice detail (charge line) in edit mode.
   * Soft-deletes the VoucherDetail (Status='D') and, if the line is linked to a
   * CostRevenueCharges / BookingRates row, clears its RevenueVoucherHeaderSid /
   * RevenueVoucherTypeMasterSid so the underlying charge becomes uninvoiced again
   * (same un-link performed by voucher.service.deleteVoucher / credit-note posting).
   */
  async deleteInvoiceDetail(
    voucherDetailSid: number,
    payload: {
      CompanyMasterSid: number;
      BranchMasterSid: number;
      UpdatedBy: string;
      Amount?: number;
      LocalAmount?: number;
    },
  ) {
    return this._db.$transaction(async (prisma) => {
      const detail = await prisma.voucherDetail.findUnique({
        where: { VoucherDetailSid: voucherDetailSid },
        include: { VoucherHeader: true },
      });

      if (!detail) {
        throw new BadRequestException('Charge line not found.');
      }

      // Multi-tenancy guard
      if (
        payload.CompanyMasterSid &&
        detail.CompanyMasterSid !== Number(payload.CompanyMasterSid)
      ) {
        throw new BadRequestException('Charge line does not belong to this company.');
      }

      // Defensive: only draft (unposted) invoices may have lines deleted
      if (detail.VoucherHeader?.PostStatus === 'P') {
        throw new BadRequestException('Posted invoices cannot be modified.');
      }

      // 1) soft-delete the detail (matches the existing notIn -> 'D' convention)
      //    and drop its links to the cost/booking-rate rows.
      await prisma.voucherDetail.update({
        where: { VoucherDetailSid: voucherDetailSid },
        data: {
          Status: 'D',
          CostRevenueChargesSid: null,
          BookingRatesSid: null,
          UpdatedBy: payload.UpdatedBy,
          UpdatedOn: new Date(),
        },
      });

      // 2) un-link the underlying charge so it can be re-invoiced
      if (detail.CostRevenueChargesSid) {
        await prisma.costRevenueCharges.update({
          where: { CostRevenueChargesSid: detail.CostRevenueChargesSid },
          data: {
            RevenueVoucherHeaderSid: null,
            RevenueVoucherTypeMasterSid: null,
            updatedOn: new Date(),
            updatedBy: payload.UpdatedBy,
          },
        });
      }
      if (detail.BookingRatesSid) {
        await prisma.bookingRates.update({
          where: { BookingRatesSid: detail.BookingRatesSid },
          data: {
            RevenueVoucherHeaderSid: null,
            RevenueVoucherTypeMasterSid: null,
            UpdatedOn: new Date(),
            UpdatedBy: payload.UpdatedBy,
          },
        });
      }

      // 3) keep the parent header total in sync with the surviving lines. The frontend computes
      //    Amount (party ccy) + LocalAmount (local ccy) over the remaining rows using the same
      //    formula as Save and sends them here, so the header doesn't go stale after a line delete.
      if (payload.Amount !== undefined || payload.LocalAmount !== undefined) {
        await prisma.voucherHeader.update({
          where: { VoucherHeaderSid: detail.VoucherHeaderSid },
          data: {
            ...(payload.Amount !== undefined ? { Amount: toNumber(payload.Amount) } : {}),
            ...(payload.LocalAmount !== undefined ? { LocalAmount: toNumber(payload.LocalAmount) } : {}),
            UpdatedBy: payload.UpdatedBy,
            UpdatedOn: new Date(),
          },
        });
      }

      return { VoucherDetailSid: voucherDetailSid };
    });
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


  async findVoucherHeaderById(VoucherHeaderSid: number,CompanyMasterSid: number,BranchMasterSid: number) {
    try {
      const voucherHeader = await this._db.voucherHeader.findUnique({
        where: { 
          VoucherHeaderSid: VoucherHeaderSid,
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: BranchMasterSid,
          Status: statusWhereClause 
        },
        include: {
          VoucherDetail: {
            where: {
              Status: 'A',
              //       voucherTypeMaster: {
              //   DocumentTypeName: 'Invoice'
              // }
            },
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
              },
              containers: {
                where: {
                  Status: 'A',
                  houseJobProduct: {
                    some: { status: 'A' }
                  }
                },
                include: {
                  containerType: {
                    select: {
                      ContainerIsoCode: true,
                      ContainerName:true
                    }
                  }
                }
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
                  MasterJobContainerSid: true,
                  ExternaPkg:true,
                  ExternlQty:true,
                  GrossWeight:true,
                  Volume:true,
                  PkgGroup:true,
                  ProductName:true,
                  ProductDescription:true,
                  masterJobContainer: true,
                }
              },
              houseJobBOE:{
                where:{
                  Status:'A'
                },
                select:{
                  BOENo:true,
                  DeclarationNo:true,
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
          customerBranch: {
            include: {
              stateMaster: {
                select: { StateMasterSid: true, stateName: true, IsUnionTerritory: true }
              },
              customerMaster:{
                select:{
                  PanType: true,
                  countryMaster:{
                    select:{
                      CountryMasterSid: true,
                      countryCode: true,
                    }
                  }
                }
              }
            }
          },
          departmentMaster: true,
          voucherTypeMaster: true
        }
      });

      if (!voucherHeader) {
        throw new UnauthorizedException('Access denied.');
      }

      return voucherHeader;
    } catch (error) {
      this.logger.error('findVoucherHeaderById error', error);
      throw new InternalServerErrorException("Something Went Wrong while fetching the data");
    }
  }

  async createInvoice(payload: any) {
    try {
      // Validate period before creating invoice (AR module)
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
        // Fetch VoucherTypeMaster for Invoice
        const voucherTypeMaster = await prisma.voucherTypeMaster.findFirst({
          where: {
            DocumentTypeCode: DOC_TYPE_CODE.INVOICE,
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            status: 'A'
          }
        });
        if (!voucherTypeMaster) {
          throw new BadRequestException('Invoice voucher type not configured for this company/branch. Please configure VoucherTypeMaster.');
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

        // Normalize & validate PartyMasterSid
        const providedPartySid = (payload && payload.PartyMasterSid != null && payload.PartyMasterSid !== '')
          ? Number(payload.PartyMasterSid)
          : null;
        if (providedPartySid !== null && Number.isNaN(providedPartySid)) {
          throw new BadRequestException(`Invalid PartyMasterSid: not a number (${payload.PartyMasterSid})`);
        }
        if (providedPartySid !== null) {
          const partyExists = await prisma.subledgerMaster.findUnique({
            where: { SubledgerMasterSid: providedPartySid },
            select: { SubledgerMasterSid: true }
          });
          if (!partyExists) {
            throw new BadRequestException(`Invalid PartyMasterSid: Subledger ${providedPartySid} does not exist`);
          }
        }

        // Normalize VoucherTypeMasterSid
        const rawVoucherTypeMasterSid = (payload && payload.VoucherTypeMasterSid != null && payload.VoucherTypeMasterSid !== '')
          ? Number(payload.VoucherTypeMasterSid)
          : null;
        let validatedVoucherTypeMasterSid: number | null = null;
        if (rawVoucherTypeMasterSid !== null) {
          if (Number.isNaN(rawVoucherTypeMasterSid)) {
            this.logger.warn(`createInvoice: incoming VoucherTypeMasterSid not a number: ${payload.VoucherTypeMasterSid}`);
          } else {
            const vtExists = await prisma.voucherTypeMaster.findUnique({
              where: { VoucherTypeMasterSid: rawVoucherTypeMasterSid },
              select: { VoucherTypeMasterSid: true }
            });
            if (vtExists) {
              validatedVoucherTypeMasterSid = rawVoucherTypeMasterSid;
            } else {
              this.logger.warn(`createInvoice: incoming VoucherTypeMasterSid ${rawVoucherTypeMasterSid} does not exist. Omitting field to avoid FK error.`);
            }
          }
        }

        // Resolve PartyName (ensure string) - this handles numeric branch id passed in PartyName
        const resolvedPartyName = await this.resolvePartyName(payload, prisma);

        // Build voucherHeader payload
        const voucherHeaderPayload: any = {
          VoucherNumber: VoucherNumber,
          VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : new Date(),
          PostDate: null,
          CreatedBy: payload.CreatedBy,
          Status: "A",
          CompanyMasterSid: payload.CompanyMasterSid,
          BranchMasterSid: payload.BranchMasterSid,
          VoucherType: voucherTypeMaster.VoucherTypeMasterSid, VoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
          PartyMasterSid: providedPartySid,
          PartyName: resolvedPartyName ?? (payload.PartyName !== undefined && payload.PartyName !== null ? String(payload.PartyName) : null),
          PartyAddress: payload.PartyAddress,
          CustomerBranchSid: payload.CustomerBranchSid || null,
          PlaceOfSupply: payload.PlaceOfSupply,
          State: payload.State || "",
          COAMasterSid: payload.COAMasterSid,
          GST_VAT: payload.GST_VAT,
          InvoiceType: payload.InvoiceType,
          TaxNumber: payload.TaxNumber || null,
          GSTType: payload.GSTType,
          Remarks: payload.Remarks || "",
          DepartmentMasterSid: payload.DepartmentMasterSid,
          HouseNumber: payload.HouseNumber || null,
          MasterNumber: payload.MasterNumber || null,
          HouseJobSid: payload.HouseJobSid || null,
          MasterJobSid: payload.MasterJobSid || null,
          PostStatus: payload.PostStatus,
          CurrencyMasterSid: payload.CurrencyMasterSid,
          CurrencyCode: payload.CurrencyCode,
          ExchangeRate: payload.ExchangeRate ? Number(payload.ExchangeRate) : null,
          Amount: payload.Amount ? Number(payload.Amount) : null,
          LocalAmount: payload.LocalAmount ? Number(payload.LocalAmount) : null,
          NetAmount: payload.NetAmount ? Number(payload.NetAmount) : null,
          DocumentNumber: payload.DocumentNumber || '',
          DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : null,
          Narration: payload.Narration || "",
          CustomsDuty: payload.CustomsDuty || 'N',

        };

        this.logger.debug(`createInvoice - voucherHeaderPayload: ${JSON.stringify(voucherHeaderPayload)}`);

        // Create VoucherHeader
        const voucherHeader = await prisma.voucherHeader.create({
          data: voucherHeaderPayload as Prisma.VoucherHeaderUncheckedCreateInput
        });

        // Create VoucherDetail rows with proper CurrencyMasterSid mapping
        if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail) && payload.VoucherDetail.length > 0) {
          const voucherDetailsPayload = await Promise.all(
            payload.VoucherDetail.map(async (detail: any, index: number) => {

              return {
                VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                CreatedBy: payload.CreatedBy,
                Status: "A",
                CompanyMasterSid: payload.CompanyMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
                Sno: index + 1,
                ChargeMasterSid: detail.ChargeMasterSid ? Number(detail.ChargeMasterSid) : null,
                ChargeDescription: detail.ChargeDescription,
                LedgerMasterSid: detail.LedgerMasterSid ? Number(detail.LedgerMasterSid) : null,
                COAMasterSid: detail.COAMasterSid ? Number(detail.COAMasterSid) : null,
                HSSACMasterSid: detail.HSSACMasterSid ? Number(detail.HSSACMasterSid) : null,
                DepartmentMasterSid: detail.DepartmentMasterSid ? Number(detail.DepartmentMasterSid) : null,
                HouseJobSid: detail.HouseJobSid ? Number(detail.HouseJobSid) : null,
                MasterJobSid: detail.MasterJobSid ? Number(detail.MasterJobSid) : null,
                CostRevenue: detail.CostRevenue,
                ChargeUOMSid: detail.ChargeUOMSid ? Number(detail.ChargeUOMSid) : null,
                CurrencyMasterSid: detail.CurrencyMasterSid,
                CurrencyCode: detail.CurrencyCode,
                ExchangeRate: toNumber(detail.ExchangeRate),
                Rate: detail.Rate ? Number(detail.Rate) : null,
                NumberOfUnit: toNumber(detail.NumberOfUnit),
                Narration: detail.Narration,
                DrCr: detail.DrCr,
                TaxableAmount: toNumber(detail.TaxableAmount),
                TaxPercentage1: toNumber(detail.TaxPercentage1),
                TaxAmount1: toNumber(detail.TaxAmount1),
                TaxPercentage2: toNumber(detail.TaxPercentage2),
                TaxAmount2: toNumber(detail.TaxAmount2),
                Amount: toNumber(detail.Amount),
                LocalAmount: toNumber(detail.LocalAmount),
                PartyAmount: toNumber(detail.PartyAmount),
                InvoiceType: detail.InvoiceType,
                CostCenter: detail.CostCenter ? Number(detail.CostCenter) : null,
                ProfitCenter: detail.ProfitCenter ? Number(detail.ProfitCenter) : null,
                Remarks: detail.Remarks,
                YearMasterSid: detail.YearMasterSid ? Number(detail.YearMasterSid) : null,
                BookingRatesSid: detail.BookingRatesSid ? Number(detail.BookingRatesSid) : detail.BookingRateSid ? Number(detail.BookingRateSid) : null,
                CostRevenueChargesSid: detail.CostRevenueChargesSid ? Number(detail.CostRevenueChargesSid) : null,
              };
            })
          );

          await prisma.voucherDetail.createMany({
            data: voucherDetailsPayload
          });

          // Link VoucherHeader to CostRevenueCharges (new detail created — skip when posting)
          if (payload.PostStatus !== 'P') {
            for (const detail of payload.VoucherDetail) {
              if (detail.CostRevenueChargesSid) {
                await prisma.costRevenueCharges.update({
                  where: { CostRevenueChargesSid: Number(detail.CostRevenueChargesSid) },
                  data: {
                    RevenueVoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                    RevenueVoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                    updatedOn: new Date(),
                    updatedBy: payload.CreatedBy,
                  },
                });
              }
              if (detail.BookingRateSid) {
                await prisma.bookingRates.update({
                  where: { BookingRatesSid: Number(detail.BookingRateSid) },
                  data: {
                    RevenueVoucherHeaderSid: voucherHeader.VoucherHeaderSid,
                    RevenueVoucherTypeMasterSid: voucherTypeMaster.VoucherTypeMasterSid,
                    UpdatedOn: new Date(),
                    UpdatedBy: payload.CreatedBy,
                  },
                });
              }
            }
          }
        }

        // Create VoucherOthers if provided
        if (payload.VoucherOthers) {
          const voucherOthersPayload = {
            VoucherHeaderSid: voucherHeader.VoucherHeaderSid,
            CreatedBy: payload.CreatedBy,
            Status: "A",
            IRNStatus: payload.VoucherOthers.IRNStatus,
            IRNNumber: payload.VoucherOthers.IRNNumber,
            IRNQRCode: payload.VoucherOthers.IRNQRCode,
            VoucherReverseSid: payload.VoucherOthers.VoucherReverseSid ? Number(payload.VoucherOthers.VoucherReverseSid) : null,
            ContainerNumber: payload.VoucherOthers.ContainerNumber,
            VoucherNote: payload.VoucherOthers.VoucherNote,
            Footer: payload.VoucherOthers.Footer
          };

          await prisma.voucherOthers.create({
            data: voucherOthersPayload
          });
        }

        return voucherHeader;
      });
    } catch (error) {
      this.logger.error(`createInvoice Error: ${error?.message}`, error?.stack);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Something Went Wrong While Creating Invoice');
    }
  }

  async updateVoucherHeaderById(VoucherHeaderSid: number, payload: any) {
    try {
      return await this._db.$transaction(async (prisma) => {
        // Load existing voucher
        const existingVoucher = await prisma.voucherHeader.findUnique({
          where: { VoucherHeaderSid: VoucherHeaderSid } as any
        });

        if (!existingVoucher) {
          throw new BadRequestException('Voucher not found');
        }

        if (payload.status === 'S') {
          return await this.voucherService.deleteVoucher({
            VoucherHeaderSid: VoucherHeaderSid,
            CompanyMasterSid: payload.CompanyMasterSid,
            BranchMasterSid: payload.BranchMasterSid,
            UserEmail: payload.UpdatedBy
          })
        }

        // Validate PartyMasterSid
        if (payload.PartyMasterSid != null && payload.PartyMasterSid !== '') {
          const subledgerExists = await prisma.subledgerMaster.findUnique({
            where: { SubledgerMasterSid: Number(payload.PartyMasterSid) },
            select: { SubledgerMasterSid: true }
          });

          if (!subledgerExists) {
            throw new BadRequestException('Invalid PartyMasterSid: Subledger does not exist');
          }
        }

        // Resolve PartyName if a numeric branch id or customer branch provided
        const resolvedPartyNameForUpdate = payload.PartyName != null
          ? await this.resolvePartyName(payload, prisma)
          : null;

        // Prepare update payload
        const voucherHeaderPayload: any = {
          UpdatedBy: payload.UpdatedBy,
          UpdatedOn: new Date(),
          VoucherDate: payload.VoucherDate ? new Date(payload.VoucherDate) : existingVoucher.VoucherDate,
          PostDate: payload.PostDate ? new Date(payload.PostDate) : existingVoucher.PostDate,
          PartyMasterSid: payload.PartyMasterSid ? Number(payload.PartyMasterSid) : existingVoucher.PartyMasterSid,
          PartyName: payload.PartyName != null ? (resolvedPartyNameForUpdate ?? String(payload.PartyName)) : existingVoucher.PartyName,
          COAMasterSid: payload.COAMasterSid ? Number(payload.COAMasterSid) : existingVoucher.COAMasterSid,

          PartyAddress: payload.PartyAddress || existingVoucher.PartyAddress,
          CustomerBranchSid: payload.CustomerBranchSid || existingVoucher.CustomerBranchSid,
          PlaceOfSupply: payload.PlaceOfSupply || existingVoucher.PlaceOfSupply,
          State: payload.State || existingVoucher.State,
          GST_VAT: payload.GST_VAT || existingVoucher.GST_VAT,
          InvoiceType: payload.InvoiceType || existingVoucher.InvoiceType,
          TaxNumber: payload.TaxNumber || existingVoucher.TaxNumber,
          GSTType: payload.GSTType || existingVoucher.GSTType,
          Remarks: payload.Remarks || existingVoucher.Remarks,
          HouseNumber: payload.HouseNumber || existingVoucher.HouseNumber,
          MasterNumber: payload.MasterNumber || existingVoucher.MasterNumber,
          HouseJobSid: payload.HouseJobSid || existingVoucher.HouseJobSid,
          MasterJobSid: payload.MasterJobSid || existingVoucher.MasterJobSid,
          PostStatus: payload.PostStatus || existingVoucher.PostStatus,
          CurrencyMasterSid: payload.CurrencyMasterSid || existingVoucher.CurrencyMasterSid,
          CurrencyCode: payload.CurrencyCode || existingVoucher.CurrencyCode,
          ExchangeRate: payload.ExchangeRate ? Number(payload.ExchangeRate) : existingVoucher.ExchangeRate,
          Amount: payload.Amount ? Number(payload.Amount) : existingVoucher.Amount,
          LocalAmount: payload.LocalAmount ? Number(payload.LocalAmount) : existingVoucher.LocalAmount,
          NetAmount: payload.NetAmount ? Number(payload.NetAmount) : existingVoucher.NetAmount,
          DocumentNumber: payload.DocumentNumber || existingVoucher.DocumentNumber,
          DocumentDate: payload.DocumentDate ? new Date(payload.DocumentDate) : existingVoucher.DocumentDate,
          Narration: payload.Narration || existingVoucher.Narration,
          CustomsDuty: payload.CustomsDuty !== undefined ? payload.CustomsDuty : existingVoucher.CustomsDuty,
          Status: String(payload.status || 'A').charAt(0)?.toUpperCase()
        };

        const updatedVoucherHeader = await prisma.voucherHeader.update({
          where: { VoucherHeaderSid: VoucherHeaderSid } as any,
          data: voucherHeaderPayload
        });

        // -------------------------------
        // UPDATE VOUCHER DETAILS 
        // -------------------------------

        if (payload.VoucherDetail && Array.isArray(payload.VoucherDetail)) {
          // 1️⃣ Collect incoming detail IDs
          const incomingIds = payload.VoucherDetail
            .filter(d => d.VoucherDetailSid)
            .map(d => Number(d.VoucherDetailSid));

          // 2️⃣ Soft-delete missing details
          await prisma.voucherDetail.updateMany({
            where: {
              VoucherHeaderSid,
              VoucherDetailSid: { notIn: incomingIds }
            },
            data: { Status: 'D' }
          });
          // new details → link VoucherHeaderSid; updated details → check rate changes
          const newCostRevenueSids = new Set<number>();
          const newBookingRateSids = new Set<number>();
          const updatedCostRevenueRateMap = new Map<number, { Rate: number; Amount: number; LocalAmount: number }>();
          const updatedBookingRateMap = new Map<number, { Rate: number; Amount: number; LocalAmount: number }>();
          // 3️⃣ Create / Update details
          let sno = 1;

          for (const detail of payload.VoucherDetail) {

            // Resolve CurrencyMasterSid if needed
            const currencyMasterSid = detail.CurrencyMasterSid
              ? Number(detail.CurrencyMasterSid)
              : await this.getCurrencyMasterIdByCode(detail.CurrencyCode, prisma);
            if (detail.VoucherDetailSid) {
              if (detail.CostRevenueChargesSid) {
                updatedCostRevenueRateMap.set(Number(detail.CostRevenueChargesSid), {
                  Rate: toNumber(detail.Rate),
                  Amount: toNumber(detail.Amount),
                  LocalAmount: toNumber(detail.LocalAmount),
                });
              }
              if (detail.BookingRateSid) {
                updatedBookingRateMap.set(Number(detail.BookingRateSid), {
                  Rate: toNumber(detail.Rate),
                  Amount: toNumber(detail.Amount),
                  LocalAmount: toNumber(detail.LocalAmount),
                });
              }
            } else {
              if (detail.CostRevenueChargesSid) newCostRevenueSids.add(Number(detail.CostRevenueChargesSid));
              if (detail.BookingRateSid) newBookingRateSids.add(Number(detail.BookingRateSid));
            }
            if (detail.VoucherDetailSid) {
              // -------------------------------
              // UPDATE EXISTING RECORD
              // -------------------------------
              await prisma.voucherDetail.update({
                where: { VoucherDetailSid: Number(detail.VoucherDetailSid) },
                data: {
                  Sno: sno++,
                  ChargeMasterSid: detail.ChargeMasterSid || null,
                  ChargeDescription: detail.ChargeDescription || '',
                  LedgerMasterSid: detail.LedgerMasterSid || null,
                  COAMasterSid: detail.COAMasterSid || null,
                  HSSACMasterSid: detail.HSSACMasterSid || null,
                  DepartmentMasterSid: detail.DepartmentMasterSid || null,
                  HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                  MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                  CostRevenue: detail.CostRevenue,
                  ChargeUOMSid: detail.ChargeUOMSid || null,
                  CurrencyMasterSid: currencyMasterSid || payload.CurrencyMasterSid || null,
                  CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                  ExchangeRate: toNumber(detail.ExchangeRate),
                  Rate: toNumber(detail.Rate),
                  NumberOfUnit: toNumber(detail.NumberOfUnit),
                  Narration: detail.Narration,
                  DrCr: detail.DrCr || 'D',
                  TaxableAmount: toNumber(detail.TaxableAmount),
                  TaxPercentage1: toNumber(detail.TaxPercentage1),
                  TaxAmount1: toNumber(detail.TaxAmount1),
                  TaxPercentage2: toNumber(detail.TaxPercentage2),
                  TaxAmount2: toNumber(detail.TaxAmount2),
                  Amount: toNumber(detail.Amount),
                  LocalAmount: toNumber(detail.LocalAmount),
                  PartyAmount: toNumber(detail.PartyAmount),
                  InvoiceType: detail.InvoiceType,
                  CostCenter: detail.CostCenter || null,
                  ProfitCenter: detail.ProfitCenter || null,
                  BookingRatesSid: detail.BookingRatesSid || detail.BookingRateSid || null,
                  CostRevenueChargesSid: detail.CostRevenueChargesSid || null,
                  Remarks: detail.Remarks,
                  UpdatedBy: payload.UpdatedBy,
                  UpdatedOn: new Date(),
                  Status: 'A'
                }
              });
            } else {
              // -------------------------------
              // CREATE NEW RECORD
              // -------------------------------
              await prisma.voucherDetail.create({
                data: {
                  VoucherHeaderSid,
                  Sno: sno++,
                  CompanyMasterSid: existingVoucher.CompanyMasterSid,
                  BranchMasterSid: existingVoucher.BranchMasterSid,

                  ChargeMasterSid: detail.ChargeMasterSid || null,
                  ChargeDescription: detail.ChargeDescription || '',
                  LedgerMasterSid: detail.LedgerMasterSid || null,
                  COAMasterSid: detail.COAMasterSid || null,
                  HSSACMasterSid: detail.HSSACMasterSid || null,
                  DepartmentMasterSid: detail.DepartmentMasterSid || null,
                  HouseJobSid: detail.HouseJobSid || payload.HouseJobSid,
                  MasterJobSid: detail.MasterJobSid || payload.MasterJobSid,
                  CostRevenue: detail.CostRevenue,
                  ChargeUOMSid: detail.ChargeUOMSid || null,
                  CurrencyMasterSid: currencyMasterSid || payload.CurrencyMasterSid || null,
                  CurrencyCode: detail.CurrencyCode || payload.CurrencyCode,
                  ExchangeRate: detail.ExchangeRate || payload.ExchangeRate || 1,
                  Rate: detail.Rate || 0,
                  NumberOfUnit: detail.NumberOfUnit || 1,
                  Narration: detail.Narration,
                  DrCr: detail.DrCr || 'D',
                  TaxableAmount: detail.TaxableAmount || detail.Amount || 0,
                  TaxPercentage1: detail.TaxPercentage1 || 0,
                  TaxAmount1: detail.TaxAmount1 || 0,
                  TaxPercentage2: detail.TaxPercentage2 || 0,
                  TaxAmount2: detail.TaxAmount2 || 0,

                  Amount: detail.Amount || 0,
                  LocalAmount: detail.LocalAmount || 0,
                  PartyAmount: detail.PartyAmount || 0,
                  InvoiceType: detail.InvoiceType,
                  CostCenter: detail.CostCenter || null,
                  ProfitCenter: detail.ProfitCenter || null,
                  BookingRatesSid: detail.BookingRatesSid || detail.BookingRateSid || null,
                  CostRevenueChargesSid: detail.CostRevenueChargesSid || null,
                  Remarks: detail.Remarks,

                  CreatedBy: payload.UpdatedBy,
                  Status: 'A'
                }
              });
            }
          }

          // 5️⃣ New details: link VoucherHeaderSid to CostRevenueCharges / BookingRates
          if (payload.PostStatus !== 'P') {
            for (const sid of newCostRevenueSids) {
              await prisma.costRevenueCharges.update({
                where: { CostRevenueChargesSid: sid },
                data: {
                  RevenueVoucherHeaderSid: VoucherHeaderSid,
                  RevenueVoucherTypeMasterSid: existingVoucher.VoucherTypeMasterSid,
                  updatedOn: new Date(),
                  updatedBy: payload.UpdatedBy,
                },
              });
            }
            for (const sid of newBookingRateSids) {
              await prisma.bookingRates.update({
                where: { BookingRatesSid: sid },
                data: {
                  RevenueVoucherHeaderSid: VoucherHeaderSid,
                  RevenueVoucherTypeMasterSid: existingVoucher.VoucherTypeMasterSid,
                  UpdatedOn: new Date(),
                  UpdatedBy: payload.UpdatedBy,
                },
              });
            }
          }

          // 6️⃣ Updated details: sync Rate/Amount/LocalAmount only if changed (controlled by DisableRateUpdateBack config)
          const disableRateUpdateBack = await this.companyConfigService.getConfigurationValue(
            existingVoucher.CompanyMasterSid, 'DisableRateUpdateBack', prisma
          );
          if (disableRateUpdateBack !== 'Y') {
            if (payload.PostStatus !== 'P' && updatedCostRevenueRateMap.size > 0) {
              const existingCharges = await prisma.costRevenueCharges.findMany({
                where: { CostRevenueChargesSid: { in: [...updatedCostRevenueRateMap.keys()] } },
                select: { CostRevenueChargesSid: true, RevenueRate: true, RevenueAmount: true, RevenueLocalAmount: true },
              });
              for (const cur of existingCharges) {
                const inc = updatedCostRevenueRateMap.get(cur.CostRevenueChargesSid)!;
                const changed =
                  toNumber(cur.RevenueRate) !== inc.Rate ||
                  toNumber(cur.RevenueAmount) !== inc.Amount ||
                  toNumber(cur.RevenueLocalAmount) !== inc.LocalAmount;
                if (changed) {
                  await prisma.costRevenueCharges.update({
                    where: { CostRevenueChargesSid: cur.CostRevenueChargesSid },
                    data: {
                      RevenueRate: inc.Rate,
                      RevenueAmount: inc.Amount,
                      RevenueLocalAmount: inc.LocalAmount,
                      updatedOn: new Date(),
                      updatedBy: payload.UpdatedBy,
                    },
                  });
                }
              }
            }

            if (payload.PostStatus !== 'P' && updatedBookingRateMap.size > 0) {
              const existingRates = await prisma.bookingRates.findMany({
                where: { BookingRatesSid: { in: [...updatedBookingRateMap.keys()] } },
                select: { BookingRatesSid: true, RevenueRate: true, RevenueAmount: true, RevenueLocalAmount: true },
              });
              for (const cur of existingRates) {
                const inc = updatedBookingRateMap.get(cur.BookingRatesSid)!;
                const changed =
                  toNumber(cur.RevenueRate) !== inc.Rate ||
                  toNumber(cur.RevenueAmount) !== inc.Amount ||
                  toNumber(cur.RevenueLocalAmount) !== inc.LocalAmount;
                if (changed) {
                  await prisma.bookingRates.update({
                    where: { BookingRatesSid: cur.BookingRatesSid },
                    data: {
                      RevenueRate: inc.Rate,
                      RevenueAmount: inc.Amount,
                      RevenueLocalAmount: inc.LocalAmount,
                      UpdatedOn: new Date(),
                      UpdatedBy: payload.UpdatedBy,
                    },
                  });
                }
              }
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
      throw new InternalServerErrorException('Something Went Wrong While Updating Invoice');
    }
  }


  async searchVoucherHeader(params: filterDto) {
    const { search = '', page = 1, pageSize = 15, activeCompanyId, activeBranchId } = params;
    const skip = (page - 1) * pageSize;
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
    const partyMasterSid = (params as any).PartyMasterSid ?? (params as any).partyMasterSid ?? (params as any).CustomerMasterSid ?? (params as any).customerMasterSid ?? null;
    const currencyCode = (params as any).CurrencyCode ?? (params as any).currencyCode ?? null;
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

    const where: Prisma.VoucherHeaderWhereInput = {
      CompanyMasterSid: activeCompanyId,
      BranchMasterSid: activeBranchId,
      Status: statusWhereClause,
      voucherTypeMaster: {
        DocumentTypeCode: DOC_TYPE_CODE.INVOICE
      },
      ...(partyMasterSid ? { PartyMasterSid: Number(partyMasterSid) } : {}),
      ...(currencyCode ? { CurrencyCode: String(currencyCode) } : {}),
      ...(Object.keys(dateRange).length ? { [dateField]: dateRange } : {}),
      ...(search && {
        OR: [
          { VoucherNumber: { contains: search, mode: 'insensitive' } },
          { PartyName: { contains: search, mode: 'insensitive' } },
          { DocumentNumber: { contains: search, mode: 'insensitive' } },
          { HouseNumber: { contains: search, mode: 'insensitive' } },
          { MasterNumber: { contains: search, mode: 'insensitive' } }
        ],
      }),
    };

    const [items, totalCount] = await this._db.$transaction([
      this._db.voucherHeader.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ VoucherDate: 'desc' }, { VoucherNumber: 'desc' }],
        include: {
          VoucherDetail: {
            where: { Status: 'A' },
            take: 1
          },
          departmentMaster: {
            select: { departmentType: true },
          },
          BookingHeader: {
            where: { status: 'A' },
            select: {
              BookingNo: true,
            }
          },
          masterJob: {
            where: { Status: 'A' },
            select: {
              MasterJobNumber: true,
              MasterJobDate: true,
            }
          },
          houseJob: {
            where: { status: 'A' },
            select: {
              HBLNo: true,
              ShipperName: true,
              ConsigneeName: true,
              ConsigneeAddress: true,
              CustomerName: true,
              CustomerAddress: true,
              IsServiceJob: true,
              JobType: true,
            }
          },
          currencyMaster: {
            where: { status: 'A' },
            select: {
              currencyCode: true,
              currencyName: true,
            }
          }
        }
      }),
      this._db.voucherHeader.count({ where }),
    ]);

    return { items, totalCount };
  }

  async getUninvoicedRevenueCharges(payload: UninvoicedChargeForBooking) {
    try {
      const {
        CompanyMasterSid,
        BranchMasterSid,
        BookingHeaderSid,
        transactionSid,
        MenuMasterSid,
        RevenueCustomerBranchSid,
        RevenueCustomerMasterSid,
        IsBooking
      } = payload;

      // Check if it is a request for booking rates
      if (IsBooking) {
        const whereCondition: Prisma.BookingRatesWhereInput = {
          CompanyMasterSid: CompanyMasterSid,
          BranchMasterSid: BranchMasterSid,
          BookingHeaderSid: BookingHeaderSid,
          RevenueVoucherHeaderSid: null,
          Status: 'A',
          CustomerMasterSid: RevenueCustomerMasterSid,
          CustomerBranchSid: RevenueCustomerBranchSid
        }

        // Fetch booking rates
        const charges = await this._db.bookingRates.findMany({
          where: whereCondition,
          include: {
            customerMasterBP: {
              select: {
                CustomerMasterSid: true,
                CustomerName: true,
                PanType: true,
                CustomerAddress1: true,
                CustomerAddress2: true
              }
            },
            customerBranch: {
              select: {
                CustomerBranchSid: true,
                Address: true,
                GSTNo: true,
                Registered: true,
                Zip_PostBox: true,
                CustomerGstType: true,
                stateMaster: {
                  select: {
                    StateMasterSid: true,
                    stateName: true,
                    IsUnionTerritory: true
                  }
                },
                cityMaster: {
                  select: {
                    cityName: true
                  }
                }
              },
            },
            revenueChargeUOMMaster: {
              select: {
                UOMMasterSid: true,
                UOMCode: true,
                UOMName: true
              }
            }
          },
          orderBy: {
            SerialNumber: 'asc'
          }
        });

        // Enriching booking rates with customer, currency and charge master
        return await Promise.all(charges.map(async (charge) => {
          const { customerMasterBP, customerBranch, revenueChargeUOMMaster, ...bookingRate } = charge;

          const revenueCurrencyMaster = charge.RevenueCurrencyMasterSid ? (
            await this._db.currencyMaster.findUnique({
              where: {
                CurrencyMasterSid: charge.RevenueCurrencyMasterSid,
                status: 'A'
              },
              select: {
                CurrencyMasterSid: true,
                currencyCode: true,
                currencyName: true
              }
            })
          ) : null;

          const chargeMaster = charge.ChargeMasterSid ? (
            await this._db.chargeMaster.findUnique({
              where: {
                ChargeMasterSid: charge.ChargeMasterSid,
                Status: 'A'
              },
              select: {
                ChargeMasterSid: true,
                chargeName: true,
                chargeCode: true,
                UOM: true,
                HSNSAC: true,
                chargeTaxMaster: {
                  where: { Status: 'A' },
                  select: {
                    ChargeTaxMasterSid: true,
                    HSNCode: true,
                    HSSACMasterSid: true,
                    TaxRate: true,
                    TaxGroup: true
                  }
                }
              }
            })
          ) : null;

          return {
            ...bookingRate,
            revenueCustomerMaster: customerMasterBP,
            revenueCustomerBranch: customerBranch,
            revenueCurrencyMaster,
            chargeMaster,
            revenueChargeUOMMaster: revenueChargeUOMMaster,
          }
        }));
      }

      // Build where condition
      const whereCondition: Prisma.CostRevenueChargesWhereInput = {
        TransactionSid: transactionSid,
        MenuMasterSid,
        CompanyMasterSid,
        BranchMasterSid,
        status: 'A',
        RevenueVoucherHeaderSid: null,
        ...(RevenueCustomerMasterSid ? { RevenueCustomerMasterSid } : {}),
        ...(RevenueCustomerBranchSid ? { RevenueCustomerBranchSid } : {})
      };

      const charges = await this._db.costRevenueCharges.findMany({
        where: whereCondition,
        include: {
          revenueCustomerMaster: {
            select: {
              CustomerMasterSid: true,
              CustomerName: true,
              PanType: true,
              CustomerAddress1: true,
              CustomerAddress2: true
            }
          },
          revenueCustomerBranch: {
            select: {
              CustomerBranchSid: true,
              Address: true,
              GSTNo: true,
              Registered: true,
              Zip_PostBox: true,
              CustomerGstType: true,
              stateMaster: {
                select: {
                  StateMasterSid: true,
                  stateName: true,
                  IsUnionTerritory: true
                }
              },
              cityMaster: {
                select: {
                  cityName: true
                }
              }
            }
          },
          revenueCurrencyMaster: {
            select: {
              CurrencyMasterSid: true,
              currencyCode: true,
              currencyName: true
            }
          },
          chargeMaster: {
            select: {
              ChargeMasterSid: true,
              chargeName: true,
              chargeCode: true,
              UOM: true,
              HSNSAC: true,
              chargeTaxMaster: {
                where: { Status: 'A' },
                select: {
                  ChargeTaxMasterSid: true,
                  HSNCode: true,
                  HSSACMasterSid: true,
                  TaxRate: true,
                  TaxGroup: true
                }
              }
            }
          },
          revenueChargeUOMMaster: {
            select: {
              UOMMasterSid: true,
              UOMCode: true,
              UOMName: true
            }
          }
        },
        orderBy: {
          SerialNumber: 'asc'
        }
      });

      return charges;
    } catch (error) {
      this.logger.error('getUninvoicedRevenueCharges error', error);
      throw error;
    }
  }

}
