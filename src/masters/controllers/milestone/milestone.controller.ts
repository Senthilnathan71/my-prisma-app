import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException ,Query} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';
import { MilestoneService } from 'src/masters/services/milestone/milestone.service';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}
@Controller('milestone')
export class MilestoneController {
    constructor(private milestoneService: MilestoneService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Milestone' })
    @ApiCreatedResponse({
        description: 'Create new Milestone',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewMilestone(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.milestoneService.createNewMilestone(newData);
            this.logger.log(`New Milestone Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Milestone is successfully created"
        } catch (error) {
            this.logger.warn(`Milestone Creation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Milestones' })
    @ApiCreatedResponse({
        description: 'Get All Milestones',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllMilestones(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.milestoneService.getAllMilestones(body.CompanyMasterSid, body.BranchMasterSid);
            this.logger.log(`All Milestones Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Milestones are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Milestones Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Milestone by Id' })
    @ApiCreatedResponse({
        description: 'Get Milestone by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:MilestoneMasterSid')
    async getMilestoneById(@Param('MilestoneMasterSid', ParseIntPipe) MilestoneMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Milestone with id : ${MilestoneMasterSid}`);
            let res = await this.milestoneService.fetchMilestoneById(MilestoneMasterSid);
            this.logger.debug(`Fetched Milestone : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Milestone with id : ${MilestoneMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Milestone by Id Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Milestone by Id' })
    @ApiCreatedResponse({
        description: 'Update Milestone by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:MilestoneMasterSid')
    async updateMilestoneById(@Param('MilestoneMasterSid', ParseIntPipe) MilestoneMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Milestone with id : ${MilestoneMasterSid}`);
            let res = await this.milestoneService.updateMilestoneById(MilestoneMasterSid, payload);
            this.logger.debug(`Updated Milestone : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Milestone with id : ${MilestoneMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Milestone Updation Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Milestone by Id' })
    @ApiCreatedResponse({
        description: 'Delete Milestone by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:MilestoneMasterSid')
    async deleteMilestoneById(@Param('MilestoneMasterSid', ParseIntPipe) MilestoneMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Milestone with id : ${MilestoneMasterSid}`);
            let res = await this.milestoneService.deleteMilestone(MilestoneMasterSid);
            this.logger.debug(`Deleted Milestone : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Milestone with id : ${MilestoneMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Milestone Deletion Error : ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Milestones' })
@ApiCreatedResponse({
    description: 'Search List of Milestones',
    type: ResponseData,
})
@HttpCode(HttpStatus.OK)
@Post('search-list')
async searchMilestoneNew(@Body() searchParams: SearchVesselDto) {
    const resp = new ResponseData();
    try {
        const res = await this.milestoneService.searchMilestone(searchParams);
        this.logger.log(`Milestone Search Data: ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = 'Milestone Search is successfully fetched';
    } catch (error) {
        this.logger.warn(`Search Milestone Error: ${error}`);
        resp.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException){
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
          
                const logs = await this.milestoneService.getAuditLogs(tableName, recordId);
          
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