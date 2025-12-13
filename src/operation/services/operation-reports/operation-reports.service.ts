import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { BLIssueListReportQueryDto, ContainerKPIReportQueryDto, profitabilityReportQueryDto, ShipmentSummaryReportQueryDto } from 'src/operation/DTO/operation-reports.dto';
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
        case 'shipment-detailed-summary':
          return await this.generateShipmentDetailedSummary(parameters);
        case 'profitability-report':
          return await this.generateProfitabilityReport(parameters);
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
      ToHBLDt,
      FromHBLDt,
      Branch: branchId,
      Dept: dept,
      BLIssue = false,
    } = params;

    try {
      this.logger.log(`Getting BL_Issue report for CompanySid=${CompanyMasterSid}, From=${FromHBLDt}, To=${ToHBLDt}`);

      const allBranches = await this._db.branchMaster.findMany({
        where: { BranchMasterSid: { in: branchId } },
        select: { branchName: true }
      });

      const branchSet = new Set(allBranches.map(b => b.branchName));

      const houseJobData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: branchId },
          AND: [
            { HBLDate: { gte: new Date(FromHBLDt) } },
            { HBLDate: { lte: new Date(ToHBLDt) } }
          ],
          status: 'A',
          DepartmentMasterSid: { in: dept },
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
          departmentName
        };
      });

      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        data,
        branchesInvolved: Array.from(branchSet).join(','),
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
      ToMBLDt,
      FromMBLDt,
      Branch: branchId,
      Dept: dept
    } = params;

    try {
      this.logger.log(`Getting shipment summary report for CompanySid=${CompanyMasterSid}, From=${FromMBLDt}, To=${ToMBLDt}`);

      // Query for branches involved
      const allBranches = await this._db.branchMaster.findMany({
        where: { BranchMasterSid: { in: branchId } },
        select: { branchName: true }
      });

      const branchSet = new Set(allBranches.map(b => b.branchName));

      // Check if departments exist, if dept is an array
      const departments = await this._db.departmentMaster.findMany({
        where: {
          DepartmentMasterSid: { in: dept },  // Using 'in' to handle multiple departments
        }
      });

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
          BranchMasterSid: { in: branchId },
          AND: [
            { MBLDate: { gte: new Date(FromMBLDt) } },
            { MBLDate: { lte: new Date(ToMBLDt) } }
          ],
          Status: 'A',
          DepartmentMasterSid: { in: dept },
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
          transhipmentVol
        };
      });



      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        data,
        branchesInvolved: Array.from(branchSet).join(','),
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
      ToMBLDt,
      FromMBLDt,
      Branch: branchId,
      Dept: dept,
    } = params;

    try {
      this.logger.log(
        `Getting Profitability report for CompanySid=${CompanyMasterSid}, From=${FromMBLDt}, To=${ToMBLDt}`
      );

      // Fetch branches
      const allBranches = await this._db.branchMaster.findMany({
        where: { BranchMasterSid: { in: branchId } },
        select: { branchName: true }
      });
      const branchSet = new Set(allBranches.map(b => b.branchName));

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
          BranchMasterSid: { in: branchId },
          AND: [
            { MBLDate: { gte: new Date(FromMBLDt) } },
            { MBLDate: { lte: new Date(ToMBLDt) } }
          ],
          Status: 'A',
          DepartmentMasterSid: { in: dept },
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
        const profit = (Number(GP) * 100) / Number(totalRevenue);
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
        branchesInvolved: Array.from(branchSet).join(','),
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
  //     ToMBLDt,
  //     FromMBLDt,
  //     Branch: branchId,
  //     Dept: dept,
  //   } = params;

  //   try {
  //     this.logger.log(
  //       `Getting Profitability report for CompanySid=${CompanyMasterSid}, From=${FromMBLDt}, To=${ToMBLDt}`
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
  //           { MBLDate: { gte: new Date(FromMBLDt) } },
  //           { MBLDate: { lte: new Date(ToMBLDt) } }
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

  private async generateContainerwiseDetailsReport(params: ContainerKPIReportQueryDto) {
    // TODO: Implement Containerwise Master Details with Cost/Revenue logic
    this.logger.log('generateContainerwiseDetailsReport called with params:', params);
    throw new BadRequestException('Containerwise Details Report generator not yet implemented');
  }

  private async generateContainerKPIReport(params: any) {
    const {
      companyId: CompanyMasterSid,
      ToHBLDt,
      FromHBLDt,
      Branch: branchId,
      Dept: dept,
    } = params;

    try {
      this.logger.log(`Getting Container_Wise_KPI report for CompanySid=${CompanyMasterSid}, From=${FromHBLDt}, To=${ToHBLDt}`);

      const allBranches = await this._db.branchMaster.findMany({
        where: { BranchMasterSid: { in: branchId } },
        select: { branchName: true }
      });


      // charge matser
      const chargeMaster = await this._db.chargeMaster.findMany({
        select: { ChargeMasterSid: true, chargeGroup: true }
      });

      const chargeGroupMap = new Map<number, any>();

      chargeMaster.forEach(cm => {
        chargeGroupMap.set(cm.ChargeMasterSid, cm.chargeGroup);
      });

      // port master 

      const portMaster = await this._db.portMaster.findMany({
        select: { PortMasterSid: true, PortName: true }
      });


      // container Master 

      const containerMaster = await this._db.containerTypeMaster.findMany({
        select: { ContainerTypeMasterSid: true, ContainerSize: true, ContainerName: true }
      })


      const branchSet = new Set(allBranches.map(b => b.branchName));

      const houseData = await this._db.houseJob.findMany({
        where: {
          CompanyMasterSid,
          BranchMasterSid: { in: branchId },
          AND: [
            { HBLDate: { gte: new Date(FromHBLDt) } },
            { HBLDate: { lte: new Date(ToHBLDt) } }
          ],
          status: 'A',
          DepartmentMasterSid: { in: dept },
        },
        include: {
          masterJob: {
            where: {
              Status: "A"
            },
            select: {
              voyages: true
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

      // Create map of ContainerTypeMasterSid -> ContainerSize
      const containerTypeMap = new Map<number, string>();
      containerMaster.forEach(ct => {
        if (ct.ContainerTypeMasterSid != null) {
          containerTypeMap.set(ct.ContainerTypeMasterSid, ct.ContainerName);
        }
      });


      const data = houseData.map(data => {
        const costRevenueCharges = houseRateMap.get(data.HouseJobSid) || [];

        const freightRevenue = costRevenueCharges
          .filter(cr =>
            cr.RevenueLocalAmount &&
            chargeGroupMap.get(cr.ChargeMasterSid)?.GroupName === 'Freight'
          )
          .reduce((sum, cr) => sum + Number(cr.RevenueLocalAmount), 0);

        const product = data.Products?.[0];


        let containerName = '';
        if (product?.MasterJobContainerSid != null) {
          containerName = containerTypeMap.get(product.MasterJobContainerSid) || '';
        }

        return {
          bookingNo: data?.bookingHeader?.[0]?.bookingNo,
          vesselName: data?.VesselName,
          MBL: data?.MBLNo,
          HBL: data?.HBLNo,
          shipmentType: data?.Cargo?.[0]?.ShipmentTerms,
          consigneeName: data?.ConsigneeName,
          fnalDestination: data?.FPD,
          portofDischarge: data?.POD,
          ETA: data?.ETA,
          ETD: data?.ETD,
          freightTerms: data?.FreightTerms,
          bookingDate: data?.BookingDateTime,
          containerNo: product?.ContainerNo,
          containerName,
          containerSid: product?.MasterJobContainerSid,
          vol: product?.Volume,
          weight: product?.GrossWeight,
          costRevenueCharges,
          freightRevenue,
          dgDelaration: product?.IsHaz,
          ATDPOL: data?.masterJob?.voyages?.[0]?.ATD
        };
      });


      return {
        companyMasterSid: CompanyMasterSid,
        branchMasterSid: branchId,
        data,
        branchesInvolved: Array.from(branchSet).join(','),
        params,
      };

    } catch (error) {
      this.logger.error(`Error generating shipment summary: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async generateDOIssueList(params: any) {
    // TODO: Implement DO Issue/Not Issued List logic
    this.logger.log('generateDOIssueList called with params:', params);
    throw new BadRequestException('DO Issue List generator not yet implemented');
  }

  private async generateShipmentDetailedSummary(params: any) {
    // TODO: Implement Shipment Summary - All Details logic
    this.logger.log('generateShipmentDetailedSummary called with params:', params);
    throw new BadRequestException('Shipment Detailed Summary generator not yet implemented');
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
