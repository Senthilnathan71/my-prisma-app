import { BadRequestException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
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

    private readonly leadStatusValues = new Set([
        'Discovery',
        'Qualify',
        'MeetingScheduled',
        'MeetingCompleted',
        'EnquiryGenerated',
        'QuotationCreated',
        'QuotationConfirmed',
        'ContractSigned',
        'DealWon',
        'DealLost',
        'CustomerCreated'
    ]);

    private normalizeLeadPayload(payload: any, isUpdate = false) {
        if (payload.city && typeof payload.city === 'object') {
            payload.CityMasterSid = payload.city.CityMasterSid;
            delete payload.city;
        }

        const hasField = (field: string) => Object.prototype.hasOwnProperty.call(payload, field);
        const cleanString = (field: string) => {
            if (!hasField(field) || payload[field] === undefined || payload[field] === null) return;
            payload[field] = String(payload[field]).trim();
            if (payload[field] === '') payload[field] = null;
        };

        [
            'createdBy', 'updatedBy', 'status', 'preCustomerAddress1', 'preCustomerAddress2',
            'contactPerson', 'phone', 'preCustomerType', 'leadReferredBy', 'preCustomerName',
            'leadFrom', 'email', 'Industry', 'LanguagePreferrence', 'Notes', 'POBOX',
            'PreferredContactMode', 'PurchaseTimeline', 'ServiceOfInterest',
            'SpecificRequirements', 'leadStatus', 'isQualify'
        ].forEach(cleanString);

        ['CompanySize', 'AnnualRevenue'].forEach((field) => {
            if (!hasField(field)) return;
            if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
                payload[field] = null;
                return;
            }
            const value = Number(payload[field]);
            if (!Number.isInteger(value)) {
                throw new BadRequestException(`${field} must be a valid whole number`);
            }
            payload[field] = value;
        });

        const requiredFields: Array<[string, string]> = [
            ['preCustomerName', 'Customer Name is required'],
            ['leadReferredBy', 'Lead Source is required'],
            ['leadFrom', 'Lead By is required'],
            ['preCustomerAddress1', 'Address1 is required'],
            ['CountryMasterSid', 'Country is required'],
            ['StateMasterSid', 'State is required'],
            ['CityMasterSid', 'City is required'],
            ['CompanyMasterSid', 'Company is required'],
            ['contactPerson', 'Contact Person is required'],
            ['email', 'E-mail is required'],
            ['phone', 'Phone is required'],
            ['status', 'Status is required']
        ];

        if (!isUpdate) {
            requiredFields.push(['createdBy', 'Created By is required']);
        }

        for (const [field, message] of requiredFields) {
            if ((!isUpdate || hasField(field)) && (payload[field] === undefined || payload[field] === null || payload[field] === '')) {
                throw new BadRequestException(message);
            }
        }

        const maxLengths: Array<[string, number, string]> = [
            ['createdBy', 100, 'Created By'],
            ['updatedBy', 100, 'Updated By'],
            ['preCustomerName', 100, 'Customer Name'],
            ['leadReferredBy', 20, 'Lead Source'],
            ['leadFrom', 20, 'Lead By'],
            ['preCustomerType', 10, 'Customer Type'],
            ['preCustomerAddress1', 300, 'Address1'],
            ['preCustomerAddress2', 300, 'Address2'],
            ['POBOX', 100, 'P.O Box'],
            ['contactPerson', 50, 'Contact Person'],
            ['email', 100, 'E-mail'],
            ['phone', 50, 'Phone'],
            ['PreferredContactMode', 100, 'Preferred Contact Mode'],
            ['LanguagePreferrence', 100, 'Language Preference'],
            ['ServiceOfInterest', 100, 'Service of Interest'],
            ['PurchaseTimeline', 100, 'Purchase Timeline'],
            ['SpecificRequirements', 100, 'Specific Requirement'],
            ['Industry', 100, 'Industry'],
            ['Notes', 100, 'Notes'],
            ['status', 1, 'Status'],
            ['isQualify', 1, 'Qualify Lead']
        ];

        for (const [field, limit, label] of maxLengths) {
            const value = payload[field];
            if (hasField(field) && value !== undefined && value !== null && String(value).length > Number(limit)) {
                throw new BadRequestException(`${label} must be ${limit} characters or less`);
            }
        }

        if (hasField('status') && !['A', 'S'].includes(payload.status)) {
            throw new BadRequestException('Status must be Active or Suspended');
        }

        if (hasField('isQualify') && !['Y', 'N'].includes(payload.isQualify || 'N')) {
            throw new BadRequestException('Qualify Lead must be Yes or No');
        }

        if (!isUpdate && !hasField('isQualify')) {
            payload.isQualify = 'N';
        }

        if (!isUpdate && !hasField('leadStatus')) {
            payload.leadStatus = payload.isQualify === 'Y' ? 'Qualify' : 'Discovery';
        }

        if (hasField('leadStatus') && !this.leadStatusValues.has(payload.leadStatus)) {
            throw new BadRequestException('Lead Status is invalid');
        }

        if (hasField('email')) {
            const emailValue = String(payload.email);
            if (emailValue.toUpperCase() !== 'NA') {
                const emails = emailValue.split(',').map(email => email.trim()).filter(Boolean);
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (emails.length === 0 || emails.some(email => !emailRegex.test(email))) {
                    throw new BadRequestException('E-mail must be valid. Example: user@example.com or NA');
                }
            }
        }

        if (hasField('phone') && !/^\+?[0-9]{6,20}$/.test(String(payload.phone))) {
            throw new BadRequestException('Phone must contain 6 to 20 digits including country code');
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
    //                 // Connect required relations
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
        this.normalizeLeadPayload(payload);

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

        // Only run duplicate check when a lead name is provided
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
                
                // Connect required relations
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
        
        // Preserve field validation and duplicate messages
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

    async fetchLeadById(PreCustomerMasterSid: number, CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const ourLead = await this._db.preCustomerMaster.findUnique({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid,
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                }
            })
            if (!ourLead) {
                throw new UnauthorizedException(`Access denied`);
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
        // Check existing lead
        const exist = await this._db.preCustomerMaster.findUnique({
            where: { PreCustomerMasterSid }
        });

        if (!exist) {
            throw new BadRequestException(
                `Lead with Id : ${PreCustomerMasterSid} not exists`
            );
        }

        this.normalizeLeadPayload(payload, true);

        // Duplicate check excluding current record
        if (payload.preCustomerName?.trim()) {
            const duplicateLead = await this._db.preCustomerMaster.findFirst({
                where: {
                    PreCustomerMasterSid: {
                        not: PreCustomerMasterSid, // exclude current lead
                    },
                    CompanyMasterSid: payload.CompanyMasterSid || exist.CompanyMasterSid,
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

        const allowedUpdateFields = [
            'preCustomerName',
            'leadReferredBy',
            'leadFrom',
            'preCustomerType',
            'preCustomerAddress1',
            'preCustomerAddress2',
            'POBOX',
            'contactPerson',
            'email',
            'phone',
            'PreferredContactMode',
            'LanguagePreferrence',
            'ServiceOfInterest',
            'PurchaseTimeline',
            'SpecificRequirements',
            'Industry',
            'CompanySize',
            'AnnualRevenue',
            'Notes',
            'status',
            'updatedBy',
            'isQualify',
            'leadStatus',
            'CityMasterSid',
            'StateMasterSid',
            'CountryMasterSid',
            'BranchMasterSid'
        ];

        const updateData = allowedUpdateFields.reduce((data, field) => {
            if (Object.prototype.hasOwnProperty.call(payload, field)) {
                data[field] = payload[field];
            }
            return data;
        }, {} as any);

        if (Object.keys(updateData).length === 0) {
            throw new BadRequestException('No changes to update');
        }

        // Update lead
        const updatedLead = await this._db.preCustomerMaster.update({
            where: { PreCustomerMasterSid },
            data: updateData,
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
