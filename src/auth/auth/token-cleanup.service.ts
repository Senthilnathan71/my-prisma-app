import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PublicAccessTokenService } from 'src/common/public-access-token/public-access-token.service';
import { SchedulerService } from 'src/common/services/scheduler/scheduler.service';

@Injectable()
export class TokenCleanupService implements OnModuleInit {
    private static readonly JOB_NAME = 'token-cleanup-weekly';
    private static readonly CRON_EXPR = '0 0 * * 0'; // every Sunday at midnight

    constructor(
        private readonly publicAccessTokenService: PublicAccessTokenService,
        private readonly schedulerService: SchedulerService,
        private readonly logger: Logger,
    ) {}

    onModuleInit() {
        this.schedulerService.addCronJob(
            TokenCleanupService.JOB_NAME,
            TokenCleanupService.CRON_EXPR,
            () => this.handleTokenCleanup(),
        );
        this.logger.log(
            `[TokenCleanupService] Registered cron "${TokenCleanupService.JOB_NAME}" (${TokenCleanupService.CRON_EXPR})`,
        );
    }

    async handleTokenCleanup(): Promise<number> {
        try {
            const count = await this.publicAccessTokenService.cleanupExpiredTokens();
            if (count > 0) {
                this.logger.log(`Cleaned up ${count} expired/used public access token(s)`);
            }
            return count;
        } catch (error) {
            this.logger.error(`Token cleanup failed: ${error.message}`);
            throw error;
        }
    }
}
