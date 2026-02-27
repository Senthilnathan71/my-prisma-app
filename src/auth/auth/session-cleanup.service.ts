import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service';

@Injectable()
export class SessionCleanupService {
    constructor(
        private readonly authService: AuthService,
        private readonly logger: Logger
    ) {}

    @Cron(CronExpression.EVERY_HOUR)
    async handleSessionCleanup() {
        try {
            const count = await this.authService.cleanupStaleSessions(180); // 3 hours
            if (count > 0) {
                this.logger.log(`Cleaned up ${count} stale session(s)`);
            }
        } catch (error) {
            this.logger.error(`Session cleanup failed: ${error.message}`);
        }
    }
}
