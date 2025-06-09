import { Logger,Module } from '@nestjs/common';
import { LeadService } from './services/lead/lead.service';
import { LeadController } from './controllers/lead/lead.controller';

@Module({
    providers : [
        Logger,
        LeadService,
    ],
    controllers : [
        LeadController
    ]
})
export class CrmModule {}
