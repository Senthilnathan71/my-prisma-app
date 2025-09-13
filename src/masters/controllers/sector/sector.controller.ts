import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UnauthorizedException,
  Query
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { SectorService } from 'src/masters/services/sector/sector.service';

@Controller('sector')
@Auth()
export class SectorController {
  constructor(
    private sectorService: SectorService,
    private logger: Logger,
  ) { }

  @ApiOperation({ summary: 'Sector Creation' })
  @ApiCreatedResponse({
    description: 'Sector Creation',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createSector(
    @Body() body: any,
    @UserData() user: any,
  ) {
    this.logger.log(`createSectorData: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let sector = await this.sectorService.createSector(body, user);
      this.logger.debug(`createSector: ${JSON.stringify(sector)}`);
      if (!sector) {
        this.logger.warn(`createSector!!: ${JSON.stringify(sector)}`);
        throw 'Something went wrong';
      }
      output.data = sector;
      output.message = "New Sector is successfully created"
    } catch (error) {
      this.logger.warn(`createSectorError: ${error}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
        this.logger.warn(`createSectorError: ${error.message}`);
      } else {
        this.logger.warn(`createSectorError: ${error}`);
        output.message = error;
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get All Sectors' })
  @ApiCreatedResponse({
    description: 'Get All Sectors',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get()
  async getAllSector() {
    let output = new ResponseData();
    try {
      let sectorData = await this.sectorService.getAllSector();
      this.logger.log(`getAllSector: ${JSON.stringify(sectorData)}`);
      output.data = sectorData;
      output.message = "All Sector are successfully fetched";
    } catch (error) {
      this.logger.log(`getAllSector: ${JSON.stringify(error)}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Sector By Id' })
  @ApiCreatedResponse({
    description: 'Get Sector By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get('fetch/:id')
  async getSectorById(@Param('id', ParseIntPipe) SectorId: number) {
    const output = new ResponseData();
    try {
      const Sector = await this.sectorService.findOne(SectorId);
      this.logger.log(`getSectorById: ${JSON.stringify(Sector)}`);
      output.data = Sector;
      output.message = `Sector with id : ${SectorId} is successfully fetched`;
    } catch (error) {
      this.logger.warn(`getSectorById: ${JSON.stringify(error)}`);
      output.status = false;
      output.message = error;
    }
    return output;
  }

  @ApiOperation({ summary: 'Update Sector By Id' })
  @ApiCreatedResponse({
    description: 'Update Sector By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update/:id')
  async editSector(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,

  ) {
    this.logger.log(`editSectorBody: ${JSON.stringify(body)}`);
    let output = new ResponseData();
    try {
      let Sector = await this.sectorService.updateSector(id, body);
      this.logger.log(`editSector: ${JSON.stringify(Sector)}`);

      if (!Sector) {
        this.logger.log(`editSector!!: ${JSON.stringify(Sector)}`);
        throw 'Something went wrong';
      } else {
        this.logger.log(`editSectorelse: ${Sector}`);
      }
      output.data = Sector;
      output.message = `Sector with id : ${id} is successfully updated`;
    } catch (error) {
      this.logger.warn(`editSectorerror: ${(JSON.stringify(error), error)}`);
      output.status = false;
      // Handle error message based on the type of error
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        this.logger.warn(`editSectorbadrequest: ${error}`);
        output.message = error.message;
      } else {
        output.message = error;
      }
    }
    this.logger.warn(`editSectormessage: ${output.message}`);
    return output;
  }

  @ApiOperation({ summary: 'Delete Sector By Id' })
  @ApiCreatedResponse({
    description: 'Delete Sector By Id',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete/:id')
  async softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.sectorService.softDelete(id);
  }

  @ApiOperation({ summary: 'Search List of Sector' })
  @ApiCreatedResponse({
    description: 'Search List of Sector',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('search-list')
  async searchSectorNew(@Body() searchParams: filterDto) {
    const resp = new ResponseData();
    try {
      const res = await this.sectorService.searchSectorNew(searchParams);
      this.logger.log(`SectorSearch Data : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'Sector Search is successfully fetched';
    } catch (error) {
      this.logger.warn(`Sector Search Error : ${error}`);
      resp.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

  @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
  @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
  @HttpCode(HttpStatus.OK)
  @Get('audit-logs')
  async getAuditLogs(
    @Query('tableName') tableName: string,
    @Query('recordId') recordId?: string,
  ) {
    const resp = new ResponseData();
    try {
      if (!tableName) throw new Error('tableName query parameter is required');

      const logs = await this.sectorService.getAuditLogs(tableName, recordId);

      // Remove updatedOn from oldVal and newVal
      resp.data = logs.map((log: any) => {
        const oldVal = log.oldVal ? { ...log.oldVal } : null;
        const newVal = log.newVal ? { ...log.newVal } : null;
        if (oldVal && 'updatedOn' in oldVal) delete oldVal.updatedOn;
        if (newVal && 'updatedOn' in newVal) delete newVal.updatedOn;
        return { ...log, oldVal, newVal };
      });

      resp.message = 'Audit logs fetched successfully';
    } catch (error) {
      this.logger.warn(`getAuditLogsError: ${error}`);
      resp.status = false;
      resp.message = error.message || 'Internal Server Error';
    }
    return resp;
  }
}
