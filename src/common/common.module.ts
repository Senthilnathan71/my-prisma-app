import { Logger, Module } from '@nestjs/common';
import { RecentScreenController } from './controllers/recent-screen/recent-screen.controller';
import { RecentScreenService } from './services/recent-screen/recent-screen.service';
import { FavouriteScreenController } from './controllers/favourite-screen/favourite-screen.controller';
import { FavouriteScreenService } from './services/favourite-screen/favourite-screen.service';
import { emailLogController } from './controllers/email-log/email-log.controller';
import { EmailService } from 'src/email/email.service';
import { EmailLogService } from './services/email-log/email-log.service';
import { LookupsController } from './controllers/lookups/lookups.controller';
import { LookupsService } from './services/lookups/lookups.service';
import { FollowupController } from './controllers/followup/followup.controller';
import { FollowupService } from './services/followup/followup.service';
import { SchedulerService } from './services/scheduler/scheduler.service';

@Module({
    controllers: [
        RecentScreenController,
        FavouriteScreenController,
        emailLogController,
        LookupsController,
        FollowupController,
    ],
    providers: [
        Logger,
        RecentScreenService,
        FavouriteScreenService,
        EmailLogService,
        EmailService,
        LookupsService,
        FollowupService,
        SchedulerService
    ]
})
export class CommonModule { }
