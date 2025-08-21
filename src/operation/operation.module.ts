import { Logger, Module } from '@nestjs/common';
import { BookingController } from './controllers/booking/booking.controller';
import { BookingService } from './services/booking/booking.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';

@Module({
    providers : [
        Logger,
        GlobalConfigService,
        BookingService
    ],
    controllers : [   
        BookingController
    ]
})
export class OperationModule {}
