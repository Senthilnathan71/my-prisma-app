import { Logger, Module } from '@nestjs/common';
import { CoaController } from './controllers/coa/coa.controller';
import { CoaService } from './services/coa/coa.service';
import { SupplierTdsMappingController } from './controllers/supplier-tds-mapping/supplier-tds-mapping.controller';
import { SupplierTdsMappingService } from './services/supplier-tds-mapping/supplier-tds-mapping.service';
import { SubledgermasterController } from './controllers/subledgermaster/subledgermaster.controller';
import { SubledgermasterService } from './services/subledgermaster/subledgermaster.service';
import { GlobalConfigService } from 'src/common/config/master-config.service';

@Module({
    controllers: [
        CoaController,
        SupplierTdsMappingController,
        SubledgermasterController
    ],
    providers: [
        Logger,
        GlobalConfigService,
        CoaService,
        SupplierTdsMappingService,
        SubledgermasterService
    ]
})
export class AccountsModule { }
