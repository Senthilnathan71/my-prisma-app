import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/decorators/jwt-auth.guard';
import { UserData } from 'src/common/decorators/user.decorator';
import { MenuUserConfigService } from '../../services/menu-user-config/menu-user-config.service';

@Controller('menu-user-config')
@UseGuards(JwtAuthGuard)
export class MenuUserConfigController {
  constructor(
    private readonly menuUserConfigService: MenuUserConfigService,
  ) {}

  /**
   * Get menu-wise user configuration
   * POST /menu-user-config/get
   */
  @Post('get')
  async getMenuUserConfig(
    @Body() body: { companyId: number; branchId?: number },
    @UserData() user: any,
  ) {
    try {
      if (!body.companyId) {
        return { status: false, message: 'companyId is required' };
      }

      const data = await this.menuUserConfigService.getMenuUserConfig(
        body.companyId,
        body.branchId,
      );
      return { status: true, data };
    } catch (error: any) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Save menu-wise user configuration
   * POST /menu-user-config
   */
  @Post()
  async saveMenuUserConfig(
    @Body() body: { configs: any[]; CompanyMasterSid?: number },
    @UserData() user: any,
  ) {
    try {
      if (!body.configs || !Array.isArray(body.configs)) {
        return { status: false, message: 'configs array is required' };
      }

      if (!body.CompanyMasterSid) {
        return { status: false, message: 'CompanyMasterSid is required' };
      }
      const companyMasterSid = body.CompanyMasterSid;
      const userName = user?.userName || user?.email || 'system';

      const data = await this.menuUserConfigService.saveMenuUserConfig(
        body.configs,
        companyMasterSid,
        userName,
      );
      return { status: true, data, message: 'Configuration saved successfully' };
    } catch (error: any) {
      return { status: false, message: error.message };
    }
  }
}
