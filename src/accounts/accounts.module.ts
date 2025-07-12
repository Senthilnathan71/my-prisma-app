import { Logger, Module } from '@nestjs/common';
import { CoaController } from './controllers/coa/coa.controller';
import { CoaService } from './services/coa/coa.service';

@Module({
    controllers: [
        CoaController
    ],
    providers: [
        Logger,
        CoaService
    ]
})
export class AccountsModule { }
