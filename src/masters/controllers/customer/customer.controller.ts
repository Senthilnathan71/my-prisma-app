import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CustomerService } from 'src/masters/services/customer/customer.service';
class CompanyIdDto {
    CompanyMasterSid: number;
}
@Controller('customer')

export class CustomerController {
    constructor(private customerService: CustomerService, private logger: Logger) { }

    @ApiOperation({ summary: 'Customer Creation' })
    @ApiCreatedResponse({
        description: 'Customer Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCustomer(@Body() body: any) {
        this.logger.log(`createDepartmentdata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let customer = await this.customerService.createCustomer(body);
            this.logger.debug(`createCustomer: ${JSON.stringify(customer)}`)
            if (!customer) {
                this.logger.warn(`createCustomer!!: ${JSON.stringify(customer)}`)
                throw 'Something went wrong'
            }
            output.data = customer
            output.message = 'Organization Created Successfully'

        } catch (error) {
            this.logger.warn(`createCustomerError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createCustomerError: ${error.message}`)
            } else {
                this.logger.warn(`createCustomerError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Customer' })
    @ApiCreatedResponse({
        description: 'Get All Customers',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllCustomers(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllCustomers(body.CompanyMasterSid);
            this.logger.log(`getAllCustomers: ${JSON.stringify(customerData)}`)
            output.data = customerData;
            output.message = "All Organization are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllCustomers: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Customer With Customer Branches' })
    @ApiCreatedResponse({
        description: 'Get All Customers with Branches',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('with-branches')
    async getAllCustomersWithCustomerBranches(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllCustomersWithCustomerBranch(body.CompanyMasterSid);
            this.logger.log(`getAllCustomersWithBranches: ${JSON.stringify(customerData)}`)
            output.data = customerData;
            output.message = "All Customer with Branches are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllCustomersWithBranches: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
    @ApiOperation({ summary: 'Get All Vendor Supplier With Customer Branches' })
    @ApiCreatedResponse({
        description: 'Get All Vendors Supplier with Branches',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('vendor-supplier')
    async getAllVendorSuppliersWithBranches(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllVendorSuppliersWithBranch(body.CompanyMasterSid);
            this.logger.log(`getAllVendorSuppliersWithBranches: ${JSON.stringify(customerData)}`)
            output.data = customerData;
            output.message = "All Vendor Supplier with Branches are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllVendorSuppliersWithBranches: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get Customer By Id' })
    @ApiCreatedResponse({
        description: 'Get Customer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getCustomerById(@Param('id', ParseIntPipe) customerId: number) {
        const output = new ResponseData;
        try {
            const Customer = await this.customerService.findOne(customerId)
            this.logger.log(`getCustomerById: ${JSON.stringify(Customer)}`)
            output.data = Customer
            output.message = `Organization with id : ${customerId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getCustomerById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

    @Post('check-unique')
@HttpCode(HttpStatus.OK)
async checkUnique(@Body() body: {
  CompanyMasterSid: number;
  customerName?: string;
  customerShortCode?: string;
  excludeCustomerMasterSid?: number;
}) {
  const resp = new ResponseData();
  try {
    const result = await this.customerService.checkUniqueCustomerFields(body);
    resp.data = {
      nameTaken: result.nameTaken,
      codeTaken: result.codeTaken,
    };
    resp.message = result.message; 
  } catch (e) {
    this.logger.warn(`checkUnique error: ${e}`);
    resp.status = false;
    resp.message = e.message || 'Internal Server Error';
  }
  return resp;
}


    @ApiOperation({ summary: 'Update Customer By Id' })
    @ApiCreatedResponse({
        description: 'Update Customer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editCustomer(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        this.logger.log(`editCustomer: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Customer = await this.customerService.updateCustomer(id, body);
            this.logger.log(`editCustomer: ${JSON.stringify(Customer)}`)

            if (!Customer) {
                this.logger.log(`editCustomer!!: ${JSON.stringify(Customer)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editCustomer: ${Customer}`)
            }
            output.data = Customer;
            output.message = 'Organization Updated Successfully'
        } catch (error) {
            this.logger.warn(`editCustomer: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editCustomer: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.warn(`editCustomer: ${output.message}`)
        return output
    }




    @ApiOperation({ summary: 'Delete Customer By Id' })
    @ApiCreatedResponse({
        description: 'Delete Customer By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.customerService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of Customer' })
    @ApiCreatedResponse({
        description: 'Search List',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCustomer(@Body() searchParams: filterDto) {
        let resp = new ResponseData();
        try {
            this.logger.log(`Searching Customers with params: ${JSON.stringify(searchParams)}`);
            const res = await this.customerService.searchList(searchParams);
            this.logger.log(`Customer Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Customer search results fetched successfully';
        } catch (error) {
            this.logger.warn(`Search Customer Error: ${error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = 'Internal Server Error';
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Carrier' })
    @ApiCreatedResponse({
        description: 'Get All Carrier',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('carrier')
    async getAllCarriers(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllCarriers(body.CompanyMasterSid);
            this.logger.log(`getAllCarriers: ${JSON.stringify(customerData)}`)
            output.data = customerData;
        } catch (error) {
            this.logger.warn(`getAllCarriers: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
    @ApiOperation({ summary: 'Get All Shipper' })
    @ApiCreatedResponse({
        description: 'Get All Shipper',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('shipper')
    async getAllShippers(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllShippers(body.CompanyMasterSid);
            this.logger.log(`getAllShippers: ${JSON.stringify(customerData)}`)
            output.data = customerData;
            output.message = "All shipper are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllShippers: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
    @ApiOperation({ summary: 'Get All Consignee' })
    @ApiCreatedResponse({
        description: 'Get All Consignee',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('consignee')
    async getAllConsignees(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllConsignee(body.CompanyMasterSid);
            this.logger.log(`getAllConsignees: ${JSON.stringify(customerData)}`)
            output.data = customerData;
            output.message = "All consignee are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllConsignees: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
    @ApiOperation({ summary: 'Get All Agent' })
    @ApiCreatedResponse({
        description: 'Get All Agent',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('agent')
    async getAllAgents(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllAgents(body.CompanyMasterSid);
            this.logger.log(`getAllAgents: ${JSON.stringify(customerData)}`)
            output.data = customerData;
        } catch (error) {
            this.logger.warn(`getAllAgents: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
    @ApiOperation({ summary: 'Get All Transporter' })
    @ApiCreatedResponse({
        description: 'Get All Transporter',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('transporter')
    async getAllTransporters(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllTransporters(body.CompanyMasterSid);
            this.logger.log(`getAllTransporters: ${JSON.stringify(customerData)}`)
            output.data = customerData;
        } catch (error) {
            this.logger.warn(`getAllTransporters: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All CFS' })
    @ApiCreatedResponse({
        description: 'Get All CFS',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('cfs')
    async getAllCFS(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let customerData = await this.customerService.getAllCFS(body.CompanyMasterSid);
            this.logger.log(`getAllCFS: ${JSON.stringify(customerData)}`)
            output.data = customerData;
            output.message = "All CFS are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllCFS: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Suppliers' })
    @ApiCreatedResponse({
        description: 'Get All Suppliers',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('suppliers')
    async getAllSuppliers(@Body() body: CompanyIdDto) {
        let output = new ResponseData();
        try {
            let customerData = await this.customerService.getAllSuppliers(body.CompanyMasterSid);
            this.logger.log(`getAllSuppliers: ${JSON.stringify(customerData)}`)
            output.data = customerData;
        } catch (error) {
            this.logger.warn(`getAllSuppliers: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
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

            const logs = await this.customerService.getAuditLogs(tableName, recordId);

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
