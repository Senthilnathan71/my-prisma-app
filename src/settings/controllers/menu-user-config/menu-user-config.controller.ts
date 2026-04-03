import {
  Controller,
  Get,
  Post,
  Body,
  Query,
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
   * GET /menu-user-config?branchId=X&companyId=Y
   */
  @Get()
  async getMenuUserConfig(
    @UserData() user: any,
    @Query('branchId') branchId?: string,
    @Query('companyId') companyId?: string,
  ) {
    try {
      const companyMasterSid = companyId ? Number(companyId) : 7;
      const branchMasterSid = branchId ? Number(branchId) : undefined;

      const data = await this.menuUserConfigService.getMenuUserConfig(
        companyMasterSid,
        branchMasterSid,
      );
      return { status: true, data };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Save menu-wise user configuration
   * POST /menu-user-config
   */
  @Post()
  async saveMenuUserConfig(
    @Body() body: { configs: any[] },
    @UserData() user: any,
    @Query('companyId') companyId?: string,
  ) {
    try {
      if (!body.configs || !Array.isArray(body.configs)) {
        return { status: false, message: 'configs array is required' };
      }

      const companyMasterSid = companyId ? Number(companyId) : 7;
      const userName = user?.userName || user?.email || 'system';

      const data = await this.menuUserConfigService.saveMenuUserConfig(
        body.configs,
        companyMasterSid,
        userName,
      );
      return { status: true, data, message: 'Configuration saved successfully' };
    } catch (error) {
      return { status: false, message: error.message };
    }
  }
}
