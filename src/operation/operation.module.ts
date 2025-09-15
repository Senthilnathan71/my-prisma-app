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
import { EmailService } from 'src/email/email.service';
import { LoadingPlanController } from './controllers/loading-plan/loading-plan.controller';
import { LoadingPlanService } from './services/loading-plan/loading-plan.service';
import { MergeBookingController } from './controllers/merge-booking/merge-booking.controller';
import { MergeBookingService } from './services/merge-booking/merge-booking.service';
import { InvoiceService } from './services/invoice/invoice.service';
import { InvoiceController } from './controllers/invoice/invoice.controller';
import { DocumentController } from './controllers/document/document.controller';
import { DocumentService } from './services/document/document.service';
import { ManifestDocumentController } from './controllers/manifest-document/manifest-document.controller';
import { ManifestDocumentService } from './services/manifest-document/manifest-document.service';
import { HouseJobController } from './controllers/house-job/house-job.controller';
import { HouseJobService } from './services/house-job/house-job.service';

@Module({
        providers: [
                Logger,
                EmailService,
                GlobalConfigService,
                BookingService,
                OperationCommonService,
                CurrencyExchangeService,
                MasterJobService,
                CargoreceiptService,
                LoadingPlanService,
                InvoiceService,
                DocumentService,
                ManifestDocumentService,
                MergeBookingService,
                HouseJobService
        ],
        controllers: [
                BookingController,
                OperationCommonController,
                MasterJobController,
                CargoreceiptController,
                LoadingPlanController,
                InvoiceController,
                ManifestDocumentController,
                MergeBookingController,
                DocumentController,
                HouseJobController
        ]
})
export class OperationModule { }
