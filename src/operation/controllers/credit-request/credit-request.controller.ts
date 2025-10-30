import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, ParseIntPipe, Patch, Post, Res, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreditRequestService } from 'src/operation/services/credit-request/credit-request.service';

@Controller('credit-request')
export class CreditRequestController {
    constructor(private creditRequestService: CreditRequestService, private logger: Logger) { }

    @ApiOperation({ summary: 'Get Salesperson'})
    @ApiCreatedResponse({
        description: 'Get Salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch/salesperson')
    async getSalesperson(@Body() body: any) {
        const output = new ResponseData;
        try {
            const salesman = await this.creditRequestService.getSalesperson(body);
            output.data = salesman;
            this.logger.log(`getSalesperson: ${JSON.stringify(salesman)}`)
        } catch (error) {
            this.logger.warn(`getSalesperson: ${JSON.stringify(error),error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Search Credit Customer'})
    @ApiCreatedResponse({
        description: 'Search Credit Customer',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCreditCustomer(@Body() searchParams: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.creditRequestService.searchCreditCustomer(searchParams);
            this.logger.log(`Credit Customer Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = "Credit Customer Search is successfully fetched";
        } catch (error) {
            this.logger.warn(`Credit Customer Search Error: ${JSON.stringify(error),error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Department'})
    @ApiCreatedResponse({
        description: 'Get Deprtment',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch/department')
    async getDepartment(@Body() body: any) {
        const output = new ResponseData;
        try {
            const department = await this.creditRequestService.getDepartment(body);
            output.data = department;
            this.logger.log(`getDepartment: ${JSON.stringify(department)}`)
        } catch (error) {
            this.logger.warn(`getDepartment: ${JSON.stringify(error),error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Create Credit Request' })
    @ApiCreatedResponse({
        description: 'Create Credit Request',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCreditRequest(@Body() body: any, @UserData() user: any) {
        this.logger.log(`createCreditRequest: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let credit = await this.creditRequestService.createCreditRequest(body, user);
            this.logger.debug(`createCreditRequest: ${JSON.stringify(credit)}`)
            if (!credit) {
                this.logger.warn(`createCreditRequest!!: ${JSON.stringify(credit)}`)
                throw 'Something went wrong'
            }
            output.data = credit;
            output.message = "Credit Request Created Successfully"
        } catch (error) {
            this.logger.error(`createCreditRequestError: ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createCreditRequestError: ${error.message}`)
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Update credit request by id' })
@ApiCreatedResponse({
  description: 'Update credit request by id',
  type: ResponseData,
})
@HttpCode(HttpStatus.OK)
@Patch('update/:CustomerCreditRequestSid')
async updateCreditRequest(
  @Param('CustomerCreditRequestSid', ParseIntPipe) CustomerCreditRequestSid: number,
  @Body() body: any,
  @UserData() user: any,
) {
  const output = new ResponseData();
  this.logger.log(`updateCreditRequest -> ID: ${CustomerCreditRequestSid}, Payload: ${JSON.stringify(body)}`);

  try {
    const credit = await this.creditRequestService.updateCreditRequest(CustomerCreditRequestSid, body, user);

    if (!credit || !credit.status) {
      throw new BadRequestException('Something went wrong while updating the credit request');
    }

    output.status = true;
    output.data = credit.data;
    output.message = `Credit Request with ID ${CustomerCreditRequestSid} successfully updated`;

    this.logger.log(`updateCreditRequest Success -> ${JSON.stringify(credit.data)}`);
  } catch (error) {
    this.logger.error(`updateCreditRequestError -> ${error.message || error}`);

    output.status = false;

    if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
      output.message = error.message;
    } else if (error instanceof NotFoundException) {
      output.message = `Credit Request with ID ${CustomerCreditRequestSid} not found`;
    } else {
      output.message = error.message || 'Internal server error while updating credit request';
    }
  }

  return output;
}


    @ApiOperation({ summary: 'Delete credit request by id'})
    @ApiCreatedResponse({
        description: 'Delete credit request by id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:CustomerCreditRequestSid')
    async deleteCreditRequest(@Param('CustomerCreditRequestSid', ParseIntPipe) CustomerCreditRequestSid: number) {
        return this.creditRequestService.deleteCreditRequest(CustomerCreditRequestSid);
    }

    @ApiOperation({ summary: 'Get customer by id'})
    @ApiCreatedResponse({
        description: 'Get customer by id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:CustomerMasterSid')
    async getCustomerById(@Param('CustomerMasterSid', ParseIntPipe) CustomerMasterSid: number) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Get customer by id: ${CustomerMasterSid}`);
            let res = await this.creditRequestService.getCustomerById(CustomerMasterSid);
            this.logger.debug(`Get customer by id: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = `Get customerby id: ${CustomerMasterSid} is fetched`
        } catch (error) {
            this.logger.warn(`Get customer by id: ${JSON.stringify(error)}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }
}
