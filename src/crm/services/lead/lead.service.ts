import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';

@Injectable()
export class LeadService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    async getAllLeads(CompanyMasterSid: number, BranchMasterSid: number) {
        try {
            const allLeads = await this._db.preCustomerMaster.findMany({
                where: {
                    status: 'A',
                    CompanyMasterSid: CompanyMasterSid,
                    BranchMasterSid: BranchMasterSid
                }
            })
            return allLeads;
        } catch (error) {
            throw error;
        }
    }

    async createNewLead(payload) {
        try {
            if (payload.city && typeof payload.city === 'object') {
                payload.CityMasterSid = payload.city.CityMasterSid;
                delete payload.city;
            }

            if (!payload.CityMasterSid) {
                throw new BadRequestException('CityMasterSid is required');
            }
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

                    // ✅ Fix: connect required relations
                    companyMaster: { connect: { CompanyMasterSid: payload.CompanyMasterSid } },
                    branchMaster: payload.BranchMasterSid ? { connect: { BranchMasterSid: payload.BranchMasterSid } } : undefined,
                    countryMaster: payload.CountryMasterSid ? { connect: { CountryMasterSid: payload.CountryMasterSid } } : undefined,
                    stateMaster: { connect: { StateMasterSid: payload.StateMasterSid } },
                    cityMaster: { connect: { CityMasterSid: payload.CityMasterSid } },

                }
            })
            return createdLead;
        } catch (error) {
            throw error;
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

    async updateLeadById(PreCustomerMasterSid: number, payload) {
        try {
            const exist = await this._db.preCustomerMaster.findUnique({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                }
            })
            if (!exist) {
                throw new BadRequestException(`Lead with Id : ${PreCustomerMasterSid} not exists`);
            }
            if (payload.city && typeof payload.city === 'object') {
                payload.CityMasterSid = payload.city.CityMasterSid;
                delete payload.city;
            }

            if (!payload.CityMasterSid) {
                throw new BadRequestException('CityMasterSid is required');
            }
            const updatedLead = this._db.preCustomerMaster.update({
                where: {
                    PreCustomerMasterSid: PreCustomerMasterSid
                },
                data: payload
            })
            return updatedLead;
        } catch (error) {
            throw error;
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


    async searchLead(param: filterDto) {
        const { search = '', page = 1, pageSize = 10, activeCompanyId, activeBranchId } = param;
        const skip = (page - 1) * pageSize;

        const where: any = {
            status: 'A',
            CompanyMasterSid: activeCompanyId,
            BranchMasterSid: activeBranchId,
        };


        if (search) {
            where.OR = [
                { preCustomerName: { contains: search, mode: 'insensitive' } },
                { contactPerson: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { preCustomerAddress1: { contains: search, mode: 'insensitive' } },
            ];
        }

        try {
            const [items, totalCount] = await this._db.$transaction([
                this._db.preCustomerMaster.findMany({
                    where,
                    skip,
                    take: pageSize,
                    orderBy: { PreCustomerMasterSid: 'desc' },
                }),
                this._db.preCustomerMaster.count({ where }),
            ]);

            return {
                items,
                totalCount,
                currentPage: page,
                totalPages: Math.ceil(totalCount / pageSize),
            };
        } catch (error) {
            this.logger.error(`Search Lead Error: ${error.message}`);
            throw new Error(`Error occurred during search: ${error.message}`);
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
