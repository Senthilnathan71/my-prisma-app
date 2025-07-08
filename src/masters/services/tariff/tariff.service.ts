import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class TariffService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async createNewTariff(newData: any,user:any) {

        const existing = await this._db.tariffHeader.findFirst({
            where: {
                AND: [
                    { POLSid: newData.POLSid },
                    { PODSid: newData.PODSid },
                    { CompanyMasterSid : user.CompanyMasterSid}
                ]
            },
        });

        if (existing) {
            throw new BadRequestException('Tariff already exists for these POL and POD combinations.');
        }

        try {

            let createdTariff = await this._db.tariffHeader.create({
                data: {
                    ...newData,
                    CompanyMasterSid : user.userBranchMaster[0]?.CompanyMasterSid
                }
            })
            return createdTariff;
        } catch (error) {
            throw error;
        }
    }

    async getAllTariff() {
        try {
            let allTariff = await this._db.tariffHeader.findMany({
                where: {
                    deletedAt: null
                },
                include : {
                    departmentMaster:{
                        select:{
                            departmentName:true
                        }
                    }
                }
            })
            return allTariff;
        } catch (error) {
            throw error;
        }
    }


    async getTariffById(TariffHeaderSid: number) {
        try {
            let ourTariff = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            })
            if (!ourTariff) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }
            return ourTariff;
        } catch (error) {
            throw error;
        }
    }


    async updateTariffById(TariffHeaderSid: number, updateData: any,user) {
        try {

            const existing = await this._db.tariffHeader.findFirst({
                where: {
                    POLSid: updateData.POLSid,
                    PODSid: updateData.PODSid,
                    CompanyMasterSid: user.CompanyMasterSid,
                    TariffHeaderSid: { not: TariffHeaderSid },
                },
            });

            if (existing) {
                throw new BadRequestException('Tariff already exists for these POL and POD combinations.');
            }

            let exists = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            })
            if (!exists) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }
            let updatedTariff = await this._db.tariffHeader.update({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                },
                data: updateData
            })
            return updatedTariff;
        } catch (error) {
            throw error;
        }
    }



    async deleteTariffById(TariffHeaderSid: number) {
        try {
            let exists = await this._db.tariffHeader.findUnique({
                where: {
                    TariffHeaderSid: TariffHeaderSid
                }
            })
            if (!exists) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} not exists`);
            }
            if (exists.deletedAt) {
                throw new BadRequestException(`Tariff with id : ${TariffHeaderSid} is already deleted`);
            }

            const result = await this._db.$transaction(async (prisma)=>{
                let deletedTariff = await prisma.tariffHeader.update({
                    where: {
                        TariffHeaderSid: TariffHeaderSid
                    },
                    data: {
                        deletedAt: new Date()
                    }
                })
                let deletedTariffDetail = await prisma.tariffDetail.updateManyAndReturn({
                    where : {
                        TariffHeaderSid : TariffHeaderSid,
                        deletedAt : null
                    },
                    data : {
                        deletedAt : new Date()
                    }
                })
                return {
                    deletedTariff,
                    tariffDetail : deletedTariffDetail
                }
            })
            return result;
        } catch (error) {
            throw error;
        }
    }

    async searchTariff(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const stringFields = [
            "DepartmentName",
            "POLTerminal",
            "PODTerminal",
            "EffectiveDate",
            "status"
        ];
        const intFields = [
            "Carrier",
            "AgentSid",
        ]
        const acceptedType = [...stringFields, ...intFields];
        this.logger.log(`Search List DTO`, JSON.stringify(data));
        if (!acceptedType.includes(searchType)) {
            throw new BadRequestException(`Invalid Search Type`);
        }
        let whereClause: any = {};

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            }
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        }
        const searchResults = await this._db.tariffHeader.findMany({
            where: {
                ...whereClause,
                deletedAt:null
            },
            include : {
                departmentMaster:{
                    select:{
                        departmentName:true,
                    }
                },
                customerCarrier:{
                    select:{
                        CustomerName:true
                    }
                },
                customerAgent:{
                    select:{
                        CustomerName:true
                    }
                }
            }
        }).catch((err) => {
            throw new Error(`Error Occurred : ${JSON.stringify(err), err}`);
        })
        return searchResults;
    }
}
