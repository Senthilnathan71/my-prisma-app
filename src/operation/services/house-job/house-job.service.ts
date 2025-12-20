import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { OperationCommonService } from '../operation-common/operation-common.service';
import { MenuService } from 'src/masters/services/menu/menu.service';
import * as moment from 'moment-timezone';
import { toNumber } from 'src/common/helper';

@Injectable()
export class HouseJobService {
    constructor(
        private _db: DatabaseService,
        private commonService: OperationCommonService,
        private menuService : MenuService,
        private logger: Logger,
    ) { }
    async createHouseJob(payload: any) {
  try {
      if(!payload.DepartmentMasterSid){
        throw new BadRequestException('Department Master Sid is required');
      }
      const department = await this._db.departmentMaster.findUnique({
          where: { DepartmentMasterSid: payload.DepartmentMasterSid },
          select: {
              departmentType: true,
              ExportImport: true
          }
      });
      if (!department) {
          throw new BadRequestException('Department not found.');
      }

      const menuId = await this.menuService.getMenuSidByName(department.departmentType?.toUpperCase() === 'AIR' ? "House Air Waybill" : "House Job");

      const createdHouseJob = await this._db.$transaction(async (prisma) => {
          const dateString = moment().format('YYYYMMDD');
          let hblBaseCount = await this._db.houseJob.count({
              where: { HBLNo: { contains: dateString } },
          });
          let hblSerial = hblBaseCount;

          const departmentExportImport = department?.ExportImport ?? null;
          hblSerial += 1;
          let HBLNo;
          if (departmentExportImport === 'Export') {
              HBLNo = `HOUSE-${dateString}-${hblSerial.toString().padStart(3, '0')}`;
          } else {
              HBLNo = "";
          }


          // Create main House Job record
          const houseJob = await prisma.houseJob.create({
              data: {
                  MasterJobSid: payload.MasterJobSid || null,
                  BookingHeaderSid: payload.BookingHeaderSid || null,
                  ColoadedBy: payload.ColoadedBy || '',
                  BookingNo: payload.BookingNo || '',
                  BookingDateTime: payload.BookingDateTime || null,
                  CompanyMasterSid: payload.CompanyMasterSid || null,
                  BranchMasterSid: payload.BranchMasterSid || null,
                  CustomerMasterSid: payload.CustomerMasterSid || null,
                  CustomerName: payload.CustomerName || '',
                  CustomerAddress: payload.CustomerAddress || '',
                  SalesmanSid: payload.SalesmanSid || null,
                  CargoExpectedon: payload.CargoExpectedon || null,
                  FreightTerms: payload.FreightTerms || '',
                  POO: payload.POO || '',
                  POL: payload.POL || '',
                  POD: payload.POD || '',
                  FPD: payload.FPD || '',
                  TsPortSid: payload.TsPortSid || null,
                  POLTerminal: payload.POLTerminal || '',
                  VoyageMasterSid: payload.VoyageMasterSid || null,
                  VesselName: payload.VesselName || '',
                  VoyageNo: payload.VoyageNo || '',
                  HBLDate: payload.HBLDate ? new Date(payload.HBLDate) : new Date(),
                  ETD: payload.ETD ? new Date(payload.ETD) : null,
                  ETA: payload.ETA ? new Date(payload.ETA) : null,
                  IncoTerms: payload.IncoTerms || '',
                  BLLocation: payload.BLLocation || null,
                  ShipperName: payload.ShipperName || '',
                  ShipperAddress: payload.ShipperAddress || '',
                  ConsigneeName: payload.ConsigneeName || '',
                  ConsigneeAddress: payload.ConsigneeAddress || '',
                  ClearanceRequire: payload.ClearanceRequire || '',
                  ShipmentType: payload.ShipmentType || '',
                  DestinationAgent: payload.DestinationAgent,
                  AgentName: payload.AgentName || '',
                  AgentAddress: payload.AgentAddress || '',
                  HouseNo: payload.HouseNo || '',
                  QuotationHeaderSid: payload.QuotationHeaderSid || null,
                  EnquiryHeaderSid: payload.EnquiryHeaderSid || null,
                  MovementType: payload.MovementType || '',
                  DoValid: payload.DoValid || null,
                  IsServiceJob: payload.IsServiceJob || '',
                  createdBy: payload.createdBy || '',
                  updatedBy: payload.updatedBy || '',
                  status: payload.status || 'A',
                  HouseStatus: payload.HouseStatus,
                  HBLCount: payload.HBLCount || 0,
                  BookingStatus: payload.BookingStatus || '',
                  DepartmentMasterSid: payload.DepartmentMasterSid,
                  CustomerBranchSid: payload.CustomerBranchSid || null,
                  AuthorizerRemarks: payload.AuthorizerRemarks || '',
                  authorizerStatus: payload.authorizerStatus,
                  MenuMasterSid: menuId || payload.MenuMasterSid,
                  CarrierSid: payload.CarrierSid || null,
                  CarrierName: payload.CarrierName || '',
                  Coload: payload.Coload || '',
                  GeneralNote: payload.GeneralNote || '',
                  HBLNo: HBLNo,
                  InternalNote: payload.InternalNote || '',
                  MBLDate: payload.MBLDate || null,
                  MBLNo: payload.MBLNo || '',
                  Nominated: payload.Nominated || '',
                  NominatedBy: payload.NominatedBy || '',
                  Notify: payload.Notify || '',
                  NotifyAddress: payload.NotifyAddress || '',
                  PODTerminal: payload.PODTerminal || '',
                  ShipmentNo: payload.ShipmentNo || '',
                  OriginAgent: payload.OriginAgent || '',
                  JobType: payload.JobType
              }
          });

          const HouseJobSid = houseJob.HouseJobSid;

          let finalHouseJobCargo: any = null;

          // Create House Job Cargo if payload exists
          const cargoPayload = payload.houseJobCargo;
          if (cargoPayload && Object.keys(cargoPayload).length > 0) {
              finalHouseJobCargo = await prisma.houseJobCargo.create({
                  data: {
                      HouseJobSid,
                      CompanyMasterSid: payload.CompanyMasterSid ?? null,
                      BranchMasterSid: payload.BranchMasterSid ?? null,
                      NoOfPackage: Number(cargoPayload.NoOfPackage) || 0,
                      FreightAmount: String(cargoPayload.FreightAmount ?? '0'),
                      CargoType: cargoPayload.CargoType ?? '',
                      ContainerType: cargoPayload.ContainerType ?? null,
                      WeightUnitSid: cargoPayload.WeightUnit,
                      GrossWeight: Number(cargoPayload.GrossWeight) || 0,
                      NetWeight: Number(cargoPayload.NetWeight) || 0,
                      Volume: Number(cargoPayload.Volume) || 0,
                      ChargeableWeight: Number(cargoPayload.ChargeableWeight) || 0,
                      PackageType: cargoPayload.PackageType,
                      Qty: Number(cargoPayload.Qty) || 0,
                      ShipmentTerms: cargoPayload.ShipmentTerms || '',
                      createdBy: payload.createdBy,
                      updatedBy: payload.updatedBy ?? null,
                      status: 'A',
                      FreightTerms: cargoPayload.FreightTerms || '',
                      MovementType: cargoPayload.MovementType || '',
                      CommodityDescription: cargoPayload.CommodityDescription || '',
                      MarksAndNumber: cargoPayload.MarksAndNumber || '',
                      LandedMarksandNumber: cargoPayload.LandedMarksandNumber || '',
                      ModeOfTransport: cargoPayload.ModeOfTransport || '',
                      NoofContainers: Number(cargoPayload.NoofContainers) || 0,
                      StuffingAt: cargoPayload.StuffingAt || '',
                  },
              });
          }

          // Create House Job Products
          const finalHouseJobProduct: any[] = [];
          const houseJobProductPayload = payload.houseJobProduct || [];
          if (houseJobProductPayload.length > 0) {
              for (const product of houseJobProductPayload) {
                  const createdProduct = await prisma.houseJobProduct.create({
                      data: {
                          HouseJobSid,
                          ProductName: product.ProductName || '',
                          ProductDescription: product.ProductDescription || '',
                          ShippingBillNo: product.ShippingBillNo || '',
                          ShippingBillDate: product.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
                          ExternaPkg: product.ExternaPkg,
                          ExternlQty: String(product.ExternlQty) || null,
                          GrossWeight: Number(product.GrossWeight) || 0,
                          ActualGrWeight: Number(product.GrossWeight) || 0,
                          NetWeight: Number(product.NetWeight) || 0,
                          Volume: Number(product.Volume) || 0,
                          ActualVolume: Number(product.Volume) || 0,
                          RecdPack: product.RecdPack || '',
                          CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                          CFS: product.CFS || '',
                          createdBy: payload.createdBy,
                          status: product.status ? String(product.status).charAt(0) : 'A',
                          Height: product.Height || 0,
                          Volumetric: Number(product.Volumetric) || 0,
                          HSCode: product.HSCode || '',
                          ImcoClass: product.ImcoClass || '',
                          IsHaz: product.IsHaz || 'N',
                          Length: product.Length || 0,
                          PkgGroup: product.PkgGroup || '',
                          UnNo: product.UnNo || '',
                          Width: product.Width || 0,
                          UomMasterSid: product.UomMasterSid || null,
                          ContainerNo: product.ContainerNo,
                          MasterJobContainerSid: product.MasterJobContainerSid || null,
                          DeliveryDate: product.DeliveryDate ? new Date(product.DeliveryDate) : null,
                          ReceivedQty: product.ReceivedQty || 0,
                          DamageQty: product.DamageQty || 0,
                          DamageRemarks: product.DamageRemarks || '',
                          DeliveredQty: product.DeliveredQty || 0,
                          MarksAndNumber: product.MarksAndNumber
                      }
                  });
                  finalHouseJobProduct.push(createdProduct);
              }
          }

          // Create House Job Connections
          const finalHouseConnections: any[] = [];
          const houseConnectionPayload = payload.houseConnections || [];
          if (houseConnectionPayload.length > 0) {
              for (const connection of houseConnectionPayload) {
                  const createdConnection = await prisma.houseJobConnection.create({
                      data: {
                          HouseJobSid,
                          Mode: connection.Mode,
                          POL: connection.POL,
                          POD: connection.POD,
                          VesselName: connection.VesselName,
                          VoyageNo: connection.VoyageNo,
                          ETD: connection.ETD ? new Date(connection.ETD) : null,
                          ETA: connection.ETA ? new Date(connection.ETA) : null,
                          Remarks: connection.Remarks,
                          status: String(connection.status).charAt(0) || 'A',
                          createdBy: payload.createdBy,
                      }
                  });
                  finalHouseConnections.push(createdConnection);
              }
          }

          // Create House Job Others
          let finalHouseJobOthers: any = null;
          const otherPayload = payload.houseJobOthers || {};
          if (Object.keys(otherPayload).length > 0) {
              finalHouseJobOthers = await prisma.houseJobOthers.create({
                  data: {
                      HouseJobSid,
                      CustomerRefNo: otherPayload.CustomerRefNo || '',
                      OperationUser: otherPayload.OperationUser || '',
                      DocumentationUser: otherPayload.DocumentationUser || '',
                      CustomerServiceuser: otherPayload.CustomerServiceuser || '',
                      NotifyParty: otherPayload.NotifyParty || '',
                      NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                      CHAName: otherPayload.CHAName || '',
                      PickupMode: otherPayload.PickupMode || '',
                      YardCFS: otherPayload.YardCFS || '',
                      LocalTransport: otherPayload.LocalTransport || '',
                      OverseasTransport: otherPayload.OverseasTransport || '',
                      OverseasClearance: otherPayload.OverseasClearance || '',
                      PickupPlace: otherPayload.PickupPlace || '',
                      PickupDate: otherPayload.PickupDate ? new Date(otherPayload.PickupDate) : null,
                      PickupAddress: otherPayload.PickupAddress || '',
                      BlClause: otherPayload.BlClause || '',
                      DeliveryPlace: otherPayload.DeliveryPlace || '',
                      DeliveryDate: otherPayload.DeliveryDate || "",
                      DeliveryAddress: otherPayload.DeliveryAddress || '',
                      CargoCurrency: otherPayload.CargoCurrency || '',
                      CargoValue: Number(otherPayload.CargoValue) || 0,
                      ValueForInsurance: Number(otherPayload.ValueForInsurance) || 0,
                      InsuranceAmount: Number(otherPayload.InsuranceAmount) || 0,
                      ValuationCharge: Number(otherPayload.ValuationCharge) || 0,
                      HandlingInformation: otherPayload.HandlingInformation || '',
                      DeliveryMode: otherPayload.DeliveryMode || '',
                      ExternalRemarks: otherPayload.ExternalRemarks || '',
                      SwitchBL: otherPayload.SwitchBL || '',
                      TransporterName: otherPayload.TransporterName || '',
                      AgentAddress: otherPayload.AgentAddress || '',
                      BacktoBack: otherPayload.BackToBack || '',
                      CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                      CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                      Coloader: otherPayload.Coloader || '',
                      Forwarder: otherPayload.Forwarder || '',
                      ForwarderAddress: otherPayload.ForwarderAddress || '',
                      HBLNo: otherPayload.HBLNo || '',
                      Notify2: otherPayload.Notify2 || '',
                      NotifyAddress2: otherPayload.NotifyAddress2 || '',
                      ROValidity: otherPayload.ROValidity || '',
                      ReleaseType: otherPayload.ReleaseType || '',
                      SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                      SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                      SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                      SwitchLocation: otherPayload.SwitchLocation || '',
                      Depo: otherPayload.Depo,
                      DONo: otherPayload.DONo || '',
                      DODate: otherPayload.DODate ? new Date(otherPayload.DODate) : null,
                      status: 'A',
                      createdBy: payload.createdBy,
                  }
              });
          }

          // Create Cost Revenue Charges
          const finalCharges: any[] = [];
          const allCostRevenueCharges = payload?.bookingRates || [];

          let itemIndex = 1;
          for (const item of allCostRevenueCharges) {
              const costRevenueChargesPayload = {
                  TransactionSid: houseJob.HouseJobSid,
                  MenuMasterSid: menuId || payload.MenuMasterSid,
                  ShipmentNo: houseJob.ShipmentNo,
                  MasterJobNo: houseJob.MBLNo,
                  CompanyMasterSid: payload.CompanyMasterSid,
                  BranchMasterSid: payload.BranchMasterSid,

                  SerialNumber: itemIndex++,
                  ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                  ChargeDescription: item.ChargeDescription,

                  ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                  RevenueChargeUomSid: Number(item.RevenueChargeUomSid),
                  CostChargeUomSid: Number(item.CostChargeUomSid),
                  RevenueNumberOfUnit: item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null,
                  CostNumberOfUnit: item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null,

                  // Revenue Section
                  RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? item.RevenueCurrencyMasterSid : null,
                  RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                  RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                  RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                  RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                  RevenueDrCr: item.RevenueDrCr,
                  RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                  RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                  RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                  RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                  RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                  // Cost Section
                  CostCurrencyMasterSid: item.CostCurrencyMasterSid ? item.CostCurrencyMasterSid : null,
                  CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                  CostRate: item.CostRate ? Number(item.CostRate) : null,
                  CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                  CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                  CostDrCr: item.CostDrCr,
                  CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                  CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                  CostPrepaidCollect: item.CostPrepaidCollect,
                  CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                  CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                  createdBy: payload.createdBy,
                  status: "A",
                  Remarks: item.Remarks
              }

              const createdCharge = await prisma.costRevenueCharges.create({
                  data: costRevenueChargesPayload
              });
              finalCharges.push(createdCharge);
          }

          // Create House Job BOE
          const finalHouseJobBOE: any[] = [];
          const houseJobBOEPayload = payload.houseJobBOE || [];
          if (houseJobBOEPayload.length > 0) {
              for (const boe of houseJobBOEPayload) {
                  const createdBOE = await prisma.houseJobBOE.create({
                      data: {
                          HouseJobSid,
                          CompanyMasterSid: payload.CompanyMasterSid,
                          Sno: boe.Sno || 1,
                          DeclarationNo: boe.DeclarationNo || '',
                          BOENo: boe.BOENo || '',
                          BOEDate: boe.BOEDate ? new Date(boe.BOEDate) : null,
                          BOEValue: boe.BOEValue ? Number(boe.BOEValue) : null,
                          BOEInvoiceValue: boe.BOEInvoiceValue ? Number(boe.BOEInvoiceValue) : null,
                          TransactionType: boe.TransactionType || '',
                          Amount: boe.Amount ? Number(boe.Amount) : null,
                          ProcessDate: boe.ProcessDate ? new Date(boe.ProcessDate) : null,
                          ReceivedDate: boe.ReceivedDate ? new Date(boe.ReceivedDate) : null,
                          AckNumber: boe.AckNumber || '',
                          AckDate: boe.AckDate ? new Date(boe.AckDate) : null,
                          AckStatus: boe.AckStatus || '',
                          Remarks: boe.Remarks || '',
                          CreatedBy: payload.createdBy,
                          Status: 'A'
                      }
                  });
                  finalHouseJobBOE.push(createdBOE);
              }
          }

          // Create House Job Vehicle
          let finalHouseJobVehicle: any[] = [];
          const houseJobVehiclePayload = payload.houseJobVehicle || [];
          if (houseJobVehiclePayload.length > 0) {
              for (const vehicle of houseJobVehiclePayload) {
                  const createdVehicle = await prisma.houseJobVehicle.create({
                      data: {
                          HouseJobSid,
                          CompanyMasterSid: payload.CompanyMasterSid,
                          VehicleIndicator: vehicle.VehicleIndicator,
                          UsedNew: vehicle.UsedNew,
                          ChassisNo: vehicle.ChassisNo,
                          CaseNo: vehicle.CaseNo,
                          Make: vehicle.Make,
                          Model: vehicle.Model,
                          EngineNo: vehicle.EngineNo,
                          YearBuilt: vehicle.YearBuilt,
                          Color: vehicle.Color,
                          Rolling: vehicle.Rolling,
                          GoodsDescription: vehicle.GoodsDescription,
                          Weight: vehicle.Weight ? Number(vehicle.Weight) : null,
                          Volume: vehicle.Volume ? Number(vehicle.Volume) : null,
                          Remarks: vehicle.Remarks,
                          CreatedBy: payload.createdBy,
                          Status: 'A'
                      }
                  });
                  finalHouseJobVehicle.push(createdVehicle);
              }
          }

          // Create House Job Customs
          let finalHouseJobCustoms: any[] = [];
          const houseJobCustomsPayload = payload.houseJobCustoms || [];
          if (houseJobCustomsPayload.length > 0) {
              for (const customs of houseJobCustomsPayload) {
                  const createdCustoms = await prisma.houseJobCustoms.create({
                      data: {
                          HouseJobSid,
                          CompanyMasterSid: payload.CompanyMasterSid,
                          LineCode: customs.LineCode,
                          VoyageAgentCode: customs.VoyageAgentCode,
                          RotationNumber: customs.RotationNumber,
                          ManifestSequence: customs.ManifestSequence,
                          CargoCode: customs.CargoCode,
                          StorageRequest: customs.StorageRequest,
                          PackageTypeCode: customs.PackageTypeCode,
                          FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                          NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                          SLACIndicator: customs.SLACIndicator,
                          ImporterCode: customs.ImporterCode,
                          SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                          UsedOrNew: customs.UsedOrNew,
                          UNHSCode: customs.UNHSCode,
                          UNNumber: customs.UNNumber,
                          FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                          TemperatureUnit: customs.TemperatureUnit,
                          HazStorageRequest: customs.HazStorageRequest,
                          RefrigerationRequired: customs.RefrigerationRequired,
                          MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                          MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                          RefTemperatureUnit: customs.RefTemperatureUnit,
                          CreatedBy: payload.createdBy,
                          Status: 'A'
                      }
                  });
                  finalHouseJobCustoms.push(createdCustoms);
              }
          }

          return {
              houseJob,
              houseJobCargo: finalHouseJobCargo,
              houseJobProduct: finalHouseJobProduct,
              houseConnections: finalHouseConnections,
              houseJobOthers: finalHouseJobOthers,
              houseJobBOE: finalHouseJobBOE,
              houseJobVehicle: finalHouseJobVehicle,
              houseJobCustoms: finalHouseJobCustoms,
              bookingRates: finalCharges,
              costRevenueCharges: finalCharges
          };
      });

    return createdHouseJob;
  } catch (error) {
    throw error;
  }
}




