import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, ParseIntPipe, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { CreatePrintMasterDto, PrintMasterSearchDto, UpdatePrintMasterDto } from 'src/masters/DTO/print-master.dto';
import { PrintMasterService } from 'src/masters/services/print-master/print-master.service';

@Controller('print-master')
export class PrintMasterController {
    private readonly logger = new Logger(PrintMasterController.name);

    constructor(private printMasterService: PrintMasterService) {}

    @ApiOperation({ summary: 'Create Print Master' })
    @ApiCreatedResponse({ description: 'Create Print Master', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Post('create')
    async create(@Body() dto: CreatePrintMasterDto) {
        const resp = new ResponseData();
        try {
            resp.data = await this.printMasterService.create(dto);
            resp.message = 'Print Master created successfully.';
        } catch (error) {
            this.logger.warn(`PrintMaster create error: ${error}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Search Print Master List' })
    @ApiCreatedResponse({ description: 'Search Print Master List', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Post('search-list')
    async searchList(@Body() dto: PrintMasterSearchDto) {
        const resp = new ResponseData();
        try {
            resp.data = await this.printMasterService.searchList(dto);
            resp.message = 'Print Master list fetched successfully.';
        } catch (error) {
            this.logger.warn(`PrintMaster searchList error: ${error}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Fetch Print Master by ID' })
    @ApiCreatedResponse({ description: 'Fetch Print Master by ID', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('fetch/:PrintMasterSid')
    async fetchById(@Param('PrintMasterSid', ParseIntPipe) PrintMasterSid: number) {
        const resp = new ResponseData();
        try {
            resp.data = await this.printMasterService.fetchById(PrintMasterSid);
            resp.message = 'Print Master fetched successfully.';
        } catch (error) {
            this.logger.warn(`PrintMaster fetchById error: ${error}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Update Print Master' })
    @ApiCreatedResponse({ description: 'Update Print Master', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Patch('update/:PrintMasterSid')
    async update(
        @Param('PrintMasterSid', ParseIntPipe) PrintMasterSid: number,
        @Body() dto: UpdatePrintMasterDto
    ) {
        const resp = new ResponseData();
        try {
            resp.data = await this.printMasterService.update(PrintMasterSid, dto);
            resp.message = 'Print Master updated successfully.';
        } catch (error) {
            this.logger.warn(`PrintMaster update error: ${error}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message : 'Internal Server Error';
        }
        return resp;
    }

    @ApiOperation({ summary: 'Get Print Masters by Menu' })
    @ApiCreatedResponse({ description: 'Get Print Masters by Menu', type: ResponseData })
    @HttpCode(HttpStatus.OK)
    @Get('by-menu/:MenuMasterSid')
    async getByMenu(
        @Param('MenuMasterSid', ParseIntPipe) MenuMasterSid: number
    ) {
        const resp = new ResponseData();
        try {
            resp.data = await this.printMasterService.getByMenu(MenuMasterSid);
            resp.message = 'Print Masters fetched successfully.';
        } catch (error) {
            this.logger.warn(`PrintMaster getByMenu error: ${error}`);
            resp.status = false;
            resp.message = error instanceof BadRequestException || error instanceof UnauthorizedException
                ? error.message : 'Internal Server Error';
        }
        return resp;
    }
}
