import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class PortService {
  logger: any;
  constructor(private _db: DatabaseService) {}

  async createPort(payload, user) {
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
          deletedAt: {
            equals: null,
          },
        },
        orderBy :{
          PortName : 'asc'
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

  async updatePort(PortMasterSid: number, payload, user) {
    const existing = await this._db.portMaster.findUnique({
      where :{
        PortMasterSid:PortMasterSid
      }
    });

    if(!existing) {
      throw new BadRequestException(`Port Master with Id : ${PortMasterSid} not exists`)
    }

    try {
      const port = await this._db.portMaster.update({
        where: {
          PortMasterSid: PortMasterSid,
        },
        data: {
          ...payload,
          updatedBy:'admin@crm.com'
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

    if (existingPort.deletedAt) {
      throw new Error(`Port with ID ${id} is already deleted`);
    }

    // Perform soft delete by updating deletedAt field
    return this._db.portMaster.update({
      where: { PortMasterSid: id },
      data: { deletedAt: new Date() },
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
          deletedAt:null
        },
        include : {
          countryMaster:{
            select:{
              countryName:true
            }
          },
          sectorMaster:{
            select:{
              sectorName:true
            }
          },
          
        }
      })
      .catch((err) => {
        throw new Error(`Error Occured ${err}`);
      });
    return searchResults;
  }
}
