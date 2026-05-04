import { BadRequestException, Injectable } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { CreatePrecustomerDto } from 'src/masters/DTO/create-Precustomer.dto';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class PrecustomerService {
    constructor(
        private _db: DatabaseService
    ) { }

    async getAllCustomer(CompanyMasterSid:number) {
        try {
            const customer = await this._db.customerMaster.findMany({
                where : {
                    status:'A',
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    preCustomerMaster: {
                        include: {
                            preCustomerMeeting: true
                        }
                    }
                },
                orderBy: {
                    CustomerMasterSid: 'desc'  // Sorting by 'CustomerMasterSid' in descending order
                }
            });
            return customer;
        } catch (error) {
            throw error
        }
    }

    async getAllCustomers() {
        try {
            const customer = await this._db.customerMaster.findMany({
                where : {
                    status:'A',
                },
                include: {
                    preCustomerMaster: {
                        include: {
                            preCustomerMeeting: true
                        }
                    }
                },
                orderBy: {
                    CustomerMasterSid: 'desc'  // Sorting by 'CustomerMasterSid' in descending order
                }
            });
            return customer;
        } catch (error) {
            throw error
        }
    }

    async getAllPrecustomer(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const customer = await this._db.preCustomerMaster.findMany({
                where: {
                    // CompanyMasterSid: user.CompanyMasterSid,
                    status:'A',
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    customerMaster:{
                        none:{}
                    }
                },
                orderBy: {
                    PreCustomerMasterSid: 'desc'
                }
            });
            return customer;
        } catch (error) {
            throw error
        }
    }

    async createPrecustomer(params: CreatePrecustomerDto, user?: any) {
        try {
            const companyMasterSid = Number(params.CompanyMasterSid) || null;
            const branchMasterSid = Number(params.BranchMasterSid) || null;

            if (!companyMasterSid || !branchMasterSid) {
                throw new BadRequestException("CompanyMasterSid and BranchMasterSid are required");
            }

            const payload: any = {
                CompanyMasterSid: companyMasterSid,
                BranchMasterSid: branchMasterSid,
                CityMasterSid: Number(params.CityMasterSid),
                CountryMasterSid: params.CountryMasterSid,
                StateMasterSid: params.StateMasterSid,
                preCustomerName: params.preCustomerName,
                preCustomerAddress1: params.preCustomerAddress1,
                preCustomerAddress2: params.preCustomerAddress2,
                contactPerson: params.contactPerson,
                isQualify: params.isQualify,
                leadStatus: params.leadStatus,
                preCustomerType: params.preCustomerType,
                email: params.email,
                phone: params.phone,
                leadFrom: params.leadFrom,
                leadReferredBy: params.leadReferredBy,
                createdBy: params.createdBy || params['userEmail'],
                status: params.status || 'A',
            };

            if (params.PreCustomerMasterSid) {
                // Update existing record 
                const existingLead = await this._db.preCustomerMaster.findUnique({
                    where: { PreCustomerMasterSid: params.PreCustomerMasterSid },
                });

                if (!existingLead) {
                    throw new Error('Lead not found');
                }
                payload.updatedOn = new Date(); // Only update UpdatedOn
                payload.updatedBy = params.updatedBy || user?.userEmail || params['userEmail'] ;
                await this._db.preCustomerMaster.update({
                    where: {
                        PreCustomerMasterSid: params.PreCustomerMasterSid,
                    },
                    data: payload

                })
                return { message: 'Lead updated successfully', data: params };

            } else {
                //check customer name already exist or not
                let leadName = payload.preCustomerName.trim();
                let existingLead = await this._db.preCustomerMaster.findFirst({
                    where: {
                        preCustomerName: leadName
                    }
                });

                if (existingLead) {
                    throw 'Lead already exist.'
                }
                payload.createdOn = new Date();
                payload.updatedOn = new Date();
                payload.createdBy = params.createdBy || params['userEmail']; // Only used when creating
                const newLead = await this._db.preCustomerMaster.create({
                    data: payload
                });
                
                return { message: 'Lead created successfully', data: newLead };
            }
        } catch (error) {
            console.log(error.stack)
            throw error
        }
    }

    async findOne(PreCustomerMasterSid: any) {
        try {
            return await this._db.preCustomerMaster.findUnique({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                }
            });
        } catch (error) {
            throw error;
        }
    }


    // async searchPrecustomer(data: SearchListDto) {
    //     const { searchType, filterValue } = data;
    //     const acceptedTypes = [
    //         "status",
    //         "preCustomerAddress1",
    //         "preCustomerAddress2",
    //         "leadAssignTo",
    //         "customerType",
    //         "contactPerson",
    //         "phone",
    //         "preCustomerType",
    //         "leadReferredBy",
    //         "panVat",
    //         "preCustomerName",
    //         "leadFrom",
    //         "email"
    //     ];
    //     if (!acceptedTypes.includes(searchType)) {
    //         throw new BadRequestException('Invalid Search Type');
    //     }
    //     const searchResults = await this._db.preCustomerMaster.findMany({
    //         where: {
    //             [searchType]: {
    //                 contains: filterValue,
    //                 mode: 'insensitive'
    //             },
    //             status:'A'
    //         }
    //     }).catch((err) => {
    //         throw new Error(`Error Occured ${err}`)
    //     })
    //     return searchResults;
    // }


        async searchPrecustomer(params: filterDto) {
            const { search = '', page = 1, pageSize = 10, activeCompanyId, activeBranchId, userEmail } = params as any;
            const skip = (page - 1) * pageSize;

            const where: Prisma.PreCustomerMasterWhereInput = {
                status: statusWhereClause,
                CompanyMasterSid: activeCompanyId,
                BranchMasterSid: activeBranchId,
                ...(userEmail ? { createdBy: userEmail } : {}),
                ...(search
                    ? {
                        OR: [
                            { preCustomerName: { contains: search, mode: 'insensitive' } },
                            { phone: { contains: search, mode: 'insensitive' } },
                            { preCustomerType: { contains: search, mode: 'insensitive' } },
                            { status: { contains: search, mode: 'insensitive' } },
                        ],
                    } : {}
                ),
            };

            const query: any = {
                where,
                orderBy: { PreCustomerMasterSid: 'desc' },
                include: {
                    branchMaster: true,
                    companyMaster: true,
                    preCustomerMeeting: true,
                    countryMaster: true,
                    stateMaster: true,
                    cityMaster: true,
                },
            };

            query.skip = skip;
            query.take = pageSize;

            const items = await this._db.preCustomerMaster.findMany(query);
            const totalCount = await this._db.preCustomerMaster.count({ where });

            return { items, totalCount };
        }
    }




