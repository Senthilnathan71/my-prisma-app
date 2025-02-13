import { Controller, Get } from '@nestjs/common';
import { Auth } from 'src/common/decorators/auth.decorator';
import { UserData } from 'src/common/decorators/user.decorator';
import { ResponseData } from 'src/common/response-data';

@Controller('user')
@Auth()
export class UserController {
    
    constructor(){}

    @Get('sign-in-token')
    async getUserByToken(@UserData() user :any): Promise<any>{
        console.log("controller-user",user)
        const output = new ResponseData();
        try {
            output.data = user;
        } catch (error) {
            output.status = false;
            output.message = typeof error == 'string' ? error : ''
        }
        return output;
    }
}
