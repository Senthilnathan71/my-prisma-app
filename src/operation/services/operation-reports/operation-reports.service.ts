import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { Prisma } from '@prisma/client';
import { ShipmentSummaryReportQueryDto } from 'src/operation/DTO/operation-reports.dto';
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
        case 'container-kpi-report':
          return await this.generateContainerKPIReport(parameters);
        case 'do-issue-list':
          return await this.generateDOIssueList(parameters);
        case 'shipment-detailed-summary':
          return await this.generateShipmentDetailedSummary(parameters);
        default:
          throw new BadRequestException(`Report ${reportName} not implemented`);
      }
    } catch (error) {
      throw error;
    }
  }

  // Report generators - To be implemented
  private async generateBLIssueList(params: any) {
    // TODO: Implement BL Issue/Not Issue List logic
    this.logger.log('generateBLIssueList called with params:', params);
    throw new BadRequestException('BL Issue List generator not yet implemented');
  }

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
            where : { Status : 'A'},
            include : {
              containerType : {
                select : {
                  ContainerSize : true,
                  NoOfTeu : true,
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

      const containerSize = ["20'", "40'","45'"];

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
        let numberofFurtyFive=0;
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

          if(c.containerType?.ContainerSize.trim()==='45'){
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
          sendingAgent: agentMaster.find(d=>d.CustomerMasterSid === mj.OriginAgent)?.CustomerName || '',
          receivingAgent: agentMaster.find(d=>d.CustomerMasterSid === mj.DestinationAgent)?.CustomerName || '',
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

  private async generateContainerwiseDetailsReport(params: any) {
    // TODO: Implement Containerwise Master Details with Cost/Revenue logic
    this.logger.log('generateContainerwiseDetailsReport called with params:', params);
    throw new BadRequestException('Containerwise Details Report generator not yet implemented');
  }

  private async generateContainerKPIReport(params: any) {
    // TODO: Implement Container Wise KPI Report logic
    this.logger.log('generateContainerKPIReport called with params:', params);
    throw new BadRequestException('Container KPI Report generator not yet implemented');
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
