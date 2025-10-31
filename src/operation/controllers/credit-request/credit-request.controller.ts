import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, ParseIntPipe, Patch, Post, Res, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreditRequestService, CustomerCreditRequestInterface, CustomerCreditRequestWithKycInterface, CustomerKycInterface } from 'src/operation/services/credit-request/credit-request.service';

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

    @ApiOperation({
    summary: 'Update or create credit request with KYC documents in transaction',
  })
  @ApiCreatedResponse({
    description: 'Credit request with KYC updated successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Patch('update')
  async updateCustomerCreditReqWithKyc(
    @Body() payload: CustomerCreditRequestWithKycInterface[],
  ) {
    const output = new ResponseData();
    this.logger.debug(
      `updateCustomerCreditReqWithKyc: ${JSON.stringify(payload)}`,
    );
 
    try {
      const result =
        await this.creditRequestService.updateCustomerCreditReqWithKyc(
          payload,
        );
 
      if (!result) {
        throw new Error('Failed to update credit request with KYC');
      }
 
      output.data = result;
      output.message = 'Credit request with KYC updated successfully';
    } catch (error) {
      this.logger.warn(
        `updateCustomerCreditReqWithKyc: ${JSON.stringify(error)}, ${error}`,
      );
      output.status = false;
 
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message =
          error.message || 'Error updating credit request with KYC';
      }
    }
 
    return output;
  }

    @ApiOperation({
    summary: 'Create credit request with KYC documents',
  })
  @ApiCreatedResponse({
    description: 'Credit request with KYC created successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async createCustomerCreditReqWithKyc(
    @Body() payload: CustomerCreditRequestWithKycInterface[],
  ) {
    const output = new ResponseData();
    this.logger.debug(
      `createCustomerCreditReqWithKyc: ${JSON.stringify(payload)}`,
    );
 
    try {
      const result =
        await this.creditRequestService.createCustomerCreditReqWithKyc(
          payload,
        );
 
      if (!result) {
        throw new Error('Failed to create credit request with KYC');
      }
 
      output.data = result;
      output.message = 'Credit request with KYC created successfully';
    } catch (error) {
      this.logger.warn(
        `createCustomerCreditReqWithKyc: ${JSON.stringify(error)}, ${error}`,
      );
      output.status = false;
 
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message =
          error.message || 'Error creating credit request with KYC';
      }
    }
 
    return output;
  }

    @ApiOperation({ summary: 'Create a single customer KYC record' })
  @ApiCreatedResponse({
    description: 'Customer KYC created successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create-kyc')
  async createSingleCustomerKyc(@Body() payload: CustomerKycInterface) {
    const output = new ResponseData();
    this.logger.debug(`createSingleCustomerKyc: ${JSON.stringify(payload)}`);
 
    try {
      const kyc =
        await this.creditRequestService.createSingleCustomerKyc(payload);
 
      if (!kyc) {
        throw new Error('Failed to create customer KYC');
      }
 
      output.data = kyc;
      output.message = 'Customer KYC created successfully';
    } catch (error) {
      this.logger.warn(
        `createSingleCustomerKyc: ${JSON.stringify(error)}, ${error}`,
      );
      output.status = false;
 
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Error creating customer KYC';
      }
    }
 
    return output;
  }

    @ApiOperation({ summary: 'Create a single credit request without KYC' })
  @ApiCreatedResponse({
    description: 'Credit request created successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post('create-credit-request')
  async createSingleCustomerCreditReq(
    @Body() payload: CustomerCreditRequestInterface,
  ) {
    const output = new ResponseData();
    this.logger.debug(
      `createSingleCustomerCreditReq: ${JSON.stringify(payload)}`,
    );
 
    try {
      const creditRequest =
        await this.creditRequestService.createSingleCustomerCreditReq(payload);
 
      if (!creditRequest) {
        throw new Error('Failed to create credit request');
      }
 
      output.data = creditRequest;
      output.message = 'Credit request created successfully';
    } catch (error) {
      this.logger.warn(
        `createSingleCustomerCreditReq: ${JSON.stringify(error)}, ${error}`,
      );
      output.status = false;
 
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Error creating credit request';
      }
    }
 
    return output;
  }

    @ApiOperation({ summary: 'Get all credit requests for a customer' })
  @ApiCreatedResponse({
    description: 'Credit requests retrieved successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Get(':customerMasterSid')
  async getCreditRequestOfCustomer(
    @Param('customerMasterSid', ParseIntPipe) customerMasterSid: number,
  ) {
    const output = new ResponseData();
    this.logger.debug(
      `getCreditRequestOfCustomer: customerMasterSid=${customerMasterSid}`,
    );
 
    try {
      const creditRequests =
        await this.creditRequestService.getCreditRequestOfCustomer(
          customerMasterSid,
        );
 
      if (!creditRequests || creditRequests.length === 0) {
        output.message = `No credit requests found for customer ${customerMasterSid}`;
        output.data = [];
        return output;
      }
 
      output.data = creditRequests;
      output.message = `Credit requests retrieved successfully for customer ${customerMasterSid}`;
    } catch (error) {
      this.logger.warn(
        `getCreditRequestOfCustomer: ${JSON.stringify(error)}, ${error}`,
      );
      output.status = false;
 
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Error retrieving credit requests';
      }
    }
 
    return output;
  }

}
