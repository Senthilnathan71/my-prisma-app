import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ApprovalStatus, Prisma, PrismaClient } from '@prisma/client';
import { BLIssueListReportQueryDto, ContainerKPIReportQueryDto, CostRevenueNotBookedReportQueryDto, DestinationReportQueryDto, DOIssueListReportQueryDto, exportJobVolumeTEUReportQueryDto, houseJobLossReportQueryDto, lostCustomerReportQueryDto, NetworkReportQueryDto, profitabilityReportQueryDto, ProfitSummaryReportQueryDto, ShipmentDetailedSummaryReportQueryDto, ShipmentSummaryReportQueryDto, tradelaneProfitabilityReportQueryDto, unbilledcostReportQueryDto, unbilledrevenueReportQueryDto } from 'src/operation/DTO/operation-reports.dto';
import { toNumber } from 'src/common/helper';

@Injectable()
export class OperationReportsService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger,
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
      ToJobDt,
      FromJobDt,
      Branch: branchId,
      Dept: deptId,
      JobGenerated = true,
    } = params;

    try {
      this.logger.log(
        `Getting shipment summary report for CompanySid=${CompanyMasterSid}, From=${FromJobDt}, To=${ToJobDt}`,
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

      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [{ HBLDate: { gte: FromJobDt } }, { HBLDate: { lte: ToJobDt } }],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          ...(JobGenerated
            ? {
                MasterJobSid: { not: null },
                HouseStatus: { in: ['Job Generated'] },
              }
            : {}),
        },
        include: {
          Cargo: true,
          Products: {
            where: { status: 'A' },
          },
          masterJob: {
            include: {
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

      houseJobData.forEach((mj) => {
        if (mj.POL) portCodes.add(mj.POL);
        if (mj.POD) portCodes.add(mj.POD);
        if (mj.FPD) portCodes.add(mj.FPD);
        if (mj.POO) portCodes.add(mj.POO);
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

      const containerSize = ["20'", "40'", "45'"];

      const data = houseJobData.map((mj) => {
        const type = mj.DestinationAgent ? 'Agent' : null;

        const localShipmentVol =
          mj.JobType === 'Import' || mj.JobType === 'Export'
            ? mj.Cargo?.reduce(
                (sum, cargo) => sum + Number(cargo.Volume || 0),
                0,
              )
            : 0;

        const transhipmentVol =
          mj.JobType === 'Transhipment'
            ? mj.Cargo?.reduce(
                (sum, cargo) => sum + Number(cargo.Volume || 0),
                0,
              )
            : 0;

        const houseProducts = mj.Products;
        const allContainers = mj.masterJob?.containers || [];

        let totalNoOfTEU = 0;
        let numberOfTwentyFt = 0;
        let numberOfFourtyFt = 0;
        let numberOfFortyFive = 0;
        let containerInfo: any[] = [];
        houseProducts.forEach((hp) => {
          const ourMJContainer = allContainers.find(
            (mc) => mc.MasterJobContainerSid === hp.MasterJobContainerSid,
          );
          const ourContainerType = ourMJContainer?.containerType;
          containerInfo.push({
            containerNumber: hp?.ContainerNo,
            containerType: ourContainerType?.ContainerName,
            NoOfTeu: toNumber(ourContainerType?.NoOfTeu),
          });
          totalNoOfTEU += toNumber(ourContainerType?.NoOfTeu);
          const sizeTrimmed =
            ourContainerType?.ContainerName?.trim().toLowerCase();
          if (sizeTrimmed?.includes('20ft')) numberOfTwentyFt++;
          if (
            sizeTrimmed?.includes('40ft') ||
            sizeTrimmed?.includes('40 rf') ||
            sizeTrimmed?.includes('40rf') ||
            sizeTrimmed?.includes('40 flat rack') ||
            sizeTrimmed?.includes('fotp')
          )
            numberOfFourtyFt++;
          if (sizeTrimmed?.includes('45ft') || sizeTrimmed?.includes('45hc'))
            numberOfFortyFive++;
        });

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

        const polName = mj.POL ? portMap.get(mj.POL) || '' : '';
        const podName = mj.POD ? portMap.get(mj.POD) || '' : '';
        const fpdName = mj.FPD ? portMap.get(mj.FPD) || '' : '';
        const pooName = mj.POO ? portMap.get(mj.POO) || '' : '';
        const jobTypesArray = Array.isArray(mj.JobType)
          ? mj.JobType
          : [{ JobType: mj.JobType }];

        return {
          masterNo: mj.masterJob?.MasterJobNumber,
          Hblno: mj.HBLNo,
          HblDate: mj.HBLDate,
          masterDate: mj.MBLDate,
          department:
            departments.find(
              (d) => d.DepartmentMasterSid === mj.DepartmentMasterSid,
            )?.departmentName || '',
          mblNo: mj.masterJob?.MBLNo || '',
          vesselName: mj?.VesselName || '',
          voyageNo: mj?.VoyageNo || '',
          etd: mj?.ETA || '',
          eta: mj?.ETD || '',
          originPort: mj.POO || '',
          originPortName: pooName || '',
          loadPort: mj.POL || '',
          loadPortName: polName,
          dischargePort: mj.POD || '',
          dischargePortName: podName,
          destinationPort: mj.FPD || '',
          destinationPortName: fpdName,
          carrier: mj?.CarrierName || '',
          weight: mj.Cargo?.[0]?.GrossWeight || 0,
          volume: mj.Cargo?.[0]?.Volume || 0,
          chargeable: mj.Cargo?.[0]?.ChargeableWeight || 0,
          shipper: mj?.ShipperName || '',
          containerNoList: mj?.Products?.map((c: any) => c.ContainerNo).join(
            ', ',
          ),
          // noOfContainers: mj.Cargo?.reduce((sum, cargo) => sum + (cargo.NoofContainers || 0), 0) || 0,
          nofcontainer: numberOfFourtyFt + numberOfTwentyFt + numberOfFortyFive,
          mastercontainerSid:
            mj?.masterJob?.containers
              ?.map((c: any) => c.mastercontainerSid)
              .join(', ') || '',
          masterContanierSid:
            mj?.masterJob?.containers?.[0]?.MasterJobContainerSid,
          sendingAgent: mj?.AgentName,
          receivingAgent:
            agentMaster.find((d) => d.CustomerMasterSid === mj.DestinationAgent)
              ?.CustomerName || '',
          type,
          containerInfo,
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
          houseStatus: mj?.HouseStatus,
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

      // Map each master job to its CostRevenueCharges
      const data = await Promise.all(
        masterJobs.map(async (job) => {
          // Fetch cost & revenue charges for all master jobs
          const relatedCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: job.MenuMasterSid!,
              TransactionSid: job.MasterJobSid,
              status: 'A',
            },
            select: {
              MenuMasterSid: true,
              CostLocalAmount: true,
              RevenueLocalAmount: true,
              ChargeDescription: true,
              ChargeMasterSid: true,
              CostAgentMasterSid: true,
              RevenueCustomerMasterSid: true,
              CostDrCr: true,
              RevenueDrCr: true,
              CostVoucherHeaderSid: true,
              RevenueVoucherHeaderSid: true,
            },
          });

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

          const houseRateMap: Map<number, any[]> = new Map([]);

          const houseJobIds = new Set(houseJobs.map((hj) => hj.HouseJobSid));
          const houseJobIdArr = houseJobs.map((hj) => hj.HouseJobSid);
          const houseJobMenu = await this._db.menuMaster.findFirst({
            where: { MenuName: 'House Job' },
            select: { MenuMasterSid: true },
          });

          if (!houseJobMenu) {
            throw new BadRequestException('House Job is found in menuMaster.');
          }

          const allHouseCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: houseJobMenu.MenuMasterSid,
              TransactionSid: { in: houseJobIdArr },
              status: 'A',
            },
            select: {
              TransactionSid: true,
              MenuMasterSid: true,
              CostLocalAmount: true,
              RevenueLocalAmount: true,
              ChargeDescription: true,
              ChargeMasterSid: true,
              CostAgentMasterSid: true,
              RevenueCustomerMasterSid: true,
              CostDrCr: true,
              RevenueDrCr: true,
              CostVoucherHeaderSid: true,
              RevenueVoucherHeaderSid: true,
            },
          });

          allHouseCR.forEach((hcr) => {
            const key = hcr.TransactionSid!;
            if (houseRateMap.has(key)) {
              const prev = houseRateMap.get(key) || [];
              houseRateMap.set(key, [...prev, hcr]);
            } else {
              houseRateMap.set(key, [hcr]);
            }
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
            if (size === '45ft Container') {
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
          const masterVouchers = relatedCR.filter(
            (cr) => cr.CostVoucherHeaderSid,
          );
          const actualCostMaster = masterVouchers.reduce((sum, cr) => {
            return cr.CostDrCr === 'D'
              ? Number(sum) + Number(cr.CostLocalAmount ?? 0)
              : Number(sum) - Number(cr.CostLocalAmount ?? 0);
          }, 0);

          const masterV = relatedCR.filter((cr) => cr.RevenueVoucherHeaderSid);
          const actualRevenueMaster = masterV.reduce((sum, cr) => {
            return cr.RevenueDrCr === 'C'
              ? Number(sum) + Number(cr.RevenueLocalAmount ?? 0)
              : Number(sum) - Number(cr.RevenueLocalAmount ?? 0);
          }, 0);

          let actualCostHouse = 0;
          let actualRevenueHouse = 0;

          houseJobsData.forEach((house) => {
            const voucherCRs = (
              houseRateMap.get(house.HouseJobSid) || []
            ).filter((cr) => cr.CostVoucherHeaderSid);

            const cost = voucherCRs.reduce((sum, cr) => {
              return cr.CostDrCr === 'D'
                ? Number(sum) + Number(cr.CostLocalAmount ?? 0)
                : Number(sum) - Number(cr.CostLocalAmount ?? 0);
            }, 0);

            const voucherrevensid = (
              houseRateMap.get(house.HouseJobSid) || []
            ).filter((cr) => cr.RevenueVoucherHeaderSid);
            const revenue = voucherrevensid.reduce((sum, cr) => {
              return cr.RevenueDrCr === 'C'
                ? Number(sum) + Number(cr.RevenueLocalAmount ?? 0)
                : Number(sum) - Number(cr.RevenueLocalAmount ?? 0);
            }, 0);

            actualCostHouse += cost;
            actualRevenueHouse += revenue;
          });

          const actualCost = actualCostMaster + actualCostHouse;
          const actualRevenue = actualRevenueMaster + actualRevenueHouse;
          const actualGp = actualRevenue - actualCost;
          const profit = (Number(actualGp) * 100) / Number(actualRevenue);
          const proveprofit =
            (Number(GP) * 100) / Number(totalRevenueWithHouse);
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

      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job' },
        select: { MenuMasterSid: true },
      });

      if (!houseJobMenu) {
        throw new BadRequestException('House Job menu not found');
      }

      const houseJobIds = houseData.map((h) => h.HouseJobSid);

      const houseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: houseJobMenu.MenuMasterSid,
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
        const containerInfo = product
          ?.map((pr) => pr.masterJobContainer?.containerType?.ContainerName)
          .join(',');
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
          MBL: data?.masterJob?.MBLNo,
          HBL: data?.HBLNo,
          shipmentType: data?.Cargo?.[0]?.ShipmentTerms,
          consigneeName: data?.ConsigneeName,
          fnalDestination: fpd,
          countryMasterSid,
          countryName,
          portofDischarge: data?.POD,
          ETA: data?.ETA,
          ETD: data?.ETD,
          freightTerms: data?.FreightTerms,
          bookingDate: data?.bookingHeader?.BookingDateTime,
          containerNo: data?.Products.map((c) => c.ContainerNo).join(', '),
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
        .filter((hj) => !hj.Others?.[0]?.DONo)
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
          pcs: mj.Cargo?.[0]?.NoOfPackage,
          houseStatus: mj.HouseStatus,
          serviceLevelName: mj.MovementType,
          blType: mj.Others?.[0]?.ReleaseType,
          paymentTerms: mj.FreightTerms,
          shipperNo: mj.Others?.[0]?.CustomerRefNo,
          masterStatus: mj.masterJob?.JobStatus,
          jobClosed: mj.HouseStatus,
          housecreatedBy: mj.createdBy,
          mastercreatedBy: mj.masterJob?.CreatedBy,
          addtionalRemarks: mj.Others?.[0]?.ExternalNote,
          volume: mj.masterJob?.Volume || 0,
          grossWeight: mj.masterJob?.GrossWeight || 0,
          chargeable: mj.masterJob?.ChargeableWeight || 0,
          netWeight: mj.masterJob?.NetWeight,
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
          modeofTransport: mj.Cargo?.[0]?.ModeOfTransport,
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

      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job' },
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

      const masterJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'Master Job' },
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
                    CostLocalAmount: cr.CostLocalAmount,
                    CostDrCr: cr.CostDrCr,
                    CostAmount: cr.CostAmount,
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

            CostLocalAmount: rate.CostLocalAmount,
            CostDrCr: rate.CostDrCr,
            CostAmount: rate.CostAmount,

            partyName:
              customerMaster.find(
                (c) => c.CustomerMasterSid === rate.CustomerMasterSid,
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

      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job' },
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

      const masterJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'Master Job' },
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

      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job' },
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

          const houseCR = allHouseCR.filter(
            (cr) => cr.TransactionSid === house.HouseJobSid,
          );

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
      } = params;

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
      const [departments, masterJobMenu, houseJobMenu, customer, user] =
        await Promise.all([
          this._db.departmentMaster.findMany({
            where: { DepartmentMasterSid: { in: dept } },
            select: { DepartmentMasterSid: true, departmentName: true },
          }),
          this._db.menuMaster.findFirst({
            where: { MenuName: 'Master Job' },
            select: { MenuMasterSid: true },
          }),
          this._db.menuMaster.findFirst({
            where: { MenuName: 'House Job' },
            select: { MenuMasterSid: true },
          }),
          this._db.customerMaster.findMany({
            select: { CustomerMasterSid: true, CustomerName: true },
          }),
          this._db.userMaster.findMany({
            select: { UserMasterSid: true, userName: true },
          }),
        ]);

      if (!masterJobMenu || !houseJobMenu) {
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

      const getDepartmentName = (deptId: number) =>
        departments.find((d) => d.DepartmentMasterSid === deptId)
          ?.departmentName || '';

      const getCostRevenues = async (
        MenuMasterSid: number,
        TransactionSid: number,
      ) => {
        return this._db.costRevenueCharges.findMany({
          where: {
            TransactionSid,
            MenuMasterSid,
            status: 'A',
          },
          select: {
            CostRevenueChargesSid: true,
            RevenueVoucherHeaderSid: true,
            RevenueDrCr: true,
            RevenueLocalAmount: true,
            CostVoucherHeaderSid: true,
            CostDrCr: true,
            CostLocalAmount: true,
          },
        });
      };

      /* ===================== FINAL DATA ===================== */

      const data = await Promise.all(
        masterJob.map(async (mj) => {
          const masterCR = await getCostRevenues(
            masterJobMenu.MenuMasterSid,
            mj.MasterJobSid,
          );

          const linkedRev = masterCR.filter((cr) => cr.RevenueVoucherHeaderSid);
          const linkedCost = masterCR.filter((cr) => cr.CostVoucherHeaderSid);

          const calc = (arr: any[], type: 'R' | 'C') =>
            arr.reduce((sum, cr) => {
              if (type === 'R') {
                return cr.RevenueDrCr === 'C'
                  ? sum + Number(cr.RevenueLocalAmount || 0)
                  : sum - Number(cr.RevenueLocalAmount || 0);
              }
              return cr.CostDrCr === 'D'
                ? sum + Number(cr.CostLocalAmount || 0)
                : sum - Number(cr.CostLocalAmount || 0);
            }, 0);

          const pSale = calc(masterCR, 'R');
          const pCost = calc(masterCR, 'C');
          const aSale = calc(linkedRev, 'R');
          const aCost = calc(linkedCost, 'C');

          const houseWithCR = await Promise.all(
            mj.houseJob.map(async (hj) => {
              const houseCR = await getCostRevenues(
                houseJobMenu.MenuMasterSid,
                hj.HouseJobSid,
              );

              const linkedRevH = houseCR.filter(
                (cr) => cr.RevenueVoucherHeaderSid,
              );
              const linkedCostH = houseCR.filter(
                (cr) => cr.CostVoucherHeaderSid,
              );

              const hpSale = calc(houseCR, 'R');
              const hpCost = calc(houseCR, 'C');
              const haSale = calc(linkedRevH, 'R');
              const haCost = calc(linkedCostH, 'C');

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
                ModeOfTransport: hj.Cargo?.[0]?.ModeOfTransport,
                salesPerson: user.find(
                  (u) => u.UserMasterSid === hj.SalesmanSid,
                )?.userName,
                PPCC: hj.FreightTerms,
                POO: hj.POO,
                FPD: hj.FPD,
                costRevenues: {
                  totalNoOfCostRevenues: houseCR.length,
                  linkedRevenueRecords: linkedRevH.map(
                    (cr) => cr.CostRevenueChargesSid,
                  ),
                  linkedCostRecords: linkedCostH.map(
                    (cr) => cr.CostRevenueChargesSid,
                  ),
                  houseCrSummary: {
                    pSale: hpSale,
                    pCost: hpCost,
                    pGp: hpSale - hpCost,
                    aSale: haSale,
                    aCost: haCost,
                    aGp: haSale - haCost,
                  },
                },
              };
            }),
          );

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
            ModeOfTransport: mj.houseJob?.[0]?.Cargo?.[0]?.ModeOfTransport,
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
                pGp: pSale - pCost,
                aSale,
                aCost,
                aGp: aSale - aCost,
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
          pcs: mj.Cargo?.[0]?.NoOfPackage,
          houseStatus: mj.HouseStatus,
          serviceLevelName: mj.MovementType,
          blType: mj.Others?.[0]?.ReleaseType,
          paymentTerms: mj.FreightTerms,
          shipperNo: mj.Others?.[0]?.CustomerRefNo,
          masterStatus: mj.masterJob?.JobStatus,
          jobClosed: mj.HouseStatus,
          housecreatedBy: mj.createdBy,
          mastercreatedBy: mj.masterJob?.CreatedBy,
          addtionalRemarks: mj.Others?.[0]?.ExternalNote,
          volume: mj.masterJob?.Volume || 0,
          grossWeight: mj.masterJob?.GrossWeight || 0,
          chargeable: mj.masterJob?.ChargeableWeight || 0,
          netWeight: mj.masterJob?.NetWeight,
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
          modeofTransport: mj.Cargo?.[0]?.ModeOfTransport,
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
          TEUCount: totalNoOfTEU,
          fourtyft: numberOfFourtyFt,
          fortyfiveft: numberofFurtyFive,
          twentyft: numberOfTwentyFt,
          dept:
            departments.find(
              (d) => d.DepartmentMasterSid === mj.DepartmentMasterSid,
            )?.departmentName || '',
          jobNo: mj.MasterJobNumber,
          movementType: mj.houseJob?.[0]?.Cargo?.[0]?.ModeOfTransport,
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
      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job' },
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
        const houseCR = allHouseCR.filter(
          (cr) => cr.TransactionSid === b.HouseJobSid,
        );
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
          grossWt: b.Cargo?.[0]?.GrossWeight,
          netWt: b.Cargo?.[0]?.NetWeight,
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
  private async generateCostRevenueNotBookedReport(
    params: CostRevenueNotBookedReportQueryDto,
  ) {
    const {
      companyId: CompanyMasterSid,
      ToDate: ToHblDt,
      FromDate: FromHblDt,
      Branch: branchId,
      Dept: deptId,
      CalculationType,
    } = params;

    try {
      this.logger.log(
        `Getting Cost & Revenue Not Booked report for CompanySid=${CompanyMasterSid}`,
      );

      // ================= BRANCH =================
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

      // ================= DEPARTMENT =================
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

      // ================= CHARGE MASTER =================
      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customer = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true },
      });

      // ================= HOUSE JOB DATA =================
      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          HBLDate: {
            gte: FromHblDt,
            lte: ToHblDt,
          },
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          masterJob: true,
          bookingHeader:{
            select:{
              BookingNo:true
            }
          }
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

      // ================= HOUSE JOB IDS =================
      const houseJobIds = houseJobData.map((h) => h.HouseJobSid);

      // ================= MENU MASTER =================
      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job' },
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
          ...(CalculationType === 'Not Booked Revenue'
            ? {
                RevenueVoucherHeaderSid: null,
                CostLocalAmount: { gt: 0 },
                RevenueLocalAmount: { equals: 0 },
              }
            : CalculationType === 'Not Booked Cost'
              ? {
                  CostVoucherHeaderSid: null,
                  RevenueLocalAmount: { gt: 0 },
                  CostLocalAmount: { equals: 0 },
                }
              : {}),
        },

        select: {
          TransactionSid: true,
          ChargeMasterSid: true,
          CostLocalAmount: true,
          RevenueLocalAmount: true,
          CostVoucherHeaderSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueCustomerMasterSid:true,
          CostAgentMasterSid:true,
        },
      });

      const filteredHouseCR = allHouseCR.filter((cr) => {
  const chargeName =
    chargeMaster.find((c) => c.ChargeMasterSid === cr.ChargeMasterSid)
      ?.chargeName || "";

  return chargeName !== "Freight";
});


      // ================= MAP TRANSACTION -> CHARGES =================
      const houseRateMap = new Map<number, any[]>();

      filteredHouseCR.forEach((cr) => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      // ================= FINAL DATA BUILD =================
      const finalData = houseJobData
        .map((hj) => {
          const charges = houseRateMap.get(hj.HouseJobSid) || [];

          return {
            HouseJobSid: hj.HouseJobSid,
            HouseNo: hj.HouseNo,
            HBLDate : hj.HBLDate,
            HBLNo: hj.HBLNo,
            MBLNo: hj.masterJob?.MBLNo || '',
            dept:
              departments.find(
                (d) => d.DepartmentMasterSid === hj.DepartmentMasterSid,
              )?.departmentName || '',

            costRevenues: charges.map((cr) => ({
              Charge:
                chargeMaster.find(
                  (c) => c.ChargeMasterSid === cr.ChargeMasterSid,
                )?.chargeName || '',

              CostLocalAmount: Number(cr.CostLocalAmount || 0),
              RevenueLocalAmount: Number(cr.RevenueLocalAmount || 0),
              costCustomer : customer.find(c=>c.CustomerMasterSid===cr.CostAgentMasterSid)?.CustomerName || '',
              revenueCustomer : customer.find(c=>c.CustomerMasterSid===cr.RevenueCustomerMasterSid)?.CustomerName || '',
            })),
          };
        })
        .filter((x) => x.costRevenues.length > 0);

      return {
        companyMasterSid: CompanyMasterSid,
        branchInvolved,
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
                NOT: {
                  departmentName: {
                    contains: 'AIR',
                    mode: 'insensitive',
                  },
                },
              },
              select: { DepartmentMasterSid: true, departmentName: true },
            })
          : await this._db.departmentMaster.findMany({
              where: {
                CompanyMasterSid,
                NOT: {
                  departmentName: {
                    contains: 'AIR',
                    mode: 'insensitive',
                  },
                },
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
        return {
          bookingSid: b.BookingHeaderSid,
          dept: b.DepartmentMasterSid,
          grossWt: b.bookingCargo?.[0]?.GrossWeight,
          netWt: b.bookingCargo?.[0]?.NetWeight,
          vol: b.bookingCargo?.[0]?.Volume,
          revenueLocalAmt: b.bookingRates?.[0]?.RevenueLocalAmount,
          costLocalAmt: b.bookingRates?.[0]?.CostLocalAmount,
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

          (m.containers || []).forEach((c) => {
            const teu = Number(c.containerType?.NoOfTeu || 0);
            totalNoOfTEU += teu;

            const size = c.containerType?.ContainerSize?.trim();

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

      const makeKey = (sid: number, dept: number) => `${sid}_${dept}`;

      const quotationMap = new Map<number, number>();

      quotationCount.forEach((q) => {
        if (q.SalesmanSid !== null) {
          quotationMap.set(Number(q.SalesmanSid), q._count._all);
        }
      });

      const enquiryMap = new Map<string, number>();
      enquiryCount.forEach((e) => {
        if (e.UserMasterSid && e.DepartmentMasterSid) {
          enquiryMap.set(
            makeKey(e.UserMasterSid, e.DepartmentMasterSid),
            e._count._all,
          );
        }
      });

      const bookingMap = new Map<string, number>();
      bookingCount.forEach((b) => {
        if (b.SalesmanSid && b.DepartmentMasterSid) {
          bookingMap.set(
            makeKey(b.SalesmanSid, b.DepartmentMasterSid),
            b._count._all,
          );
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

      for (const dept of resolvedDeptIds) {
        const departmentName = departmentMap.get(dept) || '';
        for (const user of allSalesman) {
          const key = makeKey(user.UserMasterSid, dept);

          const q = quotationMap.get(user.UserMasterSid) || 0;
          const e = enquiryMap.get(key) || 0;
          const b = bookingMap.get(key) || 0;
          const l = leadMap.get(user.UserMasterSid) || 0;
          const m = meetingMap.get(user.UserMasterSid) || 0;
          const o = opportunityMap.get(user.UserMasterSid) || 0;
          if (q || e || b || l || m || o) {
            salesmanSummary.push({
              DepartmentMasterSid: dept,
              DepartmentName: departmentName,
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
        }
      }

      // -------Customer O/S------------

      const coa = await this._db.cOAMaster.findFirst({
        where: { CompanyMasterSid, Status: 'A' },
        select: { LedgerName: true, COAMasterSid: true },
      });

      const vouchers = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } },
          ],
          Status: 'A',
        },
        include: {
          VoucherHeader: {
            select: {
              Salesman: true,
            },
          },
          subledgerMaster: {
            where: {
              Status: 'A',
              SubledgerType: 'Customer',
            },
            select: {
              SubledgerMasterSid: true,
              SubledgerName: true,
              SubledgerType: true,
            },
          },
          voucherMatchings: {
            where: { Status: 'A' },
          },
        },

        orderBy: [{ VoucherDate: 'asc' }],
      });

      const reportData = vouchers.map((v) => {
        const matchLocal = v.voucherMatchings.reduce(
          (acc, m) => acc + (m.DrCr === 'D' ? +m.LocalAmount : -m.LocalAmount),
          0,
        );
        const matchCurr = v.voucherMatchings.reduce(
          (acc, m) => acc + (m.DrCr === 'D' ? +m.Amount : -m.Amount),
          0,
        );

        const ageing =
          Math.floor(
            (+new Date() - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24),
          ) + 1;

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
          OriginalCurrAmount: Number(v.Amount),
          OriginalLocalAmount: Number(v.LocalAmount),
          OSCurrencyAmount: Number(v.Amount) - Math.abs(matchCurr),
          OSLocalAmount: Number(v.LocalAmount) - Math.abs(matchLocal),
          OnAccountCreditCurr:
            v.DrCr === 'C' ? Number(v.Amount) - Math.abs(matchCurr) : 0,
          OnAccountCreditLocal:
            v.DrCr === 'C' ? Number(v.LocalAmount) - Math.abs(matchLocal) : 0,
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
        customer.TotalOutstanding += row.OSLocalAmount;
        customer.buckets[bucket] += row.OSLocalAmount;
      });

      const customerRows = Array.from(customerRowsMap.values());
      // ----Bank/Cash----
      const AllBankCash = await this._db.voucherHeader.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } },
          ],
          Status: 'A',
          subledgerMaster: {
            Status: 'A',
            SubledgerType: 'Customer',
          },
        },
        select: {
          CashOrBank: true,
          LocalAmount: true,
          Amount: true,
          subledgerMaster: {
            select: {
              SubledgerMasterSid: true,
              SubledgerType: true,
              SubledgerName: true,
            },
          },
          VoucherDetail: {
            select: {
              DrCr: true,
              LedgerMasterSid: true,
              COAMasterSid: true,
            },
          },
        },
        orderBy: { VoucherDate: 'asc' },
      });

      const coamaster = await this._db.cOAMaster.findMany({
        select: {
          COAMasterSid: true,
          LedgerName: true,
        },
      });

      const customerMap = new Map<number, any>();

      AllBankCash.filter((bc) => bc.subledgerMaster).forEach((bc) => {
        if (!bc.subledgerMaster) return;
        const drCr = bc.VoucherDetail?.[0]?.DrCr;
        const subId = bc.subledgerMaster.SubledgerMasterSid;

        const drAmount = drCr === 'D' ? Number(bc.LocalAmount) : 0;
        const crAmount = drCr === 'C' ? Number(bc.LocalAmount) : 0;

        if (!customerMap.has(subId)) {
          customerMap.set(subId, {
            SubledgerMasterSid: subId,
            SubledgerName: bc.subledgerMaster.SubledgerName,
            Account:
              coamaster.find(
                (c) => c.COAMasterSid === bc.VoucherDetail?.[0]?.COAMasterSid,
              )?.LedgerName || '',
            DrAmount: 0,
            CrAmount: 0,
            Balance: 0,
          });
        }

        const customer = customerMap.get(subId);
        customer.DrAmount += drAmount;
        customer.CrAmount += crAmount;
        customer.Balance += drAmount - crAmount;
      });

      const AllCashAndBank = Array.from(customerMap.values());

      // ----Vendor Os ---------
      const vendorOsVouchers = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          VoucherDate: { gte: FromDate, lte: ToDate },
          Status: 'A',
          voucherTypeMaster: {
            DocumentTypeCode: 'VIN',
          },
        },
        include: {
          subledgerMaster: {
            where: {
              SubledgerType: 'Customer',
              Status: 'A',
            },
            select: {
              SubledgerName: true,
              SubledgerType: true,
              SubledgerMasterSid: true,
            },
          },
          voucherMatchings: {
            where: { Status: 'A' },
          },
        },
        orderBy: { VoucherDate: 'asc' },
      });

      const vendorReportData = vendorOsVouchers.map((v) => {
        const matchLocal = v.voucherMatchings.reduce(
          (acc, m) => acc + (m.DrCr === 'D' ? +m.LocalAmount : -m.LocalAmount),
          0,
        );

        const ageing =
          Math.floor(
            (+new Date() - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24),
          ) + 1;

        return {
          SubledgerMasterSid: v.subledgerMaster?.SubledgerMasterSid,
          SubledgerName: v.subledgerMaster?.SubledgerName,
          Ageing: ageing,
          OSLocalAmount: Number(v.LocalAmount) - Math.abs(matchLocal),
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

        vendor.TotalOutstanding += row.OSLocalAmount;
        vendor.buckets[bucket] += row.OSLocalAmount;
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
    } = params;

    try {
      let polCode: string | undefined;
      let podCode: string | undefined;

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
      }

      if (POD) {
        const podRow = await this._db.portMaster.findFirst({
          where: { PortMasterSid: Number(POD) },
          select: { PortCode: true, PortName: true },
        });
        podCode = podRow?.PortCode;
      }

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
          jobNo: m.MasterJobNumber,
          MBLNo: m.MBLNo,
          POL: m.POL,
          POD: m.POD,
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
          POL: h.POL,
          POD: h.POD,
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
          POL: b.POL,
          POD: b.POD,
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
        const routeKey = `${item.POL} - ${item.POD}`;

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
        const routeKey = `${item.POL} - ${item.POD}`;

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
        const routeKey = `${item.POL} - ${item.POD}`;

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
      const displayPOL = polCode ?? 'All';
      const displayPOD = podCode ?? 'All';
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
      Branch: BranchMasterSid,
      DeptId: DepartmentMasterSid,
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
          BranchMasterSid,
          AND: [
            { MasterJobDate: { gte: from } },
            { MasterJobDate: { lte: to } },
          ],
        };

        if (DepartmentMasterSid) {
          baseWhere.DepartmentMasterSid = DepartmentMasterSid;
        }

        const departments = await this._db.departmentMaster.findMany({
          select: { DepartmentMasterSid: true, departmentName: true },
        });

        const masterJobData = await this._db.masterJob.findMany({
          where: baseWhere,
          include: {
            houseJob: true,
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

        if (!masterJobData.length) return [];

        const masterJobMenu = await this._db.menuMaster.findFirst({
          where: { MenuName: 'Master Job' },
          select: { MenuMasterSid: true },
        });

        const houseJobMenu = await this._db.menuMaster.findFirst({
          where: { MenuName: 'House Job' },
          select: { MenuMasterSid: true },
        });

        const masterJobIds = masterJobData.map((m) => m.MasterJobSid);

        const houseJobIds: number[] = masterJobData
          .flatMap((m) => m.houseJob)
          .map((h) => h.HouseJobSid)
          .filter((id): id is number => typeof id === 'number');

        const masterCR = await this._db.costRevenueCharges.findMany({
          where: {
            MenuMasterSid: masterJobMenu?.MenuMasterSid,
            TransactionSid: { in: masterJobIds },
            status: 'A',
          },
        });

        const houseCR = await this._db.costRevenueCharges.findMany({
          where: {
            MenuMasterSid: houseJobMenu?.MenuMasterSid,
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
            department:
              departments.find(
                (d) => d.DepartmentMasterSid === m.DepartmentMasterSid,
              )?.departmentName || '',
            shipmentCount: m.houseJob.length,
            grossWt: totalGrossWt,
            vol: totalVol,
            totalRevenue,
            totalCost,
            grossProfit,
            totalNoOfTEU,
          };
        });

        const departmentWise = Object.values(
          jobRows.reduce((acc: any, row) => {
            if (row.department.toLowerCase().includes('air')) return acc;

            if (!acc[row.department]) {
              acc[row.department] = {
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

            acc[row.department].totalShipment += row.shipmentCount;
            acc[row.department].totalGrossWt += row.grossWt;
            acc[row.department].totalVolume += row.vol;
            acc[row.department].totalRevenue += row.totalRevenue;
            acc[row.department].totalCost += row.totalCost;
            acc[row.department].grossProfit += row.grossProfit;
            acc[row.department].totalNoOfTEU += row.totalNoOfTEU;
            acc[row.department].jobCount += 1;

            return acc;
          }, {}),
        );

        return departmentWise;
      };

      /* ---------- FETCH BOTH ---------- */

      const currentMonthData = await fetchDepartmentData(
        currentFrom,
        currentTo,
      );
      const previousMonthData = await fetchDepartmentData(prevFrom, prevTo);

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
      };
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
    context: { companyId?: number; branchId?: number },
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

      // Validate and sanitize the query
      this.validateQuery(parameter.ParameterQuery);

      // Substitute context variables in the query
      let query = parameter.ParameterQuery;
      if (context.companyId) {
        query = query.replace(/\{companyId\}/g, context.companyId.toString());
      }
      if (context.branchId) {
        query = query.replace(/\{branchId\}/g, context.branchId.toString());
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
