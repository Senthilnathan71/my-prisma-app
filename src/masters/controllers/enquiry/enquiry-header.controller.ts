import { BadRequestException, Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { Auth } from "src/common/decorators/auth.decorator";
import { UserData } from "src/common/decorators/user.decorator";
import { ResponseData } from "src/common/response-data";
import { EnquiryHeaderService } from "src/masters/services/enquiry/enquiry-header.service";

@Controller('enquiry')
@Auth()
export class EnquiryHeaderController {
    constructor(private enquiryHeaderService: EnquiryHeaderService) { }

    @Post()
    async createEnquiryHeader(@Body() body: any, @UserData() user: any) {
        let output = new ResponseData
        try {
            let enquiry = await this.enquiryHeaderService.createEnquiry(body, user);
            if (!enquiry) {
                throw 'Something went wrong'
            }
            output.data = enquiry.data;
            output.message = enquiry.message;
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



}