import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { SearchListDto } from "src/masters/DTO/search-list.dto";

@Injectable()
export class IncoService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async createInco(payload: any, user) {
        this.logger.warn(`createInco: ${payload}`);

        const existing = await this._db.incoMaster.findFirst({
            where: {
                OR: [
                    {
                        IncoName: {
                            equals: payload.IncoName.trim(),
                            mode: 'insensitive',
                        }
                    },
                    {
                        IncoCode: {
                            equals: payload.IncoCode.trim(),
                            mode: 'insensitive',
                        }
                    }
                ]
            },
        });

        if (existing) {
            if (existing.IncoName === payload.IncoName) {
                throw new BadRequestException('Inco name already exists');
            }
            if (existing.IncoCode === payload.IncoCode) {
                throw new BadRequestException('Inco code already exists');
            }
        }

        try {
            const Inco = await this._db.incoMaster.create({
                data: {
                    ...payload,
                }
            });

            return Inco;
        } catch (error) {
            console.log(error.stack)
            throw new Error(`Error creating Inco: ${error.message}`);
        }
    }

    async getAllInco() {
        try {
            const IncoList = await this._db.incoMaster.findMany({
                where: {
                    Status: 'A'
                }
            })
            return IncoList;
        } catch (error) {
            throw error
        }
    }

    async findOne(IncoMasterSid: any) {
        try {
            return await this._db.incoMaster.findUnique({
                where: {
                    IncoMasterSid: IncoMasterSid
                },
            });
        } catch (error) {
            throw error;
        }
    }

    async updateInco(IncoMasterSid: number, payload: any, user) {
        const existing = await this._db.incoMaster.findUnique({
            where: {
                IncoMasterSid: IncoMasterSid
            }
        });

        if (!existing) {
            throw new Error('Inco is not exists');
        }

        try {
            const Inco = await this._db.incoMaster.update({
                where: {
                    IncoMasterSid: IncoMasterSid
                }, data: payload
            });
            return Inco;
        } catch (error) {
            throw new Error(`Error updating Inco: ${error.message}`);
        }
    }

    async softDelete(id: number) {
        const existingInco = await this._db.incoMaster.findUnique({
            where: {IncoMasterSid: id}
        });

        if (!existingInco) {
            throw new NotFoundException(`Inco with ID ${id} not found`);
        }

        if (existingInco.deletedAt) {
            throw new Error(`Inco with ID ${id} is already deleted`);
        }

        return this._db.incoMaster.update({
            where: { IncoMasterSid:  id},
            data: { deletedAt: new Date()}
        });
    }

    async searchList(dto: SearchListDto) {
        const { searchType, filterValue} = dto;
        const allowedFields = [
            'IncoName',
            'IncoCode',
            'IncoType',
            'OceanFreight',
            'Status',
        ];

        if (!allowedFields.includes(searchType)) {
            throw new BadRequestException('Invalid search type');
        }

        const Incos = this._db.incoMaster.findMany({
            where: {
                [searchType]: {
                    contains: filterValue,
                    mode: 'insensitive',
                },
                deletedAt: null,
            },
        }).catch(err => {
            throw new Error(`Error Search Inco: ${err}`);
        });
        return Incos;
    }
}