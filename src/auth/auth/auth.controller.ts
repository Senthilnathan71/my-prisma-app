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
    private readonly maxLoginAttempts = 3;
    private readonly loginLockMinutes = 10;
    private readonly failedLoginAttempts = new Map<number, { count: number; lastFailedAt: number }>();
    private readonly rateLimitStore = new Map<string, { count: number; resetAt: number }>();

    constructor(
        private authService: AuthService,
        private readonly jwtService: JwtService,
        private userService: UserService,
        private emailService: EmailService,
        private configService: ConfigService,
        private logger: Logger
    ) { }

    private getRateLimitKey(prefix: string, identifier: string, req: any): string {
        return `${prefix}:${identifier || 'unknown'}:${getClientIp(req)}`;
    }

    private enforceRateLimit(key: string, maxRequests: number, windowMs: number): void {
        const now = Date.now();
        const current = this.rateLimitStore.get(key);

        if (!current || current.resetAt <= now) {
            this.rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
            return;
        }

        if (current.count >= maxRequests) {
            const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
            throw new HttpException(
                `Too many requests. Please try again after ${retryAfterSeconds} seconds.`,
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        current.count += 1;
    }

    private normalizeForgotPasswordEmail(loginData: any): string {
        const rawEmail = typeof loginData?.email === 'object'
            ? loginData.email?.email
            : loginData?.email;

        return typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    }

    private getRemainingLockMinutes(attemptDateTime: Date): number {
        const lockEndsAt = attemptDateTime.getTime() + this.loginLockMinutes * 60 * 1000;
        return Math.max(0, Math.ceil((lockEndsAt - Date.now()) / 60000));
    }


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

            const attemptDateTime = await this.authService.getAttemptDateTime(user.UserMasterSid);
            if (attemptDateTime) {
                const remainingMinutes = this.getRemainingLockMinutes(attemptDateTime);
                if (remainingMinutes > 0) {
                    throw new UnauthorizedException(
                        `Account temporarily locked. Please try again after ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`
                    );
                }

                await this.authService.updateAttemptDateTime(user.UserMasterSid, null);
                this.failedLoginAttempts.delete(user.UserMasterSid);
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
                const currentAttempts = this.failedLoginAttempts.get(user.UserMasterSid)?.count ?? 0;
                const nextAttempts = currentAttempts + 1;

                if (nextAttempts >= this.maxLoginAttempts) {
                    await this.authService.updateAttemptDateTime(user.UserMasterSid, new Date());
                    this.failedLoginAttempts.delete(user.UserMasterSid);
                    this.logger.warn(`Login locked after repeated incorrect passwords - ${loginData.email}`);
                    throw new UnauthorizedException('Account temporarily locked. Please try again after 10 minutes.');
                }

                this.failedLoginAttempts.set(user.UserMasterSid, {
                    count: nextAttempts,
                    lastFailedAt: Date.now()
                });

                const remainingAttempts = this.maxLoginAttempts - nextAttempts;
                this.logger.warn(`Login failed: Incorrect password - ${loginData.email}`);
                throw new UnauthorizedException(`Invalid password. ${remainingAttempts} attempts remaining.`);
            }

            this.failedLoginAttempts.delete(user.UserMasterSid);
            await this.authService.updateAttemptDateTime(user.UserMasterSid, null);

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
    async forgotPassword(@Body() loginData: any, @Req() req: any) {
        let output = new ResponseData();
        try {
            const email = this.normalizeForgotPasswordEmail(loginData);
            this.enforceRateLimit(
                this.getRateLimitKey('forgot-password', email, req),
                3,
                15 * 60 * 1000
            );

            if (!email) {
                this.logger.warn(`forgotPassword failed: Email is required`);
                throw new BadRequestException('Email are required.');
            }

            const user: any = await this.userService.findUserById({ UserEmail: email });
            if (!user) {
                this.logger.warn(`Password reset requested for unregistered email - ${email}`);
                output.status = true;
                output.message = 'If the email is registered, a password reset link will be sent.';
                return output;
            }
            const token = this.jwtService.sign(
                { userId: user.UserMasterSid },
                { expiresIn: '1h' }
            )

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
            output.message = 'If the email is registered, a password reset link will be sent.';
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
    async resetPassword(@Body() passwordData: any, @TokenPayload() tokenPayload, @Req() req: any) {
        let output = new ResponseData();
        this.logger.log(`resetPassword: Token payload ${tokenPayload}`)
        try {
            this.enforceRateLimit(
                this.getRateLimitKey('reset-password', String(tokenPayload?.userId ?? 'no-token'), req),
                5,
                15 * 60 * 1000
            );

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

            await this.authService.updateAttemptDateTime(tokenPayload.userId, null);
            this.failedLoginAttempts.delete(tokenPayload.userId);

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
