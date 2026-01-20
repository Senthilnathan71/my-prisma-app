import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { ApprovalStatus, Prisma, PrismaClient } from '@prisma/client';
import { BLIssueListReportQueryDto, ContainerKPIReportQueryDto, DestinationReportQueryDto, DOIssueListReportQueryDto, exportJobVolumeTEUReportQueryDto, houseJobLossReportQueryDto, lostCustomerReportQueryDto, profitabilityReportQueryDto, ProfitSummaryReportQueryDto, ShipmentDetailedSummaryReportQueryDto, ShipmentSummaryReportQueryDto, tradelaneProfitabilityReportQueryDto, unbilledcostReportQueryDto } from 'src/operation/DTO/operation-reports.dto';
import { toNumber } from 'src/common/helper';

@Injectable()
export class OperationReportsService {
  constructor(
    private _db: DatabaseService,
    private logger: Logger
  ) { }

  async getAvailableReports(companyId: number) {
    try {
      // Get all operation reports
      const operationMenu = await this._db.menuMaster.findFirst({
        where: {
          MenuName: 'Operation Reports',
          status: 'A'
        }
      });

      if (!operationMenu) {
        return [];
      }

      const allReports = await this._db.reportMaster.findMany({
        where: {
          ReportMenuSid: operationMenu.MenuMasterSid,
          Status: 'A'
        },
        include: {
          ReportMasterDetail: {
            where: { Status: 'A' },
            orderBy: { ReportMasterDetailSid: 'asc' }
          }
        },
        orderBy: { ReportMasterSid: 'asc' }
      });

      // Filter by company exclusion
      const filteredReports = allReports.filter(report => {
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
          Status: 'A'
        },
        include: {
          ReportMasterDetail: {
            where: { Status: 'A' },
            orderBy: { ReportMasterDetailSid: 'asc' }
          }
        }
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
      this.logger.log(`Getting BL_Issue report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`);

      const branches = branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: branchId } },
          select: { BranchMasterSid: true, branchName: true },
        })
        : await this._db.branchMaster.findMany({
          where: { CompanyMasterSid },
          select: { BranchMasterSid: true, branchName: true },
        });

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
      const branchSet = new Set(resolvedBranchNames);


      const departments = deptId && deptId.length > 0
        ? await this._db.departmentMaster.findMany({
          where: { DepartmentMasterSid: { in: deptId } },
          select: { DepartmentMasterSid: true, departmentName: true },
        })
        : await this._db.departmentMaster.findMany({
          where: { CompanyMasterSid },
          select: { DepartmentMasterSid: true, departmentName: true },
        });

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [
            { HBLDate: { gte: FromHblDt } },
            { HBLDate: { lte: ToHblDt } }
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
            }
          },
          departmentMaster: {
            select: {
              departmentName: true
            }
          }
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (houseJobData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return { companyMasterSid: CompanyMasterSid, branchMasterSid: branchId, data: [] };
      }

      const data = houseJobData.map(hj => {

        const masterJob = hj.masterJob;
        const departmentName = hj.departmentMaster?.departmentName || null;

        return {
          HBLDate: hj.HBLDate,
          HBLNo: hj.HBLNo,
          MBLNo: masterJob ? masterJob.MBLNo : null,
          BookingNo: hj.BookingNo,
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
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        BLIssue,
      };

    } catch (error) {
      this.logger.error(`Error generating shipment summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Shipment_summary_Report
  private async generateShipmentSummaryReport(params: ShipmentSummaryReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToJobDt,
      FromJobDt,
      Branch: branchId,
      Dept: deptId
    } = params;

    try {
      this.logger.log(`Getting shipment summary report for CompanySid=${CompanyMasterSid}, From=${FromJobDt}, To=${ToJobDt}`);

      const branches = branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: branchId } },
          select: { BranchMasterSid: true, branchName: true },
        })
        : await this._db.branchMaster.findMany({
          where: { CompanyMasterSid },
          select: { BranchMasterSid: true, branchName: true },
        });

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
      const branchSet = new Set(resolvedBranchNames);


      const departments = deptId && deptId.length > 0
        ? await this._db.departmentMaster.findMany({
          where: { DepartmentMasterSid: { in: deptId } },
          select: { DepartmentMasterSid: true, departmentName: true },
        })
        : await this._db.departmentMaster.findMany({
          where: { CompanyMasterSid },
          select: { DepartmentMasterSid: true, departmentName: true },
        });

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true }
      });

      // Map ID → Name for fast lookup
      const containerTypeMap = new Map(
        containerTypesMaster.map(ct => [ct.ContainerTypeMasterSid, ct.ContainerSize])
      );

      const agentMaster = await this._db.customerMaster.findMany({
        select: {
          CustomerMasterSid: true,
          CustomerName: true
        }
      });

      const masterJobData = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [
            { MBLDate: { gte: FromJobDt } },
            { MBLDate: { lte: ToJobDt } }
          ],
          Status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          houseJob: { include: { Cargo: true } },
          containers: {
            where: { Status: 'A' },
            include: {
              containerType: {
                select: {
                  ContainerSize: true,
                  NoOfTeu: true,
                }
              }
            }
          },
          voyages: true,
        },
        orderBy: { MBLDate: 'asc' },
      });



      if (masterJobData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return { companyMasterSid: CompanyMasterSid, branchMasterSid: branchId, data: [] };
      }

      const portCodes = new Set<string>();

      masterJobData.forEach(mj => {
        if (mj.POL) portCodes.add(mj.POL);
        if (mj.POD) portCodes.add(mj.POD);
        if (mj.FPD) portCodes.add(mj.FPD);
        if (mj.POO) portCodes.add(mj.POO);
        // Add any other port fields you need
      });

      // Fetch port details
      const ports = await this._db.portMaster.findMany({
        where: {
          PortCode: { in: Array.from(portCodes) }
        },
        select: {
          PortCode: true,
          PortName: true
        }
      });

      // Create a map of port code to port name
      const portMap = new Map(
        ports.map(port => [port.PortCode, port.PortName])
      );

      const containerSize = ["20'", "40'", "45'"];

      // Map the master job data
      const data = masterJobData.map(mj => {
        // Determine the type based on destinationPort (or any other field)
        const type = mj.DestinationAgent ? 'Agent' : null;

        // Sum volumes for local shipment (Import + Export)
        const localShipmentVol = mj.houseJob?.reduce((sum, job) => {
          if (job.JobType === 'Import' || job.JobType === 'Export') {
            return sum + (job.Cargo?.reduce((cSum, cargo) => cSum + Number(cargo.Volume || 0), 0) || 0);
          }
          return sum;
        }, 0) || 0;

        // Sum volumes for transhipment shipment
        const transhipmentVol = mj.houseJob?.reduce((sum, job) => {
          if (job.JobType === 'Transhipment') {
            return sum + (job.Cargo?.reduce((cSum, cargo) => cSum + Number(cargo.Volume || 0), 0) || 0);
          }
          return sum;
        }, 0) || 0;

        const masterContainerSid = mj.containers?.[0]?.MasterJobContainerSid;

        const containerInfo = (mj.containers || [])
          .filter(c => c.MasterJobContainerSid === masterContainerSid)
          .map(c => {
            const containerTypeId = c.ContainerType;
            return {
              containerNumber: c.ContainerNumber,
              containerType: containerTypeId != null
                ? containerTypeMap.get(containerTypeId) || `Unknown(${containerTypeId})`
                : 'Unknown',
            };
          });

        const containerCountByType: Record<string, number> = {};
        let totalNoOfTEU = 0;
        let numberOfFourtyFt = 0;
        let numberofFurtyFive = 0;
        let numberOfTwentyFt = 0;
        containerSize.forEach(col => containerCountByType[col] = 0);

        (mj.containers || []).forEach(c => {

          totalNoOfTEU += toNumber(c.containerType?.NoOfTeu);

          if (c.containerType?.ContainerSize.trim() === '20') {
            numberOfTwentyFt++;
          }

          if (c.containerType?.ContainerSize.trim() === '40') {
            numberOfFourtyFt++;
          }

          if (c.containerType?.ContainerSize.trim() === '45') {
            numberofFurtyFive++;
          }
        });


        const polName = mj.POL ? portMap.get(mj.POL) || '' : '';
        const podName = mj.POD ? portMap.get(mj.POD) || '' : '';
        const fpdName = mj.FPD ? portMap.get(mj.FPD) || '' : '';
        const pooName = mj.FPD ? portMap.get(mj.POO) || '' : '';

        return {
          masterNo: mj.MasterJobNumber,
          masterDate: mj.MBLDate,
          department: departments.find(d => d.DepartmentMasterSid === mj.DepartmentMasterSid)?.departmentName || '',
          mblNo: mj.MBLNo || '',
          vesselName: mj?.voyages?.[0]?.VesselName || '',
          voyageNo: mj?.voyages?.[0]?.VoyageNo || '',
          etd: mj?.voyages?.[0]?.ETD || '',
          eta: mj?.voyages?.[0]?.ETA || '',
          originPort: mj.POO || '',
          originPortName: pooName || '',
          loadPort: mj.POL || '',
          loadPortName: polName,
          dischargePort: mj.POD || '',
          dischargePortName: podName,
          destinationPort: mj.FPD || '',
          destinationPortName: fpdName,
          carrier: mj?.voyages?.[0]?.CarrierName || '',
          weight: mj.GrossWeight || 0,
          volume: mj.Volume || 0,
          chargeable: mj.ChargeableWeight || 0,
          noOfContainers: mj.houseJob?.reduce((sum, job) => sum + (job.Cargo?.reduce((cSum, cargo) => cSum + (cargo.NoofContainers || 0), 0) || 0), 0) || 0,
          shipper: mj.houseJob?.[0]?.ShipperName || '',
          containerNoList: mj?.containers?.map((c: any) => c.ContainerNumber).join(', ') || '',
          mastercontainerSid: mj?.containers?.map((c: any) => c.mastercontainerSid).join(', ') || '',
          masterContanierSid: mj?.containers?.[0]?.MasterJobContainerSid,
          sendingAgent: agentMaster.find(d => d.CustomerMasterSid === mj.OriginAgent)?.CustomerName || '',
          receivingAgent: agentMaster.find(d => d.CustomerMasterSid === mj.DestinationAgent)?.CustomerName || '',
          type,
          containerInfo,
          totalNoOfTEU,
          numberOfTwentyFt,
          numberOfFourtyFt,
          numberofFurtyFive,
          localShipment: mj.houseJob?.filter(job => job.JobType === 'Import' || job.JobType === 'Export').length || 0,
          transhipmentShipment: mj.houseJob?.filter(job => job.JobType === 'Transhipment').length || 0,
          totalShipment: (mj.houseJob?.filter(job => job.JobType === 'Import' || job.JobType === 'Export').length || 0) +
            (mj.houseJob?.filter(job => job.JobType === 'Transhipment').length || 0),
          localShipmentVol,
          transhipmentVol,
          houseStatus:mj.houseJob?.[0]?.HouseStatus
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
      };

    } catch (error) {
      this.logger.error(`Error generating shipment summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Profitability_Report
  private async generateProfitabilityReport(params: profitabilityReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToJobDt,
      FromJobDt,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      this.logger.log(
        `Getting Profitability report for CompanySid=${CompanyMasterSid}, From=${FromJobDt}, To=${ToJobDt}`
      );

      const branches = branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: branchId } },
          select: { BranchMasterSid: true, branchName: true },
        })
        : await this._db.branchMaster.findMany({
          where: { CompanyMasterSid },
          select: { BranchMasterSid: true, branchName: true },
        });

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
      const branchSet = new Set(resolvedBranchNames);


      const departments = deptId && deptId.length > 0
        ? await this._db.departmentMaster.findMany({
          where: { DepartmentMasterSid: { in: deptId } },
          select: { DepartmentMasterSid: true, departmentName: true },
        })
        : await this._db.departmentMaster.findMany({
          where: { CompanyMasterSid },
          select: { DepartmentMasterSid: true, departmentName: true },
        });

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      // Load container type master (ID → Size Map)
      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true }
      });
      const containerTypeMap = new Map(
        containerTypesMaster.map(ct => [ct.ContainerTypeMasterSid, ct.ContainerSize])
      );

      // Fetch master jobs with house jobs and containers
      const masterJobs = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [
            { MBLDate: { gte: FromJobDt } },
            { MBLDate: { lte: ToJobDt } }
          ],
          Status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          houseJob: {
            where: { status: 'A' }
          },
          containers: true,
        },
        orderBy: { MBLDate: 'asc' },
      });

      if (!masterJobs.length) {
        return { companyMasterSid: CompanyMasterSid, branchMasterSid: branchId, data: [] };
      }

      // Map each master job to its CostRevenueCharges
      const data = await Promise.all(masterJobs.map(async job => {

        // Fetch cost & revenue charges for all master jobs
        const relatedCR = await this._db.costRevenueCharges.findMany({
          where: {
            MenuMasterSid: job.MenuMasterSid!,
            TransactionSid: job.MasterJobSid,
            status: 'A'
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
            RevenueVoucherHeaderSid: true
          }
        });

        const totalCost = relatedCR.reduce((sum, cr) => {
          return cr.CostDrCr === 'D' ? toNumber(sum) + toNumber(cr.CostLocalAmount) :
            toNumber(sum) - toNumber(cr.CostLocalAmount)
        }, 0);

        const totalRevenue = relatedCR.reduce((sum, cr) => {
          return cr.RevenueDrCr === 'C' ? toNumber(sum) + toNumber(cr.RevenueLocalAmount) :
            toNumber(sum) - toNumber(cr.RevenueLocalAmount)
        }, 0);



        const houseJobs = job.houseJob || [];

        const houseRateMap: Map<number, any[]> = new Map([]);

        const houseJobIds = new Set(houseJobs.map(hj => hj.HouseJobSid));
        const houseJobIdArr = houseJobs.map(hj => hj.HouseJobSid);
        const houseJobMenu = await this._db.menuMaster.findFirst({
          where: { MenuName: 'House Job' },
          select: { MenuMasterSid: true }
        })

        if (!houseJobMenu) {
          throw new BadRequestException("House Job is found in menuMaster.")
        }

        const allHouseCR = await this._db.costRevenueCharges.findMany({
          where: {
            MenuMasterSid: houseJobMenu.MenuMasterSid,
            TransactionSid: { in: houseJobIdArr },
            status: 'A'
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
            RevenueVoucherHeaderSid: true

          }
        })

        allHouseCR.forEach(hcr => {
          const key = hcr.TransactionSid!;
          if (houseRateMap.has(key)) {
            const prev = houseRateMap.get(key) || [];
            houseRateMap.set(key, [...prev, hcr]);
          } else {
            houseRateMap.set(key, [hcr]);
          }
        })


        // Count containers by size
        let number20 = 0, number40 = 0, number45 = 0;
        (job.containers || []).forEach(c => {
          const typeId = c.ContainerType ?? null;
          if (!typeId) return;
          const size = containerTypeMap.get(typeId)?.trim() ?? null;
          if (size === "20") number20++;
          if (size === "40") number40++;
          if (size === "45") number45++;
        });

        // First, calculate total for house jobs
        let totalHouseCost = 0;
        let totalHouseRevenue = 0;

        const houseJobsData = houseJobs.map(house => {
          const costRevenues = houseRateMap.get(house.HouseJobSid) || [];

          const totalCost = costRevenues.reduce((sum, cr) => {
            return cr.CostDrCr === 'D' ? Number(sum) + Number(cr.CostLocalAmount ?? 0) :
              Number(sum) - Number(cr.CostLocalAmount ?? 0);
          }, 0);

          const totalRevenue = costRevenues.reduce((sum, cr) => {
            return cr.RevenueDrCr === 'C' ? Number(sum) + Number(cr.RevenueLocalAmount ?? 0) :
              Number(sum) - Number(cr.RevenueLocalAmount ?? 0);
          }, 0);

          totalHouseCost += totalCost;
          totalHouseRevenue += totalRevenue;

          return {
            HouseJobSid: house.HouseJobSid,
            HouseNo: house.HouseNo,
            HBLNo: house.HBLNo,
            totalCost,
            totalRevenue
          };
        });

        // Combine master job totals with house jobs totals
        const totalCostWithHouse = totalCost + totalHouseCost;
        const totalRevenueWithHouse = totalRevenue + totalHouseRevenue;


        // actual Gp 

        const GP = totalRevenueWithHouse - totalCostWithHouse;

        // using VoucherNo

        const masterVouchers = relatedCR.filter(cr => cr.CostVoucherHeaderSid); // only those with vouchers
        const actualCostMaster = masterVouchers.reduce((sum, cr) => {
          return cr.CostDrCr === 'D' ? Number(sum) + Number(cr.CostLocalAmount ?? 0) :
            Number(sum) - Number(cr.CostLocalAmount ?? 0);
        }, 0);

        const masterV = relatedCR.filter(cr => cr.RevenueVoucherHeaderSid);
        const actualRevenueMaster = masterV.reduce((sum, cr) => {
          return cr.RevenueDrCr === 'C' ? Number(sum) + Number(cr.RevenueLocalAmount ?? 0) :
            Number(sum) - Number(cr.RevenueLocalAmount ?? 0);
        }, 0);

        // Calculate for HouseJobs
        let actualCostHouse = 0;
        let actualRevenueHouse = 0;

        houseJobsData.forEach(house => {
          const voucherCRs = (houseRateMap.get(house.HouseJobSid) || []).filter(cr => cr.CostVoucherHeaderSid);

          const cost = voucherCRs.reduce((sum, cr) => {
            return cr.CostDrCr === 'D' ? Number(sum) + Number(cr.CostLocalAmount ?? 0) :
              Number(sum) - Number(cr.CostLocalAmount ?? 0);
          }, 0);


          const voucherrevensid = (houseRateMap.get(house.HouseJobSid) || []).filter(cr => cr.RevenueVoucherHeaderSid);
          const revenue = voucherrevensid.reduce((sum, cr) => {
            return cr.RevenueDrCr === 'C' ? Number(sum) + Number(cr.RevenueLocalAmount ?? 0) :
              Number(sum) - Number(cr.RevenueLocalAmount ?? 0);
          }, 0);

          actualCostHouse += cost;
          actualRevenueHouse += revenue;
        });

        // Final totals based on vouchers
        const actualCost = actualCostMaster + actualCostHouse;
        const actualRevenue = actualRevenueMaster + actualRevenueHouse;
        const actualGp = actualRevenue - actualCost;
        const profit = (Number(GP) * 100) / Number(totalRevenueWithHouse);
        const space = Number(job?.ChargeableWeight) - Number(job?.Volume);
        return {
          jobNumber: job.MasterJobNumber,
          Mbl: job.MBLNo,
          POL: job.POL,
          POD: job.POD,
          chargeable: job?.ChargeableWeight ?? 0,
          Vol: job?.Volume ?? 0,
          noOfShipment: job.houseJob?.length ?? 0,
          GP,
          actualRevenue,
          actualCost,
          profit,
          actualGp,
          containerNo: job?.containers?.[0]?.ContainerNumber ?? null,
          twentyft: number20,
          fourty: number40,
          fourtyfive: number45,
          totalCost,
          totalRevenue,
          totalCostWithHouse,
          totalRevenueWithHouse,
          houseCount: houseJobs.length || 0,
          houseJobs: houseJobsData,
          space
        };

      })
      );

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params
      };

    } catch (error) {
      this.logger.error(`Error generating profitability report: ${error.message}`, error.stack);
      throw error;
    }
  }

  //    private async generateProfitabilityReport(params: profitabilityReportQueryDto) {
  //   const {
  //     companyId: CompanyMasterSid,
  //     ToJobDt,
  //     FormJobDt,
  //     Branch: branchId,
  //     Dept: dept,
  //   } = params;

  //   try {
  //     this.logger.log(
  //       `Getting Profitability report for CompanySid=${CompanyMasterSid}, From=${FormJobDt}, To=${ToJobDt}`
  //     );

  //     const allBranches = await this._db.branchMaster.findMany({
  //       where: { BranchMasterSid: { in: branchId } },
  //       select: { branchName: true }
  //     });
  //     const branchSet = new Set(allBranches.map(b => b.branchName));

  //     // Load container type master (ID → Size Map)
  //     const containerTypesMaster = await this._db.containerTypeMaster.findMany({
  //       select: { ContainerTypeMasterSid: true, ContainerSize: true }
  //     });
  //     const containerTypeMap = new Map(
  //       containerTypesMaster.map(ct => [ct.ContainerTypeMasterSid, ct.ContainerSize])
  //     );

  //     // Fetch master jobs with house jobs and containers
  //     const masterJobs = await this._db.masterJob.findMany({
  //       where: {
  //         CompanyMasterSid,
  //         BranchMasterSid: { in: branchId },
  //         AND: [
  //           { MBLDate: { gte: new Date(FormJobDt) } },
  //           { MBLDate: { lte: new Date(ToJobDt) } }
  //         ],
  //         Status: 'A',
  //         DepartmentMasterSid: { in: dept },
  //       },
  //       include: {
  //         houseJob: {
  //           where : { status : 'A'}
  //         },
  //         containers: true,
  //       },
  //       orderBy: { MBLDate: 'asc' },
  //     });

  //     if (!masterJobs.length) {
  //       return { companyMasterSid: CompanyMasterSid, branchMasterSid: branchId, data: [] };
  //     }




  //     const data = await Promise.all(masterJobs.map(async job => {


  //       const relatedCR = await this._db.costRevenueCharges.findMany({
  //         where: {
  //           MenuMasterSid: job.MenuMasterSid!,
  //           TransactionSid: job.MasterJobSid,
  //           status: 'A'
  //         },
  //         select: {
  //           MenuMasterSid: true,
  //           CostLocalAmount: true,
  //           RevenueLocalAmount: true,
  //           ChargeDescription: true,
  //           ChargeMasterSid: true,
  //           CostAgentMasterSid: true,
  //           RevenueCustomerMasterSid: true,
  //           CostDrCr: true,
  //           RevenueDrCr: true
  //         }
  //       });

  //       const totalCost = relatedCR.reduce((sum, cr) => {
  //         return cr.CostDrCr === 'D' ? toNumber(sum) + toNumber(cr.CostLocalAmount) :
  //           toNumber(sum) - toNumber(cr.CostLocalAmount)
  //       }, 0);

  //       const totalRevenue = relatedCR.reduce((sum, cr) => {
  //         return cr.RevenueDrCr === 'C' ? toNumber(sum) + toNumber(cr.RevenueLocalAmount) :
  //           toNumber(sum) - toNumber(cr.RevenueLocalAmount)
  //       }, 0);

  //       const GP = totalRevenue - totalCost;

  //       const houseJobs = job.houseJob || [];

  //       const houseRateMap: Map<number, any[]> = new Map([]);

  //       const houseJobIds = new Set(houseJobs.map(hj => hj.HouseJobSid));
  //       const houseJobIdArr = houseJobs.map(hj => hj.HouseJobSid);
  //       const houseJobMenu = await this._db.menuMaster.findFirst({
  //         where: { MenuName: 'House Job' },
  //         select: { MenuMasterSid: true }
  //       })

  //       if (!houseJobMenu) {
  //         throw new BadRequestException("House Job is found in menuMaster.")
  //       }

  //       const allHouseCR = await this._db.costRevenueCharges.findMany({
  //         where: {
  //           MenuMasterSid: houseJobMenu.MenuMasterSid,
  //           TransactionSid: { in: houseJobIdArr },
  //           status: 'A'
  //         },
  //         select: {
  //           TransactionSid: true,
  //           MenuMasterSid: true,
  //           CostLocalAmount: true,
  //           RevenueLocalAmount: true,
  //           ChargeDescription: true,
  //           ChargeMasterSid: true,
  //           CostAgentMasterSid: true,
  //           RevenueCustomerMasterSid: true,
  //           CostDrCr: true,
  //           RevenueDrCr: true
  //         }
  //       })

  //       allHouseCR.forEach(hcr => {
  //         const key = hcr.TransactionSid!;
  //         if (houseRateMap.has(key)) {
  //           const prev = houseRateMap.get(key) || [];
  //           houseRateMap.set(key, [...prev, hcr]);
  //         } else {
  //           houseRateMap.set(key, [hcr]);
  //         }
  //       })



  //       let number20 = 0, number40 = 0, number45 = 0;
  //       (job.containers || []).forEach(c => {
  //         const typeId = c.ContainerType ?? null;
  //         if (!typeId) return;
  //         const size = containerTypeMap.get(typeId)?.trim() ?? null;
  //         if (size === "20") number20++;
  //         if (size === "40") number40++;
  //         if (size === "45") number45++;
  //       });




  //       return {
  //         jobNumber: job.MasterJobNumber,
  //         Mbl: job.MBLNo,
  //         POL: job.POL,
  //         POD: job.POD,
  //         chargeable: job?.ChargeableWeight ?? 0,
  //         Vol: job?.Volume ?? 0,
  //         noOfShipment: job.houseJob?.length ?? 0,
  //         GP,
  //         containerNo: job?.containers?.[0]?.ContainerNumber ?? null,
  //         twentyft: number20,
  //         fourty: number40,
  //         fourtyfive: number45,
  //         totalCost,
  //         totalRevenue,
  //         houseCount : houseJobs.length || 0,
  //         houseJobs: houseJobs.map(house => {
  //           const costRevenues = houseRateMap.get(house.HouseJobSid) || [];
  //           const totalCost = costRevenues.reduce((sum, cr) => {
  //             return cr.CostDrCr === 'D' ? toNumber(sum) + toNumber(cr.CostLocalAmount) :
  //               toNumber(sum) - toNumber(cr.CostLocalAmount)
  //           }, 0);

  //           const totalRevenue = costRevenues.reduce((sum, cr) => {
  //             return cr.RevenueDrCr === 'C' ? toNumber(sum) + toNumber(cr.RevenueLocalAmount) :
  //               toNumber(sum) - toNumber(cr.RevenueLocalAmount)
  //           }, 0);
  //           return {
  //             HouseJobSid: house.HouseJobSid,
  //             HouseNo: house.HouseNo,
  //             HBLNo : house.HBLNo,
  //             totalCost,
  //             totalRevenue
  //           }
  //         })
  //       };
  //     })
  //     );

  //     return {
  //       companyMasterSid: CompanyMasterSid,
  //       branchMasterSid: branchId,
  //       data,
  //       branchesInvolved: Array.from(branchSet).join(','),
  //       params
  //     };

  //   } catch (error) {
  //     this.logger.error(`Error generating profitability report: ${error.message}`, error.stack);
  //     throw error;
  //   }
  // }

  async generateLostCustomerReport(params: lostCustomerReportQueryDto) {
    try {
      const {
        companyId,
        customer,
        Branch,
        department,
        BookingFromDate: FromDate,
        BookingToDate: ToDate,
        salesman
      } = params;


      /* -------------------- CUSTOMER IDS -------------------- */
      let allCustomerIds: number[] = [];

      if (Array.isArray(customer) && customer.length > 0) {
        const validCustomers = await this._db.customerMaster.findMany({
          where: {
            CustomerMasterSid: { in: customer },
            createdOn: { lt: FromDate }
          }
        })
        if (!validCustomers) {
          throw new BadRequestException("No customer found")
        }
        allCustomerIds = validCustomers.map(cus => cus.CustomerMasterSid);
      } else if (typeof customer === 'number') {
        const validCustomer = await this._db.customerMaster.findUnique({
          where: {
            CustomerMasterSid: customer,
            createdOn: { lt: FromDate }
          }
        })
        if (!validCustomer) {
          throw new BadRequestException("No customer found")
        }
        allCustomerIds.push(customer);
      } else {
        const customers = await this._db.customerMaster.findMany({
          where: {
            CompanyMasterSid: companyId,
            createdOn: { lt: FromDate },
            status: 'A'
          },
          select: {
            CustomerMasterSid: true
          }
        });

        customers.forEach(c => allCustomerIds.push(c.CustomerMasterSid));
      }


      /* -------------------- BRANCH IDS -------------------- */
      const allBranchIds: number[] = [];

      if (Array.isArray(Branch) && Branch.length > 0) {
        allBranchIds.push(...Branch);
      } else if (typeof Branch === 'number') {
        allBranchIds.push(Branch);
      } else {
        const branches = await this._db.branchMaster.findMany({
          where: {
            CompanyMasterSid: companyId,
            status: 'A'
          },
          select: {
            BranchMasterSid: true
          }
        });

        branches.forEach(b => allBranchIds.push(b.BranchMasterSid));
      }


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
            Status: 'A'
          },
          select: {
            DepartmentMasterSid: true,
            departmentName:true,
          }
        });

        departments.forEach(d => allDepartmentIds.push(d.DepartmentMasterSid));
      }



      /* -------------------- GUARD EMPTY ARRAYS -------------------- */
      if (
        !allCustomerIds.length ||
        !allBranchIds.length ||
        !allDepartmentIds.length
      ) {
        return {
          status: true,
          data: [],
          companyId,
          Branch
        };
      }

      /* -------------------- BASE WHERE CLAUSE -------------------- */
      const baseWhereClause: Prisma.BookingHeaderWhereInput = {
        CompanyMasterSid: companyId,
        BranchMasterSid: { in: allBranchIds },
        CustomerMasterSid: { in: allCustomerIds },
        DepartmentMasterSid: { in: allDepartmentIds },
       AND:[
        {BookingDateTime:{gte:FromDate}},
        {BookingDateTime:{lte:ToDate}}
       ],
        status: 'A'
      };

      if (salesman) {
        baseWhereClause.SalesmanSid = salesman;
      }

      /* -------------------- CUSTOMERS WHO BOOKED -------------------- */
      const customerBookingCount = await this._db.bookingHeader.groupBy({
        by: ['CustomerMasterSid'],
        where: baseWhereClause,
        _count: { _all: true }
      });

      /* -------------------- LOST CUSTOMERS -------------------- */
      const customerHavingBookings = customerBookingCount
        .map(lc => lc.CustomerMasterSid).filter(Boolean);

      // console.log("ALL CUSTOMER IDS",allCustomerIds);
      // console.log("Customer vs Booking count",customerBookingCount);
      // console.log("CUSTOMER HAVING BOOKING",customerHavingBookings);
      const finalLostCustomers = allCustomerIds.filter(cus => !customerHavingBookings.includes(cus));
      // console.log("LOST CUSTOMER IDS",finalLostCustomers);

      /* -------------------- LAST BOOKING + RATES -------------------- */
      const getLastBookingOfCustomer = async (CustomerMasterSid: number) => {

        const lastBooking = await this._db.bookingHeader.findFirst({
          where: {
            CompanyMasterSid: companyId,
            BranchMasterSid: { in: allBranchIds },
            DepartmentMasterSid: { in: allDepartmentIds },
            CustomerMasterSid,
            status: 'A'
          },
          orderBy: {
            BookingDateTime: 'desc'
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
                ContactNo: true
              }
            },
            SalesmanSid: true
          }
        });

        if (!lastBooking) return null;

        /* -------- BOOKING RATES -------- */
        const bookingRates = await this._db.bookingRates.aggregate({
          where: {
            BookingHeaderSid: lastBooking.BookingHeaderSid
          },
          _sum: {
            RevenueLocalAmount: true,
            CostLocalAmount: true
          }
        });

        const revenue = bookingRates._sum.RevenueLocalAmount ?? 0;
        const cost = bookingRates._sum.CostLocalAmount ?? 0;
        let days = 0;

        if (lastBooking.BookingDateTime && ToDate) {
          days = Math.floor(
            (new Date(ToDate).getTime() -
              lastBooking.BookingDateTime.getTime()) /
            (1000 * 60 * 60 * 24)
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
          SalesmanName: await this.getSalespersonName(companyId, lastBooking.SalesmanSid) || "",
          RevenueLocalAmount: revenue,
          CostLocalAmount: cost,
          GP: Number(revenue) - Number(cost),
          days
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
        Branch,
        params
      };

    } catch (error) {
      console.error('Lost Customer Report Error:', error);
      throw error;
    }
  }

  private async generateContainerwiseDetailsReport(params: ContainerKPIReportQueryDto) {
    // TODO: Implement Containerwise Master Details with Cost/Revenue logic
    this.logger.log('generateContainerwiseDetailsReport called with params:', params);
    throw new BadRequestException('Containerwise Details Report generator not yet implemented');
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
      this.logger.log(`Getting Container_Wise_KPI report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`);

      const branches = branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: branchId } },
          select: { BranchMasterSid: true, branchName: true },
        })
        : await this._db.branchMaster.findMany({
          where: { CompanyMasterSid },
          select: { BranchMasterSid: true, branchName: true },
        });

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
      const branchSet = new Set(resolvedBranchNames);


      const departments = deptId && deptId.length > 0
        ? await this._db.departmentMaster.findMany({
          where: { DepartmentMasterSid: { in: deptId } },
          select: { DepartmentMasterSid: true, departmentName: true },
        })
        : await this._db.departmentMaster.findMany({
          where: { CompanyMasterSid },
          select: { DepartmentMasterSid: true, departmentName: true },
        });

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      // charge master
      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeGroup: true }
      });

      const chargeGroupMap = new Map<number, any>();

      chargeMaster.forEach(cm => {
        chargeGroupMap.set(cm.ChargeMasterSid, cm.chargeGroup);
      });

      // port master - get port names and codes for matching
      const portMaster = await this._db.portMaster.findMany({
        select: {
          PortMasterSid: true,
          PortName: true,
          PortCode: true,
          CountryMasterSid: true
        }
      });

      const portNameToCountryMap = new Map<string, number>();
      const portCodeToCountryMap = new Map<string, number>();

      portMaster.forEach(port => {
        if (port.PortName && port.CountryMasterSid != null) {
          portNameToCountryMap.set(port.PortName.toUpperCase().trim(), port.CountryMasterSid);
        }
        if (port.PortCode && port.CountryMasterSid != null) {
          portCodeToCountryMap.set(port.PortCode.toUpperCase().trim(), port.CountryMasterSid);
        }
      });

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true, ContainerName: true }
      });

      // Map ID → Name for fast lookup
      const containerTypeMap = new Map<number, { name: string; size: string }>();

      containerTypesMaster.forEach(c => {
        containerTypeMap.set(c.ContainerTypeMasterSid, {
          name: c.ContainerSize || '',
          size: c.ContainerName || ''
        });
      });


      // country Master
      const countryMaster = await this._db.countryMaster.findMany({
        select: { CountryMasterSid: true, countryName: true }
      });

      // Create map for CountryMasterSid -> countryName
      const countryIdToNameMap = new Map<number, string>();
      countryMaster.forEach(country => {
        if (country.CountryMasterSid != null && country.countryName != null) {
          countryIdToNameMap.set(country.CountryMasterSid, country.countryName);
        }
      });



      const houseData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,

          AND: [
            { HBLDate: { gte: FromHblDt } },
            { HBLDate: { lte: ToHblDt } }
          ],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          masterJob: {
            where: {
              Status: "A"
            },
            select: {
              voyages: true,
              containers: true
            }
          },
          bookingHeader: true,
          Products: {
            where: {
              status: "A"
            },
            select: {
              ContainerNo: true,
              MasterJobContainerSid: true,
              Volume: true,
              GrossWeight: true,
              IsHaz: true,
            }
          },
          Cargo: true,
          Others: true,
          departmentMaster: {
            select: {
              departmentName: true
            }
          }
        },
        orderBy: { HBLDate: 'asc' },
      });

      const houseJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'House Job' },
        select: { MenuMasterSid: true }
      });

      if (!houseJobMenu) {
        throw new BadRequestException('House Job menu not found');
      }

      const houseJobIds = houseData.map(h => h.HouseJobSid);

      const houseCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: houseJobMenu.MenuMasterSid,
          TransactionSid: { in: houseJobIds },
          status: 'A'
        }
      });

      const houseRateMap: Map<number, any[]> = new Map();

      houseCR.forEach(cr => {
        const key = cr.TransactionSid!;
        if (!houseRateMap.has(key)) {
          houseRateMap.set(key, []);
        }
        houseRateMap.get(key)!.push(cr);
      });

      if (houseData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return { companyMasterSid: CompanyMasterSid, branchMasterSid: branchId, data: [] };
      }

      const data = houseData.map(data => {
        const costRevenueCharges = houseRateMap.get(data.HouseJobSid) || [];

        const freightRevenue = costRevenueCharges
          .filter(cr =>
            cr.RevenueLocalAmount &&
            chargeGroupMap.get(cr.ChargeMasterSid)?.GroupName === 'Freight'
          )
          .reduce((sum, cr) => sum + Number(cr.RevenueLocalAmount), 0);

        const product = data.Products?.[0];

        const masterContainerSid = data.masterJob?.containers?.[0]?.MasterJobContainerSid;

        const containerInfo = (data.masterJob?.containers || [])
          .filter(c => c.MasterJobContainerSid === masterContainerSid)
          .map(c => {
            const containerTypeId = c.ContainerType;
            const typeInfo = containerTypeId != null
              ? containerTypeMap.get(containerTypeId)
              : null;

            return {
              containerNumber: c.ContainerNumber,
              containerName: typeInfo?.name || `Unknown(${containerTypeId})`,
              containerSize: typeInfo?.size || '',
            };
          });



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
              countryMasterSid = portNameToCountryMap.get(cleanedFpd)
                || portCodeToCountryMap.get(cleanedFpd)
                || null;
            }
          }

          if (countryMasterSid !== null) {
            countryName = countryIdToNameMap.get(countryMasterSid) || null;
          }
        }

        return {
          bookingNo: data?.BookingNo,
          vesselName: data?.VesselName,
          MBL: data?.MBLNo,
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
          bookingDate: data?.BookingDateTime,
          containerNo: product?.ContainerNo,
          containerInfo,
          containerSid: product?.MasterJobContainerSid,
          vol: product?.Volume,
          weight: product?.GrossWeight,
          costRevenueCharges,
          freightRevenue,
          dgDelaration: product?.IsHaz,
          ATDPOL: data?.masterJob?.voyages?.[0]?.ATD,
          ATA: data?.masterJob?.voyages?.[0]?.ATA,
          dgAprrovelDate: data?.Others?.[0]?.DGConfirmationDate,
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        data,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
      };

    } catch (error) {
      this.logger.error(`Error generating shipment summary: ${error.message}`, error.stack);
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
        `Getting BL_Issue report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`
      );


      const branches = branchId && branchId.length > 0
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);

      const departments = deptId && deptId.length > 0
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

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);
      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          AND: [
            { HBLDate: { gte: FromHblDt } },
            { HBLDate: { lte: ToHblDt } },
          ],
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
        .filter(hj => !hj.Others?.[0]?.DONo)
        .map(hj => ({
          HBLDate: hj.HBLDate,
          HBLNo: hj.HBLNo,
          MBLNo: hj.masterJob?.MBLNo || null,
          BookingNo: hj.BookingNo,
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
        data,
        params,
      };
    } catch (error) {
      this.logger.error(
        `Error generating DO Issue List: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async generateShipmentDetailedSummary(params: ShipmentDetailedSummaryReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      branchId,
      Dept: deptId,
      Transhipment = false,
      Customer,
      Salesperson: SalePerson
    } = params;

    try {
      this.logger.log(`Getting shipment summary details report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`);


      const branches = branchId && branchId.length > 0
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);

      const departments = deptId && deptId.length > 0
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

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true }
      });

      // Map ID → Name for fast lookup
      const containerTypeMap = new Map(
        containerTypesMaster.map(ct => [ct.ContainerTypeMasterSid, ct.ContainerSize])
      );

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true, CustomerType: true }
      })

      const customerMap = new Map<number, string>(
        customerMaster.map(c => [c.CustomerMasterSid, c.CustomerName])
      );

      const selectedCustomerNames =
        Customer?.length
          ? Customer
            .map(id => customerMap.get(id))
            .filter((name): name is string => !!name)
          : [];

      const countryMaster = await this._db.countryMaster.findMany({
        select: {
          CountryMasterSid: true,
          countryName: true,
          countryCode: true
        }
      });


      const userMaster = await this._db.userMaster.findMany({
        select: { UserMasterSid: true, userName: true }
      })

      const salespersonMap = new Map<number, string>(
        userMaster.map(u => [u.UserMasterSid, u.userName])
      );

      const selectedSalespersonNames =
        SalePerson?.length
          ? SalePerson
            .map(id => salespersonMap.get(id))
            .filter((name): name is string => !!name)
          : [];


      const isTranshipment: boolean = Transhipment === true;



      const whereClause: any = {
        CompanyMasterSid,
        AND: [
          { HBLDate: { gte: FromHblDt } },
          { HBLDate: { lte: ToHblDt } }
        ],
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
          masterJob: {
            where: {
              Status: "A",
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
              containers: {
                where: { Status: 'A' },
                include: {
                  containerType: {
                    select: {
                      ContainerSize: true,
                      NoOfTeu: true,
                    }
                  }
                }
              },
            }

          }
        },
        orderBy: { HBLDate: 'asc' },
      });



      if (houseJobData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return { companyMasterSid: CompanyMasterSid, branchMasterSid: branchId, data: [] };
      }

      const portCodes = new Set<string>();

      houseJobData.forEach(mj => {
        if (mj.POL) portCodes.add(mj.POL);
        if (mj.POD) portCodes.add(mj.POD);
        if (mj.FPD) portCodes.add(mj.FPD);
        if (mj.POO) portCodes.add(mj.POO);
      });

      // Fetch port details
      const ports = await this._db.portMaster.findMany({
        where: {
          PortCode: { in: Array.from(portCodes) }
        },
        select: {
          PortCode: true,
          PortName: true,
          CountryMasterSid: true
        }
      });

      const portCountryMap = new Map<string, number>();
      ports.forEach(p => {
        if (p.PortCode && p.CountryMasterSid) {
          portCountryMap.set(p.PortCode, p.CountryMasterSid);
        }
      });

      const countryMap = new Map(
        countryMaster.map(c => [
          c.CountryMasterSid,
          { countryName: c.countryName, countryCode: c.countryCode }
        ])
      );


      // Create a map of port code to port name
      const portMap = new Map(
        ports.map(port => [port.PortCode, port.PortName])
      );

      const containerSize = ["20'F", "40'F", "45'HC", "20'Refer", "40'Refer", "45' HC Refer", "20'Open Top ", "40' Open Top", "45' HC Open Top"];

      // Map the master job data
      const data = houseJobData.map(mj => {
        // Determine the type based on destinationPort (or any other field)
        const type = mj.DestinationAgent ? 'Agent' : null;

        // Sum volumes for local shipment (Import + Export)
        const localShipmentVol = houseJobData?.reduce((sum, job) => {
          if (job.JobType === 'Import' || job.JobType === 'Export') {
            return sum + (job.Cargo?.reduce((cSum, cargo) => cSum + Number(cargo.Volume || 0), 0) || 0);
          }
          return sum;
        }, 0) || 0;

        // Sum volumes for transhipment shipment
        const transhipmentVol = houseJobData?.reduce((sum, job) => {
          if (job.JobType === 'Transhipment') {
            return sum + (job.Cargo?.reduce((cSum, cargo) => cSum + Number(cargo.Volume || 0), 0) || 0);
          }
          return sum;
        }, 0) || 0;

        const masterContainerSid = mj.masterJob?.containers?.[0]?.MasterJobContainerSid;

        const containerInfo = (mj.masterJob?.containers || [])
          .filter(c => c.MasterJobContainerSid === masterContainerSid)
          .map(c => {
            const containerTypeId = c.ContainerType;
            return {
              containerNumber: c.ContainerNumber,
              containerType: containerTypeId != null
                ? containerTypeMap.get(containerTypeId) || `Unknown(${containerTypeId})`
                : 'Unknown',
            };
          });

        const containerCountByType: Record<string, number> = {};
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

        (mj.masterJob?.containers || []).forEach(c => {
          totalNoOfTEU += Number(c.containerType?.NoOfTeu || 0);


          const normalizeContainerSize = (size?: string): string =>
            (size || '')
              .replace(/['"]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toUpperCase();


          const size = normalizeContainerSize(c.containerType?.ContainerSize);

          switch (size) {
            case '20 F':
              numberOfTwentyFt++;
              break;

            case '40 F':
              numberOfFourtyFt++;
              break;

            case '40 HC':
              numberofFurtyFiveFt++;
              break;

            case '20 REFER':
              numberOfTwentyRefer++;
              break;

            case '40 REFER':
              numberOfFourtyRefer++;
              break;

            case '40 HC REFER':
              numberOfFourtyFiveRefer++;
              break;

            case '20 OPEN TOP':
              numberofTwentyOpen++;
              break;

            case '40 OPEN TOP':
              numberofFourtyOpen++;
              break;

            case '40 HC OPEN TOP':
              numberofFourtyFiveOpen++;
              break;
          }
        });

        const polName = mj.POL ? portMap.get(mj.POL) || '' : '';
        const podName = mj.POD ? portMap.get(mj.POD) || '' : '';
        const fpdName = mj.FPD ? portMap.get(mj.FPD) || '' : '';
        const pooName = mj.POO ? portMap.get(mj.POO) || '' : '';

        const polCountrySid = mj.POL ? portCountryMap.get(mj.POL) : undefined;
        const polCountry = polCountrySid ? countryMap.get(polCountrySid) : undefined;

        // --- POD Country ---
        const podCountrySid = mj.POD ? portCountryMap.get(mj.POD) : undefined;
        const podCountry = podCountrySid ? countryMap.get(podCountrySid) : undefined;


        const houseDepartment = departments.find(d => d.DepartmentMasterSid === mj.DepartmentMasterSid)?.departmentName || '';
        const masterJob = Array.isArray(mj.masterJob) ? mj.masterJob[0] : mj.masterJob;

        const importJobNo = houseDepartment?.toLowerCase().includes('import')
          ? masterJob?.MasterJobNumber || ''
          : '';

        const exportJobNo = houseDepartment?.toLowerCase().includes('export')
          ? masterJob?.MasterJobNumber || ''
          : '';

        return {
          MBL: mj.MBLNo,
          shipmentNo: mj.ShipmentNo,
          bookingDate: mj.BookingDateTime,
          masterDate: mj.MBLDate,
          houseDepartment,
          HBL: mj.HBLNo,
          HBLDate: mj.HBLDate,
          importJobNo,
          exportJobNo,
          mblNo: mj.MBLNo || '',
          branchName: branches.find(b => b.BranchMasterSid === mj.BranchMasterSid)?.branchName || '',
          customerType: (() => {
            const typeObj = customerMaster.find(c => c.CustomerMasterSid === mj.CustomerMasterSid)?.CustomerType || {};
            return Object.keys(typeObj).filter(key => typeObj[key] === "isTrue");
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
          POLCode: mj.POL || '',
          POLName: polName,
          PODCode: mj.POD || '',
          PODName: podName,
          FPDCode: mj.FPD || '',
          FPDName: fpdName,
          POLCountryName: polCountry?.countryName || '',
          POLCountryCode: polCountry?.countryCode || '',
          PODCountryName: podCountry?.countryName || '',
          PODCountryCode: podCountry?.countryCode || '',
          // salesPerson:mj.SalesmanSid,
          salesPerson: userMaster.find(d => d.UserMasterSid === mj.SalesmanSid)?.userName || '',
          nominationBY: mj.NominatedBy,
          nominated: mj.Nominated,
          coLoader: mj.masterJob?.others?.[0]?.CoLoader,
          internalNote: mj.InternalNote,
          carrier: mj.CarrierName || '',
          originCarrier: customerMaster.find(c => c.CustomerMasterSid === mj.CarrierSid)?.CustomerName || '',
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
          noOfContainers: houseJobData.reduce((sum, job) => sum + (job.Cargo?.reduce((cSum, cargo) => cSum + (cargo.NoofContainers || 0), 0) || 0), 0) || 0,
          shipper: mj.ShipperName || '',
          consignee: mj.ConsigneeName,
          originAgent: mj.AgentName,
          deliveryAgent: customerMaster.find(d => d.CustomerMasterSid === mj.DestinationAgent)?.CustomerName || '',
          notify: mj.Notify,
          agent: mj.AgentName,
          incoTerms: mj.IncoTerms,
          PPCC: mj.FreightTerms,
          modeofTransport: mj.Cargo?.[0]?.ModeOfTransport,
          jobType: mj.JobType,
          containerNoList: mj?.masterJob?.containers?.map((c: any) => c.ContainerNumber).join(', ') || '',
          mastercontainerSid: mj?.masterJob?.containers?.map((c: any) => c.mastercontainerSid).join(', ') || '',
          masterContanierSid: mj?.masterJob?.containers?.[0]?.MasterJobContainerSid,
          receivingAgent: customerMaster.find(d => d.CustomerMasterSid === mj.DestinationAgent)?.CustomerName || '',
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
          localShipment: houseJobData?.filter(job => job.JobType === 'Import' || job.JobType === 'Export').length || 0,
          transhipmentShipment: houseJobData?.filter(job => job.JobType === 'Transhipment').length || 0,
          totalShipment: (houseJobData?.filter(job => job.JobType === 'Import' || job.JobType === 'Export').length || 0) +
            (houseJobData?.filter(job => job.JobType === 'Transhipment').length || 0),
          localShipmentVol,
          transhipmentVol
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
        Customer: selectedCustomerNames.join(", "),
        SalePerson: selectedSalespersonNames.join(', '),
      };

    } catch (error) {
      this.logger.error(`Error generating shipment summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async generateUnbilledCostReport(params: unbilledcostReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      this.logger.log(
        `Getting UNBILLED House Job Cost/Revenue report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`
      );

      const branches = branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: branchId } },
          select: { BranchMasterSid: true, branchName: true },
        })
        : await this._db.branchMaster.findMany({
          where: { CompanyMasterSid },
          select: { BranchMasterSid: true, branchName: true },
        });

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
      const branchSet = new Set(resolvedBranchNames);


      const departments = deptId && deptId.length > 0
        ? await this._db.departmentMaster.findMany({
          where: { DepartmentMasterSid: { in: deptId } },
          select: { DepartmentMasterSid: true, departmentName: true },
        })
        : await this._db.departmentMaster.findMany({
          where: { CompanyMasterSid },
          select: { DepartmentMasterSid: true, departmentName: true },
        });

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      //  Connection Table
      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true },
      });


      const houseJobs = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          AND: [
            { HBLDate: { gte: new Date(FromHblDt) } },
            { HBLDate: { lte: new Date(ToHblDt) } },
          ],
          status: 'A',
        },
        select: {
          HouseJobSid: true,
          HouseNo: true,
          HBLNo: true,
          DepartmentMasterSid: true,
          HouseStatus: true,
          BookingNo: true,
          FreightTerms: true,
          BranchMasterSid: true,
          Others: true,
        },
        orderBy: { HBLDate: 'asc' },
      });

      if (!houseJobs.length) {
        return {
          companyMasterSid: CompanyMasterSid,
          branchNames: resolvedBranchNames.join(', '),
          departmentNames: resolvedDeptNames.join(', '),
          data: [],
        };
      }

      const houseJobIds = houseJobs.map(h => h.HouseJobSid);


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
      });

      const houseRateMap = new Map<number, any[]>();
      allHouseCR.forEach(cr => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });


      const data = houseJobs.map(house => {
        const houseDepartment =
          departments.find(d => d.DepartmentMasterSid === house.DepartmentMasterSid)
            ?.departmentName || '';

        const costRevenues = (houseRateMap.get(house.HouseJobSid) || []).filter(
          cr => cr.CostVoucherHeaderSid === null
        );

        return {
          HouseJobSid: house.HouseJobSid,
          HouseNo: house.HouseNo,
          HBLNo: house.HBLNo,
          houseDept: houseDepartment,
          houseStatus: house.HouseStatus,
          bookingNo: house.BookingNo,
          PPCC: house.FreightTerms,
          branchName:
            branches.find(b => b.BranchMasterSid === house.BranchMasterSid)?.branchName || '',
          costRevenueDetails: costRevenues.map(cr => ({
            ChargeMasterSid: cr.ChargeMasterSid,
            chargeName:
              chargeMaster.find(c => c.ChargeMasterSid === cr.ChargeMasterSid)?.chargeName || '',
            ChargeDescription: cr.ChargeDescription,
            CostLocalAmount: cr.CostLocalAmount,
            RevenueLocalAmount: cr.RevenueLocalAmount,
            CostDrCr: cr.CostDrCr,
            CostAmount: cr.CostAmount,
            RevenueDrCr: cr.RevenueDrCr,
            partyName:
              customerMaster.find(c => c.CustomerMasterSid === cr.CostAgentMasterSid)
                ?.CustomerName || '',
          })),
        };
      });


      return {
        companyMasterSid: CompanyMasterSid,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        data,
      };
    } catch (error) {
      this.logger.error(
        `Error generating UNBILLED house job report: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async generateUnbilledRevenueReport(params: unbilledcostReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      Branch: branchId,
      Dept: deptId,
    } = params;

    try {
      this.logger.log(
        `Getting UNBILLED House Job Cost/Revenue report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`
      );

      const branches = branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: branchId } },
          select: { BranchMasterSid: true, branchName: true },
        })
        : await this._db.branchMaster.findMany({
          where: { CompanyMasterSid },
          select: { BranchMasterSid: true, branchName: true },
        });

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
      const branchSet = new Set(resolvedBranchNames);


      const departments = deptId && deptId.length > 0
        ? await this._db.departmentMaster.findMany({
          where: { DepartmentMasterSid: { in: deptId } },
          select: { DepartmentMasterSid: true, departmentName: true },
        })
        : await this._db.departmentMaster.findMany({
          where: { CompanyMasterSid },
          select: { DepartmentMasterSid: true, departmentName: true },
        });

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);


      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true }
      })


      const houseJobs = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,

          AND: [
            { HBLDate: { gte: new Date(FromHblDt) } },
            { HBLDate: { lte: new Date(ToHblDt) } },
          ],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        select: {
          HouseJobSid: true,
          HouseNo: true,
          HBLNo: true,
          DepartmentMasterSid: true,
          HouseStatus: true,
          BookingNo: true,
          FreightTerms: true,
          BranchMasterSid: true,
          Others: true
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

      const houseJobIds = houseJobs.map(h => h.HouseJobSid);


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
          ChargeDescription: true,
          ChargeMasterSid: true,
          CostAgentMasterSid: true,
          RevenueCustomerMasterSid: true,
          CostDrCr: true,
          RevenueDrCr: true,
          CostVoucherHeaderSid: true,
          RevenueVoucherHeaderSid: true,
          RevenueAmount: true,
          CostAmount: true,
        },
      });


      const houseRateMap = new Map<number, any[]>();
      allHouseCR.forEach(cr => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });


      const data = houseJobs.map(house => {
        const houseDepartment =
          departments.find(d => d.DepartmentMasterSid === house.DepartmentMasterSid)
            ?.departmentName || '';

        const costRevenues = (houseRateMap.get(house.HouseJobSid) || []).filter(cr =>
          cr.RevenueVoucherHeaderSid === null
        );


        return {
          HouseJobSid: house.HouseJobSid,
          HouseNo: house.HouseNo,
          HBLNo: house.HBLNo,
          houseDept: houseDepartment,
          houseStatus: house.HouseStatus,
          bookingNo: house.BookingNo,
          PPCC: house.FreightTerms,
          branchName: branches.find(b => house.BranchMasterSid === b.BranchMasterSid)?.branchName || '',
          costRevenueDetails: costRevenues.map(cr => ({
            ChargeMasterSid: cr.ChargeMasterSid,
            chargeName:
              chargeMaster.find(c => c.ChargeMasterSid === cr.ChargeMasterSid)
                ?.chargeName || '',
            ChargeDescription: cr.ChargeDescription,
            RevenueLocalAmount: cr.RevenueVoucherHeaderSid === null ? cr.RevenueLocalAmount : 0,
            RevenueDrCr: cr.RevenueDrCr,
            RevenueAmount: cr.RevenueAmount,
            partyName: customerMaster.find(c => c.CustomerMasterSid === cr.RevenueCustomerMasterSid)?.CustomerName || '',
            RevenueCustomerMasterSid: cr.RevenueCustomerMasterSid,
            RevenueVoucherHeaderSid: cr.RevenueVoucherHeaderSid,
            CostAmount: cr.CostAmount,
          })),


        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        data,
      };

    } catch (error) {
      this.logger.error(
        `Error generating UNBILLED house job report: ${error.message}`,
        error.stack
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
        `Getting House Job Loss Report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`
      );


      const branches = branchId && branchId.length > 0
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);

      const departments = deptId && deptId.length > 0
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

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);


      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeName: true },
      });

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true }
      })

      const customerMap = new Map<number, string>(
        customerMaster.map(c => [c.CustomerMasterSid, c.CustomerName])
      );

      const selectedCustomerNames =
        Customer?.length
          ? Customer
            .map(id => customerMap.get(id))
            .filter((name): name is string => !!name)
          : [];


      const houseJobs = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          AND: [
            { HBLDate: { gte: FromHblDt } },
            { HBLDate: { lte: ToHblDt } },
          ],
          status: 'A',
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          ...(Customer && Customer.length > 0 ? { CustomerMasterSid: { in: Customer } } : {}),
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

      const houseJobIds = houseJobs.map(h => h.HouseJobSid);


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
      allHouseCR.forEach(cr => {
        if (!houseRateMap.has(cr.TransactionSid!)) {
          houseRateMap.set(cr.TransactionSid!, []);
        }
        houseRateMap.get(cr.TransactionSid!)!.push(cr);
      });

      const data = houseJobs.map(house => {

        const houseDepartment =
          departments.find(d => d.DepartmentMasterSid === house.DepartmentMasterSid)
            ?.departmentName || '';


        const houseCR = allHouseCR.filter(cr => cr.TransactionSid === house.HouseJobSid);


        const { totalRevenue, totalCost } = houseCR.reduce(
          (acc, cr) => {
            acc.totalRevenue += cr.RevenueLocalAmount ? Number(cr.RevenueLocalAmount) : 0;
            acc.totalCost += cr.CostLocalAmount ? Number(cr.CostLocalAmount) : 0;
            return acc;
          },
          { totalRevenue: 0, totalCost: 0 }
        );

        const totalProfit = totalRevenue - totalCost;
        const baseAmount = Math.max(totalRevenue, totalCost);
        const totalGP = baseAmount !== 0 ? (totalProfit / baseAmount) * 100 : 0;


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
          MBLNo: house.MBLNo,
          vesselName: house.VesselName,
          voyNo: house.VoyageNo,
          originAgent: house.AgentName,
          jobDate: house.HBLDate,
          destinationAgent: customerMaster.find(d => d.CustomerMasterSid === house.DestinationAgent)?.CustomerName || '',
          customerName: customerMaster.find(c => c.CustomerMasterSid === house.CustomerMasterSid)?.CustomerName || '',
          jobNo: house.masterJob?.MasterJobNumber,
          costRevenueDetails: costRevenueDetails
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        params,
        Customer: selectedCustomerNames.join(', '),
        data,
      };

    } catch (error) {
      this.logger.error(
        `Error generating  house job loss report: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  // private async generateProfitSummaryReport(params: ProfitSummaryReportQueryDto) {
  //   const {
  //     companyId: CompanyMasterSid,
  //     ToJobDt,
  //     FormJobDt,
  //     Branch: branchId,
  //     Dept: dept,
  //   } = params;

  //   try {
  //     this.logger.log(
  //       `Getting Profit Summary Report for CompanySid=${CompanyMasterSid}, From=${FormJobDt}, To=${ToJobDt}`
  //     );

  //     /* ===================== MASTERS ===================== */
  //     const allBranches = await this.getBranchNames(CompanyMasterSid,branchId);
  //     const allBranchIds = allBranches.map(b => b.BranchMasterSid);

  //     const [departments, masterJobMenu, houseJobMenu] = await Promise.all([
  //       this._db.departmentMaster.findMany({
  //         where: { DepartmentMasterSid: { in: dept } },
  //         select: { DepartmentMasterSid: true, departmentName: true },
  //       }),
  //       this._db.menuMaster.findFirst({
  //         where: { MenuName: 'Master Job' },
  //         select: { MenuMasterSid: true },
  //       }),
  //       this._db.menuMaster.findFirst({
  //         where: { MenuName: 'House Job' },
  //         select: { MenuMasterSid: true },
  //       }),
  //     ]);

  //     if (!masterJobMenu || !houseJobMenu) {
  //       throw new BadRequestException('Menu not found');
  //     }


  //     /* ===================== MASTER JOBS ===================== */

  //     const masterJob = await this._db.masterJob.findMany({
  //       where: {
  //         CompanyMasterSid,
  //         BranchMasterSid: { in: allBranchIds },
  //         AND: [
  //           { MBLDate: { gte: new Date(FormJobDt) } },
  //           { MBLDate: { lte: new Date(ToJobDt) } },
  //         ],
  //         Status: 'A',
  //         DepartmentMasterSid: { in: dept },
  //       },
  //       select: {
  //         MasterJobSid: true,
  //         MasterJobNumber: true,
  //         DepartmentMasterSid: true,
  //         MBLDate: true,
  //         MBLNo: true,
  //         OriginAgent: true,
  //         DestinationAgent: true,
  //         POL: true,
  //         POD: true,
  //         POO: true,
  //         FPD: true,
  //         voyages: { select: { ETA: true, ETD: true, ATA: true, ATD: true } },
  //         houseJob: {
  //           select: {
  //             HouseJobSid: true,
  //             HouseNo: true,
  //             HBLNo: true,
  //             HouseStatus: true,
  //             JobType: true,
  //             CustomerMasterSid: true,
  //             SalesmanSid: true,
  //             FreightTerms: true,
  //             Cargo: { select: { ModeOfTransport: true } },
  //           },
  //         },
  //       },
  //       orderBy: { MBLDate: 'asc' },
  //     });

  //     if (!masterJob.length) {
  //       return {
  //         companyMasterSid: CompanyMasterSid,
  //         branchMasterSid: branchId,
  //         data: [],
  //       };
  //     }

  //     const masterJobIds = masterJob.map(m => m.MasterJobSid);
  //     const houseJobIds = masterJob.flatMap(m => m.houseJob.map(h => h.HouseJobSid));
  //     /* ===================== COST / REVENUE ===================== */

  //     const fetchCostRevenue = async (menuId: number, ids: number[]) => {
  //       const costRevenues = await this._db.costRevenueCharges.findMany({
  //         where: {
  //           TransactionSid : { in : ids},
  //           MenuMasterSid: menuId,
  //           status: 'A',
  //         },
  //         select: { 
  //           RevenueVoucherHeaderSid: true, RevenueLocalAmount: true,
  //           CostVoucherHeaderSid : true,
  //           CostLocalAmount : true
  //         },
  //       });

  //       const revenue = costRevenues.map(cr => ({
  //         RevenueVoucherHeaderSid: cr.RevenueVoucherHeaderSid, 
  //         RevenueLocalAmount: cr.RevenueLocalAmount,
  //       }))

  //       const cost = costRevenues.map(cr => ({
  //         CostVoucherHeaderSid: cr.CostVoucherHeaderSid,
  //         CostLocalAmount: cr.CostLocalAmount,
  //       }))

  //       return { revenue, cost };
  //     };

  //     const masterCR = await fetchCostRevenue(masterJobMenu.MenuMasterSid, masterJobIds);
  //     const houseCR = await fetchCostRevenue(houseJobMenu.MenuMasterSid, houseJobIds);

  //     /* ===================== MAPS ===================== */

  //     const splitMap = (list: any[], key: string) => {
  //       const linked = new Map<number, any[]>();
  //       const unlinked: any[] = [];

  //       list.forEach(item => {
  //         const id = item[key];
  //         if (id == null) unlinked.push(item);
  //         else {
  //           if (!linked.has(id)) linked.set(id, []);
  //           const existing = linked.get(id)!;
  //           if (!existing.some(x => JSON.stringify(x) === JSON.stringify(item))) {
  //             existing.push(item); // avoid duplicates
  //           }
  //         }
  //       });

  //       return { linked, unlinked };
  //     };

  //     const masterRevenueMap = splitMap(masterCR.revenue, 'RevenueVoucherHeaderSid');
  //     const masterCostMap = splitMap(masterCR.cost, 'CostVoucherHeaderSid');
  //     const houseRevenueMap = splitMap(houseCR.revenue, 'RevenueVoucherHeaderSid');
  //     const houseCostMap = splitMap(houseCR.cost, 'CostVoucherHeaderSid');

  //     const mapRows = (list: any[], field: string) => {
  //       return list.map(r => ({
  //         [field]: Number(r[`${field}LocalAmount`] ?? 0),
  //       }));
  //     };

  //     /* ===================== FINAL DATA ===================== */

  //     const data = await Promise.all(
  //       masterJob.map(async mj => ({
  //         JobNo: mj.MasterJobNumber,
  //         MBLNo: mj.MBLNo,
  //         MBLDate: mj.MBLDate,
  //         OriginAgent: mj.OriginAgent,
  //         DestinationAgent: mj.DestinationAgent,
  //         POL: mj.POL,
  //         POD: mj.POD,
  //         FPD: mj.FPD,
  //         POO: mj.POO,
  //         ETA: mj.voyages?.[0]?.ETA,
  //         ETD: mj.voyages?.[0]?.ETD,
  //         ATA: mj.voyages?.[0]?.ATA,
  //         ATD: mj.voyages?.[0]?.ATD,
  //         deptName:
  //           departments.find(d => d.DepartmentMasterSid === mj.DepartmentMasterSid)
  //             ?.departmentName || '',

  //         masterCostRevenue: {
  //           revenue: {
  //             linked: mapRows(masterRevenueMap.linked.get(mj.MasterJobSid) || [], 'Revenue'),
  //             unlinked: mapRows(masterRevenueMap.unlinked, 'Revenue'),
  //           },
  //           cost: {
  //             linked: mapRows(masterCostMap.linked.get(mj.MasterJobSid) || [], 'Cost'),
  //             unlinked: mapRows(masterCostMap.unlinked, 'Cost'),
  //           },
  //         },

  //         houseJobs: await Promise.all(
  //           mj.houseJob.map(async hj => ({
  //             HouseJobSid: hj.HouseJobSid,
  //             HouseNo: hj.HouseNo,
  //             HBLNo: hj.HBLNo,
  //             HouseStatus: hj.HouseStatus,
  //             JobType: hj.JobType,
  //             customerName: await this.getCustomerName(CompanyMasterSid, hj.CustomerMasterSid),
  //             salesperson: await this.getSalespersonName(CompanyMasterSid, hj.SalesmanSid),
  //             FreightTerms: hj.FreightTerms,
  //             ModeOfTransport: hj.Cargo?.[0]?.ModeOfTransport,
  //             costRevenue: {
  //               revenue: {
  //                 linked: mapRows(houseRevenueMap.linked.get(hj.HouseJobSid) || [], 'Revenue'),
  //                 unlinked: mapRows(houseRevenueMap.unlinked, 'Revenue'),
  //               },
  //               cost: {
  //                 linked: mapRows(houseCostMap.linked.get(hj.HouseJobSid) || [], 'Cost'),
  //                 unlinked: mapRows(houseCostMap.unlinked, 'Cost'),
  //               },
  //             },
  //           }))
  //         ),
  //       }))
  //     );

  //     return {
  //       companyMasterSid: CompanyMasterSid,
  //       branchMasterSid: branchId,
  //       branchesInvolved: allBranches.map(b => b.branchName).join(','),
  //       params,
  //       data,
  //     };
  //   } catch (error) {
  //     this.logger.error(
  //       `Error generating Profit Summary report: ${error.message}`,
  //       error.stack
  //     );
  //     throw error;
  //   }
  // }

  private async generateProfitSummaryReport(
    params: ProfitSummaryReportQueryDto
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
        `Getting Profit Summary Report for CompanySid=${CompanyMasterSid}, From=${FromJobDt}, To=${ToJobDt}`
      );

      /* ===================== MASTERS ===================== */

      const allBranches = await this.getBranchNames(CompanyMasterSid, branchId);

      const allBranchIds = allBranches.map(b => b.BranchMasterSid);

      const [departments, masterJobMenu, houseJobMenu, customer, user] = await Promise.all([
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
          select: { CustomerMasterSid: true, CustomerName: true }
        }),
        this._db.userMaster.findMany({
          select: { UserMasterSid: true, userName: true }
        })
      ]);

      if (!masterJobMenu || !houseJobMenu) {
        throw new BadRequestException('Menu not found');
      }

      /* ===================== MASTER JOBS ===================== */

      const masterJob = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: allBranchIds },
          AND: [
            { MBLDate: { gte: FromJobDt } },
            { MBLDate: { lte: ToJobDt } },
          ],
          Status: 'A',
          DepartmentMasterSid: { in: dept },
        },
        select: {
          MasterJobSid: true,
          MasterJobNumber: true,
          DepartmentMasterSid: true,
          MBLDate: true,
          MBLNo: true,
          OriginAgent: true,
          DestinationAgent: true,
          POL: true,
          POD: true,
          POO: true,
          FPD: true,
          voyages: { select: { ETA: true, ETD: true, ATA: true, ATD: true } },
          houseJob: {
            select: {
              HouseJobSid: true,
              HouseNo: true,
              HBLNo: true,
              HouseStatus: true,
              JobType: true,
              CustomerMasterSid: true,
              SalesmanSid: true,
              FreightTerms: true,
              Cargo: { select: { ModeOfTransport: true } },
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
        departments.find(d => d.DepartmentMasterSid === deptId)?.departmentName ||
        '';

      const getCostRevenues = async (
        MenuMasterSid: number,
        TransactionSid: number
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
        masterJob.map(async mj => {
          const masterCR = await getCostRevenues(
            masterJobMenu.MenuMasterSid,
            mj.MasterJobSid
          );

          const linkedRev = masterCR.filter(cr => cr.RevenueVoucherHeaderSid);
          const linkedCost = masterCR.filter(cr => cr.CostVoucherHeaderSid);

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
            mj.houseJob.map(async hj => {
              const houseCR = await getCostRevenues(
                houseJobMenu.MenuMasterSid,
                hj.HouseJobSid
              );

              const linkedRevH = houseCR.filter(cr => cr.RevenueVoucherHeaderSid);
              const linkedCostH = houseCR.filter(cr => cr.CostVoucherHeaderSid);

              const hpSale = calc(houseCR, 'R');
              const hpCost = calc(houseCR, 'C');
              const haSale = calc(linkedRevH, 'R');
              const haCost = calc(linkedCostH, 'C');

              return {
                HouseJobSid: hj.HouseJobSid,
                HBLNo: hj.HBLNo,
                costRevenues: {
                  totalNoOfCostRevenues: houseCR.length,
                  linkedRevenueRecords: linkedRevH.map(
                    cr => cr.CostRevenueChargesSid
                  ),
                  linkedCostRecords: linkedCostH.map(
                    cr => cr.CostRevenueChargesSid
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
            })
          );

          return {
            JobNo: mj.MasterJobNumber,
            MBLNo: mj.MBLNo,
            MBLDate: mj.MBLDate,
            OriginAgent: customer.find(o => o.CustomerMasterSid === mj.OriginAgent)?.CustomerName || '',
            DestinationAgent: customer.find(d => d.CustomerMasterSid === mj.DestinationAgent)?.CustomerName || '',
            customerName: customer.find(c => c.CustomerMasterSid === mj.houseJob?.[0]?.CustomerMasterSid)?.CustomerName || '',
            jobType: mj.houseJob?.[0]?.JobType,
            houseNo: mj.houseJob?.[0]?.HouseNo,
            HBLNo: mj.houseJob?.[0]?.HBLNo,
            houseStatus: mj.houseJob?.[0]?.HouseStatus,
            ModeOfTransport: mj.houseJob?.[0]?.Cargo?.[0]?.ModeOfTransport,
            PPCC: mj.houseJob?.[0]?.FreightTerms,
            salesPerson: user.find(u => u.UserMasterSid === mj.houseJob?.[0]?.SalesmanSid)?.userName || '',
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
                cr => cr.CostRevenueChargesSid
              ),
              linkedCostRecords: linkedCost.map(
                cr => cr.CostRevenueChargesSid
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
        })
      );

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        BranchInvolved: allBranches.map(b => b.branchName).join(', '),
        DeptNames: departments.map(d => d.departmentName).join(', '),
        data,
        params
      };
    } catch (error) {
      this.logger.error(
        `Error generating Profit Summary Report: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async generateDestinationReport(params: DestinationReportQueryDto) {
    const {
      companyId: CompanyMasterSid,
      ToHblDt,
      FromHblDt,
      branchId,
      Dept: deptId,
      Transhipment = false,
      Customer,
      Salesperson: SalePerson,
      POL,
      POD
    } = params;

    try {
      this.logger.log(`Getting shipment summary details report for CompanySid=${CompanyMasterSid}, From=${FromHblDt}, To=${ToHblDt}`);


      const branches = branchId && branchId.length > 0
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);

      const departments = deptId && deptId.length > 0
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

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true }
      });

      // Map ID → Name for fast lookup
      const containerTypeMap = new Map(
        containerTypesMaster.map(ct => [ct.ContainerTypeMasterSid, ct.ContainerSize])
      );

      const customerMaster = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true, CustomerType: true }
      })

      const customerMap = new Map<number, string>(
        customerMaster.map(c => [c.CustomerMasterSid, c.CustomerName])
      );

      const selectedCustomerNames =
        Customer?.length
          ? Customer
            .map(id => customerMap.get(id))
            .filter((name): name is string => !!name)
          : [];

      const countryMaster = await this._db.countryMaster.findMany({
        select: {
          CountryMasterSid: true,
          countryName: true,
          countryCode: true
        }
      });


      const userMaster = await this._db.userMaster.findMany({
        select: { UserMasterSid: true, userName: true }
      })

      // Convert POL / POD ID → PortCode
      const portIds = [POL, POD].filter(
        (id): id is number => typeof id === 'number'
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
            PortCode: true, // ✅ CHANGED HERE
          },
        });

        polCode = ports.find(p => p.PortMasterSid === POL)?.PortCode;
        podCode = ports.find(p => p.PortMasterSid === POD)?.PortCode;
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

        polNameParam = portsById.find(p => p.PortMasterSid === POL)?.PortName;
        podNameParam = portsById.find(p => p.PortMasterSid === POD)?.PortName;
      }





      const salespersonMap = new Map<number, string>(
        userMaster.map(u => [u.UserMasterSid, u.userName])
      );

      const selectedSalespersonNames =
        SalePerson?.length
          ? SalePerson
            .map(id => salespersonMap.get(id))
            .filter((name): name is string => !!name)
          : [];


      const isTranshipment: boolean = Transhipment === true;

      const whereClause: any = {
        CompanyMasterSid,
        AND: [
          { HBLDate: { gte: FromHblDt } },
          { HBLDate: { lte: ToHblDt } }
        ],
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
          masterJob: {
            where: {
              Status: "A",
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
              OriginAgent:true,
              containers: {
                where: { Status: 'A' },
                include: {
                  containerType: {
                    select: {
                      ContainerSize: true,
                      NoOfTeu: true,
                    }
                  }
                }
              },
            }

          }
        },
        orderBy: { HBLDate: 'asc' },
      });



      if (houseJobData.length === 0) {
        this.logger.log(`No shipment vouchers found for the given filters.`);
        return { companyMasterSid: CompanyMasterSid, branchMasterSid: branchId, data: [] };
      }

      const portCodes = new Set<string>();

      houseJobData.forEach(mj => {
        if (mj.POL) portCodes.add(mj.POL);
        if (mj.POD) portCodes.add(mj.POD);
        if (mj.FPD) portCodes.add(mj.FPD);
        if (mj.POO) portCodes.add(mj.POO);
      });

      // Fetch port details
      const ports = await this._db.portMaster.findMany({
        where: {
          PortCode: { in: Array.from(portCodes) }
        },
        select: {
          PortCode: true,
          PortName: true,
          CountryMasterSid: true
        }
      });

      const portCountryMap = new Map<string, number>();
      ports.forEach(p => {
        if (p.PortCode && p.CountryMasterSid) {
          portCountryMap.set(p.PortCode, p.CountryMasterSid);
        }
      });

      const countryMap = new Map(
        countryMaster.map(c => [
          c.CountryMasterSid,
          { countryName: c.countryName, countryCode: c.countryCode }
        ])
      );


      // Create a map of port code to port name
      const portMap = new Map(
        ports.map(port => [port.PortCode, port.PortName])
      );

      const containerSize = ["20'F", "40'F", "45'HC", "20'Refer", "40'Refer", "45' HC Refer", "20'Open Top ", "40' Open Top", "45' HC Open Top"];

      // Map the master job data
      const data = houseJobData.map(mj => {
        // Determine the type based on destinationPort (or any other field)
        const type = mj.DestinationAgent ? 'Agent' : null;

        // Sum volumes for local shipment (Import + Export)
        const localShipmentVol = houseJobData?.reduce((sum, job) => {
          if (job.JobType === 'Import' || job.JobType === 'Export') {
            return sum + (job.Cargo?.reduce((cSum, cargo) => cSum + Number(cargo.Volume || 0), 0) || 0);
          }
          return sum;
        }, 0) || 0;

        // Sum volumes for transhipment shipment
        const transhipmentVol = houseJobData?.reduce((sum, job) => {
          if (job.JobType === 'Transhipment') {
            return sum + (job.Cargo?.reduce((cSum, cargo) => cSum + Number(cargo.Volume || 0), 0) || 0);
          }
          return sum;
        }, 0) || 0;

        const masterContainerSid = mj.masterJob?.containers?.[0]?.MasterJobContainerSid;

        const containerInfo = (mj.masterJob?.containers || [])
          .filter(c => c.MasterJobContainerSid === masterContainerSid)
          .map(c => {
            const containerTypeId = c.ContainerType;
            return {
              containerNumber: c.ContainerNumber,
              containerType: containerTypeId != null
                ? containerTypeMap.get(containerTypeId) || `Unknown(${containerTypeId})`
                : 'Unknown',
            };
          });

        const containerCountByType: Record<string, number> = {};
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

        (mj.masterJob?.containers || []).forEach(c => {
          totalNoOfTEU += Number(c.containerType?.NoOfTeu || 0);


          const normalizeContainerSize = (size?: string): string =>
            (size || '')
              .replace(/['"]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toUpperCase();


          const size = normalizeContainerSize(c.containerType?.ContainerSize);

          switch (size) {
            case '20 F':
              numberOfTwentyFt++;
              break;

            case '40 F':
              numberOfFourtyFt++;
              break;

            case '40 HC':
              numberofFurtyFiveFt++;
              break;

            case '20 REFER':
              numberOfTwentyRefer++;
              break;

            case '40 REFER':
              numberOfFourtyRefer++;
              break;

            case '40 HC REFER':
              numberOfFourtyFiveRefer++;
              break;

            case '20 OPEN TOP':
              numberofTwentyOpen++;
              break;

            case '40 OPEN TOP':
              numberofFourtyOpen++;
              break;

            case '40 HC OPEN TOP':
              numberofFourtyFiveOpen++;
              break;
          }
        });

        const polName = mj.POL ? portMap.get(mj.POL) || '' : '';
        const podName = mj.POD ? portMap.get(mj.POD) || '' : '';
        const fpdName = mj.FPD ? portMap.get(mj.FPD) || '' : '';
        const pooName = mj.POO ? portMap.get(mj.POO) || '' : '';

        const polCountrySid = mj.POL ? portCountryMap.get(mj.POL) : undefined;
        const polCountry = polCountrySid ? countryMap.get(polCountrySid) : undefined;

        // --- POD Country ---
        const podCountrySid = mj.POD ? portCountryMap.get(mj.POD) : undefined;
        const podCountry = podCountrySid ? countryMap.get(podCountrySid) : undefined;


        const houseDepartment = departments.find(d => d.DepartmentMasterSid === mj.DepartmentMasterSid)?.departmentName || '';
        const masterJob = Array.isArray(mj.masterJob) ? mj.masterJob[0] : mj.masterJob;

        const importJobNo = houseDepartment?.toLowerCase().includes('import')
          ? masterJob?.MasterJobNumber || ''
          : '';

        const exportJobNo = houseDepartment?.toLowerCase().includes('export')
          ? masterJob?.MasterJobNumber || ''
          : '';

        return {
          MBL: mj.MBLNo,
          shipmentNo: mj.ShipmentNo,
          bookingDate: mj.BookingDateTime,
          masterDate: mj.MBLDate,
          houseDepartment,
          HBL: mj.HBLNo,
          HBLDate: mj.HBLDate,
          importJobNo,
          exportJobNo,
          mblNo: mj.MBLNo || '',
          branchName: branches.find(b => b.BranchMasterSid === mj.BranchMasterSid)?.branchName || '',
          customerType: (() => {
            const typeObj = customerMaster.find(c => c.CustomerMasterSid === mj.CustomerMasterSid)?.CustomerType || {};
            return Object.keys(typeObj).filter(key => typeObj[key] === "isTrue");
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
          POLCode: mj.POL || '',
          POLName: polName,
          PODCode: mj.POD || '',
          PODName: podName,
          FPDCode: mj.FPD || '',
          FPDName: fpdName,
          POLCountryName: polCountry?.countryName || '',
          POLCountryCode: polCountry?.countryCode || '',
          PODCountryName: podCountry?.countryName || '',
          PODCountryCode: podCountry?.countryCode || '',
          // salesPerson:mj.SalesmanSid,
          salesPerson: userMaster.find(d => d.UserMasterSid === mj.SalesmanSid)?.userName || '',
          nominationBY: mj.NominatedBy,
          nominated: mj.Nominated,
          coLoader: mj.masterJob?.others?.[0]?.CoLoader,
          internalNote: mj.InternalNote,
          carrier: mj.CarrierName || '',
          originCarrier: customerMaster.find(c => c.CustomerMasterSid === mj.CarrierSid)?.CustomerName || '',
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
          noOfContainers: houseJobData.reduce((sum, job) => sum + (job.Cargo?.reduce((cSum, cargo) => cSum + (cargo.NoofContainers || 0), 0) || 0), 0) || 0,
          shipper: mj.ShipperName || '',
          consignee: mj.ConsigneeName,
          originAgent: mj.AgentName,
          deliveryAgent: customerMaster.find(d => d.CustomerMasterSid === mj.DestinationAgent)?.CustomerName || '',
          notify: mj.Notify,
          agent: mj.AgentName,
          incoTerms: mj.IncoTerms,
          PPCC: mj.FreightTerms,
          modeofTransport: mj.Cargo?.[0]?.ModeOfTransport,
          jobType: mj.JobType,
          containerNoList: mj?.masterJob?.containers?.map((c: any) => c.ContainerNumber).join(', ') || '',
          mastercontainerSid: mj?.masterJob?.containers?.map((c: any) => c.mastercontainerSid).join(', ') || '',
          masterContanierSid: mj?.masterJob?.containers?.[0]?.MasterJobContainerSid,
          receivingAgent: customerMaster.find(d => d.CustomerMasterSid === mj.DestinationAgent)?.CustomerName || '',
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
          localShipment: houseJobData?.filter(job => job.JobType === 'Import' || job.JobType === 'Export').length || 0,
          transhipmentShipment: houseJobData?.filter(job => job.JobType === 'Transhipment').length || 0,
          totalShipment: (houseJobData?.filter(job => job.JobType === 'Import' || job.JobType === 'Export').length || 0) +
            (houseJobData?.filter(job => job.JobType === 'Transhipment').length || 0),
          localShipmentVol,
          transhipmentVol
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
        Customer: selectedCustomerNames.join(", "),
        SalePerson: selectedSalespersonNames.join(', '),
        POL: polNameParam || POL,
        POD: podNameParam || POD,
      };

    } catch (error) {
      this.logger.error(
        `Error generating Destination Report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async generateExportJobVolumeTEUReport(params: exportJobVolumeTEUReportQueryDto) {
    const {
      FromDate,
      ToDate,
      companyId: CompanyMasterSid,
      Branch: branchId,
      Dept: deptId
    } = params

    try {

      const branches = branchId && branchId.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: branchId } },
          select: { BranchMasterSid: true, branchName: true },
        })
        : await this._db.branchMaster.findMany({
          where: { CompanyMasterSid },
          select: { BranchMasterSid: true, branchName: true },
        });

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);
      const branchSet = new Set(resolvedBranchNames);


      const departments = deptId && deptId.length > 0
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


      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName);

      const customer = await this._db.customerMaster.findMany({
        select: { CustomerMasterSid: true, CustomerName: true }
      })

      // Container Type Master
      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true }
      });

      const containerTypeMap = new Map(
        containerTypesMaster.map(ct => [ct.ContainerTypeMasterSid, ct.ContainerSize])
      );

      const masterJobs = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { MBLDate: { gte: FromDate } },
            { MBLDate: { lte: ToDate } },
          ],
          Status: 'A',
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        include: {
          containers: {
            where: { Status: 'A' },
            include: {
              containerType: {
                select: {
                  ContainerSize: true,
                  NoOfTeu: true,
                }
              }
            }
          },
          voyages: true
        },
        orderBy: { MBLDate: 'asc' },
      })

      const containerSize = ["20'", "40'", "45'"];

      const masterContainerMap = new Map<string, number>();

      containerTypesMaster.forEach(m => {
        const size = m.ContainerSize.replace("'", '').trim(); // normalize
        masterContainerMap.set(size, 1); // presence map
      });


      // Map the master job data
      const data = masterJobs.map(mj => {
        const masterContainerSid = mj.containers?.[0]?.MasterJobContainerSid;

        const containerInfo = (mj.containers || [])
          .filter(c => c.MasterJobContainerSid === masterContainerSid)
          .map(c => {
            const containerTypeId = c.ContainerType;
            return {
              containerNumber: c.ContainerNumber,
              containerType: containerTypeId != null
                ? containerTypeMap.get(containerTypeId) || `Unknown(${containerTypeId})`
                : 'Unknown',
            };
          });

        const containerCountByType: Record<string, number> = {};
        let totalNoOfTEU = 0;
        let numberOfFourtyFt = 0;
        let numberofFurtyFive = 0;
        let numberOfTwentyFt = 0;
        containerSize.forEach(col => containerCountByType[col] = 0);

        (mj.containers || []).forEach(c => {

          totalNoOfTEU += toNumber(c.containerType?.NoOfTeu);

          if (c.containerType?.ContainerSize.trim() === '20') {
            numberOfTwentyFt++;
          }

          if (c.containerType?.ContainerSize.trim() === '40') {
            numberOfFourtyFt++;
          }

          if (c.containerType?.ContainerSize.trim() === '45') {
            numberofFurtyFive++;
          }
        });

        return {
          TEUCount: totalNoOfTEU,
          fourtyft: numberOfFourtyFt,
          fortyfiveft: numberofFurtyFive,
          twentyft: numberOfTwentyFt,
          dept: departments.find(d => d.DepartmentMasterSid === mj.DepartmentMasterSid)?.departmentName || '',
          jobNo: mj.MasterJobNumber,
          movementType: mj.MovementType,
          MBLDate: mj.MBLDate,
          ETD: mj.voyages?.[0]?.ETD,
          deliveyAgent: customer.find(c => c.CustomerMasterSid === mj.DestinationAgent)?.CustomerName || '',
          carrier: mj.voyages?.[0]?.CarrierName,
          portOfloading: mj.POL,
          portOfdischarge: mj.POD,
          portOfDestination: mj.FPD,
          weight: mj.GrossWeight,
          chargebaleWt: mj.ChargeableWeight
        };
      });

      return {
        params,
        branchNames: resolvedBranchNames.join(', '),
        departmentNames: resolvedDeptNames.join(', '),
        data,
      }


    } catch (error) {
      throw error
    }
  }

  private async generateNetworkReport(params: any) {
    const {
      FromDate,
      ToDate,
      Network:network,
      NetworkFrom,
      CompanyId: CompanyMasterSid,
      Branch: BranchMasterSid,
      Department
    } = params;

    try {

      // 1. Resolve departments (selected or all)
      let departmentIds: number[] = [];

      if (Department) {
        departmentIds = Array.isArray(Department) ? Department : [Department];
      } else {
        const allDepartments = await this._db.departmentMaster.findMany({
          where: { CompanyMasterSid, Status: 'A' },
          select: { DepartmentMasterSid: true }
        });
        departmentIds = allDepartments.map(d => d.DepartmentMasterSid);
      }


      // 2. Load masters
      const organizationMaster = await this._db.customerMaster.findMany({
        select: {
          CustomerMasterSid: true,
          CustomerName: true,
          Network: true
        }
      });

      const departments = await this._db.departmentMaster.findMany({
        select: {
          DepartmentMasterSid: true,
          departmentName: true
        }
      });

      // 3. Build booking filter
      const whereClause: any = {
        CompanyMasterSid,
        BranchMasterSid,
        DepartmentMasterSid: { in: departmentIds },
        status: 'A',
        AND: [
          { BookingDateTime: { gte: FromDate } },
          { BookingDateTime: { lte: ToDate } }
        ],
      };

      // 4. Fetch booking data
      const networkData = await this._db.bookingHeader.findMany({
        where: whereClause,
        include: {
          bookingRates: true,
          bookingCargo: true,
          houseJob:{
            select:{
              Cargo:true
            }
          }
        },
        orderBy: {
          BookingDateTime: "asc"
        }
      });

      // 5. Apply network filters + map result
      const data = networkData
        .map(b => {
          const customer = organizationMaster.find(c => c.CustomerMasterSid === b.CustomerMasterSid);
          const department = departments.find(d => d.DepartmentMasterSid === b.DepartmentMasterSid);
          const destinationAgent = organizationMaster.find(c => c.CustomerMasterSid === b.DestinationAgent);
          const totalRevenue = (b.bookingRates || [])
            .reduce((sum, r) => sum + Number(r.RevenueLocalAmount || 0), 0);

          const totalCost = (b.bookingRates || [])
            .reduce((sum, r) => sum + Number(r.CostLocalAmount || 0), 0);

          return {
            customerName: customer?.CustomerName || '',
            departmentName: department?.departmentName || '',
            network:customer?.Network || '',
            BookingNo: b.BookingNo,
            HouseNo: b.HouseNo,
            HblNo: b.HBLNo,
            MBLNo: b.MBLNo,
            originAgent: b.AgentName,
            destinationAgent: destinationAgent?.CustomerName || '',
            nominationBy: b.NominatedBy,
            grossWt: b.bookingCargo?.[0]?.GrossWeight || 0,
            netWt: b.bookingCargo?.[0]?.NetWeight || 0,
            bookingRates: {
              revenue: totalRevenue,
              cost: totalCost,
              gp: totalRevenue - totalCost
            }

          };
        });

      return {
        CompanyMasterSid,
        BranchMasterSid,
        FromDate,
        ToDate,
        count: data.length,
        data
      };

    } catch (error) {
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
    branchIds?: number[]
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
      Dept: deptId
    } = params

    try {

      const branches = BranchId && BranchId.length > 0
        ? await this._db.branchMaster.findMany({
          where: { BranchMasterSid: { in: BranchId } },
          select: { BranchMasterSid: true, branchName: true },
        })
        : await this._db.branchMaster.findMany({
          where: { CompanyMasterSid },
          select: { BranchMasterSid: true, branchName: true },
        });

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);

      const departments = deptId && deptId.length > 0
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

      const resolvedDeptIds = departments.map(d => d.DepartmentMasterSid);
      const resolvedDeptNames = departments.map(d => d.departmentName).join(', ');

      // Booking data
      const bookingData = await this._db.bookingHeader.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { BookingDateTime: { gte: FromDate } },
            { BookingDateTime: { lte: ToDate } }
          ],
          status: 'A',
          DepartmentMasterSid: { in: resolvedDeptIds },
        },
        select: {
          bookingRates: {
            select: {
              RevenueLocalAmount: true,
              CostLocalAmount: true
            }
          },
          DepartmentMasterSid: true,
          BookingHeaderSid: true,
          bookingCargo: {
            select: {
              NetWeight: true,
              GrossWeight: true,
              Volume: true
            }
          }
        },
        orderBy: { BookingDateTime: 'asc' }
      })

      const allBookingDetails = bookingData.map((b => {
        return {
          bookingSid: b.BookingHeaderSid,
          dept: b.DepartmentMasterSid,
          grossWt: b.bookingCargo?.[0]?.GrossWeight,
          netWt: b.bookingCargo?.[0]?.NetWeight,
          vol: b.bookingCargo?.[0]?.Volume,
          revenueLocalAmt: b.bookingRates?.[0]?.RevenueLocalAmount,
          costLocalAmt: b.bookingRates?.[0]?.CostLocalAmount
        }
      }))

      const bookingDeptSummary = allBookingDetails.reduce((acc, b) => {
        const dept = departments.find(d => d.DepartmentMasterSid === b.dept)?.departmentName || '';

        if (!acc[dept]) {
          acc[dept] = {
            dept,
            totalBookings: 0,
            totalGrossWt: 0,
            totalNetWt: 0,
            totalVolume: 0,
            totalRevenue: 0,
            totalCost: 0,
            totalProfit: 0
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
      }, {} as Record<number, any>);


      // ------------------------------------
      // Master Job data
      const masterJob = await this._db.masterJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { MasterJobDate: { gte: FromDate } },
            { MasterJobDate: { lte: ToDate } }
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
                }
              }
            }
          },
        },
        orderBy: { MasterJobDate: 'asc' }
      })

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true }
      });

      const containerTypeMap = new Map(
        containerTypesMaster.map(ct => [ct.ContainerTypeMasterSid, ct.ContainerSize])
      );

      const masterWithCR = await Promise.all(
        masterJob.map(async (m) => {

          const masterContainerSid = m.containers?.[0]?.MasterJobContainerSid;

          const containerInfo = (m.containers || [])
            .filter(c => c.MasterJobContainerSid === masterContainerSid)
            .map(c => {
              const containerTypeId = c.ContainerType;
              return {
                containerNumber: c.ContainerNumber,
                containerType: containerTypeId != null
                  ? containerTypeMap.get(containerTypeId) || `Unknown(${containerTypeId})`
                  : '',
              };
            });
          const containerSize = ["20'", "40'", "45'"];

          const containerCountByType: Record<string, number> = {};
          let totalNoOfTEU = 0;
          let numberOfFourtyFt = 0;
          let numberofFurtyFive = 0;
          let numberOfTwentyFt = 0;
          containerSize.forEach(col => containerCountByType[col] = 0);

          (m.containers || []).forEach(c => {

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
              status: 'A'
            },
            select: {
              CostLocalAmount: true,
              RevenueLocalAmount: true
            }
          });

          const totalRevenue = relatedCR.reduce(
            (s, r) => s + Number(r.RevenueLocalAmount || 0), 0
          );

          const totalCost = relatedCR.reduce(
            (s, r) => s + Number(r.CostLocalAmount || 0), 0
          );

          return {
            ...m,
            totalRevenue,
            totalCost,
            totalNoOfTEU
          };
        })
      );

      const reportMap = masterWithCR.reduce((acc, m) => {
        const dept = departments.find(d => d.DepartmentMasterSid == m.DepartmentMasterSid)?.departmentName || '';

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
            TEU: 0
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
      }, {} as Record<number, any>);

      // House Job Data ------------------------------------------

      const houseData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { HBLDate: { gte: FromDate } },
            { HBLDate: { lte: ToDate } }
          ],
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
            }
          },
          MenuMasterSid: true,
          HouseJobSid: true
        },
        orderBy: { HBLDate: 'asc' }
      })


      const housewithrate = await Promise.all(
        houseData.map(async (m) => {
          const relatedCR = await this._db.costRevenueCharges.findMany({
            where: {
              MenuMasterSid: m.MenuMasterSid!,
              TransactionSid: m.HouseJobSid,
              status: 'A'
            },
            select: {
              CostLocalAmount: true,
              RevenueLocalAmount: true
            }
          });

          const totalRevenue = relatedCR.reduce(
            (s, r) => s + Number(r.RevenueLocalAmount || 0), 0
          );

          const totalCost = relatedCR.reduce(
            (s, r) => s + Number(r.CostLocalAmount || 0), 0
          );

          return {
            ...m,
            totalRevenue,
            totalCost
          };
        })
      );

      const houseWithAllCal = housewithrate.reduce((acc, m) => {
        const dept = departments.find(d => d.DepartmentMasterSid === m.DepartmentMasterSid)?.departmentName || '';

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
            TEUs: 0
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
      }, {} as Record<number, any>);

      // salesman Performance

      const allSalesman = await this._db.userMaster.findMany({
        where: {
          userCompanyMaster: {
            some: { CompanyMasterSid },
          }
        },
        select: {
          UserMasterSid: true,
          userName: true
        }
      });

      const quotationCount = await this._db.quoteHeader.groupBy({
        where: {
          CompanyMasterSid,
          QuoteDate: { gte: FromDate, lte: ToDate },
          DepartmentMasterSid: { in: resolvedDeptIds },
          BranchMasterSid: { in: resolvedBranchIds }
        },
        by: ['SalesmanSid', 'DepartmentMasterSid'],
        _count: { _all: true }
      });

      const enquiryCount = await this._db.enquiryHeader.groupBy({
        where: {
          CompanyMasterSid,
          EnquiryDate: { gte: FromDate, lte: ToDate },
          DepartmentMasterSid: { in: resolvedDeptIds },
          BranchMasterSid: { in: resolvedBranchIds },
          UserMasterSid: { not: null }
        },
        by: ['UserMasterSid', 'DepartmentMasterSid'],
        _count: { _all: true }
      });

      const bookingCount = await this._db.bookingHeader.groupBy({
        where: {
          CompanyMasterSid,
          BookingDateTime: { gte: FromDate, lte: ToDate },
          DepartmentMasterSid: { in: resolvedDeptIds },
          BranchMasterSid: { in: resolvedBranchIds },
          SalesmanSid: { not: null }
        },
        by: ['SalesmanSid', 'DepartmentMasterSid'],
        _count: { _all: true }
      });

      const leadCount = await this._db.preCustomerMaster.groupBy({
        by: ['leadAssignTo'],
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          leadAssignTo: { not: null }
        },
        _count: {
          leadAssignTo: true
        }
      });

      const meetingCount = await this._db.preCustomerMaster.groupBy({
        by: ['leadAssignTo'],
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          leadAssignTo: { not: null }
        },
        _count: {
          leadAssignTo: true
        }
      });


      const makeKey = (sid: number, dept: number) => `${sid}_${dept}`;

      const quotationMap = new Map<string, number>();
      quotationCount.forEach(q => {
        if (q.SalesmanSid && q.DepartmentMasterSid) {
          quotationMap.set(makeKey(q.SalesmanSid, q.DepartmentMasterSid), q._count._all);
        }
      });

      const enquiryMap = new Map<string, number>();
      enquiryCount.forEach(e => {
        if (e.UserMasterSid && e.DepartmentMasterSid) {
          enquiryMap.set(makeKey(e.UserMasterSid, e.DepartmentMasterSid), e._count._all);
        }
      });

      const bookingMap = new Map<string, number>();
      bookingCount.forEach(b => {
        if (b.SalesmanSid && b.DepartmentMasterSid) {
          bookingMap.set(makeKey(b.SalesmanSid, b.DepartmentMasterSid), b._count._all);
        }
      });

      const leadMap = new Map<number, number>();
      leadCount.forEach(l => {
        if (l.leadAssignTo) {
          leadMap.set(l.leadAssignTo, l._count.leadAssignTo);
        }
      });

      const meetingMap = new Map<number, number>();
      meetingCount.forEach(m => {
        if (m.leadAssignTo) {
          meetingMap.set(m.leadAssignTo, m._count.leadAssignTo);
        }
      });


      const salesmanSummary: any[] = [];

      for (const dept of resolvedDeptIds) {
        for (const user of allSalesman) {

          const key = makeKey(user.UserMasterSid, dept);

          const q = quotationMap.get(key) || 0;
          const e = enquiryMap.get(key) || 0;
          const b = bookingMap.get(key) || 0;
          const l = leadMap.get(user.UserMasterSid) || 0;
          const m = meetingMap.get(user.UserMasterSid) || 0;

          if (q || e || b || l || m) {
            salesmanSummary.push({
              DepartmentMasterSid: dept,
              SalesmanSid: user.UserMasterSid,
              SalesmanName: user.userName,
              TotalQuotations: q,
              TotalEnquiries: e,
              TotalBookings: b,
              TotalLeads: l,
              TotalMeetings: m
            });
          }
        }
      }

      // -------Customer O/S------------


      const coa = await this._db.cOAMaster.findFirst({
        where: { CompanyMasterSid, Status: 'A' },
        select: { LedgerName: true }
      });

      const vouchers = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          AND: [
            { VoucherDate: { gte: FromDate } },
            { VoucherDate: { lte: ToDate } }
          ],
          Status: 'A'
        },
        include: { subledgerMaster: true, voucherMatchings: { where: { Status: 'A' } } },
        orderBy: [
          { VoucherDate: 'asc' },
        ],
      });


      const reportData = vouchers.map(v => {
        const matchLocal = v.voucherMatchings.reduce(
          (acc, m) => acc + (m.DrCr === 'D' ? +m.LocalAmount : -m.LocalAmount), 0
        );
        const matchCurr = v.voucherMatchings.reduce(
          (acc, m) => acc + (m.DrCr === 'D' ? +m.Amount : -m.Amount), 0
        );

        const ageing = Math.floor((+new Date() - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24)) + 1;

        return {
          VoucherTransactionSid: v.VoucherTransactionSid,
          LedgerName: coa?.LedgerName,
          SubledgerName: v.subledgerMaster?.SubledgerName,
          LedgerMasterSid: v.LedgerMasterSid,
          VoucherDate: v.VoucherDate,
          CurrencyCode: v.CurrencyCode,
          DrCr: v.DrCr,
          Ageing: ageing,
          OriginalCurrAmount: Number(v.Amount),
          OriginalLocalAmount: Number(v.LocalAmount),
          OSCurrencyAmount: Number(v.Amount) - Math.abs(matchCurr),
          OSLocalAmount: Number(v.LocalAmount) - Math.abs(matchLocal),
          OnAccountCreditCurr: v.DrCr === 'C' ? Number(v.Amount) - Math.abs(matchCurr) : 0,
          OnAccountCreditLocal: v.DrCr === 'C' ? Number(v.LocalAmount) - Math.abs(matchLocal) : 0,
        };
      });


      const bucketRanges = [30, 60, 90, 120];
      const bucketLabels = ['0-30', '31-60', '61-90', '91-120', '120 & Above'];


      const customerRowsMap = new Map<number, any>();

      reportData.forEach(row => {
        const subId = row.LedgerMasterSid;
        if (subId === null) return; 

        if (!customerRowsMap.has(subId)) {
          customerRowsMap.set(subId, {
            SubledgerName: row.SubledgerName,
            // SalesmanName: row.Salesman || '',
            TotalOutstanding: 0,
            buckets: {
              '0-30': 0,
              '31-60': 0,
              '61-90': 0,
              '91-120': 0,
              '120 & Above': 0
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
            { VoucherDate: { lte: ToDate } }
          ],
          Status: 'A',
        },
        select: {
          CashOrBank: true,
          LocalAmount: true,
          Amount: true,
          VoucherDetail: {
            select: {
              DrCr: true,
              LedgerMasterSid: true,
              COAMasterSid: true
            }
          },
        },
        orderBy: { VoucherDate: 'asc' }
      })

      const coamaster = await this._db.cOAMaster.findMany({
        select: {
          COAMasterSid: true,
          LedgerName: true,
        }
      })

      const AllCashAndBank = AllBankCash.map(bc => {

        const drCr = bc.VoucherDetail?.[0]?.DrCr
        return {
          ledgerMasterSid: bc.VoucherDetail?.[0]?.LedgerMasterSid,
          Account: coamaster.find(c => c.COAMasterSid === bc.VoucherDetail?.[0]?.COAMasterSid)?.LedgerName || '',
          DrAmount: drCr === 'D' ? Number(bc.LocalAmount) : 0,
          CrAmount: drCr === 'C' ? Number(bc.LocalAmount) : 0,
          Balance:
            (drCr === 'D' ? Number(bc.LocalAmount) : 0) -
            (drCr === 'C' ? Number(bc.LocalAmount) : 0),
        };
      });

      // ----Vendor Os ---------
      const vendorOsVouchers = await this._db.voucherTransaction.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: resolvedBranchIds },
          DepartmentMasterSid: { in: resolvedDeptIds },
          VoucherDate: { gte: FromDate, lte: ToDate },
          Status: 'A',
          voucherTypeMaster: {
            DocumentTypeCode: 'VINV'
          }
        },
        include: {
          subledgerMaster: true,
          voucherMatchings: {
            where: { Status: 'A' }
          }
        },
        orderBy: { VoucherDate: 'asc' }
      });


      const vendorReportData = vendorOsVouchers.map(v => {
        const matchLocal = v.voucherMatchings.reduce(
          (acc, m) => acc + (m.DrCr === 'D' ? +m.LocalAmount : -m.LocalAmount), 0
        );

        const ageing =
          Math.floor((+new Date() - +new Date(v.VoucherDate)) / (1000 * 60 * 60 * 24)) + 1;

        return {
          SubledgerMasterSid: v.subledgerMaster?.SubledgerMasterSid,
          SubledgerName: v.subledgerMaster?.SubledgerName,
          Ageing: ageing,
          OSLocalAmount: Number(v.LocalAmount) - Math.abs(matchLocal),
        };
      });

      

      const vendorRowsMap = new Map<number, any>();

      vendorReportData.forEach(row => {
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
              '120 & Above': 0
            }
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
          Status: 'A'
        },
        select: {
          SubledgerMasterSid: true,
          SubledgerMappingSid: true
        }
      });


      const subledgerToCustomerMap = new Map<number, number>();

      for (const s of subledgers) {
        if (s.SubledgerMappingSid) {
          subledgerToCustomerMap.set(s.SubledgerMasterSid, s.SubledgerMappingSid);
        }
      }


      const customerIds = Array.from(subledgerToCustomerMap.values());

      const customers = await this._db.customerMaster.findMany({
        where: {
          CustomerMasterSid: { in: customerIds }
        },
        include: {
          customerCreditRequest: {
            where: {
              ApprovalStatus: ApprovalStatus.Approved,
              Status: 'A'
            }
          }
        }
      });


      const customerCreditMap = new Map<number, { CreditDays: number; CreditLimit: number }>();

      for (const customer of customers) {
        let CreditDays = 0;
        let CreditLimit = 0;

        if (
          customer.CashCredit !== 'C' &&
          customer.customerCreditRequest.length > 0
        ) {
          const reqWithHighestLimit = customer.customerCreditRequest.reduce((acc, req) =>
            req.CreditLimit > acc.CreditLimit ? req : acc
          );

          CreditDays = reqWithHighestLimit.CreditDays;
          CreditLimit = reqWithHighestLimit.CreditLimit;
        }

        customerCreditMap.set(customer.CustomerMasterSid, { CreditDays, CreditLimit });
      }


      const subledgerCreditMap = new Map<number, { CreditDays: number; CreditLimit: number }>();

      for (const [subledgerId, customerId] of subledgerToCustomerMap.entries()) {
        const credit = customerCreditMap.get(customerId) ?? { CreditDays: 0, CreditLimit: 0 };
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
        params
      }

    } catch (error) {
      throw error
    }
  }

  // Tradelane Profitability
  async generateTradelaneProfitability(params: tradelaneProfitabilityReportQueryDto) {
    const {
      FromDate,
      ToDate,
      Branch: branhId,
      companyId: CompanyMasterSid,
      POL,
      POD
    } = params

    try {

      let polCode: string | undefined;
      let podCode: string | undefined;

      if (POL) {
        const polRow = await this._db.portMaster.findFirst({
          where: { PortMasterSid: Number(POL) },
          select: { PortCode: true, PortName: true }
        });
        polCode = polRow?.PortCode;
      }

      if (POD) {
        const podRow = await this._db.portMaster.findFirst({
          where: { PortMasterSid: Number(POD) },
          select: { PortCode: true, PortName: true }
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

      const resolvedBranchIds = branches.map(b => b.BranchMasterSid);
      const resolvedBranchNames = branches.map(b => b.branchName);

      const whereCondition: any = {
        CompanyMasterSid,
        BranchMasterSid: { in: resolvedBranchIds },
        AND: [
          { BookingDateTime: { gte: FromDate } },
          { BookingDateTime: { lte: ToDate } }
        ],
        status: 'A'
      };

      if (polCode) whereCondition.POL = polCode;
      if (podCode) whereCondition.POD = podCode;


      const bookingData = await this._db.bookingHeader.findMany({
        where: whereCondition,
        include: {
          bookingCargo: true,
          bookingRates: true
        }
      })

      const AllBooking = bookingData.map(b => {
        const revenue = b.bookingRates?.[0]?.RevenueLocalAmount
        const cost = b.bookingRates?.[0]?.CostLocalAmount
        return {
          bookingNo: b.BookingNo,
          POL: b.POL,
          POD: b.POD,
          grossWt: b.bookingCargo?.[0]?.GrossWeight,
          netWt: b.bookingCargo?.[0]?.NetWeight,
          vol: b.bookingCargo?.[0]?.Volume,
          revenueLocalAmt: revenue,
          costLocalAmt: cost,
          profit: Number(revenue) - Number(cost),
        }
      })

      const routeMap = new Map<string, any>();

      AllBooking.forEach(b => {
        const routeKey = `${b.POL} - ${b.POD}`;

        if (!routeMap.has(routeKey)) {
          routeMap.set(routeKey, {
            route: routeKey,
            rows: [],
            totals: {
              revenue: 0,
              cost: 0,
              profit: 0,
              grossWt: 0,
              netWt: 0,
              vol: 0,
            }
          });
        }

        const routeGroup = routeMap.get(routeKey);

        routeGroup.rows.push(b);

        routeGroup.totals.revenue += Number(b.revenueLocalAmt || 0);
        routeGroup.totals.cost += Number(b.costLocalAmt || 0);
        routeGroup.totals.profit += Number(b.profit || 0);
        routeGroup.totals.grossWt += Number(b.grossWt || 0);
        routeGroup.totals.netWt += Number(b.netWt || 0);
        routeGroup.totals.vol += Number(b.vol || 0);
      });

      const groupedRoutes = Array.from(routeMap.values());


      const displayPOL = polCode ?? 'All';
      const displayPOD = podCode ?? 'All';


      return {
        params,
        resolvedBranchNames,
        filters: {
          POL: displayPOL,
          POD: displayPOD
        },
        groupedRoutes
      }
    } catch (error) {
      throw error
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
    } = params

    try {
      const baseWhere = {
        CompanyMasterSid,
        BranchMasterSid,
        DepartmentMasterSid,
        AND: [
          { MasterJobDate: { gte: FromDate } },
          { MasterJobDate: { lte: ToDate } }
        ]
      }

      const department = await this._db.departmentMaster.findMany({
        select: { DepartmentMasterSid: true, departmentName: true }
      })

      const containerTypesMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true }
      });

      const containerTypeMap = new Map(
        containerTypesMaster.map(ct => [ct.ContainerTypeMasterSid, ct.ContainerSize])
      );

      const masterJobData = await this._db.masterJob.findMany({
        where: baseWhere,
        include: {
          houseJob: true,
          others: true,
          containers: {
            where: { Status: 'A' },
            include: {
              containerType: {
                select: {
                  ContainerSize: true,
                  NoOfTeu: true
                }
              }
            }
          },
        },
        orderBy: { MasterJobDate: 'asc' }
      })

      const masterJobMenu = await this._db.menuMaster.findFirst({
        where: { MenuName: 'Master Job' },
        select: { MenuMasterSid: true },
      });

      if (!masterJobMenu) {
        throw new BadRequestException('Master Job menu not found');
      }

      const masterJobIds = masterJobData.map(h => h.MasterJobSid);

      const masterCR = await this._db.costRevenueCharges.findMany({
        where: {
          MenuMasterSid: masterJobMenu.MenuMasterSid,
          TransactionSid: { in: masterJobIds },
          status: 'A'
        },
        select: {
          RevenueLocalAmount: true,
          CostLocalAmount: true,
          TransactionSid: true
        }
      });

      const jobRows = masterJobData.map(m => {

        const containerSize = ["20'", "40'", "45'"];

        const containerCountByType: Record<string, number> = {};
        let totalNoOfTEU = 0;
        let numberOfFourtyFt = 0;
        let numberofFurtyFive = 0;
        let numberOfTwentyFt = 0;
        containerSize.forEach(col => containerCountByType[col] = 0);

        (m.containers || []).forEach(c => {

          const teu = Number(c.containerType?.NoOfTeu || 0);
          totalNoOfTEU += teu;

          const size = c.containerType?.ContainerSize?.trim();

          if (size === '20') numberOfTwentyFt++;
          if (size === '40') numberOfFourtyFt++;
          if (size === '45') numberofFurtyFive++;
        });

        const crForJob = masterCR.filter(
          cr => cr.TransactionSid === m.MasterJobSid
        );

        const totalRevenue = crForJob.reduce(
          (sum, c) => sum + Number(c.RevenueLocalAmount || 0), 0
        );

        const totalCost = crForJob.reduce(
          (sum, c) => sum + Number(c.CostLocalAmount || 0), 0
        );

        const grossProfit = totalRevenue - totalCost;

        const gpPercentage = Number(grossProfit) / Number(totalRevenue) * 100;

        return {
          MBLNo: m.MBLNo,
          department: department.find(d => d.DepartmentMasterSid === m.DepartmentMasterSid)?.departmentName || '',
          grossWt: Number(m.GrossWeight || 0),
          vol: Number(m.Volume || 0),
          shipmentCount: m.houseJob.length,
          totalRevenue,
          totalCost,
          grossProfit,
          totalNoOfTEU,
          gpPercentage
        };
      });


      const departmentWise = Object.values(
        jobRows.reduce((acc: any, row) => {

          if (row.department?.toLowerCase() === 'Air') {
            return acc;
          }

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
              gpPercentage:0,
              jobs: []
            };
          }

          acc[row.department].totalShipment += row.shipmentCount;
          acc[row.department].totalGrossWt += row.grossWt;
          acc[row.department].totalVolume += row.vol;
          acc[row.department].totalRevenue += row.totalRevenue;
          acc[row.department].totalCost += row.totalCost;
          acc[row.department].grossProfit += row.grossProfit;
          acc[row.department].totalNoOfTEU += row.totalNoOfTEU;
          acc[row.department].gpPercentage += row.gpPercentage;
          acc[row.department].jobs.push(row);

          return acc;
        }, {})
      );


      return {
        data: departmentWise,
        params
      }

    } catch (error) {
      throw error
    }
  }

  async getCustomerName(companyMasterSid: number, customerMasterSid: number): Promise<string> {
    try {
      const customer = await this._db.customerMaster.findUnique({
        where: {
          CompanyMasterSid: companyMasterSid,
          CustomerMasterSid: customerMasterSid
        },
        select: {
          CustomerName: true
        }
      });
      return customer?.CustomerName || "";

    } catch (error) {
      throw error;
    }
  }

  async getSalespersonName(companyMasterSid: number, userId: number | null): Promise<string> {
    if (!userId) return '';
    try {
      const user = await this._db.userMaster.findUnique({
        where: {
          UserMasterSid: userId,
          userCompanyMaster: {
            some: {
              CompanyMasterSid: companyMasterSid
            }
          }
        },
        select: {
          userName: true
        }
      })
      return user?.userName || "";
    } catch (error) {
      throw error;
    }
  }


  async exportReport(reportName: string, exportParams: any) {
    try {
      // Generate report first
      const reportData = await this.generateReport(reportName, exportParams.parameters);

      // Format and export based on format
      const format = exportParams.format || 'EXCEL';

      // TODO: Implement actual export logic using report-export service
      return {
        reportName,
        format,
        data: reportData,
        exportedAt: new Date(),
        message: `Export to ${format} will be implemented by report-export service`
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
        format: emailParams.format || 'PDF'
      });

      // TODO: Implement email service integration
      this.logger.log(`Email report to: ${emailParams.email}`);

      return {
        success: true,
        message: 'Email service integration pending'
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
    context: { companyId?: number; branchId?: number }
  ): Promise<Array<{ value: any; label: string }>> {
    try {
      // Fetch the parameter details
      const parameter = await this._db.reportMasterDetail.findFirst({
        where: {
          ReportMasterDetailSid: parameterId,
          Status: 'A'
        }
      });

      if (!parameter) {
        throw new BadRequestException(`Parameter with ID ${parameterId} not found`);
      }

      if (!parameter.ParameterQuery) {
        throw new BadRequestException(
          `Parameter ${parameter.ParameterName} does not have a query defined`
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
      const results = await this._db.$queryRawUnsafe<Array<{ value: any; label: string }>>(query);

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
        throw new BadRequestException(`Query contains forbidden keyword: ${keyword}`);
      }
    }

    // Additional security: check for multiple statements
    const statements = query.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      throw new BadRequestException('Multiple SQL statements are not allowed');
    }
  }
}
