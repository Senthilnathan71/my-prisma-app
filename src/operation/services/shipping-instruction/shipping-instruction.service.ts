import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ShippingInstructionService {
    constructor(
        private readonly _db: DatabaseService,
        private readonly logger: Logger
    ) { }

    async createShippingInstruction(payload: {
        CompanyMasterSid: number;
        BranchMasterSid: number;
        HouseJobSid: number;
        Remarks?: string;
        CreatedBy: string;
    }) {
        try {
            const result = await this._db.$transaction(async (prisma) => {
                // 1. Upsert ShippingInstruction — create if none exists for this HouseJobSid, update if exists
                const existing = await prisma.shippingInstruction.findFirst({
                    where: {
                        CompanyMasterSid: payload.CompanyMasterSid,
                        BranchMasterSid: payload.BranchMasterSid,
                        HouseJobSid: payload.HouseJobSid,
                        Status: 'A'
                    }
                });

                let shippingInstruction;
                if (existing) {
                    shippingInstruction = await prisma.shippingInstruction.update({
                        where: {
                            ShippingInstructionSid: existing.ShippingInstructionSid
                        },
                        data: {
                            Remarks: payload.Remarks || '',
                            UpdatedBy: payload.CreatedBy,
                            UpdatedOn: new Date()
                        }
                    });
                } else {
                    // Soft-delete any old records for this HouseJobSid before creating new one
                    await prisma.shippingInstruction.updateMany({
                        where: {
                            HouseJobSid: payload.HouseJobSid,
                            Status: 'A'
                        },
                        data: {
                            Status: 'D',
                            UpdatedBy: payload.CreatedBy,
                            UpdatedOn: new Date()
                        }
                    });

                    shippingInstruction = await prisma.shippingInstruction.create({
                        data: {
                            CompanyMasterSid: payload.CompanyMasterSid,
                            BranchMasterSid: payload.BranchMasterSid,
                            HouseJobSid: payload.HouseJobSid,
                            Remarks: payload.Remarks || '',
                            CreatedBy: payload.CreatedBy
                        }
                    });
                }

                // 2. Update HouseJobOthers to set SIConfirmationDate
                await prisma.houseJobOthers.updateMany({
                    where: {
                        HouseJobSid: payload.HouseJobSid,
                        status: 'A'
                    },
                    data: {
                        SIConfirmationDate: new Date()
                    }
                });

                return shippingInstruction;
            });

            return result;
        } catch (error) {
            this.logger.error(`Failed to create shipping instruction: ${error.message}`);
            throw error;
        }
    }
}
