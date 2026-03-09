import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { TermsAndConditionsService } from 'src/masters/services/terms-and-conditions/terms-and-conditions.service';



@Controller('terms-and-conditions')
export class TermsAndConditionsController {
    constructor(private termsAndConditionsServ: TermsAndConditionsService, private logger: Logger) { }


    @ApiOperation({ summary: 'Create new Terms and Conditions' })
    @ApiCreatedResponse({
        description: 'Create new Terms and Conditions',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewTermsAndConditions(@Body() newData:any) {
        let resp = new ResponseData();
        try {
            let res = await this.termsAndConditionsServ.createNewTermCond(newData);
            this.logger.log(`New Terms and Conditions Created : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "New Terms and Conditions is successfully created"
        } catch (error) {
            this.logger.warn(`Terms and Conditions Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get All Terms and Conditions' })
    @ApiCreatedResponse({
        description: 'Get All Terms and Conditions',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllTermsAndConditions() {
        let resp = new ResponseData();
        try {
            let res = await this.termsAndConditionsServ.getAllTermCond();
            this.logger.log(`All Terms and Conditions Fetched : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "All Terms and Conditions are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Terms and Conditions Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Get Terms and Conditions by Id' })
    @ApiCreatedResponse({
        description: 'Get Terms and Conditions by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:TermsAndConditionsMasterSid')
    async getTermsAndConditionsById(@Param('TermsAndConditionsMasterSid', ParseIntPipe) TermsAndConditionsMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Terms and Conditions with id : ${TermsAndConditionsMasterSid}`);
            let res = await this.termsAndConditionsServ.fetchTermCondById(TermsAndConditionsMasterSid);
            this.logger.debug(`Fetched Terms and Conditions : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Terms and Conditions with id : ${TermsAndConditionsMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Terms and Conditions by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Update Terms and Conditions by Id' })
    @ApiCreatedResponse({
        description: 'Update Terms and Conditions by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:TermsAndConditionsMasterSid')
    async updateTermsAndConditionsById(@Param('TermsAndConditionsMasterSid', ParseIntPipe) TermsAndConditionsMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Updating Terms and Conditions with id : ${TermsAndConditionsMasterSid}`);
            let res = await this.termsAndConditionsServ.updateTermCondById(TermsAndConditionsMasterSid, payload);
            this.logger.debug(`Updated Terms and Conditions : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Terms and Conditions with id : ${TermsAndConditionsMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Terms and Conditions Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Delete Terms and Conditions by Id' })
    @ApiCreatedResponse({
        description: 'Delete Terms and Conditions by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:TermsAndConditionsMasterSid')
    async deleteTermsAndConditionsById(@Param('TermsAndConditionsMasterSid', ParseIntPipe) TermsAndConditionsMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Deleting Terms and Conditions with id : ${TermsAndConditionsMasterSid}`);
            let res = await this.termsAndConditionsServ.deleteTermCond(TermsAndConditionsMasterSid);
            this.logger.debug(`Deleted Terms and Conditions : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Terms and Conditions with id : ${TermsAndConditionsMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Terms and Conditions Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }



    @ApiOperation({ summary: 'Search List of Terms and Conditions' })
    @ApiCreatedResponse({
        description: 'Search List of Terms and Conditions',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchTermsAndConditions(@Body() searchData: SearchListDto) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Search Terms and Conditions : ${JSON.stringify(searchData)}`)
            let res = await this.termsAndConditionsServ.searchTermCond(searchData);
            this.logger.debug(`Terms and Conditions Search Results :${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Terms and Conditions Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Terms and Conditions Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Create new Terms and Conditions Transaction' })
  @ApiCreatedResponse({
    description: 'Create new Terms and Conditions Transaction',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('transaction')
  async createNewTandCTransaction(@Body() newData: any) {
    let resp = new ResponseData();
    try {
      let res = await this.termsAndConditionsServ.createTandCTransaction(newData);
      this.logger.log(`New Terms and Conditions Transaction Created : ${JSON.stringify(res)}`);
      resp.data = res;
      resp.message = 'New Terms and Conditions Transaction is successfully created';
    } catch (error) {
      this.logger.warn(`Terms and Conditions Transaction Creation Error : ${JSON.stringify(error)}`, error.stack);
      resp.status = false;
      if (error instanceof BadRequestException) {
        resp.message = error.message;
      } else {
        resp.message = 'Internal Server Error';
      }
    }
    return resp;
  }

    @ApiOperation({ summary: 'Get Terms and Conditions by Different Conditions' })
    @ApiCreatedResponse({
        description: 'Get Terms and Conditions by Different Conditions',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetchByCondition')
    async getTermsAndConditionsByCondition(@Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Terms and Conditions by conditions : ${JSON.stringify(payload)}`);
            let res = await this.termsAndConditionsServ.getTandCByCondition(payload);
            this.logger.debug(`Fetched Terms and Conditions : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Terms and Conditions with conditions is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Terms and Conditions by Condition Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Terms and Conditions by Different Conditions' })
    @ApiCreatedResponse({
        description: 'Get Terms and Conditions by Different Conditions',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetchByNCondition')
    async getTermsAndConditionsByNCondition(@Body() payload: any) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Getting Terms and Conditions by conditions : ${JSON.stringify(payload)}`);
            let res = await this.termsAndConditionsServ.getTandCByNCondition(payload);
            this.logger.debug(`Fetched Terms and Conditions : ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Terms and Conditions with conditions is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Terms and Conditions by Condition Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Menus' })
        @ApiCreatedResponse({
            description: 'Get All Menus',
            type: ResponseData
        })
        @HttpCode(HttpStatus.OK)
        @Get('menu')
        async getAllMenus() {
            let output = new ResponseData;
            try {
                let menuData = await this.termsAndConditionsServ.getAllMenus();
                this.logger.log(`getAllmenus: ${JSON.stringify(menuData)}`)
                output.data = menuData;
                output.message = "All Menu are successfully fetched";
            } catch (error) {
                this.logger.warn(`getAllmenus: ${JSON.stringify(error)}`)
                output.status = false;
                if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                    output.message = error.message;
                } else {
                    output.message = 'Internal Server Error';
                }
            }
            return output
        }

}