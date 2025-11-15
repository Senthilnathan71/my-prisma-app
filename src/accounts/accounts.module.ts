import { Logger, Module } from '@nestjs/common';
import { CoaController } from './controllers/coa/coa.controller';
import { CoaService } from './services/coa/coa.service';
import { SupplierTdsMappingController } from './controllers/supplier-tds-mapping/supplier-tds-mapping.controller';
import { SupplierTdsMappingService } from './services/supplier-tds-mapping/supplier-tds-mapping.service';
import { SubledgermasterController } from './controllers/subledgermaster/subledgermaster.controller';
import { SubledgermasterService } from './services/subledgermaster/subledgermaster.service';
import { OutstandingController } from './controllers/outstanding/outstanding.controller';
import { OutstandingService } from './services/outstanding/outstanding.service';
import { ReceiptController } from './controllers/receipt/receipt.controller';
import { ReceiptService } from './services/receipt/receipt.service';
import { VoucherPostingController } from './controllers/voucher-posting/voucher-posting.controller';
import { VoucherPostingService } from './services/voucher-posting/voucher-posting.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { VoucherService } from 'src/operation/services/voucher/voucher.service';

@Module({
    controllers: [
        CoaController,
        SupplierTdsMappingController,
        SubledgermasterController,
        OutstandingController,
        ReceiptController,
        VoucherPostingController
    ],
    providers: [
        GlobalConfigService,
        CoaService,
        SupplierTdsMappingService,
        SubledgermasterService,
        OutstandingService,
        ReceiptService,
        VoucherPostingService,
        Logger,
        VoucherService
    ]
})
export class AccountsModule { }
