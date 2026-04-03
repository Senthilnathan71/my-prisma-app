import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class MenuUserConfigService {
  constructor(
    private readonly _db: DatabaseService,
    private readonly logger: Logger,
  ) {}

  async getMenuUserConfig(
    companyMasterSid: number,
    branchMasterSid?: number,
  ) {
    try {
      const where: any = {
        CompanyMasterSid: companyMasterSid,
        Status: 'A',
      };
      if (branchMasterSid) {
        where.BranchMasterSid = branchMasterSid;
      }

      const configs = await (this._db as any).menuUserConfig.findMany({
        where,
        include: {
          branchMaster: {
            select: { branchName: true, BranchMasterSid: true },
          },
          userMaster: {
            select: { userName: true, UserMasterSid: true },
          },
        },
        orderBy: { MenuUserConfigSid: 'asc' },
      });

      return configs.map((c: any) => ({
        MenuUserConfigSid: c.MenuUserConfigSid,
        BranchMasterSid: c.BranchMasterSid,
        branchName: c.branchMaster?.branchName || '',
        stage: c.Stage,
        assignedRole: c.AssignedRole || null,
        UserMasterSid: c.UserMasterSid || null,
        userName: c.userMaster?.userName || '',
      }));
    } catch (error: any) {
      this.logger.error(`Error fetching menu user config: ${error.message}`);
      throw error;
    }
  }

  async saveMenuUserConfig(
    configs: {
      MenuUserConfigSid?: number;
      BranchMasterSid: number;
      stage: string;
      assignedRole: string | null;
      UserMasterSid?: number;
    }[],
    companyMasterSid: number,
    userName: string,
  ) {
    try {
      const results: any[] = [];

      for (const cfg of configs) {
        if (cfg.MenuUserConfigSid) {
          const updated = await (this._db as any).menuUserConfig.update({
            where: { MenuUserConfigSid: cfg.MenuUserConfigSid },
            data: {
              AssignedRole: cfg.assignedRole,
              UserMasterSid: cfg.UserMasterSid || null,
              UpdatedBy: userName,
              UpdatedOn: new Date(),
            },
          });
          results.push(updated);
        } else {
          const existing = await (this._db as any).menuUserConfig.findFirst({
            where: {
              CompanyMasterSid: companyMasterSid,
              BranchMasterSid: cfg.BranchMasterSid,
              Stage: cfg.stage,
              Status: 'A',
            },
          });

          if (existing) {
            const updated = await (this._db as any).menuUserConfig.update({
              where: { MenuUserConfigSid: existing.MenuUserConfigSid },
              data: {
                AssignedRole: cfg.assignedRole,
                UserMasterSid: cfg.UserMasterSid || null,
                UpdatedBy: userName,
                UpdatedOn: new Date(),
              },
            });
            results.push(updated);
          } else {
            const created = await (this._db as any).menuUserConfig.create({
              data: {
                CompanyMasterSid: companyMasterSid,
                BranchMasterSid: cfg.BranchMasterSid,
                Stage: cfg.stage,
                AssignedRole: cfg.assignedRole,
                UserMasterSid: cfg.UserMasterSid || null,
                CreatedBy: userName,
                Status: 'A',
              },
            });
            results.push(created);
          }
        }
      }

      return { success: true, count: results.length };
    } catch (error: any) {
      this.logger.error(`Error saving menu user config: ${error.message}`);
      throw error;
    }
  }
}
