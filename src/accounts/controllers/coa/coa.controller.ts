import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { CoaService } from 'src/accounts/services/coa/coa.service';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { UploadedFile, UseInterceptors, Res } from '@nestjs/common';
import { Response } from 'express';

class CompanyIdDto {
    CompanyMasterSid: number;
}

class CategoryDto {
    Category: string;
    CompanyMasterSid: number;
}

class GroupDto {
    Category: string;
    GroupName: string;
    CompanyMasterSid: number;
}
@Auth()
@Controller('coa')
export class CoaController {
    constructor(private coaService: CoaService, private logger: Logger) { }

    @ApiOperation({ summary: 'Create new Coa' })
    @ApiCreatedResponse({
        description: 'Create new Coa',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async createNewCoa(@Body() newData: any) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.createNewCoa(newData);
            resp.data = res;
            resp.message = "New Coa is successfully created"
        } catch (error) {
            this.logger.warn(`Coa Creation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Coa' })
    @ApiCreatedResponse({
        description: 'Get All Coa',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllCoa(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.getAllCoa(body.CompanyMasterSid);
            resp.data = res;
            resp.message = "All Coa are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get All Coa Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Groups by Category' })
    @ApiCreatedResponse({
        description: 'Get All Groups by Category',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('groups-by-category')
    async getAllGroupsByCategory(@Body() body: CategoryDto) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.getAllGroupsByCategory(body.Category, body.CompanyMasterSid);
            resp.data = res;
            resp.message = "Groups by category are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get Groups by Category Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get COA by LedgerType' })
    @ApiCreatedResponse({ description: 'Get COA by LedgerType', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Post('ledger-type')
    async getCOAByLedgerType(@Body() body: { LedgerType: string; CompanyMasterSid: number }) {
        const resp = new ResponseData();
        try {
            const res = await this.coaService.getCOAByLedgerType(body.LedgerType, body.CompanyMasterSid);
            resp.data = res;
            resp.message = "COA by LedgerType is successfully fetched";
        } catch (error) {
            this.logger.warn(`COA by LedgerType Error : ${JSON.stringify(error)}`, error);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }
    @ApiOperation({ summary: 'Get All Subgroups by Group' })
    @ApiCreatedResponse({
        description: 'Get All Subgroups by Group',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('subgroups-by-group')
    async getAllSubgroupsByGroup(@Body() body: GroupDto) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.getAllSubgroupsByGroup(body.Category, body.GroupName, body.CompanyMasterSid);
            resp.data = res;
            resp.message = "Subgroups by group are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get Subgroups by Group Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get COA with SubledgerName = "yes"' })
    @ApiCreatedResponse({
        description: 'Get COA records where SubledgerName is "yes"',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('with-subledger')
    async getCoaWithSubledger(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.getCoaWithSubledger(body.CompanyMasterSid);
            resp.data = res;
            resp.message = "Coa records with SubledgerName='yes' are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get Coa with Subledger Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Coa by Id' })
    @ApiCreatedResponse({
        description: 'Get Coa by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('fetch')
    async getCoaById(@Body() payload: any) {
        let resp = new ResponseData();
        try {

            let res = await this.coaService.fetchCoaById(payload.COAMasterSid,payload.CompanyMasterSid);

            resp.data = res;
            resp.message = `Coa with id : ${payload.COAMasterSid} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`Get Coa by Id Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Coa by Id' })
    @ApiCreatedResponse({
        description: 'Update Coa by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:COAMasterSid')
    async updateCoaById(@Param('COAMasterSid', ParseIntPipe) COAMasterSid: number, @Body() payload: any) {
        let resp = new ResponseData();
        try {

            let res = await this.coaService.updateCoaById(COAMasterSid, payload);

            resp.data = res;
            resp.message = `Coa with id : ${COAMasterSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(`Coa Updation Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Delete Coa by Id' })
    @ApiCreatedResponse({
        description: 'Delete Coa by Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:COAMasterSid')
    async deleteCoaById(@Param('COAMasterSid', ParseIntPipe) COAMasterSid: number) {
        let resp = new ResponseData();
        try {

            let res = await this.coaService.deleteCOA(COAMasterSid);

            resp.data = res;
            resp.message = `Coa with id : ${COAMasterSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(`Coa Deletion Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search List of Coa' })
    @ApiCreatedResponse({
        description: 'Search List of Coa',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCoa(@Body() searchData: filterDto) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.searchCoa(searchData);

            resp.data = res;
            resp.message = "Coa Search results are successfully fetched"
        } catch (error) {
            this.logger.warn(`Coa Search Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
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

            const logs = await this.coaService.getAuditLogs(tableName, recordId);

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

     @ApiOperation({ summary : 'Get List of COA by its LedgerType' })
    @ApiCreatedResponse({
        description: 'Get List of COA by its LedgerType',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('ledger-category')
    async getCoaByLedgerCategory(@Body() body: { LedgerCategory: string ; CompanyMasterSid: number , filterNonJob ?: boolean , VoucherType ?: string }) {
        let resp = new ResponseData();
        try {
            if(!body.VoucherType && !body.LedgerCategory){
                throw new BadRequestException('LedgerCategory is required');
            }
            if(!body.CompanyMasterSid){
                throw new BadRequestException('CompanyMasterSid is required');
            }
            let res = await this.coaService.getCOAByLedgerCategory(body.LedgerCategory, body.CompanyMasterSid , body.filterNonJob , body.VoucherType);

            resp.data = res;
            resp.message = "Coa by LedgerCategory is successfully fetched";
        } catch (error) {
            this.logger.warn(`Get Coa by LedgerCategory Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary : 'Get List of COA by its LedgerType' })
    @ApiCreatedResponse({
        description: 'Get List of COA by its LedgerType',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('cashOrBank')
    async getCoaByLedgerType(@Body() body: { LedgerType: 'Cash' | 'Bank'; CompanyMasterSid: number; filterNonJob?: boolean }) {
        let resp = new ResponseData();
        try {
            if(!body.LedgerType){
                throw new BadRequestException('LedgerType is required');
            }
            if(!body.CompanyMasterSid){
                throw new BadRequestException('CompanyMasterSid is required');
            }
            let res = await this.coaService.getCOAByCashOrBank(body.LedgerType, body.CompanyMasterSid, body.filterNonJob);

            resp.data = res;
            resp.message = "Coa by LedgerType is successfully fetched";
        } catch (error) {
            this.logger.warn(`Get Coa by LedgerType Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All Groups by Company' })
    @ApiCreatedResponse({
        description: 'Get All Groups by Company',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('groups-by-company')
    async getGroupsByCompany(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.getGroupsByCompany(body.CompanyMasterSid);

            resp.data = res;
            resp.message = "Groups are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get Groups Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get All SubGroups by Company' })
    @ApiCreatedResponse({
        description: 'Get All SubGroups by Company',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('subgroups-by-company')
    async getSubGroupsByCompany(@Body() body: CompanyIdDto) {
        let resp = new ResponseData();
        try {
            let res = await this.coaService.getSubGroupsByCompany(body.CompanyMasterSid);

            resp.data = res;
            resp.message = "SubGroups are successfully fetched";
        } catch (error) {
            this.logger.warn(`Get SubGroups Error : ${JSON.stringify(error), error}`);
            resp.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                resp.message = error.message;
            } else {
                resp.message = "Internal Server Error";
            }
        }
        return resp;
    }

    @ApiOperation({ summary: 'Download COA Excel upload template' })
@HttpCode(HttpStatus.OK)
@Get('template')
async downloadCoaTemplate(
  @Query('CompanyMasterSid') CompanyMasterSid: number,
  @Res() res: Response,
) {
  try {
    const buffer = await this.coaService.generateCoaTemplate(Number(CompanyMasterSid));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=COA_Upload_Template.xlsx');
    res.send(buffer);
  } catch (error) {
    this.logger.warn(`Error generating COA template: ${error}`);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ status: false, message: 'Error generating template' });
  }
}
 
// ─── STEP 1: PARSE ────────────────────────────────────────────────────────────
@ApiOperation({ summary: 'Parse & validate COA Excel — does NOT save to DB' })
@ApiConsumes('multipart/form-data')
@HttpCode(HttpStatus.OK)
@Post('bulk-upload/parse')
@UseInterceptors(FileInterceptor('file'))
async parseCoaExcel(
  @UploadedFile() file: Express.Multer.File,
  @Body('CompanyMasterSid') CompanyMasterSid: string,
) {
  const resp = new ResponseData();
  try {
    if (!file) throw new BadRequestException('No file uploaded');
 
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowedMimeTypes.includes(file.mimetype))
      throw new BadRequestException('Invalid file type. Only .xlsx or .xls allowed');
 
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('File size exceeds 5 MB limit');
 
    if (!CompanyMasterSid)
      throw new BadRequestException('CompanyMasterSid is required');
 
    const result = await this.coaService.parseCoaExcel(
      file.buffer,
      Number(CompanyMasterSid),
    );
 
    resp.status  = true;
    resp.message = result.validRows.length > 0
      ? `Parsed successfully. ${result.validRows.length} valid, ${result.invalidRows.length} invalid.`
      : 'No valid rows found. Please fix the errors and re-upload.';
    resp.data    = result;
  } catch (error) {
    resp.status  = false;
    this.logger.warn(`Error parsing COA Excel: ${error}`);
    resp.message = error instanceof BadRequestException
      ? error.message
      : 'Internal Server Error';
  }
  return resp;
}
 
// ─── STEP 2: SAVE ─────────────────────────────────────────────────────────────
@ApiOperation({ summary: 'Save validated COA rows to DB' })
@HttpCode(HttpStatus.OK)
@Post('bulk-upload/save')
async saveCoaExcel(
  @Body() payload: {
    validRows: any[];
    CompanyMasterSid: number;
    createdBy: string;
  },
) {
  const resp = new ResponseData();
  try {
    const { validRows, CompanyMasterSid, createdBy } = payload;
 
    if (!validRows?.length)
      throw new BadRequestException('No valid rows to save');
    if (!CompanyMasterSid)
      throw new BadRequestException('CompanyMasterSid is required');
    if (!createdBy)
      throw new BadRequestException('createdBy is required');
 
    const result = await this.coaService.saveCoaExcel(
      validRows,
      CompanyMasterSid,
      createdBy,
    );
 
    resp.status  = true;
    resp.message = `Import complete. ${result.created} created, ${result.skipped} skipped.`;
    resp.data    = result;
  } catch (error) {
    resp.status  = false;
    this.logger.warn(`Error saving COA Excel: ${error}`);
    resp.message = error instanceof BadRequestException
      ? error.message
      : 'Internal Server Error';
  }
  return resp;
}
}
