import { UserService } from './../../masters/services/user.service';
import { BadRequestException, Body, Controller, Get, HttpCode, HttpException, HttpStatus, InternalServerErrorException, Logger, Param, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ResponseData } from '../../common/response-data';
import { AuthService } from './auth.service';
import { checkPassword, getClientIp } from 'src/common/helper';
import { LoginRequest } from '../dto/loginRequest.dto';
import { ApiBody, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtStrategy } from './jwt.strategy';
import { JwtService } from '@nestjs/jwt';
import { UserData } from 'src/common/decorators/user.decorator';
import { TokenPayload } from 'src/common/decorators/token-payload.decorator';
import { CreateUserDto } from '../dto/create-user.dto';
import { Auth } from 'src/common/decorators/auth.decorator';
import { PublicAccessTokenService, PublicAccessTokenError, PUBLIC_TOKEN_PURPOSES } from 'src/common/public-access-token/public-access-token.service';
import { TokenCleanupService } from './token-cleanup.service';

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
        private logger: Logger,
        private publicAccessTokenService: PublicAccessTokenService,
        private tokenCleanupService: TokenCleanupService,
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
                throw new BadRequestException('Email is required.');
            }

            const user: any = await this.userService.findUserById({ UserEmail: email });
            if (!user) {
                this.logger.warn(`Password reset requested for unregistered email - ${email}`);
                output.status = true;
                output.message = 'If the email is registered, a password reset link will be sent.';
                return output;
            }

            const origin = req.headers['origin'] || req.headers['referer'];
            const baseUrl = origin ? new URL(origin).origin : null;
            await this.authService.handleForgotPassword(email, user, baseUrl);

            output.status = true;
            output.message = 'If the email is registered, a password reset link will be sent.';
            this.logger.log(`forgotPassword: reset email sent to ${email}`);

        } catch (error) {
            this.logger.warn(`forgotPassword failed: Internal Server Error`);
            output.status = false;
            output.message = error.message || 'Internal Server Error';
        }
        return output;
    }



    @ApiOperation({ summary: 'Validate a password reset token without consuming it' })
    @Get('validate-reset-token/:token')
    async validateResetToken(@Param('token') token: string, @Req() req: any) {
        const output = new ResponseData();
        try {
            this.enforceRateLimit(
                this.getRateLimitKey('validate-reset-token', token.substring(0, 8), req),
                10,
                15 * 60 * 1000
            );

            const tokenRow = await this.publicAccessTokenService.findValidByPurpose(
                token,
                PUBLIC_TOKEN_PURPOSES.FORGOT_PASSWORD,
            );

            output.status = true;
            output.message = 'Token is valid';
            output.data = {
                email: tokenRow.SentToEmail,
                expiresAt: tokenRow.ExpiresAt,
            };
        } catch (error) {
            output.status = false;
            if (error instanceof PublicAccessTokenError) {
                output.message = error.code;
            } else {
                output.message = 'Internal Server Error';
            }
        }
        return output;
    }

    @ApiOperation({ summary: 'Reset user password using a public access token' })
    @ApiCreatedResponse({
        description: 'Password updated successfully',
        type: ResponseData
    })
    @Patch('reset-password/:token')
    async resetPassword(@Param('token') token: string, @Body() passwordData: any, @Req() req: any) {
        let output = new ResponseData();
        try {
            this.enforceRateLimit(
                this.getRateLimitKey('reset-password', token.substring(0, 8), req),
                5,
                15 * 60 * 1000
            );

            if (passwordData.confirmPassword !== passwordData.password) {
                throw new BadRequestException('Confirm Password does not match');
            }

            const userId = await this.authService.handleResetPassword(token, passwordData.password);
            this.failedLoginAttempts.delete(userId);

            output.status = true;
            output.message = 'Password updated successfully';
        } catch (error) {
            this.logger.warn(`resetPassword failed: ${error}`);
            output.status = false;
            if (error instanceof PublicAccessTokenError) {
                output.message = error.code;
            } else {
                output.message = error.message || 'Internal Server Error';
            }
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

    @ApiOperation({ summary: 'Manually clean up expired/used public access tokens' })
    @Post('cleanup-tokens')
    @Auth()
    @HttpCode(HttpStatus.OK)
    async cleanupTokens() {
        const output = new ResponseData();
        try {
            const count = await this.tokenCleanupService.handleTokenCleanup();
            output.status = true;
            output.message = `Cleaned up ${count} token(s)`;
            output.data = { deletedCount: count };
        } catch (error) {
            this.logger.error(`Manual token cleanup failed: ${error.message}`);
            output.status = false;
            output.message = 'Token cleanup failed';
        }
        return output;
    }
}
