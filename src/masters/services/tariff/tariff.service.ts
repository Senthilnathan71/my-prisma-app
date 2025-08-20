import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalConfigService } from 'src/common/config/master-config.service';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { SearchVesselDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class TariffService {
    constructor(private _db: DatabaseService, private logger: Logger,private globalConfigService:GlobalConfigService) { }

    async createNewTariff(newData: any) {

        const existing = await this._db.tariffHeader.findFirst({
            where: {
                AND: [
                    { POLSid: newData.POLSid },
                    { PODSid: newData.PODSid },
                    { DepartmentMasterSid: newData.DepartmentMasterSid },
                    { CompanyMasterSid : newData.CompanyMasterSid},
                    { deletedAt : null }
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
                    CompanyMasterSid : newData.CompanyMasterSid
                }
            })
            return createdTariff;
        } catch (error) {
            throw error;
        }
    }

    async getAllTariff(CompanyMasterSid: number) {
        try {
            let allTariff = await this._db.tariffHeader.findMany({
                where: {
                    deletedAt: null,
                    CompanyMasterSid: CompanyMasterSid
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


    async updateTariffById(TariffHeaderSid: number, updateData: any) {
        try {

            const existing = await this._db.tariffHeader.findFirst({
                where: {
                    POLSid: updateData.POLSid,
                    PODSid: updateData.PODSid,
                    DepartmentMasterSid : updateData.DepartmentMasterSid,
                    CompanyMasterSid: updateData.CompanyMasterSid,
                    TariffHeaderSid: { not: TariffHeaderSid },
                     deletedAt : null 
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

    async searchTariffNew(params: SearchVesselDto) {
        const { search='',page=1,pageSize=15, activeCompanyId} = params;
        const skip = (page-1)*pageSize;

        const where: Prisma.TariffHeaderWhereInput = {
            deletedAt: null,
            status: 'A',
            CompanyMasterSid : activeCompanyId,
            ...(search
                ? {
                    OR: [
                        { departmentMaster: { departmentName: { contains: search, mode: 'insensitive'}}},
                        { POLTerminal: { contains: search, mode: 'insensitive'}},
                        { PODTerminal: { contains: search, mode: 'insensitive'}},
                        { customerCarrier: { CustomerName: { contains: search, mode: 'insensitive'}}},
                        { customerAgent: { CustomerName: { contains: search, mode: 'insensitive'}}},
                    ],
                }
                : {}
            ),
        };

        let items;
        let totalCount;
        [items,totalCount] = await this._db.$transaction([
            this._db.tariffHeader.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { TariffHeaderSid: 'desc'},
            }),
            this._db.tariffHeader.count({where}),
        ]);

        items = await Promise.all(
            items.map(async (item)=> {
                const [departmentMaster , customerCarrier , customerAgent] = await Promise.all([
                    item.DepartmentMasterSid !== null ?
                    this.globalConfigService.getMasterData('department_master',item.DepartmentMasterSid) : 
                    { DepartmentMasterSid : null , departmentName : ''},

                    item.Carrier !== null ?
                    this.globalConfigService.getMasterData('customer_master',item.Carrier) :
                    { CustomerMasterSid : null , CustomerName : ''},

                    item.AgentSid !== null ?
                    this.globalConfigService.getMasterData('customer_master',item.AgentSid) :
                    { CustomerMasterSid : null , CustomerName : ''},

                ])

                return {
                    ...item ,
                    departmentMaster,
                    customerCarrier,
                    customerAgent
                }
            })
        )
        
        return {
            items,
            totalCount,
        }
    }
    async getAuditLogs(tableName: string, recordId?: string) {
    try {
      const whereClause: any = { tableName };
      if (recordId) whereClause.recordId = recordId;

      const logs = await this._db.auditLog.findMany({
        where: whereClause,
        orderBy: { changedAt: 'desc' },
      });

      return logs;
    } catch (error) {
      this.logger.warn(`getAuditLogsError: ${error}`);
      throw new Error(`Error fetching audit logs: ${error.message}`);
    }
  }
}
