import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { statusWhereClause } from 'src/common/helper';
import { DatabaseService } from 'src/database/database.service';
import { filterDto } from 'src/masters/DTO/search-vessel.dto';
import { CreateUpdatePreCustomerEventDto } from 'src/masters/DTO/pre-customer-event.dto';

@Injectable()
export class PreCustomerEventMasterService {
    constructor(private _db: DatabaseService, private logger: Logger) { }

    private extractEmail(user: any): string {
        return user?.userEmail || user?.UserEmail || user?.email || '';
    }

    private validateLeads(payload: { TotalLeadRecd?: number; TotalLeadSuccess?: number }) {
        const recd = payload.TotalLeadRecd ?? 0;
        const success = payload.TotalLeadSuccess ?? 0;
        if (success > recd) {
            throw new BadRequestException('Total Lead Success cannot exceed Total Lead Received');
        }
    }

    async create(payload: CreateUpdatePreCustomerEventDto, user: any) {
        this.logger.log(`createPreCustomerEvent: ${JSON.stringify(payload)}`);
        const userEmail = this.extractEmail(user);

        this.validateLeads(payload);

        const existing = await this._db.preCustomerEvent.findFirst({
            where: {
                CompanyMasterSid: payload.CompanyMasterSid,
                EventName: { equals: payload.EventName.trim(), mode: 'insensitive' },
                status: statusWhereClause,
            },
        });
        if (existing) {
            throw new BadRequestException('Event name already exists');
        }

        const event = await this._db.preCustomerEvent.create({
            data: {
                EventName: payload.EventName.trim(),
                CityMasterSid: payload.CityMasterSid,
                EventDate: new Date(payload.EventDate),
                TotalLeadRecd: payload.TotalLeadRecd ?? 0,
                TotalLeadSuccess: payload.TotalLeadSuccess ?? 0,
                EventLeader: payload.EventLeader,
                CompanyMasterSid: payload.CompanyMasterSid,
                Remarks: payload.Remarks,
                status: payload.status || 'A',
                createdBy: userEmail,
            },
        });

        return event;
    }

    async findAll(CompanyMasterSid: number) {
        return this._db.preCustomerEvent.findMany({
            where: {
                CompanyMasterSid,
                status: statusWhereClause,
            },
            include: {
                eventLeaderUser: {
                    select: { UserMasterSid: true, userName: true, userEmail: true },
                },
                cityMaster: {
                    select: { CityMasterSid: true, cityName: true },
                },
            },
            orderBy: { EventDate: 'desc' },
        });
    }

    async findOne(id: number) {
        const event = await this._db.preCustomerEvent.findUnique({
            where: { PreCustomerEventSid: id },
            include: {
                eventLeaderUser: {
                    select: { UserMasterSid: true, userName: true, userEmail: true },
                },
                cityMaster: {
                    select: { CityMasterSid: true, cityName: true },
                },
                companyMaster: {
                    select: { CompanyMasterSid: true, companyName: true },
                },
            },
        });
        if (!event) {
            throw new NotFoundException(`PreCustomerEvent with ID ${id} not found`);
        }
        return event;
    }

    async update(id: number, payload: any, user: any) {
        this.logger.log(`updatePreCustomerEvent: ${id} ${JSON.stringify(payload)}`);
        const userEmail = this.extractEmail(user);

        const existing = await this._db.preCustomerEvent.findUnique({
            where: { PreCustomerEventSid: id },
        });
        if (!existing) {
            throw new NotFoundException(`PreCustomerEvent with ID ${id} not found`);
        }

        if (payload.TotalLeadRecd !== undefined || payload.TotalLeadSuccess !== undefined) {
            this.validateLeads({
                TotalLeadRecd: payload.TotalLeadRecd ?? existing.TotalLeadRecd,
                TotalLeadSuccess: payload.TotalLeadSuccess ?? existing.TotalLeadSuccess,
            });
        }

        if (payload.EventName && payload.EventName.trim().toLowerCase() !== existing.EventName.toLowerCase()) {
            const duplicate = await this._db.preCustomerEvent.findFirst({
                where: {
                    CompanyMasterSid: payload.CompanyMasterSid ?? existing.CompanyMasterSid,
                    EventName: { equals: payload.EventName.trim(), mode: 'insensitive' },
                    status: statusWhereClause,
                    PreCustomerEventSid: { not: id },
                },
            });
            if (duplicate) {
                throw new BadRequestException('Event name already exists');
            }
        }

        const data: Prisma.PreCustomerEventUpdateInput = {
            EventName: payload.EventName?.trim() ?? existing.EventName,
            EventDate: payload.EventDate ? new Date(payload.EventDate) : existing.EventDate,
            TotalLeadRecd: payload.TotalLeadRecd ?? existing.TotalLeadRecd,
            TotalLeadSuccess: payload.TotalLeadSuccess ?? existing.TotalLeadSuccess,
            Remarks: payload.Remarks ?? existing.Remarks,
            status: payload.status ?? existing.status,
            updatedBy: userEmail,
            ...(payload.EventLeader !== undefined && {
                eventLeaderUser: { connect: { UserMasterSid: payload.EventLeader } },
            }),
            ...(payload.CompanyMasterSid !== undefined && {
                companyMaster: { connect: { CompanyMasterSid: payload.CompanyMasterSid } },
            }),
            ...(payload.CityMasterSid !== undefined && {
                cityMaster: { connect: { CityMasterSid: payload.CityMasterSid } },
            }),
        };

        return this._db.preCustomerEvent.update({
            where: { PreCustomerEventSid: id },
            data,
        });
    }

