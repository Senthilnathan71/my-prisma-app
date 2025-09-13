import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class ContainerActivityMasterService {
  constructor(private _db: DatabaseService, private logger: Logger) { }

  async getAllContainerActivities() {
    return this._db.containerActivityMaster.findMany({
      where: { deletedAt: null },
      include: { nextActivities: true }, // ✅ include mapping
    });
  }

  async createNewContainerActivity(payload: any) {
    return this._db.containerActivityMaster.create({
      data: {
        TransactionSid: payload.TransactionSid,
        ActivityCode: payload.ActivityCode,
        ActivityName: payload.ActivityName,
        ContainerMoveStatus: payload.ContainerMoveStatus,
        MoveType: payload.MoveType,
        IsDamageMove: payload.IsDamageMove || 'N',
        Remarks: payload.Remarks,
        Status: payload.Status,
        CreatedOn: new Date(),
        CreatedBy: payload.CreatedBy,
        nextActivities: payload.nextActivities
          ? {
            create: payload.nextActivities.map((act: any) => ({
              ActivityCode: act.ActivityCode,
            })),
          }
          : undefined,
      },
      include: { nextActivities: true },
    });
  }

  async fetchContainerActivityById(ContainerActivityMasterSid: number) {
    const activity = await this._db.containerActivityMaster.findUnique({
      where: { ContainerActivityMasterSid },
      include: { nextActivities: true },
    });

    if (!activity) {
      throw new BadRequestException(
        `Container Activity with Id : ${ContainerActivityMasterSid} not exists`,
      );
    }
    return activity;
  }

  async updateContainerActivityById(ContainerActivityMasterSid: number, payload: any) {
    const exist = await this._db.containerActivityMaster.findUnique({
      where: { ContainerActivityMasterSid },
    });
    if (!exist) {
      throw new BadRequestException(
        `Container Activity with Id : ${ContainerActivityMasterSid} not exists`,
      );
    }

    return this._db.containerActivityMaster.update({
      where: { ContainerActivityMasterSid },
      data: {
        ActivityCode: payload.ActivityCode,
        ActivityName: payload.ActivityName,
        ContainerMoveStatus: payload.ContainerMoveStatus,
        MoveType: payload.MoveType,
        IsDamageMove: payload.IsDamageMove || 'N',
        Remarks: payload.Remarks,
        Status: payload.Status || exist.Status,
        UpdatedOn: new Date(),
        UpdatedBy: payload.UpdatedBy,
        nextActivities: payload.nextActivities
          ? {
            deleteMany: {}, // ✅ clear old mappings
            create: payload.nextActivities.map((act: any) => ({
              ActivityCode: act.ActivityCode,
            })),
          }
          : undefined,
      },
      include: { nextActivities: true },
    });
  }

  async deleteContainerActivity(ContainerActivityMasterSid: number) {
    const exist = await this._db.containerActivityMaster.findUnique({
      where: { ContainerActivityMasterSid },
    });
    if (!exist) {
      throw new BadRequestException(
        `Container Activity with Id : ${ContainerActivityMasterSid} not exists`,
      );
    }
    if (exist.deletedAt) {
      throw new BadRequestException(
        `Container Activity with Id :${ContainerActivityMasterSid} is already deleted`,
      );
    }
    return this._db.containerActivityMaster.update({
      where: { ContainerActivityMasterSid },
      data: { deletedAt: new Date() },
    });
  }

  async searchContainerActivities(params: filterDto) {
    const { search = '', page = 1, pageSize = 15 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ContainerActivityMasterWhereInput = {
      deletedAt: null,
      Status: 'A',
      ...(search
        ? {
          OR: [
            { ActivityCode: { contains: search, mode: 'insensitive' } },
            { ActivityName: { contains: search, mode: 'insensitive' } },
            { ContainerMoveStatus: { contains: search, mode: 'insensitive' } },
            { MoveType: { contains: search, mode: 'insensitive' } },
            { Remarks: { contains: search, mode: 'insensitive' } },
            { Status: { contains: search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const [items, totalCount] = await this._db.$transaction([
      this._db.containerActivityMaster.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { ContainerActivityMasterSid: 'desc' },
        include: { nextActivities: true },
      }),
      this._db.containerActivityMaster.count({ where }),
    ]);

    return { items, totalCount };
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
