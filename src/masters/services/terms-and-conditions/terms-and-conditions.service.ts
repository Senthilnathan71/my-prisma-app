import { BadRequestException, Injectable } from '@nestjs/common';
import { log } from 'console';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class TermsAndConditionsService {
    constructor(private _db:DatabaseService){}

    async getAllTermCond(){
        try {
            const allTermConds = await this._db.termsAndConditionsMaster.findMany({
                where : {
                    status:'A'
                },
                include:{
                    departments : true
                }
            })
            return allTermConds;
        } catch (error) {
            throw error;
        }
    }

    async createNewTermCond(payload){
        try {
            // Used Rest Operator to Fix 'Unknown Argument' problem
            const {departmentId,...termCondInput}=payload;
            const createdTermCond = await this._db.termsAndConditionsMaster.create({
                data :{
                    ...termCondInput,
                }
            })
            const departmentOnTerms = await this._db.departmentOnTerms.create({
                data:{
                    departmentId:departmentId,
                    termsId:createdTermCond.TermsAndConditionsMasterSid
                }
            })
            const mergedObj = {tandCData : {...createdTermCond},departmentData : {...departmentOnTerms}}
            return mergedObj;
        } catch (error) {
            throw error;
        }
    }

    async fetchTermCondById(TermsAndConditionsMasterSid:number){
        try {
            const ourTermCond =await this._db.termsAndConditionsMaster.findUnique({
                where : {
                    TermsAndConditionsMasterSid:TermsAndConditionsMasterSid
                },
                include:{
                    departments:true
                }
            })
            if(!ourTermCond){
                throw new BadRequestException(`Terms and Conditions with Id : ${TermsAndConditionsMasterSid} not exists`);
            }
            return ourTermCond;
        } catch (error) {
            throw error;
        }
    }

    async updateTermCondById(TermsAndConditionsMasterSid:number,payload){
        try {
            const exist =await this._db.termsAndConditionsMaster.findUnique({
                where : {
                    TermsAndConditionsMasterSid:TermsAndConditionsMasterSid
                }
            })
            if(!exist){
                throw new BadRequestException(`Terms and Conditions with Id : ${TermsAndConditionsMasterSid} not exists`);
            }

            // Using rest operator to Fix 'Unknown Argument' error

            const {departmentId,DepartmentOnTermSid,...TandCUpdateData}=payload;
            const updatedTermCond = this._db.termsAndConditionsMaster.update({
                where : {
                    TermsAndConditionsMasterSid : TermsAndConditionsMasterSid
                },
                data : TandCUpdateData
            })

            // 
            const departmentOnTerms = await this._db.departmentOnTerms.update({
                where:{
                    DepartmentOnTermSid:DepartmentOnTermSid
                },
                data:{
                    departmentId : departmentId,
                }
            })
            return updatedTermCond;
        } catch (error) {
            throw error;
        }
    }


    async deleteTermCond(TermsAndConditionsMasterSid: number) {
    try {

        const exist = await this._db.termsAndConditionsMaster.findUnique({
            where: {
                TermsAndConditionsMasterSid: TermsAndConditionsMasterSid
            }
        });
        
        if (!exist) {
            throw new BadRequestException(`Terms & Conditions with ID: ${TermsAndConditionsMasterSid} not exists`);
        }
        
        if (exist.status==='D') {
            throw new BadRequestException(`Terms & Conditions with ID: ${TermsAndConditionsMasterSid} is already deleted`);
        }

        return await this._db.$transaction(async (tx) => {
            
            const deletedMaster = await tx.termsAndConditionsMaster.update({
                where: { 
                    TermsAndConditionsMasterSid: TermsAndConditionsMasterSid 
                },
                data: {
                    status:'D'
                }
            });

            
            const deletedDetails = await tx.termsAndConditionsDetail.updateManyAndReturn({
                where: {
                    TermsAndConditionsMasterSid: TermsAndConditionsMasterSid,
                    status:'D'
                },
                data: {
                    status:'D'
                }
            });

            
            const deletedTransactions = await tx.tandCTransaction.updateManyAndReturn({
                where: {
                    TandCMasterSid: TermsAndConditionsMasterSid,
                    status:'D'
                },
                data: {
                    status:'D'
                }
            });

            
            const deletedDepartmentRelations = await tx.departmentOnTerms.updateManyAndReturn({
                where: {
                    termsId: TermsAndConditionsMasterSid,
                    status:'D'
                },
                data: {
                    status:'D'
                }
            });
            

            return {
                    deletedMaster,
                    deletedDetails,
                    deletedTransactions,
                    deletedDepartmentRelations
                
            };
        });
    } catch (error) {
        throw new Error(`Terms & Conditions deletion failed: ${error.message}`);
    }
}


    async searchTermCond(data:SearchListDto){
        const {searchType,filterValue}=data;
        const intFields=[
            "CompanyMasterSid",
            "BranchMasterSid",
            "MenuMasterSid",
            "Carrier",
        ];
        const stringFields = [
            "PrintType",
            "POL",
            "POD",
            "FDC",
            "status",
            "Remarks"
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

        const searchResults = await this._db.termsAndConditionsMaster.findMany({
            where :{ 
                ...whereClause,
                status:'A'
            },
            include :{
                branch:{
                    select:{
                        branchName:true
                    }
                },
                menu : {
                    select:{
                        MenuName:true
                    }
                },
                departments:true
            }
        }).catch((err) => {
            throw new Error(`Error Occured : ${JSON.stringify(err), err}`);
        })

        return searchResults;

    }

    async createTandCTransaction(payload: any) {
        const {
            CompanyMasterSid,
            BranchMasterSid,
            MenuMasterSid,
            createdBy,
            TandC,
            IsDefaut,
            POL = [],
            POD = [],
            FDC = [],
            DocumentSid
        } = payload;

        // Validate required fields
        if (!CompanyMasterSid || !BranchMasterSid || !MenuMasterSid || !createdBy || !TandC) {
            throw new BadRequestException('Missing required fields');
        }

        return await this._db.$transaction(async (tx) => {
            try {
                // Create TermsAndConditionsMaster
                const termsAndConditionsMaster = await tx.termsAndConditionsMaster.create({
                    data: {
                        CompanyMasterSid,
                        BranchMasterSid,
                        MenuMasterSid,
                        POL: { set: POL },
                        POD: { set: POD },
                        FDC: { set: FDC },
                        createdBy,
                        status: 'A',
                    },
                });

                // Create TermsAndConditionsDetail
                const termsAndConditionsDetail = await tx.termsAndConditionsDetail.create({
                    data: {
                        TermsAndConditionsMasterSid: termsAndConditionsMaster.TermsAndConditionsMasterSid,
                        TandC,
                        IsDefaut,
                        createdBy,
                        status: 'A',
                    },
                });

                // Create DepartmentOnTerms
                // const departmentOnTerms = await tx.departmentOnTerms.create({
                //     data: {
                //         departmentId,
                //         termsId: termsAndConditionsMaster.TermsAndConditionsMasterSid,
                //     },
                // });

                // Create TandCTransaction (optional DocumentSid)
                const tandCTransaction = await tx.tandCTransaction.create({
                    data: {
                        CompanyMasterSid,
                        TandCMasterSid: termsAndConditionsMaster.TermsAndConditionsMasterSid,
                        TandCDetailSid: termsAndConditionsDetail.TermsAndConditionsDetailSid,
                        Terms: TandC,
                        DocumentSid,
                        createdBy,
                        status: 'A',
                    },
                });

                return {
                    tandCData: termsAndConditionsMaster,
                    tandCDetailData: termsAndConditionsDetail,
                    transactionData: tandCTransaction,
                };
            } catch (error) {
                throw error;
            }
        });
    } 

    async getTandCByCondition(payload: TandCPayload) {
        try {
            // Validate required fields
            if (!payload.MenuMasterSid) {
                throw new Error('Missing required payload field: MenuMasterSid is required');
            }

            // Build the where clause dynamically
            const whereClause: any = {
                status:'A'
            };

            // Add filters only if provided
            if (payload.BranchMasterSid !== undefined) {
                whereClause.BranchMasterSid = payload.BranchMasterSid;
            }
            if (payload.MenuMasterSid !== undefined) {
                whereClause.MenuMasterSid = payload.MenuMasterSid;
            }
            if (payload.POL !== undefined) {
                whereClause.POL = { has: payload.POL };
            }
            if (payload.POD !== undefined) {
                whereClause.POD = { has: payload.POD };
            }
            if (payload.DepartmentMasterSid !== undefined) {
                whereClause.departments = {
                    some: { departmentId: payload.DepartmentMasterSid }
                };
            }

            const gatheredTandC = await this._db.termsAndConditionsMaster.findMany({
                where: whereClause,
                include: {
                    termsAndConditionsDetail: {
                        where: { status : 'A' }
                    }
                }
            });

            // Flatten the details array
            const gatheredTandCDetails = gatheredTandC.flatMap(
                tandc => tandc.termsAndConditionsDetail
            );

            return gatheredTandCDetails;
        } catch (error) {
            console.error('Error fetching terms and conditions:', error);
            throw new Error(`Failed to fetch terms and conditions: ${error.message}`);
        }
    }
}

interface TandCPayload {
    BranchMasterSid?: number;
    MenuMasterSid: number;
    POL?: string;
    POD?: string;
    DepartmentMasterSid?: number;
}