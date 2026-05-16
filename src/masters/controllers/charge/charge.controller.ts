import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, Query, Res, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiCreatedResponse, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { ChargeService } from 'src/masters/services/charge/charge.service';
class CompanyIdDto {
    CompanyMasterSid: number;
}
@Auth()
@Controller('charge')
export class ChargeController {
    constructor(private chargeService: ChargeService, private logger: Logger) { }

    @ApiOperation({ summary: 'Charge Creation' })
    @ApiCreatedResponse({
        description: 'Charge Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCharge(@Body() body: any) {
        this.logger.log(`createChargedata: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Charge = await this.chargeService.createCharge(body);
            this.logger.debug(`createCharge: ${JSON.stringify(Charge)}`)
            if (!Charge) {
                this.logger.warn(`createCharge!!: ${JSON.stringify(Charge)}`)
                throw 'Something went wrong'
            }
            output.data = Charge
            output.message = 'Charge Created Successfully'
        } catch (error) {
            this.logger.warn(`createChargeError: ${error}`)
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createChargeError: ${error.message}`)
            } else {
                this.logger.warn(`createChargeError: ${error}`)
                output.message = error;
            }
        }
        return output
    }


    @ApiOperation({ summary: 'Get All Charge' })
    @ApiCreatedResponse({
        description: 'Get All Charges',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post()
    async getAllCharges(@Body() body: CompanyIdDto) {
        let output = new ResponseData;
        try {
            let ChargeData = await this.chargeService.getAllCharges(body.CompanyMasterSid);
            this.logger.log(`getAllCharges: ${JSON.stringify(ChargeData)}`)
            output.data = ChargeData;
            output.message = "All Charges are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllCharges: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }



    @ApiOperation({ summary: 'Get All Charge Group' })
    @ApiCreatedResponse({
        description: 'Get All Charge Group',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('charge-group')
    async getAllChargeGroups() {
        let output = new ResponseData;
        try {
            let ChargeGroupData = await this.chargeService.getAllChargeGroups();
            this.logger.log(`getAllChargeGroup: ${JSON.stringify(ChargeGroupData)}`)
            output.data = ChargeGroupData;
            output.message = "All ChargeGroup are successfully fetched";
        } catch (error) {
            this.logger.warn(`getAllChargeGroup: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }



    @ApiOperation({ summary: 'Get Charge By Id' })
    @ApiCreatedResponse({
        description: 'Get Charge By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getChargeById(@Param('id', ParseIntPipe) ChargeId: number) {
        const output = new ResponseData;
        try {
            const Charge = await this.chargeService.findOne(ChargeId)
            this.logger.log(`getChargeById: ${JSON.stringify(Charge)}`)
            output.data = Charge;
            output.message = `Charge with id : ${ChargeId} is successfully fetched`;
        } catch (error) {
            this.logger.warn(`getChargeById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }


    @ApiOperation({ summary: 'Update Charge By Id' })
    @ApiCreatedResponse({
        description: 'Update Charge By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editCharge(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
        this.logger.log(`editChargebody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let Charge = await this.chargeService.updateCharge(id, body);
            this.logger.log(`editCharge: ${JSON.stringify(Charge)}`)

            if (!Charge) {
                this.logger.log(`editCharge!!: ${JSON.stringify(Charge)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editChargeelse: ${Charge}`)
            }
            output.data = Charge;
            output.message = 'Charge Updated Successfully'
        } catch (error) {
            this.logger.warn(`editChargeerror: ${JSON.stringify(error), error}`)
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



    @ApiOperation({ summary: 'Delete Charge By Id' })
    @ApiCreatedResponse({
        description: 'Delete Charge By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.chargeService.softDelete(id);
    }

    @ApiOperation({ summary: 'Get Charge Tax By Charge Id' })
    @ApiCreatedResponse({
        description: 'Charge Tax By Charge Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('charge-tax/:ChargeMasterSid')
    async getChargeTaxByChargeId(@Param('ChargeMasterSid', ParseIntPipe) ChargeMasterSid: number) {
        let response = new ResponseData;
        try {
            let chargeTaxes = await this.chargeService.getChargeTaxByChargeId(ChargeMasterSid);
            this.logger.log(`getChargeTaxByChargeId: ${JSON.stringify(chargeTaxes)}`)
            response.data = chargeTaxes;
            response.message = "Charge Taxes are successfully fetched";
        } catch (error) {
            this.logger.warn(`getChargeTaxByChargeId: ${JSON.stringify(error)}`)
            response.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response
    }

    @ApiOperation({ summary: 'Search List of Charges' })
    @ApiCreatedResponse({
        description: 'Search List of Charges',
        type: ResponseData,
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCharge(@Body() searchParams: filterDto) {
        const resp = new ResponseData();
        try {
            const res = await this.chargeService.searchList(searchParams);
            this.logger.log(`Charge Search Data : ${JSON.stringify(res)}`);
            resp.data = res;

            resp.message = 'Charge search completed successfully';
        } catch (error) {
            this.logger.warn(`Search Charge Error : ${error}`);
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

            const logs = await this.chargeService.getAuditLogs(tableName, recordId);

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
    // ─── DOWNLOAD TEMPLATE ────────────────────────────────────────────────────────
@ApiOperation({ summary: 'Download Charge Excel template' })
@HttpCode(HttpStatus.OK)
@Get('template')
async downloadChargeTemplate(
  @Query('CompanyMasterSid') CompanyMasterSid: number,
  @Res() res: Response
) {
  try {
    this.logger.log(`Generating Excel template for charge upload`);
    const buffer = await this.chargeService.generateChargeTemplate(Number(CompanyMasterSid));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Charge_Upload_Template.xlsx');
    res.send(buffer);
  } catch (error) {
    this.logger.warn(`Error generating charge template: ${JSON.stringify(error)}, ${error}`);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Error generating template' });
  }
}

// ─── STEP 1: PARSE ────────────────────────────────────────────────────────────
@ApiOperation({ summary: 'Parse & validate charge Excel — does NOT save to DB' })
@ApiConsumes('multipart/form-data')
@HttpCode(HttpStatus.OK)
@Post('bulk-upload/parse')
@UseInterceptors(FileInterceptor('file'))
async parseChargeExcel(
  @UploadedFile() file: Express.Multer.File,
  @Body('CompanyMasterSid') CompanyMasterSid: string,
) {
  const resp = new ResponseData();
  try {
    if (!file) throw new BadRequestException('No file uploaded');

    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (!allowedMimeTypes.includes(file.mimetype))
      throw new BadRequestException('Invalid file type. Only .xlsx or .xls allowed');

    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('File size exceeds 5MB limit');

    if (!CompanyMasterSid)
      throw new BadRequestException('CompanyMasterSid is required');

    const result = await this.chargeService.parseChargeExcel(
      file.buffer,
      Number(CompanyMasterSid)
    );

    // result has: validRows[], invalidRows[], summary
    const hasValid = result.validRows.length > 0;

    resp.status = true;
    resp.message = hasValid
      ? `Parsed successfully. ${result.validRows.length} valid, ${result.invalidRows.length} invalid.`
      : 'No valid rows found. Please fix the errors and re-upload.';
    resp.data = result;

  } catch (error) {
    resp.status = false;
    this.logger.warn(`Error parsing charge Excel: ${JSON.stringify(error)}, ${error}`);
    resp.message = error instanceof BadRequestException
      ? error.message
      : 'Internal Server Error';
  }
  return resp;
}

// ─── STEP 2: SAVE ─────────────────────────────────────────────────────────────
@ApiOperation({ summary: 'Save validated charge rows to DB' })
@HttpCode(HttpStatus.OK)
@Post('bulk-upload/save')
async saveChargeExcel(
  @Body() payload: {
    validRows: any[];
    CompanyMasterSid: number;
    createdBy: string;
  }
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

    const result = await this.chargeService.saveChargeExcel(
      validRows,
      CompanyMasterSid,
      createdBy
    );

    resp.status = true;
    resp.message = `Import complete. ${result.created} created, ${result.skipped} skipped.`;
    resp.data = result;

  } catch (error) {
    resp.status = false;
    this.logger.warn(`Error saving charge Excel: ${JSON.stringify(error)}, ${error}`);
    resp.message = error instanceof BadRequestException
      ? error.message
      : 'Internal Server Error';
  }
  return resp;
}
}
