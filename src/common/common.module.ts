import { Logger, Module } from '@nestjs/common';
import { RecentScreenController } from './controllers/recent-screen/recent-screen.controller';
import { RecentScreenService } from './services/recent-screen/recent-screen.service';
import { FavouriteScreenController } from './controllers/favourite-screen/favourite-screen.controller';
import { FavouriteScreenService } from './services/favourite-screen/favourite-screen.service';

@Module({
    controllers: [
        RecentScreenController,
        FavouriteScreenController
    ],
    providers: [
        Logger,
        RecentScreenService,
        FavouriteScreenService,
    ]
})
export class CommonModule { }
