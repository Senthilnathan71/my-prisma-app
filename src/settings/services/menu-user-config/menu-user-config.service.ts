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

      const configs = await this._db.resourceConfiguration.findMany({
        where,
        include: {
          branchMaster: {
            select: { branchName: true, BranchMasterSid: true },
          },
          menuMaster: {
            select: { MenuMasterSid: true, MenuCode: true, MenuName: true },
          },
          userMaster: {
            select: { userName: true, UserMasterSid: true },
          },
        },
        orderBy: { ResourceConfigurationSid: 'asc' },
      });

      return configs.map((c: any) => ({
        ResourceConfigurationSid: c.ResourceConfigurationSid,
        BranchMasterSid: c.BranchMasterSid,
        branchName: c.branchMaster?.branchName || '',
        MenuMasterSid: c.MenuMasterSid || null,
        MenuCode: c.menuMaster?.MenuCode || c.Stage,
        MenuName: c.menuMaster?.MenuName || c.Stage,
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
      ResourceConfigurationSid?: number;
      BranchMasterSid: number;
      MenuMasterSid?: number;
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
        if (cfg.ResourceConfigurationSid) {
          const updated = await this._db.resourceConfiguration.update({
            where: { ResourceConfigurationSid: cfg.ResourceConfigurationSid },
            data: {
              AssignedRole: cfg.assignedRole,
              MenuMasterSid: cfg.MenuMasterSid || null,
              UserMasterSid: cfg.UserMasterSid || null,
              UpdatedBy: userName,
              UpdatedOn: new Date(),
            },
          });
          results.push(updated);
        } else {
          const existing = await this._db.resourceConfiguration.findFirst({
            where: {
              CompanyMasterSid: companyMasterSid,
              BranchMasterSid: cfg.BranchMasterSid,
              ...(cfg.MenuMasterSid
                ? { MenuMasterSid: cfg.MenuMasterSid }
                : { Stage: cfg.stage }),
              Status: 'A',
            },
          });

          if (existing) {
            const updated = await this._db.resourceConfiguration.update({
              where: { ResourceConfigurationSid: existing.ResourceConfigurationSid },
              data: {
                AssignedRole: cfg.assignedRole,
                MenuMasterSid: cfg.MenuMasterSid || existing.MenuMasterSid || null,
                UserMasterSid: cfg.UserMasterSid || null,
                UpdatedBy: userName,
                UpdatedOn: new Date(),
              },
            });
            results.push(updated);
          } else {
            const created = await this._db.resourceConfiguration.create({
              data: {
                CompanyMasterSid: companyMasterSid,
                BranchMasterSid: cfg.BranchMasterSid,
                Stage: cfg.stage,
                MenuMasterSid: cfg.MenuMasterSid || null,
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

      // Propagate the configured user into ResourcePerson on document records
      await this.propagateResourcePerson(configs, companyMasterSid);

      return { success: true, count: results.length };
    } catch (error: any) {
      console.log(error.stack);
      this.logger.error(`Error saving menu user config: ${error.message}`);
      throw error;
    }
  }

  /**
   * For each config that has both a MenuMasterSid and a UserMasterSid,
   * set ResourcePerson on document records (matching company + branch + menu)
   * ONLY where ResourcePerson is currently null. Records that already have a
   * ResourcePerson are left untouched.
   */
  private async propagateResourcePerson(
    configs: {
      BranchMasterSid: number;
      MenuMasterSid?: number;
      UserMasterSid?: number;
    }[],
    companyMasterSid: number,
  ) {
    for (const cfg of configs) {
      if (!cfg.MenuMasterSid || !cfg.UserMasterSid) {
        continue;
      }

      const userSid = cfg.UserMasterSid;
      const menuSid = cfg.MenuMasterSid;
      const branchSid = cfg.BranchMasterSid;

      // EnquiryOther -> via EnquiryHeader (header holds Company/Branch/Menu)
      await this._db.enquiryOther.updateMany({
        where: {
          CompanyMasterSid: companyMasterSid,
          BranchMasterSid: branchSid,
          ResourcePerson: null,
          EnquiryHeader: { MenuMasterSid: menuSid },
        },
        data: { ResourcePerson: userSid },
      });

      // QuoteHeader (has ResourcePerson directly)
      await this._db.quoteHeader.updateMany({
        where: {
          CompanyMasterSid: companyMasterSid,
          BranchMasterSid: branchSid,
          MenuMasterSid: menuSid,
          ResourcePerson: null,
        },
        data: { ResourcePerson: userSid },
      });

      // BookingOthers -> via BookingHeader
      await this._db.bookingOthers.updateMany({
        where: {
          ResourcePerson: null,
          bookingHeader: {
            CompanyMasterSid: companyMasterSid,
            BranchMasterSid: branchSid,
            MenuMasterSid: menuSid,
          },
        },
        data: { ResourcePerson: userSid },
      });

      // MasterJobOthers -> via MasterJob
      await this._db.masterJobOthers.updateMany({
        where: {
          ResourcePerson: null,
          masterJob: {
            CompanyMasterSid: companyMasterSid,
            BranchMasterSid: branchSid,
            MenuMasterSid: menuSid,
          },
        },
        data: { ResourcePerson: userSid },
      });

      // HouseJobOthers -> via HouseJob
      await this._db.houseJobOthers.updateMany({
        where: {
          ResourcePerson: null,
          HouseJob: {
            CompanyMasterSid: companyMasterSid,
            BranchMasterSid: branchSid,
            MenuMasterSid: menuSid,
          },
        },
        data: { ResourcePerson: userSid },
      });
    }
  }

  async getConfiguredUser(
  companyMasterSid: number,
  branchMasterSid: number,
  menuMasterSid: number,
): Promise<number | null> {
  const config = await this._db.resourceConfiguration.findFirst({
    where: {
      CompanyMasterSid: companyMasterSid,
      BranchMasterSid: branchMasterSid,
      MenuMasterSid: menuMasterSid,
      Status: 'A',
      UserMasterSid: { not: null },
    },
    select: { UserMasterSid: true },
  });
  return config?.UserMasterSid ?? null;
}
}