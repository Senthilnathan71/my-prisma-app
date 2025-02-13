import { BadRequestException, Controller, Get, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { PrecustomerService } from 'src/masters/services/precustomer/precustomer.service';

@Controller('precustomer')
@Auth()
export class PrecustomerController {

    constructor( private precustomerSer : PrecustomerService){}

    @Get()
    async getAllPrecustomer(@UserData() UserData : any){
        const output = new ResponseData
        try {
            const customers = await this.precustomerSer.getAllPrecustomer(UserData.userBranch[0])
            console.log("customer",customers);
            output.data = customers;
        } catch (error) {
            console.log("controler error::", error);
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }
}


