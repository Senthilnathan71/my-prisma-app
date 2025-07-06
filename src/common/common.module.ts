import { Logger, Module } from '@nestjs/common';
import { RecentScreenController } from './controllers/recent-screen/recent-screen.controller';
import { RecentScreenService } from './services/recent-screen/recent-screen.service';
import { FavouriteScreenController } from './controllers/favourite-screen/favourite-screen.controller';
import { FavouriteScreenService } from './services/favourite-screen/favourite-screen.service';
import { emailLogController } from './controllers/email-log/email-log.controller';
import { EmailService } from 'src/email/email.service';
import { EmailLogService } from './services/email-log/email-log.service';

@Module({
    controllers: [
        RecentScreenController,
        FavouriteScreenController,
        emailLogController,
    ],
    providers: [
        Logger,
        RecentScreenService,
        FavouriteScreenService,
        EmailLogService,
        EmailService
    ]
})
export class CommonModule { }
