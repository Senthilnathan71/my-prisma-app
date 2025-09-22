import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { CustomerSalesteamService } from 'src/masters/services/customer-salesteam/customer-salesteam.service';
class CompanyIdDto {
  CompanyMasterSid: number;
  BranchMasterSid: number;
}

@Controller('customer-salesteam')
export class CustomerSalesteamController {
    constructor(private CusSalesTeamService: CustomerSalesteamService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Salesperson' })
    @ApiCreatedResponse({
        description: 'Create new Salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewSalesperson(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.CusSalesTeamService.createNewSalesteam(newData);
            this.logger.log(`New Salesperson Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Salesperson is successfully created"
        } catch (error) {
            this.logger.warn(`Salesperson Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Salesteam of Customer' })
    @ApiCreatedResponse({
        description: 'Get All Salesteam of Customer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('customer/:CustomerMasterSid')
    async getAllSalesteamOfCustomer(@Param('CustomerMasterSid', ParseIntPipe) CustomerMasterSid: number) {
        let resp = new ResponseData();
        try {
            let res = await this.CusSalesTeamService.getAllSalesteamOfCustomer(CustomerMasterSid);
            this.logger.log(`All Salesteam of Customer Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Salesteam of Customer are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Salesteam of Customer Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Save All Salesteam' })
    @ApiCreatedResponse({
        description: 'Save All Salesteam',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('save')
    async saveAllSalesteam(@Body() customerSalesteam: any[]) {
        let resp = new ResponseData();
        try {
            let res = await this.CusSalesTeamService.saveCustomerSalesteam(customerSalesteam);
            this.logger.log(`All Salesteam Saved : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Salesteam are successfully saved";
        } catch (error) {
            this.logger.warn(`Save All Salesteam Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }


    @ApiOperation({ summary: 'Get All Salesperson' })
    @ApiCreatedResponse({
        description: 'Get All Salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllSalesperson() {
        let resp = new ResponseData();
        try {
            let res = await this.CusSalesTeamService.getAllSalesteam();
            this.logger.log(`All Salesperson Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Salesperson are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Salesperson Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Salesperson by Id' })
    @ApiCreatedResponse({
        description: 'Get Salesperson by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CustomerSalesSid')
    async getSalespersonById(@Param('CustomerSalesSid', ParseIntPipe) CustomerSalesSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Salesperson with id : ${CustomerSalesSid}`);
            let res = await this.CusSalesTeamService.fetchSalesteamById(CustomerSalesSid);
            this.logger.debug(`Fetched Salesperson : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Salesperson with id : ${CustomerSalesSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Salesperson by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }




    @ApiOperation({ summary: 'Update Salesperson by Id' })
    @ApiCreatedResponse({
        description: 'Update Salesperson by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:CustomerSalesSid')
    async updateSalespersonById(@Param('CustomerSalesSid', ParseIntPipe) CustomerSalesSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Salesperson with id : ${CustomerSalesSid}`);
            let res = await this.CusSalesTeamService.updateSalesteamById(CustomerSalesSid, payload);
            this.logger.debug(`Updated Salesperson : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Salesperson with id : ${CustomerSalesSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Salesperson Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Salesperson by Id' })
    @ApiCreatedResponse({
        description: 'Delete Salesperson by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CustomerSalesSid')
    async deleteSalespersonById(@Param('CustomerSalesSid', ParseIntPipe) CustomerSalesSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Salesperson with id : ${CustomerSalesSid}`);
            let res = await this.CusSalesTeamService.deleteSalesteam(CustomerSalesSid);
            this.logger.debug(`Deleted Salesperson : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `
            Salesperson with id : ${CustomerSalesSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Salesperson Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Salesperson' })
    @ApiCreatedResponse({
        description: 'Search List of Salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchSalesperson(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            let res = await this.CusSalesTeamService.searchSalesteam(searchData);
            this.logger.log(`Salesperson Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Salesperson Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Salesperson Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get salesperson' })
    @ApiCreatedResponse({
        description: 'Get salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('salesperson')
    async getSalesPerson(@UserData() user: any): Promise<any> {
        const output = new ResponseData();
        try {
            const salesPerson = await this.CusSalesTeamService.getSalesPerson();
            this.logger.debug(`getSalesPerson: ${JSON.stringify(salesPerson)}`)
            output.data = salesPerson
        } catch (error) {
            this.logger.debug(`getSalesPerson: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = typeof error == 'string' ? error : ''
        }
        return output
    }

}

