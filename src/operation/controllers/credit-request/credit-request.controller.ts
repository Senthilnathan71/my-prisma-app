import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, Res, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import { CreditLimitDto, OutstandingDto, OutstandingByJobDto, ValidateCreditDto, CreditSummaryDto, CustomerTypeDto, PaymentStatusDto, ValidateBLDODto } from 'src/masters/DTO/credit-limit.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreditRequestService, CustomerCreditRequestInterface, CustomerCreditRequestWithKycInterface, CustomerKycInterface } from 'src/operation/services/credit-request/credit-request.service';

@Auth()
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

    @ApiOperation({ summary: 'Get Due Date for a customer' })
    @ApiCreatedResponse({
        description: 'Due Date retrieved successfully',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('due-date')
    async getDueDate(@Body() body: any) {
        const output = new ResponseData();
        try {
            this.logger.log(`getDueDate: ${JSON.stringify(body)}`)
            const dueDate = await this.creditRequestService.getDueDate(body);
            this.logger.debug(`getDueDate: ${JSON.stringify(dueDate)}`)
            output.data = dueDate;
            output.message = "Due Date retrieved successfully";
        } catch (error) {
            this.logger.warn(`getDueDate: ${JSON.stringify(error),error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = (error as any) || 'Internal Server Error';
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
  
  @ApiOperation({ summary: 'Get credit limit details for a customer' })
  @ApiCreatedResponse({
    description: 'Credit limit details retrieved successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('credit-limit')
  async getCreditLimit(@Body() body: CreditLimitDto) {
    const output = new ResponseData();
    try {
      const creditLimit = await this.creditRequestService.getCreditLimit(body);
      output.data = creditLimit;
      output.message = 'Credit limit retrieved successfully';
      this.logger.log(`getCreditLimit: ${JSON.stringify(creditLimit)}`);
    } catch (error) {
      this.logger.warn(`getCreditLimit: ${JSON.stringify(error)}, ${error}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  // @ApiOperation({ summary: 'Calculate outstanding amount for a customer' })
  // @ApiCreatedResponse({
  //   description: 'Outstanding calculated successfully',
  //   type: ResponseData,
  // })
  // @HttpCode(HttpStatus.OK)
  // @Post('outstanding')
  // async getOutstanding(@Body() body: OutstandingDto) {
  //   const output = new ResponseData();
  //   try {
  //     const outstanding = await this.creditRequestService.getOutstanding(body);
  //     output.data = outstanding;
  //     output.message = 'Outstanding calculated successfully';
  //     this.logger.log(`getOutstanding: ${JSON.stringify(outstanding)}`);
  //   } catch (error) {
  //     this.logger.warn(`getOutstanding: ${JSON.stringify(error)}, ${error}`);
  //     output.status = false;
  //     if (
  //       error instanceof BadRequestException ||
  //       error instanceof UnauthorizedException
  //     ) {
  //       output.message = error.message;
  //     } else {
  //       output.message = error.message || 'Internal Server Error';
  //     }
  //   }
  //   return output;
  // }

  @ApiOperation({ summary: 'Get outstanding breakdown by job' })
  @ApiCreatedResponse({
    description: 'Outstanding by job retrieved successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('outstanding-by-job')
  async getOutstandingByJob(@Body() body: OutstandingByJobDto) {
    const output = new ResponseData();
    try {
      const outstanding = await this.creditRequestService.getOutstandingByJob(
        body.customerMasterSid,
        body.companyMasterSid,
      );
      output.data = outstanding;
      output.message = 'Outstanding by job retrieved successfully';
      this.logger.log(`getOutstandingByJob: ${JSON.stringify(outstanding)}`);
    } catch (error) {
      this.logger.warn(`getOutstandingByJob: ${JSON.stringify(error)}, ${error}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Validate credit for BL/DO issuance' })
  @ApiCreatedResponse({
    description: 'Credit validation performed successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('validate')
  async validateCredit(@Body() body: ValidateCreditDto) {
    const output = new ResponseData();
    try {
      const validation = await this.creditRequestService.validateCreditForDocument(body);
      output.data = validation;
      
      if (validation.isValid) {
        output.message = 'Credit validation passed';
      } else {
        output.status = false;
        output.message = validation.errors?.length
          ? validation.errors.join('\n')
          : 'Credit validation failed';
      }
      
      this.logger.log(`validateCredit: ${JSON.stringify(validation)}`);
    } catch (error) {
      this.logger.warn(`validateCredit: ${JSON.stringify(error)}, ${error}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Validate BL/DO release credit rules' })
  @ApiCreatedResponse({
    description: 'BL/DO credit validation performed successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('validate-bldo')
  async validateBlDo(@Body() body: ValidateBLDODto) {
    const output = new ResponseData();
    try {
      const validation = await this.creditRequestService.validateBLDORelease(body);
      output.data = validation;

      if (validation.IsValid) {
        output.message = 'BL/DO credit validation passed';
      } else {
        output.status = false;
        output.message = 'BL/DO credit validation failed';
      }

      this.logger.log(`validateBlDo: ${JSON.stringify(validation)}`);
    } catch (error) {
      this.logger.warn(`validateBlDo: ${JSON.stringify(error)}, ${error}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get credit summary for a customer' })
  @ApiCreatedResponse({
    description: 'Credit summary retrieved successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('credit-summary')
  async getCreditSummary(@Body() body: CreditSummaryDto) {
    const output = new ResponseData();
    try {
      const summary = await this.creditRequestService.getCreditSummary(body);
      output.data = summary;
      output.message = 'Credit summary retrieved successfully';
      this.logger.log(`getCreditSummary: ${JSON.stringify(summary)}`);
    } catch (error) {
      this.logger.warn(`getCreditSummary: ${JSON.stringify(error)}, ${error}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Check customer type (CASH or CREDIT)' })
  @ApiCreatedResponse({
    description: 'Customer type retrieved successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('customer-type')
  async getCustomerType(@Body() body: CustomerTypeDto) {
    const output = new ResponseData();
    try {
      const customerType = await this.creditRequestService.getCustomerType(
        body.customerMasterSid,
      );
      output.data = { type: customerType };
      output.message = 'Customer type retrieved successfully';
      this.logger.log(`getCustomerType: ${customerType}`);
    } catch (error) {
      this.logger.warn(`getCustomerType: ${JSON.stringify(error)}, ${error}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Check if invoice is paid for Master/House Job' })
  @ApiCreatedResponse({
    description: 'Payment status retrieved successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Post('payment-status')
  async checkPaymentStatus(@Body() body: PaymentStatusDto) {
    const output = new ResponseData();
    try {
      const isPaid = await this.creditRequestService.checkInvoicePaymentStatus(
        body.masterJobSid,
        body.houseJobSid,
      );
      output.data = { isPaid };
      output.message = 'Payment status retrieved successfully';
      this.logger.log(`checkPaymentStatus: ${isPaid}`);
    } catch (error) {
      this.logger.warn(`checkPaymentStatus: ${JSON.stringify(error)}, ${error}`);
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete credit request by ID' })
  @ApiCreatedResponse({
    description: 'Credit request deleted successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete-credit-request/:CustomerCreditRequestSid')
  async deleteCustomerCreditRequest(
    @Param('CustomerCreditRequestSid', ParseIntPipe)
    CustomerCreditRequestSid: number,
    @Body('updatedBy') updatedBy: string
  ) {
    const output = new ResponseData();
    this.logger.log(
      `deleteCustomerCreditRequest: ${CustomerCreditRequestSid}`,
    );
    try {
      const result =
        await this.creditRequestService.deleteCustomerCreditRequest(
          CustomerCreditRequestSid, updatedBy
        );
      output.data = result;
      output.message = 'Credit request deleted successfully';
    } catch (error) {
      this.logger.warn(
        `deleteCustomerCreditRequest: ${JSON.stringify(error)}, ${error}`,
      );
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Delete customer KYC by ID' })
  @ApiCreatedResponse({
    description: 'Customer KYC deleted successfully',
    type: ResponseData,
  })
  @HttpCode(HttpStatus.OK)
  @Delete('delete-kyc/:CustomerKycSid')
  async deleteCustomerKyc(
    @Param('CustomerKycSid', ParseIntPipe) CustomerKycSid: number,
  ) {
    const output = new ResponseData();
    this.logger.log(`deleteCustomerKyc: ${CustomerKycSid}`);
    try {
      const result = await this.creditRequestService.deleteCustomerKyc(
        CustomerKycSid,
      );
      output.data = result;
      output.message = 'Customer KYC deleted successfully';
    } catch (error) {
      this.logger.warn(
        `deleteCustomerKyc: ${JSON.stringify(error)}, ${error}`,
      );
      output.status = false;
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        output.message = error.message;
      } else {
        output.message = error.message || 'Internal Server Error';
      }
    }
    return output;
  }

  @ApiOperation({ summary: 'Get Audit Logs for a Table/Record' })
        @ApiCreatedResponse({ description: 'Fetch audit logs', type: ResponseData })
        @HttpCode(HttpStatus.OK)
        @Get('audit/logs')
        async getAuditLogs(
          @Query('tableName') tableName: string,
          @Query('recordId') recordId?: string,
        ) {
          const resp = new ResponseData();
          try {
            if (!tableName) throw new Error('tableName query parameter is required');
      
            const logs = await this.creditRequestService.getAuditLogs(tableName, recordId);
      
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
