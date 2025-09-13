import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class PortService {
  logger: any;
  constructor(private _db: DatabaseService, private globalConfigService: GlobalConfigService) { }

  async createPort(payload) {
    // this.logger.warn(`createPortUser: ${payload}`);

    const existing = await this._db.portMaster.findFirst({
      where: {
        OR: [
          {
            PortName: {
              equals: payload.PortName.trim(),
              mode: 'insensitive',
            },
          },
          {
            PortCode: {
              equals: payload.PortCode.trim(),
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    if (existing) {
      if (existing.PortName === payload.PortName) {
        throw new BadRequestException('Port name already exists');
      }
      if (existing.PortCode === payload.PortCode) {
        throw new BadRequestException('Port code already exists');
      }
    }

    try {
      const port = await this._db.portMaster.create({
        data: payload,
      });

      return port;
    } catch (error) {
      throw new Error(`Error creating port: ${error.message}`);
    }
  }

  async getAllPorts() {
    try {
      const port = await this._db.portMaster.findMany({
        include: {
          countryMaster: {
            select: {
              countryName: true,
            },
          },
          sectorMaster: {
            select: {
              sectorName: true,
            },
          },
          stateMaster: {
            select: {
              stateName: true,
            },
          },
        },
        where: {
          status: "A"
        },
        orderBy: {
          PortName: 'asc'
        }
      });
      return port;
    } catch (error) {
      throw error;
    }
  }

  async findOne(PortMasterSid: any) {
    try {
      return await this._db.portMaster.findUnique({
        include: {
          countryMaster: {
            select: {
              countryName: true,
            },
          },
          sectorMaster: {
            select: {
              sectorName: true,
            },
          },
          stateMaster: {
            select: {
              stateName: true,
            },
          },
        },
        where: {
          PortMasterSid: PortMasterSid,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  async updatePort(PortMasterSid: number, payload) {
    const existing = await this._db.portMaster.findUnique({
      where: {
        PortMasterSid: PortMasterSid
      }
    });

    if (!existing) {
      throw new BadRequestException(`Port Master with Id : ${PortMasterSid} not exists`)
    }

    try {
      const port = await this._db.portMaster.update({
        where: {
          PortMasterSid: PortMasterSid,
        },
        data: {
          ...payload,
        }
      });
      return port;
    } catch (error) {
      throw new Error(`Error updating port: ${error.message}`);
    }
  }

  async softDelete(id: number) {
    const existingPort = await this._db.portMaster.findUnique({
      where: { PortMasterSid: id },
    });

    if (!existingPort) {
      throw new NotFoundException(`Port with ID ${id} not found`);
    }

    if (existingPort.status === "D") {
      throw new Error(`Port with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.portMaster.update({
      where: { PortMasterSid: id },
      data: { status: "D" },
    });
  }

  async searchPort(data: SearchListDto) {
    const { searchType, filterValue } = data;
    const acceptedType = [
      'status',
      'PortCode',
      'PortName',
      'TimeZone',
      'EdiPortCode',
      'ExportRestriction',
      'ImportRestriction',
      'PortType',
      'TerminalCode',
      'CBMRequire',
      'SCMTPortCode',
    ];
    if (!acceptedType.includes(searchType)) {
      throw new BadRequestException('Invalid Search Type');
    }
    const searchResults = await this._db.portMaster
      .findMany({
        where: {
          [searchType]: {
            contains: filterValue,
            mode: 'insensitive',
          },
          status: "A"
        },
        include: {
          countryMaster: {
            select: {
              countryName: true
            }
          },
          sectorMaster: {
            select: {
              sectorName: true
            }
          },

        }
      })
      .catch((err) => {
        throw new Error(`Error Occured ${err}`);
      });
    return searchResults;
  }

  async searchPortNew(params: filterDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PortMasterWhereInput = {

      status: 'A',
      ...(search
        ? {
          OR: [
            { PortName: { contains: search, mode: 'insensitive' } },
            { PortCode: { contains: search, mode: 'insensitive' } },
            { countryMaster: { countryName: { contains: search, mode: 'insensitive' } } },
            { sectorMaster: { sectorName: { contains: search, mode: 'insensitive' } } },
            { stateMaster: { stateName: { contains: search, mode: 'insensitive' } } },
            { zoneMaster: { ZoneName: { contains: search, mode: 'insensitive' } } },
            { PortType: { contains: search, mode: 'insensitive' } },
            { TerminalCode: { contains: search, mode: 'insensitive' } },
          ],
        }
        : {}
      ),
    };

    let items;
    let totalCount;
    [items, totalCount] = await this._db.$transaction([
      this._db.portMaster.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { PortMasterSid: 'desc' },
      }),
      this._db.portMaster.count({ where }),
    ]);

    items = await Promise.all(items.map(async (item) => {

      const [countryMaster, sectorMaster] = await Promise.all([
        item.CountryMasterSid != null ?
          this.globalConfigService.getMasterData('country_master', item.CountryMasterSid, item.CompanyMasterSid) :
          { CountryMasterSid: null, countryName: '' },

        item.ZoneMasterSid != null ?
          this.globalConfigService.getMasterData('zone_master', item.ZoneMasterSid, item.CompanyMasterSid) :
          { ZoneMasterSid: null, zoneName: '' },
      ]);

      return {
        ...item,
        countryMaster,
        sectorMaster,
      };
    })
    );


    return {
      items,
      totalCount,
    }
  }
  async getAuditLogs(tableName: string, recordId?: string) {
    try {
      const whereClause: any = { tableName };
      if (recordId) whereClause.recordId = recordId;

      const logs = await this._db.auditLog.findMany({
        where: whereClause,
        orderBy: { changedAt: 'desc' },
      });

      return logs;
    } catch (error) {
      this.logger.warn(`getAuditLogsError: ${error}`);
      throw new Error(`Error fetching audit logs: ${error.message}`);
    }
  }
}