    async getHouseJobById(HouseJobSid:number) {
        try {
            const ourHouseJob = await this._db.houseJob.findUnique({
                where: {
                    HouseJobSid: HouseJobSid
                },
                include: {
                    departmentMaster : {
                        select : {
                            departmentType : true
                        }
                    },
                    Cargo: {
                        where : {status : 'A'}
                    },
                    Connections: {
                        where : {status : 'A'}
                    },
                    Others: {
                        where : {status : 'A'}
                    },
                    Products: {
                        where : {status : 'A'}
                    },
                    houseJobBOE:{
                        where:{
                            Status:'A'
                        }
                    }, 
                     houseJobVehicle:{
                        where:{
                            Status:'A'
                        }
                    }, 
                     houseJobCustoms:{
                        where:{
                            Status:'A'
                        }
                    },                    
                    masterJob:  {
                        
                        where:{Status : 'A',
                       
                        },
                        select:{
                            MasterJobSid:true,
                            NoofOriginal:true,
                            MasterJobNumber:true,
                            WeightIn:true,
                            containers:true,
                            others:true,
                        },
                       
                    } 
                    
                    
                }
            })
            if(!ourHouseJob){
                throw new BadRequestException('Error fetching house job record.');
            }

            const menuId = await this.menuService.getMenuSidByName(
                ourHouseJob.departmentMaster?.departmentType?.toUpperCase() === 'AIR' ? 
                    "House Air Waybill" : "House Job"
            );

            const costRevenuePayload = {
                TransactionSid : ourHouseJob.HouseJobSid,
                MenuMasterSid : menuId || ourHouseJob.MenuMasterSid!,
                CompanyMasterSid : ourHouseJob.CompanyMasterSid,
                BranchMasterSid : ourHouseJob.BranchMasterSid!,
            }

            const costRevenueCharges = await this.commonService.getAllCostRevenueCharges(costRevenuePayload);

            return {
                ...ourHouseJob,
                costRevenueCharges,

            }
        } catch (error) {
            throw error;
        }
    }

