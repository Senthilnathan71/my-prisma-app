import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Logger,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UnauthorizedException,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import {
    ApiAcceptedResponse,
    ApiBadRequestResponse,
    ApiCreatedResponse,
    ApiOkResponse,
    ApiOperation,
} from '@nestjs/swagger';
import { ResponseData } from 'src/common/response-data';
import { Auth } from 'src/common/decorators/auth.decorator';
import {
    ShipmentMilestoneCheckExistDTO,
    ShipmentMilestoneCreateDTO,
    ShipmentMilestoneFetchDTO,
    ShipmentMilestoneFetchWithCodeDTO,
    ShipmentMilestoneInsertByMasterJobDTO,
    ShipmentMilestoneSafeInsertDTO,
    ShipmentMilestoneUpdateDTO,
} from 'src/operation/DTO/shipment-milestone.dto';
import { ShipmentMilestoneService } from 'src/operation/services/shipment-milestone/shipment-milestone.service';

@Auth()
@Controller('shipment-milestone')
export class ShipmentMilestoneController {
    private readonly logger = new Logger(ShipmentMilestoneController.name);
    constructor(private shipmentMilestoneService: ShipmentMilestoneService) { }


    /**
     * Fetch Shipment Milestone by Shipment No
     */
    @ApiOperation({ summary: 'Fetch Shipment Milestone by Shipment No' })
    @ApiOkResponse({
        description: 'Shipment Milestone fetched successfully',
        type: ResponseData,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request payload',
    })
    @Post('fetch')
    @HttpCode(HttpStatus.OK)
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    )
    async getShipmentMilestoneByShipmentNo(
        @Body() payload: ShipmentMilestoneFetchDTO,
    ) {
        let response = new ResponseData();
        this.logger.log(
            `Fetching Shipment Milestone with Shipment No : ${payload.ShipmentNo}`,
        );
        try {
            const res =
                await this.shipmentMilestoneService.getShipmentMilestoneByShipmentNo(
                    payload,
                );
            this.logger.debug(`Fetched Shipment Milestone : ${JSON.stringify(res)}`);
            response.data = res;
            response.message = `Shipment Milestone with Shipment No : ${payload.ShipmentNo} is successfully fetched`;
        } catch (error) {
            this.logger.warn(
                `Shipment Milestone Fetch Error : ${JSON.stringify(error),error}`,
            );
            response.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response;
    }



    /**
     * Create Shipment Milestone
     */
    @ApiOperation({ summary: 'Create Shipment Milestone' })
    @ApiCreatedResponse({
        description: 'Shipment Milestone created successfully',
        type: ResponseData,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request payload',
    })
    @Post('create')
    @HttpCode(HttpStatus.OK)
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    )
    async createShipmentMilestone(@Body() payload: ShipmentMilestoneCreateDTO) {
        let response = new ResponseData();
        this.logger.log(
            `Creating Shipment Milestone for Shipment No : ${payload.ShipmentNo}`,
        );
        try {
            const res =
                await this.shipmentMilestoneService.createShipmentMilestone(payload);
            this.logger.debug(`Created Shipment Milestone : ${JSON.stringify(res)}`);
            response.data = res;
            response.message = `Shipment Milestone with Shipment No : ${payload.ShipmentNo} is successfully created`;
        } catch (error) {
            this.logger.warn(
                `Shipment Milestone Creation Error : ${JSON.stringify(error),error}`,
            );
            response.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response;
    }


    /**
     * Update Shipment Milestone
     */
    @ApiOperation({ summary: 'Update Shipment Milestone' })
    @ApiAcceptedResponse({
        description: 'Shipment Milestone updated successfully',
        type: ResponseData,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request payload',
    })
    @Patch('update/:ShipmentMilestoneSid')
    @HttpCode(HttpStatus.OK)
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    )
    async updateShipmentMilestone(
        @Param('ShipmentMilestoneSid', ParseIntPipe) ShipmentMilestoneSid: number,
        @Body() payload: ShipmentMilestoneUpdateDTO,
    ) {
        let response = new ResponseData();
        this.logger.log(
            `Updating Shipment Milestone with Shipment Milestone Sid : ${ShipmentMilestoneSid}`,
        );
        try {
            const res = await this.shipmentMilestoneService.updateShipmentMilestone(
                ShipmentMilestoneSid,
                payload,
            );
            this.logger.debug(`Updated Shipment Milestone : ${JSON.stringify(res)}`);
            response.data = res;
            response.message = `Shipment Milestone with Shipment Milestone Sid : ${ShipmentMilestoneSid} is successfully updated`;
        } catch (error) {
            this.logger.warn(
                `Shipment Milestone Updation Error : ${JSON.stringify(error),error}`,
            );
            response.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response;
    }


    /**
     * Get Milestone by Code
     */
    @ApiOperation({ summary: 'Get Milestone by Code' })
    @ApiOkResponse({
        description: 'Milestone by Code',
        type: ResponseData,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request payload',
    })
    @Post('fetch-by-code')
    @HttpCode(HttpStatus.OK)
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    )
    async getMilestoneByCode(
        @Body() payload: ShipmentMilestoneFetchWithCodeDTO,
    ) {
        let response = new ResponseData();
        this.logger.log(
            `Getting Milestone with code : ${payload.MilestoneCode}`,
        );
        try {
            const res =
                await this.shipmentMilestoneService.getMilestoneByCode(
                    payload,
                );
            this.logger.debug(`Fetched Milestone : ${JSON.stringify(res)}`);
            response.data = res;
            response.message = `Milestone with code : ${payload.MilestoneCode} is successfully fetched`;
        } catch (error) {
            this.logger.warn(
                `Milestone Fetch Error : ${JSON.stringify(error),error}`,
            );
            response.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response;
    }


    /**
     *  Check if Shipment Milestone already exist
     */
    @ApiOperation({ summary: 'Check if Shipment Milestone already exist' })
    @ApiOkResponse({
        description: 'Shipment Milestone already exist',
        type: ResponseData,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request payload',
    })
    @HttpCode(HttpStatus.OK)
    @Post('check-existence')
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    )
    async checkIfAlreadyShipmentMilestoneExist(
        @Body() payload: ShipmentMilestoneCheckExistDTO,
    ) {
        let response = new ResponseData();
        this.logger.log(`Checking if Shipment Milestone already exist`);
        try {
            const res =
                await this.shipmentMilestoneService.checkIfAlreadyShipmentMilestoneExist(
                    payload,
                );
            this.logger.debug(
                `Checked if Shipment Milestone already exist : ${JSON.stringify(res)}`,
            );
            response.data = res;
            response.message = `Shipment Milestone already exists`;
        } catch (error) {
            this.logger.warn(
                `Shipment Milestone Check Error : ${JSON.stringify(error),error}`,
            );
            response.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response;
    }


    /**
     *  Delete Shipment Milestone
     */
    @ApiOperation({ summary: 'Delete Shipment Milestone' })
    @ApiCreatedResponse({
        description: 'Shipment Milestone deleted successfully',
        type: ResponseData,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request payload',
    })
    @HttpCode(HttpStatus.OK)
    @Delete('delete/:ShipmentMilestoneSid')
    async deleteShipmentMilestone(
        @Param('ShipmentMilestoneSid', ParseIntPipe) ShipmentMilestoneSid: number,
    ) {
        let response = new ResponseData();
        this.logger.log(
            `Deleting Shipment Milestone with Shipment Milestone Sid : ${ShipmentMilestoneSid}`,
        );
        try {
            const res = await this.shipmentMilestoneService.deleteShipmentMilestone(
                ShipmentMilestoneSid,
            );
            this.logger.debug(`Deleted Shipment Milestone : ${JSON.stringify(res)}`);
            response.data = res;
            response.message = `Shipment Milestone with Shipment Milestone Sid : ${ShipmentMilestoneSid} is successfully deleted`;
        } catch (error) {
            this.logger.warn(
                `Shipment Milestone Deletion Error : ${JSON.stringify(error),error}`,
            );
            response.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response;
    }


    /**
     * Safe Insert Shipment Milestone
     */
    @ApiOperation({ summary: 'Safe Insert Shipment Milestone' })
    @ApiCreatedResponse({
        description: 'Shipment Milestone inserted successfully',
        type: ResponseData,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request payload',
    })
    @HttpCode(HttpStatus.OK)
    @Post('safe-insert')
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    )
    async safeInsertShipmentMilestone(
        @Body() payload: ShipmentMilestoneSafeInsertDTO,
    ) {
        let response = new ResponseData();
        this.logger.log(`Safe Inserting Shipment Milestone`);
        try {
            const res =
                await this.shipmentMilestoneService.safeInsertShipmentMilestone(
                    payload
                );
            this.logger.debug(
                `SAfe Inserted Shipment Milestone : ${JSON.stringify(res)}`,
            );
            response.data = res;
            response.message = `Shipment Milestone with \nMilestone Code : ${payload.MilestoneCode} is successfully inserted for \nShipment No : ${payload.ShipmentNo}`;
        } catch (error) {
            this.logger.warn(
                `Shipment Milestone Safe Insert Error : ${JSON.stringify(error),error}`,
            );
            response.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response;
    }

    /**
     * Insert Shipment Milestone for all House Jobs under Master Job
     */
    @ApiOperation({ summary: 'Insert milestone for all house jobs under a master job' })
    @ApiCreatedResponse({
        description: 'Shipment milestones inserted successfully',
        type: ResponseData,
    })
    @ApiBadRequestResponse({
        description: 'Invalid request payload',
    })
    @HttpCode(HttpStatus.OK)
    @Post('insert-by-master-job')
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
        }),
    )
    async insertMilestoneByMasterJob(
        @Body() payload: ShipmentMilestoneInsertByMasterJobDTO,
    ) {
        let response = new ResponseData();
        this.logger.log(`Inserting Shipment Milestone by Master Job : ${payload.MasterJobSid}`);
        try {
            const res = await this.shipmentMilestoneService.insertMilestoneByMasterJob(payload);
            this.logger.debug(`Inserted milestones by master job : ${JSON.stringify(res)}`);
            response.data = res;
            response.message = `Milestone ${payload.MilestoneCode} processed for MasterJobSid ${payload.MasterJobSid}`;
        } catch (error) {
            this.logger.warn(
                `Shipment Milestone Insert By Master Job Error : ${JSON.stringify(error),error}`,
            );
            response.status = false;
            if (
                error instanceof BadRequestException ||
                error instanceof UnauthorizedException
            ) {
                response.message = error.message;
            } else {
                response.message = 'Internal Server Error';
            }
        }
        return response;
    }
}
