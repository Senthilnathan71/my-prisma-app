import { jwtConstants } from './constants';
import { UserService } from './../../masters/services/user.service';
import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, HttpStatus, InternalServerErrorException, Logger, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ResponseData } from '../../common/response-data';
import { AuthService } from './auth.service';
import { checkPassword, encodePassword, getClientIp } from 'src/common/helper';
import { LoginRequest } from '../dto/loginRequest.dto';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtStrategy } from './jwt.strategy';
import { JwtService } from '@nestjs/jwt';
import { UserData } from 'src/common/decorators/user.decorator';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/email/email.service';
import { TokenPayload } from 'src/common/decorators/token-payload.decorator';
import { CreateUserDto } from '../dto/create-user.dto';
import { Auth } from 'src/common/decorators/auth.decorator';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {

    constructor(
        private authService: AuthService,
        private readonly jwtService: JwtService,
        private userService: UserService,
        private emailService: EmailService,
        private configService: ConfigService,
        private logger: Logger
    ) { }


    @ApiOperation({ summary: 'Login' })
    @ApiBody({ type: LoginRequest })
    @ApiCreatedResponse({
        description: 'User logged in successfully',
        type: ResponseData
    })
    @Post('login')
    @HttpCode(HttpStatus.OK) // ensure success returns 200 instead of 201
    async login(@Body() loginData: LoginRequest, @Req() req: any) {
        let output = new ResponseData();

        try {
            if (!loginData.email || !loginData.password) {
                this.logger.warn('Login attempt with missing email or password');
                throw new BadRequestException('Email and password are required.');
            }

            this.logger.log(`Attempting login for email: ${loginData.email}`);
            const user = await this.authService.login({ UserEmail: loginData.email });

            if (!user) {
                this.logger.warn(`Login failed: User does not exist - ${loginData.email}`);
                throw new UnauthorizedException('User does not exist.');
            }

            // Salesperson logic
            const isSalesperson = String(user.isSalesperson) === '1';
            // if (loginData.projectType === 'freight-forwarding' && isSalesperson) {
            //     throw new UnauthorizedException('Salesperson not allowed in this app.');
            // }
            if (loginData.projectType === 'salesperson' && !isSalesperson) {
                throw new UnauthorizedException('Only salesperson can log in to this app.');
            }

            const isPasswordMatching = checkPassword(loginData.password, user.userPassword);
            if (!isPasswordMatching) {
                this.logger.warn(`Login failed: Incorrect password - ${loginData.email}`);
                throw new UnauthorizedException('Incorrect password.');
            }

            // Session restriction: check if user is already logged in elsewhere
            const existingSession = await this.authService.getActiveSession(user.UserMasterSid);

            if (existingSession && !loginData.forceLogin && loginData.projectType !== 'crm') {
                const staleThreshold = 3 * 60 * 60 * 1000; // 3 hours
                const isStale = (Date.now() - existingSession.lastActivity.getTime()) > staleThreshold;

                if (!isStale) {
                    output.status = false;
                    output.message = 'SESSION_ACTIVE_ELSEWHERE';
                    output.data = {
                        activeSessionInfo: {
                            ipAddress: existingSession.ipAddress,
                            location: existingSession.location,
                            loginTime: existingSession.createdOn
                        }
                    };
                    return output;
                }
            }

            // Create session token and embed in JWT
            const ipAddress = getClientIp(req);
            const userAgent = req.headers['user-agent'] || 'Unknown';
            const sessionToken = await this.authService.createSession(
                user.UserMasterSid,
                ipAddress,
                userAgent,
                loginData.location
            );

            // Successful login — populate ResponseData
            output.status = true;
            output.message = 'Login successful';
            output.data = {
                user: await this.authService.getUser(user.UserMasterSid),
                token: await this.jwtService.sign(
                    { id: user.UserMasterSid, projectType: loginData.projectType, sessionToken },
                    { expiresIn: '3h' }
                )
            };

            this.logger.log(`Login successful for email: ${loginData.email}`);
            await this.authService.userHistory(user, loginData, req);

            return output; // HTTP 200
        } catch (error) {
            this.logger.error(`Login error for email: ${loginData.email || 'unknown'} - ${error.message}`);

            // Rethrow NestJS exceptions to return proper HTTP status codes
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }

            // For unexpected errors
            throw new InternalServerErrorException(error.message || 'Internal Server Error');
        }
    }

    @ApiOperation({ summary: 'Forgot Password and send a reset password link to the user email' })
    @ApiCreatedResponse({
        description: 'User data',
        type: ResponseData
    })
    @Post('forgot-password')
    async forgotPassword(@Body() loginData: any) {
        let output = new ResponseData();
        try {
            if (!loginData.email) {
                this.logger.warn(`forgotPassword failed: Email are required - ${loginData.email}`);
                throw new BadRequestException('Email are required.');
            }

            const user: any = await this.userService.findUserById({ UserEmail: loginData.email.email });
            if (!user) {
                this.logger.warn(`The email address provided is not registered. - ${loginData.email.email}`);
                throw new BadRequestException('The email address provided is not registered.');
            }
            const token = this.jwtService.sign({
                userId: user.UserMasterSid,
                secret: jwtConstants.secret, expires: '1hr'
            })

            // const resetPasswordLink = `${this.configService.get('WEB_URL')}auth/reset-password?token=${token}`
            const resetPasswordLink = `https://app.dofi.co/auth/reset-password?token=${token}`

            const emailSent = await this.emailService.sendForgotPasswordMail({
                email: user.userEmail,
                id: user.UserMasterSid,
                subject: `Hello ${user.userName}, Reset Your Password for CRM`,
                html: `
                    <p>Hello <strong>${user.userName}</strong>,</p>
                
                    <p>We received a request to reset the password for your <span style="color: #2e477c;">CRM</span> account. You can reset your password by clicking the link below:</p>
                
                    <p><a href="${resetPasswordLink}" style="color: #FD8024;">Reset Password</a></p>
                
                    <p>Please note that this link will expire in 1 hour. If you did not request a password reset, please ignore this email or contact our support team.</p>
                
                    <br />
                
                    <p>Thank you,</p>
                
                    <p>The <span style="color: #2e477c;">CRM</span> Team</p>
                `
            })

            if (!emailSent) {
                this.logger.warn(`Failed to send password reset email`);
                throw 'Failed to send password reset email'
            }

            output.status = true;
            output.message = 'Password reset email sent successful';
            output.data = {
                email: user.email,
                resetLink: resetPasswordLink
            };
            this.logger.log(`forgotPassword: ${output.data}`);

        } catch (error) {
            this.logger.warn(`forgotPassword failed: Internal Server Error`);
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
        this.logger.log(`resetPassword: Token payload ${tokenPayload}`)
        try {
            if (!tokenPayload) {
                this.logger.warn(`resetPassword failed: No token provided - ${tokenPayload}`);
                throw new UnauthorizedException('No token provided');
            }

            const user: any = await this.userService.getUserById(tokenPayload.userId);

            if (passwordData.confirmPassword !== passwordData.password) {
                this.logger.warn(`resetPassword failed: Confirm Password does not match - ${passwordData.confirmPassword}`);
                throw new BadRequestException('Confirm Password does not match')
            }

            const newPassword = passwordData.password

            const result = await this.userService.updatePassword(
                tokenPayload.userId,
                newPassword
            )

            this.logger.log(`resetPassword: result ${JSON.stringify(result)}`)


            if (result instanceof HttpException) {
                throw result
            }

            output.status = true;
            output.message = 'Password update Successfully';
            output.data = result

        } catch (error) {
            this.logger.warn(`resetPassword failed: Internal Server Error - ${error}`);
            output.status = false;
            output.message = error.message || 'Internal Server Error';
        }
        return output;
    }


    @Get('country')
    async getCountries() {
        return this.userService.getAllCountries()
            .then(data => ({ data }))
            .catch(() => ({ message: "Countries not found" }));
    }


    @Post('user/create')
    async createUser(@Body() createUserDto: CreateUserDto) {
        const output = new ResponseData();
        try {
            const user = await this.userService.signUp(createUserDto)
            if (user instanceof HttpException) {
                this.logger.warn(`createUser failed: ${user}`);
                throw user
            }
            output.status = true;
            output.message = 'User Created Successfully';
            output.data = user
            this.logger.log(`createUser: user Creation ${JSON.stringify(user)}`)

        } catch (error) {
            this.logger.warn(`createUser failed: ${error}`);
            output.status = false;
            output.message = error.message || 'Internal Server Error';
        }
        return output
    }


    @ApiOperation({ summary: 'Check if current session is still valid (heartbeat)' })
    @Get('session/heartbeat')
    @Auth()
    async sessionHeartbeat(@UserData() user: any, @TokenPayload() tokenPayload: any) {
        const output = new ResponseData();
        try {
            const sessionToken = tokenPayload?.sessionToken;
            if (!sessionToken) {
                // Legacy token without sessionToken — allow for backward compatibility
                output.status = true;
                output.message = 'LEGACY_TOKEN';
                return output;
            }

            const isValid = await this.authService.validateSessionToken(user.UserMasterSid, sessionToken);

            if (!isValid) {
                output.status = false;
                output.message = 'SESSION_INVALIDATED';
                return output;
            }

            // Session is valid — update lastActivity
            await this.authService.touchSession(user.UserMasterSid);
            output.status = true;
            output.message = 'SESSION_VALID';
        } catch (error) {
            this.logger.error(`Session heartbeat error: ${error.message}`);
            output.status = false;
            output.message = 'SESSION_CHECK_FAILED';
        }
        return output;
    }


    @ApiOperation({ summary: 'Explicit logout — invalidate session' })
    @Post('logout')
    @Auth()
    @HttpCode(HttpStatus.OK)
    async logout(@UserData() user: any) {
        const output = new ResponseData();
        try {
            await this.authService.invalidateSession(user.UserMasterSid);
            output.status = true;
            output.message = 'Logged out successfully';
        } catch (error) {
            this.logger.error(`Logout error: ${error.message}`);
            output.status = false;
            output.message = 'Logout failed';
        }
        return output;
    }
}
