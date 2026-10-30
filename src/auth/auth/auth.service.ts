import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encodePassword, getClientIp } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { EmailService } from 'src/email/email.service';
import { PublicAccessTokenService, PublicAccessTokenError, PUBLIC_TOKEN_PURPOSES } from 'src/common/public-access-token/public-access-token.service';
import { UserService } from 'src/masters/services/user.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
    loggedInUserData: any = {};
    constructor(
        private readonly userService: UserService,
        private readonly db: DatabaseService,
        private readonly logger: Logger,
        private readonly configService: ConfigService,
        private readonly emailService: EmailService,
        private readonly publicAccessTokenService: PublicAccessTokenService,
    ) {

    }

    async login(where: any): Promise<any> {
        return await this.userService.findUserById(where)
    }

    async getAttemptDateTime(userId: number): Promise<Date | null> {
        const rows = await this.db.$queryRaw<{ AttemptDateTime: Date | null }[]>`
            SELECT "AttemptDateTime"
            FROM "UserMaster"
            WHERE "UserMasterSid" = ${userId}
            LIMIT 1
        `;

        return rows[0]?.AttemptDateTime ?? null;
    }

    async updateAttemptDateTime(userId: number, attemptDateTime: Date | null): Promise<void> {
        await this.db.$executeRaw`
            UPDATE "UserMaster"
            SET "AttemptDateTime" = ${attemptDateTime}
            WHERE "UserMasterSid" = ${userId}
        `;
    }

    async getUser(userId: number) {
        try {
            const userData = await this.userService.getUserById(userId);

            return userData
        } catch (error) {
            throw error;
        }
    }



    async userHistory(user, loginData, req) {
  let ipAddress = getClientIp(req);

  if (ipAddress === '::1' || ipAddress === '127.0.0.1') {
    // Fetch public IP for local dev
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      ipAddress = data.ip;
    } catch (err) {
        throw err
    }
  }

  await this.db.userLoginHistory.create({
    data: {
      userId: user.UserMasterSid,
      ipAddress: ipAddress,
      location: loginData.location || 'Unknown',
      createdOn: new Date()
    }
  });
}

    // ==================== Session Management ====================

    async getActiveSession(userId: number) {
        return this.db.activeSession.findFirst({
            where: { userId },
            orderBy: { createdOn: 'desc' }
        });
    }

    async createSession(userId: number, ipAddress?: string, userAgent?: string, location?: string): Promise<string> {
        const sessionToken = crypto.randomUUID();

        await this.db.activeSession.create({
            data: {
                userId,
                sessionToken,
                ipAddress,
                userAgent,
                location,
                createdOn: new Date(),
                lastActivity: new Date()
            }
        });

        return sessionToken;
    }

    async invalidateSession(userId: number): Promise<void> {
        await this.db.activeSession.deleteMany({
            where: { userId }
        });
    }

    async validateSessionToken(userId: number, sessionToken: string): Promise<boolean> {
        const session = await this.db.activeSession.findFirst({
            where: {
                userId,
                sessionToken,
            }
        });

        return !!session;
    }

    async touchSession(userId: number, sessionToken?: string): Promise<void> {
        await this.db.activeSession.updateMany({
            where: {
                userId,
                ...(sessionToken ? { sessionToken } : {}),
            },
            data: { lastActivity: new Date() }
        });
    }

    async cleanupStaleSessions(staleThresholdMinutes: number = 180): Promise<number> {
        const threshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
        const result = await this.db.activeSession.deleteMany({
            where: {
                lastActivity: { lt: threshold }
            }
        });
        return result.count;
    }

    // ==================== Forgot / Reset Password ====================

    async handleForgotPassword(email: string, user: any, origin: string | null): Promise<void> {
        const ttlMinutes = Number(this.configService.get('RESET_PASSWORD_TOKEN_TTL_MINUTES') || 10);

        const { token } = await this.publicAccessTokenService.issueByPurpose({
            purpose: PUBLIC_TOKEN_PURPOSES.FORGOT_PASSWORD,
            resourceSid: user.UserMasterSid,
            ttlMinutes,
            sentToEmail: email,
            createdBy: 'FORGOT_PASSWORD',
        });

        const baseUrl = origin || 'https://blufin.dofi.co';
        const resetPasswordLink = `${baseUrl}/public/reset-password/${token}`;
        const currentYear = new Date().getFullYear();

        const emailSent = await this.emailService.sendForgotPasswordMail({
            email: user.userEmail,
            id: user.UserMasterSid,
            subject: 'Reset Your Password - blufin',
            html: `
<div style="background:#fff;padding:16px 20px;border-bottom:1px solid #e5e7eb;">
  <div style="display:flex;align-items:center;gap:12px;">
    <div style="color:#05608D;">
      <div style="font-size:22px;font-weight:700;line-height:1.2;">blufin</div>
      <div style="font-size:12px;font-weight:600;color:#7B8694;">Password Reset</div>
    </div>
  </div>
</div>
<div style="background:#f5f7fb;padding:28px 22px">
  <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
    <div style="background:#fff;border-radius:16px;border:1px solid #e6edf5;box-shadow:0 10px 26px rgba(5,96,141,0.10);overflow:hidden;">
      <div style="background:linear-gradient(90deg,#0b6aa1,#1791d1);color:#fff;padding:16px 22px;">
        <span style="background:#fff;color:#0b6aa1;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;">Password Reset</span>
      </div>
      <div style="padding:22px;">
        <p style="margin:0 0 14px;">Hello <strong>${user.userName}</strong>,</p>
        <p style="margin:0 0 14px;">We received a request to reset the password for your account. Click the button below to set a new password:</p>
        <div style="text-align:center;margin:20px 0;">
          <a href="${resetPasswordLink}" style="display:inline-block;background:#0C5273;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Reset Password</a>
        </div>
        <p style="margin:0 0 10px;font-size:13px;color:#7B8694;">This link will expire in <strong>${ttlMinutes} minutes</strong>. If you did not request this, please ignore this email.</p>
      </div>
    </div>
  </div>
</div>
<div style="background:#f5f7fb;padding:6px 22px 14px 22px">
  <div style="max-width:640px;margin:0 auto;background:#05608D;color:#fff;text-align:center;padding:12px 16px;border-radius:14px;font-size:13px;">
    <div style="opacity:0.8">&copy; ${currentYear} Dofi Infosys. All rights reserved.</div>
  </div>
</div>`
        });

        if (!emailSent) {
            throw new Error('Failed to send password reset email');
        }
    }

    async handleResetPassword(token: string, password: string): Promise<number> {
        const tokenRow = await this.publicAccessTokenService.findValidByPurpose(
            token,
            PUBLIC_TOKEN_PURPOSES.FORGOT_PASSWORD,
        );

        const userId = tokenRow.ResourceSid;

        await this.db.$transaction(async (tx) => {
            const reFetched = await tx.publicAccessToken.findUnique({
                where: { Token: token },
            });
            if (!reFetched || reFetched.UsedAt !== null) {
                throw new PublicAccessTokenError('ALREADY_USED');
            }
            if (reFetched.ExpiresAt.getTime() <= Date.now()) {
                throw new PublicAccessTokenError('EXPIRED');
            }

            const encodedPassword = await encodePassword(password);
            await tx.userMaster.update({
                where: { UserMasterSid: userId },
                data: { userPassword: encodedPassword },
            });

            await this.publicAccessTokenService.consume(
                reFetched.PublicAccessTokenSid,
                tx,
                'FORGOT_PASSWORD_RESET',
            );
        });

        await this.updateAttemptDateTime(userId, null);
        return userId;
    }
}


