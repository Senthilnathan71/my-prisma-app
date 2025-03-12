import { jwtConstants } from './constants';
import { UserService } from './../../masters/services/user.service';
import { BadRequestException, Body, Controller, Get, HttpException, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ResponseData } from '../../common/response-data';
import { AuthService } from './auth.service';
import { checkPassword, encodePassword } from 'src/common/helper';
import { LoginRequest } from '../dto/loginRequest.dto';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtStrategy } from './jwt.strategy';
import { JwtService } from '@nestjs/jwt';
import { UserData } from 'src/common/decorators/user.decorator';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/email/email.service';
import { TokenPayload } from 'src/common/decorators/token-payload.decorator';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private readonly jwtService: JwtService,
        private userService: UserService,
        private emailService: EmailService,
        private configService: ConfigService
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


    @ApiOperation({ summary: 'Forgot Password and send a reset password link to the user email' })
    @ApiCreatedResponse({
        description: 'User data',
        type: ResponseData
    })
    @Post('forgot-password')
    async forgotPassword(@Body() loginData: any) {
        console.log(loginData)
        let output = new ResponseData();
        try {
            if (!loginData.email) {
                throw new BadRequestException('Email are required.');
            }

            const user: any = await this.userService.findUserById({ UserEmail: loginData.email.email });
            const token = this.jwtService.sign({
                userId: user.id,
                secret: jwtConstants.secret, expires: '1hr'
            })

            const resetPasswordLink = `${this.configService.get('WEB_URL')}reset-password?token=${token}`

            const emailSent = await this.emailService.sendForgotPasswordMail({
                email: user.email,
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                link: resetPasswordLink
            })

            if (!emailSent) {
                throw 'Failed to send password reset email'
            }

            output.status = true;
            output.message = 'Password reset email sent successful';
            output.data = {
                email: user.email,
                resetLink: resetPasswordLink
            };

        } catch (error) {
            console.error("Login error:", error);

            output.status = false;
            output.message = error.message || 'Internal Server Error';
        }
        return output;
    }



    @ApiOperation({ summary: 'Reset user password by id' })
    @ApiCreatedResponse({
        description: 'User data',
        type: ResponseData
    })
    @Patch('reset-password')
    async resetPassword(@Body() passwordData: any, @TokenPayload() tokenPayload) {
        let output = new ResponseData();
        try {
            if (!tokenPayload) {
                throw new UnauthorizedException('No token provided');
            }

            const user: any = await this.userService.getUserById(tokenPayload.id);

            if (passwordData.confirmPassword !== passwordData.password) {
                throw new BadRequestException('Confirm Password does not match')
            }

            const newPassword = passwordData.password

            const result = await this.userService.updatePassword(
                tokenPayload.userId,
                newPassword
            )

            if (result instanceof HttpException) {
                throw result
            }

            output.status = true;
            output.message = 'Password update Successfully';
            output.data = result

        } catch (error) {
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
