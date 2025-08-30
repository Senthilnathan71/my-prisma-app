import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException,Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation } from "@nestjs/swagger";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { SearchListDto } from "src/masters/DTO/search-list.dto";
import { SearchVesselDto } from "src/masters/DTO/search-vessel.dto";
import { UomService } from "src/masters/services/uom/uom-master.service";

@Controller('uom')

export class UomMasterController {
    constructor(private UomService: UomService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get All Uom' })
    @ApiCreatedResponse({
        description: 'Get All Uom',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllUom() {
        const output = new ResponseData
        try {
            const uom = await this.UomService.getAllUom()
            this.logger.log(`getAllUom: ${JSON.stringify(uom)}`)
            output.data = uom;
            output.message = "All UOM are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllUom: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Uom Creation' })
    @ApiCreatedResponse({
        description: 'Uom Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post()
    async createUom(@Body() body: any) { 
        this.logger.log(`createUom: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Uom = await this.UomService.createUom(body);
            this.logger.debug(`createUom: ${JSON.stringify(Uom)}`)
            if (!Uom) {
                this.logger.warn(`createUom: ${JSON.stringify(Uom)}`)
                throw 'Something went wrong'
            }
            output.data = Uom;
            output.message = "New UOM is successfully created"
        } catch (error) {
            this.logger.warn(`createUom: ${JSON.stringify(error)}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            }  else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }



    @ApiOperation({ summary: 'Get Uom By Id' })
    @ApiCreatedResponse({
        description: 'Get Uom By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get(':id')
    async getUomById(@Param('id', ParseIntPipe) uomId: number) {
        const output = new ResponseData;
        try {
            const Uom = await this.UomService.findOne(uomId)
            this.logger.log(`getUomById: ${JSON.stringify(Uom)}`)
            output.data = Uom;
            output.message = `UOM with id : ${uomId} is successfully fetched`;

        } catch (error) {
            this.logger.warn(`getUomById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }



    @ApiOperation({ summary: 'Update Uom By Id' })
    @ApiCreatedResponse({
        description: 'Update Uom By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch(':id')
    async editUom(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        this.logger.log(`editUom: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Uom = await this.UomService.updateUom(id, body);
            this.logger.log(`editUom: ${JSON.stringify(Uom)}`)

            if (!Uom) {
                this.logger.log(`editUom: ${JSON.stringify(Uom)}`)
                throw 'Something went wrong'
            }
            output.data = Uom;
            output.message = `UOM with id : ${id} is successfully updated`;

        } catch (error) {
            this.logger.warn(`editUom: ${JSON.stringify(error)}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            }  else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Delete Uom By Id' })
    @ApiCreatedResponse({
        description: 'Delete Uom By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK) @Delete(':id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.UomService.softDelete(id);
    }


    @ApiOperation({summary : 'Search List of UOM'})
    @ApiCreatedResponse({
        description:'Search List of UOM',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchUOMNew(@Body() searchParams:SearchVesselDto) {
        const resp=new ResponseData();
        try {
            const res=await this.UomService.searchUomNew(searchParams);
            this.logger.log(`UOM Search Results : ${JSON.stringify(res)}`);
            resp.data=res;
            resp.message="UOM search is successfully fetched";
        } catch (error) {
            this.logger.warn(`UOM Search Error : ${error}`);
            resp.status=false;
            if(error instanceof BadRequestException || error instanceof UnauthorizedException){
                resp.message=error.message;
            } else {
                resp.message = "Internal Server Error"
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
      
            const logs = await this.UomService.getAuditLogs(tableName, recordId);
      
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