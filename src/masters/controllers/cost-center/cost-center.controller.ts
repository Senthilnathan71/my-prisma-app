import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { CostCenterService } from 'src/masters/services/cost-center/cost-center.service';

@Controller('cost-center')
export class CostCenterController {
    constructor(private costCenterService: CostCenterService, private logger: Logger) { }

    @ApiOperation({ summary: 'Cost-Center Creation' })
    @ApiCreatedResponse({
        description: 'Cost-Center Creation',
        type: ResponseData
    })
    @HttpCode(HttpStatus.CREATED)
    @Post('create')
    async createCostCenter(@Body() body: any,@UserData() user: any) {
        this.logger.log(`createCostCenterData: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let CostCenter = await this.costCenterService.createCostCenter(body, user);
            this.logger.debug(`createCostCenterData: ${JSON.stringify(CostCenter)}`)
            if (!CostCenter) {
                this.logger.warn(`createCostCenter!!: ${JSON.stringify(CostCenter)}`)
                throw 'Something went wrong'
            }
            output.data = CostCenter
            output.message = 'Cost-Center Created Successfully'
        } catch (error) {
            this.logger.warn(`createCostCenterError: ${error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
                this.logger.warn(`createCostCenterError: ${error.message}`)
            } else {
                this.logger.warn(`createCostCenterError: ${error}`)
                output.message = error;
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get All Cost-Center' })
    @ApiCreatedResponse({
        description: 'Get All Cost-Center',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get()
    async getAllCostCenter() {
        let output = new ResponseData;
        try {
            let CostCenterData = await this.costCenterService.getAllCostCenter();
            this.logger.log(`getAllCostCenter: ${JSON.stringify(CostCenterData)}`)
            output.data = CostCenterData;
        } catch (error) {
            this.logger.warn(`getAllCostCenter: ${JSON.stringify(error)}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }

    @ApiOperation({ summary: 'Get Cost-Center By Id' })
    @ApiCreatedResponse({
        description: 'Get Cost-Center By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:id')
    async getCostCenterById(@Param('id', ParseIntPipe) CostCenterId: number) {
        const output = new ResponseData;
        try {
            const CostCenter = await this.costCenterService.findOne(CostCenterId)
            this.logger.log(`getCostCenterById: ${JSON.stringify(CostCenter)}`)
            output.data = CostCenter
        } catch (error) {
            this.logger.warn(`getCostCenterById: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = error
        }
        return output;
    }

    @ApiOperation({ summary: 'Update Cost-Center By Id' })
    @ApiCreatedResponse({
        description: 'Update Cost-Center By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:id')
    async editCostCenter(@Param('id', ParseIntPipe) id: number, @Body() body: any, @UserData() user: any) {
        this.logger.log(`editCostCenterbody: ${JSON.stringify(body)}`)
        let output = new ResponseData
        try {
            let CostCenter = await this.costCenterService.updateCostCenter(id,body,user);
            this.logger.log(`editCostCenter: ${JSON.stringify(CostCenter)}`)
            if (!CostCenter) {
                this.logger.log(`editCostCenter!!: ${JSON.stringify(CostCenter)}`)
                throw 'Something went wrong'
            } else {
                this.logger.log(`editCostCenterelse: ${CostCenter}`)
            }
            output.data = CostCenter;
            output.message = 'Cost-Center Updated Successfully'
        } catch (error) {
            this.logger.warn(`editCostCenterError: ${JSON.stringify(error), error}`)
            output.status = false;
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                this.logger.warn(`editCostCenterbadrequest: ${error}`)
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        this.logger.log(`editCostCentermessage: ${output.message}`)
        return output
    }

    @ApiOperation({ summary: 'Delete Cost-Center By Id' })
    @ApiCreatedResponse({
        description: 'Delete Cost-Center By Id',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:id')
    async softDelete(@Param('id', ParseIntPipe) id: number) {
        return this.costCenterService.softDelete(id);
    }

    @ApiOperation({ summary: 'Search List of Cost-Center' })
    @ApiCreatedResponse({
        description: 'Search List',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchCostCenter(@Body() body: SearchListDto) {
        let output = new ResponseData;
        try {
            this.logger.log(`searchCostCenter: ${JSON.stringify(body)}`)
            const CostCenterList = await this.costCenterService.searchList(body);
            output.data = CostCenterList
            output.message = "Cost-Center List fetched Successfully"
        } catch (err) {
            output.status = false;
            this.logger.warn(`searchCostCenter: ${JSON.stringify(err)}`)
            output.status = false;
            if (err instanceof BadRequestException || err instanceof UnauthorizedException) {
                output.message = err.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output
    }
}
 