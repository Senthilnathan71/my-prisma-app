import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { CompanyIdDto } from 'src/masters/DTO/company-id.dto';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { DepartmentService } from 'src/masters/services/department/department.service';
@Auth()
@Controller('department')

export class DepartmentController {
    constructor(private departmentService: DepartmentService, private logger: Logger) { }

    @ApiOperation({ summary: 'Department Creation' })
    @ApiCreatedResponse({
        description: 'Department Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createDepartment(@Body() body: any) {
        this.logger.log(`createDepartmentdata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let department = await this.departmentService.createDepartment(body);
            this.logger.debug(`createDepartment: ${JSON.stringify(department)}`)
            if (!department) {
                this.logger.warn(`createDepartment!!: ${JSON.stringify(department)}`)
                throw 'Something went wrong'
            }
            output.data = department
            output.message = 'Department Created Successfully'
        } catch (error) {
            this.logger.warn(`createDepartmentError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Get All Department' })
    @ApiCreatedResponse({
        description: 'Get All Departments',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllDepartments(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let DepartmentData = await this.departmentService.getAllDepartments(body.CompanyMasterSid);
            this.logger.log(`getAllDepartments: ${JSON.stringify(DepartmentData)}`)
            output.data = DepartmentData;
            output.message = "All Departments are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllDepartments: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
    @ApiOperation({ summary: 'Get Department by type' })
@ApiCreatedResponse({ description: 'Get Department by type', type: ResponseData })
@HttpCode(HttpStatus.OK)
@Post('department-type') 
async getDepartmentByType(
    @Body() payload: CompanyIdDto
) {
    const resp = new ResponseData();
    try {
        const res = await this.departmentService.getDepartmentByType(payload);
        this.logger.log(`Department by type : ${JSON.stringify(res)}`);
        resp.data = res;
        resp.message = "Department by type is successfully fetched";
    } catch (error) {
        this.logger.warn(`Department by type Error : ${JSON.stringify(error)}`, error);
        resp.status = false;
        if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
            resp.message = error.message;
        } else {
            resp.message = "Internal Server Error";
        }
    }
    return resp;
}
   

    @ApiOperation({ summary: 'Get Department By Id' })
    @ApiCreatedResponse({
        description: 'Get Department By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getDepartmentById(@Param('id', ParseIntPipe) DepartmentId: number) {
        const output = new ResponseData;
        try {
            const Department = await this.departmentService.findOne(DepartmentId)
            this.logger.log(`getDepartmentById: ${JSON.stringify(Department)}`)
            output.data = Department;
            output.message = `Department with id : ${DepartmentId} is successfully fetched`;

        } catch (error) {
            this.logger.warn(`getDepartmentById Error: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Department By Id' })
    @ApiCreatedResponse({
        description: 'Update Department By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editDepartment(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        this.logger.log(`editDepartmentbody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Department = await this.departmentService.updateDepartment(id, body);
            this.logger.log(`editDepartment: ${JSON.stringify(Department)}`)

            if (!Department) {
                this.logger.log(`editDepartment!!: ${JSON.stringify(Department)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editDepartmentelse: ${Department}`)
            }
            output.data = Department;
            output.message = `Department with id : ${id} is successfully updated`;
        } catch (error) {
            this.logger.warn(`editDepartmenterror: ${JSON.stringify(error), error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editDepartmentbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = "Internal Server Error";
            }
        }
        this.logger.log(`editDepartmentmessage: ${output.message}`)
        return output
    }



    @ApiOperation({ summary: 'Delete Department By Id' })
    @ApiCreatedResponse({
        description: 'Delete Department By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.departmentService.softDelete(id);
    }



    @ApiOperation({ summary: 'Search List of Department' })
    @ApiCreatedResponse({
        description: 'Search List of Departments',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchDepartment(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.departmentService.searchListUsingView(searchParams);
            this.logger.log(`Department Search Data: ${JSON.stringify(res)}`);
            resp.data = res;
            resp.message = 'Department Search is successfully fetched';
        } catch (error) {
            this.logger.warn(`Search Department Error: ${error}`);
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

            const logs = await this.departmentService.getAuditLogs(tableName, recordId);

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
