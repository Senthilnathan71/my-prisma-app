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
            const { departmentOnTerms, departmentId, departments, termsAndConditionDetail, termsAndConditionsDetail, termsAndConditionsDetails, ...termCondInput } = payload;
            const rawDepartments = departmentOnTerms ?? departmentId ?? departments ?? [];
            const inputDepartments = Array.isArray(rawDepartments) ? rawDepartments : [rawDepartments];
            const rawDetails = termsAndConditionDetail ?? termsAndConditionsDetail ?? termsAndConditionsDetails ?? [];
            const inputDetails = Array.isArray(rawDetails) ? rawDetails : [rawDetails];

            const normalizedDepartments = inputDepartments
                .map((item: any) => {
                    if (typeof item === 'object' && item !== null) {
                        return {
                            departmentId: Number(item.departmentId ?? item.DepartmentMasterSid),
                            status: String(item.status ?? 'A').charAt(0) || 'A'
                        };
                    }
                    return {
                        departmentId: Number(item),
                        status: 'A'
                    };
                })
                .filter((item: any) => Number.isInteger(item.departmentId) && item.departmentId > 0);

            if (normalizedDepartments.length === 0) {
                throw new BadRequestException('departmentId is required');
            }
            if (!termCondInput.BranchMasterSid) {
                throw new BadRequestException('BranchMasterSid is required');
            }
            if (!termCondInput.MenuMasterSid) {
                throw new BadRequestException('MenuMasterSid is required');
            }

            const mergedObj = await this._db.$transaction(async (prisma) => {
                const {
                    CompanyMasterSid,
                    BranchMasterSid,
                    MenuMasterSid,
                    POL,
                    POD,
                    FDC,
                    ...masterInput
                } = termCondInput;

                const createdTermCond = await prisma.termsAndConditionsMaster.create({
                    data: {
                        ...masterInput,
                        POL: Array.isArray(POL) ? POL : [],
                        POD: Array.isArray(POD) ? POD : [],
                        FDC: Array.isArray(FDC) ? FDC : [],
                        branch: { connect: { BranchMasterSid: Number(BranchMasterSid) } },
                        menu: { connect: { MenuMasterSid: Number(MenuMasterSid) } },
                        ...(CompanyMasterSid ? { company: { connect: { CompanyMasterSid: Number(CompanyMasterSid) } } } : {})
                    }
                });

                const finalDepartments: any[] = [];
                if (normalizedDepartments.length > 0) {
                    await prisma.departmentOnTerms.createMany({
                        data: normalizedDepartments.map((item: any) => ({
                            termsId: createdTermCond.TermsAndConditionsMasterSid,
                            departmentId: item.departmentId,
                            status: item.status
                        }))
                    });

                    const createdDepartments = await prisma.departmentOnTerms.findMany({
                        where: {
                            termsId: createdTermCond.TermsAndConditionsMasterSid
                        }
                    });
                    finalDepartments.push(...createdDepartments);
                }

                const normalizedDetails = inputDetails
                    .map((item: any) => ({
                        TandC: item?.TandC ?? item?.Terms ?? '',
                        Type: item?.Type ?? null,
                        TypeValue: item?.TypeValue ?? null,
                        IsDefaut: item?.IsDefaut ?? 'A',
                        createdBy: item?.createdBy ?? createdTermCond.createdBy,
                        status: item?.status ?? 'A'
                    }))
                    .filter((item: any) => String(item.TandC).trim().length > 0);

                let detailData: any[] = [];
                if (normalizedDetails.length > 0) {
                    await prisma.termsAndConditionsDetail.createMany({
                        data: normalizedDetails.map((item: any) => ({
                            TermsAndConditionsMasterSid: createdTermCond.TermsAndConditionsMasterSid,
                            TandC: item.TandC,
                            Type: item.Type,
                            TypeValue: item.TypeValue,
                            IsDefaut: item.IsDefaut,
                            createdBy: item.createdBy,
                            status: item.status
                        }))
                    });

                    detailData = await prisma.termsAndConditionsDetail.findMany({
                        where: {
                            TermsAndConditionsMasterSid: createdTermCond.TermsAndConditionsMasterSid,
                            status: 'A'
                        }
                    });
                }

                return {
                    tandCData: createdTermCond,
                    departmentData: finalDepartments,
                    detailData
                };
            });

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
                    termsAndConditionsDetail:{
                        where:{
                            status:'A'
                        }
                    },
                    departments:{
                        where:{
                            status:'A'
                        },
                        include:{
                            department:true
                        }
                    },
                    
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

            const result = await this._db.$transaction(async (prisma) => {
                const {
                    departmentOnTerms,
                    departmentId,
                    departments,
                    DepartmentOnTermSid,
                    TermsAndConditionsDetailSid,
                    termsAndConditionDetail,
                    termsAndConditionsDetail,
                    termsAndConditionsDetails,
                    ...TandCUpdateData
                } = payload;

                const {
                    CompanyMasterSid,
                    BranchMasterSid,
                    MenuMasterSid,
                    POL,
                    POD,
                    FDC,
                    ...masterInput
                } = TandCUpdateData;

                const updatedTermCond = await prisma.termsAndConditionsMaster.update({
                    where : {
                        TermsAndConditionsMasterSid : TermsAndConditionsMasterSid
                    },
                    data : {
                        ...masterInput,
                        ...(POL !== undefined ? { POL: Array.isArray(POL) ? POL : [] } : {}),
                        ...(POD !== undefined ? { POD: Array.isArray(POD) ? POD : [] } : {}),
                        ...(FDC !== undefined ? { FDC: Array.isArray(FDC) ? FDC : [] } : {}),
                        ...(BranchMasterSid ? { branch: { connect: { BranchMasterSid: Number(BranchMasterSid) } } } : {}),
                        ...(MenuMasterSid ? { menu: { connect: { MenuMasterSid: Number(MenuMasterSid) } } } : {}),
                        ...(CompanyMasterSid ? { company: { connect: { CompanyMasterSid: Number(CompanyMasterSid) } } } : {})
                    }
                });

                const rawDepartments = departmentOnTerms ?? departmentId ?? departments ?? [];
                const inputDepartments = Array.isArray(rawDepartments) ? rawDepartments : [rawDepartments];
                const normalizedDepartments = inputDepartments
                    .map((item: any) => {
                        if (typeof item === 'object' && item !== null) {
                            return {
                                DepartmentOnTermSid: item.DepartmentOnTermSid ? Number(item.DepartmentOnTermSid) : null,
                                departmentId: Number(item.departmentId ?? item.DepartmentMasterSid),
                                status: String(item.status ?? 'A').charAt(0) || 'A'
                            };
                        }
                        return {
                            DepartmentOnTermSid: null,
                            departmentId: Number(item),
                            status: 'A'
                        };
                    })
                    .filter((item: any) => Number.isInteger(item.departmentId) && item.departmentId > 0);

                const finalDepartments: any[] = [];
                for (const item of normalizedDepartments) {
                    let updatedDepartment;
                    let createdDepartment;

                    if (item.DepartmentOnTermSid) {
                        updatedDepartment = await prisma.departmentOnTerms.update({
                            where: { DepartmentOnTermSid: item.DepartmentOnTermSid },
                            data: {
                                departmentId: item.departmentId,
                                status: item.status
                            }
                        });
                    } else {
                        createdDepartment = await prisma.departmentOnTerms.create({
                            data: {
                                termsId: TermsAndConditionsMasterSid,
                                departmentId: item.departmentId,
                                status: item.status
                            }
                        });
                    }

                    finalDepartments.push(updatedDepartment || createdDepartment);
                }

                const departmentData = finalDepartments.length > 0
                    ? finalDepartments
                    : await prisma.departmentOnTerms.findMany({
                        where: {
                            termsId: TermsAndConditionsMasterSid,
                            status: 'A'
                        }
                    });

                const rawDetails = termsAndConditionDetail ?? termsAndConditionsDetail ?? termsAndConditionsDetails ?? [];
                const inputDetails = Array.isArray(rawDetails) ? rawDetails : [rawDetails];
                const normalizedDetails = inputDetails
                    .map((item: any) => ({
                        TermsAndConditionsDetailSid: item?.TermsAndConditionsDetailSid ? Number(item.TermsAndConditionsDetailSid) : null,
                        TandC: item?.TandC ?? item?.Terms ?? '',
                        Type: item?.Type ?? null,
                        TypeValue: item?.TypeValue ?? null,
                        IsDefaut: item?.IsDefaut ?? 'A',
                        status: item?.status ?? 'A',
                        updatedBy: item?.updatedBy ?? payload?.updatedBy ?? null
                    }))
                    .filter((item: any) => String(item.TandC).trim().length > 0);

                const finalDetails: any[] = [];
                for (const item of normalizedDetails) {
                    let updatedDetail;
                    let createdDetail;
                    if (item.TermsAndConditionsDetailSid) {
                        updatedDetail = await prisma.termsAndConditionsDetail.update({
                            where: {
                                TermsAndConditionsDetailSid: item.TermsAndConditionsDetailSid
                            },
                            data: {
                                TandC: item.TandC,
                                Type: item.Type,
                                TypeValue: item.TypeValue,
                                IsDefaut: item.IsDefaut,
                                status: item.status,
                                updatedBy: item.updatedBy
                            }
                        });
                    } else {
                        createdDetail = await prisma.termsAndConditionsDetail.create({
                            data: {
                                TermsAndConditionsMasterSid: TermsAndConditionsMasterSid,
                                TandC: item.TandC,
                                Type: item.Type,
                                TypeValue: item.TypeValue,
                                IsDefaut: item.IsDefaut,
                                createdBy: payload?.updatedBy ?? updatedTermCond.updatedBy ?? updatedTermCond.createdBy,
                                status: item.status
                            }
                        });
                    }
                    finalDetails.push(updatedDetail || createdDetail);
                }

                const detailData = finalDetails.length > 0
                    ? finalDetails
                    : await prisma.termsAndConditionsDetail.findMany({
                        where: {
                            TermsAndConditionsMasterSid: TermsAndConditionsMasterSid,
                            status: 'A'
                        }
                    });

                return {
                    tandCData: updatedTermCond,
                    departmentData,
                    detailData
                };
            });

            return result;
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
