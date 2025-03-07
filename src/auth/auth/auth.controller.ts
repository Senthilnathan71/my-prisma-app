import { BadRequestException, Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ResponseData } from '../../common/response-data';
import { AuthService } from './auth.service';
import { checkPassword, encodePassword } from 'src/common/helper';
import { LoginRequest } from '../dto/loginRequest.dto';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtStrategy } from './jwt.strategy';
import { JwtService } from '@nestjs/jwt';
import { UserData } from 'src/common/decorators/user.decorator';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private readonly jwtService: JwtService
    ) { }

    @ApiOperation({ summary: 'Login' })
    @ApiBody({ type: LoginRequest })
    @ApiCreatedResponse({
        description: 'User data',
        type: ResponseData
    })
    // @Post('login')
    // async login(@Body() loginData: LoginRequest){
    //     let output = new ResponseData;
    //     try {
    //         const user = await this.authService.login({UserEmail: loginData.email})
    //         if(!user){
    //             throw 'User does not exit'
    //         }

    //         const isPasswordMatching = checkPassword(
    //             loginData.password,
    //             user.userPassword
    //         )

    //         if(!isPasswordMatching){
    //             throw 'Incorrect password'
    //         }

    //         output.data.user = await this.authService.getUser(user.UserMasterSid);
    //         output.data.token = await this.jwtService.sign({id:user.UserMasterSid});
    //         console.log("token::",  output.data.token);
    //     } catch (error) {
    //         console.log("controler error::", error);
    //         output.status = false;
    //         // Handle error message based on the type of error
    //         // if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
    //         //     output.message = error.message;
    //         // } else {
    //         //     output.message = 'Internal Server Error';
    //         // }

    //     }
    //     return output;
    // }




    @Post('login')
    async login(@Body() loginData: LoginRequest) {
        let output = new ResponseData();
        try {
            if (!loginData.email || !loginData.password) {
                throw new BadRequestException('Email and password are required.');
            }

            const user = await this.authService.login({ UserEmail: loginData.email });
            if (!user) {
                throw new UnauthorizedException('User does not exist.');
            }

            const isPasswordMatching = checkPassword(loginData.password, user.userPassword);
            if (!isPasswordMatching) {
                throw new UnauthorizedException('Incorrect password.');
            }

            output.status = true;
            output.message = 'Login successful';
            output.data = {
                user: await this.authService.getUser(user.UserMasterSid),
                token: await this.jwtService.sign({ id: user.UserMasterSid })
            };

        } catch (error) {
            console.error("Login error:", error);

            output.status = false;
            output.message = error.message || 'Internal Server Error';
        }
        return output;
    }


    @Get('test')
    async generateHashPassword() {
        return encodePassword('admin@123')
    }
}
