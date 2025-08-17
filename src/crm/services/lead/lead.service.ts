import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class LeadService {
    constructor(private _db:DatabaseService, private logger: Logger){}

    async getAllLeads(){
        try {
            const allLeads = await this._db.preCustomerMaster.findMany({
                where : {
                    deletedAt:null
                }
            })
            return allLeads;
        } catch (error) {
            throw error;
        }
    }

    async createNewLead(payload){
        try {
            const createdLead = await this._db.preCustomerMaster.create({
                data :{
                    ...payload,
                    createdBy :'admin@crm.com'
                }
            })
            return createdLead;
        } catch (error) {
            throw error;
        }
    }

    async fetchLeadById(PreCustomerMasterSid:number){
        try {
            const ourLead =await this._db.preCustomerMaster.findUnique({
                where : {
                    PreCustomerMasterSid:PreCustomerMasterSid
                }
            })
            if(!ourLead){
                throw new BadRequestException(`Lead with Id : ${PreCustomerMasterSid} not exists`);
            }
            return ourLead;
        } catch (error) {
            throw error;
        }
    }

    async updateLeadById(PreCustomerMasterSid:number,payload){
        try {
             const exist =await this._db.preCustomerMaster.findUnique({
                where : {
                    PreCustomerMasterSid:PreCustomerMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Lead with Id : ${PreCustomerMasterSid} not exists`);
            }
            const updatedLead = this._db.preCustomerMaster.update({
                where : {
                    PreCustomerMasterSid : PreCustomerMasterSid
                },
                data : payload
            })
            return updatedLead;
        } catch (error) {
            throw error;
        }
    }


    async deleteLead(PreCustomerMasterSid:number){
        try {
            const exist = await this._db.preCustomerMaster.findUnique({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Lead with Id : ${PreCustomerMasterSid} not exists`);
            }
            if (exist.deletedAt) {
                throw new BadRequestException(`Lead with Id :${PreCustomerMasterSid} is already deleted`)
            }
            const deletedLead = this._db.preCustomerMaster.update({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                },
                data: {
                    deletedAt: new Date()
                }
            })
            return deletedLead;
        } catch(error) {
            throw error;
        }
    }


    async searchLead(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            ''
        ];
        const stringFields = [
            ''
        ];
        const acceptedType = [...intFields,...stringFields];
        if(!acceptedType.includes(searchType)){
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause:any ={}

        if(stringFields.includes(searchType)){
            whereClause[searchType]={
                contains:filterValue,
                mode:'insensitive'
            }
        } else if(intFields.includes(searchType)){
            const numberValue=parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType]=numberValue;
        }

        const searchResults = await this._db.preCustomerMaster.findMany({
            where : {
                ...whereClause,
                deletedAt:null
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

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
