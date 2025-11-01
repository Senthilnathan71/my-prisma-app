import { Logger, Module } from '@nestjs/common';
import { CoaController } from './controllers/coa/coa.controller';
import { CoaService } from './services/coa/coa.service';
import { SupplierTdsMappingController } from './controllers/supplier-tds-mapping/supplier-tds-mapping.controller';
import { SupplierTdsMappingService } from './services/supplier-tds-mapping/supplier-tds-mapping.service';
import { SubledgermasterController } from './controllers/subledgermaster/subledgermaster.controller';
import { SubledgermasterService } from './services/subledgermaster/subledgermaster.service';
import { VoucherPostingController } from './controllers/voucher-posting/voucher-posting.controller';
import { VoucherPostingService } from './services/voucher-posting/voucher-posting.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';

@Module({
    controllers: [
        CoaController,
        SupplierTdsMappingController,
        SubledgermasterController,
        VoucherPostingController
    ],
    providers: [
        Logger,
        GlobalConfigService,
        CoaService,
        SupplierTdsMappingService,
        SubledgermasterService,
        VoucherPostingService
    ]
})
export class AccountsModule { }
