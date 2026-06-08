import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ApprovalStatus, Prisma, PrismaClient } from '@prisma/client';
import {
  BLIssueListReportQueryDto,
  ContainerKPIReportQueryDto,
  CostRevenueNotBookedReportQueryDto,
  DestinationReportQueryDto,
  DOIssueListReportQueryDto,
  exportJobVolumeTEUReportQueryDto,
  houseJobLossReportQueryDto,
  lostCustomerReportQueryDto,
  NetworkReportQueryDto,
  profitabilityReportQueryDto,
  ProfitSummaryReportQueryDto,
  ShipmentDetailedSummaryReportQueryDto,
  ShipmentSummaryReportQueryDto,
  tradelaneProfitabilityReportQueryDto,
  unbilledcostReportQueryDto,
  unbilledrevenueReportQueryDto,
} from 'src/operation/DTO/operation-reports.dto';
import { ProRateService } from 'src/operation/services/pro-rate/pro-rate.service';
import { toNumber } from 'src/common/helper';
import { VoucherService } from 'src/accounts/services/voucher/voucher.service';

@Injectable()
export class OperationReportsService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
    private readonly proRateService: ProRateService,
    private readonly voucherService: VoucherService,
  ) {}

  async getAvailableReports(companyId: number) {
    try {
      // Get all operation reports
      const operationMenu = await this._db.menuMaster.findFirst({
        where: {
          MenuName: 'Operation Reports',
          status: 'A',
        },
      });

      if (!operationMenu) {
        return [];
      }

      const allReports = await this._db.reportMaster.findMany({
        where: {
          ReportMenuSid: operationMenu.MenuMasterSid,
          Status: 'A',
        },
        include: {
          ReportMasterDetail: {
            where: { Status: 'A' },
            orderBy: { ReportMasterDetailSid: 'asc' },
          },
        },
        orderBy: { ReportMasterSid: 'asc' },
      });

      // Filter by company exclusion
      const filteredReports = allReports.filter((report) => {
        if (!report.ReportExcludedCompany) return true;
        const excludedCompanies = Array.isArray(report.ReportExcludedCompany)
          ? report.ReportExcludedCompany
          : [];
        return !excludedCompanies.includes(companyId);
      });

      return filteredReports;
    } catch (error) {
      this.logger.error(`getAvailableReportsError: ${error}`);
      throw error;
    }
  }

  async getReportParameters(reportName: string) {
    try {
      const report = await this._db.reportMaster.findFirst({
        where: {
          ReportName: reportName,
          Status: 'A',
        },
        include: {
          ReportMasterDetail: {
            where: { Status: 'A' },
            orderBy: { ReportMasterDetailSid: 'asc' },
          },
        },
      });

      if (!report) {
        throw new BadRequestException(`Report ${reportName} not found`);
      }

      return report.ReportMasterDetail;
    } catch (error) {
      throw error;
    }
  }

  async generateReport(reportName: string, parameters: any) {
    try {
      // Route to specific report generator
      switch (reportName) {
        case 'bl-issue-list':
          return await this.generateBLIssueList(parameters);
        case 'shipment-summary':
          return await this.generateShipmentSummaryReport(parameters);
        case 'containerwise-details-report':
          return await this.generateContainerwiseDetailsReport(parameters);
        case 'contanier-wise-kpi':
          return await this.generateContainerKPIReport(parameters);
        case 'do-issue-list':
          return await this.generateDOIssueList(parameters);
        case 'shipment-summary-details':
          return await this.generateShipmentDetailedSummary(parameters);
        case 'profitability-report':
          return await this.generateProfitabilityReport(parameters);
        case 'unbilled-cost-report':
          return await this.generateUnbilledCostReport(parameters);
        case 'unbilled-revenue-report':
          return await this.generateUnbilledRevenueReport(parameters);
        case 'house-job-loss-report':
          return await this.generateHouseJobLossReport(parameters);
        case 'profit-summary':
          return await this.generateProfitSummaryReport(parameters);
        case 'lost-customer-report':
          return await this.generateLostCustomerReport(parameters);
        case 'destination-report':
          return await this.generateDestinationReport(parameters);
        case 'export-job-volume-teu-report':
          return await this.generateExportJobVolumeTEUReport(parameters);
        case 'comprehensive-management':
          return await this.generateComprehensiveManagementReport(parameters);
        case 'tradelane-profitability':
          return await this.generateTradelaneProfitability(parameters);
        case 'network-report':
          return await this.generateNetworkReport(parameters);
        case 'freight-mom-growth':
          return await this.generateFreightMoMGrowthReport(parameters);
        case 'not-booked-rates':
          return await this.generateCostRevenueNotBookedReport(parameters);
        case 'unpicked-cargo':
          return await this.generateUnpickedCargoReport(parameters);
        case 'transhipment-cargo':
          return await this.generateTranshipmentCargoReport(parameters);
        case 'nomination-booking':
          return await this.generateImportNominationBookingReport(parameters);
        case 'daily-job-register':
          return await this.generateDailyJobRegisterReport(parameters);
        case 'destuffing':
          return await this.generateDestuffingReport(parameters);
        default:
          throw new BadRequestException(`Report ${reportName} not implemented`);
      }
    } catch (error) {
      throw error;
    }
  }

  // Report generators - To be implemented
  // BL_Issue Report
  private async generateBLIssueList(params: BLIssueListReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
      BLIssue = false,
    } = params;

    try {
      this.logger.log(
        `Getting BL_Issue report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [
            { HBLDate: { gte: FromHblDt } },
            { HBLDate: { lte: ToHblDt } },
            BLIssue ? { HBLCount: { gt: 0 } } : { HBLCount: 0 },
          ],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          masterJob: {
            where: { Status: 'A' },
            select: {
              MasterJobSid: true,
              MBLNo: true,
            },
          },
          bookingHeader: {
            where: {
              status: 'A',
            },
            select: {
              BookingNo: true,
            },
          },
          departmentMaster: {
            select: {
              departmentName: true,
            },
          },
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (houseJobData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      const data = houseJobData.map((hj) => {
        const masterJob = hj.masterJob;
        const departmentName = hj.departmentMaster?.departmentName || null;

        return {
          HBLDate: hj.HBLDate,
          HBLNo: hj.HBLNo,
          HBLCount: hj.HBLCount,
          MBLNo: masterJob ? masterJob.MBLNo : null,
          BookingNo: hj.bookingHeader?.BookingNo,
          Shipper: hj.ShipperName,
          Consignee: hj.ConsigneeName,
          POL: hj.POL,
          POD: hj.POD,
          departmentName,
          jobStatus: hj.HouseStatus,
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchInvolved,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        BLIssue,
      };
    } catch (error) {
      this.logger.error(
        `Error generating shipment summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Shipment_summary_Report
  private async generateShipmentSummaryReport(
    params: ShipmentSummaryReportQueryDto,
  ) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
      HouseStatus,
    } = params;

    const selectedHouseStatus =
  HouseStatus !== undefined && HouseStatus !== null && HouseStatus !== ''
    ? HouseStatus.trim()
    : null;
    try {
      this.logger.log(
        `Getting shipment summary report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true },
      });

      const containerTypeMap = new Map(
        containerTypesMaster.map((ct) => [
          ct.ContainerTypeMasterSid,
          ct.ContainerSize,
        ]),
      );

      const agentMaster = await this._db.customerMaster.findMany({
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
        },
      });

      const usermaster = await this._db.userMaster.findMany({ 
        where:{status:'A'},
        select:{
          UserMasterSid:true,
          userName:true
        }
      });

      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [{ HBLDate: { gte: FromHblDt } }, { HBLDate: { lte: ToHblDt } }],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        ...(selectedHouseStatus && selectedHouseStatus.toLowerCase() !== 'all'
          ? {
              HouseStatus: {
                equals: selectedHouseStatus,
                mode: 'insensitive',
              },
            }
          : {}),
        },
        include: {
          Cargo: true,
          Products: {
            where: { status: 'A' },
          },
          Others: true,
          masterJob: {
            include: {
              containers: {
                where: { Status: 'A' },
                include: {
                  containerType: {
                    select: {
                      ContainerTypeMasterSid: true,
                      ContainerSize: true,
                      NoOfTeu: true,
                      ContainerName: true,
                    },
                  },
                },
              },
              voyages: true,
            },
          },
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (houseJobData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      const portCodes = new Set<string>();

      houseJobData.forEach((hj) => {
        if (hj.POL) portCodes.add(hj.POL);
        if (hj.POD) portCodes.add(hj.POD);
        if (hj.FPD) portCodes.add(hj.FPD);
        if (hj.POO) portCodes.add(hj.POO);
      });

      const ports = await this._db.portMaster.findMany({
        where: {
          PortCode: { in: Array.from(portCodes) },
        },
        select: {
          PortCode: true,
          PortName: true,
        },
      });

      const portMap = new Map(
        ports.map((port) => [port.PortCode, port.PortName]),
      );


      const data = houseJobData.map((hj) => {
        const type = hj.DestinationAgent ? 'Agent' : null;

        const localShipmentVol =
          hj.JobType === 'Import' || hj.JobType === 'Export'
            ? hj.Cargo?.reduce(
                (sum, cargo) => sum + Number(cargo.Volume || 0),
                0,
              )
            : 0;

        const transhipmentVol =
          hj.JobType === 'Transhipment'
            ? hj.Cargo?.reduce(
                (sum, cargo) => sum + Number(cargo.Volume || 0),
                0,
              )
            : 0;

        const houseProducts = hj.Products;
        const allContainers = hj.masterJob?.containers || [];

        let totalNoOfTEU = 0;
        let numberOfTwentyFt = 0;
        let numberOfFourtyFt = 0;
        let numberOfFortyFive = 0;
        let containerMap = 
          new Map<number,{
            ContainerNumber:string,
            ContainerName :string, 
            ContainerSize : number,
            NoOfTeu:number
          }>();

        houseProducts.forEach((hp) => {

          const getContainerSize = (size:string) => {
            if(size.includes('20')) return 20;
            if(size.includes('40')) return 40;
            if(size.includes('45')) return 45;
            return 0;
          }

          const ourMJContainer = allContainers.find(
            (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
          );
          const ourContainerType = ourMJContainer?.containerType;
          
          if(ourContainerType && ourMJContainer?.MasterJobContainerSid){
            const alreadyExists = containerMap.has(ourMJContainer?.MasterJobContainerSid);

            if(!alreadyExists)  {
              containerMap.set(ourMJContainer?.MasterJobContainerSid,{
                ContainerNumber:ourMJContainer?.ContainerNumber,
                ContainerName:ourContainerType?.ContainerName,
                ContainerSize : getContainerSize(ourContainerType?.ContainerSize),
                NoOfTeu:toNumber(ourContainerType?.NoOfTeu)
              })
            }
          }
        });

        const containerUniqueInfo = Array.from(containerMap.values());
        containerUniqueInfo.forEach((cont) => {
          if(cont.ContainerSize === 20) numberOfTwentyFt++;
          if(cont.ContainerSize === 40) numberOfFourtyFt++;
          if(cont.ContainerSize === 45) numberOfFortyFive++;
          totalNoOfTEU += cont.NoOfTeu;
        });


        // houseProducts.forEach((hp) => {

        //   const getContainerSize = (size:string) => {
        //     if(size.includes('20')) return 20;
        //     if(size.includes('40')) return 40;
        //     if(size.includes('45')) return 45;
        //     return 0;
        //   }

        //   const ourMJContainer = allContainers.find(
        //     (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
        //   );
        //   const ourContainerType = ourMJContainer?.containerType;
          
        //   if(ourContainerType && containerMap.has(ourMJContainer?.MasterJobContainerSid)){
        //     const prev = containerMap.get(ourMJContainer?.MasterJobContainerSid);

        //     if(prev) {
        //       containerMap.set(ourMJContainer?.MasterJobContainerSid,{
        //         ContainerNumber:prev.ContainerNumber,
        //         ContainerName:prev.ContainerName,
        //         ContainerSize:prev.ContainerSize,
        //         NoOfTeu:prev.NoOfTeu+ toNumber(ourContainerType?.NoOfTeu)
        //       })
        //     } else {
        //       containerMap.set(ourMJContainer?.MasterJobContainerSid,{
        //         ContainerNumber:ourMJContainer?.ContainerNumber,
        //         ContainerName:ourContainerType?.ContainerName,
        //         ContainerSize : getContainerSize(ourContainerType?.ContainerSize),
        //         NoOfTeu:toNumber(ourContainerType?.NoOfTeu)
        //       })
        //     }
            
        //   }
          
        //   totalNoOfTEU += toNumber(ourContainerType?.NoOfTeu);
        //   const sizeTrimmed =
        //     ourContainerType?.ContainerName?.trim().toLowerCase();
        //   if (sizeTrimmed?.includes('20ft')) numberOfTwentyFt++;
        //   if (
        //     sizeTrimmed?.includes('40ft') ||
        //     sizeTrimmed?.includes('40 rf') ||
        //     sizeTrimmed?.includes('40rf') ||
        //     sizeTrimmed?.includes('40 flat rack') ||
        //     sizeTrimmed?.includes('fotp')
        //   )
        //     numberOfFourtyFt++;
        //   if (sizeTrimmed?.includes('45ft') || sizeTrimmed?.includes('45hc'))
        //     numberOfFortyFive++;
        // });

        // const containerInfo = (mj.masterJob?.containers || [])
        //   .filter(c => houseContainerSids.includes(c.MasterJobContainerSid))
        //   .map(c => ({
        //     containerNumber: mj.Products?.find(p => p.MasterJobContainerSid === c.MasterJobContainerSid)?.ContainerNo || '',
        //     containerType: c.containerType?.ContainerSize || '',
        //     NoOfTeu: c.containerType?.NoOfTeu || 0,
        //   }));

        // (mj.masterJob?.containers || [])
        //   .filter(c => c.MasterJobContainerSid === houseContainerSid)
        //   .forEach(c => {
        //     totalNoOfTEU += Number(c.containerType?.NoOfTeu || 0);

        //     const size = c.containerType?.ContainerSize?.trim();
        //     if (size === "20") numberOfTwentyFt++;
        //     if (size === "40") numberOfFourtyFt++;
        //     if (size === "45") numberofFurtyFive++;
        //   });

        const polName = hj.POL ? portMap.get(hj.POL) || '' : '';
        const podName = hj.POD ? portMap.get(hj.POD) || '' : '';
        const fpdName = hj.FPD ? portMap.get(hj.FPD) || '' : '';
        const pooName = hj.POO ? portMap.get(hj.POO) || '' : '';
        const jobTypesArray = Array.isArray(hj.JobType)
          ? hj.JobType
          : [{ JobType: hj.JobType }];

        return {
          masterNo: hj.masterJob?.MasterJobNumber,
          Hblno: hj.HBLNo,
          HblDate: hj.HBLDate,
          masterDate: hj.MBLDate,
          department:
            departments.find(
              (d) => d.DepartmentMasterSid === hj.DepartmentMasterSid,
            )?.departmentName || '',
          CustomerName:agentMaster.find(c=>c.CustomerMasterSid === hj.CustomerMasterSid)?.CustomerName || '',
          mblNo: hj.masterJob?.MBLNo || '',
          vesselName: hj?.VesselName || '',
          voyageNo: hj?.VoyageNo || '',
          etd: hj?.ETA || '',
          eta: hj?.ETD || '',
          originPort: hj.POO || '',
          originPortName: pooName || '',
          loadPort: hj.POL || '',
          loadPortName: polName,
          dischargePort: hj.POD || '',
          dischargePortName: podName,
          destinationPort: hj.FPD || '',
          destinationPortName: fpdName,
          carrier: hj?.CarrierName || '',
          weight: hj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.GrossWeight),
            0
          ) || 0,
          NoofPkg: hj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.NoOfPackage),
            0
          ) || 0,
          volume: hj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.Volume),
            0
          ) || 0,
          Volumetric: hj.Cargo?.reduce(
            (sum, item) => sum + (item?.Volumetric ? Number(item.Volumetric) : 0),
            0
          ) || 0,
          chargeable: hj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.ChargeableWeight),
            0
          ) || 0,
          shipper: hj?.ShipperName || '',
          Consignee: hj?.ConsigneeName || '',
          Notify: hj?.Notify || '',
          Forwarder:hj?.Others?.[0]?.Forwarder,
        containerNoList: Array.from(containerMap.values()).map((c) => c.ContainerNumber).join(', '),
          // noOfContainers: hj.Cargo?.reduce((sum, cargo) => sum + (cargo.NoofContainers || 0), 0) || 0,
          nofcontainer: numberOfFourtyFt + numberOfTwentyFt + numberOfFortyFive,
          mastercontainerSid:
            hj?.masterJob?.containers
              ?.map((c: any) => c.mastercontainerSid)
              .join(', ') || '',
          masterContanierSid:
            hj?.masterJob?.containers?.[0]?.MasterJobContainerSid,
          sendingAgent: hj?.AgentName,
          receivingAgent:
            agentMaster.find((d) => d.CustomerMasterSid === hj.DestinationAgent)
              ?.CustomerName || '',
          type,
          // containerInfo,
          totalNoOfTEU,
          numberOfTwentyFt,
          numberOfFourtyFt,
          numberOfFortyFive,
          localShipment:
            jobTypesArray?.filter(
              (job) => job.JobType === 'Import' || job.JobType === 'Export',
            ).length || 0,
          transhipmentShipment:
            jobTypesArray?.filter((job) => job.JobType === 'Transhipment')
              .length || 0,
          totalShipment:
            (jobTypesArray?.filter(
              (job) => job.JobType === 'Import' || job.JobType === 'Export',
            ).length || 0) +
            (jobTypesArray?.filter((job) => job.JobType === 'Transhipment')
              .length || 0),
          localShipmentVol,
          transhipmentVol,
          houseStatus: hj?.HouseStatus,
          Salesman: usermaster.find((d) => d.UserMasterSid === hj.SalesmanSid)?.userName || '',
          ShipmentTerms:hj.Cargo?.[0]?.ShipmentTerms,
          IncoTerms:hj.IncoTerms,
          PPCC : hj.FreightTerms,
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchInvolved,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
      };
    } catch (error:any) {
      this.logger.error(
        `Error generating shipment summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Profitability_Report
  private async generateProfitabilityReport(
    params: profitabilityReportQueryDto,
  ) {
    const {
      companyId: CompanyMasterSid,
      ToJobDt,
      FromJobDt,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      this.logger.log(
        `Getting Profitability report for CompanySid=${CompanyMasterSid}, From=${FromJobDt}, To=${ToJobDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      const profitabilityMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
            { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'Service Job', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
            {
              MenuName: { contains: 'AgentMaster Air Way', mode: 'insensitive' },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allMasterMenuSids = profitabilityMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'master job' || menuName.includes('master air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      const allHouseMenuSids = profitabilityMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'house job' ||
            menuName === 'service job' ||
            menuName.includes('house air way') ||
            menuName.includes('agent master air way') ||
            menuName.includes('agentmaster air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      // Load container type master (ID → Size Map)
      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: {
          ContainerTypeMasterSid: true,
          ContainerSize: true,
          MaxVolume: true,
        },
      });
      const containerTypeMap = new Map(
        containerTypesMaster.map((ct) => [
          ct.ContainerTypeMasterSid,
          ct.ContainerSize,
        ]),
      );

      // Fetch master jobs with house jobs and containers
      const masterJobs = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [{ MBLDate: { gte: FromJobDt } }, { MBLDate: { lte: ToJobDt } }],
          Status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          houseJob: {
            select: {
              Products: {
                where: {
                  status: 'A',
                },
              },
              HouseJobSid: true,
              HouseNo: true,
              HBLNo: true,
              MenuMasterSid: true,
            },
            where: { status: 'A' },
          },
          containers: {
            where: {
              Status: 'A',
            },
            include: {
              containerType: {
                select: {
                  MaxVolume: true,
                  ContainerSize: true,
                  ContainerName: true,
                  NoOfTeu: true,
                },
              },
            },
          },
        },
        orderBy: { MBLDate: 'asc' },
      });

      if (!masterJobs.length) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      // Collect all MasterJob and HouseJob IDs
      const masterJobIds = masterJobs.map((mj) => mj.MasterJobSid);
      const houseJobIds = masterJobs.flatMap((mj) =>
        mj.houseJob.map((hj) => hj.HouseJobSid),
      );

      const allMasterCR = await this._db.costRevenueCharges.findMany({
        where: {
          status: 'A',
          MenuMasterSid: { in: allMasterMenuSids },
          TransactionSid: { in: masterJobIds },
        },
        select: {
          TransactionSid: true,
          MenuMasterSid: true,
          CostRevenueChargesSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueDrCr: true,
          RevenueLocalAmount: true,
          CostVoucherHeaderSid: true,
          CostDrCr: true,
          CostLocalAmount: true,
        },
      });

      // Create Maps for quick lookup
      const masterCRMap = new Map<number, any[]>();
      const houseCRMap = new Map<number, any[]>();
      const masterMenuSet = new Set(allMasterMenuSids);

      allMasterCR.forEach((cr) => {
        const key = cr.TransactionSid!;
        if (masterMenuSet.has(cr.MenuMasterSid!)) {
          if (!masterCRMap.has(key)) masterCRMap.set(key, []);
          masterCRMap.get(key)!.push(cr);
        }
      });

      // const houseJobMenu = await this._db.menuMaster.findFirst({
      //   where: { MenuName: 'House Job', status: 'A' },
      //   select: { MenuMasterSid: true },
      // });

      // if (!houseJobMenu) {
      //   throw new BadRequestException('House Job menu not found');
      // }

      const allHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          status: 'A',
          MenuMasterSid: {in: allHouseMenuSids},
          TransactionSid: { in: houseJobIds },
        },
        select: {
          TransactionSid: true,
          MenuMasterSid: true,
          CostRevenueChargesSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueDrCr: true,
          RevenueLocalAmount: true,
          CostVoucherHeaderSid: true,
          CostDrCr: true,
          CostLocalAmount: true,
        },
      });

      allHouseCR.forEach((cr) => {
        const key = cr.TransactionSid!;
        if (!houseCRMap.has(key)) {
          houseCRMap.set(key, []);
        }
        houseCRMap.get(key)!.push(cr);
      });

      // Map each master job to its CostRevenueCharges
      const data = await Promise.all(
        masterJobs.map(async (job) => {
          const relatedCR = masterCRMap.get(job.MasterJobSid) || [];

          const totalCost = relatedCR.reduce((sum, cr) => {
            return cr.CostDrCr === 'D'
              ? toNumber(sum) + toNumber(cr.CostLocalAmount)
              : toNumber(sum) - toNumber(cr.CostLocalAmount);
          }, 0);

          const totalRevenue = relatedCR.reduce((sum, cr) => {
            return cr.RevenueDrCr === 'C'
              ? toNumber(sum) + toNumber(cr.RevenueLocalAmount)
              : toNumber(sum) - toNumber(cr.RevenueLocalAmount);
          }, 0);

          const houseJobs = job.houseJob || [];

          const houseRateMap: Map<number, any[]> = new Map();

          houseJobs.forEach((hj) => {
            houseRateMap.set(
              hj.HouseJobSid,
              houseCRMap.get(hj.HouseJobSid) || [],
            );
          });

          // Count containers by size
          const houseProducts = job.houseJob.flatMap((h) => h.Products || []);
          const allContainers = job.containers || [];
          let totalNoOfTEU = 0;
          let numberOfTwentyFt = 0;
          let numberOfFourtyFt = 0;
          let numberofFurtyFive = 0;
          let containerInfo: any[] = [];
          houseProducts.forEach((hp) => {
            const ourMJContainer = allContainers.find(
              (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
            );
            const ourContainerType = ourMJContainer?.containerType;
            if (!ourContainerType) return;
            containerInfo.push({
              containerNumber: hp.ContainerNo,
              containerType: ourContainerType.ContainerSize,
              NoOfTeu: toNumber(ourContainerType.NoOfTeu),
            });
            totalNoOfTEU += toNumber(ourContainerType.NoOfTeu);
            const size = ourContainerType.ContainerName;
            if (
              size === '20ft Standard' ||
              size === '20ft Reefer' ||
              size === '20ft Open Top' ||
              size === '20ft Flat Rack'
            ) {
              numberOfTwentyFt++;
            }
            if (
              size === '40ft Container' ||
              size === '40 RF' ||
              size === '40 Flat Rack' ||
              size === '40Ft Open Top'
            ) {
              numberOfFourtyFt++;
            }
           if (
             size?.trim() === '45ft Container' ||
             size?.trim() === '45Ft Open Top' ||
             size?.trim() === '45 Flat Rack' ||
             size?.trim() === '45 RF' ||
             size?.trim() === '45ft High Cube'
           ) {
             numberofFurtyFive++;
           }
          });

          // First, calculate total for house jobs
          let totalHouseCost = 0;
          let totalHouseRevenue = 0;
          const houseJobsData = houseJobs.map((house) => {
            const costRevenues = houseRateMap.get(house.HouseJobSid) || [];
            const totalCost = costRevenues.reduce((sum, cr) => {
              return cr.CostDrCr === 'D'
                ? Number(sum) + Number(cr.CostLocalAmount ?? 0)
                : Number(sum) - Number(cr.CostLocalAmount ?? 0);
            }, 0);
            const totalRevenue = costRevenues.reduce((sum, cr) => {
              return cr.RevenueDrCr === 'C'
                ? Number(sum) + Number(cr.RevenueLocalAmount ?? 0)
                : Number(sum) - Number(cr.RevenueLocalAmount ?? 0);
            }, 0);
            totalHouseCost += totalCost;
            totalHouseRevenue += totalRevenue;
            return {
              HouseJobSid: house.HouseJobSid,
              HouseNo: house.HouseNo,
              HBLNo: house.HBLNo,
              totalCost,
              totalRevenue,
            };
          });

          const totalCostWithHouse = totalCost + totalHouseCost;
          const totalRevenueWithHouse = totalRevenue + totalHouseRevenue;
          const GP = totalRevenueWithHouse - totalCostWithHouse;
          const getActualForCharges = async (charges: any[]) => {
            const actuals = await Promise.all(
              charges.map((charge) =>
                this.voucherService.getActualAmountForCostRevenue(
                  charge.CostRevenueChargesSid,
                ),
              ),
            );

            return actuals.reduce(
              (sum, item) => {
                sum.ActualCost += item.ActualCost;
                sum.ActualRevenue += item.ActualRevenue;
                return sum;
              },
              { ActualCost: 0, ActualRevenue: 0 },
            );
          };

          const masterActuals = await getActualForCharges(relatedCR);
          const houseCharges = houseJobs.flatMap(
            (house) => houseRateMap.get(house.HouseJobSid) || [],
          );
          const houseActuals = await getActualForCharges(houseCharges);

          const actualCostMaster = masterActuals.ActualCost;
          const actualRevenueMaster = masterActuals.ActualRevenue;
          const actualCostHouse = houseActuals.ActualCost;
          const actualRevenueHouse = houseActuals.ActualRevenue;

          const actualCost = actualCostMaster + actualCostHouse;
          const actualRevenue = actualRevenueMaster + actualRevenueHouse;
          const actualbaseAmt = Math.max(actualRevenue, actualCost);
          const actualGp = actualRevenue - actualCost;
          const profit = (Number(actualGp) * 100) / Number(actualbaseAmt);
          const provbaseAmt = Math.max(totalRevenueWithHouse, totalCostWithHouse);
          const proveprofit =
            (Number(GP) * 100) / Number(provbaseAmt);
          let totalMaxVolumeFromJobContainers = 0;
          job.containers.forEach((container) => {
            if (container.containerType) {
              const maxVol = Number(container.containerType.MaxVolume ?? 0);
              totalMaxVolumeFromJobContainers += maxVol;
            }
          });
          const maxVolume = totalMaxVolumeFromJobContainers;
          const jobVolume = Number(job?.Volume ?? 0);
          const space = maxVolume - jobVolume;
          return {
            jobNumber: job.MasterJobNumber,
            Mbl: job.MBLNo,
            POL: job.POL,
            POD: job.POD,
            dept: departments.find(d=>d.DepartmentMasterSid === job.DepartmentMasterSid)?.departmentName,
            chargeable: job?.ChargeableWeight,
            Vol: job?.Volume,
            noOfShipment: job.houseJob?.length,
            GP,
            actualRevenue,
            actualCost,
            profit,
            proveprofit,
            actualGp,
            containerNo: job.houseJob
              ?.flatMap((hj) => hj.Products.map((p) => p.ContainerNo))
              .join(', '),
            twentyft: numberOfTwentyFt,
            fourty: numberOfFourtyFt,
            fourtyfive: numberofFurtyFive,
            totalCost,
            totalRevenue,
            totalCostWithHouse,
            totalRevenueWithHouse,
            houseCount: houseJobs.length || 0,
            houseJobs: houseJobsData,
            space,
          };
        }),
      );

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchInvolved,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
      };
    } catch (error) {
      this.logger.error(
        `Error generating profitability report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateLostCustomerReport(params: lostCustomerReportQueryDto) {
    try {
      const {
        companyId,
        Customer: customer,
        Branch: branchId,
        Dept: department,
        BookingFromDate: FromDate,
        BookingToDate: ToDate,
        Salesman: salesman,
      } = params;

      /* -------------------- CUSTOMER IDS -------------------- */
      let allCustomerIds: number[] = [];

      if (Array.isArray(customer) && customer.length > 0) {
        const validCustomers = await this._db.customerMaster.findMany({
          where: {
            CustomerMasterSid: { in: customer },
            createdOn: { lt: FromDate },
            status: 'A',
          },
        });
        if (!validCustomers) {
          throw new BadRequestException('No customer found');
        }
        allCustomerIds = validCustomers.map((cus) => cus.CustomerMasterSid);
      } else if (typeof customer === 'number') {
        const validCustomer = await this._db.customerMaster.findUnique({
          where: {
            CustomerMasterSid: customer,
            createdOn: { lt: FromDate },
            status: 'A',
          },
        });
        if (!validCustomer) {
          throw new BadRequestException('No customer found');
        }
        allCustomerIds.push(customer);
      } else {
        const customers = await this._db.customerMaster.findMany({
          where: {
            CompanyMasterSid: companyId,
            createdOn: { lt: FromDate },
            status: 'A',
          },
          select: {
            CustomerMasterSid: true,
          },
        });

        customers.forEach((c) => allCustomerIds.push(c.CustomerMasterSid));
      }
      let customerNames: string[] = [];

      if (allCustomerIds.length > 0) {
        const customerRecords = await this._db.customerMaster.findMany({
          where: {
            CompanyMasterSid: companyId,
            CustomerMasterSid: { in: allCustomerIds },
            status: 'A',
          },
          select: {
            CustomerName: true,
          },
        });

        customerNames = customerRecords.map((c) => c.CustomerName);
      }
      const customerInvolved =
        (Array.isArray(customer) && customer.length > 0) ||
        typeof customer === 'number'
          ? customerNames.join(', ')
          : 'All Customers';

      /* -------------------- BRANCH IDS -------------------- */
      const allBranchIds: number[] = [];

      if (Array.isArray(branchId) && branchId.length > 0) {
        allBranchIds.push(...branchId);
      } else if (typeof branchId === 'number') {
        allBranchIds.push(branchId);
      } else {
        const branches = await this._db.branchMaster.findMany({
          where: {
            CompanyMasterSid: companyId,
            status: 'A',
          },
          select: {
            BranchMasterSid: true,
          },
        });

        branches.forEach((b) => allBranchIds.push(b.BranchMasterSid));
      }
      let branchNames: string[] = [];

      if (allBranchIds.length > 0) {
        const branchRecords = await this._db.branchMaster.findMany({
          where: {
            CompanyMasterSid: companyId,
            status: 'A',
            BranchMasterSid: { in: allBranchIds },
          },
          select: {
            branchName: true,
          },
        });

        branchNames = branchRecords.map((b) => b.branchName);
      }

      const branchInvolved =
        (Array.isArray(branchId) && branchId.length > 0) ||
        typeof branchId === 'number'
          ? branchNames.join(', ')
          : 'All Branches';

      /* -------------------- DEPARTMENT IDS -------------------- */

      const allDepartmentIds: number[] = [];

      if (Array.isArray(department) && department.length > 0) {
        allDepartmentIds.push(...department);
      } else if (typeof department === 'number') {
        allDepartmentIds.push(department);
      } else {
        const departments = await this._db.departmentMaster.findMany({
          where: {
            CompanyMasterSid: companyId,
            Status: 'A',
          },
          select: {
            DepartmentMasterSid: true,
          },
        });

        departments.forEach((d) =>
          allDepartmentIds.push(d.DepartmentMasterSid),
        );
      }

      let departmentNames: string[] = [];

      if (allDepartmentIds.length > 0) {
        const departmentRecords = await this._db.departmentMaster.findMany({
          where: {
            CompanyMasterSid: companyId,
            Status: 'A',
            DepartmentMasterSid: { in: allDepartmentIds },
          },
          select: {
            departmentName: true,
          },
        });

        departmentNames = departmentRecords.map((d) => d.departmentName);
      }

      const departmentInvolved =
        (Array.isArray(department) && department.length > 0) ||
        typeof department === 'number'
          ? departmentNames.join(', ')
          : 'All Departments';

      const allSalesmanIds: number[] = [];

      if (Array.isArray(salesman) && salesman.length > 0) {
        allSalesmanIds.push(...salesman);
      } else if (typeof salesman === 'number') {
        allSalesmanIds.push(salesman);
      } else {
        const salesmen = await this._db.userMaster.findMany({
          where: {
            status: 'A',
          },
          select: {
            UserMasterSid: true,
          },
        });

        salesmen.forEach((s) => allSalesmanIds.push(s.UserMasterSid));
      }

      let salesmanNames: string[] = [];

      if (allSalesmanIds.length > 0) {
        const salesmanRecords = await this._db.userMaster.findMany({
          where: {
            status: 'A',
            UserMasterSid: { in: allSalesmanIds },
          },
          select: {
            userName: true,
          },
        });

        salesmanNames = salesmanRecords.map((s) => s.userName);
      }

      const salesmanInvolved =
        (Array.isArray(salesman) && salesman.length > 0) ||
        typeof salesman === 'number'
          ? salesmanNames.join(', ')
          : 'All Salesmen';

      /* -------------------- GUARD EMPTY ARRAYS -------------------- */
      if (
        !allCustomerIds.length ||
        !allBranchIds.length ||
        !allDepartmentIds.length ||
        !allSalesmanIds.length
      ) {
        return {
          status: true,
          data: [],
          companyId,
          branchId,
        };
      }

      /* -------------------- BASE WHERE CLAUSE -------------------- */
      const baseWhereClause: Prisma.BookingHeaderWhereInput = {
        CompanyMasterSid: companyId,
        BranchMasterSid: { in: allBranchIds },
        CustomerMasterSid: { in: allCustomerIds },
        DepartmentMasterSid: { in: allDepartmentIds },
        SalesmanSid: { in: allSalesmanIds },
        AND: [
          { BookingDateTime: { gte: FromDate } },
          { BookingDateTime: { lte: ToDate } },
        ],
        status: 'A',
      };

      /* -------------------- CUSTOMERS WHO BOOKED -------------------- */
      const customerBookingCount = await this._db.bookingHeader.groupBy({
        by: ['CustomerMasterSid'],
        where: baseWhereClause,
        _count: { _all: true },
      });

      /* -------------------- LOST CUSTOMERS -------------------- */
      const customerHavingBookings = customerBookingCount
        .map((lc) => lc.CustomerMasterSid)
        .filter(Boolean);

      // console.log("ALL CUSTOMER IDS",allCustomerIds);
      // console.log("Customer vs Booking count",customerBookingCount);
      // console.log("CUSTOMER HAVING BOOKING",customerHavingBookings);
      const finalLostCustomers = allCustomerIds.filter(
        (cus) => !customerHavingBookings.includes(cus),
      );
      // console.log("LOST CUSTOMER IDS",finalLostCustomers);

      /* -------------------- LAST BOOKING + RATES -------------------- */
      const getLastBookingOfCustomer = async (CustomerMasterSid: number) => {
        const lastBooking = await this._db.bookingHeader.findFirst({
          where: {
            CompanyMasterSid: companyId,
            BranchMasterSid: { in: allBranchIds },
            DepartmentMasterSid: { in: allDepartmentIds },
            SalesmanSid: { in: allSalesmanIds },
            CustomerMasterSid,
            status: 'A',
          },
          orderBy: {
            BookingDateTime: 'desc',
          },
          select: {
            BookingHeaderSid: true,
            BookingNo: true,
            BookingDateTime: true,
            CustomerName: true,
            CustomerAddress: true,
            createdOn: true,
            customerBranch: {
              select: {
                ContactNo: true,
              },
            },
            SalesmanSid: true,
          },
        });

        if (!lastBooking) return null;

        /* -------- BOOKING RATES -------- */
        const bookingRates = await this._db.bookingRates.aggregate({
          where: {
            BookingHeaderSid: lastBooking.BookingHeaderSid,
          },
          _sum: {
            RevenueLocalAmount: true,
            CostLocalAmount: true,
          },
        });

        const revenue = bookingRates._sum.RevenueLocalAmount ?? 0;
        const cost = bookingRates._sum.CostLocalAmount ?? 0;
        let days = 0;

        if (lastBooking.BookingDateTime && ToDate) {
          days = Math.floor(
            (new Date(ToDate).getTime() -
              lastBooking.BookingDateTime.getTime()) /
              (1000 * 60 * 60 * 24),
          );
        }

        return {
          BookingHeaderSid: lastBooking.BookingHeaderSid,
          BookingNo: lastBooking.BookingNo,
          BookingDateTime: lastBooking.BookingDateTime,
          createdOn: lastBooking.createdOn,
          CustomerMasterSid,
          CustomerName: lastBooking.CustomerName,
          CustomerAddress: lastBooking.CustomerAddress,
          ContactNo: lastBooking.customerBranch?.ContactNo || '',
          SalesmanName:
            (await this.getSalespersonName(
              companyId,
              lastBooking.SalesmanSid,
            )) || '',
          RevenueLocalAmount: revenue,
          CostLocalAmount: cost,
          GP: Number(revenue) - Number(cost),
          days,
        };
      };

      /* -------------------- FINAL RESULT -------------------- */
      const data = (
        await Promise.all(finalLostCustomers.map(getLastBookingOfCustomer))
      ).filter(Boolean);

      return {
        status: true,
        data,
        companyId,
        branchId,
        params,
        branchInvolved,
        departmentInvolved,
        customerInvolved,
        salesmanInvolved,
      };
    } catch (error) {
      console.error('Lost Customer Report Error:', error);
      throw error;
    }
  }

  private async generateContainerwiseDetailsReport(
    params: ContainerKPIReportQueryDto,
  ) {
    // TODO: Implement Containerwise Master Details with Cost/Revenue logic
    this.logger.log(
      'generateContainerwiseDetailsReport called with params:',
      params,
    );
    throw new BadRequestException(
      'Containerwise Details Report generator not yet implemented',
    );
  }

  private async generateContainerKPIReport(params: any) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      this.logger.log(
        `Getting Container_Wise_KPI report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      // charge master
      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeGroup: true },
      });

      const chargeGroupMap = new Map<number, any>();

      chargeMaster.forEach((cm) => {
        chargeGroupMap.set(cm.ChargeMasterSid, cm.chargeGroup);
      });

      // port master - get port names and codes for matching
      const portMaster = await this._db.portMaster.findMany({
        select: {
          PortMasterSid: true,
          PortName: true,
          PortCode: true,
          CountryMasterSid: true,
        },
      });

      const portNameToCountryMap = new Map<string, number>();
      const portCodeToCountryMap = new Map<string, number>();

      portMaster.forEach((port) => {
        if (port.PortName && port.CountryMasterSid != null) {
          portNameToCountryMap.set(
            port.PortName.toUpperCase().trim(),
            port.CountryMasterSid,
          );
        }
        if (port.PortCode && port.CountryMasterSid != null) {
          portCodeToCountryMap.set(
            port.PortCode.toUpperCase().trim(),
            port.CountryMasterSid,
          );
        }
      });

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: {
          ContainerTypeMasterSid: true,
          ContainerSize: true,
          ContainerName: true,
        },
      });

      // Map ID → Name for fast lookup
      const containerTypeMap = new Map<
        number,
        { name: string; size: string }
      >();

      containerTypesMaster.forEach((c) => {
        containerTypeMap.set(c.ContainerTypeMasterSid, {
          name: c.ContainerSize || '',
          size: c.ContainerName || '',
        });
      });

      // country Master
      const countryMaster = await this._db.countryMaster.findMany({
        select: { CountryMasterSid: true, countryName: true },
      });

      // Create map for CountryMasterSid -> countryName
      const countryIdToNameMap = new Map<number, string>();
      countryMaster.forEach((country) => {
        if (country.CountryMasterSid != null && country.countryName != null) {
          countryIdToNameMap.set(country.CountryMasterSid, country.countryName);
        }
      });

      const houseData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,

          AND: [{ HBLDate: { gte: FromHblDt } }, { HBLDate: { lte: ToHblDt } }],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          masterJob: {
            where: {
              Status: 'A',
            },
            select: {
              MBLNo: true,
              voyages: true,
              containers: true,
            },
          },
          bookingHeader: {
            where: {
              status: 'A',
            },
            select: {
              BookingDateTime: true,
              BookingNo: true,
            },
          },
          Products: {
            where: {
              status: 'A',
            },
            select: {
              ContainerNo: true,
              MasterJobContainerSid: true,
              Volume: true,
              GrossWeight: true,
              IsHaz: true,
              masterJobContainer: {
                select: {
                  containerType: {
                    select: {
                      ContainerSize: true,
                      ContainerName: true,
                    },
                  },
                },
              },
            },
          },
          Cargo: true,
          Others: true,
          departmentMaster: {
            select: {
              departmentName: true,
            },
          },
        },
        orderBy: { HBLDate: 'asc' },
      });

      const profitabilityMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
            { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'Service Job', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
            {
              MenuName: { contains: 'AgentMaster Air Way', mode: 'insensitive' },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allMasterMenuSids = profitabilityMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'master job' || menuName.includes('master air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      const allHouseMenuSids = profitabilityMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'house job' ||
            menuName === 'service job' ||
            menuName.includes('house air way') ||
            menuName.includes('agent master air way') ||
            menuName.includes('agentmaster air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      if (!allHouseMenuSids.length || !allMasterMenuSids.length) {
        throw new BadRequestException('Required menus not found');
      }

      const houseJobIds = houseData.map((h) => h.HouseJobSid);

      const houseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: { in: allHouseMenuSids },
          TransactionSid: { in: houseJobIds },
          status: 'A',
        },
      });

      const houseRateMap: Map<number, any[]> = new Map();

      houseCR.forEach((cr) => {
        const key = cr.TransactionSid!;
        if (!houseRateMap.has(key)) {
          houseRateMap.set(key, []);
        }
        houseRateMap.get(key)!.push(cr);
      });

      if (houseData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      const data = houseData.map((data) => {
        const costRevenueCharges = houseRateMap.get(data.HouseJobSid) || [];

        const freightRevenue = costRevenueCharges
          .filter(
            (cr) =>
              cr.RevenueLocalAmount &&
              chargeGroupMap.get(cr.ChargeMasterSid)?.GroupName === 'Freight',
          )
          .reduce((sum, cr) => sum + Number(cr.RevenueLocalAmount), 0);

        const product = data.Products;
        const containerSid = product?.map((pr) => pr.MasterJobContainerSid);
        const containerInfo = [
          ...new Set(
            (product || [])
              .map(pr => pr.masterJobContainer?.containerType?.ContainerName)
              .filter(Boolean)
          )
        ].join(', ');
        const totalVolume = (data.Products || []).reduce(
          (sum, p) => sum + toNumber(p.Volume),
          0,
        );
        const totalGrossWeight = (data.Products || []).reduce(
          (sum, p) => sum + toNumber(p.GrossWeight),
          0,
        );
        const isHaz = (data.Products || []).some((p) => p.IsHaz === 'Y');

        // const masterContainerSid = product?.MasterJobContainerSid;
        // const masterContainerSid = data.masterJob?.containers?.[0]?.MasterJobContainerSid;

        // const containerInfo = (data.masterJob?.containers || [])
        //   .filter(c => c.MasterJobContainerSid === masterContainerSid)
        //   .map(c => {
        //     const containerTypeId = c.ContainerType;
        //     const typeInfo = containerTypeId != null
        //       ? containerTypeMap.get(containerTypeId)
        //       : null;

        //     return {
        //       containerNumber: c.ContainerNumber,
        //       containerName: typeInfo?.name || `Unknown(${containerTypeId})`,
        //       containerSize: typeInfo?.size || '',
        //     };
        //   });

        // Alternative: Use the map you created earlier
        // let containerName = '';
        // if (product?.MasterJobContainerSid != null) {
        //   containerName = containerTypeMap.get(product.MasterJobContainerSid) || '';
        // }

        let countryMasterSid: number | null = null;
        let countryName: string | null = null;
        const fpd = data?.FPD;
        if (fpd) {
          const fpdUpper = fpd.toUpperCase().trim();

          countryMasterSid = portCodeToCountryMap.get(fpdUpper) || null;

          if (!countryMasterSid) {
            countryMasterSid = portNameToCountryMap.get(fpdUpper) || null;

            if (!countryMasterSid) {
              const cleanedFpd = fpdUpper.replace(/\s+/g, ' ').trim();
              countryMasterSid =
                portNameToCountryMap.get(cleanedFpd) ||
                portCodeToCountryMap.get(cleanedFpd) ||
                null;
            }
          }

          if (countryMasterSid !== null) {
            countryName = countryIdToNameMap.get(countryMasterSid) || null;
          }
        }

        return {
          bookingNo: data?.bookingHeader?.BookingNo,
          vesselName: data?.VesselName,
          voyageNo : data?.VoyageNo,
          MBL: data?.masterJob?.MBLNo,
          HBL: data?.HBLNo,
          shipmentType: data?.Cargo?.[0]?.ShipmentTerms,
          consigneeName: data?.ConsigneeName,
          fnalDestination: fpd,
          postofOrigin:data?.POO,
          countryMasterSid,
          countryName,
          portofDischarge: data?.POD,
          ETA: data?.ETA,
          ETD: data?.ETD,
          freightTerms: data?.FreightTerms,
          bookingDate: data?.bookingHeader?.BookingDateTime,
          containerNo: [...new Set(data?.Products.map(c => c.ContainerNo))].join(', '),
          containerInfo,
          containerSid: containerSid,
          vol: totalVolume,
          weight: totalGrossWeight,
          costRevenueCharges,
          freightRevenue,
          dgDelaration: isHaz,
          ATDPOL: data?.masterJob?.voyages?.[0]?.ATD,
          ATA: data?.masterJob?.voyages?.[0]?.ATA,
          dgAprrovelDate: data?.Others?.[0]?.DGConfirmationDate,
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchInvolved,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
      };
    } catch (error) {
      this.logger.error(
        `Error generating shipment summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateDOIssueList(params: DOIssueListReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      this.logger.log(
        `Getting BL_Issue report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: {
                DepartmentMasterSid: true,
                departmentName: true,
              },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                DepartmentMasterSid: true,
                departmentName: true,
              },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);
      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          AND: [{ HBLDate: { gte: FromHblDt } }, { HBLDate: { lte: ToHblDt } }],
          status: 'A',
        },
        include: {
          masterJob: {
            where: { Status: 'A' },
            select: { MBLNo: true },
          },
          Others: true,
          departmentMaster: {
            select: { departmentName: true },
          },
          bookingHeader: {
            where: {
              status: 'A',
            },
            select: {
              BookingNo: true,
            },
          },
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (houseJobData.length === 0) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchNames: resolvedBranchNames.join(', '),
          departmentNames: resolvedDeptNames.join(', '),
          data: [],
          params,
        };
      }

      const data = houseJobData
        .filter((hj) => hj.Others?.[0]?.DONo)
        .map((hj) => ({
          HBLDate: hj.HBLDate,
          HBLNo: hj.HBLNo,
          MBLNo: hj.masterJob?.MBLNo || null,
          BookingNo: hj.bookingHeader?.BookingNo,
          Shipper: hj.ShipperName,
          Consignee: hj.ConsigneeName,
          POL: hj.POL,
          POD: hj.POD,
          departmentName: hj.departmentMaster?.departmentName || null,
          jobStatus: hj.HouseStatus,
        }));
      return {
        companyMasterSid: CompanyMasterSid,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        branchInvolved,
        data,
        params,
      };
    } catch (error) {
      this.logger.error(
        `Error generating DO Issue List: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateShipmentDetailedSummary(
    params: ShipmentDetailedSummaryReportQueryDto,
  ) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
      Transhipment = false,
      Customer,
      Salesperson: SalePerson,
    } = params;

    try {
      this.logger.log(
        `Getting shipment summary details report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: {
                DepartmentMasterSid: true,
                departmentName: true,
              },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                DepartmentMasterSid: true,
                departmentName: true,
              },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true },
      });

      // Map ID → Name for fast lookup
      const containerTypeMap = new Map(
        containerTypesMaster.map((ct) => [
          ct.ContainerTypeMasterSid,
          ct.ContainerSize,
        ]),
      );

      const customerMaster = await this._db.customerMaster.findMany({
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
          CustomerType: true,
        },
      });
      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customerMap = new Map<number, string>(
        customerMaster.map((c) => [c.CustomerMasterSid, c.CustomerName]),
      );

      const selectedCustomerNames = Customer?.length
        ? Customer.map((id) => customerMap.get(id))
            .filter((name): name is string => !!name)
            .join(', ')
        : 'All Customer';

      const countryMaster = await this._db.countryMaster.findMany({
        select: {
          CountryMasterSid: true,
          countryName: true,
          countryCode: true,
        },
      });

      const userMaster = await this._db.userMaster.findMany({
        select: { UserMasterSid: true, userName: true },
      });

      const salespersonMap = new Map<number, string>(
        userMaster.map((u) => [u.UserMasterSid, u.userName]),
      );

      const selectedSalespersonNames = SalePerson?.length
        ? SalePerson.map((id) => salespersonMap.get(id))
            .filter((name): name is string => !!name)
            .join(', ')
        : 'All Salesperson';

      const isTranshipment: boolean = Transhipment === true;

      const whereClause: any = {
        CompanyMasterSid,
        AND: [{ HBLDate: { gte: FromHblDt } }, { HBLDate: { lte: ToHblDt } }],
        status: 'A',
        BranchMasterSid: { in: resolvedBranchIds },
        DepartmentMasterSid: { in: resolvedDeptIds },
      };

      if (SalePerson && SalePerson.length > 0) {
        whereClause.SalesmanSid = { in: SalePerson };
      }

      if (Customer && Customer.length > 0) {
        whereClause.CustomerMasterSid = { in: Customer };
      }

      if (isTranshipment) {
        whereClause.JobType = 'Transhipment';
      }

      const houseJobData = await this._db.houseJob.findMany({
        // where: {
        //   CompanyMasterSid,
        //   BranchMasterSid: { in: branchId },
        //   AND: [
        //     { HBLDate: { gte: new Date(FromHblDt) } },
        //     { HBLDate: { lte: new Date(ToHblDt) } }
        //   ],
        //   status: 'A',
        //   DepartmentMasterSid: { in: dept },

        // },
        where: whereClause,
        include: {
          Cargo: true,
          Others: true,
          Products: true,
          bookingHeader: {
            where: {
              status: 'A',
            },
            select: {
              BookingDateTime: true,
            },
          },
          masterJob: {
            where: {
              Status: 'A',
            },
            select: {
              Volume: true,
              GrossWeight: true,
              ChargeableWeight: true,
              NetWeight: true,
              voyages: true,
              others: true,
              MasterJobNumber: true,
              JobStatus: true,
              CreatedBy: true,
              MBLNo: true,
              containers: {
                where: { Status: 'A' },
                include: {
                  containerType: {
                    select: {
                      ContainerName: true,
                      ContainerSize: true,
                      NoOfTeu: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (houseJobData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: {
          MenuName: { equals: 'House Job', mode: 'insensitive' },
          status: 'A',
        },
        select: { MenuMasterSid: true },
      });

      if (!houseJobMenu) {
        throw new BadRequestException('House Job not found in MenuMaster');
      }

      const houseJobIds = houseJobData.map((h) => h.HouseJobSid);
      const allHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: houseJobMenu.MenuMasterSid,
          TransactionSid: { in: houseJobIds },
          status: 'A',
        },
      });

      const houseRateMap = new Map<number, any[]>();
      allHouseCR.forEach((cr) => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      const portCodes = new Set<string>();

      houseJobData.forEach((mj) => {
        if (mj.POL) portCodes.add(mj.POL);
        if (mj.POD) portCodes.add(mj.POD);
        if (mj.FPD) portCodes.add(mj.FPD);
        if (mj.POO) portCodes.add(mj.POO);
      });

      // Fetch port details
      const ports = await this._db.portMaster.findMany({
        where: {
          PortCode: { in: Array.from(portCodes) },
        },
        select: {
          PortCode: true,
          PortName: true,
          CountryMasterSid: true,
        },
      });

      const portCountryMap = new Map<string, number>();
      ports.forEach((p) => {
        if (p.PortCode && p.CountryMasterSid) {
          portCountryMap.set(p.PortCode, p.CountryMasterSid);
        }
      });

      const countryMap = new Map(
        countryMaster.map((c) => [
          c.CountryMasterSid,
          { countryName: c.countryName, countryCode: c.countryCode },
        ]),
      );

      // Create a map of port code to port name
      const portMap = new Map(
        ports.map((port) => [port.PortCode, port.PortName]),
      );

      const containerSize = [
        "20'F",
        "40'F",
        "45'HC",
        "20'Refer",
        "40'Refer",
        "45' HC Refer",
        "20'Open Top ",
        "40' Open Top",
        "45' HC Open Top",
      ];

      // Map the master job data
      const data = houseJobData.map((mj) => {
        // Determine the type based on destinationPort (or any other field)
        const type = mj.DestinationAgent ? 'Agent' : null;

        // Sum volumes for local shipment (Import + Export)
        const localShipmentVol =
          houseJobData?.reduce((sum, job) => {
            if (job.JobType === 'Import' || job.JobType === 'Export') {
              return (
                sum +
                (job.Cargo?.reduce(
                  (cSum, cargo) => cSum + Number(cargo.Volume || 0),
                  0,
                ) || 0)
              );
            }
            return sum;
          }, 0) || 0;

        // Sum volumes for transhipment shipment
        const transhipmentVol =
          houseJobData?.reduce((sum, job) => {
            if (job.JobType === 'Transhipment') {
              return (
                sum +
                (job.Cargo?.reduce(
                  (cSum, cargo) => cSum + Number(cargo.Volume || 0),
                  0,
                ) || 0)
              );
            }
            return sum;
          }, 0) || 0;

        const masterContainerSid =
          mj.masterJob?.containers?.[0]?.MasterJobContainerSid;

        const containerInfo = (mj.masterJob?.containers || [])
          .filter((c) => c.MasterJobContainerSid === masterContainerSid)
          .map((c) => {
            const containerTypeId = c.ContainerType;
            return {
              containerNumber: c.ContainerNumber,
              containerType:
                containerTypeId != null
                  ? containerTypeMap.get(containerTypeId) ||
                    `Unknown(${containerTypeId})`
                  : '',
            };
          });

        const houseProducts = mj.Products;
        const allContainers = mj.masterJob?.containers || [];
        let totalNoOfTEU = 0;

        let numberOfTwentyFt = 0;
        let numberOfFourtyFt = 0;
        let numberofFurtyFiveFt = 0;

        let numberOfTwentyRefer = 0;
        let numberOfFourtyRefer = 0;
        let numberOfFourtyFiveRefer = 0;

        let numberofTwentyOpen = 0;
        let numberofFourtyOpen = 0;
        let numberofFourtyFiveOpen = 0;

        let containerMap = new Map<
          number,
          {
            ContainerNumber: string;
            ContainerName: string;
            ContainerSize: number;
            NoOfTeu: number;
          }
        >();

        const getContainerSize = (size: string) => {
          if (size.includes('20')) return 20;
          if (size.includes('40')) return 40;
          if (size.includes('45')) return 45;
          return 0;
        };

        houseProducts.forEach((hp) => {
          const ourMJContainer = allContainers.find(
            (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
          );

          const ourContainerType = ourMJContainer?.containerType;

          if (ourContainerType && ourMJContainer?.MasterJobContainerSid) {
            const alreadyExists = containerMap.has(
              ourMJContainer.MasterJobContainerSid,
            );

            if (!alreadyExists) {
              containerMap.set(ourMJContainer.MasterJobContainerSid, {
                ContainerNumber: ourMJContainer.ContainerNumber,
                ContainerName: ourContainerType.ContainerName,
                ContainerSize: getContainerSize(
                  ourContainerType.ContainerSize || '',
                ),
                NoOfTeu: toNumber(ourContainerType.NoOfTeu),
              });

              containerInfo.push({
                containerNumber: hp?.ContainerNo ?? '',
                containerType: ourContainerType?.ContainerSize ?? '',
              });
            }
          }
        });

        const containerUniqueInfo = Array.from(containerMap.values());
        containerUniqueInfo.forEach((cont) => {
          totalNoOfTEU += cont.NoOfTeu;

          const size = cont.ContainerName ?? '';

          if (cont.ContainerSize === 20 && size === '20ft Standard')
            numberOfTwentyFt++;
          if (cont.ContainerSize === 40 && size === '40ft Container')
            numberOfFourtyFt++;
          if (cont.ContainerSize === 45) numberofFurtyFiveFt++;
          if (size === '20ft Flat Rack' || size === '20ft Reefer')
            numberOfTwentyRefer++;
          if (size === '40RF' || size === '40 Flat Rack') numberOfFourtyRefer++;
          if (cont.ContainerSize === 45 && size === '40 Flat Rack')
            numberOfFourtyFiveRefer++;
          if (size === '20ft Open Top') numberofTwentyOpen++;
          if (size === '40Ft Open Top') numberofFourtyOpen++;
          if (size === '45Ft Open Top') numberofFourtyFiveOpen++;
        });

        const polName = mj.POL ? portMap.get(mj.POL) || '' : '';
        const podName = mj.POD ? portMap.get(mj.POD) || '' : '';
        const fpdName = mj.FPD ? portMap.get(mj.FPD) || '' : '';
        const pooName = mj.POO ? portMap.get(mj.POO) || '' : '';

        const pooCountrySid = mj.POO ? portCountryMap.get(mj.POO) : undefined;
        const pooCountry = pooCountrySid
          ? countryMap.get(pooCountrySid)
          : undefined;

        const polCountrySid = mj.POL ? portCountryMap.get(mj.POL) : undefined;
        const polCountry = polCountrySid
          ? countryMap.get(polCountrySid)
          : undefined;

        // --- POD Country ---
        const podCountrySid = mj.POD ? portCountryMap.get(mj.POD) : undefined;
        const podCountry = podCountrySid
          ? countryMap.get(podCountrySid)
          : undefined;

        // FDC Conutry
        const fdcCountrySid = mj.FPD ? portCountryMap.get(mj.FPD) : undefined;
        const fdcCountry = fdcCountrySid
          ? countryMap.get(fdcCountrySid)
          : undefined;

        const houseDepartment =
          departments.find(
            (d) => d.DepartmentMasterSid === mj.DepartmentMasterSid,
          )?.departmentName || '';
        const masterJob = Array.isArray(mj.masterJob)
          ? mj.masterJob[0]
          : mj.masterJob;

        const importJobNo = houseDepartment?.toLowerCase().includes('import')
          ? masterJob?.MasterJobNumber || ''
          : '';

        const exportJobNo = houseDepartment?.toLowerCase().includes('export')
          ? masterJob?.MasterJobNumber || ''
          : '';
        const costRevenues = (houseRateMap.get(mj.HouseJobSid) || []).filter(
          (cr) =>
            cr.CostVoucherHeaderSid === null ||
            cr.RevenueVoucherHeaderSid === null,
        );

        return {
          MBL: mj.masterJob?.MBLNo,
          shipmentNo: mj.ShipmentNo,
          bookingDate: mj.bookingHeader?.BookingDateTime,
          masterDate: mj.MBLDate,
          houseDepartment,
          HBL: mj.HBLNo,
          HBLDate: mj.HBLDate,
          importJobNo,
          exportJobNo,
          mblNo: mj.MBLNo || '',
          branchName:
            branches.find((b) => b.BranchMasterSid === mj.BranchMasterSid)
              ?.branchName || '',
          customerType: (() => {
            const typeObj =
              customerMaster.find(
                (c) => c.CustomerMasterSid === mj.CustomerMasterSid,
              )?.CustomerType || {};
            return Object.keys(typeObj).filter(
              (key) => typeObj[key] === 'isTrue',
            );
          })(),
          masterJobNo: mj.masterJob?.MasterJobNumber,
          vesselName: mj.VesselName,
          voyageNo: mj.VoyageNo || '',
          ETD: mj.ETD || '',
          ETA: mj.ETA || '',
          ATA: mj.masterJob?.voyages?.[0]?.ATA,
          ATD: mj.masterJob?.voyages?.[0]?.ATD,
          originPort: mj.POO || '',
          originPortName: pooName || '',
          POOCode: mj.POO,
          POOName: pooName || '',
          POLCode: mj.POL || '',
          POLName: polName,
          PODCode: mj.POD || '',
          PODName: podName,
          FPDCode: mj.FPD || '',
          FPDName: fpdName,
          POOCountryName: pooCountry?.countryName || '',
          POOCountryCode: pooCountry?.countryCode || '',
          POLCountryName: polCountry?.countryName || '',
          POLCountryCode: polCountry?.countryCode || '',
          PODCountryName: podCountry?.countryName || '',
          PODCountryCode: podCountry?.countryCode || '',
          FDCCounryName: fdcCountry?.countryName || '',
          FDCCountryCode: fdcCountry?.countryCode || '',
          // salesPerson:mj.SalesmanSid,
          salesPerson:
            userMaster.find((d) => d.UserMasterSid === mj.SalesmanSid)
              ?.userName || '',
          nominationBY: mj.NominatedBy,
          nominated: mj.Nominated,
          coLoader: mj.masterJob?.others?.[0]?.CoLoader,
          internalNote: mj.InternalNote,
          carrier: mj.CarrierName || '',
          originCarrier:
            customerMaster.find((c) => c.CustomerMasterSid === mj.CarrierSid)
              ?.CustomerName || '',
          pcs: mj.Cargo?.reduce(
          (sum, item) => sum + toNumber(item?.NoOfPackage),
          0
          ) || 0,
          houseStatus: mj.HouseStatus,
          serviceLevelName: mj.MovementType,
          blType: mj.Others?.[0]?.ReleaseType,
          paymentTerms: mj.FreightTerms,
          shipperNo: mj.Others?.[0]?.CustomerRefNo,
          masterStatus: mj.masterJob?.JobStatus,
          jobClosed: mj.HouseStatus,
          housecreatedBy: mj.createdBy,
          mastercreatedBy: mj.masterJob?.CreatedBy,
          addtionalRemarks: mj?.GeneralNote,
          volume: mj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.Volume),
            0
          ) || 0,
          grossWeight: mj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.GrossWeight),
            0
          ) || 0,
          chargeable: mj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.ChargeableWeight),
            0
          ) || 0,
          netWeight: mj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.NetWeight),
            0
          ) || 0,
          customer: mj.CustomerName,
          nofcontainer:
            numberOfTwentyFt +
            numberOfFourtyFt +
            numberofFurtyFiveFt +
            numberOfTwentyRefer +
            numberOfFourtyRefer +
            numberOfFourtyFiveRefer +
            numberofTwentyOpen +
            numberofFourtyOpen +
            numberofFourtyFiveOpen,
          noOfContainers:
            houseJobData.reduce(
              (sum, job) =>
                sum +
                (job.Cargo?.reduce(
                  (cSum, cargo) => cSum + (cargo.NoofContainers || 0),
                  0,
                ) || 0),
              0,
            ) || 0,
          shipper: mj.ShipperName || '',
          consignee: mj.ConsigneeName,
          originAgent: mj.AgentName,
          deliveryAgent:
            customerMaster.find(
              (d) => d.CustomerMasterSid === mj.DestinationAgent,
            )?.CustomerName || '',
          notify: mj.Notify,
          agent: mj.AgentName,
          incoTerms: mj.IncoTerms,
          PPCC: mj.FreightTerms,
         modeofTransport: mj.Cargo
          ?.map(c => c?.ModeOfTransport)
          ?.filter(Boolean)
          ?.join(', ') || '',
          jobType: mj.JobType,
          containerNoList: Array.from(containerMap.values())
            .map((c) => c.ContainerNumber)
            .filter(Boolean)
            .join(', '),
          mastercontainerSid:
            mj?.masterJob?.containers
              ?.map((c: any) => c.mastercontainerSid)
              .join(', ') || '',
          masterContanierSid:
            mj?.masterJob?.containers?.[0]?.MasterJobContainerSid,
          receivingAgent:
            customerMaster.find(
              (d) => d.CustomerMasterSid === mj.DestinationAgent,
            )?.CustomerName || '',
          containerInfo,
          totalNoOfTEU,
          numberOfTwentyFt,
          numberOfFourtyFt,
          numberofFurtyFiveFt,
          numberOfTwentyRefer,
          numberOfFourtyRefer,
          numberOfFourtyFiveRefer,
          numberofTwentyOpen,
          numberofFourtyOpen,
          numberofFourtyFiveOpen,
          status: mj.status,
          DoNo: mj.Others?.[0]?.DONo,
          DoDate: mj.Others?.[0]?.DODate,
          SOBDate: mj.masterJob?.others?.[0]?.SOBDate,
          shippingBillNo: mj.Products?.[0]?.ShippingBillNo,
          costRevenueDetails: costRevenues.map((cr) => ({
            Charge: chargeMaster.find(
              (c) => c.ChargeMasterSid === cr.ChargeMasterSid,
            )?.chargeName,
            CostAmt: Number(cr.CostAmount || 0),
            RevenueAmt: Number(cr.RevenueAmount || 0),
            CostLocalAmt: Number(cr.CostLocalAmount || 0),
            RevenueLocalAmt: Number(cr.RevenueLocalAmount || 0),
            CostDrCr: cr.CostDrCr,
            RevenueDrCr: cr.RevenueDrCr,
            CostVoucherHeaderSid: cr.CostVoucherHeaderSid,
            RevenueVoucherHeaderSid: cr.RevenueVoucherHeaderSid,
          })),
          localShipment:
            houseJobData?.filter(
              (job) => job.JobType === 'Import' || job.JobType === 'Export',
            ).length || 0,
          transhipmentShipment:
            houseJobData?.filter((job) => job.JobType === 'Transhipment')
              .length || 0,
          totalShipment:
            (houseJobData?.filter(
              (job) => job.JobType === 'Import' || job.JobType === 'Export',
            ).length || 0) +
            (houseJobData?.filter((job) => job.JobType === 'Transhipment')
              .length || 0),
          localShipmentVol,
          transhipmentVol,
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchInvolved,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        Transhipment,
        Customer: selectedCustomerNames,
        SalePerson: selectedSalespersonNames,
      };
    } catch (error) {
      this.logger.error(
        `Error generating shipment summary: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateUnbilledCostReport(params: unbilledcostReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToDt,
      FromDt,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      this.logger.log(
        `Getting UNBILLED House Job Cost/Revenue report for CompanySid=${CompanyMasterSid}, From=${FromDt}, To=${ToDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvoled =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true },
      });

      // master job
      const masterJobs = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          AND: [
            { MBLDate: { gte: new Date(FromDt) } },
            { MBLDate: { lte: new Date(ToDt) } },
          ],
          Status: 'A',
        },
        include: {
          houseJob: {
            where: {
              status: 'A',
            },
            select: {
              bookingHeader: {
                where: {
                  status: 'A',
                },
                select: {
                  BookingHeaderSid: true,
                  BookingDateTime: true,
                  BookingNo: true,
                  bookingRates: true,
                },
              },
              HouseJobSid: true,
              HouseNo: true,
              HBLNo: true,
              HouseStatus: true,
              FreightTerms: true,
            },
          },
        },
        orderBy: { MBLDate: 'asc' },
      });

      //  house data
      const houseJobs = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          AND: [
            { HBLDate: { gte: new Date(FromDt) } },
            { HBLDate: { lte: new Date(ToDt) } },
          ],
          status: 'A',
        },
        orderBy: { HBLDate: 'asc' },
        include: { masterJob: true },
      });

      if (!houseJobs.length) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchNames: resolvedBranchNames.join(', '),
          departmentNames: resolvedDeptNames.join(', '),
          data: [],
        };
      }

      const houseJobIds: number[] = [];
      houseJobs.forEach((h) => {
        if (h.HouseJobSid) {
          houseJobIds.push(h.HouseJobSid);
        }
      });

      const unbilledCostMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
            { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'Service Job', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allMasterMenuSids = unbilledCostMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'master job' || menuName.includes('master air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      const allHouseMenuSids = unbilledCostMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'house job' ||
            menuName === 'service job' ||
            menuName.includes('house air way') ||
            menuName.includes('agent master air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      if (!allHouseMenuSids.length || !allMasterMenuSids.length) {
        throw new BadRequestException('Required menus not found');
      }

      const allHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: { in: allHouseMenuSids },
          TransactionSid: { in: houseJobIds },
          status: 'A',
          OR: [{ CostVoucherHeaderSid: null }],
        },
      });

      const houseRateMap = new Map<number, any[]>();
      allHouseCR.forEach((cr) => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      // master cost and revenue part
      const masterJobIds: number[] = [];
      masterJobs.forEach((h) => {
        if (h.MasterJobSid) {
          masterJobIds.push(h.MasterJobSid);
        }
      });

      const allMasterCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: { in: allMasterMenuSids },
          TransactionSid: { in: masterJobIds },
          status: 'A',
          OR: [{ CostVoucherHeaderSid: null }],
        },
      });

      const masterRateMap = new Map<number, any[]>();
      allMasterCR.forEach((cr) => {
        if (!masterRateMap.has(cr.TransactionSid!)) {
          masterRateMap.set(cr.TransactionSid!, []);
        }
        masterRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      //  Booking data
      const allBookingCostWithUnbilledRates =
        await this._db.bookingHeader.findMany({
          where: {
            CompanyMasterSid: CompanyMasterSid,
            BranchMasterSid: { in: resolvedBranchIds },
            DepartmentMasterSid: { in: resolvedDeptIds },
            AND: [
              { BookingDateTime: { gte: new Date(FromDt) } },
              { BookingDateTime: { lte: new Date(ToDt) } },
            ],
            status: 'A',
          },
          include: {
            bookingRates: {
              where: {
                Status: 'A',
                CostVoucherHeaderSid: null,
              },
             },
             houseJob:{
              select:{
                masterJob:{
                  select:{
                    MBLNo:true
                  }
                }
              }
             }
            },
          orderBy: { BookingDateTime: 'asc' },
        });

      const menuNameById = new Map(
        unbilledCostMenus.map((m) => [m.MenuMasterSid, m.MenuName]),
      );
      const resolveScreenName = (
        menuSid: number | null | undefined,
        fallback: string,
      ) => (menuSid ? (menuNameById.get(menuSid) ?? fallback) : fallback);

      //  house job map function
      const housedata = houseJobs.map((house) => {
        const houseDepartment =
          departments.find(
            (d) => d.DepartmentMasterSid === house.DepartmentMasterSid,
          )?.departmentName || '';

        const costRevenues = (houseRateMap.get(house.HouseJobSid) || []).filter(
          (cr) => cr.CostVoucherHeaderSid === null,
        );

        return {
          HouseJobSid: house.HouseJobSid,
          HouseNo: house.HouseNo,
          HBLNo: house.HBLNo,
          MBLNo: house.masterJob?.MBLNo,
          houseScreen: resolveScreenName(house.MenuMasterSid, 'House Job'),
          masterScreen: resolveScreenName(
            house.masterJob?.MenuMasterSid,
            'Master Job',
          ),
          houseDept: houseDepartment,
          houseStatus: house.HouseStatus,
          bookingNo: house.BookingNo,
        
          branchName:
            branches.find((b) => b.BranchMasterSid === house.BranchMasterSid)
              ?.branchName || '',

          costRevenueDetails:
            costRevenues.length > 0
              ? costRevenues
                  .filter((cr) => cr.CostRevenueChargesSid)
                  .map((cr) => ({
                    CostRevenueChargesSid: cr.CostRevenueChargesSid,
                    ChargeMasterSid: cr.ChargeMasterSid,
                    chargeName:
                      chargeMaster.find(
                        (c) => c.ChargeMasterSid === cr.ChargeMasterSid,
                      )?.chargeName || '',
                    ChargeDescription: cr.ChargeDescription,
                    CostLocalAmount: cr.CostLocalAmount,
                    CostDrCr: cr.CostDrCr,
                    CostAmount: cr.CostAmount,
                    PPCC: cr.CostPrepaidCollect,
                    partyName:
                      customerMaster.find(
                        (c) => c.CustomerMasterSid === cr.CostAgentMasterSid,
                      )?.CustomerName || '',
                  }))
              : [],
        };
      });

      //  master job map function
      const masterdata = masterJobs.map((m) => {
        const masterDept =
          departments.find(
            (d) => d.DepartmentMasterSid === m.DepartmentMasterSid,
          )?.departmentName || '';

        const mastercostRevenues = (
          masterRateMap.get(m.MasterJobSid) || []
        ).filter((cr) => cr.CostVoucherHeaderSid === null);

        return {
          MasterJobSid: m.MasterJobSid,
          masterScreen: resolveScreenName(m.MenuMasterSid, 'Master Job'),
          masterDept: masterDept,
          MBLNo: m.MBLNo,
          branchName:
            branches.find((b) => b.BranchMasterSid === m.BranchMasterSid)
              ?.branchName || '',
          masterCrDetails:
            mastercostRevenues.length > 0
              ? mastercostRevenues
                  .filter((cr) => cr.CostRevenueChargesSid)
                  .map((cr) => ({
                    CostRevenueChargesSid: cr.CostRevenueChargesSid,
                    ChargeMasterSid: cr.ChargeMasterSid,
                    chargeName:
                      chargeMaster.find(
                        (c) => c.ChargeMasterSid === cr.ChargeMasterSid,
                      )?.chargeName || '',
                    ChargeDescription: cr.ChargeDescription,
                    CostLocalAmount: cr.CostLocalAmount,
                    CostDrCr: cr.CostDrCr,
                    CostAmount: cr.CostAmount,
                    PPCC: cr.CostPrepaidCollect,
                    partyName:
                      customerMaster.find(
                        (c) => c.CustomerMasterSid === cr.CostAgentMasterSid,
                      )?.CustomerName || '',
                  }))
              : [],
        };
      });

      const bookingRates = allBookingCostWithUnbilledRates
        .filter((b) => b.bookingRates && b.bookingRates.length > 0)
        .flatMap((b) => {
          const bookingDept =
            departments.find(
              (d) => d.DepartmentMasterSid === b.DepartmentMasterSid,
            )?.departmentName || '';

          return b.bookingRates.map((rate) => ({
            dept: bookingDept,
            bookingNo: b.BookingNo,
            HBLno: b.HBLNo,
            MBLno:b.houseJob?.masterJob?.MBLNo,
            FreightTerm: b.FreightTerms,

            branchName:
              branches.find((br) => br.BranchMasterSid === b.BranchMasterSid)
                ?.branchName || '',

            BookingRatesSid: rate.BookingRatesSid,
            ChargeMasterSid: rate.ChargeMasterSid,

            chargeName:
              chargeMaster.find(
                (c) => c.ChargeMasterSid === rate.ChargeMasterSid,
              )?.chargeName || '',

            ChargeDescription: rate.ChargeDescription,
            PPCC:rate.CostPrepaidCollect,
            CostLocalAmount: rate.CostLocalAmount,
            CostDrCr: rate.CostDrCr,
            CostAmount: rate.CostAmount,

            partyName:
              customerMaster.find(
                (c) => c.CustomerMasterSid === rate.AgentMasterSid,
              )?.CustomerName || '',
          }));
        });

      const fulldata = [...housedata, ...masterdata, ...bookingRates];

      return {
        companyMasterSid: CompanyMasterSid,
        departmentNames: resolvedDeptNames.join(', '),
        params,
        data: fulldata,
        branchInvoled,
      };
    } catch (error) {
      this.logger.error(
        `Error generating UNBILLED Cost report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateUnbilledRevenueReport(
    params: unbilledrevenueReportQueryDto,
  ) {
    const {
      companyId: CompanyMasterSid,
      ToDt,
      FromDt,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      this.logger.log(
        `Getting UNBILLED Revenue report for CompanySid=${CompanyMasterSid}, From=${FromDt}, To=${ToDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvoled =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true },
      });

      // master job
      const masterJobs = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          AND: [
            { MBLDate: { gte: new Date(FromDt) } },
            { MBLDate: { lte: new Date(ToDt) } },
          ],
          Status: 'A',
        },
        include: {
          houseJob: {
            where: {
              status: 'A',
            },
            select: {
              bookingHeader: {
                where: {
                  status: 'A',
                },
                select: {
                  BookingHeaderSid: true,
                  BookingDateTime: true,
                  BookingNo: true,
                  bookingRates: true,
                },
              },
              HouseJobSid: true,
              HouseNo: true,
              HBLNo: true,
              HouseStatus: true,
              FreightTerms: true,
            },
          },
        },
        orderBy: { MBLDate: 'asc' },
      });
      const houseJobs = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,

          AND: [
            { HBLDate: { gte: new Date(FromDt) } },
            { HBLDate: { lte: new Date(ToDt) } },
          ],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          masterJob: {
            where: {
              Status: 'A',
            },
          },
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (!houseJobs.length) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      const houseJobIds: number[] = [];
      houseJobs.forEach((h) => {
        if (h.HouseJobSid) {
          houseJobIds.push(h.HouseJobSid);
        }
      });

      const unbilledRevenueMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
            { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'Service Job', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allMasterMenuSids = unbilledRevenueMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'master job' || menuName.includes('master air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      const allHouseMenuSids = unbilledRevenueMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'house job' ||
            menuName === 'service job' ||
            menuName.includes('house air way') ||
            menuName.includes('agent master air way') 
          );
        })
        .map((m) => m.MenuMasterSid);

      if (!allHouseMenuSids.length || !allMasterMenuSids.length) {
        throw new BadRequestException('Required menus not found');
      }

      const allHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: { in: allHouseMenuSids },
          TransactionSid: { in: houseJobIds },
          status: 'A',
          OR: [{ RevenueVoucherHeaderSid: null }],
        },
      });

      const houseRateMap = new Map<number, any[]>();
      allHouseCR.forEach((cr) => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      // master cost and revenue part
      const masterJobIds: number[] = [];
      masterJobs.forEach((h) => {
        if (h.MasterJobSid) {
          masterJobIds.push(h.MasterJobSid);
        }
      });

      const allMasterCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: { in: allMasterMenuSids },
          TransactionSid: { in: masterJobIds },
          status: 'A',
          OR: [{ RevenueVoucherHeaderSid: null }],
        },
      });

      const masterRateMap = new Map<number, any[]>();
      allMasterCR.forEach((cr) => {
        if (!masterRateMap.has(cr.TransactionSid!)) {
          masterRateMap.set(cr.TransactionSid!, []);
        }
        masterRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      //  Booking data
      const allBookingCostWithUnbilledRates =
        await this._db.bookingHeader.findMany({
          where: {
            CompanyMasterSid: CompanyMasterSid,
            BranchMasterSid: { in: resolvedBranchIds },
            DepartmentMasterSid: { in: resolvedDeptIds },
            AND: [
              { BookingDateTime: { gte: new Date(FromDt) } },
              { BookingDateTime: { lte: new Date(ToDt) } },
            ],
            status: 'A',
          },
          include: {
            bookingRates: {
              where: {
                Status: 'A',
                RevenueVoucherHeaderSid: null,
              },
            },
            houseJob:{
              select:{
                masterJob:{
                  select:{
                    MBLNo:true
                  }
                }
              }
            }
          },
          orderBy: { BookingDateTime: 'asc' },
        });

      //  house job map function
      const housedata = houseJobs.map((house) => {
        const houseDepartment =
          departments.find(
            (d) => d.DepartmentMasterSid === house.DepartmentMasterSid,
          )?.departmentName || '';

        const costRevenues = (houseRateMap.get(house.HouseJobSid) || []).filter(
          (cr) => cr.CostVoucherHeaderSid === null,
        );

        return {
          HouseJobSid: house.HouseJobSid,
          HouseNo: house.HouseNo,
          HBLNo: house.HBLNo,
          MBLNo: house.masterJob?.MBLNo,
          houseDept: houseDepartment,
          houseStatus: house.HouseStatus,
          bookingNo: house.BookingNo,
          PPCC: house.FreightTerms,
          branchName:
            branches.find((b) => b.BranchMasterSid === house.BranchMasterSid)
              ?.branchName || '',

          costRevenueDetails:
            costRevenues.length > 0
              ? costRevenues
                  .filter((cr) => cr.CostRevenueChargesSid)
                  .map((cr) => ({
                    CostRevenueChargesSid: cr.CostRevenueChargesSid,
                    ChargeMasterSid: cr.ChargeMasterSid,
                    chargeName:
                      chargeMaster.find(
                        (c) => c.ChargeMasterSid === cr.ChargeMasterSid,
                      )?.chargeName || '',
                    ChargeDescription: cr.ChargeDescription,
                    RevenueLocalAmt: cr.RevenueLocalAmount,
                    RevenueDrCr: cr.RevenueDrCr,
                    RevenueAmount: cr.RevenueAmount,
                    PPCC:cr.RevenuePrepaidCollect,
                    partyName:
                      customerMaster.find(
                        (c) =>
                          c.CustomerMasterSid === cr.RevenueCustomerMasterSid,
                      )?.CustomerName || '',
                  }))
              : [],
        };
      });

      //  master job map function
      const masterdata = masterJobs.map((m) => {
        const masterDept =
          departments.find(
            (d) => d.DepartmentMasterSid === m.DepartmentMasterSid,
          )?.departmentName || '';

        const mastercostRevenues = (
          masterRateMap.get(m.MasterJobSid) || []
        ).filter((cr) => cr.CostVoucherHeaderSid === null);

        return {
          MasterJobSid: m.MasterJobSid,
          masterDept: masterDept,
          MBLNo: m.MBLNo,
          branchName:
            branches.find((b) => b.BranchMasterSid === m.BranchMasterSid)
              ?.branchName || '',
          masterCrDetails:
            mastercostRevenues.length > 0
              ? mastercostRevenues
                  .filter((cr) => cr.CostRevenueChargesSid)
                  .map((cr) => ({
                    CostRevenueChargesSid: cr.CostRevenueChargesSid,
                    ChargeMasterSid: cr.ChargeMasterSid,
                    chargeName:
                      chargeMaster.find(
                        (c) => c.ChargeMasterSid === cr.ChargeMasterSid,
                      )?.chargeName || '',
                    ChargeDescription: cr.ChargeDescription,
                    RevenueLocalAmt: cr.RevenueLocalAmount,
                    RevenueDrCr: cr.RevenueDrCr,
                    RevenueAmount: cr.RevenueAmount,
                    PPCC:cr.RevenuePrepaidCollect,
                    partyName:
                      customerMaster.find(
                        (c) =>
                          c.CustomerMasterSid === cr.RevenueCustomerMasterSid,
                      )?.CustomerName || '',
                  }))
              : [],
        };
      });

      const bookingRates = allBookingCostWithUnbilledRates
        .filter((b) => b.bookingRates && b.bookingRates.length > 0)
        .flatMap((b) => {
          const bookingDept =
            departments.find(
              (d) => d.DepartmentMasterSid === b.DepartmentMasterSid,
            )?.departmentName || '';

          return b.bookingRates.map((rate) => ({
            dept: bookingDept,
            bookingNo: b.BookingNo,
            HBLno: b.HBLNo,
            FreightTerm: b.FreightTerms,
            MBLno:b.houseJob?.masterJob?.MBLNo,
            branchName:
              branches.find((br) => br.BranchMasterSid === b.BranchMasterSid)
                ?.branchName || '',

            BookingRatesSid: rate.BookingRatesSid,
            ChargeMasterSid: rate.ChargeMasterSid,
            PPCC:rate.RevenuePrepaidCollect,
            chargeName:
              chargeMaster.find(
                (c) => c.ChargeMasterSid === rate.ChargeMasterSid,
              )?.chargeName || '',

            ChargeDescription: rate.ChargeDescription,

            RevenueLocalAmount: rate.RevenueLocalAmount,
            ReveuneDrCr: rate.RevenueDrCr,
            RevenueAmount: rate.RevenueAmount,

            partyName:
              customerMaster.find(
                (c) => c.CustomerMasterSid === rate.CustomerMasterSid,
              )?.CustomerName || '',
          }));
        });

      const fulldata = [...housedata, ...masterdata, ...bookingRates];
      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        data: fulldata,
        branchInvoled,
      };
    } catch (error) {
      this.logger.error(
        `Error generating UNBILLED house job report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateHouseJobLossReport(params: houseJobLossReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
      Customer,
    } = params;

    try {
      this.logger.log(
        `Getting House Job Loss Report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchInvoled =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: {
                DepartmentMasterSid: true,
                departmentName: true,
              },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                DepartmentMasterSid: true,
                departmentName: true,
              },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true },
      });

      const customerMap = new Map<number, string>(
        customerMaster.map((c) => [c.CustomerMasterSid, c.CustomerName]),
      );

      const selectedCustomerNames = Customer?.length
        ? Customer.map((id) => customerMap.get(id))
            .filter((name): name is string => !!name)
            .join(', ')
        : 'All Customers';

      const houseJobs = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [{ HBLDate: { gte: FromHblDt } }, { HBLDate: { lte: ToHblDt } }],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          ...(Customer && Customer.length > 0
            ? { CustomerMasterSid: { in: Customer } }
            : {}),
        },
        select: {
          HouseJobSid: true,
          HouseNo: true,
          HBLNo: true,
          MBLNo: true,
          CompanyMasterSid: true,
          BranchMasterSid: true,
          MasterJobSid: true,
          MenuMasterSid: true,
          HBLDate: true,
          DepartmentMasterSid: true,
          HouseStatus: true,
          JobType: true,
          CustomerMasterSid: true,
          VesselName: true,
          VoyageNo: true,
          OriginAgent: true,
          AgentName: true,
          DestinationAgent: true,
          masterJob: true,
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (!houseJobs.length) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      const houseJobIds = houseJobs.map((h) => h.HouseJobSid);

      const houseJobLossMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
            {
              MenuName: { contains: 'AgentMaster Air Way', mode: 'insensitive' },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allHouseMenuSids = Array.from(
        new Set([
          ...houseJobLossMenus.map((m) => m.MenuMasterSid),
          ...houseJobs
            .map((h) => h.MenuMasterSid)
            .filter((sid): sid is number => typeof sid === 'number'),
        ]),
      );

      if (!allHouseMenuSids.length) {
        throw new BadRequestException('House Job menu not found');
      }

      const directHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: { in: allHouseMenuSids },
          TransactionSid: { in: houseJobIds },
          status: 'A',
          OR: [
            { CostVoucherHeaderSid: null },
            { RevenueVoucherHeaderSid: null },
          ],
        },
        select: {
          TransactionSid: true,
          CostLocalAmount: true,
          RevenueLocalAmount: true,
        },
      });

      const masterJobIds = Array.from(
        new Set(
          houseJobs
            .map((house) => house.MasterJobSid)
            .filter((sid): sid is number => typeof sid === 'number'),
        ),
      );

      const jobToSubjobMasters = await this._db.masterJobOthers.findMany({
        where: {
          MasterJobSid: { in: masterJobIds },
          Status: 'A',
          JobtoSubjob: 'Y',
        },
        select: {
          MasterJobSid: true,
        },
      });

      const proratedHouseCR: Array<{
        TransactionSid: number;
        CostLocalAmount: number;
        RevenueLocalAmount: number;
      }> = [];

      for (const { MasterJobSid } of jobToSubjobMasters) {
        const anyHouse = houseJobs.find((house) => house.MasterJobSid === MasterJobSid);

        if (!anyHouse?.CompanyMasterSid || !anyHouse?.BranchMasterSid) {
          continue;
        }

        const proRateData = await this.proRateService.calculateProRate({
          CompanyMasterSid: anyHouse.CompanyMasterSid,
          BranchMasterSid: anyHouse.BranchMasterSid,
          MasterJobSid,
        });

        for (const proratedHouse of proRateData.houses || []) {
          const houseJobSid = proratedHouse.houseJob?.HouseJobSid;

          if (!houseJobSid) {
            continue;
          }

          for (const charge of proratedHouse.proratedCharges || []) {
            proratedHouseCR.push({
              TransactionSid: houseJobSid,
              CostLocalAmount: Number(charge.costLocalAmount || 0),
              RevenueLocalAmount: Number(charge.revenueLocalAmount || 0),
            });
          }
        }
      }

      const allHouseCR = [...directHouseCR, ...proratedHouseCR];

      const houseRateMap = new Map<number, any[]>();
      allHouseCR.forEach((cr) => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      const data = houseJobs
        .map((house) => {
          const houseDepartment =
            departments.find(
              (d) => d.DepartmentMasterSid === house.DepartmentMasterSid,
            )?.departmentName || '';

          const houseCR = houseRateMap.get(house.HouseJobSid) || [];

          const { totalRevenue, totalCost } = houseCR.reduce(
            (acc, cr) => {
              acc.totalRevenue += cr.RevenueLocalAmount
                ? Number(cr.RevenueLocalAmount)
                : 0;
              acc.totalCost += cr.CostLocalAmount
                ? Number(cr.CostLocalAmount)
                : 0;
              return acc;
            },
            { totalRevenue: 0, totalCost: 0 },
          );

          const totalProfit = totalRevenue - totalCost;
          const baseAmount = Math.max(totalRevenue, totalCost);
          const totalGP =
            baseAmount !== 0 ? (totalProfit / baseAmount) * 100 : 0;

          const costRevenueDetails = {
            RevenueLocalAmount: totalRevenue,
            CostLocalAmount: totalCost,
            Profit: totalProfit,
            GP: totalGP,
          };

          return {
            HouseJobSid: house.HouseJobSid,
            HouseNo: house.masterJob?.MasterJobNumber,
            HBLNo: house.HBLNo,
            houseDept: houseDepartment,
            houseStatus: house.HouseStatus,
            jobType: house.JobType,
            MBLNo: house.masterJob?.MBLNo,
            vesselName: house.VesselName,
            voyNo: house.VoyageNo,
            originAgent: house.AgentName,
            jobDate: house.HBLDate,
            destinationAgent:
              customerMaster.find(
                (d) => d.CustomerMasterSid === house.DestinationAgent,
              )?.CustomerName || '',
            customerName:
              customerMaster.find(
                (c) => c.CustomerMasterSid === house.CustomerMasterSid,
              )?.CustomerName || '',
            jobNo: house.masterJob?.MasterJobNumber,
            costRevenueDetails: costRevenueDetails,
          };
        })
        .filter((item) => item.costRevenueDetails.GP < 0);

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        Customer: selectedCustomerNames,
        data,
        branchInvoled,
      };
    } catch (error) {
      this.logger.error(
        `Error generating  house job loss report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateProfitSummaryReport(
    params: ProfitSummaryReportQueryDto,
  ) {
    try {
      const {
        companyId: CompanyMasterSid,
        ToJobDt,
        FromJobDt,
        Branch: branchId,
        Dept: dept,
        WithProrate,
      } = params;
      const prorateEnabled =
        WithProrate ??
        (params as any).withProrate ??
        (params as any)['With Pro Rate'] ??
        (params as any).WithProRate ??
        false;

      this.logger.log(
        `Getting Profit Summary Report for CompanySid=${CompanyMasterSid}, From=${FromJobDt}, To=${ToJobDt}`,
      );

      /* ===================== MASTERS ===================== */

      const allBranches = await this.getBranchNames(CompanyMasterSid, branchId);

      const allBranchIds = allBranches.map((b) => b.BranchMasterSid);

      const brancesInvoled =
        branchId && branchId.length > 0
          ? allBranches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const [departments, customer, user] =
        await Promise.all([
          this._db.departmentMaster.findMany({
            where: { DepartmentMasterSid: { in: dept } },
            select: { DepartmentMasterSid: true, departmentName: true },
          }),
          this._db.customerMaster.findMany({
            select: { CustomerMasterSid: true, CustomerName: true },
          }),
          this._db.userMaster.findMany({
            select: { UserMasterSid: true, userName: true },
          }),
        ]);
      const profitSummaryMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
            { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'Service Job', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
            {
              MenuName: { contains: 'AgentMaster Air Way', mode: 'insensitive' },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allMasterMenuSids = profitSummaryMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'master job' || menuName.includes('master air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      const allHouseMenuSids = profitSummaryMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'house job' ||
            menuName === 'service job' ||
            menuName.includes('house air way') ||
            menuName.includes('agent master air way') ||
            menuName.includes('agentmaster air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      if (!allMasterMenuSids.length || !allHouseMenuSids.length) {
        throw new BadRequestException('Menu not found');
      }

      /* ===================== MASTER JOBS ===================== */

      const masterJob = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: allBranchIds },
          AND: [{ MBLDate: { gte: FromJobDt } }, { MBLDate: { lte: ToJobDt } }],
          Status: 'A',
          DepartmentMasterSid: { in: dept },
        },
        include: {
          voyages: {
            select: {
              ETA: true,
              ETD: true,
              ATA: true,
              ATD: true,
            },
          },
          houseJob: {
            where: { status: 'A' },
            include: {
              Cargo: true,
            },
          },
        },
        orderBy: { MBLDate: 'asc' },
      });

      if (!masterJob.length) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      // ================= COST REVENUE LOAD =================

      // Collect all MasterJob and HouseJob IDs
      const masterJobIds = masterJob.map((mj) => mj.MasterJobSid);
      const houseJobIds = masterJob.flatMap((mj) =>
        mj.houseJob.map((hj) => hj.HouseJobSid),
      );

      const allMasterCR = await this._db.costRevenueCharges.findMany({
        where: {
          status: 'A',
          MenuMasterSid: { in: allMasterMenuSids },
          TransactionSid: { in: masterJobIds },
        },
        select: {
          TransactionSid: true,
          MenuMasterSid: true,
          CostRevenueChargesSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueDrCr: true,
          RevenueLocalAmount: true,
          CostVoucherHeaderSid: true,
          CostDrCr: true,
          CostLocalAmount: true,
        },
      });

      // Create Maps for quick lookup
      const masterCRMap = new Map<number, any[]>();
      const houseCRMap = new Map<number, any[]>();
      const masterMenuSet = new Set(allMasterMenuSids);

      allMasterCR.forEach((cr) => {
        const key = cr.TransactionSid!;
        if (masterMenuSet.has(cr.MenuMasterSid!)) {
          if (!masterCRMap.has(key)) masterCRMap.set(key, []);
          masterCRMap.get(key)!.push(cr);
        }
      });

      const allHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          status: 'A',
          MenuMasterSid: { in: allHouseMenuSids },
          TransactionSid: { in: houseJobIds },
        },
        select: {
          TransactionSid: true,
          MenuMasterSid: true,
          CostRevenueChargesSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueDrCr: true,
          RevenueLocalAmount: true,
          CostVoucherHeaderSid: true,
          CostDrCr: true,
          CostLocalAmount: true,
        },
      });

      allHouseCR.forEach((cr) => {
        const key = cr.TransactionSid!;
        if (!houseCRMap.has(key)) {
          houseCRMap.set(key, []);
        }
        houseCRMap.get(key)!.push(cr);
      });

      const houseProrateMap = new Map<
        number,
        { totalRevenue: number; totalCost: number; count: number }
      >();

      if (prorateEnabled && masterJobIds.length > 0) {
        const jobToSubjobMasters = await this._db.masterJobOthers.findMany({
          where: {
            MasterJobSid: { in: masterJobIds },
            Status: 'A',
            JobtoSubjob: 'Y',
          },
          select: {
            MasterJobSid: true,
          },
        });

        const masterJobMap = new Map(
          masterJob.map((mj) => [mj.MasterJobSid, mj]),
        );

        for (const { MasterJobSid } of jobToSubjobMasters) {
          const selectedMaster = masterJobMap.get(MasterJobSid);

          if (!selectedMaster?.CompanyMasterSid || !selectedMaster?.BranchMasterSid) {
            continue;
          }

          const proRateData = await this.proRateService.calculateProRate({
            CompanyMasterSid: selectedMaster.CompanyMasterSid,
            BranchMasterSid: selectedMaster.BranchMasterSid,
            MasterJobSid,
          });

          for (const proratedHouse of proRateData.houses || []) {
            const houseJobSid = proratedHouse.houseJob?.HouseJobSid;

            if (!houseJobSid) {
              continue;
            }

            for (const charge of proratedHouse.proratedCharges || []) {
              const current = houseProrateMap.get(houseJobSid) || {
                totalRevenue: 0,
                totalCost: 0,
                count: 0,
              };
              current.totalRevenue += Number(charge.revenueLocalAmount || 0);
              current.totalCost += Number(charge.costLocalAmount || 0);
              current.count += 1;
              houseProrateMap.set(houseJobSid, current);
            }
          }
        }
      }

      const getDepartmentName = (deptId: number) =>
        departments.find((d) => d.DepartmentMasterSid === deptId)
          ?.departmentName || '';

      const getActualsFromCharges = async (charges: any[]) => {
        const actuals = await Promise.all(
          charges
            .filter((cr) => cr.CostRevenueChargesSid)
            .map((cr) =>
              this.voucherService.getActualAmountForCostRevenue(
                cr.CostRevenueChargesSid,
              ),
            ),
        );

        return actuals.reduce(
          (sum, item) => {
            sum.aSale += Number(item.ActualRevenue || 0);
            sum.aCost += Number(item.ActualCost || 0);
            return sum;
          },
          { aSale: 0, aCost: 0 },
        );
      };

      const calculateProfitMetrics = (totalSales: number, totalCost: number) => {
        let profit = 0;
        let profitPercent = 0;

        if (totalSales > totalCost) {
          profit = totalSales - totalCost;
          profitPercent = totalSales !== 0 ? (profit / totalSales) * 100 : 0;
        } else {
          profit = -(totalCost - totalSales);
          profitPercent = totalCost !== 0 ? (profit / totalCost) * 100 : 0;
        }

        return { profit, profitPercent };
      };

      /* ===================== FINAL DATA ===================== */

      const data = await Promise.all(
        masterJob.map(async (mj) => {
        const masterCR = masterCRMap.get(mj.MasterJobSid) || [];

          const linkedRev = masterCR.filter((cr) => cr.RevenueVoucherHeaderSid);
          const linkedCost = masterCR.filter((cr) => cr.CostVoucherHeaderSid);

          const calc = (arr: any[], type: 'R' | 'C') =>
            arr.reduce((sum, cr) => {
              if (type === 'R') {
                return sum + Number(cr.RevenueLocalAmount || 0);
              }
              return sum + Number(cr.CostLocalAmount || 0);
            }, 0);

          const pSale = calc(masterCR, 'R');
          const pCost = calc(masterCR, 'C');
          const masterActuals = await getActualsFromCharges(masterCR);
          const aSale = masterActuals.aSale;
          const aCost = masterActuals.aCost;

          const houseWithCR = await Promise.all(
            mj.houseJob.map(async (hj) => {
              const houseCR = houseCRMap.get(hj.HouseJobSid) || [];
              const houseProrate = houseProrateMap.get(hj.HouseJobSid) || {
                totalRevenue: 0,
                totalCost: 0,
                count: 0,
              };

              const linkedRevH = houseCR.filter(
                (cr) => cr.RevenueVoucherHeaderSid,
              );
              const linkedCostH = houseCR.filter(
                (cr) => cr.CostVoucherHeaderSid,
              );

              const hpSale = calc(houseCR, 'R') + houseProrate.totalRevenue;
              const hpCost = calc(houseCR, 'C') + houseProrate.totalCost;
              const houseActuals = await getActualsFromCharges(houseCR);
              const haSale = houseActuals.aSale;
              const haCost = houseActuals.aCost;
              const housePlannedProfit = calculateProfitMetrics(hpSale, hpCost);
              const houseActualProfit = calculateProfitMetrics(haSale, haCost);

              return {
                HouseJobSid: hj.HouseJobSid,
                HBLNo: hj.HBLNo,
                houseStatus: hj.HouseStatus,
                jobType: hj.JobType,
                customerName: customer.find(
                  (d) => d.CustomerMasterSid === hj.CustomerMasterSid,
                )?.CustomerName,
                OriginAgent: hj.AgentName,
                DestinationAgent: customer.find(
                  (d) => d.CustomerMasterSid === hj.DestinationAgent,
                )?.CustomerName,
                ModeOfTransport: mj.houseJob
                  ?.flatMap(h => h.Cargo ?? [])
                  .map(c => c?.ModeOfTransport)
                  .filter(Boolean)
                  .join(', ') || '',
                salesPerson: user.find(
                  (u) => u.UserMasterSid === hj.SalesmanSid,
                )?.userName,
                PPCC: hj.FreightTerms,
                POO: hj.POO,
                FPD: hj.FPD,
                costRevenues: {
                  totalNoOfCostRevenues: houseCR.length + houseProrate.count,
                  linkedRevenueRecords: linkedRevH.map(
                    (cr) => cr.CostRevenueChargesSid,
                  ),
                  linkedCostRecords: linkedCostH.map(
                    (cr) => cr.CostRevenueChargesSid,
                  ),
                  houseCrSummary: {
                    pSale: hpSale,
                    pCost: hpCost,
                    pGp: housePlannedProfit.profit,
                    pGpPercent: housePlannedProfit.profitPercent,
                    aSale: haSale,
                    aCost: haCost,
                    aGp: houseActualProfit.profit,
                    aGpPercent: houseActualProfit.profitPercent,
                  },
                },
              };
            }),
          );

          const masterPlannedProfit = calculateProfitMetrics(pSale, pCost);
          const masterActualProfit = calculateProfitMetrics(aSale, aCost);

          return {
            JobNo: mj.MasterJobNumber,
            MBLNo: mj.MBLNo,
            MBLDate: mj.MBLDate,
            OriginAgent:
              customer.find((o) => o.CustomerMasterSid === mj.OriginAgent)
                ?.CustomerName || '',
            DestinationAgent:
              customer.find((d) => d.CustomerMasterSid === mj.DestinationAgent)
                ?.CustomerName || '',
            customerName:
              customer.find(
                (c) =>
                  c.CustomerMasterSid === mj.houseJob?.[0]?.CustomerMasterSid,
              )?.CustomerName || '',
            jobType: mj.houseJob?.[0]?.JobType,
            houseNo: mj.houseJob?.[0]?.HouseNo,
            HBLNo: mj.houseJob?.[0]?.HBLNo,
            houseStatus: mj.houseJob?.[0]?.HouseStatus,
            ModeOfTransport: mj.houseJob
              ?.flatMap(h => h.Cargo ?? [])
              .map(c => c?.ModeOfTransport)
              .filter(Boolean)
              .join(', ') || '',
            PPCC: mj.houseJob?.[0]?.FreightTerms,
            salesPerson:
              user.find(
                (u) => u.UserMasterSid === mj.houseJob?.[0]?.SalesmanSid,
              )?.userName || '',
            POO: mj.POO,
            POL: mj.POL,
            POD: mj.POD,
            FPD: mj.FPD,
            ETA: mj.voyages[0]?.ETA,
            ETD: mj.voyages[0]?.ETD,
            ATA: mj.voyages[0]?.ATA,
            ATD: mj.voyages[0]?.ATD,
            deptName: getDepartmentName(mj.DepartmentMasterSid),
            costRevenues: {
              totalNoOfCostRevenues: masterCR.length,
              linkedRevenueRecords: linkedRev.map(
                (cr) => cr.CostRevenueChargesSid,
              ),
              linkedCostRecords: linkedCost.map(
                (cr) => cr.CostRevenueChargesSid,
              ),
              masterCrSummary: {
                pSale,
                pCost,
                pGp: masterPlannedProfit.profit,
                pGpPercent: masterPlannedProfit.profitPercent,
                aSale,
                aCost,
                aGp: masterActualProfit.profit,
                aGpPercent: masterActualProfit.profitPercent,
              },
            },
            houseWithCR,
          };
        }),
      );

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        BranchInvolved: allBranches.map((b) => b.branchName).join(', '),
        brancesInvoled,
        DeptNames: departments.map((d) => d.departmentName).join(', '),
        data,
        params,
      };
    } catch (error) {
      this.logger.error(
        `Error generating Profit Summary Report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateDestinationReport(params: DestinationReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
      Transhipment = false,
      Customer,
      Salesperson: SalePerson,
      POL,
      POD,
    } = params;

    try {
      this.logger.log(
        `Getting shipment summary details report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                BranchMasterSid: true,
                branchName: true,
              },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchesInvoled =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: {
                DepartmentMasterSid: true,
                departmentName: true,
              },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: {
                DepartmentMasterSid: true,
                departmentName: true,
              },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true },
      });

      // Map ID → Name for fast lookup
      const containerTypeMap = new Map(
        containerTypesMaster.map((ct) => [
          ct.ContainerTypeMasterSid,
          ct.ContainerSize,
        ]),
      );

      const customerMaster = await this._db.customerMaster.findMany({
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
          CustomerType: true,
        },
      });

      const customerMap = new Map<number, string>(
        customerMaster.map((c) => [c.CustomerMasterSid, c.CustomerName]),
      );

      const selectedCustomerNames = Customer?.length
        ? Customer.map((id) => customerMap.get(id))
            .filter((name): name is string => !!name)
            .join(', ')
        : 'All Customers';

      const countryMaster = await this._db.countryMaster.findMany({
        select: {
          CountryMasterSid: true,
          countryName: true,
          countryCode: true,
        },
      });

      const userMaster = await this._db.userMaster.findMany({
        select: { UserMasterSid: true, userName: true },
      });

      const portIds = [POL, POD].filter(
        (id): id is number => typeof id === 'number',
      );

      let polCode: string | undefined;
      let podCode: string | undefined;

      if (portIds.length > 0) {
        const ports = await this._db.portMaster.findMany({
          where: {
            PortMasterSid: { in: portIds },
          },
          select: {
            PortMasterSid: true,
            PortCode: true,
          },
        });

        polCode = ports.find((p) => p.PortMasterSid === POL)?.PortCode;
        podCode = ports.find((p) => p.PortMasterSid === POD)?.PortCode;
      }

      let polNameParam: string | undefined;
      let podNameParam: string | undefined;

      if (portIds.length > 0) {
        const portsById = await this._db.portMaster.findMany({
          where: {
            PortMasterSid: { in: portIds },
          },
          select: {
            PortMasterSid: true,
            PortName: true,
          },
        });

        polNameParam = portsById.find((p) => p.PortMasterSid === POL)?.PortName;
        podNameParam = portsById.find((p) => p.PortMasterSid === POD)?.PortName;
      }

      const salespersonMap = new Map<number, string>(
        userMaster.map((u) => [u.UserMasterSid, u.userName]),
      );

      const selectedSalespersonNames = SalePerson?.length
        ? SalePerson.map((id) => salespersonMap.get(id)).filter(
            (name): name is string => !!name,
          )
        : 'All Salesperson';

      const isTranshipment: boolean = Transhipment === true;

      const whereClause: any = {
        CompanyMasterSid,
        AND: [{ HBLDate: { gte: FromHblDt } }, { HBLDate: { lte: ToHblDt } }],
        status: 'A',
        BranchMasterSid: { in: resolvedBranchIds },
        DepartmentMasterSid: { in: resolvedDeptIds },
      };

      if (SalePerson && SalePerson.length > 0) {
        whereClause.SalesmanSid = { in: SalePerson };
      }

      if (Customer && Customer.length > 0) {
        whereClause.CustomerMasterSid = { in: Customer };
      }

      if (isTranshipment) {
        whereClause.JobType = 'Transhipment';
      }

      if (polCode) whereClause.POL = polCode;
      if (podCode) whereClause.POD = podCode;

      const houseJobData = await this._db.houseJob.findMany({
        where: whereClause,
        include: {
          Cargo: true,
          Others: true,
          Products: true,
          bookingHeader: {
            where: {
              status: 'A',
            },
            select: {
              BookingDateTime: true,
            },
          },
          masterJob: {
            where: {
              Status: 'A',
            },
            select: {
              Volume: true,
              GrossWeight: true,
              ChargeableWeight: true,
              NetWeight: true,
              voyages: true,
              others: true,
              MasterJobNumber: true,
              JobStatus: true,
              CreatedBy: true,
              OriginAgent: true,
              containers: {
                where: { Status: 'A' },
                include: {
                  containerType: {
                    select: {
                      ContainerSize: true,
                      NoOfTeu: true,
                      ContainerName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (houseJobData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return {
          companyMasterSid: CompanyMasterSid,
          branchMasterSid: branchId,
          data: [],
        };
      }

      const portCodes = new Set<string>();

      houseJobData.forEach((mj) => {
        if (mj.POL) portCodes.add(mj.POL);
        if (mj.POD) portCodes.add(mj.POD);
        if (mj.FPD) portCodes.add(mj.FPD);
        if (mj.POO) portCodes.add(mj.POO);
      });

      // Fetch port details
      const ports = await this._db.portMaster.findMany({
        where: {
          PortCode: { in: Array.from(portCodes) },
        },
        select: {
          PortCode: true,
          PortName: true,
          CountryMasterSid: true,
        },
      });

      const portCountryMap = new Map<string, number>();
      ports.forEach((p) => {
        if (p.PortCode && p.CountryMasterSid) {
          portCountryMap.set(p.PortCode, p.CountryMasterSid);
        }
      });

      const countryMap = new Map(
        countryMaster.map((c) => [
          c.CountryMasterSid,
          { countryName: c.countryName, countryCode: c.countryCode },
        ]),
      );

      // Create a map of port code to port name
      const portMap = new Map(
        ports.map((port) => [port.PortCode, port.PortName]),
      );

      const containerSize = [
        "20'F",
        "40'F",
        "45'HC",
        "20'Refer",
        "40'Refer",
        "45' HC Refer",
        "20'Open Top ",
        "40' Open Top",
        "45' HC Open Top",
      ];

      // Map the master job data
      const data = houseJobData.map((mj) => {
        // Determine the type based on destinationPort (or any other field)
        const type = mj.DestinationAgent ? 'Agent' : null;

        // Sum volumes for local shipment (Import + Export)
        const localShipmentVol =
          houseJobData?.reduce((sum, job) => {
            if (job.JobType === 'Import' || job.JobType === 'Export') {
              return (
                sum +
                (job.Cargo?.reduce(
                  (cSum, cargo) => cSum + Number(cargo.Volume || 0),
                  0,
                ) || 0)
              );
            }
            return sum;
          }, 0) || 0;

        // Sum volumes for transhipment shipment
        const transhipmentVol =
          houseJobData?.reduce((sum, job) => {
            if (job.JobType === 'Transhipment') {
              return (
                sum +
                (job.Cargo?.reduce(
                  (cSum, cargo) => cSum + Number(cargo.Volume || 0),
                  0,
                ) || 0)
              );
            }
            return sum;
          }, 0) || 0;

        const masterContainerSid =
          mj.masterJob?.containers?.[0]?.MasterJobContainerSid;

        const containerInfo = (mj.masterJob?.containers || [])
          .filter((c) => c.MasterJobContainerSid === masterContainerSid)
          .map((c) => {
            const containerTypeId = c.ContainerType;
            return {
              containerNumber: c.ContainerNumber,
              containerType:
                containerTypeId != null
                  ? containerTypeMap.get(containerTypeId) ||
                    `Unknown(${containerTypeId})`
                  : 'Unknown',
            };
          });

        const houseProducts = mj.Products;
        const allContainers = mj.masterJob?.containers || [];
        let totalNoOfTEU = 0;

        let numberOfTwentyFt = 0;
        let numberOfFourtyFt = 0;
        let numberofFurtyFiveFt = 0;

        let numberOfTwentyRefer = 0;
        let numberOfFourtyRefer = 0;
        let numberOfFourtyFiveRefer = 0;

        let numberofTwentyOpen = 0;
        let numberofFourtyOpen = 0;
        let numberofFourtyFiveOpen = 0;

        houseProducts.forEach((hp) => {
          const ourMJContainer = allContainers.find(
            (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
          );

          const ourContainerType = ourMJContainer?.containerType;

          containerInfo.push({
            containerNumber: hp?.ContainerNo ?? '',
            containerType: ourContainerType?.ContainerSize ?? '',
          });

          totalNoOfTEU += toNumber(ourContainerType?.NoOfTeu);

          const size = ourContainerType?.ContainerName ?? '';

          if (size === '20ft Standard') numberOfTwentyFt++;
          if (size === '40ft Container') numberOfFourtyFt++;
          if (size === '45ft High Cube ') numberofFurtyFiveFt++;
          if (size === '20ft Flat Rack' || size === '20ft Reefer')
            numberOfTwentyRefer++;
          if (size === '40RF' || size === '40 Flat Rack') numberOfFourtyRefer++;
          if (size === '40 Flat Rack') numberOfFourtyFiveRefer++;
          if (size === '20ft Open Top') numberofTwentyOpen++;
          if (size === '40Ft Open Top') numberofFourtyOpen++;
          if (size === '45Ft Open Top') numberofFourtyFiveOpen++;
        });

        const polName = mj.POL ? portMap.get(mj.POL) || '' : '';
        const podName = mj.POD ? portMap.get(mj.POD) || '' : '';
        const fpdName = mj.FPD ? portMap.get(mj.FPD) || '' : '';
        const pooName = mj.POO ? portMap.get(mj.POO) || '' : '';

        const pooCountrySid = mj.POO ? portCountryMap.get(mj.POO) : undefined;
        const pooCountry = pooCountrySid
          ? countryMap.get(pooCountrySid)
          : undefined;

        const polCountrySid = mj.POL ? portCountryMap.get(mj.POL) : undefined;
        const polCountry = polCountrySid
          ? countryMap.get(polCountrySid)
          : undefined;

        // --- POD Country ---
        const podCountrySid = mj.POD ? portCountryMap.get(mj.POD) : undefined;
        const podCountry = podCountrySid
          ? countryMap.get(podCountrySid)
          : undefined;

        const fdcCountrySid = mj.FPD ? portCountryMap.get(mj.FPD) : undefined;
        const fdcCountry = fdcCountrySid
          ? countryMap.get(fdcCountrySid)
          : undefined;

        const houseDepartment =
          departments.find(
            (d) => d.DepartmentMasterSid === mj.DepartmentMasterSid,
          )?.departmentName || '';
        const masterJob = Array.isArray(mj.masterJob)
          ? mj.masterJob[0]
          : mj.masterJob;

        const importJobNo = houseDepartment?.toLowerCase().includes('import')
          ? masterJob?.MasterJobNumber || ''
          : '';

        const exportJobNo = houseDepartment?.toLowerCase().includes('export')
          ? masterJob?.MasterJobNumber || ''
          : '';

        return {
          MBL: mj.MBLNo,
          shipmentNo: mj.ShipmentNo,
          bookingDate: mj.bookingHeader?.BookingDateTime,
          masterDate: mj.MBLDate,
          houseDepartment,
          HBL: mj.HBLNo,
          HBLDate: mj.HBLDate,
          importJobNo,
          exportJobNo,
          mblNo: mj.MBLNo || '',
          branchName:
            branches.find((b) => b.BranchMasterSid === mj.BranchMasterSid)
              ?.branchName || '',
          customerType: (() => {
            const typeObj =
              customerMaster.find(
                (c) => c.CustomerMasterSid === mj.CustomerMasterSid,
              )?.CustomerType || {};
            return Object.keys(typeObj).filter(
              (key) => typeObj[key] === 'isTrue',
            );
          })(),
          masterJobNo: mj.masterJob?.MasterJobNumber,
          vesselName: mj.VesselName,
          voyageNo: mj.VoyageNo || '',
          ETD: mj.ETD || '',
          ETA: mj.ETA || '',
          ATA: mj.masterJob?.voyages?.[0]?.ATA,
          ATD: mj.masterJob?.voyages?.[0]?.ATD,
          originPort: mj.POO || '',
          originPortName: pooName || '',
          POOCode: mj.POO,
          POOName: pooName || '',
          POLCode: mj.POL || '',
          POLName: polName,
          PODCode: mj.POD || '',
          PODName: podName,
          FPDCode: mj.FPD || '',
          FPDName: fpdName,
          POOCountryName: pooCountry?.countryName || '',
          POOCountryCode: pooCountry?.countryCode || '',
          POLCountryName: polCountry?.countryName || '',
          POLCountryCode: polCountry?.countryCode || '',
          PODCountryName: podCountry?.countryName || '',
          PODCountryCode: podCountry?.countryCode || '',
          FDCCounryName: fdcCountry?.countryName || '',
          FDCCountryCode: fdcCountry?.countryCode || '',
          // salesPerson:mj.SalesmanSid,
          salesPerson:
            userMaster.find((d) => d.UserMasterSid === mj.SalesmanSid)
              ?.userName || '',
          nominationBY: mj.NominatedBy,
          nominated: mj.Nominated,
          coLoader: mj.masterJob?.others?.[0]?.CoLoader,
          internalNote: mj.InternalNote,
          carrier: mj.CarrierName || '',
          originCarrier:
            customerMaster.find((c) => c.CustomerMasterSid === mj.CarrierSid)
              ?.CustomerName || '',
          pcs: mj.Cargo?.reduce(
          (sum, item) => sum + toNumber(item?.NoOfPackage),
          0
        ) || 0,
          houseStatus: mj.HouseStatus,
          serviceLevelName: mj.MovementType,
          blType: mj.Others?.[0]?.ReleaseType,
          paymentTerms: mj.FreightTerms,
          shipperNo: mj.Others?.[0]?.CustomerRefNo,
          masterStatus: mj.masterJob?.JobStatus,
          jobClosed: mj.HouseStatus,
          housecreatedBy: mj.createdBy,
          mastercreatedBy: mj.masterJob?.CreatedBy,
          addtionalRemarks: mj?.GeneralNote,
           volume: mj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.Volume),
            0
          ) || 0,
          grossWeight: mj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.GrossWeight),
            0
          ) || 0,
          chargeable: mj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.ChargeableWeight),
            0
          ) || 0,
          netWeight: mj.Cargo?.reduce(
            (sum, item) => sum + toNumber(item?.NetWeight),
            0
          ) || 0,
          customer: mj.CustomerName,
          nofcontainer:
            numberOfTwentyFt +
            numberOfFourtyFt +
            numberofFurtyFiveFt +
            numberOfTwentyRefer +
            numberOfFourtyRefer +
            numberOfFourtyFiveRefer +
            numberofTwentyOpen +
            numberofFourtyOpen +
            numberofFourtyFiveOpen,
          noOfContainers:
            houseJobData.reduce(
              (sum, job) =>
                sum +
                (job.Cargo?.reduce(
                  (cSum, cargo) => cSum + (cargo.NoofContainers || 0),
                  0,
                ) || 0),
              0,
            ) || 0,
          shipper: mj.ShipperName || '',
          consignee: mj.ConsigneeName,
          originAgent: mj.AgentName,
          deliveryAgent:
            customerMaster.find(
              (d) => d.CustomerMasterSid === mj.DestinationAgent,
            )?.CustomerName || '',
          notify: mj.Notify,
          agent: mj.AgentName,
          incoTerms: mj.IncoTerms,
          PPCC: mj.FreightTerms,
          modeofTransport: mj.Cargo
          ?.map(c => c?.ModeOfTransport)
          ?.filter(Boolean)
          ?.join(', ') || '',
          jobType: mj.JobType,
          containerNoList:
            mj?.masterJob?.containers
              ?.map((c: any) => c.ContainerNumber)
              .join(', ') || '',
          mastercontainerSid:
            mj?.masterJob?.containers
              ?.map((c: any) => c.mastercontainerSid)
              .join(', ') || '',
          masterContanierSid:
            mj?.masterJob?.containers?.[0]?.MasterJobContainerSid,
          receivingAgent:
            customerMaster.find(
              (d) => d.CustomerMasterSid === mj.DestinationAgent,
            )?.CustomerName || '',
          containerInfo,
          totalNoOfTEU,
          numberOfTwentyFt,
          numberOfFourtyFt,
          numberofFurtyFiveFt,
          numberOfTwentyRefer,
          numberOfFourtyRefer,
          numberOfFourtyFiveRefer,
          numberofTwentyOpen,
          numberofFourtyOpen,
          numberofFourtyFiveOpen,
          status: mj.status,
          DoNo: mj.Others?.[0]?.DONo,
          DoDate: mj.Others?.[0]?.DODate,
          SOBDate: mj.masterJob?.others?.[0]?.SOBDate,
          shippingBillNo: mj.Products?.[0]?.ShippingBillNo,
          localShipment:
            houseJobData?.filter(
              (job) => job.JobType === 'Import' || job.JobType === 'Export',
            ).length || 0,
          transhipmentShipment:
            houseJobData?.filter((job) => job.JobType === 'Transhipment')
              .length || 0,
          totalShipment:
            (houseJobData?.filter(
              (job) => job.JobType === 'Import' || job.JobType === 'Export',
            ).length || 0) +
            (houseJobData?.filter((job) => job.JobType === 'Transhipment')
              .length || 0),
          localShipmentVol,
          transhipmentVol,
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        Transhipment,
        Customer: selectedCustomerNames,
        SalePerson: selectedSalespersonNames,
        POL: polNameParam || POL,
        POD: podNameParam || POD,
        branchesInvoled,
      };
    } catch (error) {
      this.logger.error(
        `Error generating Destination Report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateExportJobVolumeTEUReport(
    params: exportJobVolumeTEUReportQueryDto,
  ) {
    const {
      FromDate,
      ToDate,
      companyId: CompanyMasterSid,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchesInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: {
                DepartmentMasterSid: { in: deptId },
                NOT: {
                  OR: [
                    {
                      departmentName: {
                        contains: 'AIR',
                        mode: 'insensitive',
                      },
                    },
                    {
                      departmentName: {
                        contains: 'IMPORT',
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: {
                CompanyMasterSid,
                NOT: {
                  OR: [
                    {
                      departmentName: {
                        contains: 'AIR',
                        mode: 'insensitive',
                      },
                    },
                    {
                      departmentName: {
                        contains: 'IMPORT',
                        mode: 'insensitive',
                      },
                    },
                  ],
                },
              },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map((d) => d.departmentName);
      const departmentInvoled =
        deptId && deptId.length > 0
          ? departments.map((d) => d.departmentName).join(', ')
          : 'All Departments';
      const customer = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true },
      });

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true },
      });

      const containerTypeMap = new Map(
        containerTypesMaster.map((ct) => [
          ct.ContainerTypeMasterSid,
          ct.ContainerSize,
        ]),
      );

      const masterJobs = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [{ MBLDate: { gte: FromDate } }, { MBLDate: { lte: ToDate } }],
          Status: 'A',
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          houseJob: {
            where: {
              status: 'A',
            },
            select: {
              Cargo: true,
              Products: true,
            },
          },
          containers: {
            where: { Status: 'A' },
            include: {
              containerType: {
                select: {
                  ContainerSize: true,
                  NoOfTeu: true,
                },
              },
            },
          },
          voyages: true,
        },
        orderBy: { MBLDate: 'asc' },
      });

      const masterContainerMap = new Map<string, number>();
      containerTypesMaster.forEach((m) => {
        const size = m.ContainerSize.replace("'", '').trim();
        masterContainerMap.set(size, 1);
      });

      // Map the master job data
      const data = masterJobs.map((mj) => {
        const masterContainerSid = mj.containers?.[0]?.MasterJobContainerSid;

        const containerInfo = (mj.containers || [])
          .filter((c) => c.MasterJobContainerSid === masterContainerSid)
          .map((c) => {
            const containerTypeId = c.ContainerType;
            return {
              containerNumber: c.ContainerNumber,
              containerType:
                containerTypeId != null
                  ? containerTypeMap.get(containerTypeId) ||
                    `Unknown(${containerTypeId})`
                  : '',
            };
          });

        const allContainers = mj?.containers || [];

        let totalNoOfTEU = 0;
        let numberOfTwentyFt = 0;
        let numberOfFourtyFt = 0;
        let numberofFurtyFive = 0;
        const houseProducts =
          mj.houseJob?.flatMap((h) => h.Products || []) || [];
        let containerMap = new Map<
          number,
          {
            ContainerSize: number;
            NoOfTeu: number;
          }
        >();

        const getContainerSize = (size: string) => {
          if (size.includes('20')) return 20;
          if (size.includes('40')) return 40;
          if (size.includes('45')) return 45;
          return 0;
        };

        houseProducts.forEach((hp) => {
          const ourMJContainer = allContainers.find(
            (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
          );

          const ourContainerType = ourMJContainer?.containerType;

          if (ourContainerType && ourMJContainer?.MasterJobContainerSid) {
            const alreadyExists = containerMap.has(
              ourMJContainer.MasterJobContainerSid,
            );

            if (!alreadyExists) {
              containerMap.set(ourMJContainer.MasterJobContainerSid, {
                ContainerSize: getContainerSize(
                  ourContainerType.ContainerSize || '',
                ),
                NoOfTeu: toNumber(ourContainerType.NoOfTeu),
              });
            }
          }
        });

        const containerUniqueInfo = Array.from(containerMap.values());
        containerUniqueInfo.forEach((cont) => {
          if (cont.ContainerSize === 20) numberOfTwentyFt++;
          if (cont.ContainerSize === 40) numberOfFourtyFt++;
          if (cont.ContainerSize === 45) numberofFurtyFive++;
          totalNoOfTEU += cont.NoOfTeu;
        });

        return {
          TEUCount: totalNoOfTEU,
          fourtyft: numberOfFourtyFt,
          fortyfiveft: numberofFurtyFive,
          twentyft: numberOfTwentyFt,
          dept:
            departments.find(
              (d) => d.DepartmentMasterSid === mj.DepartmentMasterSid,
            )?.departmentName || '',
          jobNo: mj.MasterJobNumber,
           movementType: mj.houseJob
              ?.flatMap(h => h.Cargo ?? [])
              .map(c => c?.ModeOfTransport)
              .filter(Boolean)
              .join(', ') || '',
          MBLDate: mj.MBLDate,
          ETD: mj.voyages?.[0]?.ETD,
          deliveyAgent:
            customer.find((c) => c.CustomerMasterSid === mj.DestinationAgent)
              ?.CustomerName || '',
          carrier: mj.voyages?.[0]?.CarrierName,
          portOfloading: mj.POL,
          portOfdischarge: mj.POD,
          portOfDestination: mj.FPD,
          weight: mj.GrossWeight,
          chargebaleWt: mj.ChargeableWeight,
        };
      });

      return {
        params,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        data,
        departmentInvoled,
        branchesInvolved,
      };
    } catch (error) {
      throw error;
    }
  }

  // Network Report
  private async generateNetworkReport(params: NetworkReportQueryDto) {
    const {
      FromDate,
      ToDate,
      Network: network,
      companyId: CompanyMasterSid,
      Dept: Department,
    } = params;

    try {
      // 2. Load masters
      const organizationMaster = await this._db.customerMaster.findMany({
        where: { status: 'A' },
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
          Network: true,
        },
      });

      const departments = await this._db.departmentMaster.findMany({
        where: {
          Status: 'A',
        },
        select: {
          DepartmentMasterSid: true,
          departmentName: true,
        },
      });

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        where: { status: 'A' },
        select: { ContainerTypeMasterSid: true, ContainerSize: true },
      });

      // Map ID → Name for fast lookup
      const containerTypeMap = new Map(
        containerTypesMaster.map((ct) => [
          ct.ContainerTypeMasterSid,
          ct.ContainerSize,
        ]),
      );

      // 3. Build house filter
      const whereClause: Prisma.HouseJobWhereInput = {
        CompanyMasterSid: CompanyMasterSid,
        status: 'A',
        AND: [{ HBLDate: { gte: FromDate } }, { HBLDate: { lte: ToDate } }],
      };
      if (network) {
        whereClause.customerMaster = {
          Network: {
            contains: String(network).trim(),
            mode: 'insensitive',
          },
        };
      }
      // 4. Fetch house data
      const networkData = await this._db.houseJob.findMany({
        where: whereClause,
        include: {
          Cargo: true,
          Products: true,
          masterJob: {
            where: {
              Status: 'A',
            },
            select: {
              GrossWeight: true,
              NetWeight: true,
              MasterJobNumber: true,
              MBLNo: true,
              OriginAgent: true,
              containers: {
                where: { Status: 'A' },
                include: {
                  containerType: {
                    select: {
                      ContainerSize: true,
                      NoOfTeu: true,
                    },
                  },
                },
              },
            },
          },
          bookingHeader: {
            where: {
              status: 'A',
            },
            select: {
              BookingNo: true,
            },
          },
          customerMaster: {
            select: {
              Network: true,
            },
          },
        },
        orderBy: {
          HBLDate: 'asc',
        },
      });

      const houseJobIds = networkData.map((h) => h.HouseJobSid);
      const notBookedMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
            { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'Service Job', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allHouseMenuSids = notBookedMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'house job' ||
            menuName === 'service job' ||
            menuName.includes('house air way') ||
            menuName.includes('agent master air way')
          );
        })
        .map((m) => m.MenuMasterSid);

      if (!allHouseMenuSids.length) {
        throw new BadRequestException('House menus not found');
      }

      const directHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: { in: allHouseMenuSids },
          TransactionSid: { in: houseJobIds },
          status: 'A',
          OR: [
            { CostVoucherHeaderSid: null },
            { RevenueVoucherHeaderSid: null },
          ],
        },
        select: {
          TransactionSid: true,
          CostLocalAmount: true,
          RevenueLocalAmount: true,
        },
      });

      const masterJobIds = Array.from(
        new Set(
          networkData
            .map((house) => house.MasterJobSid)
            .filter((sid): sid is number => typeof sid === 'number'),
        ),
      );

      const jobToSubjobMasters = await this._db.masterJobOthers.findMany({
        where: {
          MasterJobSid: { in: masterJobIds },
          Status: 'A',
          JobtoSubjob: 'Y',
        },
        select: {
          MasterJobSid: true,
        },
      });

      const proratedHouseCR: Array<{
        TransactionSid: number;
        CostLocalAmount: number;
        RevenueLocalAmount: number;
      }> = [];

      for (const { MasterJobSid } of jobToSubjobMasters) {
        const anyHouse = networkData.find(
          (house) => house.MasterJobSid === MasterJobSid,
        );

        if (!anyHouse?.CompanyMasterSid || !anyHouse?.BranchMasterSid) {
          continue;
        }

        const proRateData = await this.proRateService.calculateProRate({
          CompanyMasterSid: anyHouse.CompanyMasterSid,
          BranchMasterSid: anyHouse.BranchMasterSid,
          MasterJobSid,
        });

        for (const proratedHouse of proRateData.houses || []) {
          const houseJobSid = proratedHouse.houseJob?.HouseJobSid;

          if (!houseJobSid) {
            continue;
          }

          for (const charge of proratedHouse.proratedCharges || []) {
            proratedHouseCR.push({
              TransactionSid: houseJobSid,
              CostLocalAmount: Number(charge.costLocalAmount || 0),
              RevenueLocalAmount: Number(charge.revenueLocalAmount || 0),
            });
          }
        }
      }

      const allHouseCR = [...directHouseCR, ...proratedHouseCR];

      const houseRateMap = new Map<number, any[]>();
      allHouseCR.forEach((cr) => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      const data = networkData.map((b) => {
        const customer = organizationMaster.find(
          (c) => c.CustomerMasterSid === b.CustomerMasterSid,
        );
        const department = departments.find(
          (d) => d.DepartmentMasterSid === b.DepartmentMasterSid,
        );
        const destinationAgent = organizationMaster.find(
          (c) => c.CustomerMasterSid === b.DestinationAgent,
        );
        const originAgent = organizationMaster.find(
          (c) => c.CustomerName === b.AgentName,
        );
        const houseCR = houseRateMap.get(b.HouseJobSid) || [];
        const { totalRevenue, totalCost } = houseCR.reduce(
          (acc, cr) => {
            acc.totalRevenue += cr.RevenueLocalAmount
              ? Number(cr.RevenueLocalAmount)
              : 0;
            acc.totalCost += cr.CostLocalAmount
              ? Number(cr.CostLocalAmount)
              : 0;
            return acc;
          },
          { totalRevenue: 0, totalCost: 0 },
        );
        const profit = totalRevenue - totalCost;
        const baseAmount = Math.max(totalRevenue, totalCost);
        const totalGP =
            baseAmount !== 0 ? (profit / baseAmount) * 100 : 0;
        const allContainers = b?.masterJob?.containers || [];

        let totalNoOfTEU = 0;
        let numberOfTwentyFt = 0;
        let numberOfFourtyFt = 0;
        let numberofFurtyFive = 0;
        const houseProducts = b.Products;

        houseProducts.forEach((hp) => {
          const ourMJContainer = allContainers.find(
            (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
          );
          const ourContainerType = ourMJContainer?.containerType;
          totalNoOfTEU += toNumber(ourContainerType?.NoOfTeu);
          const size = ourContainerType?.ContainerSize;
          if (size?.includes('20')) numberOfTwentyFt++;
          if (size?.includes('40')) numberOfFourtyFt++;
          if (size?.includes('45')) numberofFurtyFive++;
        });

        return {
          customerName: customer?.CustomerName || '',
          departmentName: department?.departmentName || '',
          network: customer?.Network || '',
          BookingNo: b.bookingHeader?.BookingNo,
          HouseNo: b.HouseNo,
          HblNo: b.HBLNo,
          MBLNo: b.masterJob?.MBLNo,
          masterJobNo: b.masterJob?.MasterJobNumber,
          originAgent: b.AgentName,
          originNetwork: originAgent?.Network,
          destinationAgent: destinationAgent?.CustomerName || '',
          destinationNetwork: destinationAgent?.Network || '',
          nominationBy: b.NominatedBy,
          totalRevenue,
          totalCost,
          profit,
          totalGP,
          grossWt: b.masterJob?.GrossWeight,
          netWt: b.masterJob?.NetWeight,
          totalNoOfTEU,
        };
      });

      return {
        CompanyMasterSid,
        params,
        FromDate,
        ToDate,
        count: data.length,
        data,
      };
    } catch (error) {
      throw error;
    }
  }

  // Cost & Revenue Not Booked
  private async generateCostRevenueNotBookedReport(params: any) {
    const {
      companyId: CompanyMasterSid,
      FromJobDt: FromDate,
      ToJobDt: ToDate,
      Branch: branchId,
      Dept: deptId,
      CalculationType,
    } = params;

    try {
      this.logger.log(
        `Getting Cost & Revenue Not Booked report for CompanySid=${CompanyMasterSid}`,
      );

      const branches =
        branchId && branchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: branchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);

      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: { DepartmentMasterSid: { in: deptId } },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: { CompanyMasterSid },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames =
        deptId && deptId.length > 0
          ? departments.map((d) => d.departmentName).join(', ')
          : '';
      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customer = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true },
      });

      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [{ HBLDate: { gte: FromDate } }, { HBLDate: { lte: ToDate } }],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          masterJob: true,
          bookingHeader: {
            select: {
              BookingNo: true,
            },
          },
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (houseJobData.length === 0) {
        return {
          branchInvolved,
          data: [],
          params,
        };
      }
      const houseJobIds = houseJobData.map((h) => h.HouseJobSid);
      const notBookedMenus = await this._db.menuMaster.findMany({
        where: {
          status: 'A',
          OR: [
            { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
            { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'House Job', mode: 'insensitive' } },
            { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
            { MenuName: { equals: 'Service Job', mode: 'insensitive' } },
            {
              MenuName: {
                contains: 'Agent Master Air Way',
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { MenuMasterSid: true, MenuName: true },
      });

      const allHouseMenuSids = notBookedMenus
        .filter((m) => {
          const menuName = m.MenuName.toLowerCase();
          return (
            menuName === 'house job' ||
            menuName === 'service job' ||
            menuName.includes('house air way') ||
            menuName.includes('agent master air way') 
          );
        })
        .map((m) => m.MenuMasterSid);

      if (!allHouseMenuSids.length) {
        throw new BadRequestException('House menus not found');
      }
      const allHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: { in: allHouseMenuSids },
          TransactionSid: { in: houseJobIds },
          status: 'A',
        },
        select: {
          TransactionSid: true,
          ChargeMasterSid: true,
          CostAmount: true,
          RevenueAmount: true,
          CostLocalAmount: true,
          RevenueLocalAmount: true,
          CostVoucherHeaderSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueCustomerMasterSid: true,
          CostAgentMasterSid: true,
          ChargeUomSid: true,
        },
      });

      const filteredHouseCR = allHouseCR.filter((cr) => {
        const chargeName =
          chargeMaster.find((c) => c.ChargeMasterSid === cr.ChargeMasterSid)
            ?.chargeName || '';

        // Remove Freight
        if (chargeName === 'Freight') return false;

        // NOT REVENUE
        if (CalculationType === 'Revenue') {
          return (
            Number(cr.CostLocalAmount || 0) > 0 &&
            Number(cr.RevenueLocalAmount || 0) === 0
          );
        }

        // NOT COST
        if (CalculationType === 'Cost') {
          return (
            Number(cr.RevenueLocalAmount || 0) > 0 &&
            Number(cr.CostLocalAmount || 0) === 0
          );
        }

        return true;
      });
      const houseRateMap = new Map<number, any[]>();

      filteredHouseCR.forEach((cr) => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      const houseJobIdsWithCR = new Set(
        allHouseCR.map((cr) => cr.TransactionSid),
      );

      const houseJobsWithoutCR = houseJobData.filter(
        (hj) => !houseJobIdsWithCR.has(hj.HouseJobSid),
      );

      let finalData: any[] = [];

      // Only jobs that match revenue condition
      const jobsWithCR = houseJobData.filter((hj) =>
        houseRateMap.has(hj.HouseJobSid),
      );

      const mappedJobsWithCR = jobsWithCR.map((hj) => {
        const charges = houseRateMap.get(hj.HouseJobSid) || [];

        return {
          HouseJobSid: hj.HouseJobSid,
          BookingNo: hj.bookingHeader?.BookingNo,
          HBLDate: hj.HBLDate,
          HBLNo: hj.HBLNo,
          MBLNo: hj.masterJob?.MBLNo,
          MasterJobNo: hj.masterJob?.MasterJobNumber,
          dept: departments.find(
            (d) => d.DepartmentMasterSid === hj.DepartmentMasterSid,
          )?.departmentName,
          costRevenues: charges.map((cr) => ({
            Charge: chargeMaster.find(
              (c) => c.ChargeMasterSid === cr.ChargeMasterSid,
            )?.chargeName,
            CostAmt: Number(cr.CostAmount || 0),
            RevenueAmt: Number(cr.RevenueAmount || 0),
            CostLocalAmount: Number(cr.CostLocalAmount || 0),
            RevenueLocalAmount: Number(cr.RevenueLocalAmount || 0),
            costCustomer: customer.find(
              (c) => c.CustomerMasterSid === cr.CostAgentMasterSid,
            )?.CustomerName,
            revenueCustomer: customer.find(
              (c) => c.CustomerMasterSid === cr.RevenueCustomerMasterSid,
            )?.CustomerName,
          })),
        };
      });

      finalData = [...mappedJobsWithCR];

      if (CalculationType === 'Revenue') {
        const noRateData = houseJobsWithoutCR.map((hj) => ({
          HouseJobSid: hj.HouseJobSid,
          BookingNo: hj.bookingHeader?.BookingNo,
          HBLDate: hj.HBLDate,
          HBLNo: hj.HBLNo,
          MBLNo: hj.masterJob?.MBLNo,
          MasterJobNo: hj.masterJob?.MasterJobNumber,
          dept: departments.find(
            (d) => d.DepartmentMasterSid === hj.DepartmentMasterSid,
          )?.departmentName,
          costRevenues: [],
        }));

        finalData = [...finalData, ...noRateData];
      }

      return {
        companyMasterSid: CompanyMasterSid,
        branchInvolved,
        resolvedDeptNames,
        CalculationType,
        data: finalData,
        params,
      };
    } catch (error) {
      this.logger.error(
        `Error generating Cost & Revenue Not Booked report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateTranshipmentCargoReport(params: any) {
  const {
    companyId: CompanyMasterSid,
    ToHblDt,
    Branch: branchId,
  } = params;

  try {
    this.logger.log(
      `Getting Transhipment Cargo report for CompanySid=${CompanyMasterSid}, To=${ToHblDt}`,
    );

    const branches =
      branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
            where: { BranchMasterSid: { in: branchId } },
            select: { BranchMasterSid: true, branchName: true },
          })
        : await this._db.branchMaster.findMany({
            where: { CompanyMasterSid },
            select: { BranchMasterSid: true, branchName: true },
          });

    const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
    const resolvedBranchNames = branches.map((b) => b.branchName);
    const branchInvolved =
      branchId && branchId.length > 0
        ? branches.map((b) => b.branchName).join(', ')
        : 'All Branches';

    const summarizeProducts = (products: any[] = []) =>
      products.reduce(
        (acc, product) => {
          acc.packageCount += Number(product.ExternlQty || 0);
          acc.grossWeight += Number(product.GrossWeight || 0);
          acc.volume += Number(product.Volume || 0);
          acc.cargoReceivedDate = product.CargoRecDate;
          return acc;
        },
        {
          packageCount: 0,
          grossWeight: 0,
          volume: 0,
          cargoReceivedDate: null,
        },
      );

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch LCL Import Transhipment house jobs where cargo is received
    // ─────────────────────────────────────────────────────────────────────────
    const transhipmentHouseJobs = await this._db.houseJob.findMany({
      where: {
        CompanyMasterSid,
        BranchMasterSid: { in: resolvedBranchIds },
        JobType: 'Transhipment',
        departmentMaster: { ExportImport: 'Import', FCLLCL: 'LCL' },
        status: 'A',
        AND: [{ HBLDate: { lte: ToHblDt } }],
      },
      include: {
        masterJob: {
          where: { Status: 'A' },
          select: { MasterJobNumber: true, MBLNo: true },
        },
        bookingHeader: {
          where: { status: 'A' },
          select: { BookingNo: true },
        },
        Products: {
          where: { status: 'A' },
          select: {
            ExternlQty: true,
            GrossWeight: true,
            Volume: true,
            ContainerNo: true,
            MasterJobContainerSid: true,
            ExternaPkg: true,
            CargoRecDate: true,
          },
        },
        Others: {
          where: { status: 'A' },
          select: {
            Coloader: true,
          },
        },
        departmentMaster: {
          select: {
            departmentName: true,
            DepartmentMasterSid: true,
            ExportImport: true,
            FCLLCL: true,
          },
        },
      },
      orderBy: { HBLDate: 'asc' },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Fetch linked bookings (no MasterNoSid filter — we check it manually)
    // ─────────────────────────────────────────────────────────────────────────
    const transhipmentBookingIds = transhipmentHouseJobs
      .map((hj) => hj.TranshipmentBookingSid)
      .filter((sid): sid is number => !!sid);

    const transhipmentBookings = transhipmentBookingIds.length
      ? await this._db.bookingHeader.findMany({
          where: {
            BookingHeaderSid: { in: transhipmentBookingIds },
            status: 'A',
            // ← No MasterNoSid: null filter here — checked manually below
          },
          select: {
            BookingHeaderSid: true,
            BookingNo: true,
            BookingDateTime: true,
            BookingStatus: true,
            HBLNo: true,
            MBLNo: true,
            MasterNoSid: true, // ← required for null check
          },
        })
      : [];

    const transhipmentBookingBySid = new Map(
      transhipmentBookings.map((b) => [b.BookingHeaderSid, b]),
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Filter house jobs:
    //   Example 1 → TranshipmentBookingSid is null                  ✅ include
    //   Example 2 → TranshipmentBookingSid = 45,
    //               booking(BookingHeaderSid=45).MasterNoSid = null  ✅ include
    //               booking(BookingHeaderSid=45).MasterNoSid != null ❌ exclude
    // ─────────────────────────────────────────────────────────────────────────
    const houseJobRows = transhipmentHouseJobs
      .filter((houseJob) => {
        // Example 1: no booking linked yet
        if (!houseJob.TranshipmentBookingSid) {
          return true;
        }

        // Example 2: booking linked — include only if MasterNoSid is null
        const linkedBooking = transhipmentBookingBySid.get(
          houseJob.TranshipmentBookingSid,
        );
        return linkedBooking ? linkedBooking.MasterNoSid === null : false;
      })
      .flatMap((houseJob) => {
        const linkedBooking = houseJob.TranshipmentBookingSid
          ? transhipmentBookingBySid.get(houseJob.TranshipmentBookingSid)
          : null;

        const pendingReason = !houseJob.TranshipmentBookingSid
          ? 'Transhipment booking not created'
          : 'Export booking exists but master/export job not yet generated';

        const productsByContainer = new Map<
          string,
          {
            containerNo: string | null;
            masterJobContainerSid: number | null;
            products: any[];
          }
        >();
        const productsForGrouping = houseJob.Products?.length
          ? houseJob.Products
          : [null];

        productsForGrouping.forEach((product) => {
          const containerKey = product
            ? `${product.MasterJobContainerSid ?? 'no-sid'}-${product.ContainerNo ?? ''}`
            : 'no-products';

          let containerGroup = productsByContainer.get(containerKey);
          if (!containerGroup) {
            containerGroup = {
              containerNo: product?.ContainerNo ?? null,
              masterJobContainerSid: product?.MasterJobContainerSid ?? null,
              products: [],
            };
            productsByContainer.set(containerKey, containerGroup);
          }

          if (product) {
            containerGroup.products.push(product);
          }
        });

        return Array.from(productsByContainer.values()).map((containerGroup) => {
          const productSummary = summarizeProducts(containerGroup.products);
          const externaPkg =
            containerGroup.products
              .map((product) => product.ExternaPkg)
              .filter(Boolean)
              .join(', ') || null;

          return {
            reportType: 'Transhipment Cargo Received - Export Job Not Generated',
            HouseJobSid: houseJob.HouseJobSid,
            MasterJobSid: houseJob.MasterJobSid,
            BookingHeaderSid: linkedBooking?.BookingHeaderSid ?? null,
            BookingNo:
              linkedBooking?.BookingNo ?? houseJob.bookingHeader?.BookingNo ?? null,
            SourceBookingNo: houseJob.bookingHeader?.BookingNo ?? null,
            HBLDate: houseJob.HBLDate,
            HBLNo: houseJob.HBLNo,
            MBLNo: houseJob.masterJob?.MBLNo ?? houseJob.MBLNo ?? null,
            MasterJobNo: houseJob.masterJob?.MasterJobNumber ?? null,
            Vessel: houseJob.VesselName,
            VoyageNo: houseJob.VoyageNo,
            OriginAgent: houseJob.AgentName,
            ETA: houseJob.ETA,
            CargoReceivedDate: productSummary.cargoReceivedDate,
            POL: houseJob.POL,
            POD: houseJob.POD,
            FPD: houseJob.FPD,
            ExternaPkg: externaPkg,
            Coloader: houseJob.Others?.[0]?.Coloader ?? null,
            ContainerNo: containerGroup.containerNo,
            MasterJobContainerSid: containerGroup.masterJobContainerSid,
            PackageCount: productSummary.packageCount,
            GrossWeight: productSummary.grossWeight,
            Volume: productSummary.volume,
            BookingStatus: linkedBooking?.BookingStatus ?? null,
            pendingReason,
          };
        });
      });

    return {
      companyMasterSid: CompanyMasterSid,
      branchNames: resolvedBranchNames.join(', '),
      branchInvolved,
      data: houseJobRows,
      totalCount: houseJobRows.length,
      params,
    };
  } catch (error) {
    this.logger.error(
      `Error generating Transhipment Cargo Report: ${error.message}`,
      error.stack,
    );
    throw error;
  }
}

  // async getBranchNames(companyMasterSid:number,branchIds?:number[])
  // :Promise<{
  //   BranchMasterSid : number,
  //   branchName : string
  // }[]>
  // {
  //   try {
  //     const whereClause = {
  //       CompanyMasterSid : companyMasterSid,
  //       status : 'A'
  //     }
  //     if(branchIds){
  //       whereClause['BranchMasterSid'] = {in : branchIds}
  //     }
  //     const branches = await this._db.branchMaster.findMany({
  //       where : whereClause,
  //       select : {
  //         BranchMasterSid : true,
  //         branchName : true
  //       }
  //     })

  //     return branches;

  //   } catch (error) {
  //     throw error;
  //   }
  // }

  async getBranchNames(
    companyMasterSid: number,
    branchIds?: number[],
  ): Promise<{ BranchMasterSid: number; branchName: string }[]> {
    try {
      const whereClause: any = {
        CompanyMasterSid: companyMasterSid,
        status: 'A',
      };
      if (branchIds && branchIds.length > 0) {
        whereClause['BranchMasterSid'] = { in: branchIds };
      }
      const branches = await this._db.branchMaster.findMany({
        where: whereClause,
        select: {
          BranchMasterSid: true,
          branchName: true,
        },
      });
      return branches;
    } catch (error) {
      throw error;
    }
  }

  // Comprehensive Maganement Report
  async generateComprehensiveManagementReport(params: any) {
    const {
      FromDate,
      ToDate,
      companyId: CompanyMasterSid,
      Branch: BranchId,
      Dept: deptId,
    } = params;

    try {
      const branches =
        BranchId && BranchId.length > 0
          ? await this._db.branchMaster.findMany({
              where: { BranchMasterSid: { in: BranchId } },
              select: { BranchMasterSid: true, branchName: true },
            })
          : await this._db.branchMaster.findMany({
              where: { CompanyMasterSid },
              select: { BranchMasterSid: true, branchName: true },
            });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);
      const branchesInvolved =
        BranchId && BranchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';
      const departments =
        deptId && deptId.length > 0
          ? await this._db.departmentMaster.findMany({
              where: {
                DepartmentMasterSid: { in: deptId },
              },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: {
                CompanyMasterSid,
              },
              select: { DepartmentMasterSid: true, departmentName: true },
            });

      const resolvedDeptIds = departments.map((d) => d.DepartmentMasterSid);
      const resolvedDeptNames = departments
        .map((d) => d.departmentName)
        .join(', ');
      const departmentInvolved =
        deptId && deptId.length > 0
          ? departments.map((d) => d.departmentName).join(', ')
          : 'All Departments';
      // Booking data
      const bookingData = await this._db.bookingHeader.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { BookingDateTime: { gte: FromDate } },
            { BookingDateTime: { lte: ToDate } },
          ],
          status: 'A',
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        select: {
          bookingRates: {
            select: {
              RevenueLocalAmount: true,
              CostLocalAmount: true,
            },
          },
          DepartmentMasterSid: true,
          BookingHeaderSid: true,
          bookingCargo: {
            select: {
              NetWeight: true,
              GrossWeight: true,
              Volume: true,
            },
          },
        },
        orderBy: { BookingDateTime: 'asc' },
      });

      const allBookingDetails = bookingData.map((b) => {
        const totalGrossWt = (b.bookingCargo || []).reduce(
          (sum, cargo) => sum + Number(cargo.GrossWeight || 0),
          0,
        );
        const totalNetWt = (b.bookingCargo || []).reduce(
          (sum, cargo) => sum + Number(cargo.NetWeight || 0),
          0,
        );
        const totalVolume = (b.bookingCargo || []).reduce(
          (sum, cargo) => sum + Number(cargo.Volume || 0),
          0,
        );
        const totalRevenueLocalAmt = (b.bookingRates || []).reduce(
          (sum, rate) => sum + Number(rate.RevenueLocalAmount || 0),
          0,
        );
        const totalCostLocalAmt = (b.bookingRates || []).reduce(
          (sum, rate) => sum + Number(rate.CostLocalAmount || 0),
          0,
        );

        return {
          bookingSid: b.BookingHeaderSid,
          dept: b.DepartmentMasterSid,
          grossWt: totalGrossWt,
          netWt: totalNetWt,
          vol: totalVolume,
          revenueLocalAmt: totalRevenueLocalAmt,
          costLocalAmt: totalCostLocalAmt,
        };
      });

      const bookingDeptSummary = allBookingDetails.reduce(
        (acc, b) => {
          const dept =
            departments.find((d) => d.DepartmentMasterSid === b.dept)
              ?.departmentName || '';

          if (!acc[dept]) {
            acc[dept] = {
              dept,
              totalBookings: 0,
              totalGrossWt: 0,
              totalNetWt: 0,
              totalVolume: 0,
              totalRevenue: 0,
              totalCost: 0,
              totalProfit: 0,
            };
          }

          const row = acc[dept];

          row.totalBookings += 1;
          row.totalGrossWt += Number(b.grossWt || 0);
          row.totalNetWt += Number(b.netWt || 0);
          row.totalVolume += Number(b.vol || 0);
          row.totalRevenue += Number(b.revenueLocalAmt || 0);
          row.totalCost += Number(b.costLocalAmt || 0);
          row.totalProfit = row.totalRevenue - row.totalCost;

          return acc;
        },
        {} as Record<number, any>,
      );

      // ------------------------------------
      // Master Job data
      const masterJob = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { MasterJobDate: { gte: FromDate } },
            { MasterJobDate: { lte: ToDate } },
          ],
          Status: 'A',
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        select: {
          DepartmentMasterSid: true,
          GrossWeight: true,
          NetWeight: true,
          Volume: true,
          // containers: true,
          MenuMasterSid: true,
          MasterJobSid: true,
          houseJob: {
            where: { status: 'A' },
            select: {
              Products: {
                where: { status: 'A' },
                select: {
                  MasterJobContainerSid: true,
                },
              },
            },
          },
          containers: {
            where: { Status: 'A' },
            include: {
              containerType: {
                select: {
                  ContainerSize: true,
                  NoOfTeu: true,
                },
              },
            },
          },
        },
        orderBy: { MasterJobDate: 'asc' },
      });

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true },
      });

      const containerTypeMap = new Map(
        containerTypesMaster.map((ct) => [
          ct.ContainerTypeMasterSid,
          ct.ContainerSize,
        ]),
      );

      const masterWithCR = await Promise.all(
        masterJob.map(async (m) => {
          const masterContainerSid = m.containers?.[0]?.MasterJobContainerSid;

          const containerInfo = (m.containers || [])
            .filter((c) => c.MasterJobContainerSid === masterContainerSid)
            .map((c) => {
              const containerTypeId = c.ContainerType;
              return {
                containerNumber: c.ContainerNumber,
                containerType:
                  containerTypeId != null
                    ? containerTypeMap.get(containerTypeId) ||
                      `Unknown(${containerTypeId})`
                    : '',
              };
            });
          const containerSize = ["20'", "40'", "45'"];

          const containerCountByType: Record<string, number> = {};
          let totalNoOfTEU = 0;
          let numberOfFourtyFt = 0;
          let numberofFurtyFive = 0;
          let numberOfTwentyFt = 0;
          containerSize.forEach((col) => (containerCountByType[col] = 0));

          const uniqueContainerMap = new Map<
            number,
            {
              teu: number;
              size: string;
            }
          >();
          const houseProducts = m.houseJob.flatMap((h) => h.Products || []);

          houseProducts.forEach((hp) => {
            if (!hp.MasterJobContainerSid) return;

            const masterContainer = (m.containers || []).find(
              (c) => c.MasterJobContainerSid === hp.MasterJobContainerSid,
            );

            if (
              masterContainer &&
              !uniqueContainerMap.has(masterContainer.MasterJobContainerSid)
            ) {
              uniqueContainerMap.set(masterContainer.MasterJobContainerSid, {
                teu: Number(masterContainer.containerType?.NoOfTeu || 0),
                size: masterContainer.containerType?.ContainerSize?.trim() || '',
              });
            }
          });

          Array.from(uniqueContainerMap.values()).forEach((container) => {
            totalNoOfTEU += container.teu;

            const size = container.size;

            if (size === '20') numberOfTwentyFt++;
            if (size === '40') numberOfFourtyFt++;
            if (size === '45') numberofFurtyFive++;
          });

          const relatedCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: m.MenuMasterSid!,
              TransactionSid: m.MasterJobSid,
              status: 'A',
            },
            select: {
              CostLocalAmount: true,
              RevenueLocalAmount: true,
            },
          });

          const totalRevenue = relatedCR.reduce(
            (s, r) => s + Number(r.RevenueLocalAmount || 0),
            0,
          );

          const totalCost = relatedCR.reduce(
            (s, r) => s + Number(r.CostLocalAmount || 0),
            0,
          );

          return {
            ...m,
            totalRevenue,
            totalCost,
            totalNoOfTEU,
          };
        }),
      );

      const reportMap = masterWithCR.reduce(
        (acc, m) => {
          const dept =
            departments.find(
              (d) => d.DepartmentMasterSid == m.DepartmentMasterSid,
            )?.departmentName || '';

          if (!acc[dept]) {
            acc[dept] = {
              Department: dept,
              NoOfMasterJobs: 0,
              Revenue: 0,
              Cost: 0,
              Profit: 0,
              GrossWeight: 0,
              NetWeight: 0,
              CBM: 0,
              TEU: 0,
            };
          }

          const row = acc[dept];

          row.NoOfMasterJobs += 1;
          row.Revenue += Number(m.totalRevenue || 0);
          row.Cost += Number(m.totalCost || 0);
          row.GrossWeight += Number(m.GrossWeight || 0);
          row.NetWeight += Number(m.NetWeight || 0);
          row.CBM += Number(m.Volume || 0);
          row.TEU += Number(m.totalNoOfTEU || 0);

          row.Profit = row.Revenue - row.Cost;

          return acc;
        },
        {} as Record<number, any>,
      );

      // House Job Data ------------------------------------------

      const houseData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [{ HBLDate: { gte: FromDate } }, { HBLDate: { lte: ToDate } }],
          status: 'A',
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        select: {
          DepartmentMasterSid: true,
          Cargo: {
            select: {
              GrossWeight: true,
              NetWeight: true,
              Volume: true,
            },
          },
          MenuMasterSid: true,
          HouseJobSid: true,
        },
        orderBy: { HBLDate: 'asc' },
      });

      const housewithrate = await Promise.all(
        houseData.map(async (m) => {
          const relatedCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: m.MenuMasterSid!,
              TransactionSid: m.HouseJobSid,
              status: 'A',
            },
            select: {
              CostLocalAmount: true,
              RevenueLocalAmount: true,
            },
          });

          const totalRevenue = relatedCR.reduce(
            (s, r) => s + Number(r.RevenueLocalAmount || 0),
            0,
          );

          const totalCost = relatedCR.reduce(
            (s, r) => s + Number(r.CostLocalAmount || 0),
            0,
          );

          return {
            ...m,
            totalRevenue,
            totalCost,
          };
        }),
      );

      const houseWithAllCal = housewithrate.reduce(
        (acc, m) => {
          const dept =
            departments.find(
              (d) => d.DepartmentMasterSid === m.DepartmentMasterSid,
            )?.departmentName || '';

          if (!acc[dept]) {
            acc[dept] = {
              Department: dept,
              NoOfHouseJobs: 0,
              Revenue: 0,
              Cost: 0,
              Profit: 0,
              GrossWeight: 0,
              NetWeight: 0,
              CBM: 0,
              TEUs: 0,
            };
          }

          const row = acc[dept];

          row.NoOfHouseJobs += 1;
          row.Revenue += Number(m.totalRevenue || 0);
          row.Cost += Number(m.totalCost || 0);
          row.GrossWeight += Number(m.Cargo?.[0]?.GrossWeight || 0);
          row.NetWeight += Number(m.Cargo?.[0]?.NetWeight || 0);
          row.CBM += Number(m.Cargo?.[0]?.Volume || 0);

          // optional
          // row.TEUs += Number(m.containers || 0);

          row.Profit = row.Revenue - row.Cost;

          return acc;
        },
        {} as Record<number, any>,
      );

      // salesman Performance

      const allSalesman = await this._db.userMaster.findMany({
        where: {
          userCompanyMaster: {
            some: { CompanyMasterSid },
          },
        },
        select: {
          UserMasterSid: true,
          userName: true,
        },
      });

      const quotationCount = await this._db.quoteHeader.groupBy({
        where: {
          CompanyMasterSid,
          AND: [
            { QuoteDate: { gte: FromDate } },
            { QuoteDate: { lte: ToDate } },
          ],
          // DepartmentMasterSid: { in: resolvedDeptIds },
          BranchMasterSid: { in: resolvedBranchIds },
          SalesmanSid: { not: null },
        },
        by: ['SalesmanSid', 'DepartmentMasterSid'],
        _count: { _all: true },
      });

      const enquiryCount = await this._db.enquiryHeader.groupBy({
        where: {
          CompanyMasterSid,
          EnquiryDate: { gte: FromDate, lte: ToDate },
          DepartmentMasterSid: { in: resolvedDeptIds },
          BranchMasterSid: { in: resolvedBranchIds },
          UserMasterSid: { not: null },
        },
        by: ['UserMasterSid', 'DepartmentMasterSid'],
        _count: { _all: true },
      });

      const bookingCount = await this._db.bookingHeader.groupBy({
        where: {
          CompanyMasterSid,
          BookingDateTime: { gte: FromDate, lte: ToDate },
          DepartmentMasterSid: { in: resolvedDeptIds },
          BranchMasterSid: { in: resolvedBranchIds },
          SalesmanSid: { not: null },
        },
        by: ['SalesmanSid', 'DepartmentMasterSid'],
        _count: { _all: true },
      });

      const leadCount = await this._db.preCustomerMaster.groupBy({
        by: ['leadAssignTo'],
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          leadAssignTo: { not: null },
        },
        _count: {
          leadAssignTo: true,
        },
      });

      const opportunity = await this._db.preCustomerMaster.groupBy({
        by: ['leadAssignTo'],
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          leadAssignTo: { not: null },
        },
        _count: {
          leadAssignTo: true,
          isQualify: true,
        },
      });

      const meetingCount = await this._db.preCustomerMeeting.groupBy({
        by: ['leadAssignTo'],
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
        },
        _count: {
          leadAssignTo: true,
        },
      });

      const makeKey = (sid: number) => `${sid}`;

      const quotationMap = new Map<number, number>();

      quotationCount.forEach((q) => {
        if (q.SalesmanSid !== null) {
          quotationMap.set(Number(q.SalesmanSid), q._count._all);
        }
      });

      const enquiryMap = new Map<number, number>();
      enquiryCount.forEach((e) => {
        if (e.UserMasterSid !== null) {
          const prev = enquiryMap.get(e.UserMasterSid) || 0;
          enquiryMap.set(e.UserMasterSid, prev + e._count._all);
        }
      });

      const bookingMap = new Map<number, number>();
      bookingCount.forEach((b) => {
        if (b.SalesmanSid) {
          const prev = bookingMap.get(b.SalesmanSid) || 0;
          bookingMap.set(b.SalesmanSid, prev + b._count._all);
        }
      });

      const leadMap = new Map<number, number>();
      leadCount.forEach((l) => {
        if (l.leadAssignTo) {
          leadMap.set(l.leadAssignTo, l._count.leadAssignTo);
        }
      });

      const meetingMap = new Map<number, number>();
      meetingCount.forEach((m) => {
        if (m.leadAssignTo) {
          meetingMap.set(m.leadAssignTo, m._count.leadAssignTo);
        }
      });

      const opportunityMap = new Map<number, number>();
      opportunity.forEach((o) => {
        if (o.leadAssignTo) {
          opportunityMap.set(o.leadAssignTo, o._count.leadAssignTo);
        }
      });

      const departmentMap = new Map(
        departments.map((d) => [d.DepartmentMasterSid, d.departmentName]),
      );

      const salesmanSummary: any[] = [];

      for (const user of allSalesman) {
        const q = quotationMap.get(user.UserMasterSid) || 0;
        const e = enquiryMap.get(user.UserMasterSid) || 0;
        const b = bookingMap.get(user.UserMasterSid) || 0;
        const l = leadMap.get(user.UserMasterSid) || 0;
        const m = meetingMap.get(user.UserMasterSid) || 0;
        const o = opportunityMap.get(user.UserMasterSid) || 0;

        salesmanSummary.push({
          SalesmanSid: user.UserMasterSid,
          SalesmanName: user.userName,
          TotalQuotations: q,
          TotalEnquiries: e,
          TotalBookings: b,
          TotalLeads: l,
          TotalMeetings: m,
          TotalOpportunity: o,
        });
      }

      // -------Customer O/S------------

      const coa = await this._db.cOAMaster.findFirst({
        where: { CompanyMasterSid, Status: 'A' },
        select: { LedgerName: true, COAMasterSid: true },
      });

      const toDateObj = new Date(ToDate);

      const vouchers = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: { lte: toDateObj },
          subledgerMaster: {
            is: {
              Status: 'A',
              SubledgerType: 'Customer',
            },
          },
          coaMaster:{
            is:{
              LedgerType:"Sy Dr",
              Status:'A'
            }
          },
          Status: 'A',
        },
        include: {
          VoucherHeader: {
            select: {
              Salesman: true,
            },
          },
          subledgerMaster: {
            select: {
              SubledgerMasterSid: true,
              SubledgerName: true,
              SubledgerType: true,
            },
          },
          voucherMatchings: {
            where: { Status: 'A' , VoucherMatchingDate:{lte:toDateObj}},
          },
        },

        orderBy: [{ VoucherDate: 'asc' }],
      });

      const reportData = vouchers.map((v) => {
        const matchLocal = v.voucherMatchings.reduce(
          (acc, m) =>
            acc + (m.DrCr === 'D' ? toNumber(m.LocalAmount) : -toNumber(m.LocalAmount)),
          0,
        );
        const matchCurr = v.voucherMatchings.reduce(
          (acc, m) =>
            acc + (m.DrCr === 'D' ? toNumber(m.Amount) : -toNumber(m.Amount)),
          0,
        );

        const ageing =
          Math.floor(
            (+toDateObj - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24),
          ) + 1;

        const osCurrencyAmount = toNumber(v.Amount) - Math.abs(matchCurr);
        const osLocalAmount = toNumber(v.LocalAmount) - Math.abs(matchLocal);
        const drCr = v.DrCr?.trim().toUpperCase();
        const signedOSLocal = drCr === 'C' ? -osLocalAmount : osLocalAmount;

        return {
          VoucherTransactionSid: v.VoucherTransactionSid,
          SubledgerMasterSid: v.subledgerMaster?.SubledgerMasterSid,
          LedgerName: coa?.LedgerName,
          SubledgerName: v.subledgerMaster?.SubledgerName,
          LedgerMasterSid: v.LedgerMasterSid,
          VoucherDate: v.VoucherDate,
          CurrencyCode: v.CurrencyCode,
          Salesman: v.VoucherHeader?.Salesman,
          DrCr: v.DrCr,
          Ageing: ageing,
          OriginalCurrAmount: toNumber(v.Amount),
          OriginalLocalAmount: toNumber(v.LocalAmount),
          OSCurrencyAmount: osCurrencyAmount,
          OSLocalAmount: osLocalAmount,
          SignedOSLocal: signedOSLocal,
          OnAccountCreditCurr:
            v.DrCr === 'C' ? osCurrencyAmount : 0,
          OnAccountCreditLocal:
            v.DrCr === 'C' ? osLocalAmount : 0,
        };
      });

      const bucketRanges = [30, 60, 90, 120];
      const bucketLabels = ['0-30', '31-60', '61-90', '91-120', '120 & Above'];
      const customerRowsMap = new Map<number, any>();
      reportData.forEach((row) => {
        const subId = row.SubledgerMasterSid;
        if (!subId) return;

        if (!customerRowsMap.has(subId)) {
          customerRowsMap.set(subId, {
            SubledgerName: row.SubledgerName,
            SalesmanName: row.Salesman || '',
            TotalOutstanding: 0,
            buckets: {
              '0-30': 0,
              '31-60': 0,
              '61-90': 0,
              '91-120': 0,
              '120 & Above': 0,
            },
            CreditDays: 0,
            CreditLimit: 0,
          });
        }

        const customer = customerRowsMap.get(subId);

        // Determine bucket
        let bucket = '120 & Above';
        for (let i = 0; i < bucketRanges.length; i++) {
          if (row.Ageing <= bucketRanges[i]) {
            bucket = bucketLabels[i];
            break;
          }
        }

        // Sum amounts
        const signedOSLocal = toNumber(row.SignedOSLocal);
        customer.TotalOutstanding += signedOSLocal;
        customer.buckets[bucket] += signedOSLocal;
      });

      const customerRows = Array.from(customerRowsMap.values());
      // ----Bank/Cash----
      const cashBankTxns = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          // DepartmentMasterSid: { in: resolvedDeptIds },
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } },
          ],
          VoucherHeader : {
            PostStatus : 'P'
          },
          Status: 'A',
          coaMaster: {
            LedgerType: {
              in: ['Bank', 'Cash'],
            },
          },
        },
        include: {
          VoucherHeader: {
            select: {
              CashOrBank: true,
            },
          },
          coaMaster: true,
        },
        orderBy: { VoucherDate: 'asc' },
      });

      const coaMap = new Map<number, any>();

      cashBankTxns.filter((vt) => vt.coaMaster).forEach((vt) => {
        if (!vt.coaMaster) return;

        const pkey = vt.coaMaster.COAMasterSid;

        if (!coaMap.has(pkey)) {
          coaMap.set(pkey, {
            COAMasterSid: pkey,
            LedgerName: vt.coaMaster.LedgerName,
            Account: '',
            DrAmount: 0,
            CrAmount: 0,
            Balance: 0,
          });
        }

        const customer = coaMap.get(pkey);
        // });

          const drAmount = vt.DrCr === 'D' ? Number(vt.LocalAmount) : 0;
          const crAmount = vt.DrCr === 'C' ? Number(vt.LocalAmount) : 0;

          customer.DrAmount += drAmount;
          customer.CrAmount += crAmount;
          customer.Balance += drAmount - crAmount;

          if (!customer.Account) {
            customer.Account = vt?.coaMaster?.LedgerName || '';
          }
      });

      const AllCashAndBank = Array.from(coaMap.values());
    
      // ----Vendor Os ---------
      const vendorOsVouchers = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          VoucherDate: { lte: toDateObj },
          subledgerMaster: {
            is: {
              Status: 'A',
              SubledgerType: 'Customer',
            },
          },
          coaMaster:{
            is:{
              LedgerType:'Sy Cr',
              Status:'A'
            }
          },
          Status: 'A',
          // voucherTypeMaster: {
          //   DocumentTypeCode: 'VIN',
          // },
        },
        include: {
          subledgerMaster: {
            select: {
              SubledgerName: true,
              SubledgerType: true,
              SubledgerMasterSid: true,
            },
          },
          voucherMatchings: {
            where: { Status: 'A' , VoucherMatchingDate:{lte:toDateObj}},
          },
        },
        orderBy: { VoucherDate: 'asc' },
      });

      const vendorReportData = vendorOsVouchers.map((v) => {
        const matchLocal = v.voucherMatchings.reduce(
          (acc, m) => acc + toNumber(m.LocalAmount),
          0,
        );

        const ageing =
          Math.floor(
            (+toDateObj - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24),
          ) + 1;

        const osLocalAmount = toNumber(v.LocalAmount) - matchLocal;
        const drCr = v.DrCr?.trim().toUpperCase();
        const signedOSLocal = drCr === 'C' ? -osLocalAmount : osLocalAmount;

        return {
          SubledgerMasterSid: v.subledgerMaster?.SubledgerMasterSid,
          SubledgerName: v.subledgerMaster?.SubledgerName,
          Ageing: ageing,
          OSLocalAmount: osLocalAmount,
          SignedOSLocal: signedOSLocal,
        };
      });

      const vendorRowsMap = new Map<number, any>();

      vendorReportData.forEach((row) => {
        const subId = row.SubledgerMasterSid;
        if (!subId) return;

        if (!vendorRowsMap.has(subId)) {
          vendorRowsMap.set(subId, {
            SubledgerName: row.SubledgerName,
            TotalOutstanding: 0,
            buckets: {
              '0-30': 0,
              '31-60': 0,
              '61-90': 0,
              '91-120': 0,
              '120 & Above': 0,
            },
            CreditDays: 0,
            CreditLimit: 0,
          });
        }

        const vendor = vendorRowsMap.get(subId);

        let bucket = '120 & Above';
        for (let i = 0; i < bucketRanges.length; i++) {
          if (row.Ageing <= bucketRanges[i]) {
            bucket = bucketLabels[i];
            break;
          }
        }

        const signedOSLocal = toNumber(row.SignedOSLocal);
        vendor.TotalOutstanding += signedOSLocal;
        vendor.buckets[bucket] += signedOSLocal;
      });

      const vendorRows = Array.from(vendorRowsMap.values());

      const subledgerIds = Array.from(vendorRowsMap.keys());

      const subledgers = await this._db.subledgerMaster.findMany({
        where: {
          SubledgerMasterSid: { in: subledgerIds },
          SubledgerType: 'Customer',
          Status: 'A',
        },
        select: {
          SubledgerMasterSid: true,
          SubledgerMappingSid: true,
        },
      });

      const subledgerToCustomerMap = new Map<number, number>();

      for (const s of subledgers) {
        if (s.SubledgerMappingSid) {
          subledgerToCustomerMap.set(
            s.SubledgerMasterSid,
            s.SubledgerMappingSid,
          );
        }
      }

      const customerIds = Array.from(subledgerToCustomerMap.values());

      const customers = await this._db.customerMaster.findMany({
        where: {
          CustomerMasterSid: { in: customerIds },
        },
        include: {
          customerCreditRequest: {
            where: {
              ApprovalStatus: ApprovalStatus.Approved,
              Status: 'A',
            },
          },
        },
      });

      const customerCreditMap = new Map<
        number,
        { CreditDays: number; CreditLimit: number }
      >();

      for (const customer of customers) {
        let CreditDays = 0;
        let CreditLimit = 0;

        if (
          customer.CashCredit !== 'C' &&
          customer.customerCreditRequest.length > 0
        ) {
          const reqWithHighestLimit = customer.customerCreditRequest.reduce(
            (acc, req) => (req.CreditLimit > acc.CreditLimit ? req : acc),
          );

          CreditDays = reqWithHighestLimit.CreditDays;
          CreditLimit = reqWithHighestLimit.CreditLimit;
        }

        customerCreditMap.set(customer.CustomerMasterSid, {
          CreditDays,
          CreditLimit,
        });
      }

      const subledgerCreditMap = new Map<
        number,
        { CreditDays: number; CreditLimit: number }
      >();

      for (const [
        subledgerId,
        customerId,
      ] of subledgerToCustomerMap.entries()) {
        const credit = customerCreditMap.get(customerId) ?? {
          CreditDays: 0,
          CreditLimit: 0,
        };
        subledgerCreditMap.set(subledgerId, credit);
      }

      vendorRowsMap.forEach((vendor, subledgerId) => {
        const credit = subledgerCreditMap.get(subledgerId);

        vendor.CreditDays = credit?.CreditDays ?? 0;
        vendor.CreditLimit = credit?.CreditLimit ?? 0;
      });

      return {
        bookingDeptSummary,
        reportMap,
        houseWithAllCal,
        salesmanSummary,
        customerRows,
        AllCashAndBank,
        vendorRows,
        resolvedDeptNames,
        resolvedBranchNames,
        branchesInvolved,
        departmentInvolved,
        params,
      };
    } catch (error) {
      throw error;
    }
  }

  // Tradelane Profitability
  async generateTradelaneProfitability(
    params: tradelaneProfitabilityReportQueryDto,
  ) {
    const {
      FromDate,
      ToDate,
      Branch: branhId,
      companyId: CompanyMasterSid,
      POL,
      POD,
      WithProrate
    } = params;
    const prorateEnabled =
      WithProrate ??
      (params as any).withProrate ??
      (params as any)['With Pro Rate'] ??
      (params as any).WithProRate ??
      false;

    try {
      let polCode: string | undefined;
      let podCode: string | undefined;
      let polName: string | undefined;
      let podName: string | undefined;
      // Take MenuMasterSid of Master Air Waybill -[168] , House Air Waybill [178]

      const houseAirWaybillMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Air Waybill', status: 'A' },
        select: { MenuMasterSid: true },
      });

      const masterAirWaybillMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'Master Air Waybill', status: 'A' },
        select: { MenuMasterSid: true },
      });

      const excludedMenuId = [
        houseAirWaybillMenu?.MenuMasterSid,
        masterAirWaybillMenu?.MenuMasterSid,
      ].filter(Boolean) as number[];

      if (excludedMenuId.length === 0) {
        throw new BadRequestException('Air MenuMasterSid not found');
      }

      if (POL) {
        const polRow = await this._db.portMaster.findFirst({
          where: { PortMasterSid: Number(POL) },
          select: { PortCode: true, PortName: true },
        });
        polCode = polRow?.PortCode;
        polName = polRow?.PortName;
      }

      if (POD) {
        const podRow = await this._db.portMaster.findFirst({
          where: { PortMasterSid: Number(POD) },
          select: { PortCode: true, PortName: true },
        });
        podCode = podRow?.PortCode;
        podName = podRow?.PortName;
      }

    const ports = await this._db.portMaster.findMany({
      select: {
        PortCode: true,
        PortName: true,
        },
      });

      const portMap = new Map<string, string>();

      ports.forEach((p) => {
        portMap.set(p.PortCode, p.PortName);
      });

      const branches = await this._db.branchMaster.findMany({
        where: { CompanyMasterSid },
        select: {
          BranchMasterSid: true,
          branchName: true,
        },
      });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const resolvedBranchNames = branches.map((b) => b.branchName);

      const whereCondition: any = {
        CompanyMasterSid,
        BranchMasterSid: { in: resolvedBranchIds },
      };

      if (polCode) whereCondition.POL = polCode;
      if (podCode) whereCondition.POD = podCode;

      

      const bookingData = await this._db.bookingHeader.findMany({
        where: {
          ...whereCondition,
          departmentMaster: {
            departmentType: { not: 'Air' },
          },
          status: 'A',
          AND: [
            { BookingDateTime: { gte: FromDate } },
            { BookingDateTime: { lte: ToDate } },
          ],
        },
        include: {
          bookingCargo: true,
          bookingRates: {
            where: {
              Status: 'A',
            },
          },
        },
        orderBy: { BookingDateTime: 'asc' },
      });

      const houseJob = await this._db.houseJob.findMany({
        where: {
          ...whereCondition,
          MenuMasterSid: { notIn: excludedMenuId },
          AND: [{ HBLDate: { gte: FromDate } }, { HBLDate: { lte: ToDate } }],
          status: 'A',
        },
        include: {
          Cargo: true,
        },
        orderBy: {
          HBLDate: 'asc',
        },
      });

      const houseJobIds: number[] = [];
      houseJob.forEach((h) => {
        if (h.HouseJobSid) {
          houseJobIds.push(h.HouseJobSid);
        }
      });

      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job', status: 'A' },
        select: { MenuMasterSid: true },
      });

      if (!houseJobMenu) {
        throw new BadRequestException('House Job menu not found');
      }

      const allHouseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: houseJobMenu.MenuMasterSid,
          TransactionSid: { in: houseJobIds },
          status: 'A',
        },
      });

      const houseRateMap = new Map<number, any[]>();
      allHouseCR.forEach((cr) => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      if (prorateEnabled) {
        const houseMasterJobIds = Array.from(
          new Set(
            houseJob
              .map((h) => h.MasterJobSid)
              .filter((sid): sid is number => typeof sid === 'number'),
          ),
        );

        if (houseMasterJobIds.length > 0) {
          const jobToSubjobMasters = await this._db.masterJobOthers.findMany({
            where: {
              MasterJobSid: { in: houseMasterJobIds },
              Status: 'A',
              JobtoSubjob: 'Y',
            },
            select: {
              MasterJobSid: true,
            },
          });

          for (const { MasterJobSid } of jobToSubjobMasters) {
            const anyHouse = houseJob.find((h) => h.MasterJobSid === MasterJobSid);

            if (!anyHouse?.CompanyMasterSid || !anyHouse?.BranchMasterSid) {
              continue;
            }

            const proRateData = await this.proRateService.calculateProRate({
              CompanyMasterSid: anyHouse.CompanyMasterSid,
              BranchMasterSid: anyHouse.BranchMasterSid,
              MasterJobSid,
            });

            for (const proratedHouse of proRateData.houses || []) {
              const houseJobSid = proratedHouse.houseJob?.HouseJobSid;

              if (!houseJobSid) {
                continue;
              }

              if (!houseRateMap.has(houseJobSid)) {
                houseRateMap.set(houseJobSid, []);
              }

              for (const charge of proratedHouse.proratedCharges || []) {
                houseRateMap.get(houseJobSid)!.push({
                  TransactionSid: houseJobSid,
                  RevenueLocalAmount: Number(charge.revenueLocalAmount || 0),
                  CostLocalAmount: Number(charge.costLocalAmount || 0),
                });
              }
            }
          }
        }
      }

      //  master job
      const masterJob = await this._db.masterJob.findMany({
        where: {
          ...whereCondition,
          MenuMasterSid: { notIn: excludedMenuId },
          AND: [{ MBLDate: { gte: FromDate } }, { MBLDate: { lte: ToDate } }],
          Status: 'A',
        },
        include: {
          containers: true,
        },
        orderBy: {
          MBLDate: 'asc',
        },
      });

      const masterJobIds: number[] = [];
      masterJob.forEach((h) => {
        if (h.MasterJobSid) {
          masterJobIds.push(h.MasterJobSid);
        }
      });

      const masterJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'Master Job', status: 'A' },
        select: { MenuMasterSid: true },
      });

      if (!masterJobMenu) {
        throw new BadRequestException('Master Job menu not found');
      }

      const allMasterCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: masterJobMenu.MenuMasterSid,
          TransactionSid: { in: masterJobIds },
          status: 'A',
        },
      });

      const masterRateMap = new Map<number, any[]>();
      allMasterCR.forEach((cr) => {
        if (!masterRateMap.has(cr.TransactionSid!)) {
          masterRateMap.set(cr.TransactionSid!, []);
        }
        masterRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      const AllMasterJob = masterJob.map((m) => {
        const crList = masterRateMap.get(m.MasterJobSid) || [];
        const revenue = crList.reduce(
          (sum, r) => sum + Number(r.RevenueLocalAmount || 0),
          0,
        );
        const cost = crList.reduce(
          (sum, r) => sum + Number(r.CostLocalAmount || 0),
          0,
        );
        return {
          screen: 'Master Job',
          masterJobSid: m.MasterJobSid,
          jobNo: m.MasterJobNumber,
          MBLNo: m.MBLNo,
          MasterDate : m.MBLDate,
          POL: m.POL,
          POLName: portMap.get(m.POL) || '',
          POD: m.POD,
          PODName: portMap.get(m.POD) || '',
          grossWt: m.GrossWeight,
          netWt: m.NetWeight,
          vol: m.Volume,
          revenueLocalAmt: revenue,
          costLocalAmt: cost,
          profit: revenue - cost,
        };
      });

      const AllHouseJob = houseJob.map((h) => {
        const crList = houseRateMap.get(h.HouseJobSid) || [];

        const revenue = crList.reduce(
          (sum, r) => sum + Number(r.RevenueLocalAmount || 0),
          0,
        );

        const cost = crList.reduce(
          (sum, r) => sum + Number(r.CostLocalAmount || 0),
          0,
        );

        const grossweight = h.Cargo.reduce(
          (sum, c) => sum + toNumber(c.GrossWeight),
          0,
        );
        const netwt = h.Cargo.reduce(
          (sum, c) => sum + toNumber(c.NetWeight),
          0,
        );
        const vol = h.Cargo.reduce((sum, c) => sum + toNumber(c.Volume), 0);
        return {
          HBLNo: h.HBLNo,
          HouseDate:h.HBLDate,
          HouseJobSid: h.HouseJobSid,
          POL: h.POL,
          POLName: portMap.get(h.POL) || '',
          POD: h.POD,
          PODName: portMap.get(h.POD) || '',
          grossWt: grossweight,
          netWt: netwt,
          vol: vol,
          revenueLocalAmt: revenue,
          costLocalAmt: cost,
          profit: revenue - cost,
        };
      });

      const AllBooking = bookingData.map((b) => {
        const grossWt =
          b.bookingCargo?.reduce(
            (sum, c) => sum + Number(c.GrossWeight || 0),
            0,
          ) || 0;
        const netWt =
          b.bookingCargo?.reduce(
            (sum, c) => sum + Number(c.NetWeight || 0),
            0,
          ) || 0;
        const vol =
          b.bookingCargo?.reduce((sum, c) => sum + Number(c.Volume || 0), 0) ||
          0;

        const revenue = (b.bookingRates || []).reduce(
          (sum, r) => sum + Number(r.RevenueLocalAmount || 0),
          0,
        );
        const cost = (b.bookingRates || []).reduce(
          (sum, r) => sum + Number(r.CostLocalAmount || 0),
          0,
        ); 

        return {
          bookingNo: b.BookingNo,
          BookingDate:b.BookingDateTime,
          BookingSid: b.BookingHeaderSid,
          POL: b.POL,
          POLName: portMap.get(b.POL) || '',
          POD: b.POD,
          PODName: portMap.get(b.POD) || '',
          grossWt,
          netWt,
          vol,
          revenueLocalAmt: revenue,
          costLocalAmt: cost,
          profit: revenue - cost,
        };
      });

      const routeMap = new Map<string, any>();

      // --- Add Booking Data ---
      AllBooking.forEach((item) => {
       const routeKey = `${item.POLName} (${item.POL}) - ${item.PODName} (${item.POD})`;

        if (!routeMap.has(routeKey)) {
          routeMap.set(routeKey, {
            route: routeKey,
            bookingRows: [],
            masterRows: [],
            houseRows: [],
            bookingTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
            masterTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
            houseTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
          });
        }

        const group = routeMap.get(routeKey);

        // Ensure totals exist
        group.bookingTotals ||= {
          revenue: 0,
          cost: 0,
          profit: 0,
          grossWt: 0,
          netWt: 0,
          vol: 0,
        };

        group.bookingRows.push(item);
        group.bookingTotals.revenue += Number(item.revenueLocalAmt || 0);
        group.bookingTotals.cost += Number(item.costLocalAmt || 0);
        group.bookingTotals.profit += Number(item.profit || 0);
        group.bookingTotals.grossWt += Number(item.grossWt || 0);
        group.bookingTotals.netWt += Number(item.netWt || 0);
        group.bookingTotals.vol += Number(item.vol || 0);
      });

      // --- Add Master Job Data ---
      AllMasterJob.forEach((item) => {
        const routeKey = `${item.POLName} (${item.POL}) - ${item.PODName} (${item.POD})`;

        if (!routeMap.has(routeKey)) {
          routeMap.set(routeKey, {
            route: routeKey,
            bookingRows: [],
            masterRows: [],
            houseRows: [],
            bookingTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
            masterTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
            houseTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
          });
        }

        const group = routeMap.get(routeKey);

        // Ensure masterTotals exists
        group.masterTotals ||= {
          revenue: 0,
          cost: 0,
          profit: 0,
          grossWt: 0,
          netWt: 0,
          vol: 0,
        };

        group.masterRows.push(item);
        group.masterTotals.revenue += Number(item.revenueLocalAmt || 0);
        group.masterTotals.cost += Number(item.costLocalAmt || 0);
        group.masterTotals.profit += Number(item.profit || 0);
        group.masterTotals.grossWt += Number(item.grossWt || 0);
        group.masterTotals.netWt += Number(item.netWt || 0);
        group.masterTotals.vol += Number(item.vol || 0);
      });

      // --- Add House Job Data ---
      AllHouseJob.forEach((item) => {
        const routeKey = `${item.POLName} (${item.POL}) - ${item.PODName} (${item.POD})`;

        if (!routeMap.has(routeKey)) {
          routeMap.set(routeKey, {
            route: routeKey,
            bookingRows: [],
            masterRows: [],
            houseRows: [],
            bookingTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
            masterTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
            houseTotals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            },
          });
        }

        const group = routeMap.get(routeKey);

        // Ensure houseTotals exists
        group.houseTotals ||= {
          revenue: 0,
          cost: 0,
          profit: 0,
          grossWt: 0,
          netWt: 0,
          vol: 0,
        };

        group.houseRows.push(item);
        group.houseTotals.revenue += Number(item.revenueLocalAmt || 0);
        group.houseTotals.cost += Number(item.costLocalAmt || 0);
        group.houseTotals.profit += Number(item.profit || 0);
        group.houseTotals.grossWt += Number(item.grossWt || 0);
        group.houseTotals.netWt += Number(item.netWt || 0);
        group.houseTotals.vol += Number(item.vol || 0);
      });

      // Final Output
      const groupedRoutes = Array.from(routeMap.values());
      const displayPOL = polCode ? `${polCode} - ${polName}` : 'All';
      const displayPOD = podCode ? `${podCode} - ${podName}` : 'All';
      return {
        params,
        resolvedBranchNames,
        filters: {
          POL: displayPOL,
          POD: displayPOD,
        },
        groupedRoutes,
      };
    } catch (error) {
      throw error;
    }
  }

  // Freight MoM Growth Report
  async generateFreightMoMGrowthReport(params: any) {
    const {
      FromDate,
      ToDate,
      companyId: CompanyMasterSid,
    } = params;

    try {
      const toUTCDate = (d: Date) =>
        new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

      const getLastDayOfMonth = (year: number, month: number) =>
        new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

      const getPreviousMonthRange = (from: Date, to: Date) => {
        const y = from.getUTCFullYear();
        const m = from.getUTCMonth();

        const prevYear = m === 0 ? y - 1 : y;
        const prevMonth = m === 0 ? 11 : m - 1;

        const lastDayPrevMonth = getLastDayOfMonth(prevYear, prevMonth);

        const fromDay = from.getUTCDate();
        const toDay = to.getUTCDate();

        const prevFromDay = Math.min(fromDay, lastDayPrevMonth);
        const prevToDay = Math.min(toDay, lastDayPrevMonth);

        const prevFrom = new Date(Date.UTC(prevYear, prevMonth, prevFromDay));
        const prevTo = new Date(Date.UTC(prevYear, prevMonth, prevToDay));

        return { prevFrom, prevTo };
      };

      const currentFrom = toUTCDate(new Date(FromDate));
      const currentTo = toUTCDate(new Date(ToDate));

      const { prevFrom, prevTo } = getPreviousMonthRange(
        currentFrom,
        currentTo,
      );

      const fetchDepartmentData = async (from: Date, to: Date) => {
        const baseWhere: any = {
          CompanyMasterSid,
          AND: [
            { MasterJobDate: { gte: from } },
            { MasterJobDate: { lte: to } },
          ]
        };

        const departments = await this._db.departmentMaster.findMany({
          where: { CompanyMasterSid },
          select: { DepartmentMasterSid: true, departmentName: true },
        });
        const departmentMap = new Map(
          departments.map((department) => [
            department.DepartmentMasterSid,
            department.departmentName,
          ]),
        );

        const houseJobData = await this._db.houseJob.findMany({
          where: {
            CompanyMasterSid,
            status: 'A',
            AND: [{ HBLDate: { gte: from } }, { HBLDate: { lte: to } }],
          },
          select: {
            HouseJobSid: true,
            DepartmentMasterSid: true,
          },
        });

        const shipmentCountByDepartment = houseJobData.reduce(
          (acc, houseJob) => {
            const departmentSid = houseJob.DepartmentMasterSid;
            const departmentName = departmentSid
              ? departmentMap.get(departmentSid) || ''
              : '';

            if (!departmentSid || !departmentName) {
              return acc;
            }

            acc[departmentSid] = {
              departmentSid,
              departmentName,
              totalShipment: (acc[departmentSid]?.totalShipment || 0) + 1,
            };
            return acc;
          },
          {} as Record<
            number,
            {
              departmentSid: number;
              departmentName: string;
              totalShipment: number;
            }
          >,
        );

        const masterJobData = await this._db.masterJob.findMany({
          where: baseWhere,
          include: {
            houseJob: {
              where: { status: 'A' },
            },
            containers: {
              where: { Status: 'A' },
              include: {
                containerType: {
                  where: { status: 'A' },
                  select: { NoOfTeu: true },
                },
              },
            },
          },
        });

        if (!masterJobData.length && !houseJobData.length) return [];

        const freightMomMenus = await this._db.menuMaster.findMany({
          where: {
            status: 'A',
            OR: [
              { MenuName: { equals: 'Master Job', mode: 'insensitive' } },
              { MenuName: { contains: 'Master Air Way', mode: 'insensitive' } },
              { MenuName: { equals: 'House Job', mode: 'insensitive' } },
              { MenuName: { contains: 'House Air Way', mode: 'insensitive' } },
              { MenuName: { equals: 'Service Job', mode: 'insensitive' } },
              {
                MenuName: {
                  contains: 'Agent Master Air Way',
                  mode: 'insensitive',
                },
              },
              {
                MenuName: {
                  contains: 'AgentMaster Air Way',
                  mode: 'insensitive',
                },
              },
            ],
          },
          select: { MenuMasterSid: true, MenuName: true },
        });

        const allMasterMenuSids = freightMomMenus
          .filter((m) => {
            const menuName = m.MenuName.toLowerCase();
            return (
              menuName === 'master job' || menuName.includes('master air way')
            );
          })
          .map((m) => m.MenuMasterSid);

        const allHouseMenuSids = freightMomMenus
          .filter((m) => {
            const menuName = m.MenuName.toLowerCase();
            return (
              menuName === 'house job' ||
              menuName.includes('Service Job') ||
              menuName.includes('house air way') ||
              menuName.includes('agent master air way') ||
              menuName.includes('agentmaster air way')
            );
          })
          .map((m) => m.MenuMasterSid);

        const masterJobIds = masterJobData.map((m) => m.MasterJobSid);

        const houseJobIds: number[] = masterJobData
          .flatMap((m) => m.houseJob)
          .map((h) => h.HouseJobSid)
          .filter((id): id is number => typeof id === 'number');

        const masterCR = await this._db.costRevenueCharges.findMany({
          where: {
            MenuMasterSid: { in: allMasterMenuSids },
            TransactionSid: { in: masterJobIds },
            status: 'A',
          },
        });

        const houseCR = await this._db.costRevenueCharges.findMany({
          where: {
            MenuMasterSid: { in: allHouseMenuSids },
            TransactionSid: { in: houseJobIds },
            status: 'A',
          },
        });

        const jobRows = masterJobData.map((m) => {
          const crMaster = masterCR.filter(
            (c) => c.TransactionSid === m.MasterJobSid,
          );
          const crHouse = houseCR.filter((c) =>
            m.houseJob.some((h) => h.HouseJobSid === c.TransactionSid),
          );

          const totalRevenue =
            crMaster.reduce(
              (s, c) => s + Number(c.RevenueLocalAmount || 0),
              0,
            ) +
            crHouse.reduce((s, c) => s + Number(c.RevenueLocalAmount || 0), 0);

          const totalCost =
            crMaster.reduce((s, c) => s + Number(c.CostLocalAmount || 0), 0) +
            crHouse.reduce((s, c) => s + Number(c.CostLocalAmount || 0), 0);

          const grossProfit = totalRevenue - totalCost;

          const totalNoOfTEU = m.containers.reduce(
            (sum, c) => sum + Number(c.containerType?.NoOfTeu || 0),
            0,
          );

          const totalGrossWt = masterJobData.reduce((sum, m) => {
            return sum + Number(m.GrossWeight || 0);
          }, 0);

          const totalVol = masterJobData.reduce(
            (s, c) => s + toNumber(c.NetWeight),
            0,
          );

          return {
            departmentSid: m.DepartmentMasterSid,
            department: m.DepartmentMasterSid
              ? departmentMap.get(m.DepartmentMasterSid) || ''
              : '',
            shipmentCount: 0,
            grossWt: totalGrossWt,
            vol: totalVol,
            totalRevenue,
            totalCost,
            grossProfit,
            totalNoOfTEU,
          };
        });

        const departmentWiseMap = jobRows.reduce((acc: any, row) => {
          if (!row.departmentSid || !row.department) {
            return acc;
          }

          if (!acc[row.departmentSid]) {
            acc[row.departmentSid] = {
              departmentSid: row.departmentSid,
              department: row.department,
              totalShipment: 0,
              totalGrossWt: 0,
              totalVolume: 0,
              totalRevenue: 0,
              totalCost: 0,
              grossProfit: 0,
              totalNoOfTEU: 0,
              jobCount: 0,
            };
          }

          acc[row.departmentSid].totalGrossWt += row.grossWt;
          acc[row.departmentSid].totalVolume += row.vol;
          acc[row.departmentSid].totalRevenue += row.totalRevenue;
          acc[row.departmentSid].totalCost += row.totalCost;
          acc[row.departmentSid].grossProfit += row.grossProfit;
          acc[row.departmentSid].totalNoOfTEU += row.totalNoOfTEU;
          acc[row.departmentSid].jobCount += 1;

          return acc;
        }, {});

        for (const [departmentSid, shipmentData] of Object.entries(
          shipmentCountByDepartment,
        )) {
          if (!departmentWiseMap[departmentSid]) {
            departmentWiseMap[departmentSid] = {
              departmentSid: Number(departmentSid),
              department: shipmentData.departmentName,
              totalShipment: 0,
              totalGrossWt: 0,
              totalVolume: 0,
              totalRevenue: 0,
              totalCost: 0,
              grossProfit: 0,
              totalNoOfTEU: 0,
              jobCount: 0,
            };
          }

          departmentWiseMap[departmentSid].totalShipment =
            shipmentData.totalShipment;
        }

        const departmentWise = Object.values(
          departmentWiseMap,
        );

        return departmentWise;
      };

      /* ---------- FETCH BOTH ---------- */

      const currentMonthData = await fetchDepartmentData(
        currentFrom,
        currentTo,
      );
      const previousMonthData = await fetchDepartmentData(prevFrom, prevTo);

      // Total 

     const calculateMoM = (current: number, previous: number) => {
      const safeCurrent = Number(current) || 0;
      const safePrevious = Number(previous) || 0;

      // both months no business
      if (safePrevious === 0 && safeCurrent === 0) {
        return 0;
      }
      // avoid division by zero
      if (safePrevious === 0) {
        return safeCurrent > 0 ? 100 : -100;
      }
      // business completely dropped
      if (safeCurrent === 0) {
        return -100;
      }

      const result = ((safeCurrent - safePrevious) / safePrevious) * 100;
      return Number.isFinite(result) ? result : 0;
    };

    const departmentWiseMoM = (currentMonthData as any[]).map((curr: any) => {
      const prev = (previousMonthData as any[]).find(
        (p: any) => p.departmentSid === curr.departmentSid
      );

      return {
        departmentSid: curr.departmentSid,
        department: curr.department,
        shipmentCount: calculateMoM(
          curr.totalShipment,
          prev?.totalShipment || 0
        ),
        grossWt: calculateMoM(
          curr.totalGrossWt,
          prev?.totalGrossWt || 0
        ),
        vol: calculateMoM(
          curr.totalVolume,
          prev?.totalVolume || 0
        ),
        totalRevenue: calculateMoM(
          curr.totalRevenue,
          prev?.totalRevenue || 0
        ),
        totalCost: calculateMoM(
          curr.totalCost,
          prev?.totalCost || 0
        ),
        grossProfit: calculateMoM(
          curr.grossProfit,
          prev?.grossProfit || 0
        ),
        totalNoOfTEU: calculateMoM(
          curr.totalNoOfTEU,
          prev?.totalNoOfTEU || 0
        ),
      };
    });

      /* ---------- RESPONSE ---------- */

      return {
        params,
        currentPeriod: {
          from: currentFrom,
          to: currentTo,
          data: currentMonthData,
        },
        previousPeriod: {
          from: prevFrom,
          to: prevTo,
          data: previousMonthData,
        },
        departmentWiseMoM
      };
    } catch (error) {
      throw error;
    }
  }

  // Unpicked Cargo
  async generateUnpickedCargoReport(params: any) {
    const {
      FromHblDt:FromDate,
      ToHblDt:ToDate,
      companyId: CompanyMasterSid,
      Branch: branchId,
    } = params;
    
    try {
       const branches =
      branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
            where: { BranchMasterSid: { in: branchId } },
            select: { BranchMasterSid: true, branchName: true },
          })
        : await this._db.branchMaster.findMany({
            where: { CompanyMasterSid },
            select: { BranchMasterSid: true, branchName: true },
          });

    const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
    const resolvedBranchNames = branches.map((b) => b.branchName);
    const branchInvolved =
      branchId && branchId.length > 0
        ? branches.map((b) => b.branchName).join(', ')
        : 'All Branches';

        const housedata = await this._db.houseJob.findMany({
          where: {
            status: 'A',
            CompanyMasterSid,
            BranchMasterSid: { in: resolvedBranchIds },
            AND: [
              { HBLDate: { gte: FromDate } },
              { HBLDate: { lte: ToDate } },
            ],
          },
          include:{
            masterJob:true
          },
          orderBy: {
            HBLDate:'asc'
          }
        });

        const data = housedata.map((h) => {
          return {
            HBLDate:h.HBLDate,
            HBLNo:h.HBLNo,
            MBLNo:h.masterJob?.MBLNo,
            POL:h.POL,
            POD:h.POD,
            FPD:h.FPD,
            consigneeName:h.ConsigneeName,
            notify:h.Notify
          };
        });
        
        return {
          params,
          data,
          branchInvolved
        };
        }catch(error){
          throw error;
        }
  }

  // Import Nonimation Booking
  async generateImportNominationBookingReport(params: any) {
    const {
      BookingFromDate:FromDate,
      BookingToDate:ToDate,
      companyId: CompanyMasterSid,
      Branch: branchId,
    } = params;
    
    try {
       const branches =
      branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
            where: { BranchMasterSid: { in: branchId } },
            select: { BranchMasterSid: true, branchName: true },
          })
        : await this._db.branchMaster.findMany({
            where: { CompanyMasterSid },
            select: { BranchMasterSid: true, branchName: true },
          });

    const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
    const resolvedBranchNames = branches.map((b) => b.branchName);
    const branchInvolved =
      branchId && branchId.length > 0
        ? branches.map((b) => b.branchName).join(', ')
        : 'All Branches';

       const ports = await this._db.portMaster.findMany({
          where: {
            status: 'A',
          },
          select: {
            PortCode: true,
            PortName: true,
          },
        });

        const deptmaster = await this._db.departmentMaster.findMany({
          where: {
            Status: 'A',
          },
          select: {
            DepartmentMasterSid: true,
            departmentName: true,
          }
        });

        const usermaster = await this._db.userMaster.findMany({
          where: {
            status: 'A',
          },
          select: {
            UserMasterSid: true,
            userName: true,
          }
        });

        const bookingdata = await this._db.bookingHeader.findMany({
          where: {
            status: 'A',
            CompanyMasterSid,
            BranchMasterSid: { in: resolvedBranchIds },
            AND: [
            { BookingDateTime: { gte: FromDate } },
            { BookingDateTime: { lte: ToDate } },
            ],
            JobType : 'Import',
            // Nominated : 'Y',
            ShipmentType : 'Y'
          },
          include: {
            bookingCargo: {
              where: {
                status: 'A'
              }
            },
            bookingOthers : {
              where: {
                status: 'A',
              }
            },
            houseJob:{
              where:{
                status: 'A',
              }
            }
          },
          orderBy: {
            BookingDateTime: 'desc',
          },
        });

        const data = bookingdata.map(booking => ({
          bookingNumber: booking.BookingNo,
          bookingDate: booking.BookingDateTime,
          Dept : deptmaster.find(d => d.DepartmentMasterSid === booking.DepartmentMasterSid)?.departmentName,
          customerName: booking.CustomerName,
          customerAddress: booking.CustomerAddress,
          incoterms: booking.IncoTerms,
          shipmentType: booking.ShipmentType,
          nominated: booking.Nominated,
          nominatedBy: booking.NominatedBy,
          jobType: booking.JobType,
          NoofPkg: booking?.bookingCargo?.reduce(
            (sum, cargo) => sum + (Number(cargo.NoOfPackage) || 0),
            0
          ),
          GrossWt : booking?.bookingCargo?.reduce(
            (sum, cargo) => sum + (Number(cargo.GrossWeight) || 0),
            0
          ),
          Volume : booking?.bookingCargo?.reduce(
            (sum, cargo) => sum + (Number(cargo.Volume) || 0),
            0
          ),
          salesperson: usermaster.find(u => u.UserMasterSid === booking.SalesmanSid)?.userName,
          POL : ports.find((p)=>p.PortCode === booking.POL)?.PortName,
          POO : ports.find((p)=>p.PortCode === booking.POO)?.PortName,
          FDC : ports.find((p)=>p.PortCode === booking.FPD)?.PortName,
          originAgent : booking?.bookingOthers?.[0]?.OriginAgent || '',
          HBLNo:booking?.houseJob?.HBLNo || '',
        }));

       return {
         params,
         data,
         branchInvolved
       };
    }catch(error){
      throw error;
    }
  }

  // Daily Job Register
  async generateDailyJobRegisterReport(params: any) {
    const {
      ToDate,
      companyId: CompanyMasterSid,
      Branch: branchId,
    } = params;
    try {
       const branches =
      branchId && branchId.length > 0
       ? await this._db.branchMaster.findMany({
            where: { BranchMasterSid: { in: branchId } },
            select: { BranchMasterSid: true, branchName: true },
          })
        : await this._db.branchMaster.findMany({
            where: { CompanyMasterSid },
            select: { BranchMasterSid: true, branchName: true },
          });

      const resolvedBranchIds = branches.map((b) => b.BranchMasterSid);
      const branchInvolved =
        branchId && branchId.length > 0
          ? branches.map((b) => b.branchName).join(', ')
          : 'All Branches';

      const selectedDate = new Date(ToDate);
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

      const formatDateLabel = (value: Date) => {
        const day = String(value.getDate()).padStart(2, '0');
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const year = value.getFullYear();
        return `${day}-${month}-${year}`;
      };

      const departments = await this._db.departmentMaster.findMany({
        where: {
          Status: 'A',
          CompanyMasterSid,
        },
        select: {
          DepartmentMasterSid:true,
          departmentName: true,
          FCLLCL: true,
        },
      });

      const bookings = await this._db.bookingHeader.findMany({
        where: {
          status: 'A',
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          BookingDateTime: {
            gte: startOfMonth,
            lte: endOfDay,
          },
        },
        include: {
          bookingCargo: {
            where: {
              status: 'A',
            },
            select: {
              Volume: true,
            },
          },
        },
        orderBy: {
          BookingDateTime: 'desc',
        },
      });

      const isSameDay = (value: Date | null | undefined) => {
        if (!value) return false;
        const bookingDate = new Date(value);
        return bookingDate >= startOfDay && bookingDate <= endOfDay;
      };

      const sumVolume = (rows: typeof bookings) =>
        rows.reduce(
          (total, booking) =>
            total +
            (booking.bookingCargo || []).reduce(
              (cargoTotal, cargo) => cargoTotal + (Number(cargo.Volume) || 0),
              0,
            ),
          0,
        );

      const buildCountRow = (
        job: string,
        predicate: (booking: (typeof bookings)[number]) => boolean,
      ) => {
        const totalRows = bookings.filter(predicate);
        const dayRows = totalRows.filter((booking) => isSameDay(booking.BookingDateTime));

        return {
          job,
          date: formatDateLabel(selectedDate),
          dateCount: dayRows.length,
          total: totalRows.length,
        };
      };

      const buildVolumeRow = (
        job: string,
        predicate: (booking: (typeof bookings)[number]) => boolean,
      ) => {
        const totalRows = bookings.filter(predicate);
        const dayRows = totalRows.filter((booking) => isSameDay(booking.BookingDateTime));

        return {
          job,
          date: formatDateLabel(selectedDate),
          dateCount: sumVolume(dayRows),
          total: sumVolume(totalRows),
        };
      };

      const data = [
        buildCountRow('Jobs Opened', () => true),
        buildVolumeRow('M3 Booked', () => true),
        buildCountRow('Import Jobs', (booking) => booking.JobType === 'Import'),
        buildCountRow('Export Jobs', (booking) => booking.JobType === 'Export'),
        buildCountRow(
          'Transhipment Jobs',
          (booking) => booking.JobType === 'Transhipment',
        ),
        buildCountRow(
          'Nominated Jobs',
          (booking) => String(booking.ShipmentType || '').toLowerCase() === 'y',
        ),
        buildCountRow(
          'LCL Jobs',
          (booking) => departments.find((d) => d.DepartmentMasterSid === booking.DepartmentMasterSid)?.FCLLCL === 'LCL',  
        ),
        buildCountRow(
          'FCL Jobs',
          (booking) => departments.find((d) => d.DepartmentMasterSid === booking.DepartmentMasterSid)?.FCLLCL === 'FCL',
        ),
        buildCountRow(
          'Air Jobs',
          (booking) => departments.find((d) => d.DepartmentMasterSid === booking.DepartmentMasterSid)?.FCLLCL === 'Air',
        ),
      ];

      const customerMap = new Map<
        string,
        {
          customerName: string;
          jobsOpenedCount: number;
          m3Booked: number;
          importCount: number;
          exportCount: number;
          transhipmentCount: number;
          nominatedCount: number;
          lclCount: number;
          fclCount: number;
          airCount: number;
          total: number;
        }
      >();

      bookings.forEach((booking) => {
        const customerName = String(booking.CustomerName || '').trim() || 'Unknown Customer';
        const current = customerMap.get(customerName) || {
          customerName,
          jobsOpenedCount: 0,
          m3Booked: 0,
          importCount: 0,
          exportCount: 0,
          transhipmentCount: 0,
          nominatedCount: 0,
          lclCount: 0,
          fclCount: 0,
          airCount: 0,
          total: 0,
        };

        current.jobsOpenedCount += 1;
        current.total += 1;
        current.m3Booked += (booking.bookingCargo || []).reduce(
          (sum, cargo) => sum + (Number(cargo.Volume) || 0),
          0,
        );
        if (booking.JobType === 'Import') current.importCount += 1;
        if (booking.JobType === 'Export') current.exportCount += 1;
        if (booking.JobType === 'Transhipment') current.transhipmentCount += 1;
        if (String(booking.ShipmentType || '').toLowerCase() === 'y') {
          current.nominatedCount += 1;
        }

        const shipmentCategory = departments.find(
          (d) => d.DepartmentMasterSid === booking.DepartmentMasterSid,
        )?.FCLLCL;

        if (shipmentCategory === 'LCL') current.lclCount += 1;
        if (shipmentCategory === 'FCL') current.fclCount += 1;
        if (shipmentCategory === 'Air') current.airCount += 1;

        customerMap.set(customerName, current);
      });

      const customerData = Array.from(customerMap.values()).sort((a, b) =>
        a.customerName.localeCompare(b.customerName),
      );

      return {
        params,
        branchInvolved,
        dateLabel: formatDateLabel(selectedDate),
        data,
        customerData,
      };
    } catch (error) {
      throw error;
    }
  }

  // Destuffing Report
  async generateDestuffingReport(params: any) {    
    const {
      FromHblDate:FromDate,
      ToHblDate:ToDate,
      companyId: CompanyMasterSid,
    } = params;
    try {
      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true },
      });

      const containerTypeMap = new Map(
        containerTypesMaster.map((ct) => [
          ct.ContainerTypeMasterSid,
          ct.ContainerSize,
        ]),
      );

      const housejob = await this._db.houseJob.findMany({
        where: {
          status: 'A',
          AND: [{ HBLDate: { gte: FromDate, lte: ToDate } }],
          CompanyMasterSid: CompanyMasterSid,
          JobType: 'Import',
        },
        include: {
          Cargo: true ,
          Connections:true,
          Products: true,
          Others:true,
          masterJob: {
            where: {
              Status: 'A',
            },
            select: {
              voyages:true,
              containers: {
                where: { Status: 'A' },
                include: {
                  containerType: {
                    select: {
                      ContainerSize: true,
                      ContainerTypeMasterSid: true,
                      NoOfTeu: true,
                      ContainerName: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          HBLDate: 'asc',
        },
      });

      const data = housejob.map((h) => {
       const masterJob = Array.isArray(h.masterJob) ? h.masterJob[0] : h.masterJob;
       const masterContainerSid =
         masterJob?.containers?.[0]?.MasterJobContainerSid;

       const containerInfo: any[] = [];

       const houseProducts = h.Products || [];
       const allContainers = masterJob?.containers || [];

       houseProducts.forEach((hp) => {
         const ourMJContainer = allContainers.find(
           (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
         );

         const ourContainerType = ourMJContainer?.containerType;
         
         containerInfo.push({
           MasterJobContainerSid : hp.MasterJobContainerSid,
           containerTypeMasterSid : ourContainerType?.ContainerTypeMasterSid,
           containerNumber: hp?.ContainerNo ?? '',
           containerType: ourContainerType?.ContainerName ?? '',
         });
       });

       return {
        houseJobSid: h.HouseJobSid,
        HBLDate : h.HBLDate,
        HBLNo : h.HBLNo,
        OriginAgent : h.AgentName,
        VesselName : h.VesselName,
        VoyageNo : h.VoyageNo,
        CFS : h.Others?.[0]?.YardCFS,
        ETD : h.ETD,
        ETA : h.ETA,
        ATA : h.masterJob?.voyages?.[0]?.ATA,
        ATD : h.masterJob?.voyages?.[0]?.ATD,
        Remarks : h?.GeneralNote,
        containerInfo,
        containerNoList: containerInfo
          .map((c) => c.containerNumber)
          .filter(Boolean)
          .join(', '),
        containerTypeList: containerInfo
          .map((c) => c.containerType)
          .filter(Boolean)
          .join(', '),
       };
      });

      return {
        params,
        data,
      }

    } catch (error) {
      throw error;
    }
  }

  async getCustomerName(
    companyMasterSid: number,
    customerMasterSid: number,
  ): Promise<string> {
    try {
      const customer = await this._db.customerMaster.findUnique({
        where: {
          CompanyMasterSid: companyMasterSid,
          CustomerMasterSid: customerMasterSid,
        },
        select: {
          CustomerName: true,
        },
      });
      return customer?.CustomerName || '';
    } catch (error) {
      throw error;
    }
  }

  async getSalespersonName(
    companyMasterSid: number,
    userId: number | null,
  ): Promise<string> {
    if (!userId) return '';
    try {
      const user = await this._db.userMaster.findUnique({
        where: {
          UserMasterSid: userId,
          userCompanyMaster: {
            some: {
              CompanyMasterSid: companyMasterSid,
            },
          },
        },
        select: {
          userName: true,
        },
      });
      return user?.userName || '';
    } catch (error) {
      throw error;
    }
  }

  async exportReport(reportName: string, exportParams: any) {
    try {
      // Generate report first
      const reportData = await this.generateReport(
        reportName,
        exportParams.parameters,
      );

      // Format and export based on format
      const format = exportParams.format || 'EXCEL';

      // TODO: Implement actual export logic using report-export service
      return {
        reportName,
        format,
        data: reportData,
        exportedAt: new Date(),
        message: `Export to ${format} will be implemented by report-export service`,
      };
    } catch (error) {
      throw error;
    }
  }

  async emailReport(reportName: string, emailParams: any) {
    try {
      // Generate and export report
      const exportData = await this.exportReport(reportName, {
        parameters: emailParams.parameters,
        format: emailParams.format || 'PDF',
      });

      // TODO: Implement email service integration
      this.logger.log(`Email report to: ${emailParams.email}`);

      return {
        success: true,
        message: 'Email service integration pending',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute parameter query to get dynamic dropdown options
   */
  async executeParameterQuery(
    parameterId: number,
    context: { companyId?: number; branchId?: number; [key: string]: any },
  ): Promise<Array<{ value: any; label: string }>> {
    try {
      // Fetch the parameter details
      const parameter = await this._db.reportMasterDetail.findFirst({
        where: {
          ReportMasterDetailSid: parameterId,
          Status: 'A',
        },
      });

      if (!parameter) {
        throw new BadRequestException(
          `Parameter with ID ${parameterId} not found`,
        );
      }

      if (!parameter.ParameterQuery) {
        throw new BadRequestException(
          `Parameter ${parameter.ParameterName} does not have a query defined`,
        );
      }

      // If this parameter depends on another, check if parent value is provided
      if (parameter.DependsOnParameter) {
        const parentValue = context[parameter.DependsOnParameter];
        if (
          parentValue === undefined ||
          parentValue === null ||
          parentValue === ''
        ) {
          this.logger.log(
            `Parameter ${parameter.ParameterName} depends on ${parameter.DependsOnParameter} which is not provided`,
          );
          return [];
        }
      }

      // Validate and sanitize the query
      this.validateQuery(parameter.ParameterQuery);

      // Substitute context variables in the query
      let query = parameter.ParameterQuery;

      // Standard substitutions
      if (context.companyId) {
        query = query.replace(/\{companyId\}/g, context.companyId.toString());
      }
      if (context.branchId) {
        query = query.replace(/\{branchId\}/g, context.branchId.toString());
      }

      // Dynamic parameter substitutions (e.g., {POL}, {POD})
      for (const [key, value] of Object.entries(context)) {
        if (
          key !== 'companyId' &&
          key !== 'branchId' &&
          value !== undefined &&
          value !== null
        ) {
          const placeholder = new RegExp(`\\{${key}\\}`, 'g');
          query = query.replace(placeholder, this.sanitizeValue(value));
        }
      }

      // Execute the query
      this.logger.log(`Executing parameter query: ${query}`);
      const results =
        await this._db.$queryRawUnsafe<Array<{ value: any; label: string }>>(
          query,
        );

      return results;
    } catch (error) {
      this.logger.error(`executeParameterQueryError: ${error}`);
      throw error;
    }
  }

  private sanitizeValue(value: any): string {
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'string') {
      return value.replace(/'/g, "''");
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.sanitizeValue(v)).join(',');
    }
    return String(value);
  }

  /**
   * Validate SQL query for security
   */
  private validateQuery(query: string): void {
    const trimmedQuery = query.trim().toUpperCase();

    // Must start with SELECT
    if (!trimmedQuery.startsWith('SELECT')) {
      throw new BadRequestException('Only SELECT queries are allowed');
    }

    // Check for dangerous keywords
    const dangerousKeywords = [
      'DROP',
      'DELETE',
      'UPDATE',
      'INSERT',
      'ALTER',
      'EXEC',
      'EXECUTE',
      'CREATE',
      'TRUNCATE',
      'GRANT',
      'REVOKE',
      ';--',
      'XP_',
      'SP_',
    ];

    for (const keyword of dangerousKeywords) {
      if (trimmedQuery.includes(keyword)) {
        throw new BadRequestException(
          `Query contains forbidden keyword: ${keyword}`,
        );
      }
    }

    // Additional security: check for multiple statements
    const statements = query.split(';').filter((s) => s.trim().length > 0);
    if (statements.length > 1) {
      throw new BadRequestException('Multiple SQL statements are not allowed');
    }
  }
}