    async softDelete(id: number, user: any) {
        const userEmail = this.extractEmail(user);
        const existing = await this._db.preCustomerEvent.findUnique({
            where: { PreCustomerEventSid: id },
        });
        if (!existing) {
            throw new NotFoundException(`PreCustomerEvent with ID ${id} not found`);
        }
        if (existing.status === 'D') {
            throw new BadRequestException(`PreCustomerEvent with ID ${id} is already deleted`);
        }
        return this._db.preCustomerEvent.update({
            where: { PreCustomerEventSid: id },
            data: { status: 'D', updatedBy: userEmail, deletedAt: new Date() },
        });
    }

    async searchList(params: filterDto) {
        const { search = '', page = 1, pageSize = 15, activeCompanyId } = params;
        const skip = (page - 1) * pageSize;

        const where: Prisma.PreCustomerEventWhereInput = {
            status: statusWhereClause,
            CompanyMasterSid: activeCompanyId,
            ...(search
                ? {
                    OR: [
                        { EventName: { contains: search, mode: 'insensitive' } },
                        { cityMaster: { cityName: { contains: search, mode: 'insensitive' } } },
                        { Remarks: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };

        const [items, totalCount] = await this._db.$transaction([
            this._db.preCustomerEvent.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { EventDate: 'desc' },
                include: {
                    eventLeaderUser: {
                        select: { UserMasterSid: true, userName: true, userEmail: true },
                    },
                    cityMaster: {
                        select: { CityMasterSid: true, cityName: true },
                    },
                },
            }),
            this._db.preCustomerEvent.count({ where }),
        ]);

        return { items, totalCount };
    }

    async getNotificationsForUser(user: any) {
        const userEmail = this.extractEmail(user).trim();
        const userMasterSid: number | undefined = user?.UserMasterSid;

        // UTC-based "today/tomorrow" window — robust against server timezone drift.
        // EventDate is stored as a DATE (no time/zone), Prisma returns it as 00:00:00Z.
        const now = new Date();
        const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const tomorrowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59, 999));

        const orClauses: Prisma.PreCustomerEventWhereInput[] = [];
        if (userEmail) orClauses.push({ createdBy: { equals: userEmail, mode: 'insensitive' } });
        if (userMasterSid) orClauses.push({ EventLeader: userMasterSid });
        if (orClauses.length === 0) return [];

        this.logger.log(
            `getNotificationsForUser: userEmail="${userEmail}", UserMasterSid=${userMasterSid}, ` +
            `windowUTC=[${todayStart.toISOString()}, ${tomorrowEnd.toISOString()}]`,
        );

        const events = await this._db.preCustomerEvent.findMany({
            where: {
                status: 'A',
                EventDate: { gte: todayStart, lte: tomorrowEnd },
                OR: orClauses,
            },
            include: {
                eventLeaderUser: { select: { userName: true } },
                cityMaster: { select: { cityName: true } },
            },
            orderBy: { EventDate: 'asc' },
        });

        this.logger.log(`getNotificationsForUser: matched ${events.length} event(s)`);

        const todayUtcMidnight = todayStart.getTime();
        return events.map((ev) => {
            const evDate = new Date(ev.EventDate);
            const evUtcMidnight = Date.UTC(evDate.getUTCFullYear(), evDate.getUTCMonth(), evDate.getUTCDate());
            const isToday = evUtcMidnight === todayUtcMidnight;
            const whenLabel = isToday ? 'Today' : 'Tomorrow';
            return {
                PreCustomerEventSid: ev.PreCustomerEventSid,
                btn: isToday ? 'btn-danger' : 'btn-warning',
                icon: 'ti-calendar',
                title: ev.EventName,
                subject: `${whenLabel} • ${ev.cityMaster?.cityName ?? '—'} • Leader: ${ev.eventLeaderUser?.userName ?? '—'}`,
                time: evDate.toLocaleDateString('en-GB'),
                whenLabel,
                EventDate: ev.EventDate,
            };
        });
    }
}
