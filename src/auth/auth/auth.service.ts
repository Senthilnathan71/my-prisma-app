import { Injectable, Logger } from '@nestjs/common';
import { getClientIp } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { UserService } from 'src/masters/services/user.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
    loggedInUserData: any = {};
    constructor(
        private readonly userService: UserService,
        private readonly db: DatabaseService,
        private readonly logger: Logger
    ) {

    }

    async login(where: any): Promise<any> {
        return await this.userService.findUserById(where)
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
        return this.db.activeSession.findUnique({
            where: { userId }
        });
    }

    async createSession(userId: number, ipAddress?: string, userAgent?: string, location?: string): Promise<string> {
        const sessionToken = crypto.randomUUID();

        await this.db.activeSession.upsert({
            where: { userId },
            update: {
                sessionToken,
                ipAddress,
                userAgent,
                location,
                createdOn: new Date(),
                lastActivity: new Date()
            },
            create: {
                userId,
                sessionToken,
                ipAddress,
                userAgent,
                location
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
        const session = await this.db.activeSession.findUnique({
            where: { userId }
        });

        if (!session) return false;
        return session.sessionToken === sessionToken;
    }

    async touchSession(userId: number): Promise<void> {
        await this.db.activeSession.updateMany({
            where: { userId },
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
}


