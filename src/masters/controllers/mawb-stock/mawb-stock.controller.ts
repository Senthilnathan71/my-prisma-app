import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { MawbStockService } from 'src/masters/services/mawb-stock/mawb-stock.service';
class CompanyIdDto {
    CompanyMasterSid: number;
    BranchMasterSid: number;
}


@Controller('mawb-stock')
export class MawbStockController {
    constructor(private mawbStockService: MawbStockService, private logger: Logger) { }
    
        @ApiOperation({ summary: 'Create new MAWB Stock' })
        @ApiCreatedResponse({
            description: 'Create new MAWB Stock',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Post('create')
        async createNewMawbStock(@Body() newData: any) {
            let resp = new ResponseData();
            try {
                let res = await this.mawbStockService.createNewMawbStock(newData);
                this.logger.log(`New MAWB Stock Created : ${JSON.stringify(res)}`);
                resp.data = res;
                resp.message = "New MAWB Stock is successfully created"
            } catch (error) {
                this.logger.warn(`MAWB Stock Creation Error : ${JSON.stringify(error), error}`);
                resp.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    resp.message = error.message;
                } else {
                    resp.message = "Internal Server Error";
                }
            }
            return resp;
        }
    
        @ApiOperation({ summary: 'Get All MAWB Stocks' })
        @ApiCreatedResponse({
            description: 'Get All MAWB Stocks',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Post()
        async getAllMawbStocks(@Body() body: CompanyIdDto) {
            let resp = new ResponseData();
            try {
                let res = await this.mawbStockService.getAllMawbStocks(body.CompanyMasterSid, body.BranchMasterSid);
                this.logger.log(`All MAWB Stocks Fetched : ${JSON.stringify(res)}`);
                resp.data = res;
                resp.message = "All MAWB Stocks are successfully fetched";
            } catch (error) {
                this.logger.warn(`Get All MAWB Stocks Error : ${JSON.stringify(error), error}`);
                resp.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    resp.message = error.message;
                } else {
                    resp.message = "Internal Server Error";
                }
            }
            return resp;
        }
    
        @ApiOperation({ summary: 'Get MAWB Stock by Id' })
        @ApiCreatedResponse({
            description: 'Get MAWB Stock by Id',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Get('fetch/:MawbStockSid')
        async getMawbStockById(@Param('MawbStockSid', ParseIntPipe) MawbStockSid: number) {
            let resp = new ResponseData();
            try {
                this.logger.log(`Getting MAWB Stock with id : ${MawbStockSid}`);
                let res = await this.mawbStockService.fetchMawbStockById(MawbStockSid);
                this.logger.debug(`Fetched MAWB Stock : ${JSON.stringify(res)}`);
                resp.data = res;
                resp.message = `MAWB Stock with id : ${MawbStockSid} is successfully fetched`;
            } catch (error) {
                this.logger.warn(`Get MAWB Stock by Id Error : ${JSON.stringify(error), error}`);
                resp.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    resp.message = error.message;
                } else {
                    resp.message = "Internal Server Error";
                }
            }
            return resp;
        }
    
        @ApiOperation({ summary: 'Update MAWB Stock by Id' })
        @ApiCreatedResponse({
            description: 'Update MAWB Stock by Id',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Patch('update/:MawbStockSid')
        async updateMawbStockById(@Param('MawbStockSid', ParseIntPipe) MawbStockSid: number, @Body() payload: any) {
            let resp = new ResponseData();
            try {
                this.logger.log(`Updating MAWB Stock with id : ${MawbStockSid}`);
                let res = await this.mawbStockService.updateMawbStockById(MawbStockSid, payload);
                this.logger.debug(`Updated MAWB Stock : ${JSON.stringify(res)}`);
                resp.data = res;
                resp.message = `MAWB Stock with id : ${MawbStockSid} is successfully updated`;
            } catch (error) {
                this.logger.warn(`MAWB Stock Update Error : ${JSON.stringify(error), error}`);
                resp.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    resp.message = error.message;
                } else {
                    resp.message = "Internal Server Error";
                }
            }
            return resp;
        }
    
        @ApiOperation({ summary: 'Delete MAWB Stock by Id' })
        @ApiCreatedResponse({
            description: 'Delete MAWB Stock by Id',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Delete('delete/:MawbStockSid')
        async deleteMawbStockById(@Param('MawbStockSid', ParseIntPipe) MawbStockSid: number) {
            let resp = new ResponseData();
            try {
                this.logger.log(`Deleting MAWB Stock with id : ${MawbStockSid}`);
                let res = await this.mawbStockService.deleteMawbStock(MawbStockSid);
                this.logger.debug(`Deleted MAWB Stock : ${JSON.stringify(res)}`);
                resp.data = res;
                resp.message = `MAWB Stock with id : ${MawbStockSid} is successfully deleted`;
            } catch (error) {
                this.logger.warn(`MAWB Stock Deletion Error : ${JSON.stringify(error), error}`);
                resp.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    resp.message = error.message;
                } else {
                    resp.message = "Internal Server Error";
                }
            }
            return resp;
        }
    
        @ApiOperation({ summary: 'Search List of MAWB Stocks' })
        @ApiCreatedResponse({
            description: 'Search List of MAWB Stocks',
            type: ResponseData,
        })
        @HttpCode(HttpStatus.OK)
        @Post('search-list')
        async searchMawbStockNew(@Body() searchParams: filterDto) {
            const resp = new ResponseData();
            try {
                const res = await this.mawbStockService.searchMawbStock(searchParams);
                this.logger.log(`MAWB Stock Search Data: ${JSON.stringify(res)}`);
                resp.data = res;
                resp.message = 'MAWB Stock Search is successfully fetched';
            } catch (error) {
                this.logger.warn(`Search MAWB Stock Error: ${error}`);
                resp.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
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
    
                const logs = await this.mawbStockService.getAuditLogs(tableName, recordId);
    
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

    @ApiOperation({ summary: 'Allocate MAWB stock to customer' })
    @ApiCreatedResponse({
        description: 'MAWB stock allocated to customer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('allocate')
    async allocateStock(@Body() body: {
        stockIds: number[],
        customerId: number,
        companyId: number,
        branchId: number
    }) {

        const resp = new ResponseData();

        try {

            const result = await this.mawbStockService.allocateStock(body);

            resp.data = result;
            resp.message = 'Stock allocated successfully';

        } catch (error) {
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }

        return resp;
    }


    @ApiOperation({ summary: 'Deallocate MAWB stock from customer' })
    @ApiCreatedResponse({
        description: 'MAWB stock deallocated from customer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('deallocate')
    async deallocateStock(@Body() body: {
        stockIds: number[],
        customerId: number,
        companyId: number,
        branchId: number
    }) {

        const resp = new ResponseData();

        try {

            const result = await this.mawbStockService.deallocateStock(body);

            resp.data = result;
            resp.message = 'Stock deallocated successfully';

        } catch (error) {
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }

        return resp;
    }


    @ApiOperation({ summary: 'Get Airline Free Stock' })
    @ApiCreatedResponse({
        description: 'Airline Free Stock',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('free-stock')
    @HttpCode(HttpStatus.OK)
    async getFreeStock(@Body() body: {
        airlineId: number,
        companyId: number,
        branchId: number
    }) {

        const resp = new ResponseData();

        try {

            const result = await this.mawbStockService.getFreeStock(body);

            resp.data = result;
            resp.message = 'Free stock fetched successfully';

        } catch (error) {
            resp.status = false;
            resp.message = error.message || 'Internal Server Error';
        }

        return resp;
    }

    @ApiOperation({ summary: 'Allocated Stock' })
    @ApiCreatedResponse({
        description: 'Allocated Stock',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('allocated-stock')
@HttpCode(HttpStatus.OK)
async getAllocatedStock(@Body() body: {
  customerId: number,
  companyId: number,
  branchId: number
}) {

  const resp = new ResponseData();

  try {

    const result = await this.mawbStockService.getAllocatedStock(body);

    resp.data = result;
    resp.message = 'Allocated stock fetched successfully';

  } catch (error) {
    resp.status = false;
    resp.message = error.message || 'Internal Server Error';
  }

  return resp;
}

@ApiOperation({ summary: 'Deallocate MAWB stock from customer with status changes' })
@ApiCreatedResponse({
    description: 'MAWB stock deallocated from customer with status updates',
    type: ResponseData
})
@HttpCode(HttpStatus.OK)
@Post('deallocate-with-status')
async deallocateStockWithStatus(@Body() body: {
    stockIds: number[],
    customerId: number,
    companyId: number,
    branchId: number,
    stockStatus: string
}) {
    const resp = new ResponseData();

    try {
        const result = await this.mawbStockService.deallocateStockWithStatus(body);
        resp.data = result;
        resp.message = 'Stock deallocated successfully with status updates';
    } catch (error) {
        resp.status = false;
        resp.message = error.message || 'Internal Server Error';
    }

    return resp;
}

}
