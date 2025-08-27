import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { SearchListDto } from 'src/masters/DTO/search-list.dto';

@Injectable()
export class PreCustomerEventService {
    constructor(private db: DatabaseService) {}

    async getAllEvents() {
        try {
            return await this.db.preCustomerEvent.findMany({
                where: {
                    status : 'A'
                },
                include: {
                    companyMaster: true
                }
            });
        } catch (error) {
            throw error;
        }
    }

    async createNewEvent(payload: any) {
        try {
            return await this.db.preCustomerEvent.create({
                data: {
                    ...payload,
                    
                },
                include: {
                    companyMaster: true
                }
            });
        } catch (error) {
            throw error;
        }
    }

    async getEventById(PreCustomerEventSid: number) {
        try {
            const event = await this.db.preCustomerEvent.findUnique({
                where: {
                    PreCustomerEventSid
                },
                include: {
                    companyMaster: true
                }
            });
            
            if (!event) {
                throw new BadRequestException(`Pre-Customer Event with ID: ${PreCustomerEventSid} does not exist`);
            }
            
            return event;
        } catch (error) {
            throw error;
        }
    }

    async updateEventById(PreCustomerEventSid: number, payload: any) {
        try {
            const exists = await this.db.preCustomerEvent.findUnique({
                where: { PreCustomerEventSid }
            });
            
            if (!exists) {
                throw new BadRequestException(`Pre-Customer Event with ID: ${PreCustomerEventSid} does not exist`);
            }
            
            return await this.db.preCustomerEvent.update({
                where: { PreCustomerEventSid },
                data: {
                    ...payload,
                    updatedBy: 'admin@crm.com'
                },
                include: {
                    companyMaster: true
                }
            });
        } catch (error) {
            throw error;
        }
    }

    async deleteEvent(PreCustomerEventSid: number) {
        try {
            const exists = await this.db.preCustomerEvent.findUnique({
                where: { PreCustomerEventSid }
            });
            
            if (!exists) {
                throw new BadRequestException(`Pre-Customer Event with ID: ${PreCustomerEventSid} does not exist`);
            }
            
            if (exists.status === 'D') {
                throw new BadRequestException(`Pre-Customer Event with ID: ${PreCustomerEventSid} is already deleted`);
            }
            
            return await this.db.preCustomerEvent.update({
                where: { PreCustomerEventSid },
                data: {
                    status:'D',
                    updatedBy: 'admin@crm.com'
                }
            });
        } catch (error) {
            throw error;
        }
    }

    async searchEvents(data: SearchListDto) {
        const { searchType, filterValue } = data;
        const intFields = [
            'PreCustomerEventSid',
            'TotalLeadRecd',
            'TotalLeadSuccess',
            'EventLeader',
            'CompanyMasterSid'
        ];
        
        const stringFields = [
            'EventName',
            'EventCity',
            'status',
            'Remarks'
        ];
        
        const dateFields = [
            'EventDate'
        ];
        
        const acceptedTypes = [...intFields, ...stringFields, ...dateFields];
        
        if (!acceptedTypes.includes(searchType)) {
            throw new BadRequestException('Invalid Search Type');
        }

        const whereClause: any = { status : 'A' };

        if (stringFields.includes(searchType)) {
            whereClause[searchType] = {
                contains: filterValue,
                mode: 'insensitive'
            };
        } else if (intFields.includes(searchType)) {
            const numberValue = parseInt(filterValue);
            if (isNaN(numberValue)) {
                throw new BadRequestException(`${searchType} must be a valid number`);
            }
            whereClause[searchType] = numberValue;
        } else if (dateFields.includes(searchType)) {
            const dateValue = new Date(filterValue);
            if (isNaN(dateValue.getTime())) {
                throw new BadRequestException(`${searchType} must be a valid date`);
            }
            whereClause[searchType] = dateValue;
        }

        return await this.db.preCustomerEvent.findMany({
            where: whereClause,
            include: {
                companyMaster: true
            }
        });
    }
}