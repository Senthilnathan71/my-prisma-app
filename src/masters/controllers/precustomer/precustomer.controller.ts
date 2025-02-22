import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Put, UnauthorizedException } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';
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

    @Get(':id')
    async getPrecustomerById(@Param('id',ParseIntPipe)PreCustomerMasterSid:number){
        const  output = new ResponseData;
        try {
           output.data =await this.precustomerSer.findOne(PreCustomerMasterSid)
        } catch (error) {
           output.status = false;
           output.message = error
        }
        return output;
    }

    @Put()
    async createPrecustomer(@Body() body : CreatePrecustomerDto, @UserData() user :any){
        let output = new ResponseData
        try {
            let preCustomer = await this.precustomerSer.createPrecustomer(body,user);
            if(!preCustomer){
                throw 'Something went wrong'
            }
            output.data = preCustomer.data;
            output.message = preCustomer.message;
            output.status = true
            
        } catch (error) {
            console.log("controler error::", error);
            output.status = false;
            // Handle error message based on the type of error
            if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
                output.message = error.message;
            } else {
                output.message = error;
            }
        }
        return output
    }



    @Get('pendingMeetings')
    async getPendingMeetings(@UserData() UserData : any){
        const output = new ResponseData
        try {
            const customers = await this.precustomerSer.getPreCustomerMastersWithoutMeetings()
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


