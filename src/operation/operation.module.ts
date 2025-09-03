import { Logger, Module } from '@nestjs/common';
import { BookingController } from './controllers/booking/booking.controller';
import { BookingService } from './services/booking/booking.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { OperationCommonController } from './controllers/operation-common/operation-common.controller';
import { OperationCommonService } from './services/operation-common/operation-common.service';
import { CurrencyExchangeService } from 'src/masters/services/currency-exchange/currency-exchange.service';
import { MasterJobController } from './controllers/master-job/master-job.controller';
import { MasterJobService } from './services/master-job/master-job.service';
import { CargoreceiptService } from './services/cargoreceipt/cargoreceipt.service';
import { CargoreceiptController } from './controllers/cargoreceipt/cargoreceipt.controller';

@Module({
    providers : [
        Logger,
        GlobalConfigService,
        BookingService,
        OperationCommonService,
        CurrencyExchangeService,
        MasterJobService,
        CargoreceiptService
    ],
    controllers : [   
        BookingController, 
        OperationCommonController, 
        MasterJobController,
        CargoreceiptController
    ]
})
export class OperationModule {}