    async getHouseJobByMasterJobSid(payload:any) {
        try {
            const {MasterJobSid,CompanyMasterSid,BranchMasterSid} = payload;
            const ourHouseJob = await this._db.houseJob.findMany({
                where: {
                    MasterJobSid: MasterJobSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    status: 'A'
                },
                select :{
                    HouseJobSid : true,
                    HBLNo : true
                }
            })
            return ourHouseJob;
        } catch (error) {
            throw error;
        }
    }

    async updateHouseJobById(HouseJobSid: number, payload: any) {
        try {

            if (!payload.DepartmentMasterSid) {
                throw new BadRequestException('Department Master Sid is required.');
            }

            const department = await this._db.departmentMaster.findUnique({
                where: { DepartmentMasterSid: payload.DepartmentMasterSid },
                select: {
                    departmentType: true
                }
            });

            if (!department) {
                throw new BadRequestException('Department not found.');
            }

            const menuId = await this.menuService.getMenuSidByName(department.departmentType?.toUpperCase() === 'AIR' ? "House Air Waybill" : "House Job");

            const updatedHouseJob = await this._db.$transaction(async (prisma) => {

                return await prisma.houseJob.update({
                    where: {
                        HouseJobSid: HouseJobSid
                    },
                    data: {
                        MasterJobSid: payload.MasterJobSid || null,
                        BookingHeaderSid: payload.BookingHeaderSid || null,
                        ColoadedBy: payload.ColoadedBy || '',
                        BookingNo: payload.BookingNo || '',
                        BookingDateTime: payload.BookingDateTime || null,
                        CompanyMasterSid: payload.CompanyMasterSid || null,
                        BranchMasterSid: payload.BranchMasterSid || null,
                        CustomerMasterSid: payload.CustomerMasterSid || null,
                        CustomerName: payload.CustomerName || '',
                        CustomerAddress: payload.CustomerAddress || '',
                        SalesmanSid: payload.SalesmanSid || null,
                        CargoExpectedon: payload.CargoExpectedon || null,
                        FreightTerms: payload.FreightTerms || '',
                        POO: payload.POO || '',
                        POL: payload.POL || '',
                        POD: payload.POD || '',
                        FPD: payload.FPD || '',
                        TsPortSid: payload.TsPortSid || null,
                        POLTerminal: payload.POLTerminal || '',
                        VoyageMasterSid: payload.VoyageMasterSid || null,
                        VesselName: payload.VesselName || '',
                        VoyageNo: payload.VoyageNo || '',
                        HBLDate: payload.HBLDate ? new Date(payload.HBLDate) : null,
                        ETD: payload.ETD ? new Date(payload.ETD) : null,
                        ETA: payload.ETA ? new Date(payload.ETA) : null,
                        IncoTerms: payload.IncoTerms || '',
                        BLLocation: payload.BLLocation || null,
                        ShipperName: payload.ShipperName || '',
                        ShipperAddress: payload.ShipperAddress || '',
                        ConsigneeName: payload.ConsigneeName || '',
                        ConsigneeAddress: payload.ConsigneeAddress || '',
                        ClearanceRequire: payload.ClearanceRequire || '',
                        ShipmentType: payload.ShipmentType || '',
                        DestinationAgent: payload.DestinationAgent,
                        AgentName: payload.AgentName || '',
                        AgentAddress: payload.AgentAddress || '',
                        HouseNo: payload.HouseNo || '',
                        QuotationHeaderSid: payload.QuotationHeaderSid || null,
                        EnquiryHeaderSid: payload.EnquiryHeaderSid || null,
                        MovementType: payload.MovementType || '',
                        DoValid: payload.DoValid || null,
                        IsServiceJob: payload.IsServiceJob || '',
                        createdBy: payload.createdBy || '',
                        updatedBy: payload.updatedBy || '',
                        status: payload.status || '',
                        HouseStatus: payload.HouseStatus,
                        HBLCount: payload.HBLCount || 0,
                        BookingStatus: payload.BookingStatus || '',
                        DepartmentMasterSid: payload.DepartmentMasterSid,
                        CustomerBranchSid: payload.CustomerBranchSid || null,
                        AuthorizerRemarks: payload.AuthorizerRemarks || '',
                        authorizerStatus: payload.authorizerStatus,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        CarrierSid: payload.CarrierSid || null,
                        CarrierName: payload.CarrierName || '',
                        Coload: payload.Coload || '',
                        GeneralNote: payload.GeneralNote || '',
                        HBLNo: payload.HBLNo || '',
                        InternalNote: payload.InternalNote || '',
                        MBLDate: payload.MBLDate || null,
                        MBLNo: payload.MBLNo || '',
                        Nominated: payload.Nominated || '',
                        NominatedBy: payload.NominatedBy || '',
                        Notify: payload.Notify || '',
                        NotifyAddress: payload.NotifyAddress || '',
                        PODTerminal: payload.PODTerminal || '',
                        ShipmentNo: payload.ShipmentNo || '',
                        OriginAgent: payload.OriginAgent || '',
                        JobType: payload.JobType
                    }
                })
            })

            let finalHouseJobCargo;

            // Only run cargo logic if we actually have a cargo payload
            const cargoPayload = payload.houseJobCargo;

            // Check if cargo payload exists and has at least one meaningful field
            if (cargoPayload && Object.keys(cargoPayload).length > 0) {
                const HouseJobCargoSid = cargoPayload.HouseJobCargoSid;

                if (HouseJobCargoSid) {
                    // Update existing cargo
                    finalHouseJobCargo = await this._db.houseJobCargo.update({
                        where: { HouseJobCargoSid },
                        data: {
                            HouseJobSid,
                            CompanyMasterSid: payload.CompanyMasterSid ?? null,
                            BranchMasterSid: payload.BranchMasterSid ?? null,
                            NoOfPackage: Number(cargoPayload.NoOfPackage),
                            FreightAmount: String(cargoPayload.FreightAmount ?? '0'),
                            CargoType: cargoPayload.CargoType ?? '',
                            ContainerType: cargoPayload.ContainerType ?? null,
                            WeightUnitSid: cargoPayload.WeightUnit,
                            GrossWeight: Number(cargoPayload.GrossWeight),
                            NetWeight: Number(cargoPayload.NetWeight),
                            Volume: Number(cargoPayload.Volume),

                            ChargeableWeight: Number(cargoPayload.ChargeableWeight) || 0,
                            PackageType: cargoPayload.PackageType,
                            Qty: Number(cargoPayload.Qty),
                            ShipmentTerms: cargoPayload.ShipmentTerms || '',
                            createdBy: payload.updatedBy,          // required
                            updatedBy: payload.updatedBy ?? null,
                            status: 'A',
                            FreightTerms: cargoPayload.FreightTerms || '',
                            MovementType: cargoPayload.MovementType || '',
                            CommodityDescription: cargoPayload.CommodityDescription || '',
                            MarksAndNumber: cargoPayload.MarksAndNumber || '',
                            LandedMarksandNumber: cargoPayload.LandedMarksandNumber || '',
                            ModeOfTransport: cargoPayload.ModeOfTransport || '',
                            NoofContainers: Number(cargoPayload.NoofContainers) || 0,
                            StuffingAt: cargoPayload.StuffingAt || '',
                        },
                    });
                } else {
                    // Create only if explicitly required
                    finalHouseJobCargo = await this._db.houseJobCargo.create({
                        data: {
                            HouseJobSid,
                            CompanyMasterSid: payload.CompanyMasterSid ?? null,
                            BranchMasterSid: payload.BranchMasterSid ?? null,
                            NoOfPackage: Number(cargoPayload.NoOfPackage),
                            FreightAmount: String(cargoPayload.FreightAmount ?? '0'),
                            CargoType: cargoPayload.CargoType ?? '',
                            ContainerType: cargoPayload.ContainerType ?? null,
                            WeightUnitSid: cargoPayload.WeightUnit,
                            GrossWeight: Number(cargoPayload.GrossWeight),
                            NetWeight: Number(cargoPayload.NetWeight),
                            Volume: Number(cargoPayload.Volume),
                            ChargeableWeight: Number(cargoPayload.ChargeableWeight) || 0,
                            PackageType: cargoPayload.PackageType,
                            Qty: Number(cargoPayload.Qty),
                            ShipmentTerms: cargoPayload.ShipmentTerms || '',
                            createdBy: payload.updatedBy,          // required
                            updatedBy: payload.updatedBy ?? null,
                            status: 'A',
                            FreightTerms: cargoPayload.FreightTerms || '',
                            MovementType: cargoPayload.MovementType || '',
                            CommodityDescription: cargoPayload.CommodityDescription || '',
                            MarksAndNumber: cargoPayload.MarksAndNumber || '',
                            LandedMarksandNumber: cargoPayload.LandedMarksandNumber || '',
                            ModeOfTransport: cargoPayload.ModeOfTransport || '',
                            NoofContainers: Number(cargoPayload.NoofContainers) || 0,
                            StuffingAt: cargoPayload.StuffingAt || '',
                        },
                    });
                }
            } else {
                // 👉 No cargo needed for this request
                finalHouseJobCargo = null;
            }

            let finalHouseJobProduct: any[] = [];
            const houseJobProductPayload: any = payload.houseJobProduct || [];
            if (houseJobProductPayload.length > 0) {
                for (const product of houseJobProductPayload) {
                    let createdProduct;
                    let updatedProduct;
                    if (product.HouseJobProductSid) {
                        updatedProduct = await this._db.houseJobProduct.update({
                            where: {
                                HouseJobProductSid: product.HouseJobProductSid
                            },
                            data: {
                                HouseJobSid: HouseJobSid,
                                ProductName: product.ProductName || '',
                                ProductDescription: product.ProductDescription || '',
                                ShippingBillNo: product.ShippingBillNo || '',
                                ShippingBillDate: product.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
                                ExternaPkg: product.ExternaPkg,
                                ExternlQty: String(product.ExternlQty) || null,
                                GrossWeight: Number(product.GrossWeight) || 0,
                                ActualGrWeight: Number(product.GrossWeight) || 0,
                                NetWeight: Number(product.NetWeight) || 0,
                                Volume: Number(product.Volume) || 0,
                                ActualVolume: Number(product.Volume) || 0,
                                RecdPack: product.RecdPack || '',
                                CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                                CFS: product.CFS || '',
                                updatedBy: payload.updatedBy,
                                status: product.status ? String(product.status).charAt(0) : 'A',
                                Height: product.Height || 0,
                                Volumetric: Number(product.Volumetric) || 0,
                                HSCode: product.HSCode || '',
                                ImcoClass: product.ImcoClass || '',
                                IsHaz: product.IsHaz || 'N',
                                Length: product.Length || 0,
                                PkgGroup: product.PkgGroup || '',
                                UnNo: product.UnNo || '',
                                Width: product.Width || 0,
                                UomMasterSid: product.UomMasterSid || null,
                                ContainerNo: product.ContainerNo,
                                MasterJobContainerSid: product.MasterJobContainerSid || null,
                                ReceivedQty: product.ReceivedQty || 0,
                                DamageQty: product.DamageQty || 0,
                                DamageRemarks: product.DamageRemarks || '',
                                DeliveryDate: product.DeliveryDate ? new Date(product.DeliveryDate) : null,
                                DeliveredQty: product.DeliveredQty || 0,
                                MarksAndNumber: product.MarksAndNumber
                            }
                        })
                    } else {
                        createdProduct = await this._db.houseJobProduct.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                ProductName: product.ProductName || '',
                                ProductDescription: product.ProductDescription || '',
                                ShippingBillNo: product.ShippingBillNo || '',
                                ShippingBillDate: product.ShippingBillDate ? new Date(product.ShippingBillDate) : null,
                                ExternaPkg: product.ExternaPkg,
                                ExternlQty: String(product.ExternlQty) || null,
                                GrossWeight: Number(product.GrossWeight) || 0,
                                ActualGrWeight: Number(product.GrossWeight) || 0,
                                NetWeight: Number(product.NetWeight) || 0,
                                Volume: Number(product.Volume) || 0,
                                ActualVolume: Number(product.Volume) || 0,
                                RecdPack: product.RecdPack || '',
                                CargoRecDate: product.CargoRecDate ? new Date(product.CargoRecDate) : null,
                                ReceivedQty: product.ReceivedQty || 0,
                                DamageQty: product.DamageQty || 0,
                                DamageRemarks: product.DamageRemarks || '',
                                CFS: product.CFS || '',
                                createdBy: payload.updatedBy,
                                status: product.status ? String(product.status).charAt(0) : 'A',
                                Height: product.Height || 0,
                                Volumetric: Number(product.Volumetric) || 0,
                                HSCode: product.HSCode || '',
                                ImcoClass: product.ImcoClass || '',
                                IsHaz: product.IsHaz || 'N',
                                Length: product.Length || 0,
                                PkgGroup: product.PkgGroup || '',
                                UnNo: product.UnNo || '',
                                Width: product.Width || 0,
                                UomMasterSid: product.UomMasterSid || null,
                                ContainerNo: product.ContainerNo,
                                MasterJobContainerSid: product.MasterJobContainerSid || null,
                                DeliveryDate: product.DeliveryDate ? new Date(product.DeliveryDate) : null,
                                DeliveredQty: product.DeliveredQty || 0,
                                MarksAndNumber: product.MarksAndNumber
                            }
                        })
                    }
                    finalHouseJobProduct.push(updatedProduct || createdProduct);
                }
            }
            console.log(finalHouseJobProduct);

            let finalHouseConnections: any[] = [];
            const houseConnectionPayload = payload.houseConnections || [];
            if (houseConnectionPayload.length > 0) {
                for (const connection of houseConnectionPayload) {
                    let createdConnection;
                    let updatedConnection;
                    if (connection.HouseJobConnectionSid) {
                        updatedConnection = await this._db.houseJobConnection.update({
                            where: {
                                HouseJobConnectionSid: connection.HouseJobConnectionSid
                            },
                            data: {
                                HouseJobSid: HouseJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: connection.ETD ? new Date(connection.ETD) : null,
                                ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks,
                                updatedBy: payload.updatedBy,
                                status: String(connection.status).charAt(0) || 'A',
                            }
                        })
                    }
                    else {
                        createdConnection = await this._db.houseJobConnection.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                Mode: connection.Mode,
                                POL: connection.POL,
                                POD: connection.POD,
                                VesselName: connection.VesselName,
                                VoyageNo: connection.VoyageNo,
                                ETD: connection.ETD ? new Date(connection.ETD) : null,
                                ETA: connection.ETA ? new Date(connection.ETA) : null,
                                Remarks: connection.Remarks,
                                status: String(connection.status).charAt(0) || 'A',
                                createdBy: payload.updatedBy,
                            }
                        })
                    }
                    finalHouseConnections.push(updatedConnection || createdConnection);
                }
            }

            let finalHouseJobOthers;
            const otherPayload = payload.houseJobOthers || [];
            const HouseJobOthersSid = otherPayload.HouseJobOthersSid;
            if (HouseJobOthersSid) {
                finalHouseJobOthers = await this._db.houseJobOthers.update({
                    where: {
                        HouseJobOthersSid: HouseJobOthersSid
                    },
                    data: {
                        HouseJobSid: Number(HouseJobSid),
                        CustomerRefNo: otherPayload.CustomerRefNo || '',
                        OperationUser: otherPayload.OperationUser || '',
                        DocumentationUser: otherPayload.DocumentationUser || '',
                        CustomerServiceuser: otherPayload.CustomerServiceuser || '',
                        NotifyParty: otherPayload.NotifyParty || '',
                        NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                        CHAName: otherPayload.CHAName || '',
                        PickupMode: otherPayload.PickupMode || '',
                        YardCFS: otherPayload.YardCFS || '',
                        LocalTransport: otherPayload.LocalTransport || '',
                        OverseasTransport: otherPayload.OverseasTransport || '',
                        OverseasClearance: otherPayload.OverseasClearance || '',
                        PickupPlace: otherPayload.PickupPlace || '',
                        PickupDate: otherPayload.PickupDate ? new Date(otherPayload.PickupDate) : null,
                        PickupAddress: otherPayload.PickupAddress || '',
                        DeliveryPlace: otherPayload.DeliveryPlace || '',
                        DeliveryDate: otherPayload.DeliveryDate || "",
                        DeliveryAddress: otherPayload.DeliveryAddress || '',
                        CargoCurrency: otherPayload.CargoCurrency || '',
                        BlClause: otherPayload.BlClause || '',
                        CargoValue: Number(otherPayload.CargoValue) || 0,
                        ValueForInsurance: Number(otherPayload.ValueForInsurance) || 0,
                        InsuranceAmount: Number(otherPayload.InsuranceAmount) || 0,
                        ValuationCharge: Number(otherPayload.ValuationCharge) || 0,
                        HandlingInformation: otherPayload.HandlingInformation || '',
                        DeliveryMode: otherPayload.DeliveryMode || '',
                        ExternalRemarks: otherPayload.ExternalRemarks || '',
                        SwitchBL: otherPayload.SwitchBL || '',
                        TransporterName: otherPayload.TransporterName || '',
                        AgentAddress: otherPayload.AgentAddress || '',
                        BacktoBack: otherPayload.BackToBack || '',
                        CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                        CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                        Coloader: otherPayload.Coloader || '',
                        Forwarder: otherPayload.Forwarder || '',
                        ForwarderAddress: otherPayload.ForwarderAddress || '',
                        HBLNo: otherPayload.HBLNo || '',
                        Notify2: otherPayload.Notify2 || '',
                        NotifyAddress2: otherPayload.NotifyAddress2 || '',
                        ROValidity: otherPayload.ROValidity || '',
                        ReleaseType: otherPayload.ReleaseType || '',
                        SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                        SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                        SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                        SwitchLocation: otherPayload.SwitchLocation || '',
                        Depo: otherPayload.Depo,
                        DONo: otherPayload.DONo || '',
                        DODate: otherPayload.DODate ? new Date(otherPayload.DODate) : null,
                        status: 'A',
                        updatedBy: payload.updatedBy || null,
                    }
                })
            } else {
                finalHouseJobOthers = await this._db.houseJobOthers.create({
                    data: {

                        CustomerRefNo: otherPayload.CustomerRefNo || '',
                        OperationUser: otherPayload.OperationUser || '',
                        DocumentationUser: otherPayload.DocumentationUser || '',
                        CustomerServiceuser: otherPayload.CustomerServiceuser || '',
                        NotifyParty: otherPayload.NotifyParty || '',
                        NotifyPartyAddress: otherPayload.NotifyPartyAddress || '',
                        CHAName: otherPayload.CHAName || '',
                        PickupMode: otherPayload.PickupMode || '',
                        YardCFS: otherPayload.YardCFS || '',
                        LocalTransport: otherPayload.LocalTransport || '',
                        OverseasTransport: otherPayload.OverseasTransport || '',
                        OverseasClearance: otherPayload.OverseasClearance || '',
                        PickupPlace: otherPayload.PickupPlace || '',
                        PickupDate: otherPayload.PickupDate ? new Date(otherPayload.PickupDate) : null,
                        PickupAddress: otherPayload.PickupAddress || '',
                        DeliveryPlace: otherPayload.DeliveryPlace || '',
                        DeliveryDate: otherPayload.DeliveryDate || "",
                        BlClause: otherPayload.BlClause || '',
                        DeliveryAddress: otherPayload.DeliveryAddress || '',
                        CargoCurrency: otherPayload.CargoCurrency || '',
                        CargoValue: Number(otherPayload.CargoValue) || 0,
                        ValueForInsurance: Number(otherPayload.ValueForInsurance) || 0,
                        InsuranceAmount: Number(otherPayload.InsuranceAmount) || 0,
                        ValuationCharge: Number(otherPayload.ValuationCharge) || 0,
                        HandlingInformation: otherPayload.HandlingInformation || '',
                        DeliveryMode: otherPayload.DeliveryMode || '',
                        ExternalRemarks: otherPayload.ExternalRemarks || '',
                        SwitchBL: otherPayload.SwitchBL || '',
                        TransporterName: otherPayload.TransporterName || '',
                        AgentAddress: otherPayload.AgentAddress || '',
                        BacktoBack: otherPayload.BackToBack || '',
                        CarrierBookingRef: otherPayload.CarrierBookingRef || '',
                        CarrierBookingDate: otherPayload.CarrierBookingDate ? new Date(otherPayload.CarrierBookingDate) : null,
                        Coloader: otherPayload.Coloader || '',
                        Forwarder: otherPayload.Forwarder || '',
                        ForwarderAddress: otherPayload.ForwarderAddress || '',
                        HBLNo: otherPayload.HBLNo || '',
                        Notify2: otherPayload.Notify2 || '',
                        NotifyAddress2: otherPayload.NotifyAddress2 || '',
                        ROValidity: otherPayload.ROValidity || '',
                        ReleaseType: otherPayload.ReleaseType || '',
                        SwitchBLAgent: otherPayload.SwitchBLAgent || '',
                        SwitchBLConsignee: otherPayload.SwitchBLConsignee || '',
                        SwitchBLShipper: otherPayload.SwitchBLShipper || '',
                        SwitchLocation: otherPayload.SwitchLocation || '',
                        Depo: otherPayload.Depo,
                        DONo: otherPayload.DONo || '',
                        DODate: otherPayload.DODate ? new Date(otherPayload.DODate) : null,
                        status: 'A',
                        createdBy: payload.updatedBy || null,
                        HouseJob: {
                            connect: {
                                HouseJobSid: HouseJobSid
                            }
                        }

                    }

                })
            }
            const finalCharges: any[] = [];
            const allCostRevenueCharges = payload?.bookingRates || [];

            let itemIndex = 1;
            for (const item of allCostRevenueCharges) {
                let createdCharge;
                let updatedCharge;
                if (item.RateSid) {
                    // update
                    const costRevenueChargesPayload = {
                        TransactionSid: updatedHouseJob.HouseJobSid || item.RateSid,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        ShipmentNo: updatedHouseJob.ShipmentNo,
                        MasterJobNo: updatedHouseJob.MBLNo,
                        updatedBy: payload.updatedBy || payload.createdBy || '',
                        status: String(item.status).charAt(0) || 'A',
                        Remarks: item.Remarks || '',

                        SerialNumber: itemIndex++,
                        ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                        ChargeDescription: item.ChargeDescription,
                        ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                        RevenueChargeUomSid:
                            (item.RevenueChargeUomSid ? Number(item.RevenueChargeUomSid) : null) ||
                            (item.ChargeUomSid ? Number(item.ChargeUomSid) : null)!,
                        CostChargeUomSid:
                            (item.CostChargeUomSid! ? Number(item.CostChargeUomSid) : null) ||
                            (item.ChargeUomSid ? Number(item.ChargeUomSid) : null)!,
                        RevenueNumberOfUnit:
                            (item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null) ||
                            (item.NoOfUnit ? Number(item.NoOfUnit) : null)!,
                        CostNumberOfUnit:
                            (item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null) ||
                            (item.NoOfUnit ? Number(item.NoOfUnit) : null)!,

                        // Revenue Section
                        RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? Number(item.RevenueCurrencyMasterSid) : null,
                        RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                        RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                        RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                        RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                        RevenueDrCr: item.RevenueDrCr,
                        RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                        RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                        RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                        RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                        RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                        // Cost Section
                        CostCurrencyMasterSid: item.CostCurrencyMasterSid ? Number(item.CostCurrencyMasterSid) : null,
                        CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                        CostRate: item.CostRate ? Number(item.CostRate) : null,
                        CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                        CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                        CostDrCr: item.CostDrCr,
                        CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                        CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                        CostPrepaidCollect: item.CostPrepaidCollect,
                        CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                        CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                    }
                    updatedCharge = await this._db.costRevenueCharges.update({
                        where: {
                            CostRevenueChargesSid: item.RateSid
                        },
                        data: costRevenueChargesPayload
                    })
                } else {
                    // create
                    const costRevenueChargesPayload = {
                        TransactionSid: updatedHouseJob.HouseJobSid,
                        MenuMasterSid: menuId || payload.MenuMasterSid,
                        ShipmentNo: updatedHouseJob.ShipmentNo,
                        MasterJobNo: updatedHouseJob.MBLNo,
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,

                        SerialNumber: itemIndex++,
                        ChargeMasterSid: item.ChargeMasterSid ? Number(item.ChargeMasterSid) : null,
                        ChargeDescription: item.ChargeDescription,

                        ChargeUomSid: item.ChargeUomSid ? Number(item.ChargeUomSid) : null,
                        RevenueChargeUomSid: Number(item.RevenueChargeUomSid),
                        CostChargeUomSid: Number(item.CostChargeUomSid),
                        RevenueNumberOfUnit: item.RevenueNumberOfUnit ? Number(item.RevenueNumberOfUnit) : null,
                        CostNumberOfUnit: item.CostNumberOfUnit ? Number(item.CostNumberOfUnit) : null,

                        // Revenue Section
                        RevenueCurrencyMasterSid: item.RevenueCurrencyMasterSid ? item.RevenueCurrencyMasterSid : null,
                        RevenueExchangeRate: item.RevenueExchangeRate ? Number(item.RevenueExchangeRate) : null,
                        RevenueRate: item.RevenueRate ? Number(item.RevenueRate) : null,
                        RevenueAmount: item.RevenueAmount ? Number(item.RevenueAmount) : null,
                        RevenueLocalAmount: item.RevenueLocalAmount ? Number(item.RevenueLocalAmount) : null,
                        RevenueDrCr: item.RevenueDrCr,
                        RevenueCustomerMasterSid: item.RevenueCustomerMasterSid ? Number(item.RevenueCustomerMasterSid) : null,
                        RevenueCustomerBranchSid: item.RevenueCustomerBranchSid ? Number(item.RevenueCustomerBranchSid) : null,
                        RevenuePrepaidCollect: item.RevenuePrepaidCollect,
                        RevenueVoucherHeaderSid: item.RevenueVoucherHeaderSid ? Number(item.RevenueVoucherHeaderSid) : null,
                        RevenueVoucherTypeMasterSid: item.RevenueVoucherTypeSid ? Number(item.RevenueVoucherTypeSid) : null,

                        // Cost Section
                        CostCurrencyMasterSid: item.CostCurrencyMasterSid ? item.CostCurrencyMasterSid : null,
                        CostExchangeRate: item.CostExchangeRate ? Number(item.CostExchangeRate) : null,
                        CostRate: item.CostRate ? Number(item.CostRate) : null,
                        CostAmount: item.CostAmount ? Number(item.CostAmount) : null,
                        CostLocalAmount: item.CostLocalAmount ? Number(item.CostLocalAmount) : null,
                        CostDrCr: item.CostDrCr,
                        CostAgentMasterSid: item.CostAgentMasterSid ? Number(item.CostAgentMasterSid) : null,
                        CostAgentBranchSid: item.CostAgentBranchSid ? Number(item.CostAgentBranchSid) : null,
                        CostPrepaidCollect: item.CostPrepaidCollect,
                        CostVoucherHeaderSid: item.CostVoucherHeaderSid ? Number(item.CostVoucherHeaderSid) : null,
                        CostVoucherTypeMasterSid: item.CostVoucherTypeSid ? Number(item.CostVoucherTypeSid) : null,

                        createdBy: payload.updatedBy,
                        status: "A",
                        Remarks: item.Remarks
                    }

                    createdCharge = await this._db.costRevenueCharges.create({
                        data: costRevenueChargesPayload
                    })
                }
                finalCharges.push(createdCharge || updatedCharge);
            }
            const finalHouseJobBOE: any[] = [];
            const houseJobBOEPayload = payload.houseJobBOE || [];

            if (houseJobBOEPayload.length > 0) {
                for (const boe of houseJobBOEPayload) {
                    let createdBOE;
                    let updatedBOE;

                    if (boe.HouseJobBOESid) {
                        // Update existing BOE
                        updatedBOE = await this._db.houseJobBOE.update({
                            where: {
                                HouseJobBOESid: boe.HouseJobBOESid
                            },
                            data: {
                                Sno: boe.Sno || 1,
                                DeclarationNo: boe.DeclarationNo || '',
                                BOENo: boe.BOENo || '',
                                BOEDate: boe.BOEDate ? new Date(boe.BOEDate) : null,
                                BOEValue: boe.BOEValue ? Number(boe.BOEValue) : null,
                                BOEInvoiceValue: boe.BOEInvoiceValue ? Number(boe.BOEInvoiceValue) : null,
                                TransactionType: boe.TransactionType || '',
                                Amount: boe.Amount ? Number(boe.Amount) : null,
                                ProcessDate: boe.ProcessDate ? new Date(boe.ProcessDate) : null,
                                ReceivedDate: boe.ReceivedDate ? new Date(boe.ReceivedDate) : null,
                                AckNumber: boe.AckNumber || '',
                                AckDate: boe.AckDate ? new Date(boe.AckDate) : null,
                                AckStatus: boe.AckStatus || '',
                                Remarks: boe.Remarks || '',
                                UpdatedBy: payload.UpdatedBy,
                                Status: 'A'
                            }
                        });
                    } else {
                        // Create new BOE
                        createdBOE = await this._db.houseJobBOE.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                Sno: boe.Sno || 1,
                                DeclarationNo: boe.DeclarationNo || '',
                                BOENo: boe.BOENo || '',
                                BOEDate: boe.BOEDate ? new Date(boe.BOEDate) : null,
                                BOEValue: boe.BOEValue ? Number(boe.BOEValue) : null,
                                BOEInvoiceValue: boe.BOEInvoiceValue ? Number(boe.BOEInvoiceValue) : null,
                                TransactionType: boe.TransactionType || '',
                                Amount: boe.Amount ? Number(boe.Amount) : null,
                                ProcessDate: boe.ProcessDate ? new Date(boe.ProcessDate) : null,
                                ReceivedDate: boe.ReceivedDate ? new Date(boe.ReceivedDate) : null,
                                AckNumber: boe.AckNumber || '',
                                AckDate: boe.AckDate ? new Date(boe.AckDate) : null,
                                AckStatus: boe.AckStatus || '',
                                Remarks: boe.Remarks || '',
                                CreatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    }
                    finalHouseJobBOE.push(updatedBOE || createdBOE);
                }
            }


            let finalHouseJobVehicle: any[] = [];
            const houseJobVehiclePayload = payload.houseJobVehicle || [];

            if (houseJobVehiclePayload.length > 0) {
                for (const vehicle of houseJobVehiclePayload) {
                    let createdVehicle;
                    let updatedVehicle;

                    if (vehicle.HouseJobVehicleSid) {
                        // Update existing vehicle
                        updatedVehicle = await this._db.houseJobVehicle.update({
                            where: {
                                HouseJobVehicleSid: vehicle.HouseJobVehicleSid
                            },
                            data: {
                                VehicleIndicator: vehicle.VehicleIndicator,
                                UsedNew: vehicle.UsedNew,
                                ChassisNo: vehicle.ChassisNo,
                                CaseNo: vehicle.CaseNo,
                                Make: vehicle.Make,
                                Model: vehicle.Model,
                                EngineNo: vehicle.EngineNo,
                                YearBuilt: vehicle.YearBuilt,
                                Color: vehicle.Color,
                                Rolling: vehicle.Rolling,
                                GoodsDescription: vehicle.GoodsDescription,
                                Weight: vehicle.Weight ? Number(vehicle.Weight) : null,
                                Volume: vehicle.Volume ? Number(vehicle.Volume) : null,
                                Remarks: vehicle.Remarks,
                                UpdatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    } else {
                        // Create new vehicle
                        createdVehicle = await this._db.houseJobVehicle.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                VehicleIndicator: vehicle.VehicleIndicator,
                                UsedNew: vehicle.UsedNew,
                                ChassisNo: vehicle.ChassisNo,
                                CaseNo: vehicle.CaseNo,
                                Make: vehicle.Make,
                                Model: vehicle.Model,
                                EngineNo: vehicle.EngineNo,
                                YearBuilt: vehicle.YearBuilt,
                                Color: vehicle.Color,
                                Rolling: vehicle.Rolling,
                                GoodsDescription: vehicle.GoodsDescription,
                                Weight: vehicle.Weight ? Number(vehicle.Weight) : null,
                                Volume: vehicle.Volume ? Number(vehicle.Volume) : null,
                                Remarks: vehicle.Remarks,
                                CreatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    }
                    finalHouseJobVehicle.push(updatedVehicle || createdVehicle);
                }
            }
            let finalHouseJobCustoms: any[] = [];
            const houseJobCustomsPayload = payload.houseJobCustoms || [];

            if (houseJobCustomsPayload.length > 0) {
                for (const customs of houseJobCustomsPayload) {
                    let createdCustoms;
                    let updatedCustoms;

                    if (customs.HouseJobCustomsSid) {
                        // Update existing customs
                        updatedCustoms = await this._db.houseJobCustoms.update({
                            where: {
                                HouseJobCustomsSid: customs.HouseJobCustomsSid
                            },
                            data: {
                                LineCode: customs.LineCode,
                                VoyageAgentCode: customs.VoyageAgentCode,
                                RotationNumber: customs.RotationNumber,
                                ManifestSequence: customs.ManifestSequence,
                                CargoCode: customs.CargoCode,
                                StorageRequest: customs.StorageRequest,
                                PackageTypeCode: customs.PackageTypeCode,
                                FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                                NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                                SLACIndicator: customs.SLACIndicator,
                                ImporterCode: customs.ImporterCode,
                                SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                                UsedOrNew: customs.UsedOrNew,
                                UNHSCode: customs.UNHSCode,
                                UNNumber: customs.UNNumber,
                                FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                                TemperatureUnit: customs.TemperatureUnit,
                                HazStorageRequest: customs.HazStorageRequest,
                                RefrigerationRequired: customs.RefrigerationRequired,
                                MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                                MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                                RefTemperatureUnit: customs.RefTemperatureUnit,
                                UpdatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    } else {
                        // Create new customs
                        createdCustoms = await this._db.houseJobCustoms.create({
                            data: {
                                HouseJobSid: HouseJobSid,
                                CompanyMasterSid: payload.CompanyMasterSid,
                                LineCode: customs.LineCode,
                                VoyageAgentCode: customs.VoyageAgentCode,
                                RotationNumber: customs.RotationNumber,
                                ManifestSequence: customs.ManifestSequence,
                                CargoCode: customs.CargoCode,
                                StorageRequest: customs.StorageRequest,
                                PackageTypeCode: customs.PackageTypeCode,
                                FreightTonne: customs.FreightTonne ? Number(customs.FreightTonne) : null,
                                NoOfPallets: customs.NoOfPallets ? Number(customs.NoOfPallets) : null,
                                SLACIndicator: customs.SLACIndicator,
                                ImporterCode: customs.ImporterCode,
                                SerialNumber: customs.SerialNumber ? Number(customs.SerialNumber) : 0,
                                UsedOrNew: customs.UsedOrNew,
                                UNHSCode: customs.UNHSCode,
                                UNNumber: customs.UNNumber,
                                FlashPoints: customs.FlashPoints ? Number(customs.FlashPoints) : null,
                                TemperatureUnit: customs.TemperatureUnit,
                                HazStorageRequest: customs.HazStorageRequest,
                                RefrigerationRequired: customs.RefrigerationRequired,
                                MinTemperature: customs.MinTemperature ? Number(customs.MinTemperature) : null,
                                MaxTemperature: customs.MaxTemperature ? Number(customs.MaxTemperature) : null,
                                RefTemperatureUnit: customs.RefTemperatureUnit,
                                CreatedBy: payload.updatedBy,
                                Status: 'A'
                            }
                        });
                    }
                    finalHouseJobCustoms.push(updatedCustoms || createdCustoms);
                }
            }

            return {
                houseJob: updatedHouseJob,
                houseJobCargo: finalHouseJobCargo,
                houseJobProduct: finalHouseJobProduct,
                houseConnections: finalHouseConnections,
                houseJobOthers: finalHouseJobOthers,
                houseJobBOE: finalHouseJobBOE,
                houseJobVehicle: finalHouseJobVehicle,
                houseJobCustoms: finalHouseJobCustoms,
                bookingRates: finalCharges,
                costRevenueCharges: finalCharges
            };
        }
        catch (error) {
            throw error;
        }
    }


    async getHouseJobByBookingNo(BookingNumber: string) {
            try {
                const ourBooking = await this._db.houseJob.findFirst({
                    where: {
                        ShipmentNo: BookingNumber
                    },
                    include: {
                        Cargo: { where: { status: 'A' } },
                        Products: { where: { status: 'A' } },
                        Others: { where: { status: 'A' } },
                        Connections: { where: { status: 'A' } }
                    }
                })
    
                if (!ourBooking) {
                    throw new BadRequestException('Error fetching booking record.');
                }

                let voyageDetails;
                if (ourBooking.VoyageMasterSid) {
                    const data = await this._db.voyageMasterHeader.findUnique({
                        where: {
                            VoyageMasterHeaderSid: ourBooking.VoyageMasterSid
                        },
                        include: {
                            voyageMasterDetail: {
                                where: {
                                    status: 'A'
                                },
                                select: {
                                    ETA: true,
                                    ETD: true,
                                    PortCutoff: true,
                                    portMasterPOL: {
                                        select: {
                                            PortCode: true
                                        }
                                    }
                                },
                            }
                        }
                    })
                    const POL = data?.voyageMasterDetail.find(vd => vd.portMasterPOL?.PortCode === ourBooking.POL);
                    const POD = data?.voyageMasterDetail.find(vd => vd.portMasterPOL?.PortCode === ourBooking.POD);
                    voyageDetails = {
                        POLETA: POL?.ETA,
                        POLETD: POL?.ETD,
                        PODETA: POD?.ETA,
                        PODETD: POD?.ETD,
                        POLCutOffDate: POL?.PortCutoff,
                        PODCutOffDate: POD?.PortCutoff
                    }
                }
    
                return {
                    ...ourBooking,
                    voyageDetails
                }
            } catch (error) {
                throw error;
            }
        }

    async getMasterJobContainersByMasterJobSid(MasterJobSid: number) {
        try {
            const ourMasterJobContainers = await this._db.masterJobContainer.findMany({
                where : {
                    MasterJobSid : MasterJobSid,
                    Status : 'A'
                }
            })
            return ourMasterJobContainers;
        } catch (error) {
            throw error;
        }
    }

    async updateHBLCount(payload : {
        CompanyMasterSid : number,
        BranchMasterSid : number,
        HouseJobSid : number,
    }){
        try {
            const ourHouse = await this._db.houseJob.update({
                where : {
                    CompanyMasterSid : payload.CompanyMasterSid,
                    BranchMasterSid : payload.BranchMasterSid,
                    HouseJobSid : payload.HouseJobSid,
                    status : 'A'
                },
                data : {
                    HBLCount : {
                        increment : 1
                    }
                }
            })
            return ourHouse;
        } catch (error) {
            throw error;
        }
    }

async getHouseJobARAPData(HouseJobSid: number): Promise<any> {
  try {
    // Using Prisma view instead of raw query
    const arapData = await this._db.vHouseARAP.findMany({
      where: {
        HouseJobSid: HouseJobSid
      },
      orderBy: {
        VoucherDate: 'desc'
      }
    });
 
    return arapData;
  } catch (error) {
    this.logger.error(`Error fetching AR/AP data: ${error.message}`);
    throw error;
  }
}
async softDeleteHouseJobProduct(HouseJobProductSid: number) {
  try {
    const deletedHouseJobProduct = await this._db.houseJobProduct.update({
      where: {
        HouseJobProductSid: HouseJobProductSid
      },
      data: { status: 'D' }
    })
    return deletedHouseJobProduct;
  } catch (error) {
    throw error;
  } 
}
}
