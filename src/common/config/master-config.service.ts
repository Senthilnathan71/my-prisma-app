import { DatabaseService } from 'src/database/database.service';
import { MASTER_CONFIG } from './master.config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GlobalConfigService {
    constructor(private prisma: DatabaseService) { }


    async getMasterData(tableKey: string, id: number, CompanyMasterSid?: number) {
        const config = MASTER_CONFIG[tableKey];
        if (!config) throw new Error(`Unsupported master table: ${tableKey}`);

        const prismaModel = (this.prisma as any)[config.model];
        if (!prismaModel) throw new Error(`Invalid Prisma model for: ${tableKey}`);

        const where: any = {
            [config.primaryKey]: id, // ✅ use dynamic primary key field
        };

        if (CompanyMasterSid && config.companyKey) {
            where[config.companyKey] = CompanyMasterSid;
        }

        return prismaModel.findUnique({
            where,
            select: config.select,
        });
    }

}