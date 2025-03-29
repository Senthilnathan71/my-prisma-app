import { Controller, Get, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { UserService } from 'src/masters/services/user.service';

@Controller('user')
@Auth()
export class UserController {

    constructor(private userService: UserService,
        private logger: Logger
    ) { }

    @ApiOperation({ summary: 'Get user Token from data' })
    @ApiCreatedResponse({
        description: 'Get user token from data',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('sign-in-token')
    async getUserByToken(@UserData() user: any): Promise<any> {

        const output = new ResponseData();
        try {
            const result = user;
            this.logger.debug(`getUserByToken: ${JSON.stringify(result)}`)
            output.data = result
        } catch (error) {
            this.logger.warn(`getUserByToken: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = typeof error == 'string' ? error : ''
        }
        return output;
    }



    @ApiOperation({ summary: 'Get salesperson' })
    @ApiCreatedResponse({
        description: 'Get salesperson',
        type: ResponseData
    })
    @HttpCode(HttpStatus.OK)
    @Get('salesperson')
    async getSalesPerson(@UserData() user: any): Promise<any> {
        const output = new ResponseData();
        try {
            const salesPerson = await this.userService.getSalesPerson();
            this.logger.debug(`getSalesPerson: ${JSON.stringify(salesPerson)}`)
            output.data = salesPerson
        } catch (error) {
            this.logger.debug(`getSalesPerson: ${JSON.stringify(error)}`)
            output.status = false;
            output.message = typeof error == 'string' ? error : ''
        }
        return output
    }
}
