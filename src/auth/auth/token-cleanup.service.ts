import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PublicAccessTokenService } from 'src/common/public-access-token/public-access-token.service';

@Injectable()
export class TokenCleanupService {
    constructor(
        private readonly publicAccessTokenService: PublicAccessTokenService,
        private readonly logger: Logger,
    ) {}

    @Cron(CronExpression.EVERY_WEEK)
    async handleTokenCleanup() {
        try {
            const count = await this.publicAccessTokenService.cleanupExpiredTokens();
            if (count > 0) {
                this.logger.log(`Cleaned up ${count} expired/used public access token(s)`);
            }
        } catch (error) {
            this.logger.error(`Token cleanup failed: ${error.message}`);
        }
    }
}
