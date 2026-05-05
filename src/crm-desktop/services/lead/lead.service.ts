import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class LeadService {
    constructor(private _db: DatabaseService, private logger: Logger) { }
async getAllCustomer(user,CompanyMasterSid:number) {
        try {
            const customer = await this._db.customerMaster.findMany({
                where : {
                    status:'A',
                    CompanyMasterSid: CompanyMasterSid
                },
                include: {
                    preCustomerMaster: {
                        include: {
                            preCustomerMeeting: {
                                where:{
                                    leadAssignTo:user.UserMasterSid
                                }
                            }
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
    async getAllLeads(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const allLeads = await this._db.preCustomerMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid,
                    customerMaster : {
                        none : {}
                    }
                }
            })
            return allLeads;
        } catch (error) {
            throw error;
        }
    }

    // async createNewLead(payload) {
    //     try {
    //         if (payload.city && typeof payload.city === 'object') {
    //             payload.CityMasterSid = payload.city.CityMasterSid;
    //             delete payload.city;
    //         }

    //         if (!payload.CityMasterSid) {
    //             throw new BadRequestException('CityMasterSid is required');
    //         }
    //         const createdLead = await this._db.preCustomerMaster.create({
    //             data: {
    //                 preCustomerName: payload.preCustomerName,
    //                 leadReferredBy: payload.leadReferredBy,
    //                 leadFrom: payload.leadFrom,
    //                 preCustomerType: payload.preCustomerType,
    //                 preCustomerAddress1: payload.preCustomerAddress1,
    //                 preCustomerAddress2: payload.preCustomerAddress2,
    //                 POBOX: payload.POBOX,
    //                 contactPerson: payload.contactPerson,
    //                 email: payload.email,
    //                 phone: payload.phone,
    //                 PreferredContactMode: payload.PreferredContactMode,
    //                 LanguagePreferrence: payload.LanguagePreferrence,
    //                 ServiceOfInterest: payload.ServiceOfInterest,
    //                 PurchaseTimeline: payload.PurchaseTimeline,
    //                 SpecificRequirements: payload.SpecificRequirements,
    //                 Industry: payload.Industry,
    //                 CompanySize: payload.CompanySize,
    //                 AnnualRevenue: payload.AnnualRevenue,
    //                 Notes: payload.Notes,
    //                 status: payload.status,
    //                 createdBy: payload.createdBy,
    //                 isQualify: payload.isQualify,
    //                 leadStatus: payload.leadStatus,
    //                 // ✅ Fix: connect required relations
    //                 companyMaster: { connect: { CompanyMasterSid: payload.CompanyMasterSid } },
    //                 branchMaster: payload.BranchMasterSid ? { connect: { BranchMasterSid: payload.BranchMasterSid } } : undefined,
    //                 countryMaster: payload.CountryMasterSid ? { connect: { CountryMasterSid: payload.CountryMasterSid } } : undefined,
    //                 stateMaster: { connect: { StateMasterSid: payload.StateMasterSid } },
    //                 cityMaster: { connect: { CityMasterSid: payload.CityMasterSid } },

    //             }
    //         })
    //         return createdLead;
    //     } catch (error) {
    //         throw error;
    //     }
    // }
    async createNewLead(payload: any) {
    try {
        // Step 1: Normalize payload (keep your existing logic)
        if (payload.city && typeof payload.city === 'object') {
            payload.CityMasterSid = payload.city.CityMasterSid;
            delete payload.city;
        }

        // Step 2: Validate required fields
        if (!payload.CityMasterSid) {
            throw new BadRequestException('CityMasterSid is required');
        }

        if (!payload.CompanyMasterSid) {
            throw new BadRequestException('CompanyMasterSid is required');
        }

        // Step 3: Check for duplicate lead
        // Define duplicate criteria based on your business logic
        const duplicateConditions: any = {
            status:'A',
            OR: []
        };

        if (payload.preCustomerName?.trim()) {
            duplicateConditions.OR.push({
                preCustomerName: { 
                    equals: payload.preCustomerName.trim(), 
                    mode: 'insensitive',
                }
            });
        }

        // Also check within the same company context
        duplicateConditions.CompanyMasterSid = payload.CompanyMasterSid;

        // Only run duplicate check if we have at least one criteria
        if (duplicateConditions.OR.length > 0) {
            const existingLead = await this._db.preCustomerMaster.findFirst({
                where: duplicateConditions
            });

            if (existingLead) {
                // Provide specific error messages based on what matched
                if (existingLead.preCustomerName?.toLowerCase() === payload.preCustomerName?.trim().toLowerCase()) {
                    throw new BadRequestException('Lead already exists.');
                }
                // Generic fallback
                throw new BadRequestException('Duplicate lead detected');
            }
        }

        // Step 4: Create the lead with proper error handling
        const createdLead = await this._db.preCustomerMaster.create({
            data: {
                preCustomerName: payload.preCustomerName,
                leadReferredBy: payload.leadReferredBy,
                leadFrom: payload.leadFrom,
                preCustomerType: payload.preCustomerType,
                preCustomerAddress1: payload.preCustomerAddress1,
                preCustomerAddress2: payload.preCustomerAddress2,
                POBOX: payload.POBOX,
                contactPerson: payload.contactPerson,
                email: payload.email,
                phone: payload.phone,
                PreferredContactMode: payload.PreferredContactMode,
                LanguagePreferrence: payload.LanguagePreferrence,
                ServiceOfInterest: payload.ServiceOfInterest,
                PurchaseTimeline: payload.PurchaseTimeline,
                SpecificRequirements: payload.SpecificRequirements,
                Industry: payload.Industry,
                CompanySize: payload.CompanySize,
                AnnualRevenue: payload.AnnualRevenue,
                Notes: payload.Notes,
                status: payload.status,
                createdBy: payload.createdBy,
                isQualify: payload.isQualify,
                leadStatus: payload.leadStatus,
                
                // ✅ Connect required relations
                companyMaster: { connect: { CompanyMasterSid: payload.CompanyMasterSid } },
                branchMaster: payload.BranchMasterSid ? { 
                    connect: { BranchMasterSid: payload.BranchMasterSid } 
                } : undefined,
                countryMaster: payload.CountryMasterSid ? { 
                    connect: { CountryMasterSid: payload.CountryMasterSid } 
                } : undefined,
                stateMaster: { connect: { StateMasterSid: payload.StateMasterSid } },
                cityMaster: { connect: { CityMasterSid: payload.CityMasterSid } },
            }
        });

        this.logger.log(`Lead created: ${JSON.stringify(createdLead)}`);
        return createdLead;

    } catch (error) {
        this.logger.error(`Error creating lead: ${error.message}`, error.stack);
        
        // If it's already a BadRequestException (like from duplicate check), rethrow it
        if (error instanceof BadRequestException) {
            throw error;
        }
        
        // Handle Prisma unique constraint errors if you have unique constraints in DB
        if (error.code === 'P2002') {
            const field = error.meta?.target?.[0];
            throw new BadRequestException(
                `A lead with this ${field} already exists`
            );
        }
        
        // For other errors, wrap them or rethrow
        throw new InternalServerErrorException('Failed to create lead');
    }
}

    async fetchLeadById(PreCustomerMasterSid: number) {
        try {
            const ourLead = await this._db.preCustomerMaster.findUnique({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                }
            })
            if (!ourLead) {
                throw new BadRequestException(`Lead with Id : ${PreCustomerMasterSid} not exists`);
            }
            return ourLead;
        } catch (error) {
            throw error;
        }
    }

    // async updateLeadById(PreCustomerMasterSid: number, payload) {
    //     try {
    //         const exist = await this._db.preCustomerMaster.findUnique({
    //             where: {
    //                 PreCustomerMasterSid: PreCustomerMasterSid
    //             }
    //         })
    //         if (!exist) {
    //             throw new BadRequestException(`Lead with Id : ${PreCustomerMasterSid} not exists`);
    //         }
    //         if (payload.city && typeof payload.city === 'object') {
    //             payload.CityMasterSid = payload.city.CityMasterSid;
    //             delete payload.city;
    //         }

    //         if (!payload.CityMasterSid) {
    //             throw new BadRequestException('CityMasterSid is required');
    //         }
    //         const updatedLead = this._db.preCustomerMaster.update({
    //             where: {
    //                 PreCustomerMasterSid: PreCustomerMasterSid
    //             },
    //             data: payload
    //         })
    //         return updatedLead;
    //     } catch (error) {
    //         throw error;
    //     }
    // }

    async updateLeadById(PreCustomerMasterSid: number, payload: any) {
    try {
        // 1️⃣ Check existing lead
        const exist = await this._db.preCustomerMaster.findUnique({
            where: { PreCustomerMasterSid }
        });

        if (!exist) {
            throw new BadRequestException(
                `Lead with Id : ${PreCustomerMasterSid} not exists`
            );
        }

        // 2️⃣ Normalize city payload
        if (payload.city && typeof payload.city === 'object') {
            payload.CityMasterSid = payload.city.CityMasterSid;
            delete payload.city;
        }

        if (!payload.CityMasterSid) {
            throw new BadRequestException('CityMasterSid is required');
        }

        if (!payload.CompanyMasterSid) {
            throw new BadRequestException('CompanyMasterSid is required');
        }

        // 3️⃣ DUPLICATE CHECK (exclude current record)
        if (payload.preCustomerName?.trim()) {
            const duplicateLead = await this._db.preCustomerMaster.findFirst({
                where: {
                    PreCustomerMasterSid: {
                        not: PreCustomerMasterSid, // 🔑 exclude current lead
                    },
                    CompanyMasterSid: payload.CompanyMasterSid,
                    preCustomerName: {
                        equals: payload.preCustomerName.trim(),
                        mode: 'insensitive',
                    },
                    status: 'A',
                },
            });

            if (duplicateLead) {
                throw new BadRequestException(
                    'lead already exists'
                );
            }
        }

        // 4️⃣ Update lead
        const updatedLead = await this._db.preCustomerMaster.update({
            where: { PreCustomerMasterSid },
            data: {
                preCustomerName: payload.preCustomerName,
                leadReferredBy: payload.leadReferredBy,
                leadFrom: payload.leadFrom,
                preCustomerType: payload.preCustomerType,
                preCustomerAddress1: payload.preCustomerAddress1,
                preCustomerAddress2: payload.preCustomerAddress2,
                POBOX: payload.POBOX,
                contactPerson: payload.contactPerson,
                email: payload.email,
                phone: payload.phone,
                PreferredContactMode: payload.PreferredContactMode,
                LanguagePreferrence: payload.LanguagePreferrence,
                ServiceOfInterest: payload.ServiceOfInterest,
                PurchaseTimeline: payload.PurchaseTimeline,
                SpecificRequirements: payload.SpecificRequirements,
                Industry: payload.Industry,
                CompanySize: payload.CompanySize,
                AnnualRevenue: payload.AnnualRevenue,
                Notes: payload.Notes,
                isQualify: payload.isQualify,
                leadStatus: payload.leadStatus,
                CityMasterSid: payload.CityMasterSid,
                StateMasterSid: payload.StateMasterSid,
                CountryMasterSid: payload.CountryMasterSid,
                BranchMasterSid: payload.BranchMasterSid,
            },
        });

        this.logger.log(`Lead updated: ${PreCustomerMasterSid}`);
        return updatedLead;

    } catch (error) {
        this.logger.error(
            `Error updating lead ${PreCustomerMasterSid}: ${error.message}`,
            error.stack
        );

        if (error instanceof BadRequestException) {
            throw error;
        }

        if (error.code === 'P2002') {
            throw new BadRequestException(
                'Duplicate lead detected'
            );
        }

        throw new InternalServerErrorException(
            'Failed to update lead'
        );
    }
}



    async deleteLead(PreCustomerMasterSid: number) {
        try {
            const exist = await this._db.preCustomerMaster.findUnique({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Lead with Id : ${PreCustomerMasterSid} not exists`);
            }
            if (exist.status === 'D') {
                throw new BadRequestException(`Lead with Id :${PreCustomerMasterSid} is already deleted`)
            }
            const deletedLead = this._db.preCustomerMaster.update({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                },
                data: {
                    status: 'D'
                }
            })
            return deletedLead;
        } catch (error) {
            throw error;
        }
    }


    async searchLead(params: filterDto) {
        const { search = '', page = 1, pageSize = 10, activeCompanyId, activeBranchId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.PreCustomerMasterWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
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

        const [items, totalCount] = await this._db.$transaction([
        this._db.preCustomerMaster.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { PreCustomerMasterSid: 'desc' },
            include:{
                branchMaster:true,
                companyMaster:true,
                preCustomerMeeting:true,
                countryMaster:true,
                stateMaster:true,
                cityMaster:true,
            }
        }),
        this._db.preCustomerMaster.count({ where }),
    ]);

    return { items, totalCount };
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
